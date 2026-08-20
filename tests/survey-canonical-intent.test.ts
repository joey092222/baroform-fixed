import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import {
  analyzeSurveyPrompt,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";
import {
  createSurveyPlan,
  evaluateSurveyPlanCoverage,
} from "../app/survey-planning";
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

test("관계형 fallback 보조 문항은 실제 연구 변수명을 사용한다", () => {
  const prompt =
    "직장인의 월 여가비와 문화생활 빈도 및 충동구매의 관계 조사";
  const canonical = parseCanonicalSurveyIntent(prompt);
  const plan = createSurveyPlan(canonical.surveyIntent, 7);
  const blueprint = analyzeSurveyPrompt(prompt, canonical);
  const titles = blueprint.aiQuestions.map((question) => question.title);
  const genericSupplementalBlocks = plan.blocks.filter((block) =>
    [
      "predictor-context",
      "outcome-driver",
      "measurement-regularity",
      "barrier-context",
      "open-evidence",
    ].includes(block.id),
  );

  assert.equal(titles.length, 7);
  assert.doesNotMatch(
    titles.join(" "),
    /앞에서 답한|선행 값|결과 값|측정값|요소\s*\d+/u,
  );
  assert.ok(titles.some((title) => /월 여가비.*달라지는/.test(title)));
  assert.ok(
    titles.some((title) =>
      /문화생활 빈도·충동구매.*영향/.test(title),
    ),
  );
  assert.ok(
    genericSupplementalBlocks.every(
      (block) => block.sourceEntityIds.length > 0,
    ),
  );
});

test("장소명이 생략된 통학 불편도 이동 경험으로 구조화한다", () => {
  const prompt = "다온대학교 학생의 통학 불편 조사";
  const canonical = parseCanonicalSurveyIntent(prompt);
  const blueprint = analyzeSurveyPrompt(prompt, canonical);
  const titles = blueprint.aiQuestions.map((item) => item.title).join(" ");

  assert.equal(canonical.audience?.text, "다온대학교 학생");
  assert.equal(canonical.surveyArchetype, "mobility_experience");
  assert.equal(canonical.generationContext.primaryEntity, "학교 통학");
  assert.equal(canonical.generationContext.entityType, "movement");
  assert.equal(canonical.generationContext.isUsageObject, false);
  assert.match(titles, /통학.*빈도/);
  assert.match(titles, /이동 수단/);
  assert.match(titles, /소요시간/);
  assert.match(titles, /혼잡/);
  assert.match(titles, /안전/);
  assert.match(titles, /불편/);
  assert.doesNotMatch(titles, /관련한 행동은 주로 어떤 상황/);
});

test("구체적 안전 수준 문항은 인식 block을 직접 측정한 것으로 인정한다", () => {
  const prompt =
    "새빛대학교 환경공학과 학생의 실험실 안전 인식과 개선 요구 조사";
  const canonical = parseCanonicalSurveyIntent(prompt);
  const plan = createSurveyPlan(canonical.surveyIntent, 7);
  const coverage = evaluateSurveyPlanCoverage(plan, [
    {
      id: 1,
      title: "현재 실험실의 안전 수준은 어느 정도라고 생각하나요?",
      type: "scale",
      measuredVariable: "perceived_safety_level",
      measuredConstruct: "실험실 안전 인식",
    },
  ]);

  assert.ok(coverage.coveredRequiredBlockIds.includes("variable-1"));
  assert.ok(!coverage.missingRequiredBlockIds.includes("variable-1"));
});

test("하나의 선행 변수가 복수 결과에 미치는 영향은 결과 변수를 각각 보존한다", () => {
  const prompt =
    "대학생의 월 용돈 규모가 외식 빈도와 충동구매에 미치는 영향";
  const canonical = parseCanonicalSurveyIntent(prompt, "research");
  const blueprint = analyzeSurveyPrompt(prompt, canonical);
  const variableNames = canonical.researchIntent.variables
    .filter((variable) => variable.scope === "respondent_level")
    .map((variable) => variable.name);
  const titles = blueprint.aiQuestions.map((question) => question.title);

  assert.equal(canonical.surveyArchetype, "relationship_analysis");
  assert.equal(canonical.objectKind, "relationship_analysis");
  assert.deepEqual(variableNames, ["월 용돈 규모", "외식 빈도", "충동구매"]);
  assert.equal(canonical.researchIntent.relations.length, 2);
  assert.ok(titles.some((title) => /월 용돈 규모/.test(title)));
  assert.ok(titles.some((title) => /외식.*얼마나 자주|외식 빈도/.test(title)));
  assert.ok(titles.some((title) => /충동구매/.test(title)));
  assert.doesNotMatch(
    titles.join(" "),
    /외식 빈도와 충동구매(?:는|가).*한(?:\s|$)/u,
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

test("부정 참여 조건을 포함한 긴 응답자 관형절은 가장 긴 응답자 범위로 보존한다", () => {
  const canonical = parseCanonicalSurveyIntent(
    "별가람 청년 워크숍에 참여하지 않은 신청자의 불참 이유와 다음 행사 참여 의향을 조사하고 싶다",
  );

  assert.equal(
    canonical.surveyIntent.targetPopulation,
    "별가람 청년 워크숍에 참여하지 않은 신청자",
  );
  assert.equal(canonical.surveyIntent.surveyObject, "별가람 청년 워크숍");
  assert.equal(canonical.surveyIntent.screeningRequired, true);
  assert.match(canonical.surveyIntent.eligibilityCondition ?? "", /참여하지 않은 신청자/u);
  assert.deepEqual(canonical.surveyIntent.constructs, [
    "불참 이유",
    "다음 행사 참여 의향",
  ]);
});

test("방문자 뒤에 분산된 목적 목록은 복수 대상이 아닌 한 장소의 조사 목적으로 해석한다", () => {
  const canonical = parseCanonicalSurveyIntent(
    "푸른솔 문화센터 방문자의 방문 목적, 이용 빈도, 불편 및 개선 요구를 조사하고 싶다",
  );

  assert.equal(canonical.surveyIntent.targetPopulation, "푸른솔 문화센터 방문자");
  assert.equal(canonical.surveyIntent.surveyObject, "푸른솔 문화센터");
  assert.equal(canonical.surveyIntent.intentMode, "single");
  assert.deepEqual(canonical.surveyIntent.evaluationTargets, ["푸른솔 문화센터"]);
  assert.deepEqual(canonical.surveyIntent.constructs, [
    "방문 목적",
    "이용 빈도",
    "불편",
    "개선 요구",
  ]);
});
