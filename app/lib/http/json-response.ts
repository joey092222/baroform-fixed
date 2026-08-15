type ApiErrorPayload = {
  code?: unknown;
  error?: unknown;
  requestId?: unknown;
};

const koreanTextPattern = /[가-힣]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payloadErrorMessage(payload: unknown) {
  if (!isRecord(payload)) return null;
  const error = payload.error;
  if (typeof error === "string" && koreanTextPattern.test(error)) return error;
  if (
    isRecord(error) &&
    typeof error.message === "string" &&
    koreanTextPattern.test(error.message)
  ) {
    return error.message;
  }
  return null;
}

export class JsonResponseError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;

  constructor(
    message: string,
    options: { code: string; status: number; requestId?: string | null },
  ) {
    super(message);
    this.name = "JsonResponseError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId ?? null;
  }
}

export async function readJsonResponse<T>(
  response: Response,
  fallbackMessage = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
): Promise<T> {
  const raw = await response.text();
  const headerRequestId = response.headers.get("x-baroform-request-id");

  if (!raw.trim()) {
    throw new JsonResponseError(
      "서버 응답을 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
      {
        code: "SERVER_RESPONSE_EMPTY",
        status: response.status,
        requestId: headerRequestId,
      },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    throw new JsonResponseError(
      "생성된 설문을 불러오는 과정에서 문제가 발생했어요.",
      {
        code: "SERVER_RESPONSE_INVALID",
        status: response.status,
        requestId: headerRequestId,
      },
    );
  }

  const apiPayload = isRecord(payload) ? (payload as ApiErrorPayload) : null;
  const requestId =
    typeof apiPayload?.requestId === "string"
      ? apiPayload.requestId
      : headerRequestId;
  const code =
    typeof apiPayload?.code === "string" ? apiPayload.code : "SERVER_REQUEST_FAILED";

  if (!response.ok) {
    throw new JsonResponseError(payloadErrorMessage(payload) ?? fallbackMessage, {
      code,
      status: response.status,
      requestId,
    });
  }

  if (!isRecord(payload)) {
    throw new JsonResponseError(
      "생성된 설문을 불러오는 과정에서 문제가 발생했어요.",
      {
        code: "SERVER_RESPONSE_INVALID",
        status: response.status,
        requestId,
      },
    );
  }

  return payload as T;
}
