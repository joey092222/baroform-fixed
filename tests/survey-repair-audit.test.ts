import assert from "node:assert/strict";
import test from "node:test";

import {
  createSurveyGenerationTrace,
  recordSurveyModelOutputDiagnostics,
  recordSurveyRepair,
  recordSurveyRepairAudit,
  surveyGenerationTraceSnapshot,
} from "../app/survey-generation-trace";

test("metadata-only normalization과 respondent-facing 변경을 분리해 기록한다", () => {
  const metadataTrace = createSurveyGenerationTrace("audit-metadata");
  recordSurveyModelOutputDiagnostics(metadataTrace, {
    normalizedInternalMetadataPaths: ["survey.questions.0.analysis.construct"],
  });
  recordSurveyRepairAudit(metadataTrace, {
    before: [{ id: "Q1", title: "어떻게 평가하시나요?", type: "scale" }],
    final: [
      {
        id: "Q1",
        title: "어떻게 평가하시나요?",
        type: "scale",
        measuredConstruct: "만족도",
      },
    ],
  });
  const metadata = surveyGenerationTraceSnapshot(metadataTrace);

  assert.notEqual(metadata.questionsBeforeRepairHash, metadata.questionsAfterRepairHash);
  assert.deepEqual(metadata.changedQuestionIds, ["Q1"]);
  assert.deepEqual(metadata.changedFieldsByQuestion.Q1, ["measuredConstruct"]);
  assert.equal(metadata.metadataOnlyNormalization, true);
  assert.equal(metadata.respondentFacingContentChanged, false);

  const contentTrace = createSurveyGenerationTrace("audit-content");
  recordSurveyRepair(contentTrace, ["Q1"], []);
  recordSurveyRepairAudit(contentTrace, {
    before: [{ id: "Q1", title: "중요한가요?", options: ["예", "아니요"] }],
    final: [{ id: "Q1", title: "얼마나 만족하시나요?", options: ["1", "2", "3"] }],
  });
  const content = surveyGenerationTraceSnapshot(contentTrace);

  assert.equal(content.metadataOnlyNormalization, false);
  assert.equal(content.respondentFacingContentChanged, true);
  assert.deepEqual(content.changedFieldsByQuestion.Q1, ["options", "title"]);
});

test("문항이 그대로인데 repairCount만 증가한 경우를 숨기지 않는다", () => {
  const trace = createSurveyGenerationTrace("audit-noop-repair");
  const question = { id: "Q1", title: "이용한 적이 있나요?", options: ["예", "아니요"] };
  recordSurveyRepair(trace, ["Q1"], []);
  recordSurveyRepairAudit(trace, { before: [question], final: [question] });
  const snapshot = surveyGenerationTraceSnapshot(trace);

  assert.equal(snapshot.questionsBeforeRepairHash, snapshot.questionsAfterRepairHash);
  assert.deepEqual(snapshot.changedQuestionIds, []);
  assert.equal(snapshot.metadataOnlyNormalization, false);
  assert.equal(snapshot.respondentFacingContentChanged, false);
  assert.equal(snapshot.repairCount, 1);
});
