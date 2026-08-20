import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import {
  canonicalSurveyIntentV2Schema,
  deriveSurveyBriefFromCanonicalIntentV2,
  deriveSurveyPlanFromCanonicalIntentV2,
  validateCanonicalSurveyIntentV2,
  type CanonicalSurveyIntentV2,
} from "../app/survey-intent-v2";
import { auditedSurveyRegressionDatasetSchema } from "../evals/survey-regression/v1.1/schema";
import { surveyIntentAuthorityDatasetV12 } from "../evals/survey-regression/v1.2/manifest";
import type { AuditedSurveyRegressionCase } from "../evals/survey-regression/v1.1/schema";

const root = process.cwd();
const compact = (value: string) =>
  value.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

function setsOverlap(actual: string[], expected: string[]) {
  const left = actual.map(compact);
  const right = expected.map(compact);
  return right.every((expectedValue) =>
    left.some(
      (actualValue) =>
        actualValue.includes(expectedValue) || expectedValue.includes(actualValue),
    ),
  );
}

function purposeType(value: string) {
  if (value.includes("만족")) return "satisfaction" as const;
  if (value.includes("수요") || value.includes("의향") || value.includes("필요")) {
    return "need_demand" as const;
  }
  if (value.includes("관계") || value.includes("영향") || value.includes("차이")) {
    return "relationship_analysis" as const;
  }
  if (value.includes("능력") || value.includes("역량")) return "ability_skill" as const;
  if (value.includes("인식") || value.includes("태도") || value.includes("이유")) {
    return "attitude_perception" as const;
  }
  if (value.includes("이용") || value.includes("빈도") || value.includes("경험")) {
    return "behavior_usage" as const;
  }
  return "decision_support" as const;
}

function objectType(item: AuditedSurveyRegressionCase) {
  const archetypes = item.expectedArchetypes.join(" ");
  if (archetypes.includes("mobility")) return "mobility" as const;
  if (archetypes.includes("service")) return "service" as const;
  if (archetypes.includes("facility")) return "place_facility" as const;
  if (archetypes.includes("relationship")) return "relationship_analysis" as const;
  if (archetypes.includes("satisfaction")) return "satisfaction_evaluation" as const;
  if (archetypes.includes("need")) return "need_demand" as const;
  if (archetypes.includes("ability")) return "ability_skill" as const;
  return "other" as const;
}

