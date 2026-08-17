import assert from "node:assert/strict";
import test from "node:test";

import {
  restoreMissingRequiredPlanBlocks,
} from "../app/survey-ai";
import {
  analyzeSurveyPrompt,
  type SurveyQuestion,
} from "../app/survey-intent";
import { parseSurveyIntent } from "../app/survey-semantic-intent";
import {
  compactSurveyPlanForPrompt,
  createSurveyPlan,
  evaluateSurveyPlanCoverage,
} from "../app/survey-planning";

const usagePrompt = "대학생의 네이버 웹툰 이용 경험을 조사하고 싶다";

function question(id: number, title: string): SurveyQuestion {
  return {
    id,
    title,
    reason: "해당 측정 변수를 확인함.",
    type: "single",
    options: ["예", "아니요"],
    required: true,
  };
}

test("플랫폼 이용 경험 설문은 이용 여부와 이용 빈도를 필수 plan block으로 분리한다", () => {
  const plan = createSurveyPlan(parseSurveyIntent(usagePrompt), 7);
  const required = plan.blocks
    .filter((block) => block.required)
    .map((block) => block.id);

  assert.equal(plan.intentKind, "service_product");
  assert.ok(required.includes("usage-status"));
  assert.ok(required.includes("usage-frequency"));
  assert.ok(plan.blocks.some((block) => block.id === "usage-time-context") === false);
  const compact = compactSurveyPlanForPrompt(plan);
  assert.equal(compact.blocks.find((block) => block.id === "usage-status")?.required, true);
});

test("이미 이용자로 제한된 만족도 설문은 이용 여부를 중복 요구하지 않는다", () => {
  const prompt = "네이버 웹툰을 이용 중인 대학생들의 만족도 조사";
  const plan = createSurveyPlan(parseSurveyIntent(prompt), 7);

  assert.equal(plan.targetPopulation, "네이버 웹툰을 이용 중인 대학생");
  assert.equal(plan.blocks.some((block) => block.id === "usage-status"), false);
  assert.equal(plan.blocks.some((block) => block.id === "usage-frequency"), false);
  assert.ok(plan.blocks.some((block) => /만족/.test(block.variable)));
});

test("명시된 이용 시간대와 선호 장르는 필수이고 일반 이용 빈도는 강제하지 않는다", () => {
  const prompt = "대학생의 네이버 웹툰 이용 시간대와 선호 장르 조사";
  const plan = createSurveyPlan(parseSurveyIntent(prompt), 7);
  const required = plan.blocks
    .filter((block) => block.required)
    .map((block) => block.id);

  assert.ok(required.includes("usage-time-context"));
  assert.ok(required.includes("usage-preferred-genre"));
  assert.equal(required.includes("usage-frequency"), false);
  assert.equal(required.includes("usage-status"), false);
});

test("시간대 문항은 이용 빈도 coverage를 충족하지 않으며 누락 블록만 복원한다", () => {
  const intent = parseSurveyIntent(usagePrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(usagePrompt);
  const originalTitles = [
    "현재 대학교 또는 대학원에 재학하거나 휴학 중이신가요?",
    "주로 언제 네이버웹툰을 보나요?",
    "주로 어떤 상황에서 네이버웹툰을 보나요?",
    "즐겨 보는 웹툰 장르는 무엇인가요?",
    "네이버웹툰 서비스 전반에 얼마나 만족하나요?",
    "네이버웹툰을 보면서 불편했던 점이 있나요?",
    "주변 대학생에게 네이버웹툰을 추천할 가능성은 어느 정도인가요?",
  ];
  const survey = {
    ...fallback,
    templateQuestions: originalTitles.slice(0, 5).map((title, index) =>
      question(index + 1, title),
    ),
    aiQuestions: originalTitles.map((title, index) => question(index + 1, title)),
    semanticPlan: plan,
  };

  const initial = evaluateSurveyPlanCoverage(plan, survey.aiQuestions);
  assert.deepEqual(initial.missingRequiredBlockIds, [
    "usage-status",
    "usage-frequency",
  ]);

  const restored = restoreMissingRequiredPlanBlocks({
    survey,
    intent,
    plan,
    getFallback: () => fallback,
  });
  const corpus = restored.survey.aiQuestions.map((item) => item.title).join(" ");

  assert.deepEqual(restored.finalCoverage.missingRequiredBlockIds, []);
  assert.match(corpus, /이용한 적|이용해 본/);
  assert.match(corpus, /얼마나 자주|이용 빈도/);
  assert.match(corpus, /만족/);
  assert.match(corpus, /불편/);
  assert.equal(restored.repairedQuestionIds.length, 2);
  assert.equal(restored.preservedQuestionIds.length, 5);
});

test("부분 복구 뒤 빈도 문항이 사라져도 최종 coverage 검사에서 되살린다", () => {
  const intent = parseSurveyIntent(usagePrompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(usagePrompt);
  const questions = fallback.aiQuestions.slice(0, 7).map((item) => ({ ...item }));
  const frequencyIndex = questions.findIndex((item) => /얼마나 자주|이용 빈도/.test(item.title));
  assert.ok(frequencyIndex >= 0);
  questions[frequencyIndex] = question(
    questions[frequencyIndex]!.id,
    "주로 어느 시간대에 네이버웹툰을 보나요?",
  );
  const survey = {
    ...fallback,
    templateQuestions: questions.slice(0, 5),
    aiQuestions: questions,
    semanticPlan: plan,
  };

  const restored = restoreMissingRequiredPlanBlocks({
    survey,
    intent,
    plan,
    getFallback: () => fallback,
  });

  assert.deepEqual(restored.initialCoverage.missingRequiredBlockIds, [
    "usage-frequency",
  ]);
  assert.deepEqual(restored.finalCoverage.missingRequiredBlockIds, []);
  assert.match(
    restored.survey.aiQuestions.map((item) => item.title).join(" "),
    /얼마나 자주|이용 빈도/,
  );
});
