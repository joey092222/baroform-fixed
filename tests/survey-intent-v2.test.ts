import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildSurveyAiRequestV2,
  inspectSurveyIntentV2RequestAuthority,
  parseSurveyDraftResponseV2,
} from "../app/survey-ai";
import {
  canonicalSurveyIntentV2Schema,
  deriveSurveyBriefFromCanonicalIntentV2,
  deriveSurveyPlanFromCanonicalIntentV2,
  normalizeCanonicalSurveyIntentV2EvidenceSpans,
  validateCanonicalSurveyIntentV2,
  type CanonicalSurveyIntentV2,
} from "../app/survey-intent-v2";
import { createSurveyGenerationV2Schema } from "../app/lib/ai/survey-generation-schema";
import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { auditedSurveyRegressionDatasetSchema } from "../evals/survey-regression/v1.1/schema";
import { surveyIntentAuthorityDatasetV12 } from "../evals/survey-regression/v1.2/manifest";
import { intentV2TargetedCases } from "../evals/survey-regression/v1.2/intent-v2-targeted";

const prompt = "연세대학교 학생들의 대우관 등하교 경험을 조사하고 싶다";

function span(
  text: string,
  role:
    | "target_population"
    | "eligibility"
    | "context_entity"
    | "survey_object"
    | "activity"
    | "purpose"
    | "predictor"
    | "outcome"
    | "comparison_target"
    | "timeframe"
    | "negation",
) {
  const start = prompt.indexOf(text);
  assert.notEqual(start, -1, `fixture evidence '${text}' must exist`);
  return {
    text,
    start,
    end: start + text.length,
    normalized_form: text,
    role,
    provenance: "user_explicit" as const,
  };
}

function intentFixture(): CanonicalSurveyIntentV2 {
  const targetEvidence = span("연세대학교 학생들", "target_population");
  const objectEvidence = span("대우관", "survey_object");
  const activityEvidence = span("등하교 경험", "activity");
  const purposeEvidence = span("대우관 등하교 경험", "purpose");
  return canonicalSurveyIntentV2Schema.parse({
    version: "2",
    raw_user_input: prompt,
    normalized_user_input: prompt,
    target_population: {
      display_text: "연세대학교 학생들",
      head: "학생들",
      qualifiers: ["연세대학교"],
      institution: "연세대학교",
      grade: null,
      inclusion_conditions: [],
      exclusion_conditions: [],
      evidence: [targetEvidence],
      confidence: 0.99,
      provenance: "user_explicit",
    },
    eligibility_conditions: [],
    context_entities: [
      {
        id: "context-daewoo",
        name: "대우관",
        entity_type: "university_building",
        role: "이동 맥락",
        evidence: [objectEvidence],
        confidence: 0.99,
        provenance: "user_explicit",
      },
    ],
    survey_objects: [
      {
        id: "object-daewoo-mobility",
        name: "대우관 등하교 경험",
        entity_type: "mobility",
        is_usage_object: false,
        candidate_names: ["대우관을 오가는 이동 경험"],
        evidence: [objectEvidence, activityEvidence],
        confidence: 0.98,
        provenance: "user_explicit",
      },
    ],
    activities: [
      {
        id: "activity-commute",
        text: "대우관을 오가는 이동",
        activity_type: "move",
        object_ids: ["object-daewoo-mobility"],
        evidence: [activityEvidence],
        confidence: 0.98,
        provenance: "user_explicit",
      },
    ],
    target_cardinality: "single",
    purposes: [
      {
        id: "purpose-mobility",
        text: "대우관 등하교 경험 파악",
        purpose_type: "behavior_usage",
        object_ids: ["object-daewoo-mobility"],
        construct_names: ["이동 빈도", "이동 불편"],
        required: true,
        evidence: [purposeEvidence],
        confidence: 0.96,
        provenance: "model_inferred",
      },
    ],
    relationships: [],
    explicit_timeframe: null,
    negation_constraints: [],
    survey_mode: "standard",
    requested_question_count: 2,
    clarification: {
      required: false,
      missing_roles: [],
      ambiguity_reasons: [],
      question: null,
    },
    evidence: [targetEvidence, objectEvidence, activityEvidence, purposeEvidence],
    confidence: 0.97,
    provenance: "model_inferred",
  });
}

