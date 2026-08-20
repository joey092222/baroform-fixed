import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, dirname, extname, resolve } from "node:path";

export type PreviewTransportFailureKind =
  | "environment_transport_failure"
  | "environment_auth_failure";

export class PreviewTransportError extends Error {
  readonly kind: PreviewTransportFailureKind;
  readonly safeCode: string;
  readonly retryable: boolean;
  readonly exitCode: number | null;

  constructor(options: {
    kind: PreviewTransportFailureKind;
    safeCode: string;
    retryable: boolean;
    exitCode?: number | null;
  }) {
    super(options.safeCode);
    this.name = "PreviewTransportError";
    this.kind = options.kind;
    this.safeCode = options.safeCode;
    this.retryable = options.retryable;
    this.exitCode = options.exitCode ?? null;
  }
}

const safeChildEnvironmentKeys = [
  "APPDATA",
  "COMSPEC",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "NO_COLOR",
  "PATHEXT",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "USERPROFILE",
] as const;

function sourceEnvironmentValue(
  source: Readonly<Record<string, string | undefined>>,
  key: string,
) {
  const match = Object.keys(source).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase(),
  );
  return match ? source[match] : undefined;
}

function pathSegments(value: string | undefined) {
  return (value ?? "")
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildSafeChildProcessEnv(options: {
  source?: Readonly<Record<string, string | undefined>>;
  nodeExecutable?: string;
  platform?: NodeJS.Platform;
}) {
  const source = options.source ?? process.env;
  const nodeExecutable = options.nodeExecutable ?? process.execPath;
  const platform = options.platform ?? process.platform;
  const safe: Record<string, string | undefined> = {};
  for (const key of safeChildEnvironmentKeys) {
    const value = sourceEnvironmentValue(source, key);
    if (value) safe[key] = value;
  }
  const sourcePath = sourceEnvironmentValue(source, "PATH");
  const nodeDirectory = dirname(nodeExecutable);
  const seen = new Set<string>();
  const mergedPath = [nodeDirectory, ...pathSegments(sourcePath)].filter((item) => {
    const comparable = platform === "win32" ? item.toLowerCase() : item;
    if (seen.has(comparable)) return false;
    seen.add(comparable);
    return true;
  });
  safe[platform === "win32" ? "Path" : "PATH"] = mergedPath.join(delimiter);
  return safe as NodeJS.ProcessEnv;
}

export function resolvePnpmNodeInvocation(options: {
  pnpmLauncherPath: string;
  arguments: string[];
  nodeExecutable?: string;
  platform?: NodeJS.Platform;
  sourceEnv?: Readonly<Record<string, string | undefined>>;
}) {
  const platform = options.platform ?? process.platform;
  const nodeExecutable = options.nodeExecutable ?? process.execPath;
  const extension = extname(options.pnpmLauncherPath).toLowerCase();
  const pnpmScript =
    extension === ".cmd" || extension === ".ps1"
      ? resolve(
          dirname(options.pnpmLauncherPath),
          "../../node/node_modules/pnpm/bin/pnpm.mjs",
        )
      : options.pnpmLauncherPath;
  return {
    executable: nodeExecutable,
    arguments: [pnpmScript, ...options.arguments],
    pnpmScript,
    env: buildSafeChildProcessEnv({
      source: options.sourceEnv,
      nodeExecutable,
      platform,
    }),
  };
}

export type PreviewTransportPreflight = {
  nodeExecutableResolved: boolean;
  vercelCliExecutableResolved: boolean;
  childPathConfigured: boolean;
  authConfigAccessible: boolean;
  redactionApplied: boolean;
  platform: NodeJS.Platform;
  exitCode: number | null;
  sanitizedTransportCode: string;
};

function preflightFailure(code: string) {
  return new PreviewTransportError({
    kind: "environment_transport_failure",
    safeCode: code,
    retryable: false,
  });
}

async function pathIsAccessible(path: string) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function runPreviewTransportPreflight(options: {
  pnpmLauncherPath: string;
  cwd: string;
  nodeExecutable?: string;
  sourceEnv?: Readonly<Record<string, string | undefined>>;
  globalConfigDirectory?: string | null;
  timeoutMs?: number;
}) {
  const invocation = resolvePnpmNodeInvocation({
    pnpmLauncherPath: options.pnpmLauncherPath,
    arguments: ["dlx", "vercel@59.1.3", "--version"],
    nodeExecutable: options.nodeExecutable,
    sourceEnv: options.sourceEnv,
  });
  const nodeExecutableResolved = await pathIsAccessible(invocation.executable);
  if (!nodeExecutableResolved) {
    throw preflightFailure("RUNNER_NODE_EXECUTABLE_UNAVAILABLE");
  }
  const vercelCliExecutableResolved = await pathIsAccessible(
    invocation.pnpmScript,
  );
  if (!vercelCliExecutableResolved) {
    throw preflightFailure("RUNNER_VERCEL_CLI_UNAVAILABLE");
  }
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const childPathConfigured = Boolean(invocation.env[pathKey]);
  if (!childPathConfigured) {
    throw preflightFailure("RUNNER_PATH_NOT_PROPAGATED");
  }
  const sourceEnv = options.sourceEnv ?? process.env;
  const configDirectory =
    options.globalConfigDirectory ??
    sourceEnvironmentValue(
      sourceEnv,
      process.platform === "win32" ? "APPDATA" : "HOME",
    ) ??
    null;
  const authConfigAccessible = configDirectory
    ? await pathIsAccessible(configDirectory)
    : false;
  if (!authConfigAccessible) {
    throw preflightFailure("RUNNER_AUTH_CONFIG_UNAVAILABLE");
  }
  const timeoutMs = options.timeoutMs ?? 30_000;
  const processResult = await new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>((resolveResult, reject) => {
    const child = spawn(invocation.executable, invocation.arguments, {
      cwd: options.cwd,
      env: invocation.env,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(preflightFailure("RUNNER_VERCEL_CLI_UNAVAILABLE"));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (stdout.length < 4_096) stdout += chunk.slice(0, 4_096 - stdout.length);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < 4_096) stderr += chunk.slice(0, 4_096 - stderr.length);
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(preflightFailure("RUNNER_CHILD_PROCESS_START_FAILED"));
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolveResult({ exitCode, stdout, stderr });
    });
  });
  const redactedOutput = redactPreviewTransportData(
    `${processResult.stdout}\n${processResult.stderr}`,
  );
  const redactionApplied =
    redactPreviewTransportData("https://preview.invalid/?token=synthetic-preflight-value") !==
    "https://preview.invalid/?token=synthetic-preflight-value";
  if (processResult.exitCode !== 0 || !/Vercel CLI/iu.test(redactedOutput)) {
    const code = /(?:not recognized|not found|enoent)/iu.test(redactedOutput)
      ? "RUNNER_PATH_NOT_PROPAGATED"
      : "RUNNER_VERCEL_CLI_UNAVAILABLE";
    throw preflightFailure(code);
  }
  return {
    nodeExecutableResolved,
    vercelCliExecutableResolved,
    childPathConfigured,
    authConfigAccessible,
    redactionApplied,
    platform: process.platform,
    exitCode: processResult.exitCode,
    sanitizedTransportCode: "RUNNER_PREFLIGHT_OK",
  } satisfies PreviewTransportPreflight;
}

