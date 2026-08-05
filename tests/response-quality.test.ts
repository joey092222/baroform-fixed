import assert from "node:assert/strict";
import test from "node:test";
import {
  addBatchQualityFlags,
  assessResponseQuality,
  responseTextFingerprint,
} from "../app/response-quality";

const questions = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  title: `만족도 ${index + 1}`,
  type: "scale",
  required: true,
}));

test("일반적인 응답은 분석 가능한 품질로 분류한다", () => {
  const result = assessResponseQuality({
    questions,
    durationMinutes: 3,
    completionSeconds: 132,
    answers: questions.map((question, index) => ({
      questionId: question.id,
      type: "scale",
      value: (index % 5) + 1,
    })),
  });
  assert.equal(result.status, "usable");
  assert.equal(result.score, 100);
});

test("초고속 직선 응답과 반복 문구는 제외 권장으로 분류한다", () => {
  const result = assessResponseQuality({
    questions,
    durationMinutes: 5,
    completionSeconds: 9,
    answers: [
      ...questions.map((question) => ({ questionId: question.id, type: "scale", value: 3 })),
      { questionId: 6, type: "text", value: "asdfasdf" },
      { questionId: 7, type: "text", value: "asdfasdf" },
    ],
  });
  assert.equal(result.status, "exclude");
  assert.ok(result.reasons.length >= 3);
});

test("긴 주관식 복사와 동일 기기 반복은 배치 품질에 반영한다", () => {
  const answers = [{ questionId: 1, type: "text", value: "도서관 운영 시간을 자정까지 늘려주세요" }];
  assert.ok(responseTextFingerprint(answers).length > 0);
  const result = addBatchQualityFlags(
    { score: 100, status: "usable", reasons: [] },
    { duplicateDevice: true, duplicateText: true },
  );
  assert.equal(result.status, "review");
  assert.equal(result.score, 50);
});
