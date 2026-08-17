export * from "./survey-context-core";

import { parseCanonicalSurveyIntent } from "./survey-canonical-intent";
import type { ParsedSurveyContext } from "./survey-context-core";

export function parseSurveyGenerationContext(
  rawUserInput: string,
): ParsedSurveyContext {
  return parseCanonicalSurveyIntent(rawUserInput).generationContext;
}