function option(id: string, label: string) {
  return {
    id,
    label,
    exclusive: false,
    fixed_position: false,
    allows_text: false,
  };
}

function responseFixture() {
  const intent = intentFixture();
  const generation = createSurveyGenerationV2Schema(2).parse({
    status: "ready_with_caution",
    canonical_intent_v2: intent,
    research: {
      search_status: "failed",
      entities: [],
      sources: [],
      limitations: ["외부 사실 확인이 필요하지 않은 일반 설문입니다."],
    },
    survey_plan: {
      survey_type: "이동 경험 조사",
      target: "연세대학교 학생들",
      eligibility: "연세대학교 학생들",
      primary_objective: "대우관 등하교 경험 파악",
      sub_objectives: ["이동 빈도", "이동 불편"],
      constructs: [
        { name: "이동 빈도", reason: "대우관을 오가는 정도를 측정함." },
        { name: "이동 불편", reason: "이동 과정의 불편을 측정함." },
      ],
      requested_question_count: 2,
      count_rule: "max_path",
      total_question_nodes: 2,
      min_path_questions: 2,
      max_path_questions: 2,
      estimated_minutes: 2,
    },
    survey: {
      title: "연세대학교 학생 대우관 등하교 경험 조사",
      intro: "대우관을 오가는 과정의 빈도와 불편을 알아보는 설문입니다.",
      sections: [
        { id: "section-mobility", title: "등하교 경험", description: null },
      ],
      questions: [
        {
          id: "question-frequency",
          section_id: "section-mobility",
          role: "behavior",
          type: "single_choice",
          text: "평소 대우관을 얼마나 자주 오가나요?",
          helper_text: null,
          required: true,
          reference_period: null,
          options: [
            option("frequency-1", "거의 매일"),
            option("frequency-2", "주 2~3회"),
            option("frequency-3", "주 1회 이하"),
          ],
          scale: null,
          randomize_options: false,
          show_if: [],
          validation: {
            min_value: null,
            max_value: null,
            min_selections: null,
            max_selections: null,
            max_length: null,
          },
          analysis: {
            construct: "이동 빈도",
            purpose: "대우관을 오가는 빈도를 측정함.",
            variable_name: "대우관 이동 빈도",
            coding_notes: null,
          },
          grounding: { uses_external_fact: false, source_ids: [] },
          purpose_ids: ["purpose-mobility"],
          object_ids: ["object-daewoo-mobility"],
          relationship_ids: [],
        },
        {
          id: "question-discomfort",
          section_id: "section-mobility",
          role: "barrier",
          type: "multiple_choice",
          text: "대우관을 오갈 때 겪는 불편은 무엇인가요?",
          helper_text: null,
          required: true,
          reference_period: null,
          options: [
            option("barrier-1", "이동 시간이 오래 걸림"),
            option("barrier-2", "혼잡함"),
            option("barrier-3", "안전이 걱정됨"),
          ],
          scale: null,
          randomize_options: true,
          show_if: [],
          validation: {
            min_value: null,
            max_value: null,
            min_selections: 1,
            max_selections: 3,
            max_length: null,
          },
          analysis: {
            construct: "이동 불편",
            purpose: "대우관 이동 과정에서 겪는 불편을 측정함.",
            variable_name: "대우관 이동 불편",
            coding_notes: null,
          },
          grounding: { uses_external_fact: false, source_ids: [] },
          purpose_ids: ["purpose-mobility"],
          object_ids: ["object-daewoo-mobility"],
          relationship_ids: [],
        },
      ],
      completion_message: "응답해주셔서 감사합니다.",
    },
    quality_check: {
      all_named_entities_searched: true,
      all_specific_claims_grounded: true,
      all_questions_have_analysis_purpose: true,
      double_barreled_questions_removed: true,
      leading_questions_removed: true,
      duplicate_questions_removed: true,
      response_options_checked: true,
      all_logic_paths_valid: true,
      question_count_valid: true,
      mobile_readability_checked: true,
      respondent_path_simulation_passed: true,
      warnings: [],
    },
  });
  return {
    status: "completed",
    incomplete_details: null,
    output_parsed: generation,
    output: [
      {
        type: "message",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(generation),
            annotations: [],
          },
        ],
      },
    ],
  };
}

