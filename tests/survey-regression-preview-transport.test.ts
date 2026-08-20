import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildSafeChildProcessEnv,
  PreviewTransportError,
  hasParseableVercelHttpResponse,
  redactPreviewTransportData,
  resolvePnpmNodeInvocation,
  resolveVercelCurlProcessResult,
  runPreviewTransportPreflight,
  withPreviewTransportRetry,
} from "../evals/survey-regression/v1/preview-transport";

const valid422 = [
  "HTTP/2 422 Unprocessable Entity",
  "content-type: application/json",
  "x-baroform-request-id: request-422",
  "",
  JSON.stringify({ type: "error", ok: false, code: "SEMANTIC_VALIDATION_FAILED" }),
].join("\r\n");

test("Vercel curl exit 1에 응답이 없으면 안전한 환경 전송 실패다", () => {
  assert.throws(
    () => resolveVercelCurlProcessResult({
      exitCode: 1,
      stdout: "",
      stderr: "connection closed",
    }),
    (error) =>
      error instanceof PreviewTransportError &&
      error.kind === "environment_transport_failure" &&
      error.safeCode === "VERCEL_CURL_CONNECTION_FAILURE" &&
      error.retryable,
  );
});

test("exit 1이어도 유효한 HTTP 422 응답은 제품 응답으로 보존한다", () => {
  const envelope = JSON.stringify({ response: valid422 });
  assert.equal(hasParseableVercelHttpResponse(envelope), true);
  assert.equal(
    resolveVercelCurlProcessResult({
      exitCode: 1,
      stdout: envelope,
      stderr: "command exited with status 1",
    }),
    envelope,
  );
});

test("exit 0의 정상 survey HTTP 응답을 그대로 보존한다", () => {
  const wire = [
    "HTTP/2 200 OK",
    "content-type: application/json",
    "",
    JSON.stringify({ type: "survey", ok: true }),
  ].join("\r\n");
  assert.equal(
    resolveVercelCurlProcessResult({ exitCode: 0, stdout: wire, stderr: "" }),
    wire,
  );
});

test("transient 전송 실패는 최대 한 번 재시도하고 성공 결과를 반환한다", async () => {
  let attempts = 0;
  const result = await withPreviewTransportRetry(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new PreviewTransportError({
        kind: "environment_transport_failure",
        safeCode: "VERCEL_CURL_EXIT_1",
        retryable: true,
      });
    }
    return "ok";
  });
  assert.deepEqual(result, { value: "ok", retryCount: 1 });
  assert.equal(attempts, 2);
});

test("인증 실패는 재시도하지 않는다", async () => {
  let attempts = 0;
  await assert.rejects(
    withPreviewTransportRetry(async () => {
      attempts += 1;
      throw new PreviewTransportError({
        kind: "environment_auth_failure",
        safeCode: "VERCEL_CURL_AUTH_FAILURE",
        retryable: false,
      });
    }),
    (error) =>
      error instanceof PreviewTransportError &&
      error.kind === "environment_auth_failure",
  );
  assert.equal(attempts, 1);
});

test("Windows Path·PATH 조합과 빈 PATH에서도 현재 Node 경로를 안전하게 전달한다", () => {
  const nodeExecutable = "C:\\runtime\\node\\node.exe";
  for (const source of [
    { Path: "C:\\Windows\\System32" },
    { PATH: "C:\\Windows\\System32" },
    { Path: "C:\\Windows", PATH: "C:\\ignored" },
    {},
  ]) {
    const env = buildSafeChildProcessEnv({
      source,
      nodeExecutable,
      platform: "win32",
    });
    assert.match(env.Path ?? "", /^C:\\runtime\\node(?:;|$)/iu);
  }
});

