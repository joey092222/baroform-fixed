/**
 * Every network call in the app goes through here.
 * The UI never calls fetch directly, so a UI rewrite cannot lose a request.
 */

export type RequestOptions = {
  authToken?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/** Thrown for any non-ok response so callers can branch on status (401 in particular). */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function authHeaders(authToken?: string): Record<string, string> {
  return authToken ? { authorization: `Bearer ${authToken}` } : {};
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
}

export async function getJson<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: options.signal,
    headers: { ...authHeaders(options.authToken), ...options.headers },
  });
  const result = await readJson<T>(response);
  if (!response.ok) {
    throw new ApiError(result.error ?? "요청을 처리하지 못했어요.", response.status);
  }
  return result as T;
}

export async function sendJson<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    method,
    signal: options.signal,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...authHeaders(options.authToken),
      ...options.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await readJson<T>(response);
  if (!response.ok) {
    throw new ApiError(result.error ?? "요청을 처리하지 못했어요.", response.status);
  }
  return result as T;
}
