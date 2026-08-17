import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSurveyPrompt } from "../app/survey-intent";
import { aiMockFixtures } from "./fixtures/ai-mock-fixtures";
import { goldenSurveyCases } from "./fixtures/ai-golden-surveys";

const allowedQuestionTypes = new Set([
  "scale", "single", "multiple", "dropdown", "shortText", "text", "date", "time", "section",
]);

for (const fixture of goldenSurveyCases) {
  test(`golden fixture: ${fixture.id}`, () => {
    const blueprint = analyzeSurveyPrompt(fixture.prompt);
    assert.ok(blueprint.title.length >= 2);
    assert.ok(blueprint.aiQuestions.length >= 1);
    assert.equal(
      new Set(blueprint.aiQuestions.map((question) => question.id)).size,
      blueprint.aiQuestions.length,
    );
    for (const question of blueprint.aiQuestions) {
      assert.ok(question.title.trim().length > 0);
      assert.ok(allowedQuestionTypes.has(question.type));
      if (["single", "multiple", "dropdown"].includes(question.type)) {
        assert.ok((question.options?.length ?? 0) >= 2);
        assert.equal(new Set(question.options).size, question.options?.length);
      }
      assert.doesNotMatch(
        question.title,
        /(?:실태조사|만족도 조사|수요 조사)를 (?:이용|사용|수강|참여)/,
      );
    }
  });
}

test("mock fixture는 잘못된 분기 목적지를 로컬에서 탐지한다", () => {
  const invalid = aiMockFixtures.invalidBranch;
  const questionIds = new Set(invalid.questions.map((question) => question.id));
  const invalidDestinations = invalid.questions.flatMap((question) =>
    Object.values(question.nextByOption ?? {}).filter(
      (destination) => destination !== "submit" && !questionIds.has(destination),
    ),
  );
  assert.deepEqual(invalidDestinations, [99]);
});

test("여섯 가지 mock fixture가 실제 설문과 동일한 핵심 스키마를 갖는다", () => {
  assert.equal(Object.keys(aiMockFixtures).length, 6);
  for (const survey of Object.values(aiMockFixtures)) {
    assert.ok(survey.title);
    assert.ok(survey.description);
    assert.ok(survey.questions.length >= 1);
    assert.ok(survey.questions.every((question) => question.id > 0 && question.required !== undefined));
  }
});
