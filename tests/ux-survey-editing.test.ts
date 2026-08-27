import assert from "node:assert/strict";
import test from "node:test";

import {
  addNeutralOption,
  addOption,
  addQuestion,
  addSection,
  changeQuestionType,
  duplicateQuestion,
  estimatedMinutes,
  evaluateDraftStructure,
  maxOptionsPerQuestion,
  maxQuestions,
  minOptionsPerQuestion,
  moveQuestion,
  neutralOptionLabel,
  normalizeQuestionTitle,
  removeOption,
  removeQuestion,
  updateOption,
} from "../app/ux/survey-editing";
import type { Question } from "../app/ux/types";

function choiceQuestion(id: number, options = ["가", "나", "다"]): Question {
  return {
    id,
    title: `${id}번 문항입니다`,
    reason: "",
    type: "single",
    options: [...options],
    required: false,
  };
}

function draftOf(count: number) {
  return Array.from({ length: count }, (_, index) => choiceQuestion(index + 1));
}

test("문항 추가는 30개 상한에서 멈추고 같은 배열을 돌려준다", () => {
  const under = draftOf(3);
  const added = addQuestion(under);
  assert.equal(added.questions.length, 4);
  assert.equal(added.addedId, 4);

  const full = draftOf(maxQuestions);
  const blocked = addQuestion(full);
  assert.equal(blocked.addedId, null);
  assert.equal(blocked.questions, full, "상한에서는 같은 참조를 돌려줘야 한다");

  const blockedSection = addSection(full);
  assert.equal(blockedSection.addedId, null);
  assert.equal(blockedSection.questions, full);
});

test("새 문항 id는 기존 최대 id 다음 값으로 잡는다", () => {
  const gapped = [choiceQuestion(2), choiceQuestion(9)];
  assert.equal(addQuestion(gapped).addedId, 10);
  assert.equal(addSection(gapped).addedId, 10);
  assert.equal(duplicateQuestion(gapped, 2).addedId, 10);
});

test("문항이 하나뿐이면 삭제하지 않는다", () => {
  const single = draftOf(1);
  assert.equal(removeQuestion(single, 1), single);

  const pair = draftOf(2);
  assert.deepEqual(
    removeQuestion(pair, 1).map((question) => question.id),
    [2],
  );
});

test("문항 복제는 바로 뒤에 넣고 선택지를 복사한다", () => {
  const questions = draftOf(3);
  const result = duplicateQuestion(questions, 2);
  assert.deepEqual(
    result.questions.map((question) => question.id),
    [1, 2, 4, 3],
  );

  const original = result.questions[1];
  const copy = result.questions[2];
  assert.notEqual(original.options, copy.options, "선택지 배열을 공유하면 안 된다");
  copy.options?.push("라");
  assert.equal(original.options?.length, 3);
});

test("문항 이동은 배열 경계를 넘지 않는다", () => {
  const questions = draftOf(3);
  assert.equal(moveQuestion(questions, 1, -1), questions);
  assert.equal(moveQuestion(questions, 3, 1), questions);
  assert.deepEqual(
    moveQuestion(questions, 1, 1).map((question) => question.id),
    [2, 1, 3],
  );
});

test("타입을 바꾸면 선택지·척도·필수 여부가 정합을 유지한다", () => {
  const questions = draftOf(1);

  const asScale = changeQuestionType(questions, 1, "scale")[0];
  assert.equal(asScale.options, undefined);
  assert.equal(asScale.scaleMin, 1);
  assert.equal(asScale.scaleMax, 5);

  const backToChoice = changeQuestionType([asScale], 1, "multiple")[0];
  assert.equal(backToChoice.options?.length, 3, "선택형은 기본 선택지를 받는다");
  assert.equal(backToChoice.scaleMin, undefined);

  const required: Question[] = [{ ...choiceQuestion(1), required: true }];
  const asSection = changeQuestionType(required, 1, "section")[0];
  assert.equal(asSection.required, false, "섹션은 필수가 될 수 없다");
});

test("선택지는 2~12개 범위를 벗어나지 않는다", () => {
  const twoOptions = [choiceQuestion(1, ["가", "나"])];
  assert.equal(
    removeOption(twoOptions, 1, 0),
    twoOptions,
    `최소 ${minOptionsPerQuestion}개는 유지한다`,
  );

  const full = [
    choiceQuestion(
      1,
      Array.from({ length: maxOptionsPerQuestion }, (_, index) => `보기${index}`),
    ),
  ];
  assert.equal(addOption(full, 1), full, `최대 ${maxOptionsPerQuestion}개까지만 늘린다`);

  const room = [choiceQuestion(1, ["가", "나"])];
  assert.equal(addOption(room, 1)[0].options?.length, 3);
  assert.equal(updateOption(room, 1, 1, "다")[0].options?.[1], "다");
});

test("‘잘 모르겠음’은 선택형에만, 한 번만 추가된다", () => {
  const single = [choiceQuestion(1, ["가", "나"])];
  const withNeutral = addNeutralOption(single, 1);
  assert.deepEqual(withNeutral[0].options, ["가", "나", neutralOptionLabel]);
  assert.equal(
    addNeutralOption(withNeutral, 1),
    withNeutral,
    "이미 있으면 그대로 둔다",
  );

  const scale: Question[] = [{ ...choiceQuestion(1), type: "scale" }];
  assert.equal(addNeutralOption(scale, 1), scale, "척도 문항에는 넣지 않는다");
});

test("문항 제목은 개행을 공백으로 바꾸고 200자로 자른다", () => {
  assert.equal(normalizeQuestionTitle("첫 줄\n둘째 줄"), "첫 줄 둘째 줄");
  assert.equal(normalizeQuestionTitle("가".repeat(250)).length, 200);
});

test("구조 점검은 세 항목을 각각 판정한다", () => {
  const healthy = draftOf(3);
  const strong = evaluateDraftStructure(healthy);
  assert.deepEqual(strong.checks, {
    enoughQuestions: true,
    titlesLongEnough: true,
    choicesHaveOptions: true,
  });
  assert.equal(strong.score, 100);

  const weak = evaluateDraftStructure([
    { ...choiceQuestion(1), title: "짧음" },
    choiceQuestion(2, ["하나"]),
  ]);
  assert.deepEqual(weak.checks, {
    enoughQuestions: false,
    titlesLongEnough: false,
    choicesHaveOptions: false,
  });
  assert.equal(weak.score, 0);
});

test("예상 소요시간은 문항 유형별 가중치로 계산하고 섹션은 세지 않는다", () => {
  const section: Question = {
    id: 1,
    title: "섹션",
    reason: "",
    type: "section",
    required: false,
  };
  assert.equal(estimatedMinutes([section]), 1, "섹션만 있으면 기본 시간만 든다");

  const longAnswers: Question[] = Array.from({ length: 5 }, (_, index) => ({
    ...choiceQuestion(index + 1),
    type: "text",
    options: undefined,
  }));
  // 기본 20초 + 장문 55초 × 5 = 295초 -> 5분
  assert.equal(estimatedMinutes(longAnswers), 5);
});
