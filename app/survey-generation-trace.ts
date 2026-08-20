import type { ParsedSurveyContext } from "./survey-context";
import type { PlanCoverageResult } from "./survey-planning";
import type { SurveyGenerationSource } from "./survey-generation-response";
import {
  currentBuildDiagnostics,
  type BuildDiagnostics,
} from "./build-diagnostics";
import { isAiTraceEnabled, traceAiEvent } from "./lib/ai/ai-trace";

export const MAX_REPAIR_ATTEMPTS = 1;
export const MAX_FULL_REGENERATION_ATTEMPTS = 0;
export const MAX_REGENERATION_ATTEMPTS = MAX_FULL_REGENERATION_ATTEMPTS;
export const MAX_MODEL_CALLS_PER_REQUEST = 1;

export type GenerationSource = SurveyGenerationSource;

function canRecordDetailedGenerationTrace() {
  return isAiTraceEnabled();
}

function canonicalGenerationSource(
  source: GenerationSource,
): GenerationSource {
  switch (source) {
    case "intent_clarification":
      return "clarification";
    case "semantic_repair_fallback":
      return "semantic_validation_fallback";
    case "quality_repair_fallback":
      return "quality_validation_fallback";
    case "openai_failure_fallback":
      return "openai_request_failure_fallback";
    case "parse_failure_fallback":
      return "openai_parse_failure_fallback";
    default:
      return source;
  }
}

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
  questionsBeforeRepairHash: string | null;
  questionsAfterRepairHash: string | null;
  changedQuestionIds: string[];
  changedFieldsByQuestion: Record<string, string[]>;
  metadataOnlyNormalization: boolean;
  respondentFacingContentChanged: boolean;
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
  buildDiagnostics: BuildDiagnostics;
  httpMethod: string | null;
  contentType: string | null;
  surveyMode: string | null;
  requestedQuestionCount: number | null;
  targetGrade: string | null;
  attachmentCount: number;
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
  qualityViolationCodes: string[];
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
  questionsBeforeRepairHash: string | null;
  questionsAfterRepairHash: string | null;
  changedQuestionIds: string[];
  changedFieldsByQuestion: Record<string, string[]>;
  metadataOnlyNormalization: boolean;
  respondentFacingContentChanged: boolean;
  rawUserInput: string | null;
  normalizedInput: string | null;
  parsedSurveyContext: ParsedSurveyContext | null;
  extractedAudience: string | null;
  extractedEntities: string[];
  extractedActivities: string[];
  extractedResearchGoals: string[];
  extractedStudyPurposes: string[];
  canonicalSurveyArchetype: string | null;
  canonicalEntitySummaries: string[];
  canonicalActivitySummaries: string[];
  canonicalConstructSummaries: string[];
  canonicalPurposeSummaries: string[];
  canonicalRelationSummaries: string[];
  canonicalAmbiguityCode: string | null;
  canonicalAmbiguityReasons: string[];
  canonicalMissingRoles: string[];
  canonicalOperationalizationPlan: string[];
  selectedSurveyType: string | null;
  selectedTemplateKey: string | null;
  selectedBlueprint: string | null;
  rawModelResponsePresent: boolean;
  rawModelResponse: string | null;
  responseStatus: string | null;
  responseIncompleteReason: string | null;
  outputParsedPresent: boolean;
  outputItemTypes: string[];
  modelOutputTopLevelKeys: string[];
  modelReturnedQuestionCount: number | null;
  schemaIssuePaths: string[];
  schemaIssueCodes: string[];
  schemaExpectedTypes: string[];
  schemaReceivedTypes: string[];
  parseFailureStage: string | null;
  modelOutputRejectedAt: string | null;
  modelOutputRejectionCode: string | null;
  modelOutputRejectionIssues: string[];
  modelOutputRejectionIssuePaths: string[];
  postprocessErrorName: string | null;
  postprocessErrorCode: string | null;
  postprocessErrorStage: string | null;
  postprocessErrorLocation: string | null;
  postprocessIssueCodes: string[];
  postprocessIssuePaths: string[];
  postprocessIssueMessages: string[];
  firstInvalidQuestionId: string | null;
  repairAttempted: boolean;
  repairFailureCode: string | null;
  fallbackSelectedBecause: string | null;
  modelOutputHasTitle: boolean;
  modelOutputHasIntro: boolean;
  modelOutputHasSurveyPlan: boolean;
  modelQuestionTypes: string[];
  modelQuestionStructureIssues: string[];
  normalizedInternalMetadataPaths: string[];
  initialCoveredRequiredBlockIds: string[];
  initialMissingRequiredBlockIds: string[];
  finalCoveredRequiredBlockIds: string[];
  finalMissingRequiredBlockIds: string[];
  optionalPlanBlockIds: string[];
  initialIncompatibleQuestionIds: string[];
  finalIncompatibleQuestionIds: string[];
  initialSemanticDuplicateGroups: string[][];
  semanticDuplicateGroups: string[][];
  questionsBeforePostprocessCount: number;
  finalQuestionCount: number;
  questionsBeforePostprocess: string[];
  finalQuestions: string[];
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
    buildDiagnostics: currentBuildDiagnostics(),
    httpMethod: null,
    contentType: null,
    surveyMode: null,
    requestedQuestionCount: null,
    targetGrade: null,
    attachmentCount: 0,
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
    qualityViolationCodes: [],
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
    questionsBeforeRepairHash: null,
    questionsAfterRepairHash: null,
    changedQuestionIds: [],
    changedFieldsByQuestion: {},
    metadataOnlyNormalization: false,
    respondentFacingContentChanged: false,
    rawUserInput: null,
    normalizedInput: null,
    parsedSurveyContext: null,
    extractedAudience: null,
    extractedEntities: [],
    extractedActivities: [],
    extractedResearchGoals: [],
    extractedStudyPurposes: [],
    canonicalSurveyArchetype: null,
    canonicalEntitySummaries: [],
    canonicalActivitySummaries: [],
    canonicalConstructSummaries: [],
    canonicalPurposeSummaries: [],
    canonicalRelationSummaries: [],
    canonicalAmbiguityCode: null,
    canonicalAmbiguityReasons: [],
    canonicalMissingRoles: [],
    canonicalOperationalizationPlan: [],
    selectedSurveyType: null,
    selectedTemplateKey: null,
    selectedBlueprint: null,
    rawModelResponsePresent: false,
    rawModelResponse: null,
    responseStatus: null,
    responseIncompleteReason: null,
    outputParsedPresent: false,
    outputItemTypes: [],
    modelOutputTopLevelKeys: [],
    modelReturnedQuestionCount: null,
    schemaIssuePaths: [],
    schemaIssueCodes: [],
    schemaExpectedTypes: [],
    schemaReceivedTypes: [],
    parseFailureStage: null,
    modelOutputRejectedAt: null,
    modelOutputRejectionCode: null,
    modelOutputRejectionIssues: [],
    modelOutputRejectionIssuePaths: [],
    postprocessErrorName: null,
    postprocessErrorCode: null,
    postprocessErrorStage: null,
    postprocessErrorLocation: null,
    postprocessIssueCodes: [],
    postprocessIssuePaths: [],
    postprocessIssueMessages: [],
    firstInvalidQuestionId: null,
    repairAttempted: false,
    repairFailureCode: null,
    fallbackSelectedBecause: null,
    modelOutputHasTitle: false,
    modelOutputHasIntro: false,
    modelOutputHasSurveyPlan: false,
    modelQuestionTypes: [],
    modelQuestionStructureIssues: [],
    normalizedInternalMetadataPaths: [],
    initialCoveredRequiredBlockIds: [],
    initialMissingRequiredBlockIds: [],
    finalCoveredRequiredBlockIds: [],
    finalMissingRequiredBlockIds: [],
    optionalPlanBlockIds: [],
    initialIncompatibleQuestionIds: [],
    finalIncompatibleQuestionIds: [],
    initialSemanticDuplicateGroups: [],
    semanticDuplicateGroups: [],
    questionsBeforePostprocessCount: 0,
    finalQuestionCount: 0,
    questionsBeforePostprocess: [],
    finalQuestions: [],
  };
}

