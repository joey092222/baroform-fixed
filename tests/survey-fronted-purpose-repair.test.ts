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