test("child env는 Vercel·OpenAI 비밀값을 전달하지 않는다", () => {
  const env = buildSafeChildProcessEnv({
    source: {
      Path: "C:\\Windows",
      SYSTEMROOT: "C:\\Windows",
      OPENAI_API_KEY: "synthetic-openai-secret",
      VERCEL_TOKEN: "synthetic-vercel-secret",
      COOKIE: "synthetic-cookie",
    },
    nodeExecutable: "C:\\runtime\\node\\node.exe",
    platform: "win32",
  });
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.VERCEL_TOKEN, undefined);
  assert.equal(env.COOKIE, undefined);
  assert.equal(env.SYSTEMROOT, "C:\\Windows");
});

test("Windows pnpm.cmd는 shell 없이 process.execPath와 pnpm.mjs로 변환한다", () => {
  const invocation = resolvePnpmNodeInvocation({
    pnpmLauncherPath: "C:\\runtime\\dependencies\\bin\\fallback\\pnpm.cmd",
    arguments: ["dlx", "vercel@59.1.3", "--version"],
    nodeExecutable: "C:\\runtime\\dependencies\\node\\bin\\node.exe",
    platform: "win32",
    sourceEnv: { Path: "C:\\Windows" },
  });
  assert.equal(
    invocation.executable,
    "C:\\runtime\\dependencies\\node\\bin\\node.exe",
  );
  assert.match(invocation.arguments[0] ?? "", /pnpm[\\/]bin[\\/]pnpm\.mjs$/u);
  assert.deepEqual(invocation.arguments.slice(1), [
    "dlx",
    "vercel@59.1.3",
    "--version",
  ]);
});

test("Preview query·header·JWT·API key 진단값을 공통 redactor가 제거한다", () => {
  const source = [
    "https://preview.invalid/?_vercel_share=synthetic-share-value&next=/",
    "authorization: Bearer synthetic-authorization-value",
    "cookie=session=synthetic-cookie-value",
    "x-vercel-protection-bypass: synthetic-bypass-value",
    "signature=synthetic-signature-value",
    "sk-synthetic012345678901234567",
    "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.syntheticSignature",
  ].join("\n");
  const redacted = redactPreviewTransportData(source);
  assert.doesNotMatch(
    redacted,
    /synthetic-(?:share|authorization|cookie|bypass|signature)/u,
  );
  assert.doesNotMatch(redacted, /sk-synthetic/u);
  assert.doesNotMatch(redacted, /eyJhbGci/u);
  assert.match(redacted, /\[REDACTED\]/u);
});

test("네트워크 없는 preflight는 동일 Node launcher와 최소 child env로 성공한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "baroform-preview-preflight-"));
  const launcher = join(directory, "mock-pnpm.mjs");
  try {
    await writeFile(launcher, "process.stdout.write('Vercel CLI mock\\n');\n", "utf8");
    const result = await runPreviewTransportPreflight({
      pnpmLauncherPath: launcher,
      cwd: directory,
      nodeExecutable: process.execPath,
      sourceEnv: {
        ...process.env,
        OPENAI_API_KEY: "synthetic-openai-secret",
        VERCEL_TOKEN: "synthetic-vercel-secret",
      },
      globalConfigDirectory: directory,
    });
    assert.equal(result.nodeExecutableResolved, true);
    assert.equal(result.vercelCliExecutableResolved, true);
    assert.equal(result.childPathConfigured, true);
    assert.equal(result.authConfigAccessible, true);
    assert.equal(result.redactionApplied, true);
    assert.equal(result.exitCode, 0);
    assert.equal(result.sanitizedTransportCode, "RUNNER_PREFLIGHT_OK");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preflight는 Node child 시작 전 실행 파일 부재를 안전 코드로 구분한다", async () => {
  await assert.rejects(
    runPreviewTransportPreflight({
      pnpmLauncherPath: "missing-pnpm.mjs",
      cwd: process.cwd(),
      nodeExecutable: "missing-node-executable",
      globalConfigDirectory: process.cwd(),
    }),
    (error) =>
      error instanceof PreviewTransportError &&
      error.safeCode === "RUNNER_NODE_EXECUTABLE_UNAVAILABLE",
  );
});