export function recordSurveyRequestTrace(
  trace: SurveyGenerationTrace | undefined,
  details: {
    httpMethod: string;
    contentType: string | null;
    surveyMode: string;
    questionCount: number;
    targetGrade: string;
    attachmentCount: number;
  },
) {
  if (!trace) return;
  trace.httpMethod = details.httpMethod.slice(0, 20);
  trace.contentType = details.contentType?.slice(0, 120) ?? null;
  trace.surveyMode = details.surveyMode.slice(0, 40);
  trace.requestedQuestionCount = details.questionCount;
  trace.targetGrade = details.targetGrade.slice(0, 80);
  trace.attachmentCount = details.attachmentCount;
}

export function recordSurveyContextTrace(
  trace: SurveyGenerationTrace | undefined,
  context: ParsedSurveyContext,
  selectedTemplateKey: string,
) {
  if (!trace) return;
  trace.selectedSurveyType = context.surveyArchetype;
  trace.selectedTemplateKey = selectedTemplateKey.slice(0, 120);
  if (!canRecordDetailedGenerationTrace()) return;
  trace.rawUserInput = context.rawUserInput.slice(0, 500);
  trace.normalizedInput = context.normalizedInput.slice(0, 500);
  trace.parsedSurveyContext = {
    ...context,
    rawUserInput: context.rawUserInput.slice(0, 500),
    normalizedInput: context.normalizedInput.slice(0, 500),
    researchConstructs: context.researchConstructs.slice(0, 20),
  };
  trace.extractedAudience = context.audience?.slice(0, 160) ?? null;
  trace.extractedEntities = [context.primaryEntity.slice(0, 200)];
  trace.extractedActivities = context.activity
    ? [context.activity.slice(0, 240)]
    : [];
  trace.extractedResearchGoals = [context.researchGoal.slice(0, 300)];
}

