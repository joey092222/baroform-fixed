import assert from "node:assert/strict";
import test from "node:test";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { repairInvalidQuestions } from "../app/survey-ai";
import { analyzeSurveyPrompt, parseSurveySemantics } from "../app/survey-intent";
import { createSurveyPlan } from "../app/survey-planning";
import { parseSurveyIntent } from "../app/survey-semantic-intent";

test("복수 수업 만족도는 제작자 확인이 필요한 반복 평가로 해석한다", () => {
  const prompt = "여러 수업들에 대한 대학생들의 만족도를 조사하고 싶어요";
  const intent = parseSurveyIntent(prompt);
  const semantics = parseSurveySemantics(prompt);

  assert.equal(intent.targetPopulation, "대학생");
  assert.equal(intent.targetCardinality, "multiple");
  assert.equal(intent.targetListSource, "creator_required");
  assert.equal(intent.unitOfAnalysis, "개별 수업");
  assert.equal(intent.measurementMode, "repeated_evaluation");
  assert.equal(intent.screeningRequired, false);
  assert.equal(intent.requiresCreatorClarification, true);
  assert.deepEqual(intent.evaluationTargets, []);
  assert.equal(semantics.targetCardinality, "multiple");
});

test("복수 수업 목록이 명시되면 각 수업을 별도 평가한다", () => {
  const prompt =
    "경영과학, 회계원리, 마케팅관리 수업의 만족도를 비교하고 싶어요";
  const intent = parseSurveyIntent(prompt);
  const blueprint = analyzeSurveyPrompt(prompt);
  const corpus = blueprint.aiQuestions.map((item) => item.title).join(" ");

  assert.deepEqual(intent.evaluationTargets, [
    "경영과학 수업",
    "회계원리 수업",
    "마케팅관리 수업",
  ]);
  assert.equal(intent.targetCardinality, "multiple");
  assert.equal(intent.targetListSource, "explicit_in_prompt");
  assert.equal(intent.unitOfAnalysis, "개별 수업");
  assert.equal(intent.measurementMode, "comparison");
  assert.match(corpus, /경영과학 수업에 전반적으로 얼마나 만족/);
  assert.match(corpus, /회계원리 수업에 전반적으로 얼마나 만족/);
  assert.match(corpus, /마케팅관리 수업에 전반적으로 얼마나 만족/);
  assert.doesNotMatch(corpus, /수강하거나 참여|현재 수강·참여 중/);
});

test("단일 수업과 학교생활 만족도에는 불필요한 스크리너를 넣지 않는다", () => {
  const course = parseSurveyIntent("경영과학 수업의 만족도를 조사하고 싶어요");
  const courseBlueprint = analyzeSurveyPrompt(
    "경영과학 수업의 만족도를 조사하고 싶어요",
  );
  const studentLifeBlueprint = analyzeSurveyPrompt(
    "대학생들의 학교생활 만족도 조사",
  );

  assert.equal(course.targetCardinality, "single");
  assert.equal(course.screeningRequired, false);
  assert.match(
    courseBlueprint.aiQuestions[0]?.title ?? "",
    /경영과학 수업에 전반적으로 얼마나 만족/,
  );
  assert.doesNotMatch(
    courseBlueprint.aiQuestions[0]?.title ?? "",
    /수강|참여|경험한 적/,
  );
  assert.match(
    studentLifeBlueprint.aiQuestions[0]?.title ?? "",
    /학교생활에 전반적으로 얼마나 만족/,
  );
});

test("먹어본 고객처럼 명시된 자격 조건에는 단순 경험 스크리너를 유지한다", () => {
  const prompt = "카페 신메뉴를 먹어본 고객의 만족도 조사";
  const intent = parseSurveyIntent(prompt);
  const blueprint = analyzeSurveyPrompt(prompt);

  assert.equal(intent.screeningRequired, true);
  assert.match(intent.screeningReason ?? "", /응답 대상/);
  assert.match(blueprint.aiQuestions[0]?.title ?? "", /먹어본 경험/);
  assert.deepEqual(blueprint.aiQuestions[0]?.options, ["경험 있음", "경험 없음"]);
});

