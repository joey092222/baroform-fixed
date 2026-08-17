import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import {
  analyzeSurveyPrompt,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";
import { createSurveyPlan } from "../app/survey-planning";
import { parseSurveyResearchIntentCore } from "../app/survey-research-intent-core";

const productionFailurePrompt =
  "대학생들의 소비 습관과 용돈 간의 상관관계 조사";

const relationshipPrompts = [
  "대학생들의 소비 습관과 용돈의 관계 조사",
  "대학생들의 소비 습관과 용돈 간 관계 조사",
  "대학생들의 소비 습관과 용돈 간의 관계 조사",
  "대학생들의 소비 습관과 용돈의 상관관계 조사",
  "대학생들의 소비 습관과 용돈 간 상관관계 조사",
  "대학생들의 소비 습관과 용돈 간의 상관관계 조사",
  "대학생들의 소비 습관과 용돈 사이의 관계 조사",
  "대학생들의 소비 습관과 용돈 사이의 상관관계 조사",
  "대학생들의 소비 습관과 용돈의 연관성 조사",
  "대학생들의 소비 습관과 용돈 간 연관성 조사",
  "대학생들의 소비 습관과 용돈 사이의 연관성 조사",
];

test("관계 조사 문법 변형은 동일한 canonical 변수와 관계로 수렴한다", () => {
  const canonicalIntents = relationshipPrompts.map((prompt) =>
    parseCanonicalSurveyIntent(prompt),
  );

  for (const canonical of canonicalIntents) {
    assert.equal(canonical.surveyArchetype, "relationship_analysis");
    assert.equal(canonical.objectKind, "relationship_analysis");
    assert.equal(canonical.audience?.text, "대학생");
    assert.deepEqual(
      canonical.researchIntent.variables.map((variable) => variable.name),
      ["소비 습관", "용돈"],
    );
    assert.equal(canonical.relations.length, 1);
    assert.equal(canonical.relations[0]?.type, "association");
    assert.equal(canonical.ambiguity.requiresClarification, false);
    assert.doesNotMatch(
      canonical.researchIntent.analysisGoals[0]?.description ?? "",
      /용돈\s*(?:간의|사이의|의의)/,
    );
  }
});

test("소비 습관과 용돈은 다차원 행동·금액 구성개념으로 조작화된다", () => {
  const canonical = parseCanonicalSurveyIntent(productionFailurePrompt);
  const consumption = canonical.constructs.find(
    (construct) => construct.name === "소비 습관",
  );
  const allowance = canonical.constructs.find(
    (construct) => construct.name === "용돈",
  );
  const plan = createSurveyPlan(canonical.surveyIntent, 7);
  const planCorpus = plan.blocks
    .map((block) => `${block.variable} ${block.purpose} ${block.analysisUsage}`)
    .join(" ");

  assert.equal(consumption?.kind, "consumption_behavior");
  assert.equal(consumption?.measurementMode, "behavior_index");
  assert.deepEqual(
    consumption?.dimensions
      .filter((dimension) => dimension.required)
      .map((dimension) => dimension.name),
    ["소비 계획 빈도", "충동 구매 빈도", "저축 또는 예산 압박"],
  );
  assert.equal(allowance?.kind, "monetary_resource");
  assert.match(planCorpus, /월평균 용돈 금액/);
  assert.match(planCorpus, /용돈 지급 규칙/);
  assert.ok(plan.blocks.some((block) => block.kind === "analysis"));
});

test("관계형 fallback은 canonical SurveyPlan의 필수 측정 차원을 그대로 구현한다", () => {
  const prompt = productionFailurePrompt;
  const canonical = parseCanonicalSurveyIntent(prompt);
  const blueprint = analyzeSurveyPrompt(prompt, canonical);
  const measuredVariables = blueprint.aiQuestions.map(
    (question) => question.measuredVariable,
  );

  assert.deepEqual(validateSurvey(prompt, parseSurveyBrief(prompt, canonical), blueprint), []);
  assert.deepEqual(measuredVariables.slice(0, 5), [
    "소비 계획 빈도",
    "충동 구매 빈도",
    "저축 또는 예산 압박",
    "월평균 용돈 금액",
    "용돈 지급 규칙",
  ]);
  assert.ok(
    blueprint.aiQuestions.every(
      (question) => question.planBlockId && question.measuredEntityIds?.length,
    ),
  );
  assert.doesNotMatch(
    blueprint.aiQuestions.map((question) => question.title).join(" "),
    /관계(?:를|가)\s*(?:얼마나|어느)|상관관계를\s*묻/,
  );
});

test("실제 POST 경로도 canonical plan fallback으로 관계 설문을 완성한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousMockMode = process.env.AI_MOCK_MODE;
  delete process.env.OPENAI_API_KEY;
  process.env.AI_MOCK_MODE = "true";
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-canonical-intent-regression",
        },
        body: JSON.stringify({
          prompt: productionFailurePrompt,
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      requestId?: string;
      status?: string;
      code?: string;
      stage?: string;
      blueprint?: ReturnType<typeof analyzeSurveyPrompt>;
    };
    const titles = body.blueprint?.aiQuestions.map((item) => item.title) ?? [];

    assert.equal(response.status, 200, JSON.stringify(body));
    assert.match(body.status ?? "", /^ready/);
    assert.equal(body.requestId, response.headers.get("x-baroform-request-id"));
    assert.equal(titles.length, 7);
    assert.ok(titles.some((title) => /소비 계획.*얼마나 자주/.test(title)));
    assert.ok(titles.some((title) => /충동 구매.*얼마나 자주/.test(title)));
    assert.ok(titles.some((title) => /예산 압박/.test(title)));
    assert.ok(titles.some((title) => /월평균 용돈 금액/.test(title)));
    assert.ok(titles.some((title) => /용돈 지급 규칙/.test(title)));
    assert.doesNotMatch(titles.join(" "), /상관관계를\s*(?:얼마나|직접)/);
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
    if (previousMockMode === undefined) delete process.env.AI_MOCK_MODE;
    else process.env.AI_MOCK_MODE = previousMockMode;
  }
});

