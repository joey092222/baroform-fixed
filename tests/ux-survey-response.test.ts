import assert from "node:assert/strict";
import test from "node:test";

import {
  answerLengthLimit,
  answerProgress,
  answerableQuestions,
  buildResponsePayload,
  completionSeconds,
  firstMissingRequired,
  isAnswered,
  maxLongAnswerLength,
  maxShortAnswerLength,
  scaleValues,
  toggleChoiceAnswer,
} from "../app/ux/survey-response";
import type { Question } from "../app/ux/types";

const questions: Question[] = [
  {
    id: 1,
    title: "안내 섹션",
    reason: "",
    type: "section",
    required: true,
    description: "읽어주세요",
  },
  {
    id: 2,
    title: "가장 자주 이용하는 시설은?",
    reason: "",
    type: "single",
    options: ["도서관", "식당"],
    required: true,
  },
  {
    id: 3,
    title: "불편한 점을 모두 골라주세요",
    reason: "",
    type: "multiple",
    options: ["대기", "가격"],
    required: false,
  },
  {
    id: 4,
    title: "자유롭게 적어주세요",
    reason: "",
    type: "text",
    required: false,
  },
];

test("응답 완료 판정은 빈 문자열과 빈 배열을 미응답으로 본다", () => {
  assert.equal(isAnswered(undefined), false);
  assert.equal(isAnswered(""), false);
  assert.equal(isAnswered([]), false);
  assert.equal(isAnswered(0), true, "척도 0점도 응답이다");
  assert.equal(isAnswered("도서관"), true);
  assert.equal(isAnswered(["대기"]), true);
});

test("섹션은 진행률 계산에서 제외한다", () => {
  assert.deepEqual(
    answerableQuestions(questions).map((question) => question.id),
    [2, 3, 4],
  );

  const empty = answerProgress(questions, {});
  assert.deepEqual(empty, { answered: 0, total: 3, percent: 0 });

  const partial = answerProgress(questions, { 2: "도서관", 4: "" });
  assert.deepEqual(partial, { answered: 1, total: 3, percent: 33 });

  const done = answerProgress(questions, {
    2: "도서관",
    3: ["대기"],
    4: "좋아요",
  });
  assert.equal(done.percent, 100);
});

test("문항이 없으면 진행률은 0%로 두고 나눗셈하지 않는다", () => {
  assert.deepEqual(answerProgress([], {}), {
    answered: 0,
    total: 0,
    percent: 0,
  });
});

test("제출을 막는 것은 필수 문항이며 섹션은 필수라도 무시한다", () => {
  const blocked = firstMissingRequired(questions, {});
  assert.equal(blocked?.id, 2, "필수 섹션(1번)이 아니라 필수 문항(2번)을 막아야 한다");

  assert.equal(firstMissingRequired(questions, { 2: "식당" }), null);
  assert.equal(firstMissingRequired(questions, { 2: [] })?.id, 2);
});

test("복수 선택은 같은 값을 다시 누르면 해제된다", () => {
  const once = toggleChoiceAnswer({}, 3, "대기");
  assert.deepEqual(once[3], ["대기"]);

  const twice = toggleChoiceAnswer(once, 3, "가격");
  assert.deepEqual(twice[3], ["대기", "가격"]);

  const removed = toggleChoiceAnswer(twice, 3, "대기");
  assert.deepEqual(removed[3], ["가격"]);
});

test("전송 payload는 모든 문항을 담고 미응답은 빈 문자열로 채운다", () => {
  const payload = buildResponsePayload(questions, { 2: "도서관" });
  assert.equal(payload.length, questions.length, "섹션까지 함께 전송한다");
  assert.deepEqual(payload[1], {
    questionId: 2,
    title: "가장 자주 이용하는 시설은?",
    type: "single",
    value: "도서관",
  });
  assert.equal(payload[3].value, "");
});

test("척도 문항의 눈금은 min~max를 모두 만든다", () => {
  const scale: Question = {
    id: 9,
    title: "만족도",
    reason: "",
    type: "scale",
    required: false,
    scaleMin: 2,
    scaleMax: 6,
  };
  assert.deepEqual(scaleValues(scale), [2, 3, 4, 5, 6]);

  const defaulted: Question = { ...scale, scaleMin: undefined, scaleMax: undefined };
  assert.deepEqual(scaleValues(defaulted), [1, 2, 3, 4, 5]);
});

test("주관식 입력 길이 상한은 유형별로 다르다", () => {
  assert.equal(answerLengthLimit("text"), maxLongAnswerLength);
  assert.equal(answerLengthLimit("shortText"), maxShortAnswerLength);
  assert.equal(answerLengthLimit("single"), undefined);
});

test("소요 시간은 초 단위로 반올림한다", () => {
  assert.equal(completionSeconds(1_000, 46_400), 45);
  assert.equal(completionSeconds(0, 0), 0);
});