test("복수 수업 동의어는 모두 개별 수업 단위로 분류한다", () => {
  const prompts = [
    "여러 수업의 만족도",
    "여러 과목의 만족도",
    "복수의 수업을 비교 평가",
    "수강 과목별 만족도",
    "각 강의에 대한 만족도",
    "현재 듣는 수업들의 만족도",
  ];
  for (const prompt of prompts) {
    const intent = parseSurveyIntent(prompt);
    assert.equal(intent.targetCardinality, "multiple", prompt);
    assert.equal(intent.unitOfAnalysis, "개별 수업", prompt);
    assert.equal(intent.screeningRequired, false, prompt);
  }
});

test("운영 route는 복수 수업 목록 부족을 응답자 문항이 아닌 제작자 확인으로 반환한다", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-multiple-course-clarification",
        },
        body: JSON.stringify({
          prompt: "여러 수업들에 대한 대학생들의 만족도를 조사하고 싶어요",
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const body = (await response.json()) as {
      type?: string;
      status?: string;
      clarification?: { question?: string; options?: string[] };
      blueprint?: unknown;
    };

    assert.equal(response.status, 200);
    assert.equal(body.type, "clarification");
    assert.equal(body.status, "needs_clarification");
    assert.equal(body.blueprint, undefined);
    assert.match(body.clarification?.question ?? "", /평가할 수업/);
    assert.equal(body.clarification?.options?.length, 3);
    assert.equal(
      response.headers.get("x-baroform-generation-source"),
      "intent_clarification",
    );
    assert.equal(response.headers.get("x-baroform-model-calls"), "0");
  } finally {
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("의미 위반 한 문항만 교체하고 정상 문항의 ID·텍스트·순서를 보존한다", () => {
  const prompt = "대학생들의 학교생활 만족도 조사";
  const intent = parseSurveyIntent(prompt);
  const plan = createSurveyPlan(intent, 7);
  const fallback = analyzeSurveyPrompt(prompt);
  const sevenQuestions = [
    ...fallback.aiQuestions,
    ...Array.from(
      { length: Math.max(0, 7 - fallback.aiQuestions.length) },
      (_, index) => ({
        ...fallback.aiQuestions.at(-1)!,
        id: fallback.aiQuestions.length + index + 1,
        title: `정상 모델 보충 문항 ${index + 1}`,
      }),
    ),
  ];
  const original = {
    ...fallback,
    title: "모델이 만든 학교생활 만족도 조사",
    aiQuestions: sevenQuestions.map((item, index) =>
      index === 0
        ? {
            ...item,
            title: "학교생활에 참여한 적이 있나요?",
            type: "single" as const,
            options: ["예", "아니요"],
          }
        : { ...item, title: `정상 모델 문항 ${index + 1}` },
    ),
  };
  const before = original.aiQuestions.map((item) => ({
    id: item.id,
    title: item.title,
  }));
  const repaired = repairInvalidQuestions({
    survey: original,
    intent,
    plan,
    violations: [
      {
        code: "UNNECESSARY_SCREENING",
        severity: "repairable",
        message: "불필요한 스크리너",
        questionId: 1,
      },
    ],
    getFallback: () => fallback,
  });

  assert.deepEqual(repaired.repairedQuestionIds, [1]);
  assert.deepEqual(repaired.preservedQuestionIds, [2, 3, 4, 5, 6, 7]);
  assert.notEqual(repaired.survey.aiQuestions[0]?.title, before[0]?.title);
  for (let index = 1; index < before.length; index += 1) {
    assert.equal(repaired.survey.aiQuestions[index]?.id, before[index]?.id);
    assert.equal(repaired.survey.aiQuestions[index]?.title, before[index]?.title);
  }
  assert.ok(repaired.survey.aiQuestions[0]?.planBlockId);
  assert.ok(repaired.survey.aiQuestions[0]?.measuredVariable);
  assert.ok(repaired.survey.aiQuestions[0]?.questionPurpose);
  assert.equal(
    repaired.survey.aiQuestions[0]?.unitOfAnalysis,
    intent.unitOfAnalysis,
  );
});
