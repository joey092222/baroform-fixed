import assert from "node:assert/strict";
import test from "node:test";

import {
  repairInvalidQuestions,
} from "../app/survey-ai";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import {
  analyzeSurveyPrompt,
  parseSurveyBrief,
  validateSurvey,
} from "../app/survey-intent";
import { createSurveyPlan } from "../app/survey-planning";
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

test("부분 repair는 모호해진 만족도 문항을 직접 만족도 문항으로 복구한다", () => {
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
  assert.deepEqual(qualityIssues, [
    "문항 5의 전반적 만족도를 직접 측정하지 않습니다.",
  ]);
  const repaired = repairInvalidQuestions({
    survey: modelSurvey,
    intent: canonical.surveyIntent,
    plan: createSurveyPlan(canonical.surveyIntent, 7),
    qualityIssues,
    violations: [],
    getFallback: () => fallback,
  });

  assert.deepEqual(repaired.repairedQuestionIds, [5]);
  assert.match(repaired.survey.aiQuestions[4]?.title ?? "", /만족/);
  assert.doesNotMatch(repaired.survey.aiQuestions[4]?.title ?? "", /어땠나요/);
  for (const index of [0, 1, 2, 3, 5, 6]) {
    assert.deepEqual(repaired.survey.aiQuestions[index], modelSurvey.aiQuestions[index]);
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
