import { execFileSync } from "node:child_process";
import packageMetadata from "../package.json";

export type BuildDiagnostics = {
  buildCommitSha: string | null;
  deploymentEnvironment: string | null;
  deploymentUrl: string | null;
  deploymentId: string | null;
  gitBranch: string | null;
  appVersion: string | null;
};

type BuildEnvironment = Record<string, string | undefined>;

function normalizedValue(value: string | undefined, maxLength = 300) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function localGitValue(args: string[]) {
  try {
    return normalizedValue(
      execFileSync("git", args, {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2_000,
      }),
    );
  } catch {
    return null;
  }
}

function deploymentUrl(value: string | undefined) {
  const normalized = normalizedValue(value);
  if (!normalized) return null;
  return /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;
}

export function resolveBuildDiagnostics(
  environment: BuildEnvironment,
  localGit: { commitSha?: string | null; branch?: string | null } = {},
): BuildDiagnostics {
  const isVercel = Boolean(environment.VERCEL);
  const nodeEnvironment = normalizedValue(environment.NODE_ENV, 40);
  return {
    buildCommitSha:
      normalizedValue(environment.VERCEL_GIT_COMMIT_SHA, 80) ??
      normalizedValue(environment.GIT_COMMIT_SHA, 80) ??
      normalizedValue(localGit.commitSha ?? undefined, 80),
    deploymentEnvironment:
      normalizedValue(environment.VERCEL_ENV, 40) ??
      (isVercel ? null : nodeEnvironment === "development" ? "local" : nodeEnvironment),
    deploymentUrl: deploymentUrl(environment.VERCEL_URL),
    deploymentId:
      normalizedValue(environment.VERCEL_DEPLOYMENT_ID, 160) ??
      normalizedValue(environment.NEXT_DEPLOYMENT_ID, 160),
    gitBranch:
      normalizedValue(environment.VERCEL_GIT_COMMIT_REF, 200) ??
      normalizedValue(environment.GIT_BRANCH, 200) ??
      normalizedValue(localGit.branch ?? undefined, 200),
    appVersion: normalizedValue(packageMetadata.version, 80),
  };
}

let cachedBuildDiagnostics: BuildDiagnostics | null = null;

export function currentBuildDiagnostics() {
  if (cachedBuildDiagnostics) return cachedBuildDiagnostics;
  const isVercel = Boolean(process.env.VERCEL);
  cachedBuildDiagnostics = resolveBuildDiagnostics(process.env, {
    commitSha: isVercel ? null : localGitValue(["rev-parse", "HEAD"]),
    branch: isVercel
      ? null
      : localGitValue(["branch", "--show-current"]),
  });
  return cachedBuildDiagnostics;
}

function headerValue(value: string | null) {
  return value?.replace(/[\r\n]/g, "").slice(0, 300) ?? "";
}

export function buildDiagnosticsHeaders(
  diagnostics = currentBuildDiagnostics(),
) {
  return {
    "x-baroform-build-sha": headerValue(diagnostics.buildCommitSha),
    "x-baroform-environment": headerValue(
      diagnostics.deploymentEnvironment,
    ),
    "x-baroform-deployment-url": headerValue(diagnostics.deploymentUrl),
    "x-baroform-deployment-id": headerValue(diagnostics.deploymentId),
    "x-baroform-git-branch": headerValue(diagnostics.gitBranch),
    "x-baroform-app-version": headerValue(diagnostics.appVersion),
  };
}