test("V2 request는 사용자 원문을 user role에 정확히 한 번만 전달한다", () => {
  const request = buildSurveyAiRequestV2(prompt, "gpt-test", {
    surveyMode: "standard",
    targetGrade: "전학년",
    questionCount: 2,
  });
  const diagnostics = inspectSurveyIntentV2RequestAuthority(request, prompt);
  assert.deepEqual(diagnostics, {
    rawInputOccurrencesInRequest: 1,
    userRoleRawInputOccurrences: 1,
    developerRawInputOccurrences: 0,
    parsedIntentPayloadCount: 0,
    semanticAuthorityVersion: "canonical-intent-v2",
    legacyShadowEnabled: true,
    legacyInfluencedOutput: false,
  });
  const requestText = JSON.stringify(request.input);
  assert.doesNotMatch(requestText, /CanonicalSurveyIntent\]/);
  assert.doesNotMatch(requestText, /구조화된 설문 의도/);
  assert.doesNotMatch(requestText, /역할 기반 설문 계획/);
});

test("canonical V2의 brief와 plan은 raw input 재파싱 없이 pure projection된다", () => {
  const intent = intentFixture();
  const brief = deriveSurveyBriefFromCanonicalIntentV2(intent);
  const plan = deriveSurveyPlanFromCanonicalIntentV2(intent);
  assert.equal(brief.targetPopulation, "연세대학교 학생들");
  assert.deepEqual(brief.surveyObjects, ["대우관 등하교 경험"]);
  assert.equal(plan.targetPopulation, "연세대학교 학생들");
  assert.deepEqual(plan.evaluationTargets, ["대우관 등하교 경험"]);
  assert.equal(plan.intentKind, "behavior_usage");
  assert.ok(plan.blocks.some((item) => item.variable === "이동 빈도"));
  assert.ok(plan.blocks.some((item) => item.variable === "이동 불편"));
});

test("canonical V2 consistency layer는 evidence와 UI hard constraint를 검증한다", () => {
  const valid = intentFixture();
  assert.deepEqual(
    validateCanonicalSurveyIntentV2(valid, {
      rawUserInput: prompt,
      surveyMode: "standard",
      requestedQuestionCount: 2,
    }),
    [],
  );
  const invalid = structuredClone(valid);
  invalid.target_population.evidence[0].start += 1;
  invalid.requested_question_count = 3;
  const issues = validateCanonicalSurveyIntentV2(invalid, {
    rawUserInput: prompt,
    surveyMode: "standard",
    requestedQuestionCount: 2,
  });
  assert.ok(issues.some((item) => item.code === "EVIDENCE_TEXT_MISMATCH"));
  assert.ok(issues.some((item) => item.code === "REQUEST_CONSTRAINT_MISMATCH"));
});

