import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateSurveyGenerationSeconds,
  formatSurveyGenerationSeconds,
  getSurveyGenerationTiming,
} from "../app/survey-generation-time";

test("설문 모드와 작업량에 따라 초기 예상 시간을 계산한다", () => {
  const standard = estimateSurveyGenerationSeconds({
    surveyMode: "standard",
    questionCount: 7,
    attachmentCount: 0,
  });
  const research = estimateSurveyGenerationSeconds({
    surveyMode: "research",
    questionCount: 7,
    attachmentCount: 0,
  });
  const largerSurvey = estimateSurveyGenerationSeconds({
    surveyMode: "standard",
    questionCount: 12,
    attachmentCount: 2,
  });

  assert.equal(standard, 80);
  assert.equal(research, 150);
  assert.ok(largerSurvey > standard);
});

test("최근 실제 생성 시간으로 예상 시간을 보정한다", () => {
  const estimate = estimateSurveyGenerationSeconds({
    surveyMode: "standard",
    questionCount: 7,
    attachmentCount: 0,
    recentDurations: [60, 80, 100],
  });

  assert.equal(estimate, 80);
});

test("예상 남은 시간은 매초 줄고 초과 시 솔직한 상태를 표시한다", () => {
  const first = getSurveyGenerationTiming(20, 80);
  const next = getSurveyGenerationTiming(21, 80);
  const overtime = getSurveyGenerationTiming(81, 80);

  assert.equal(first.remainingSeconds, 60);
  assert.equal(first.remainingLabel, "약 1분");
  assert.equal(next.remainingSeconds, 59);
  assert.equal(next.remainingLabel, "약 59초");
  assert.equal(overtime.isOverEstimate, true);
  assert.equal(overtime.remainingLabel, "예상보다 조금 더 걸리는 중");
});

test("경과 시간을 분과 초로 읽기 쉽게 표시한다", () => {
  assert.equal(formatSurveyGenerationSeconds(9), "9초");
  assert.equal(formatSurveyGenerationSeconds(60), "1분");
  assert.equal(formatSurveyGenerationSeconds(95), "1분 35초");
});