export function recordSurveyModelResponseTrace(
  trace: SurveyGenerationTrace | undefined,
  rawModelResponse: unknown,
) {
  if (!trace) return;
  trace.rawModelResponsePresent = rawModelResponse !== null && rawModelResponse !== undefined;
  if (rawModelResponse && typeof rawModelResponse === "object") {
    const payload = rawModelResponse as {
      status?: unknown;
      incomplete_details?: unknown;
      output_parsed?: unknown;
      output?: unknown;
    };
    trace.responseStatus =
      typeof payload.status === "string" ? payload.status.slice(0, 80) : null;
    const incompleteReason =
      payload.incomplete_details && typeof payload.incomplete_details === "object"
        ? (payload.incomplete_details as { reason?: unknown }).reason
        : null;
    trace.responseIncompleteReason =
      typeof incompleteReason === "string" ? incompleteReason.slice(0, 120) : null;
    trace.outputParsedPresent =
      payload.output_parsed !== null && payload.output_parsed !== undefined;
    if (payload.output_parsed && typeof payload.output_parsed === "object") {
      const parsed = payload.output_parsed as Record<string, unknown>;
      trace.modelOutputTopLevelKeys = Object.keys(parsed).slice(0, 30);
      const survey = parsed.survey;
      const result = parsed.result;
      const questions =
        survey && typeof survey === "object"
          ? (survey as { questions?: unknown }).questions
          : result && typeof result === "object"
            ? (result as { aiQuestions?: unknown }).aiQuestions
            : null;
      trace.modelReturnedQuestionCount = Array.isArray(questions)
        ? questions.length
        : null;
    }
    trace.outputItemTypes = Array.isArray(payload.output)
      ? payload.output
          .map((item) =>
            item && typeof item === "object"
              ? (item as { type?: unknown }).type
              : null,
          )
          .filter((value): value is string => typeof value === "string")
          .slice(0, 30)
      : [];
  }
  if (!canRecordDetailedGenerationTrace()) return;
  try {
    trace.rawModelResponse = JSON.stringify(rawModelResponse).slice(0, 8_000);
  } catch {
    trace.rawModelResponse = "[unserializable model response]";
  }
}

export function recordSurveySchemaDiagnostics(
  trace: SurveyGenerationTrace | undefined,
  details: {
    stage: string;
    issues?: Array<{
      path?: ReadonlyArray<PropertyKey>;
      code?: string;
      expected?: unknown;
      received?: unknown;
    }>;
  },
) {
  if (!trace) return;
  trace.parseFailureStage = details.stage.slice(0, 120);
  const issues = details.issues ?? [];
  trace.schemaIssuePaths = issues
    .slice(0, 12)
    .map((issue) => (issue.path ?? []).map(String).join(".").slice(0, 200));
  trace.schemaIssueCodes = issues
    .slice(0, 12)
    .map((issue) => String(issue.code ?? "unknown").slice(0, 80));
  trace.schemaExpectedTypes = issues
    .slice(0, 12)
    .map((issue) => String(issue.expected ?? "unknown").slice(0, 80));
  trace.schemaReceivedTypes = issues
    .slice(0, 12)
    .map((issue) => String(issue.received ?? "unknown").slice(0, 80));
}

export function recordSurveyModelOutputDiagnostics(
  trace: SurveyGenerationTrace | undefined,
  details: {
    hasTitle?: boolean;
    hasIntro?: boolean;
    hasSurveyPlan?: boolean;
    questionTypes?: string[];
    questionStructureIssues?: string[];
    normalizedInternalMetadataPaths?: string[];
  },
) {
  if (!trace) return;
  if (details.hasTitle !== undefined) trace.modelOutputHasTitle = details.hasTitle;
  if (details.hasIntro !== undefined) trace.modelOutputHasIntro = details.hasIntro;
  if (details.hasSurveyPlan !== undefined) {
    trace.modelOutputHasSurveyPlan = details.hasSurveyPlan;
  }
  if (details.questionTypes) {
    trace.modelQuestionTypes = details.questionTypes.slice(0, 30);
  }
  if (details.questionStructureIssues) {
    trace.modelQuestionStructureIssues = details.questionStructureIssues
      .slice(0, 30)
      .map((item) => item.slice(0, 200));
  }
  if (details.normalizedInternalMetadataPaths) {
    trace.normalizedInternalMetadataPaths = details.normalizedInternalMetadataPaths
      .slice(0, 60)
      .map((item) => item.slice(0, 200));
  }
}

export function recordSurveyModelOutputRejection(
  trace: SurveyGenerationTrace | undefined,
  details: {
    at: string;
    code: string;
    issues: string[];
    issuePaths?: string[];
  },
) {
  if (!trace) return;
  trace.modelOutputRejectedAt = details.at.slice(0, 120);
  trace.modelOutputRejectionCode = details.code.slice(0, 120);
  trace.modelOutputRejectionIssues = details.issues
    .slice(0, 20)
    .map((item) => item.slice(0, 240));
  trace.modelOutputRejectionIssuePaths = (details.issuePaths ?? [])
    .slice(0, 20)
    .map((item) => item.slice(0, 200));
}

