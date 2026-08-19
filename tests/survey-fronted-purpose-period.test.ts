import assert from "node:assert/strict";
import test from "node:test";

import { repairInvalidQuestions } from "../app/survey-ai";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import {
  analyzeSurveyPrompt,
  type SurveyQuestion,
} from "../app/survey-intent";
import { createSurveyPlan } from "../app/survey-planning";

test("문항 repair는 사용자 기간과 canonical 응답자·조사 대상을 유지한다", () => {
  const input = "시설 인식은 푸른 체육관을 최근 두 달 이용한 주민에게 조사";
  const canonical = parseCanonicalSurveyIntent(input);
  const fallback = analyzeSurveyPrompt(input, canonical);
  const frequencyIndex = fallback.aiQuestions.findIndex((item) =>
    /얼마나 자주|이용 빈도/.test(item.title),
  );
  assert.ok(frequencyIndex >= 0);

  const questions = fallback.aiQuestions.map((item) => ({ ...item }));
  questions[frequencyIndex] = {
    ...(questions[frequencyIndex] as SurveyQuestion),
    title: "푸른 체육관을 주로 어느 시간대에 이용하나요?",
    explicitTimeframe: "최근 한 달",
  };
  const repaired = repairInvalidQuestions({
    survey: {
      ...fallback,
      templateQuestions: questions.slice(0, 5),
      aiQuestions: questions,
    },
    intent: canonical.surveyIntent,
    plan: createSurveyPlan(canonical.surveyIntent, 7),
    violations: [],
    qualityIssues: [
      `문항 ${questions[frequencyIndex]?.id}의 이용 빈도에 기준 기간이 없습니다.`,
    ],
    getFallback: () => fallback,
  });
  const frequency = repaired.survey.aiQuestions.find((item) =>
    /얼마나 자주|이용 빈도/.test(item.title),
  );

  assert.ok(frequency);
  assert.match(frequency.title, /^최근 두 달(?: 동안)? /);
  assert.doesNotMatch(frequency.title, /최근 한 달/);
  assert.doesNotMatch(frequency.title, /최근 두 달.*최근 두 달/);
  assert.equal(frequency.explicitTimeframe, "최근 두 달");
  assert.equal(
    repaired.survey.respondentGroup,
    canonical.surveyIntent.targetPopulation,
  );
  assert.equal(
    repaired.survey.evaluationTarget,
    canonical.surveyIntent.surveyObject,
  );
});
