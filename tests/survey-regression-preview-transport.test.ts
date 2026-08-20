import assert from "node:assert/strict";
import test from "node:test";

import {
  PreviewTransportError,
  hasParseableVercelHttpResponse,
  resolveVercelCurlProcessResult,
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