export function recordSurveyPlanCoverageTrace(
  trace: SurveyGenerationTrace | undefined,
  details: { initial: PlanCoverageResult; final: PlanCoverageResult },
) {
  if (!trace) return;
  trace.initialCoveredRequiredBlockIds = [
    ...details.initial.coveredRequiredBlockIds,
  ];
  trace.initialMissingRequiredBlockIds = [
    ...details.initial.missingRequiredBlockIds,
  ];
  trace.finalCoveredRequiredBlockIds = [...details.final.coveredRequiredBlockIds];
  trace.finalMissingRequiredBlockIds = [...details.final.missingRequiredBlockIds];
  trace.optionalPlanBlockIds = [...details.final.optionalBlockIds];
  trace.initialIncompatibleQuestionIds = [
    ...details.initial.incompatibleQuestionIds,
  ];
  trace.finalIncompatibleQuestionIds = [
    ...details.final.incompatibleQuestionIds,
  ];
  trace.initialSemanticDuplicateGroups =
    details.initial.semanticDuplicateGroups.map((group) => [...group]);
  trace.semanticDuplicateGroups = details.final.semanticDuplicateGroups.map(
    (group) => [...group],
  );
}

export function recordSurveyPostprocessTrace(
  trace: SurveyGenerationTrace | undefined,
  details: { before?: string[]; final?: string[] },
) {
  if (!trace) return;
  if (details.before) {
    trace.questionsBeforePostprocessCount = details.before.length;
  }
  if (details.final) {
    trace.finalQuestionCount = details.final.length;
  }
  if (!canRecordDetailedGenerationTrace()) return;
  if (details.before) {
    trace.questionsBeforePostprocess = details.before
      .slice(0, 30)
      .map((item) => item.slice(0, 240));
  }
  if (details.final) {
    trace.finalQuestions = details.final
      .slice(0, 30)
      .map((item) => item.slice(0, 240));
  }
}

function safePostprocessDiagnosticText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/(?:authorization|cookie|x-vercel-protection-bypass)\s*[:=]\s*[^\s,;]+/giu, "[redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/gu, "[redacted]")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
}

export function recordSurveyPostprocessError(
  trace: SurveyGenerationTrace | undefined,
  details: {
    error: unknown;
    code: string;
    stage: string;
    location: string;
    issueCodes?: string[];
    issuePaths?: string[];
    issueMessages?: string[];
    firstInvalidQuestionId?: string | number | null;
    repairAttempted?: boolean;
    repairFailureCode?: string | null;
    fallbackSelectedBecause?: string | null;
  },
) {
  if (!trace) return;
  trace.postprocessErrorName =
    details.error instanceof Error
      ? safePostprocessDiagnosticText(details.error.name, 120) || "Error"
      : "UnknownError";
  trace.postprocessErrorCode = safePostprocessDiagnosticText(details.code, 120);
  trace.postprocessErrorStage = safePostprocessDiagnosticText(details.stage, 120);
  trace.postprocessErrorLocation = safePostprocessDiagnosticText(
    details.location,
    200,
  );
  trace.postprocessIssueCodes = (details.issueCodes ?? [details.code])
    .slice(0, 20)
    .map((item) => safePostprocessDiagnosticText(item, 120))
    .filter(Boolean);
  trace.postprocessIssuePaths = (details.issuePaths ?? [])
    .slice(0, 20)
    .map((item) => safePostprocessDiagnosticText(item, 200))
    .filter(Boolean);
  trace.postprocessIssueMessages = (
    details.issueMessages ??
    (details.error instanceof Error ? [details.error.message] : [])
  )
    .slice(0, 20)
    .map((item) => safePostprocessDiagnosticText(item, 240))
    .filter(Boolean);
  trace.firstInvalidQuestionId =
    details.firstInvalidQuestionId === undefined ||
    details.firstInvalidQuestionId === null
      ? null
      : safePostprocessDiagnosticText(
          String(details.firstInvalidQuestionId),
          120,
        );
  trace.repairAttempted = details.repairAttempted ?? trace.repairCount > 0;
  trace.repairFailureCode = details.repairFailureCode
    ? safePostprocessDiagnosticText(details.repairFailureCode, 120)
    : null;
  trace.fallbackSelectedBecause = details.fallbackSelectedBecause
    ? safePostprocessDiagnosticText(details.fallbackSelectedBecause, 240)
    : trace.fallbackSelectedBecause;
}

export function recordSurveyFallbackSelection(
  trace: SurveyGenerationTrace | undefined,
  reason: string,
) {
  if (!trace) return;
  trace.fallbackSelectedBecause = safePostprocessDiagnosticText(reason, 240);
}

type RepairAuditQuestion = Record<string, unknown> & { id?: unknown };