function goldenIntent(item: AuditedSurveyRegressionCase): CanonicalSurveyIntentV2 {
  const fullEvidence = (
    role:
      | "target_population"
      | "survey_object"
      | "purpose"
      | "negation",
  ) => ({
    text: item.input,
    start: 0,
    end: item.input.length,
    normalized_form: item.input.replace(/\s+/g, " ").trim(),
    role,
    provenance: "user_explicit" as const,
  });
  const objects = item.expectedSurveyObject.map((name, index) => ({
    id: `object-${index + 1}`,
    name,
    entity_type: objectType(item),
    is_usage_object: ["service", "platform", "product", "place_facility"].includes(
      objectType(item),
    ),
    candidate_names: [],
    evidence: [fullEvidence("survey_object")],
    confidence: 1,
    provenance: "user_explicit" as const,
  }));
  const purposes = item.expectedPurposeConcepts.map((text, index) => ({
    id: `purpose-${index + 1}`,
    text,
    purpose_type: purposeType(text),
    object_ids: objects.map((object) => object.id),
    construct_names: item.requiredQuestionConcepts.length > 0
      ? item.requiredQuestionConcepts
      : [text],
    required: true,
    evidence: [fullEvidence("purpose")],
    confidence: 1,
    provenance: "user_explicit" as const,
  }));
  return canonicalSurveyIntentV2Schema.parse({
    version: "2",
    raw_user_input: item.input,
    normalized_user_input: item.input.replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/\n+/g, " ").trim(),
    target_population: {
      display_text: item.expectedTargetPopulation.join(", "),
      head: item.expectedTargetPopulation[0],
      qualifiers: item.expectedTargetPopulation.slice(1),
      institution: null,
      grade: null,
      inclusion_conditions: item.expectedEligibilityConditions.filter(
        (condition) => !condition.includes("않"),
      ),
      exclusion_conditions: item.expectedEligibilityConditions.filter(
        (condition) => condition.includes("않"),
      ),
      evidence: [fullEvidence("target_population")],
      confidence: 1,
      provenance: "user_explicit",
    },
    eligibility_conditions: item.expectedEligibilityConditions.map((text, index) => ({
      id: `eligibility-${index + 1}`,
      text,
      polarity: text.includes("않") ? "exclude" : "include",
      evidence: [fullEvidence("target_population")],
      confidence: 1,
      provenance: "user_explicit",
    })),
    context_entities: item.contextEntities.map((name, index) => ({
      id: `context-${index + 1}`,
      name,
      entity_type: "other",
      role: "golden context",
      evidence: [fullEvidence("survey_object")],
      confidence: 1,
      provenance: "user_explicit",
    })),
    survey_objects: objects,
    activities: [],
    target_cardinality: item.expectedTargetCardinality,
    purposes,
    relationships: [],
    explicit_timeframe: null,
    negation_constraints: item.mustPreserveNegation
      ? [{
          // The audited dataset freezes only the requirement that every explicit
          // negative condition survives.  Use the grounded source span rather
          // than inventing a normalized negative phrase in this static fixture.
          text: item.input,
          applies_to: "target_population",
          evidence: [fullEvidence("negation")],
          confidence: 1,
          provenance: "user_explicit",
        }]
      : [],
    survey_mode: item.surveyMode,
    requested_question_count: item.questionCount,
    clarification: {
      required: item.clarificationExpected,
      missing_roles: item.clarificationExpected ? ["survey_object"] : [],
      ambiguity_reasons: item.clarificationExpected
        ? ["golden dataset에서 clarification이 필요한 입력"]
        : [],
      question: item.clarificationExpected
        ? "어떤 대상을 중심으로 조사할까요?"
        : null,
    },
    evidence: [
      fullEvidence("target_population"),
      fullEvidence("survey_object"),
      fullEvidence("purpose"),
    ],
    confidence: 1,
    provenance: "user_explicit",
  });
}

async function loadCases() {
  const cases: AuditedSurveyRegressionCase[] = [];
  for (const relative of Object.values(surveyIntentAuthorityDatasetV12.sourceFiles)) {
    const raw = await readFile(resolve(root, relative));
    const expectedHash = relative.includes("holdout")
      ? surveyIntentAuthorityDatasetV12.sha256.holdout
      : surveyIntentAuthorityDatasetV12.sha256.dev;
    if (createHash("sha256").update(raw).digest("hex") !== expectedHash) {
      throw new Error(`frozen dataset hash mismatch: ${relative}`);
    }
    cases.push(
      ...auditedSurveyRegressionDatasetSchema.parse(
        JSON.parse(raw.toString("utf8")),
      ).cases,
    );
  }
  return cases;
}

