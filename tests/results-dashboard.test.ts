import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuestionResults,
  LOW_SAMPLE_THRESHOLD,
  summarizeResponseQuality,
  type ResultsStoredResponse,
} from "../app/results-dashboard";
import type { SurveyQuestion } from "../app/survey-intent";

const questions: SurveyQuestion[] = [
  {
    id: 1,
    title: "가장 선호하는 학습 공간은 어디인가요?",
    reason: "선호 공간 확인",
    type: "single",
    options: ["도서관", "카페", "기숙사"],
    required: true,
  },
];

function response(
  id: string,
  status: "usable" | "review" | "exclude",
  value: string,
): ResultsStoredResponse {
  return {
    id,
    completionSeconds: 45,
    createdAt: "2026-08-15T00:00:00.000Z",
    quality: { score: 90, status, reasons: [] },
    answers: [{ questionId: 1, title: questions[0].title, type: "single", value }],
  };
}

test("결과 품질 지표는 정상·검토·제외 상태를 겹치지 않게 집계한다", () => {
  assert.deepEqual(summarizeResponseQuality([]), {
    total: 0,
    usable: 0,
    review: 0,
    excluded: 0,
    analysis: 0,
  });

  const summary = summarizeResponseQuality([
    response("1", "usable", "도서관"),
    response("2", "review", "카페"),
    response("3", "exclude", "카페"),
  ]);
  assert.deepEqual(summary, {
    total: 3,
    usable: 1,
    review: 1,
    excluded: 1,
    analysis: 2,
  });
});

test("문항 분포는 선택되지 않은 선택지도 0건으로 유지한다", () => {
  const results = buildQuestionResults(questions, [
    response("1", "usable", "도서관"),
  ]);

  assert.equal(results[0].answeredCount, 1);
  assert.deepEqual(
    results[0].choices.map(({ label, count }) => ({ label, count })),
    [
      { label: "도서관", count: 1 },
      { label: "기숙사", count: 0 },
      { label: "카페", count: 0 },
    ],
  );
  assert.equal(LOW_SAMPLE_THRESHOLD, 5);
});