const respondentFacingQuestionFields = new Set([
  "title",
  "text",
  "type",
  "options",
  "scale",
  "scaleMin",
  "scaleMax",
  "scaleMinLabel",
  "scaleMaxLabel",
  "showIf",
  "show_if",
  "required",
  "description",
  "helperText",
  "helper_text",
]);

function stableAuditValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableAuditValue).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && typeof item !== "function")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableAuditValue(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function auditHash(value: unknown) {
  const input = stableAuditValue(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function auditQuestionId(question: RepairAuditQuestion, index: number) {
  const value = question.id;
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : String(index + 1);
}

export function recordSurveyRepairAudit(
  trace: SurveyGenerationTrace | undefined,
  details: { before: RepairAuditQuestion[]; final: RepairAuditQuestion[] },
) {
  if (!trace) return;
  trace.questionsBeforeRepairHash = auditHash(details.before);
  trace.questionsAfterRepairHash = auditHash(details.final);

  const before = new Map(
    details.before.map((question, index) => [
      auditQuestionId(question, index),
      question,
    ]),
  );
  const final = new Map(
    details.final.map((question, index) => [
      auditQuestionId(question, index),
      question,
    ]),
  );
  const ids = [...new Set([...before.keys(), ...final.keys()])].sort();
  const changedFieldsByQuestion: Record<string, string[]> = {};
  let respondentFacingContentChanged = false;

  for (const id of ids) {
    const previous = before.get(id);
    const current = final.get(id);
    const fields = previous && current
      ? [...new Set([...Object.keys(previous), ...Object.keys(current)])]
          .filter(
            (field) =>
              stableAuditValue(previous[field]) !== stableAuditValue(current[field]),
          )
          .sort()
      : [previous ? "__removed" : "__added"];
    if (fields.length === 0) continue;
    changedFieldsByQuestion[id] = fields;
    if (
      fields.some(
        (field) =>
          field === "__added" ||
          field === "__removed" ||
          respondentFacingQuestionFields.has(field),
      )
    ) {
      respondentFacingContentChanged = true;
    }
  }

  trace.changedFieldsByQuestion = changedFieldsByQuestion;
  trace.changedQuestionIds = Object.keys(changedFieldsByQuestion);
  trace.respondentFacingContentChanged = respondentFacingContentChanged;
  trace.metadataOnlyNormalization =
    !respondentFacingContentChanged &&
    trace.repairCount === 0 &&
    (trace.changedQuestionIds.length > 0 ||
      trace.normalizedInternalMetadataPaths.length > 0);
}

export function recordSurveyGenerationSource(
  trace: SurveyGenerationTrace | undefined,
  source: GenerationSource,
) {
  if (!trace) return;
  trace.generationSource = canonicalGenerationSource(source);
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
  if (!trace || !canRecordDetailedGenerationTrace()) return;
  trace.extractedTopic = details.topic?.slice(0, 120) ?? null;
  trace.extractedVariables = details.variables.slice(0, 20).map((item) => item.slice(0, 120));
  trace.extractedRelations = details.relations.slice(0, 20).map((item) => item.slice(0, 160));
}

export function recordCanonicalSurveyIntentTrace(
  trace: SurveyGenerationTrace | undefined,
  details: {
    surveyArchetype: string;
    entities: Array<{
      id: string;
      text: string;
      kind: string;
      role: string;
      confidence: number;
      evidence: string[];
    }>;
    activities: Array<{
      id: string;
      text: string;
      kind: string;
      objectEntityIds: string[];
    }>;
    constructs: Array<{
      id: string;
      name: string;
      kind: string;
      measurementMode: string;
      dimensions: Array<{ name: string; required: boolean }>;
    }>;
    purposes: Array<{ id: string; text: string; kind: string }>;
    relations: Array<{
      type: string;
      fromVariableId: string;
      toVariableId: string;
    }>;
    ambiguity: {
      code: string | null;
      reasons?: string[];
      missingRoles?: string[];
    };
    operationalizationPlan: Array<{
      constructId: string;
      constructName: string;
      measurementMode: string;
      requiredDimensions: string[];
      optionalDimensions: string[];
    }>;
  },
) {
  if (!trace) return;
  trace.canonicalSurveyArchetype = details.surveyArchetype.slice(0, 80);
  trace.canonicalAmbiguityCode = details.ambiguity.code?.slice(0, 120) ?? null;
  trace.canonicalAmbiguityReasons = (details.ambiguity.reasons ?? [])
    .slice(0, 10)
    .map((reason) => reason.slice(0, 240));
  trace.canonicalMissingRoles = (details.ambiguity.missingRoles ?? [])
    .slice(0, 10)
    .map((role) => role.slice(0, 80));
  if (!canRecordDetailedGenerationTrace()) return;
  trace.canonicalEntitySummaries = details.entities.slice(0, 30).map((item) =>
    `${item.id}:${item.role}:${item.kind}:${item.text}:confidence=${item.confidence.toFixed(2)}:evidence=${item.evidence.join("|")}`.slice(0, 500),
  );
  trace.canonicalActivitySummaries = details.activities.slice(0, 20).map((item) =>
    `${item.id}:${item.kind}:${item.text}:objects=${item.objectEntityIds.join("+")}`.slice(0, 400),
  );
  trace.canonicalConstructSummaries = details.constructs.slice(0, 30).map((item) =>
    `${item.id}:${item.kind}:${item.measurementMode}:${item.name}:dimensions=${item.dimensions.map((dimension) => `${dimension.name}:${dimension.required ? "required" : "optional"}`).join("|")}`.slice(0, 700),
  );
  trace.canonicalPurposeSummaries = details.purposes.slice(0, 20).map((item) =>
    `${item.id}:${item.kind}:${item.text}`.slice(0, 400),
  );
  trace.canonicalRelationSummaries = details.relations.slice(0, 20).map((item) =>
    `${item.type}:${item.fromVariableId}->${item.toVariableId}`.slice(0, 300),
  );
  trace.canonicalOperationalizationPlan = details.operationalizationPlan
    .slice(0, 30)
    .map((item) =>
      `${item.constructId}:${item.constructName}:${item.measurementMode}:required=${item.requiredDimensions.join("|")}:optional=${item.optionalDimensions.join("|")}`.slice(0, 700),
    );
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
  trace.extractedStudyPurposes = [...trace.purposeKinds];
  trace.selectedBlueprint = trace.generatedPlanBlocks.join(" | ").slice(0, 2_000);
}

export function recordSurveySemanticDiagnostics(
  trace: SurveyGenerationTrace | undefined,
  details: {
    originalQuestions?: string[];
    violationCodes?: string[];
    qualityViolationCodes?: string[];
    violationQuestionIds?: Array<string | number>;
    violationOrigins?: string[];
    repairedQuestions?: string[];
    secondValidationIssues?: string[];
  },
) {
  if (!trace) return;
  if (details.violationCodes) trace.semanticViolationCodes = [...details.violationCodes];
  if (details.qualityViolationCodes) {
    trace.qualityViolationCodes = details.qualityViolationCodes
      .slice(0, 30)
      .map((item) => item.slice(0, 160));
  }
  if (details.violationQuestionIds) {
    trace.semanticViolationQuestionIds = details.violationQuestionIds.map(String);
  }
  if (details.violationOrigins) trace.violationOrigins = [...details.violationOrigins];
  if (!canRecordDetailedGenerationTrace()) return;
  if (details.originalQuestions) {
    trace.originalQuestions = details.originalQuestions.slice(0, 30).map((item) => item.slice(0, 240));
  }
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
  if (source) trace.generationSource = canonicalGenerationSource(source);
  traceAiEvent({
    requestId: trace.requestId,
    stage: "fallback_used",
    data: {
      fallbackUsed: true,
      fallbackReason: trace.fallbackReason,
      fallbackFunction: "recordSurveyFallback",
      generationSource: trace.generationSource,
      fallbackCount: trace.fallbackCount,
    },
  });
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
  trace.repairAttempted = true;
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
    buildCommitSha: trace.buildDiagnostics.buildCommitSha,
    deploymentEnvironment: trace.buildDiagnostics.deploymentEnvironment,
    deploymentUrl: trace.buildDiagnostics.deploymentUrl,
    deploymentId: trace.buildDiagnostics.deploymentId,
    gitBranch: trace.buildDiagnostics.gitBranch,
    appVersion: trace.buildDiagnostics.appVersion,
    httpMethod: trace.httpMethod,
    contentType: trace.contentType,
    surveyMode: trace.surveyMode,
    requestedQuestionCount: trace.requestedQuestionCount,
    targetGrade: trace.targetGrade,
    attachmentCount: trace.attachmentCount,
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
    qualityViolationCodes: [...trace.qualityViolationCodes],
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
    questionsBeforeRepairHash: trace.questionsBeforeRepairHash,
    questionsAfterRepairHash: trace.questionsAfterRepairHash,
    changedQuestionIds: [...trace.changedQuestionIds],
    changedFieldsByQuestion: Object.fromEntries(
      Object.entries(trace.changedFieldsByQuestion).map(([id, fields]) => [
        id,
        [...fields],
      ]),
    ),
    metadataOnlyNormalization: trace.metadataOnlyNormalization,
    respondentFacingContentChanged: trace.respondentFacingContentChanged,
    rawUserInput: trace.rawUserInput,
    normalizedInput: trace.normalizedInput,
    parsedSurveyContext: trace.parsedSurveyContext,
    extractedAudience: trace.extractedAudience,
    extractedEntities: [...trace.extractedEntities],
    extractedActivities: [...trace.extractedActivities],
    extractedResearchGoals: [...trace.extractedResearchGoals],
    extractedStudyPurposes: [...trace.extractedStudyPurposes],
    canonicalSurveyArchetype: trace.canonicalSurveyArchetype,
    canonicalEntitySummaries: [...trace.canonicalEntitySummaries],
    canonicalActivitySummaries: [...trace.canonicalActivitySummaries],
    canonicalConstructSummaries: [...trace.canonicalConstructSummaries],
    canonicalPurposeSummaries: [...trace.canonicalPurposeSummaries],
    canonicalRelationSummaries: [...trace.canonicalRelationSummaries],
    canonicalAmbiguityCode: trace.canonicalAmbiguityCode,
    canonicalAmbiguityReasons: [...trace.canonicalAmbiguityReasons],
    canonicalMissingRoles: [...trace.canonicalMissingRoles],
    canonicalOperationalizationPlan: [
      ...trace.canonicalOperationalizationPlan,
    ],
    selectedSurveyType: trace.selectedSurveyType,
    selectedTemplateKey: trace.selectedTemplateKey,
    selectedBlueprint: trace.selectedBlueprint,
    rawModelResponsePresent: trace.rawModelResponsePresent,
    rawModelResponse: trace.rawModelResponse,
    responseStatus: trace.responseStatus,
    responseIncompleteReason: trace.responseIncompleteReason,
    outputParsedPresent: trace.outputParsedPresent,
    outputItemTypes: [...trace.outputItemTypes],
    modelOutputTopLevelKeys: [...trace.modelOutputTopLevelKeys],
    modelReturnedQuestionCount: trace.modelReturnedQuestionCount,
    schemaIssuePaths: [...trace.schemaIssuePaths],
    schemaIssueCodes: [...trace.schemaIssueCodes],
    schemaExpectedTypes: [...trace.schemaExpectedTypes],
    schemaReceivedTypes: [...trace.schemaReceivedTypes],
    parseFailureStage: trace.parseFailureStage,
    modelOutputRejectedAt: trace.modelOutputRejectedAt,
    modelOutputRejectionCode: trace.modelOutputRejectionCode,
    modelOutputRejectionIssues: [...trace.modelOutputRejectionIssues],
    modelOutputRejectionIssuePaths: [...trace.modelOutputRejectionIssuePaths],
    postprocessErrorName: trace.postprocessErrorName,
    postprocessErrorCode: trace.postprocessErrorCode,
    postprocessErrorStage: trace.postprocessErrorStage,
    postprocessErrorLocation: trace.postprocessErrorLocation,
    postprocessIssueCodes: [...trace.postprocessIssueCodes],
    postprocessIssuePaths: [...trace.postprocessIssuePaths],
    postprocessIssueMessages: [...trace.postprocessIssueMessages],
    firstInvalidQuestionId: trace.firstInvalidQuestionId,
    repairAttempted: trace.repairAttempted,
    repairFailureCode: trace.repairFailureCode,
    fallbackSelectedBecause: trace.fallbackSelectedBecause,
    modelOutputHasTitle: trace.modelOutputHasTitle,
    modelOutputHasIntro: trace.modelOutputHasIntro,
    modelOutputHasSurveyPlan: trace.modelOutputHasSurveyPlan,
    modelQuestionTypes: [...trace.modelQuestionTypes],
    modelQuestionStructureIssues: [...trace.modelQuestionStructureIssues],
    normalizedInternalMetadataPaths: [...trace.normalizedInternalMetadataPaths],
    initialCoveredRequiredBlockIds: [...trace.initialCoveredRequiredBlockIds],
    initialMissingRequiredBlockIds: [...trace.initialMissingRequiredBlockIds],
    finalCoveredRequiredBlockIds: [...trace.finalCoveredRequiredBlockIds],
    finalMissingRequiredBlockIds: [...trace.finalMissingRequiredBlockIds],
    optionalPlanBlockIds: [...trace.optionalPlanBlockIds],
    initialIncompatibleQuestionIds: [
      ...trace.initialIncompatibleQuestionIds,
    ],
    finalIncompatibleQuestionIds: [...trace.finalIncompatibleQuestionIds],
    initialSemanticDuplicateGroups: trace.initialSemanticDuplicateGroups.map(
      (group) => [...group],
    ),
    semanticDuplicateGroups: trace.semanticDuplicateGroups.map((group) => [
      ...group,
    ]),
    questionsBeforePostprocessCount: trace.questionsBeforePostprocessCount,
    finalQuestionCount: trace.finalQuestionCount,
    questionsBeforePostprocess: [...trace.questionsBeforePostprocess],
    finalQuestions: [...trace.finalQuestions],
    totalElapsedMs: trace.elapsedMs,
  };
}

export function surveyGenerationLogSnapshot(trace: SurveyGenerationTrace) {
  const snapshot = surveyGenerationTraceSnapshot(trace);
  if (canRecordDetailedGenerationTrace()) return snapshot;
  return {
    requestId: snapshot.requestId,
    stage: snapshot.stage,
    failureStage: snapshot.failureStage,
    errorCode: snapshot.errorCode,
    stageHistory: snapshot.stageHistory,
    buildCommitSha: snapshot.buildCommitSha,
    deploymentEnvironment: snapshot.deploymentEnvironment,
    deploymentUrl: snapshot.deploymentUrl,
    deploymentId: snapshot.deploymentId,
    gitBranch: snapshot.gitBranch,
    appVersion: snapshot.appVersion,
    httpMethod: snapshot.httpMethod,
    contentType: snapshot.contentType,
    surveyMode: snapshot.surveyMode,
    requestedQuestionCount: snapshot.requestedQuestionCount,
    targetGrade: snapshot.targetGrade,
    attachmentCount: snapshot.attachmentCount,
    selectedSurveyType: snapshot.selectedSurveyType,
    selectedTemplateKey: snapshot.selectedTemplateKey,
    intentMode: snapshot.intentMode,
    purposeKinds: snapshot.purposeKinds,
    purposeBlockCount: snapshot.purposeBlockCount,
    generationSource: snapshot.generationSource,
    semanticViolationCodes: snapshot.semanticViolationCodes,
    qualityViolationCodes: snapshot.qualityViolationCodes,
    fallbackUsed: snapshot.fallbackUsed,
    fallbackReason: snapshot.fallbackReason,
    modelCallCount: snapshot.modelCallCount,
    repairCount: snapshot.repairCount,
    fallbackCount: snapshot.fallbackCount,
    originalQuestionCount: snapshot.originalQuestionCount,
    questionsBeforePostprocessCount: snapshot.questionsBeforePostprocessCount,
    finalQuestionCount: snapshot.finalQuestionCount,
    rawModelResponsePresent: snapshot.rawModelResponsePresent,
    responseStatus: snapshot.responseStatus,
    responseIncompleteReason: snapshot.responseIncompleteReason,
    outputParsedPresent: snapshot.outputParsedPresent,
    outputItemTypes: snapshot.outputItemTypes,
    modelOutputTopLevelKeys: snapshot.modelOutputTopLevelKeys,
    modelReturnedQuestionCount: snapshot.modelReturnedQuestionCount,
    schemaIssuePaths: snapshot.schemaIssuePaths,
    schemaIssueCodes: snapshot.schemaIssueCodes,
    schemaExpectedTypes: snapshot.schemaExpectedTypes,
    schemaReceivedTypes: snapshot.schemaReceivedTypes,
    parseFailureStage: snapshot.parseFailureStage,
    modelOutputRejectedAt: snapshot.modelOutputRejectedAt,
    modelOutputRejectionCode: snapshot.modelOutputRejectionCode,
    modelOutputRejectionIssues: snapshot.modelOutputRejectionIssues,
    modelOutputRejectionIssuePaths: snapshot.modelOutputRejectionIssuePaths,
    postprocessErrorName: snapshot.postprocessErrorName,
    postprocessErrorCode: snapshot.postprocessErrorCode,
    postprocessErrorStage: snapshot.postprocessErrorStage,
    postprocessErrorLocation: snapshot.postprocessErrorLocation,
    postprocessIssueCodes: snapshot.postprocessIssueCodes,
    postprocessIssuePaths: snapshot.postprocessIssuePaths,
    postprocessIssueMessages: snapshot.postprocessIssueMessages,
    firstInvalidQuestionId: snapshot.firstInvalidQuestionId,
    repairAttempted: snapshot.repairAttempted,
    repairFailureCode: snapshot.repairFailureCode,
    fallbackSelectedBecause: snapshot.fallbackSelectedBecause,
    modelOutputHasTitle: snapshot.modelOutputHasTitle,
    modelOutputHasIntro: snapshot.modelOutputHasIntro,
    modelOutputHasSurveyPlan: snapshot.modelOutputHasSurveyPlan,
    modelQuestionTypes: snapshot.modelQuestionTypes,
    modelQuestionStructureIssues: snapshot.modelQuestionStructureIssues,
    normalizedInternalMetadataPaths: snapshot.normalizedInternalMetadataPaths,
    questionsBeforeRepairHash: snapshot.questionsBeforeRepairHash,
    questionsAfterRepairHash: snapshot.questionsAfterRepairHash,
    changedQuestionIds: snapshot.changedQuestionIds,
    changedFieldsByQuestion: snapshot.changedFieldsByQuestion,
    metadataOnlyNormalization: snapshot.metadataOnlyNormalization,
    respondentFacingContentChanged: snapshot.respondentFacingContentChanged,
    initialMissingRequiredBlockIds: snapshot.initialMissingRequiredBlockIds,
    finalMissingRequiredBlockIds: snapshot.finalMissingRequiredBlockIds,
    initialIncompatibleQuestionIds: snapshot.initialIncompatibleQuestionIds,
    finalIncompatibleQuestionIds: snapshot.finalIncompatibleQuestionIds,
    initialSemanticDuplicateGroups: snapshot.initialSemanticDuplicateGroups,
    semanticDuplicateGroups: snapshot.semanticDuplicateGroups,
    totalElapsedMs: snapshot.totalElapsedMs,
  };
}
