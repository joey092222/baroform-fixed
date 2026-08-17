export * from "./survey-research-intent-core";

import { parseCanonicalSurveyIntent } from "./survey-canonical-intent";
import type {
  SurveyResearchIntent,
  SurveyResearchIntentParseOptions,
} from "./survey-research-intent-core";
import { parseSurveyResearchIntentCore } from "./survey-research-intent-core";

export function parseSurveyResearchIntent(
  rawInput: string,
  options: SurveyResearchIntentParseOptions = {},
): SurveyResearchIntent {
  const canonical = parseCanonicalSurveyIntent(rawInput);
  if (
    options.targetPopulation === undefined &&
    options.explicitTimeframe === undefined &&
    options.relationParser === undefined
  ) {
    return canonical.researchIntent;
  }
  // Test-only parser injection is intentionally kept in the extraction core so
  // a detected relation cue can be verified to become clarification, never an empty plan.
  if (options.relationParser) {
    return parseSurveyResearchIntentCore(rawInput, options);
  }
  return {
    ...canonical.researchIntent,
    targetPopulation:
      options.targetPopulation === undefined
        ? canonical.researchIntent.targetPopulation
        : options.targetPopulation,
    explicitTimeframe:
      options.explicitTimeframe === undefined
        ? canonical.researchIntent.explicitTimeframe
        : options.explicitTimeframe,
  };
}
