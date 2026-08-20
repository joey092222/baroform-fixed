import {
  surveyRegressionCaseSchema,
  type SurveyRegressionCase,
} from "../v1/schema";
import { targetedRemediationSmokeCases } from "./targeted-remediation-smoke";

const retainedCaseIds = [
  "targeted-expansion-001",
  "targeted-flattening-003",
  "targeted-repair-001",
  "targeted-clarification-003",
  "targeted-population-001",
  "targeted-satisfaction-002",
  "targeted-satisfaction-003",
] as const;

function controlCase(input: {
  id: string;
  prompt: string;
  target: string[];
  object: string[];
  purpose: string[];
  required: string[];
  eligibility?: string[];
  contexts?: string[];
  negation?: boolean;
  intentModes?: Array<"single" | "composite">;
  archetypes: string[];
  terms: string[];
}): SurveyRegressionCase {
  return surveyRegressionCaseSchema.parse({
    id: input.id,
    split: "dev",
    stratum: "complex_relation",
    category: "targeted_key10_generalization_control",
    difficulty: "hard",
    surveyMode: "standard",
    questionCount: 7,
    input: input.prompt,
    expectedOutcome: "survey",
    inputQuality: "clear",
    expectedTargetPopulation: input.target,
    expectedEligibilityConditions: input.eligibility ?? [],
    contextEntities: input.contexts ?? [],
    screeningExpected: (input.eligibility?.length ?? 0) > 0,
    expectedSurveyObject: input.object,
    expectedPurposeConcepts: input.purpose,
    requiredQuestionConcepts: input.required,
    forbiddenPurposeConcepts: [],
    mustPreserveTerms: input.terms,
    mustPreserveNegation: input.negation ?? false,
    forbiddenTargetExpansions: [],
    forbiddenSurveyObjects: [],
    forbiddenQuestionConcepts: [
      "generic filler",
      "무관한 인구통계",
      "선행 값",
      "결과 값",
      "독립변수",
      "종속변수",
    ],
    clarificationExpected: false,
    expectedIntentModes: input.intentModes ?? ["single"],
    expectedTargetCardinality: "single",
    expectedArchetypes: input.archetypes,
    tags: [
      "single_target_multi_purpose",
      ...((input.eligibility?.length ?? 0) > 0 ? ["timeframe" as const] : []),
      ...(input.negation ? ["negation" as const] : []),
    ],
    notes: "targeted 핵심 10건용 새 일반화 control",
  });
}

const retainedCases = retainedCaseIds.map((caseId) => {
  const matched = targetedRemediationSmokeCases.find((item) => item.id === caseId);
  if (!matched) throw new Error(`TARGETED_KEY10_SOURCE_CASE_MISSING:${caseId}`);
  return matched;
});

const generalizationControls = [
  controlCase({
    id: "targeted-key10-control-nonparticipant",
    prompt: "별가람 청년 워크숍에 참여하지 않은 신청자의 불참 이유와 다음 행사 참여 의향을 조사하고 싶다.",
    target: ["별가람 청년 워크숍에 참여하지 않은 신청자"],
    eligibility: ["별가람 청년 워크숍 비참여"],
    contexts: ["별가람 청년 워크숍"],
    object: ["별가람 청년 워크숍"],
    purpose: ["비참여 이유", "참여 의향"],
    required: ["비참여 이유", "참여 의향"],
    negation: true,
    archetypes: ["attitude", "event_program"],
    terms: ["별가람 청년 워크숍"],
  }),
  controlCase({
    id: "targeted-key10-control-app-relation",
    prompt: "하늘결 앱 사용자의 기능 편의성과 지속 사용 의향의 관계를 조사하고 싶다.",
    target: ["하늘결 앱 사용자"],
    contexts: ["하늘결 앱"],
    object: ["하늘결 앱"],
    purpose: ["기능 편의성과 지속 사용 의향의 관계"],
    required: ["기능 편의성", "지속 사용 의향"],
    intentModes: ["composite"],
    archetypes: ["relationship_analysis"],
    terms: ["하늘결 앱", "기능 편의성", "지속 사용 의향"],
  }),
  controlCase({
    id: "targeted-key10-control-distributed-purpose",
    prompt: "푸른솔 문화센터 방문자의 방문 목적, 이용 빈도, 불편과 개선 요구를 조사하고 싶다.",
    target: ["푸른솔 문화센터 방문자"],
    contexts: ["푸른솔 문화센터"],
    object: ["푸른솔 문화센터"],
    purpose: ["방문 목적", "이용 빈도", "불편", "개선 요구"],
    required: ["방문 목적", "이용 빈도", "불편", "개선 요구"],
    archetypes: ["facility_usage", "mixed"],
    terms: ["푸른솔 문화센터"],
  }),
] as const;

export const targetedRemediationKey10Cases = [
  ...retainedCases,
  ...generalizationControls,
] as const;

if (targetedRemediationKey10Cases.length !== 10) {
  throw new Error(
    `TARGETED_REMEDIATION_KEY10_CARDINALITY:${targetedRemediationKey10Cases.length}`,
  );
}