test("V2 evidence 좌표는 원문에 존재하는 동일 텍스트에 한해 metadata-only로 정규화한다", () => {
  const shifted = intentFixture();
  for (const evidence of shifted.evidence) {
    evidence.start = 0;
    evidence.end = evidence.text.length;
  }
  const normalized = normalizeCanonicalSurveyIntentV2EvidenceSpans(
    shifted,
    prompt,
  );
  assert.ok(normalized.normalizedPaths.length > 0);
  assert.deepEqual(
    validateCanonicalSurveyIntentV2(normalized.intent, {
      rawUserInput: prompt,
      surveyMode: "standard",
      requestedQuestionCount: 2,
    }),
    [],
  );

  const invented = intentFixture();
  invented.evidence[0].text = "원문에 없는 응답 대상";
  invented.evidence[0].start = 0;
  invented.evidence[0].end = invented.evidence[0].text.length;
  const untouched = normalizeCanonicalSurveyIntentV2EvidenceSpans(
    invented,
    prompt,
  );
  assert.equal(untouched.normalizedPaths.length, 0);
  assert.ok(
    validateCanonicalSurveyIntentV2(untouched.intent, {
      rawUserInput: prompt,
      surveyMode: "standard",
      requestedQuestionCount: 2,
    }).some((item) => item.code === "EVIDENCE_TEXT_MISMATCH"),
  );
});

test("V2 응답은 legacy parser나 fallback 없이 canonical intent에서 UI blueprint를 만든다", () => {
  const result = parseSurveyDraftResponseV2(
    responseFixture(),
    {
      prompt,
      surveyMode: "standard",
      questionCount: 2,
      targetGrade: "전학년",
      expectsReferences: false,
    },
  );
  assert.notEqual(result.status, "needs_clarification");
  if (result.status === "needs_clarification") return;
  assert.equal(result.semanticAuthorityVersion, "canonical-intent-v2");
  assert.equal(result.legacyInfluencedOutput, false);
  assert.equal(result.blueprint.respondentGroup, "연세대학교 학생들");
  assert.equal(result.blueprint.evaluationTarget, "대우관 등하교 경험");
  assert.deepEqual(
    result.blueprint.aiQuestions.map((item) => item.title),
    [
      "평소 대우관을 얼마나 자주 오가나요?",
      "대우관을 오갈 때 겪는 불편은 무엇인가요?",
    ],
  );
  assert.equal(result.canonicalPlan?.intentKind, "behavior_usage");
});

test("V2 semantic module과 projection module에는 legacy raw parser import가 없다", async () => {
  const source = await readFile(
    new URL("../app/survey-intent-v2.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /parseSurveyGenerationContext/);
  assert.doesNotMatch(source, /parseSurveyBrief/);
  assert.doesNotMatch(source, /parseSurveyIntent/);
  assert.doesNotMatch(source, /parseCanonicalSurveyIntent/);
  assert.doesNotMatch(source, /analyzeSurveyPrompt/);
  assert.doesNotMatch(source, /createSurveyPlan/);
});

test("V2 route는 모델 연결이 없을 때 legacy hard fallback을 성공으로 반환하지 않는다", async () => {
  const previous = {
    feature: process.env.BAROFORM_INTENT_PIPELINE_V2,
    key: process.env.OPENAI_API_KEY,
    mock: process.env.AI_MOCK_MODE,
  };
  process.env.BAROFORM_INTENT_PIPELINE_V2 = "true";
  delete process.env.OPENAI_API_KEY;
  process.env.AI_MOCK_MODE = "false";
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({
          prompt,
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 2,
        }),
      }),
    );
    const body = (await response.json()) as {
      ok?: boolean;
      type?: string;
      code?: string;
      fallbackReason?: string | null;
    };
    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.type, "error");
    assert.equal(body.code, "SURVEY_INTENT_V2_AI_UNAVAILABLE");
    assert.equal(response.headers.get("x-baroform-semantic-authority"), "canonical-intent-v2");
    assert.equal(response.headers.get("x-baroform-ai-mode"), null);
  } finally {
    if (previous.feature === undefined) delete process.env.BAROFORM_INTENT_PIPELINE_V2;
    else process.env.BAROFORM_INTENT_PIPELINE_V2 = previous.feature;
    if (previous.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous.key;
    if (previous.mock === undefined) delete process.env.AI_MOCK_MODE;
    else process.env.AI_MOCK_MODE = previous.mock;
  }
});

