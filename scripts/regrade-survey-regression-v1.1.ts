import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { evaluateSemanticResult } from "../evals/survey-regression/v1/evaluation";
import { createManualAuditDecision } from "../evals/survey-regression/v1/manual-audit-v1";
import type {
  SurveyRegressionCase,
  SurveyRegressionResult,
} from "../evals/survey-regression/v1/schema";
import { auditedSurveyRegressionDatasetSchema } from "../evals/survey-regression/v1.1/schema";

const root = process.cwd();
const baselinePath = resolve(
  root,
  "../survey-regression-100-v1/.artifacts/survey-regression/v1/preview-100-v1/results.json",
);
const auditedPaths = [
  resolve(root, "evals/survey-regression/v1.1/dev.json"),
  resolve(root, "evals/survey-regression/v1.1/holdout.json"),
];

const baseline = JSON.parse(
  await readFile(baselinePath, "utf8"),
) as SurveyRegressionResult[];
const auditedCases = new Map<string, SurveyRegressionCase>();
for (const path of auditedPaths) {
  const dataset = auditedSurveyRegressionDatasetSchema.parse(
    JSON.parse(await readFile(path, "utf8")),
  );
  for (const item of dataset.cases) auditedCases.set(item.id, item);
}

if (baseline.length !== 100 || auditedCases.size !== 100) {
  throw new Error(
    `AUDIT_CARDINALITY_INVALID:${baseline.length}:${auditedCases.size}`,
  );
}

type GroundTruth = "pass" | "failure" | "excluded";
type Confusion = { tp: number; fp: number; tn: number; fn: number };

function groundTruthFor(judgment: string): GroundTruth {
  if (judgment === "true_pass" || judgment === "evaluator_false_positive") {
    return "pass";
  }
  if (judgment === "true_failure" || judgment === "evaluator_false_negative") {
    return "failure";
  }
  return "excluded";
}

function confusionMatrix(
  rows: Array<{ predictedFailure: boolean; groundTruth: GroundTruth }>,
): Confusion {
  return rows.reduce<Confusion>(
    (matrix, row) => {
      if (row.groundTruth === "excluded") return matrix;
      if (row.predictedFailure && row.groundTruth === "failure") matrix.tp += 1;
      if (row.predictedFailure && row.groundTruth === "pass") matrix.fp += 1;
      if (!row.predictedFailure && row.groundTruth === "pass") matrix.tn += 1;
      if (!row.predictedFailure && row.groundTruth === "failure") matrix.fn += 1;
      return matrix;
    },
    { tp: 0, fp: 0, tn: 0, fn: 0 },
  );
}

function rates(matrix: Confusion) {
  return {
    precision:
      matrix.tp + matrix.fp === 0
        ? 1
        : matrix.tp / (matrix.tp + matrix.fp),
    recall:
      matrix.tp + matrix.fn === 0
        ? 1
        : matrix.tp / (matrix.tp + matrix.fn),
  };
}

const rows = baseline.map((result) => {
  const audited = auditedCases.get(result.caseId);
  if (!audited) throw new Error(`AUDITED_CASE_MISSING:${result.caseId}`);
  const regraded = evaluateSemanticResult(audited, result);
  const manual = createManualAuditDecision({
    caseId: result.caseId,
    expectedOutcome: audited.expectedOutcome,
    expectedTargetPopulation: audited.expectedTargetPopulation,
    actualRespondentGroup: result.finalRespondentGroup,
    actualEvaluationTarget: result.finalEvaluationTarget,
    classification: result.classification,
    httpStatus: result.httpStatus ?? 0,
    firstFatalCode: result.fatalFailures[0]?.code ?? null,
  });
  const removedRequiredConcepts = result.expected.requiredQuestionConcepts.filter(
    (concept) => !audited.requiredQuestionConcepts.includes(concept),
  );
  const oldRequiredMissing = result.fatalFailures
    .filter((issue) => issue.code === "REQUIRED_CONCEPT_MISSING")
    .map((issue) => issue.message.replace(/^.*?:\s*/, ""));
  const newCodes = regraded.fatalFailures.map((issue) => issue.code);
  return {
    caseId: result.caseId,
    oldAutomaticFailure: result.fatalFailures.length > 0,
    oldFatalCodes: result.fatalFailures.map((issue) => issue.code),
    auditedAutomaticFailure: regraded.fatalFailures.length > 0,
    auditedFatalCodes: newCodes,
    manualJudgment: manual.judgment,
    manualRationale: manual.rationale,
    groundTruth: groundTruthFor(manual.judgment),
    oldRequiredMissing,
    removedRequiredConcepts,
    eligibilityMissing: newCodes.includes("ELIGIBILITY_CHECK_MISSING"),
    purposeMissing: newCodes.includes("REQUIRED_PURPOSE_MISSING"),
    surveyObjectMismatch: newCodes.includes("SURVEY_OBJECT_MISMATCH"),
    evaluatorFalsePositive: manual.judgment === "evaluator_false_positive",
    datasetSpecificationError: removedRequiredConcepts.length > 0,
  };
});

