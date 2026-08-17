export const MAX_REPAIR_ATTEMPTS = 1;
export const MAX_FULL_REGENERATION_ATTEMPTS = 0;
export const MAX_REGENERATION_ATTEMPTS = MAX_FULL_REGENERATION_ATTEMPTS;
export const MAX_MODEL_CALLS_PER_REQUEST = 1;

export type GenerationSource =
  | "openai"
  | "openai_partial_repair"
  | "initial_local_blueprint"
  | "openai_failure_fallback"
  | "parse_failure_fallback"
  | "semantic_repair_fallback"
  | "quality_repair_fallback"
  | "fast_draft_fallback"
  | "resilient_fallback"
  | "composite_plan_fallback"
  | "intent_clarification";

export type GenerationDiagnostics = {
  requestId: string;
  generationSource: GenerationSource | null;
  fallbackReason: string | null;
  modelCallCount: number;
  repairCount: number;
  fallbackCount: number;
  originalQuestionCount: number | null;
  repairedQuestionIds: string[];
  preservedQuestionIds: string[];
  intentMode: "single" | "composite" | null;
  purposeKinds: string[];
  purposeBlockCount: number;
  totalElapsedMs: number;
};

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
  detectedIntentKind: string | null;
  intentMode: "single" | "composite" | null;
  purposeKinds: string[];
  purposeBlockCount: number;
  generatedPlanBlocks: string[];
  originalQuestions: string[];
  semanticViolationCodes: string[];
  semanticViolationQuestionIds: string[];
  violationOrigins: string[];
  repairedQuestions: string[];
  secondValidationIssues: string[];
  generationSource: GenerationSource | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  fallbackCount: number;
  originalQuestionCount: number | null;
  repairedQuestionIds: string[];
  preservedQuestionIds: string[];
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
    detectedIntentKind: null,
    intentMode: null,
    purposeKinds: [],
    purposeBlockCount: 0,
    generatedPlanBlocks: [],
    originalQuestions: [],
    semanticViolationCodes: [],
    semanticViolationQuestionIds: [],
    violationOrigins: [],
    repairedQuestions: [],
    secondValidationIssues: [],
    generationSource: null,
    fallbackUsed: false,
    fallbackReason: null,
    fallbackCount: 0,
    originalQuestionCount: null,
    repairedQuestionIds: [],
    preservedQuestionIds: [],
  };
}

export function recordSurveyGenerationSource(
  trace: SurveyGenerationTrace | undefined,
  source: GenerationSource,
) {
  if (!trace) return;
  trace.generationSource = source;
}

export function recordSurveyQuestionOutcome(
  trace: SurveyGenerationTrace | undefined,
  details: {
    originalQuestionCount: number;
    repairedQuestionIds?: Array<string | number>;
    preservedQuestionIds?: Array<string | number>;
  },
) {
  if (!trace) return;
  trace.originalQuestionCount = details.originalQuestionCount;
  trace.repairedQuestionIds = (details.repairedQuestionIds ?? []).map(String);
  trace.preservedQuestionIds = (details.preservedQuestionIds ?? []).map(String);
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

export function recordSurveyPlanTrace(
  trace: SurveyGenerationTrace | undefined,
  details: {
    intentKind: string;
    intentMode?: "single" | "composite";
    purposeKinds?: string[];
    purposeBlockCount?: number;
    blocks: string[];
  },
) {
  if (!trace) return;
  trace.detectedIntentKind = details.intentKind.slice(0, 80);
  trace.intentMode = details.intentMode ?? null;
  trace.purposeKinds = (details.purposeKinds ?? []).slice(0, 12);
  trace.purposeBlockCount = details.purposeBlockCount ?? 0;
  trace.generatedPlanBlocks = details.blocks.slice(0, 40).map((item) => item.slice(0, 240));
}

export function recordSurveySemanticDiagnostics(
  trace: SurveyGenerationTrace | undefined,
  details: {
    originalQuestions?: string[];
    violationCodes?: string[];
    violationQuestionIds?: Array<string | number>;
    violationOrigins?: string[];
    repairedQuestions?: string[];
    secondValidationIssues?: string[];
  },
) {
  if (!trace || process.env.NODE_ENV === "production") return;
  if (details.originalQuestions) {
    trace.originalQuestions = details.originalQuestions.slice(0, 30).map((item) => item.slice(0, 240));
  }
  if (details.violationCodes) trace.semanticViolationCodes = [...details.violationCodes];
  if (details.violationQuestionIds) {
    trace.semanticViolationQuestionIds = details.violationQuestionIds.map(String);
  }
  if (details.violationOrigins) trace.violationOrigins = [...details.violationOrigins];
  if (details.repairedQuestions) {
    trace.repairedQuestions = details.repairedQuestions.slice(0, 30).map((item) => item.slice(0, 240));
  }
  if (details.secondValidationIssues) {
    trace.secondValidationIssues = details.secondValidationIssues.slice(0, 30).map((item) => item.slice(0, 240));
  }
}

export function recordSurveyFallback(
  trace: SurveyGenerationTrace | undefined,
  reason: string,
  source?: GenerationSource,
) {
  if (!trace) return;
  trace.fallbackUsed = true;
  trace.fallbackReason = reason.slice(0, 120);
  trace.fallbackCount += 1;
  if (source) trace.generationSource = source;
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

export function recordSurveyRepair(
  trace: SurveyGenerationTrace | undefined,
  repairedQuestionIds: Array<string | number> = [],
  preservedQuestionIds: Array<string | number> = [],
) {
  if (!trace) return;
  if (trace.repairCount >= MAX_REPAIR_ATTEMPTS) {
    throw new Error("설문 의미 복구 상한을 초과했습니다.");
  }
  trace.repairCount += 1;
  trace.repairedQuestionIds = repairedQuestionIds.map(String);
  trace.preservedQuestionIds = preservedQuestionIds.map(String);
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
    detectedIntentKind: trace.detectedIntentKind,
    intentMode: trace.intentMode,
    purposeKinds: [...trace.purposeKinds],
    purposeBlockCount: trace.purposeBlockCount,
    generatedPlanBlocks: [...trace.generatedPlanBlocks],
    originalQuestions: [...trace.originalQuestions],
    semanticViolationCodes: [...trace.semanticViolationCodes],
    semanticViolationQuestionIds: [...trace.semanticViolationQuestionIds],
    violationOrigins: [...trace.violationOrigins],
    repairedQuestions: [...trace.repairedQuestions],
    secondValidationIssues: [...trace.secondValidationIssues],
    generationSource: trace.generationSource,
    fallbackUsed: trace.fallbackUsed,
    fallbackReason: trace.fallbackReason,
    fallbackCount: trace.fallbackCount,
    originalQuestionCount: trace.originalQuestionCount,
    repairedQuestionIds: [...trace.repairedQuestionIds],
    preservedQuestionIds: [...trace.preservedQuestionIds],
    totalElapsedMs: trace.elapsedMs,
  };
}