const transportSecretPatterns: Array<[RegExp, string]> = [
  [
    /([?&](?:_vercel_share|x-vercel-protection-bypass|token|secret|signature)=)[^&#\s"']+/giu,
    "$1[REDACTED]",
  ],
  [
    /((?:authorization|cookie|x-vercel-protection-bypass)\s*[:=]\s*)(?:Bearer\s+)?[^\s,;}"']+/giu,
    "$1[REDACTED]",
  ],
  [
    /((?:token|secret|bypass|protection|signature)\s*[:=]\s*)[^\s,;}"']+/giu,
    "$1[REDACTED]",
  ],
  [/(?:sk-[A-Za-z0-9_-]{16,})/gu, "[REDACTED]"],
  [
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/gu,
    "[REDACTED]",
  ],
];

export function redactPreviewTransportData(value: string) {
  return transportSecretPatterns.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value,
  );
}

function responseEnvelope(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("HTTP/")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as { response?: unknown };
    return typeof parsed.response === "string" ? parsed.response : null;
  } catch {
    const marker = trimmed.lastIndexOf('{"response"');
    if (marker < 0) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(marker)) as {
        response?: unknown;
      };
      return typeof parsed.response === "string" ? parsed.response : null;
    } catch {
      return null;
    }
  }
}

export function hasParseableVercelHttpResponse(raw: string) {
  const wire = responseEnvelope(raw);
  if (!wire) return false;
  const statusStart = wire.lastIndexOf("HTTP/");
  if (statusStart < 0) return false;
  const headerEnd = Math.max(
    wire.indexOf("\r\n\r\n", statusStart),
    wire.indexOf("\n\n", statusStart),
  );
  return headerEnd >= 0 && /HTTP\/\d(?:\.\d)?\s+\d{3}/u.test(wire.slice(statusStart));
}

function safeFailureCode(stderr: string, exitCode: number | null) {
  if (/(?:unauthori[sz]ed|forbidden|authentication|not\s+logged\s+in|invalid\s+token|scope)/iu.test(stderr)) {
    return {
      kind: "environment_auth_failure" as const,
      code: "VERCEL_CURL_AUTH_FAILURE",
      retryable: false,
    };
  }
  if (/(?:timed?\s*out|timeout|etimedout)/iu.test(stderr)) {
    return {
      kind: "environment_transport_failure" as const,
      code: "VERCEL_CURL_TIMEOUT",
      retryable: true,
    };
  }
  if (/(?:connection|econn|network|socket|dns|fetch\s+failed)/iu.test(stderr)) {
    return {
      kind: "environment_transport_failure" as const,
      code: "VERCEL_CURL_CONNECTION_FAILURE",
      retryable: true,
    };
  }
  return {
    kind: "environment_transport_failure" as const,
    code: `VERCEL_CURL_EXIT_${exitCode ?? "UNKNOWN"}`,
    retryable: true,
  };
}

export function resolveVercelCurlProcessResult(options: {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}) {
  if (hasParseableVercelHttpResponse(options.stdout)) {
    return options.stdout;
  }
  const failure = safeFailureCode(options.stderr, options.exitCode);
  throw new PreviewTransportError({
    kind: failure.kind,
    safeCode:
      options.exitCode === 0
        ? "VERCEL_CURL_RESPONSE_MISSING"
        : failure.code,
    retryable: options.exitCode === 0 ? false : failure.retryable,
    exitCode: options.exitCode,
  });
}

export async function withPreviewTransportRetry<T>(
  operation: () => Promise<T>,
  options: { maximumRetries?: number; onRetry?: () => void } = {},
) {
  const maximumRetries = options.maximumRetries ?? 1;
  let retryCount = 0;
  for (;;) {
    try {
      return { value: await operation(), retryCount };
    } catch (error) {
      if (
        !(error instanceof PreviewTransportError) ||
        !error.retryable ||
        retryCount >= maximumRetries
      ) {
        throw error;
      }
      retryCount += 1;
      options.onRetry?.();
    }
  }
}
