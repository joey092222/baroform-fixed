import { JsonResponseError } from "./lib/http/json-response";
import type { SurveyMode } from "./survey-mode";

export type SurveyGenerationFailureStage =
  | "initial-request"
  | "background-poll"
  | "response-apply";

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
      case "SURVEY_GENERATION_INCOMPLETE":
      case "SURVEY_GENERATION_OUTPUT_MISSING":
      case "SURVEY_GENERATION_OUTPUT_INVALID":
      case "OUTPUT_JSON_INVALID":
      case "OUTPUT_SCHEMA_INVALID":
        return "완전한 설문 응답을 받지 못해 적용하지 않았어요. 다시 시도해주세요.";
      case "SEMANTIC_VALIDATION_FAILED":
      case "REPAIR_FAILED":
      case "REPAIR_EXHAUSTED":
        return "설문 내용을 안전하게 다듬지 못했어요. 요청 ID와 함께 다시 문의해주세요.";
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
      error instanceof JsonResponseError ? error.requestId : clientRequestId,
    surveyMode,
    stage,
  };
}