test("v1.2 의미 권한 감사본은 동일한 100개 golden expectation을 내용 해시로 동결한다", async () => {
  const entries = [
    ["dev", surveyIntentAuthorityDatasetV12.sourceFiles.dev, surveyIntentAuthorityDatasetV12.sha256.dev, 80],
    ["holdout", surveyIntentAuthorityDatasetV12.sourceFiles.holdout, surveyIntentAuthorityDatasetV12.sha256.holdout, 20],
  ] as const;
  let total = 0;
  for (const [split, relativePath, expectedHash, expectedCount] of entries) {
    const raw = await readFile(new URL(`../${relativePath}`, import.meta.url));
    assert.equal(createHash("sha256").update(raw).digest("hex"), expectedHash);
    const dataset = auditedSurveyRegressionDatasetSchema.parse(
      JSON.parse(raw.toString("utf8")),
    );
    assert.equal(dataset.split, split);
    assert.equal(dataset.cases.length, expectedCount);
    for (const item of dataset.cases) {
      assert.ok(item.inputQuality);
      assert.ok(item.expectedOutcome);
      assert.ok(item.expectedTargetPopulation.length > 0);
      assert.ok(item.expectedSurveyObject.length > 0);
      assert.ok(item.expectedPurposeConcepts.length > 0);
      assert.ok(Array.isArray(item.expectedEligibilityConditions));
      assert.ok(Array.isArray(item.contextEntities));
      assert.equal(item.clarificationExpected, item.expectedOutcome === "clarification");
      if (item.mustPreserveNegation) assert.ok(item.tags.includes("negation"));
      if (item.tags.includes("timeframe")) assert.ok(item.mustPreserveTerms.length > 0);
    }
    total += dataset.cases.length;
  }
  assert.equal(total, surveyIntentAuthorityDatasetV12.counts.total);
  assert.equal(surveyIntentAuthorityDatasetV12.expectationChanges, 0);
});

test("V2 architecture targeted 세트는 지정된 24건 구성과 경계를 고정한다", () => {
  const counts = Object.fromEntries(
    [
      "past_distortion",
      "negation",
      "multiple_purposes",
      "multiple_targets",
      "relationship",
      "clarification",
      "noisy",
    ].map((cluster) => [
      cluster,
      intentV2TargetedCases.filter(
        (item) => item.category === `intent_v2_${cluster}`,
      ).length,
    ]),
  );
  assert.equal(intentV2TargetedCases.length, 24);
  assert.deepEqual(counts, {
    past_distortion: 5,
    negation: 4,
    multiple_purposes: 4,
    multiple_targets: 3,
    relationship: 3,
    clarification: 3,
    noisy: 2,
  });
  assert.equal(new Set(intentV2TargetedCases.map((item) => item.id)).size, 24);
  assert.equal(
    intentV2TargetedCases.filter((item) => item.mustPreserveNegation).length,
    5,
  );
  assert.equal(
    intentV2TargetedCases.filter((item) => item.clarificationExpected).length,
    3,
  );
  assert.ok(
    intentV2TargetedCases.some((item) => item.tags.includes("non_university")),
  );
  assert.ok(
    intentV2TargetedCases.some((item) => item.tags.includes("virtual_entity")),
  );
});

test("V2 live evaluator는 legacy 재파싱이 아니라 응답 canonical intent를 읽는다", async () => {
  const source = await readFile(
    new URL("../scripts/run-survey-regression-live.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /record\(body\.canonicalIntentV2\)/);
  assert.match(source, /semanticAuthorityVersion === "canonical-intent-v2"/);
  assert.match(source, /legacyInfluencedOutput: v2\.legacyInfluencedOutput/);
  assert.match(source, /canonicalPurposeConcepts: v2\.purposes/);
  assert.match(source, /legacyV2Divergence: v2\.legacyV2Divergence/);
  assert.match(source, /const legacyCanonical = useV2Authority\s*\? null/);
});
