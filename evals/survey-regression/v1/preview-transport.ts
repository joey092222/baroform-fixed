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
