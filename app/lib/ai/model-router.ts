import type { SurveyMode } from "@/app/survey-mode";

export const allowedOpenAiModels = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
] as const;

export type BaroformOpenAiModel = (typeof allowedOpenAiModels)[number];
export type BaroformReasoningEffort = "low" | "medium" | "high";
export type BaroformAiRequestType =
  | "survey_generate"
  | "survey_regenerate"
  | "survey_quick_edit"
  | "survey_ai_edit"
  | "survey_repair"
  | "file_extract"
  | "web_search"
  | "result_analysis";

export type BaroformServiceTier = "default" | "fast" | "priority";

export type ModelRoute = {
  model: BaroformOpenAiModel;
  reasoningEffort: BaroformReasoningEffort;
  requestedServiceTier: BaroformServiceTier;
};

const defaultModels = {
  surveyMedium: "gpt-5.6-terra",
  surveyHigh: "gpt-5.6-sol",
  simpleEdit: "gpt-5.6-luna",
  resultAnalysis: "gpt-5.6-terra",
} as const satisfies Record<string, BaroformOpenAiModel>;

function isAllowedModel(value: string): value is BaroformOpenAiModel {
  return (allowedOpenAiModels as readonly string[]).includes(value);
}

function configuredModel(
  variableName: string,
  fallback: BaroformOpenAiModel,
): BaroformOpenAiModel {
  const value = process.env[variableName]?.trim();
  if (!value) return fallback;
  if (isAllowedModel(value)) return value;
  console.warn("baroform-ai-invalid-model", {
    variableName,
    configuredValue: value,
    fallback,
    allowedModels: allowedOpenAiModels,
  });
  return fallback;
}

function configuredReasoning(
  variableName: string,
  fallback: BaroformReasoningEffort,
): BaroformReasoningEffort {
  const value = process.env[variableName]?.trim();
  if (value === "low" || value === "medium" || value === "high") return value;
  if (value) {
    console.warn("baroform-ai-invalid-reasoning-effort", {
      variableName,
      configuredValue: value,
      fallback,
    });
  }
  return fallback;
}

export function resolveOpenAiServiceTier(): BaroformServiceTier {
  const configured = process.env.OPENAI_SERVICE_TIER?.trim() || "default";
  if (configured === "default") return "default";
  if (configured === "fast" || configured === "priority") {
    if (process.env.ALLOW_OPENAI_FAST_TIER === "true") return configured;
    const details = {
      configured,
      fallback: "default",
      reason: "ALLOW_OPENAI_FAST_TIER is not true",
    };
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `OpenAI ${configured} tier is disabled. Set ALLOW_OPENAI_FAST_TIER=true to opt in.`,
      );
    }
    console.warn("baroform-ai-tier-forced-to-default", details);
    return "default";
  }
  if (configured !== "default") {
    console.warn("baroform-ai-invalid-service-tier", {
      configured,
      fallback: "default",
    });
  }
  return "default";
}

export function resolveSurveyGenerationModel(surveyMode: SurveyMode): ModelRoute {
  const high = surveyMode === "research";
  return {
    model: configuredModel(
      high ? "AI_MODEL_SURVEY_HIGH" : "AI_MODEL_SURVEY_MEDIUM",
      high ? defaultModels.surveyHigh : defaultModels.surveyMedium,
    ),
    reasoningEffort: configuredReasoning(
      high ? "AI_REASONING_SURVEY_HIGH" : "AI_REASONING_SURVEY_MEDIUM",
      high ? "high" : "medium",
    ),
    requestedServiceTier: resolveOpenAiServiceTier(),
  };
}

const complexRevisionPattern =
  /(?:조사\s*목적|응답\s*대상|대상\s*집단|분기|로직|척도|가설|변수|전체\s*(?:설문|문항)|여러\s*문항|문항\s*(?:추가|삭제)|선택지\s*(?:구성|완전성)|재설계|구조|순서\s*변경|응답\s*유형)/i;

export function classifySurveyRevision(
  instruction: string,
): "simple" | "complex" {
  const normalized = instruction.replace(/\s+/g, " ").trim();
  return normalized.length <= 160 && !complexRevisionPattern.test(normalized)
    ? "simple"
    : "complex";
}

export function resolveSurveyRevisionModel(instruction: string): ModelRoute {
  const simple = classifySurveyRevision(instruction) === "simple";
  return {
    model: simple
      ? configuredModel("AI_MODEL_SIMPLE_EDIT", defaultModels.simpleEdit)
      : configuredModel("AI_MODEL_SURVEY_MEDIUM", defaultModels.surveyMedium),
    reasoningEffort: simple
      ? configuredReasoning("AI_REASONING_SIMPLE_EDIT", "low")
      : configuredReasoning("AI_REASONING_SURVEY_MEDIUM", "medium"),
    requestedServiceTier: resolveOpenAiServiceTier(),
  };
}

export function resolveResultAnalysisModel(highQuality = false): ModelRoute {
  return {
    model: highQuality
      ? configuredModel("AI_MODEL_SURVEY_HIGH", defaultModels.surveyHigh)
      : configuredModel("AI_MODEL_RESULT_ANALYSIS", defaultModels.resultAnalysis),
    reasoningEffort: highQuality
      ? configuredReasoning("AI_REASONING_SURVEY_HIGH", "high")
      : configuredReasoning("AI_REASONING_RESULT_ANALYSIS", "medium"),
    requestedServiceTier: resolveOpenAiServiceTier(),
  };
}