test("음식 범주 질문은 category_set과 consumption_behavior로 해석된다", () => {
  const canonical = parseCanonicalSurveyIntent(
    "연세대 학생들이 어떤 음식을 자주 먹는지 알아볼래",
  );
  const plan = createSurveyPlan(canonical.surveyIntent, 7);

  assert.equal(canonical.audience?.text, "연세대 학생");
  assert.equal(canonical.surveyArchetype, "consumption_behavior");
  assert.equal(canonical.objectKind, "consumption_behavior");
  assert.ok(
    canonical.entities.some(
      (entity) => entity.text === "음식" && entity.kind === "category_set",
    ),
  );
  assert.ok(
    canonical.activities.some(
      (activity) => activity.kind === "consume" && activity.text.includes("음식"),
    ),
  );
  assert.ok(plan.blocks.some((block) => block.id === "category-selection"));
  assert.ok(plan.blocks.some((block) => block.id === "behavior-frequency"));
});

test("단과대학 조직과 건물·시설은 후보 근거에 따라 분리된다", () => {
  const organization = parseCanonicalSurveyIntent(
    "경영대에 대한 연세대 경영대생들의 만족도",
  );
  const facility = parseCanonicalSurveyIntent(
    "연세대 경영관 시설에 대한 경영대생들의 만족도",
  );

  assert.equal(organization.audience?.text, "연세대 경영대생");
  assert.equal(organization.objectKind, "academic_organization");
  assert.equal(organization.generationContext.entityType, "academic_organization");
  assert.ok(
    organization.entities.some(
      (entity) =>
        entity.text === "경영대" && entity.kind === "academic_organization",
    ),
  );
  assert.ok(
    organization.ambiguity.candidates.some((candidate) =>
      candidate.evidence.some((evidence) => evidence.includes("응답자 소속")),
    ),
  );

  assert.equal(facility.audience?.text, "경영대생");
  assert.equal(facility.objectKind, "place_facility");
  assert.equal(facility.generationContext.entityType, "facility");
  assert.ok(
    facility.entities.some(
      (entity) => entity.text.includes("경영관 시설") && entity.kind === "facility",
    ),
  );
});

test("관계 단서가 있는데 구조화 추출에 실패하면 빈 계획 대신 clarification이 된다", () => {
  const research = parseSurveyResearchIntentCore(
    "첫 번째 요인과 두 번째 요인 간의 상관관계를 조사해줘",
    { relationParser: () => null },
  );

  assert.equal(research.relationCueDetected, true);
  assert.equal(
    research.parseFailureCode,
    "RELATION_EXPRESSION_DETECTED_BUT_NOT_PARSED",
  );
  assert.equal(research.needsClarification, true);
  assert.equal(research.ambiguityLevel, "high");
  assert.deepEqual(research.relations, []);
});