const oldConfusion = confusionMatrix(
  rows.map((row) => ({
    predictedFailure: row.oldAutomaticFailure,
    groundTruth: row.groundTruth,
  })),
);
const auditedConfusion = confusionMatrix(
  rows.map((row) => ({
    predictedFailure: row.auditedAutomaticFailure,
    groundTruth: row.groundTruth,
  })),
);
const summary = {
  total: rows.length,
  oldAutomaticFailures: rows.filter((row) => row.oldAutomaticFailure).length,
  auditedAutomaticFailures: rows.filter((row) => row.auditedAutomaticFailure)
    .length,
  oldRequiredConceptMissing: rows.filter(
    (row) => row.oldRequiredMissing.length > 0,
  ).length,
  trueRequiredPurposeMissing: rows.filter((row) => row.purposeMissing).length,
  eligibilityMissing: rows.filter((row) => row.eligibilityMissing).length,
  evaluatorFalsePositive: rows.filter((row) => row.evaluatorFalsePositive)
    .length,
  datasetSpecificationError: rows.filter(
    (row) => row.datasetSpecificationError,
  ).length,
  surveyObjectMismatch: rows.filter((row) => row.surveyObjectMismatch).length,
  old: { ...oldConfusion, ...rates(oldConfusion) },
  audited: { ...auditedConfusion, ...rates(auditedConfusion) },
};

const report = [
  "# 바로폼 설문 회귀 v1.1 무호출 재채점",
  "",
  `- 원본 결과: ${baselinePath}`,
  "- OpenAI 재호출: 0",
  `- 기존 자동 실패: ${summary.oldAutomaticFailures}`,
  `- 감사 후 자동 실패: ${summary.auditedAutomaticFailures}`,
  `- 기존 REQUIRED_CONCEPT_MISSING 사례: ${summary.oldRequiredConceptMissing}`,
  `- 진짜 required purpose missing: ${summary.trueRequiredPurposeMissing}`,
  `- eligibility check missing: ${summary.eligibilityMissing}`,
  `- evaluator false positive: ${summary.evaluatorFalsePositive}`,
  `- dataset specification error: ${summary.datasetSpecificationError}`,
  `- survey object mismatch: ${summary.surveyObjectMismatch}`,
  "",
  "## Confusion matrix",
  "",
  "| 평가기 | TP | FP | TN | FN | Precision | Recall |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  `| 기존 | ${summary.old.tp} | ${summary.old.fp} | ${summary.old.tn} | ${summary.old.fn} | ${(summary.old.precision * 100).toFixed(2)}% | ${(summary.old.recall * 100).toFixed(2)}% |`,
  `| 감사 후 | ${summary.audited.tp} | ${summary.audited.fp} | ${summary.audited.tn} | ${summary.audited.fn} | ${(summary.audited.precision * 100).toFixed(2)}% | ${(summary.audited.recall * 100).toFixed(2)}% |`,
  "",
  "## 사례별 변경",
  "",
  "| caseId | 기존 | 감사 후 | 수동 판정 | 신규 오류 코드 |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map(
    (row) =>
      `| ${row.caseId} | ${row.oldAutomaticFailure ? "fail" : "pass"} | ${row.auditedAutomaticFailure ? "fail" : "pass"} | ${row.manualJudgment} | ${row.auditedFatalCodes.join(", ") || "-"} |`,
  ),
  "",
].join("\n");

await Promise.all([
  writeFile(
    resolve(root, "reports/survey-regression-v1.1-regrade.json"),
    `${JSON.stringify({ summary, rows }, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    resolve(root, "reports/survey-regression-v1.1-regrade.md"),
    `${report}\n`,
    "utf8",
  ),
]);

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
