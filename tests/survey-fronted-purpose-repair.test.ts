import assert from "node:assert/strict";
import test from "node:test";

import {
  repairInvalidQuestions,
  restoreMissingRequiredPlanBlocks,
} from "../app/survey-ai";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import {
  analyzeSurveyPrompt,
  directlyMeasuresOverallSatisfaction,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";
import {
  createSurveyPlan,
  evaluateSurveyPlanCoverage,
} from "../app/survey-planning";
import { validateSurveyIntentCandidate } from "../app/survey-semantic-intent";

test("fronted purpose fallback은 응답자 존재가 아니라 실제 적격 조건을 확인한다", () => {
  const fixtures = [
    "새 기능 만족도는 누리 앱을 최근 3개월 사용한 대학생에게 조사",
    "프로그램 만족도는 새길 교육에 이번 학기 참여한 학부모에게 조사",
    "신제품 만족도는 온빛 상점에서 최근 한 달 구매한 고객에게 조사",
  ];

  for (const input of fixtures) {
    const canonical = parseCanonicalSurveyIntent(input);
    const fallback = analyzeSurveyPrompt(input, canonical);
    const first = fallback.aiQuestions[0];

    assert.ok(first, input);
    assert.match(
      first.title,
      /해당하시나요|사용한 적|참여(?:한 적|했나요)|구매한 적/,
    );
    assert.doesNotMatch(first.title, /(?:대학생|학부모|고객)(?:이|가) 있나요/);
    assert.match(first.title, /최근 3개월|이번 학기|최근 한 달/);
    assert.equal(fallback.respondentGroup, canonical.surveyIntent.targetPopulation);
    assert.equal(fallback.evaluationTarget, canonical.surveyIntent.surveyObject);
  }
});

test("만족도 응답 척도가 명확한 자연스러운 평가 문항은 추가 repair하지 않는다", () => {
  const input = "새 메뉴 만족도는 한결 카페를 최근 한 달 이용한 주민에게 조사";
  const canonical = parseCanonicalSurveyIntent(input);
  const fallback = analyzeSurveyPrompt(input, canonical);
  const directSatisfaction = fallback.aiQuestions.find((item) =>
    /전반적으로.*만족/.test(item.title),
  );
  const nonSatisfaction = fallback.aiQuestions.find((item) =>
    /기대한 수준/.test(item.title),
  );
  assert.ok(directSatisfaction);
  assert.ok(nonSatisfaction);

  const questions = fallback.aiQuestions.map((item) => ({ ...item }));
  questions[1] = { ...nonSatisfaction, id: 2 };
  questions[4] = {
    ...directSatisfaction,
    id: 5,
    title: "먹어 본 새 메뉴는 전반적으로 어땠나요?",
    type: "single",
    options: [
      "매우 만족스러웠음",
      "만족스러운 편이었음",
      "보통이었음",
      "만족스럽지 않은 편이었음",
      "전혀 만족스럽지 않았음",
    ],
  };
  const modelSurvey = {
    ...fallback,
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
  };
  const qualityIssues = validateSurvey(
    input,
    parseSurveyBrief(input, canonical),
    modelSurvey,
  ).filter((issue) => issue.includes("전반적 만족도를 직접 측정"));
  assert.deepEqual(qualityIssues, []);
  const repaired = repairInvalidQuestions({
    survey: modelSurvey,
    intent: canonical.surveyIntent,
    plan: createSurveyPlan(canonical.surveyIntent, 7),
    qualityIssues,
    violations: [],
    getFallback: () => fallback,
  });

  assert.deepEqual(repaired.repairedQuestionIds, []);
  for (const index of [0, 1, 2, 3, 4, 5, 6]) {
    assert.deepEqual(repaired.survey.aiQuestions[index], modelSurvey.aiQuestions[index]);
  }
});

test("만족도 coverage는 중요도·재이용 의향을 직접 만족도로 오인하지 않는다", () => {
  assert.equal(
    directlyMeasuresOverallSatisfaction({
      title: "새 메뉴에서 가장 중요하게 생각하는 요소는 무엇인가요?",
      type: "multiple",
      options: ["맛", "가격", "양", "기타"],
      reason: "개선 우선순위를 파악함.",
    }),
    false,
  );
  assert.equal(
    directlyMeasuresOverallSatisfaction({
      title: "새 메뉴를 다시 이용할 의향이 있나요?",
      type: "scale",
      scaleMinLabel: "전혀 없음",
      scaleMaxLabel: "매우 높음",
      measuredVariable: "재이용 의향",
      reason: "향후 이용 의향을 측정함.",
    }),
    false,
  );
  assert.equal(
    directlyMeasuresOverallSatisfaction({
      title: "이용한 새 메뉴는 종합적으로 어땠나요?",
      type: "single",
      options: [
        "매우 만족했음",
        "만족한 편이었음",
        "보통이었음",
        "만족하지 않은 편이었음",
        "전혀 만족하지 않았음",
      ],
      measuredVariable: "새 메뉴 전반적 만족도",
      reason: "전반적 만족도를 측정함.",
    }),
    true,
  );
});

test("구어체 복수 세부평가는 대상·차원·전반적 만족도를 분리한다", () => {
  const input = "맛나샘 학생들 맛 서비스 둘다 어떤지 불편도";
  const canonical = parseCanonicalSurveyIntent(input);
  const fallback = analyzeSurveyPrompt(input, canonical);
  const plan = createSurveyPlan(canonical.surveyIntent, 7);

  assert.equal(canonical.surveyIntent.targetPopulation, "맛나샘 이용 학생");
  assert.equal(canonical.surveyIntent.surveyObject, "맛나샘");
  assert.deepEqual(canonical.surveyIntent.constructs, [
    "맛 만족도",
    "서비스 만족도",
    "전반적 만족도",
    "불편",
  ]);
  assert.ok(plan.blocks.some((item) => item.id === "overall-satisfaction"));
  assert.ok(
    fallback.aiQuestions.some((item) =>
      directlyMeasuresOverallSatisfaction(item),
    ),
  );
});

test("세부 만족도만 있는 설문은 보조 문항 하나를 전반적 만족도로 교체한다", () => {
  const inputs = [
    "누리 앱의 기능 만족도와 불편 조사",
    "솔빛관 시설 만족도와 불편 조사",
    "새길 행사 만족도와 불편 조사",
    "통계학 수업 만족도와 불편 조사",
    "한결 제품 만족도와 불편 조사",
  ];

  for (const input of inputs) {
    const canonical = parseCanonicalSurveyIntent(input);
    const fallback = analyzeSurveyPrompt(input, canonical);
    const plan = createSurveyPlan(canonical.surveyIntent, 7);
    const directIndex = fallback.aiQuestions.findIndex((item) =>
      directlyMeasuresOverallSatisfaction(item),
    );
    assert.ok(directIndex >= 0, input);
    const questions = fallback.aiQuestions.map((item) => ({
      ...item,
      options: item.options ? [...item.options] : undefined,
    }));
    questions[directIndex] = {
      ...questions[directIndex],
      title: "세부 기능의 편리함에 얼마나 만족하시나요?",
      measuredConstruct: "기능 편리성 만족도",
      measuredVariable: "기능 편리성 만족도",
      questionPurpose: "세부 기능의 편리성을 평가함.",
      reason: "세부 기능의 편리성을 평가함.",
    };
    const modelSurvey = {
      ...fallback,
      templateQuestions: questions.slice(0, 5),
      aiQuestions: questions,
    };
    const initial = evaluateSurveyPlanCoverage(plan, modelSurvey.aiQuestions);
    assert.ok(initial.missingRequiredBlockIds.includes("overall-satisfaction"), input);

    const repaired = restoreMissingRequiredPlanBlocks({
      survey: modelSurvey,
      intent: canonical.surveyIntent,
      plan,
      getFallback: () => fallback,
    });

    assert.equal(repaired.survey.aiQuestions.length, questions.length, input);
    assert.equal(repaired.repairedQuestionIds.length, 1, input);
    assert.ok(
      repaired.survey.aiQuestions.some((item) =>
        directlyMeasuresOverallSatisfaction(item),
      ),
      input,
    );
    assert.deepEqual(repaired.finalCoverage.missingRequiredBlockIds, [], input);
  }
});

test("중복 문항 repair는 canonical 위치의 조사 목적을 복구하고 정상 문항을 보존한다", () => {
  const input = "새 기능 만족도는 누리 앱을 최근 3개월 사용한 대학생에게 조사";
  const canonical = parseCanonicalSurveyIntent(input);
  const fallback = analyzeSurveyPrompt(input, canonical);
  const questions = fallback.aiQuestions.map((item) => ({
    ...item,
    options: item.options ? [...item.options] : undefined,
  }));
  assert.ok(questions[1]);
  assert.ok(questions[2]);
  questions[2] = {
    ...questions[1],
    id: questions[2].id,
  };
  const modelSurvey = {
    ...fallback,
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
  };
  const repaired = repairInvalidQuestions({
    survey: modelSurvey,
    intent: canonical.surveyIntent,
    plan: createSurveyPlan(canonical.surveyIntent, 7),
    qualityIssues: ["문항 3가 앞선 문항과 중복됩니다."],
    violations: [],
    getFallback: () => fallback,
  });

  assert.deepEqual(repaired.repairedQuestionIds, [3]);
  assert.deepEqual(repaired.survey.aiQuestions[2]?.title, fallback.aiQuestions[2]?.title);
  assert.notEqual(
    repaired.survey.aiQuestions[2]?.title,
    repaired.survey.aiQuestions[1]?.title,
  );
  for (const index of [0, 1, 3, 4, 5, 6]) {
    assert.deepEqual(repaired.survey.aiQuestions[index], modelSurvey.aiQuestions[index]);
  }
  assert.deepEqual(
    validateSurveyIntentCandidate(canonical.surveyIntent, {
      questions: repaired.survey.aiQuestions,
    }),
    [],
  );
  assert.deepEqual(
    validateSurvey(
      input,
      parseSurveyBrief(input, canonical),
      repaired.survey,
      canonical.surveyIntent.surveyObject ?? undefined,
    ),
    [],
  );
});

test("관계 오류 repair는 원문 밖 서비스를 제거하고 eligibility와 기간을 보존한다", () => {
  const input = "새 기능 만족도는 새길 앱 최근 3개월 쓴 대학생한테 조사";
  const canonical = parseCanonicalSurveyIntent(input);
  const fallback = analyzeSurveyPrompt(input, canonical);
  const questions = fallback.aiQuestions.map((item) => ({
    ...item,
    options: item.options ? [...item.options] : undefined,
  }));
  assert.ok(questions[3]);
  questions[3] = {
    ...questions[3],
    title: "별빛 멤버십 서비스를 이용한 적이 있나요?",
    type: "single",
    options: ["이용한 적 있음", "이용한 적 없음"],
    measuredConstruct: "별빛 멤버십 서비스 이용 경험",
    measuredVariable: "별빛 멤버십 서비스 이용 여부",
    questionPurpose: "별빛 멤버십 서비스와의 관계를 확인함.",
  };
  const modelSurvey = {
    ...fallback,
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
  };
  const beforeRepairViolations = validateSurveyIntentCandidate(
    canonical.surveyIntent,
    { questions: modelSurvey.aiQuestions },
  );
  assert.ok(
    beforeRepairViolations.some(
      (item) =>
        item.code === "SEMANTIC_RELATION_INVALID" && item.questionId === 4,
    ),
  );

  const repaired = repairInvalidQuestions({
    survey: modelSurvey,
    intent: canonical.surveyIntent,
    plan: createSurveyPlan(canonical.surveyIntent, 7),
    violations: [
      {
        code: "SEMANTIC_RELATION_INVALID",
        severity: "repairable",
        message: "사용자 입력에 없는 서비스 관계가 추가되었습니다.",
        questionId: 4,
        evidence: "별빛 멤버십 서비스",
        origin: "question",
      },
    ],
    getFallback: () => fallback,
  });

  assert.deepEqual(repaired.repairedQuestionIds, [4]);
  assert.deepEqual(repaired.survey.aiQuestions[3]?.title, fallback.aiQuestions[3]?.title);
  assert.doesNotMatch(
    repaired.survey.aiQuestions.map((item) => item.title).join(" "),
    /별빛\s*멤버십/,
  );
  assert.deepEqual(repaired.survey.aiQuestions[0], modelSurvey.aiQuestions[0]);
  assert.match(repaired.survey.aiQuestions[0]?.title ?? "", /최근 3개월/);
  for (const index of [0, 1, 2, 4, 5, 6]) {
    assert.deepEqual(repaired.survey.aiQuestions[index], modelSurvey.aiQuestions[index]);
  }
  assert.deepEqual(
    validateSurvey(
      input,
      parseSurveyBrief(input, canonical),
      repaired.survey,
      canonical.surveyIntent.surveyObject ?? undefined,
    ),
    [],
  );
});
