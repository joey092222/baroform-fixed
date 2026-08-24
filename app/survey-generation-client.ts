import {
  JsonResponseError,
  readJsonResponse,
} from "./lib/http/json-response";
import {
  isSurveyGenerationBackgroundStatus,
  isSurveyGenerationResponseType,
  isSurveyGenerationSurveyStatus,
  type SurveyGenerationResponse,
  type SurveyGenerationSource,
} from "./survey-generation-response";
import type { SurveyMode } from "./survey-mode";

export type SurveyGenerationFailureStage =
  | "initial-request"
  | "background-poll"
  | "response-apply";

type SurveyGenerationPayloadMetadata = {
  requestId: string | null;
  code: string | null;
  stage: string | null;
  generationSource: SurveyGenerationSource | null;
  fallbackReason: string | null;
  responseType: string | null;
  responseStatus: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function responseMetadata(
  payload: Record<string, unknown>,
  response: Response,
): SurveyGenerationPayloadMetadata {
  return {
    requestId:
      stringOrNull(payload.requestId) ??
      stringOrNull(response.headers.get("x-baroform-request-id")),
    code: stringOrNull(payload.code),
    stage: stringOrNull(payload.stage),
    generationSource: (stringOrNull(payload.generationSource) ??
      stringOrNull(
        response.headers.get("x-baroform-generation-source"),
      )) as SurveyGenerationSource | null,
    fallbackReason:
      stringOrNull(payload.fallbackReason) ??
      stringOrNull(response.headers.get("x-baroform-ai-fallback")),
    responseType: stringOrNull(payload.type),
    responseStatus: stringOrNull(payload.status),
  };
}

function contractError(
  message: string,
  code: string,
  response: Response,
  metadata: SurveyGenerationPayloadMetadata,
) {
  return new JsonResponseError(message, {
    code,
    status: response.status,
    requestId: metadata.requestId,
    stage: metadata.stage ?? "client-response-validation",
    generationSource: metadata.generationSource,
    fallbackReason: metadata.fallbackReason,
    responseType: metadata.responseType,
    responseStatus: metadata.responseStatus,
  });
}

export async function readSurveyGenerationResponse<
  TSurvey extends object,
  TClarification extends object,
  TBackground extends object,
>(
  response: Response,
  fallbackMessage = "AI 초안을 만들지 못했어요. 잠시 후 다시 시도해주세요.",
): Promise<SurveyGenerationResponse<TSurvey, TClarification, TBackground>> {
  const payload = await readJsonResponse<Record<string, unknown>>(
    response,
    fallbackMessage,
  );
  if (!isRecord(payload)) {
    throw new JsonResponseError(
      "설문 생성 응답 형식을 확인하지 못했어요.",
      {
        code: "CLIENT_RESPONSE_CONTRACT_INVALID",
        status: response.status,
        requestId: response.headers.get("x-baroform-request-id"),
        stage: "client-response-validation",
      },
    );
  }

  const metadata = responseMetadata(payload, response);
  if (!isSurveyGenerationResponseType(payload.type)) {
    throw contractError(
      "설문 생성 응답 종류를 확인하지 못했어요.",
      "CLIENT_RESPONSE_CONTRACT_INVALID",
      response,
      metadata,
    );
  }

  if (payload.type === "error") {
    throw contractError(
      stringOrNull(payload.error) ?? fallbackMessage,
      metadata.code ?? "SERVER_REQUEST_FAILED",
      response,
      metadata,
    );
  }

  if (
    payload.type === "survey" &&
    !isSurveyGenerationSurveyStatus(payload.status)
  ) {
    throw contractError(
      `설문 생성 상태를 확인하지 못했어요: ${String(payload.status)}`,
      "INVALID_SURVEY_STATUS",
      response,
      metadata,
    );
  }

  if (
    payload.type === "clarification" &&
    payload.status !== "needs_clarification"
  ) {
    throw contractError(
      `확인 질문 상태를 확인하지 못했어요: ${String(payload.status)}`,
      "INVALID_SURVEY_STATUS",
      response,
      metadata,
    );
  }

  if (
    payload.type === "background" &&
    !isSurveyGenerationBackgroundStatus(payload.status)
  ) {
    throw contractError(
      `백그라운드 생성 상태를 확인하지 못했어요: ${String(payload.status)}`,
      "INVALID_SURVEY_STATUS",
      response,
      metadata,
    );
  }

  return {
    ...payload,
    requestId: metadata.requestId,
    ok: true,
    code: metadata.code,
    stage: metadata.stage,
    generationSource: metadata.generationSource,
    fallbackReason: metadata.fallbackReason,
  } as SurveyGenerationResponse<TSurvey, TClarification, TBackground>;
}

export function surveyGenerationErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "설문 생성을 취소했어요.";
  }
  if (error instanceof JsonResponseError) {
    switch (error.code) {
      case "INVALID_REQUEST":
      case "INVALID_REQUEST_PAYLOAD":
      case "INVALID_SURVEY_MODE":
      case "INVALID_PROMPT":
      case "INVALID_REFERENCES":
        return "입력 내용을 확인하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해주세요.";
      case "RATE_LIMITED":
        return "짧은 시간에 설문을 여러 번 만들었어요. 잠시 후 다시 시도해주세요.";
      case "SURVEY_GENERATION_CANCELLED":
      case "CLIENT_CANCELLED":
        return "설문 생성을 취소했어요.";
      case "SURVEY_GENERATION_OPENAI_TIMEOUT":
      case "SURVEY_GENERATION_DEADLINE":
      case "MODEL_TIMEOUT":
      case "GENERATION_TIMEOUT":
        return "설문 생성이 예상보다 오래 걸렸어요. 다시 시도해주세요.";
      case "SURVEY_GENERATION_BACKGROUND_FAILED":
        return "정밀·연구 설문 생성에 실패했어요. 다시 시도해주세요.";
      case "SURVEY_GENERATION_CONNECTION_ERROR":
      case "MODEL_REQUEST_FAILED":
      case "SERVER_RESPONSE_EMPTY":
      case "SERVER_RESPONSE_INVALID":
        return "서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.";
      case "SURVEY_GENERATION_RETRY_EXHAUSTED":
        return "AI가 두 번 시도했지만 품질 기준을 통과하는 설문을 만들지 못했어요. 표현을 조금 바꿔 다시 시도해주세요.";
      case "SURVEY_GENERATION_INCOMPLETE":
      case "SURVEY_GENERATION_OUTPUT_MISSING":
      case "SURVEY_GENERATION_OUTPUT_INVALID":
      case "OUTPUT_JSON_INVALID":
      case "OUTPUT_SCHEMA_INVALID":
        return "완전한 설문 응답을 받지 못해 적용하지 않았어요. 다시 시도해주세요.";
      case "SEMANTIC_VALIDATION_FAILED":
      case "REPAIR_FAILED":
      case "REPAIR_EXHAUSTED": {
        const requestId = error.requestId ?? "확인 불가";
        const debug =
          process.env.NODE_ENV === "production"
            ? ""
            : ` · 코드 ${error.code} · 단계 ${error.stage ?? "unknown"}`;
        return `설문 내용을 안전하게 다듬지 못했어요. 요청 ID: ${requestId}${debug}`;
      }
      default:
        return "설문을 만드는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
    }
  }
  if (error instanceof TypeError) {
    return "서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.";
  }
  return "설문을 만드는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

export function surveyGenerationErrorMetadata(
  error: unknown,
  surveyMode: SurveyMode,
  stage: SurveyGenerationFailureStage,
  clientRequestId: string,
) {
  return {
    status: error instanceof JsonResponseError ? error.status : null,
    errorCode:
      error instanceof JsonResponseError
        ? error.code
        : error instanceof TypeError
          ? "NETWORK_ERROR"
          : "UNKNOWN_ERROR",
    requestId:
      error instanceof JsonResponseError ? error.requestId : null,
    clientRequestId,
    responseType:
      error instanceof JsonResponseError ? error.responseType : null,
    responseStatus:
      error instanceof JsonResponseError ? error.responseStatus : null,
    generationSource:
      error instanceof JsonResponseError ? error.generationSource : null,
    fallbackReason:
      error instanceof JsonResponseError ? error.fallbackReason : null,
    surveyMode,
    stage: error instanceof JsonResponseError ? error.stage ?? stage : stage,
  };
}