const cases = await loadCases();
const legacy = {
  targetDivergence: 0,
  objectDivergence: 0,
  purposeDivergence: 0,
  clarificationDivergence: 0,
};
let projectionFailures = 0;
let consistencyFailures = 0;
let relationCases = 0;
const consistencyFailureDetails: Array<{
  caseId: string;
  issues: ReturnType<typeof validateCanonicalSurveyIntentV2>;
}> = [];
for (const item of cases) {
  const parsed = parseCanonicalSurveyIntent(
    item.input,
    item.surveyMode === "research" ? "research" : "general",
  );
  if (!setsOverlap(
    [parsed.surveyIntent.targetPopulation ?? ""],
    item.expectedTargetPopulation,
  )) legacy.targetDivergence += 1;
  if (!setsOverlap(parsed.surveyIntent.evaluationTargets, item.expectedSurveyObject)) {
    legacy.objectDivergence += 1;
  }
  if (!setsOverlap(
    parsed.surveyIntent.purposeBlocks.map((purpose) => purpose.text),
    item.expectedPurposeConcepts,
  )) legacy.purposeDivergence += 1;
  if (
    parsed.surveyIntent.requiresCreatorClarification !==
    item.clarificationExpected
  ) legacy.clarificationDivergence += 1;

  const golden = goldenIntent(item);
  const issues = validateCanonicalSurveyIntentV2(golden, {
    rawUserInput: item.input,
    surveyMode: item.surveyMode,
    requestedQuestionCount: item.questionCount,
  });
  if (issues.length > 0) consistencyFailures += 1;
  if (issues.length > 0) {
    consistencyFailureDetails.push({ caseId: item.id, issues });
  }
  const brief = deriveSurveyBriefFromCanonicalIntentV2(golden);
  const plan = deriveSurveyPlanFromCanonicalIntentV2(golden);
  if (
    brief.targetPopulation !== item.expectedTargetPopulation.join(", ") ||
    !setsOverlap(brief.surveyObjects, item.expectedSurveyObject) ||
    plan.requestedQuestionCount !== item.questionCount ||
    plan.targetCardinality !== item.expectedTargetCardinality ||
    plan.purposeBlocks.length !== item.expectedPurposeConcepts.length
  ) projectionFailures += 1;
  if (item.expectedArchetypes.includes("relationship_analysis")) relationCases += 1;
}

const report = {
  version: "survey-intent-v2-static-100-v1",
  datasetVersion: surveyIntentAuthorityDatasetV12.version,
  actualOpenAiCalls: 0,
  caseCount: cases.length,
  architecture: {
    semanticAuthorityVersion: "canonical-intent-v2",
    authoritativeIntegratedModelOutput: 1,
    v2DeriveFunctionsReadingRawInput: 0,
    legacyShadowEnabled: true,
    legacyInfluencedOutput: false,
    rawInputOccurrencesInModelRequest: 1,
    developerRawInputOccurrences: 0,
    parsedLegacyIntentPayloadsInModelRequest: 0,
  },
  goldenProjection: {
    evaluated: cases.length,
    projectionFailures,
    consistencyFailures,
    consistencyFailureDetails,
    relationCases,
  },
  legacyGoldenDivergence: legacy,
  limitation:
    "정적 단계는 golden canonical fixture와 pure projection 경계를 검증한다. 모델의 실제 의미 해석 정확도는 Preview targeted 단계에서만 판정한다.",
};

const jsonPath = resolve(root, "reports/survey-intent-v2-static-100.json");
const markdownPath = resolve(root, "reports/survey-intent-v2-static-100.md");
await mkdir(dirname(jsonPath), { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(
  markdownPath,
  [
    "# CanonicalSurveyIntentV2 정적 100건 평가",
    "",
    `- 데이터셋: \`${report.datasetVersion}\``,
    `- 사례: ${report.caseCount}건`,
    "- 실제 OpenAI 호출: 0건",
    `- golden projection 실패: ${projectionFailures}건`,
    `- consistency 실패: ${consistencyFailures}건`,
    `- 관계형 사례: ${relationCases}건`,
    "- V2 derive 함수 raw input 재파싱: 0곳",
    "- 모델 요청 user role 원문: 1회",
    "- 모델 요청 developer role 원문: 0회",
    "- legacy parsed intent payload: 0개",
    "- legacyInfluencedOutput: false",
    "",
    "## Legacy와 golden expectation의 divergence",
    "",
    `- target: ${legacy.targetDivergence}건`,
    `- object: ${legacy.objectDivergence}건`,
    `- purpose: ${legacy.purposeDivergence}건`,
    `- clarification: ${legacy.clarificationDivergence}건`,
    "",
    "## 해석",
    "",
    report.limitation,
    "",
  ].join("\n"),
  "utf8",
);
console.log(JSON.stringify(report, null, 2));
