export const MAX_REPAIR_ATTEMPTS = 1;
export const MAX_REGENERATION_ATTEMPTS = 0;
export const MAX_MODEL_CALLS_PER_REQUEST = 1;

export type SurveyGenerationStage =
  | "request-received"
  | "input-parsing"
  | "request-schema-validation"
  | "input-preprocessing"
  | "intent-extraction"
  | "intent-analysis"
  | "survey-planning"
  | "question-generation"
  | "model-request"
  | "model-response"
  | "output-parsing"
  | "output-schema-validation"
  | "question-normalization"
  | "semantic-validation"
  | "local-repair"
  | "repair-validation"
  | "fallback-started"
  | "fallback-completed"
  | "persist-started"
  | "persist-completed"
  | "response-ready"
  | "response-sent"
  | "background-poll"
  | "failed";

export type SurveyGenerationTrace = {
  requestId: string;
  startedAt: number;
  stage: SurveyGenerationStage;
  elapsedMs: number;
  modelCallCount: number;
  validationCount: number;
  repairCount: number;
  regenerationCount: number;
  errorCode: string | null;
  errorName: string | null;
  errorMessage: string | null;
  failureStage: SurveyGenerationStage | null;
  stageHistory: Array<{ stage: SurveyGenerationStage; elapsedMs: number }>;
  extractedTopic: string | null;
  extractedVariables: string[];
  extractedRelations: string[];
  fallbackUsed: boolean;
  fallbackReason: string | null;
};

export function createSurveyGenerationTrace(
  requestId: string,
): SurveyGenerationTrace {
  return {
    requestId,
    startedAt: Date.now(),
    stage: "request-received",
    elapsedMs: 0,
    modelCallCount: 0,
    validationCount: 0,
    repairCount: 0,
    regenerationCount: 0,
    errorCode: null,
    errorName: null,
    errorMessage: null,
    failureStage: null,
    stageHistory: [{ stage: "request-received", elapsedMs: 0 }],
    extractedTopic: null,
    extractedVariables: [],
    extractedRelations: [],
    fallbackUsed: false,
    fallbackReason: null,
  };
}

export function recordSurveyIntentTrace(
  trace: SurveyGenerationTrace | undefined,
  details: {
    topic: string | null;
    variables: string[];
    relations: string[];
  },
) {
  if (!trace || process.env.NODE_ENV === "production") return;
  trace.extractedTopic = details.topic?.slice(0, 120) ?? null;
  trace.extractedVariables = details.variables.slice(0, 20).map((item) => item.slice(0, 120));
  trace.extractedRelations = details.relations.slice(0, 20).map((item) => item.slice(0, 160));
}

export function recordSurveyFallback(
  trace: SurveyGenerationTrace | undefined,
  reason: string,
) {
  if (!trace) return;
  trace.fallbackUsed = true;
  trace.fallbackReason = reason.slice(0, 120);
}

export function markSurveyGenerationStage(
  trace: SurveyGenerationTrace | undefined,
  stage: SurveyGenerationStage,
) {
  if (!trace) return;
  trace.stage = stage;
  trace.elapsedMs = Math.max(0, Date.now() - trace.startedAt);
  if (trace.stageHistory.at(-1)?.stage !== stage) {
    trace.stageHistory.push({ stage, elapsedMs: trace.elapsedMs });
  }
}

export function recordSurveyModelCall(trace: SurveyGenerationTrace | undefined) {
  if (!trace) return;
  if (trace.modelCallCount >= MAX_MODEL_CALLS_PER_REQUEST) {
    throw new Error("설문 생성 모델 호출 상한을 초과했습니다.");
  }
  trace.modelCallCount += 1;
  markSurveyGenerationStage(trace, "model-request");
}

export function recordSurveyValidation(
  trace: SurveyGenerationTrace | undefined,
  stage: "output-schema-validation" | "semantic-validation" | "repair-validation",
) {
  if (!trace) return;
  trace.validationCount += 1;
  markSurveyGenerationStage(trace, stage);
}

export function recordSurveyRepair(trace: SurveyGenerationTrace | undefined) {
  if (!trace) return;
  if (trace.repairCount >= MAX_REPAIR_ATTEMPTS) {
    throw new Error("설문 의미 복구 상한을 초과했습니다.");
  }
  trace.repairCount += 1;
  markSurveyGenerationStage(trace, "local-repair");
}

export function failSurveyGenerationTrace(
  trace: SurveyGenerationTrace,
  code: string,
  error: unknown,
) {
  trace.failureStage = trace.stage === "failed" ? trace.failureStage : trace.stage;
  trace.errorCode = code;
  trace.errorName = error instanceof Error ? error.name : "UnknownError";
  trace.errorMessage = error instanceof Error ? error.message.slice(0, 240) : null;
  markSurveyGenerationStage(trace, "failed");
}

export function surveyGenerationTraceSnapshot(trace: SurveyGenerationTrace) {
  trace.elapsedMs = Math.max(0, Date.now() - trace.startedAt);
  return {
    requestId: trace.requestId,
    stage: trace.stage,
    elapsedMs: trace.elapsedMs,
    modelCallCount: trace.modelCallCount,
    validationCount: trace.validationCount,
    repairCount: trace.repairCount,
    regenerationCount: trace.regenerationCount,
    errorCode: trace.errorCode,
    errorName: trace.errorName,
    errorMessage: trace.errorMessage,
    failureStage: trace.failureStage,
    stageHistory: [...trace.stageHistory],
    extractedTopic: trace.extractedTopic,
    extractedVariables: [...trace.extractedVariables],
    extractedRelations: [...trace.extractedRelations],
    fallbackUsed: trace.fallbackUsed,
    fallbackReason: trace.fallbackReason,
  };
}
