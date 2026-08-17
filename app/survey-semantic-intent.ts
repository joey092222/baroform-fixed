export * from "./survey-semantic-intent-core";
export {
  parseCanonicalSurveyIntent,
  type CanonicalSurveyIntent,
} from "./survey-canonical-intent";

import { parseCanonicalSurveyIntent } from "./survey-canonical-intent";
import type {
  SurveyIntent,
  SurveyIntentStudyType,
} from "./survey-semantic-intent-core";

export function parseSurveyIntent(
  rawInput: string,
  studyType: SurveyIntentStudyType = "general",
): SurveyIntent {
  return parseCanonicalSurveyIntent(rawInput, studyType).surveyIntent;
}
