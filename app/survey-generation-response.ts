export const surveyGenerationResponseTypes = [
  "survey",
  "clarification",
  "background",
  "error",
] as const;

export type SurveyGenerationResponseType =
  (typeof surveyGenerationResponseTypes)[number];

export const surveyGenerationSurveyStatuses = [
  "ready",
  "ready_with_caution",
] as const;

export type SurveyGenerationSurveyStatus =
  (typeof surveyGenerationSurveyStatuses)[number];

export const surveyGenerationBackgroundStatuses = [
  "queued",
  "in_progress",
  "cancelled",
  "completed",
] as const;

export type SurveyGenerationBackgroundStatus =
  (typeof surveyGenerationBackgroundStatuses)[number];

export type SurveyGenerationStatus =
  | SurveyGenerationSurveyStatus
  | "needs_clarification"
  | SurveyGenerationBackgroundStatus
  | "error";

export type SurveyGenerationSource =
  | "openai"
  | "openai_partial_repair"
  | "initial_local_blueprint"
  | "openai_request_failure_fallback"
  | "openai_parse_failure_fallback"
  | "openai_output_parse_failure_fallback"
  | "openai_output_schema_rejection_fallback"
  | "openai_plan_validation_fallback"
  | "openai_question_validation_fallback"
  | "parse_failure_fallback"
  | "semantic_validation_fallback"
  | "quality_validation_fallback"
  | "composite_plan_fallback"
  | "fast_draft_fallback"
  | "resilient_fallback"
  | "clarification"
  // Legacy source labels remain accepted while old cached entries expire.
  | "openai_failure_fallback"
  | "semantic_repair_fallback"
  | "quality_repair_fallback"
  | "intent_clarification";

export type SurveyGenerationResponseBase<
  TType extends SurveyGenerationResponseType,
  TStatus extends SurveyGenerationStatus,
  TOk extends boolean,
> = {
  requestId: string | null;
  type: TType;
  ok: TOk;
  status: TStatus;
  code: string | null;
  stage: string | null;
  generationSource: SurveyGenerationSource | null;
  fallbackReason: string | null;
};

export type SurveyGenerationResponseMetadata = SurveyGenerationResponseBase<
  SurveyGenerationResponseType,
  SurveyGenerationStatus,
  boolean
>;

export type SurveyGenerationResponse<
  TSurvey extends object = Record<string, unknown>,
  TClarification extends object = Record<string, unknown>,
  TBackground extends object = Record<string, unknown>,
> =
  | (SurveyGenerationResponseBase<
      "survey",
      SurveyGenerationSurveyStatus,
      true
    > &
      TSurvey)
  | (SurveyGenerationResponseBase<
      "clarification",
      "needs_clarification",
      true
    > &
      TClarification)
  | (SurveyGenerationResponseBase<
      "background",
      SurveyGenerationBackgroundStatus,
      true
    > &
      TBackground)
  | (SurveyGenerationResponseBase<"error", "error", false> & {
      error: string;
    });

export function isSurveyGenerationResponseType(
  value: unknown,
): value is SurveyGenerationResponseType {
  return (
    typeof value === "string" &&
    surveyGenerationResponseTypes.includes(
      value as SurveyGenerationResponseType,
    )
  );
}

export function isSurveyGenerationSurveyStatus(
  value: unknown,
): value is SurveyGenerationSurveyStatus {
  return (
    typeof value === "string" &&
    surveyGenerationSurveyStatuses.includes(
      value as SurveyGenerationSurveyStatus,
    )
  );
}

export function isSurveyGenerationBackgroundStatus(
  value: unknown,
): value is SurveyGenerationBackgroundStatus {
  return (
    typeof value === "string" &&
    surveyGenerationBackgroundStatuses.includes(
      value as SurveyGenerationBackgroundStatus,
    )
  );
}
