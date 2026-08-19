import { z } from "zod";

export const surveyRegressionSplitSchema = z.enum(["dev", "holdout"]);
export const surveyRegressionModeSchema = z.enum(["standard", "research"]);
export const surveyRegressionOutcomeSchema = z.enum(["survey", "clarification"]);
export const surveyRegressionDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const surveyRegressionInputQualitySchema = z.enum([
  "clear",
  "noisy_recoverable",
  "ambiguous",
  "invalid_test_sentence",
]);

export const surveyRegressionCaseSchema = z.object({
  id: z.string().min(3),
  split: surveyRegressionSplitSchema,
  stratum: z.enum([
    "past_error_variant",
    "general_domain",
    "complex_relation",
    "incomplete_user_input",
    "clarification",
  ]),
  category: z.string().min(2),
  difficulty: surveyRegressionDifficultySchema,
  surveyMode: surveyRegressionModeSchema,
  questionCount: z.number().int().min(1).max(30),
  input: z.string().min(2),
  expectedOutcome: surveyRegressionOutcomeSchema,
  expectedTargetPopulation: z.array(z.string().min(1)).min(1),
  expectedSurveyObject: z.array(z.string().min(1)).min(1),
  expectedPurposeConcepts: z.array(z.string().min(1)).min(1),
  inputQuality: surveyRegressionInputQualitySchema.optional(),
  contextEntities: z.array(z.string().min(1)).optional(),
  expectedEligibilityConditions: z.array(z.string().min(1)).optional(),
  screeningExpected: z.boolean().optional(),
  forbiddenPurposeConcepts: z.array(z.string().min(1)).optional(),
  mustPreserveTerms: z.array(z.string().min(1)),
  mustPreserveNegation: z.boolean(),
  requiredQuestionConcepts: z.array(z.string().min(1)),
  forbiddenTargetExpansions: z.array(z.string().min(1)),
  forbiddenSurveyObjects: z.array(z.string().min(1)),
  forbiddenQuestionConcepts: z.array(z.string().min(1)),
  clarificationExpected: z.boolean(),
  expectedIntentModes: z.array(z.enum(["single", "composite"])).min(1),
  expectedTargetCardinality: z.enum(["single", "multiple"]),
  expectedArchetypes: z.array(z.string().min(1)).min(1),
  tags: z.array(
    z.enum([
      "negation",
      "timeframe",
      "virtual_entity",
      "non_university",
      "multiple_targets",
      "single_target_multi_purpose",
      "complex_order",
      "noisy_input",
      "clarification",
    ]),
  ),
  notes: z.string(),
});

export const surveyRegressionDatasetSchema = z.object({
  version: z.literal("v1"),
  split: surveyRegressionSplitSchema,
  seed: z.string().min(8),
  generatedAt: z.string().datetime(),
  cases: z.array(surveyRegressionCaseSchema),
});

export type SurveyRegressionCase = z.infer<typeof surveyRegressionCaseSchema>;
export type SurveyRegressionDataset = z.infer<typeof surveyRegressionDatasetSchema>;

export const generationPathSchema = z.enum([
  "clean_model_success",
  "deterministic_metadata_normalization",
  "partial_repair",
  "hard_fallback",
  "request_failure",
  "clarification",
  "environment_rate_limited",
  "environment_runtime_inactive",
]);

export type GenerationPath = z.infer<typeof generationPathSchema>;

export type SurveyRegressionIssue = {
  code: string;
  message: string;
  fatal: boolean;
  cluster:
    | "target_population"
    | "eligibility"
    | "context_entity"
    | "survey_object"
    | "negation"
    | "single_vs_multiple_target"
    | "purpose_coverage"
    | "reference_period"
    | "question_quality"
    | "schema"
    | "semantic_validation"
    | "partial_repair"
    | "hard_fallback"
    | "request_transport"
    | "clarification";
};

export type SurveyRegressionResult = {
  caseId: string;
  split: "dev" | "holdout";
  input: string;
  expected: SurveyRegressionCase;
  requestId: string | null;
  model: string | null;
  httpStatus: number | null;
  responseType: string | null;
  responseStatus: string | null;
  responseCode?: string | null;
  responseStage?: string | null;
  generationSource: string | null;
  modelCallCount: number;
  repairCount: number;
  fallbackCount: number;
  retryCount: number;
  fallbackReason: string | null;
  normalizedMetadataPaths: string[];
  modelOutputRejected: boolean;
  classification: GenerationPath;
  canonicalTargetPopulation: string | null;
  finalRespondentGroup: string | null;
  canonicalSurveyObject: string | null;
  finalEvaluationTarget: string | null;
  title: string | null;
  description: string | null;
  questions: Array<{
    title: string;
    type: string | null;
    options: string[];
    reason?: string | null;
  }>;
  questionsBeforePostprocess: string[];
  schemaIssues: string[];
  semanticIssues: string[];
  qualityIssues: string[];
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  webSearchCalls: number;
  estimatedCostUsd: number;
  latencyMs: number;
  fatalFailures: SurveyRegressionIssue[];
  warnings: SurveyRegressionIssue[];
  responseDiagnostics: {
    status: string | null;
    incompleteReason: string | null;
    outputParsed: boolean;
    outputItemTypes: string[];
  };
};
