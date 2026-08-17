import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiagnosticsHeaders,
  resolveBuildDiagnostics,
} from "../app/build-diagnostics";

test("Vercel 빌드 식별자는 공식 환경변수에서 안전하게 구성한다", () => {
  const diagnostics = resolveBuildDiagnostics({
    VERCEL: "1",
    VERCEL_GIT_COMMIT_SHA: "commit-123",
    VERCEL_GIT_COMMIT_REF: "preview/diagnostics",
    VERCEL_ENV: "preview",
    VERCEL_URL: "preview.example.vercel.app",
    VERCEL_DEPLOYMENT_ID: "dpl_123",
  });

  assert.deepEqual(diagnostics, {
    buildCommitSha: "commit-123",
    deploymentEnvironment: "preview",
    deploymentUrl: "https://preview.example.vercel.app",
    deploymentId: "dpl_123",
    gitBranch: "preview/diagnostics",
    appVersion: "0.1.0",
  });
  assert.equal(
    buildDiagnosticsHeaders(diagnostics)["x-baroform-build-sha"],
    "commit-123",
  );
});

test("로컬 빌드 식별자는 git 값만 fallback으로 사용한다", () => {
  const diagnostics = resolveBuildDiagnostics(
    { NODE_ENV: "development" },
    { commitSha: "local-sha", branch: "codex/local" },
  );

  assert.equal(diagnostics.buildCommitSha, "local-sha");
  assert.equal(diagnostics.deploymentEnvironment, "local");
  assert.equal(diagnostics.deploymentUrl, null);
  assert.equal(diagnostics.deploymentId, null);
  assert.equal(diagnostics.gitBranch, "codex/local");
});
