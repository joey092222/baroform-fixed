import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  mergeDatasets,
  readRegressionDataset,
} from "../evals/survey-regression/v1/dataset-utils";
import { assertNoSecrets } from "../evals/survey-regression/v1/evaluation";
import type { SurveyRegressionResult } from "../evals/survey-regression/v1/schema";

const root = process.cwd();
const runId = "preview-100-v1";
const artifactDirectory = resolve(
  root,
  ".artifacts/survey-regression/v1",
  runId,
);
const resultsPath = resolve(artifactDirectory, "results.json");
const summaryPath = resolve(root, "reports/survey-regression-v1-summary.md");
const [resultsRaw, summaryRaw, dev, holdout] = await Promise.all([
  readFile(resultsPath, "utf8"),
  readFile(summaryPath, "utf8"),
  readRegressionDataset(resolve(root, "evals/survey-regression/v1/dev.json")),
  readRegressionDataset(resolve(root, "evals/survey-regression/v1/holdout.json")),
]);
assertNoSecrets(resultsRaw);
assertNoSecrets(summaryRaw);
const results = JSON.parse(resultsRaw) as SurveyRegressionResult[];
if (results.length !== 100) throw new Error(`BASELINE_RESULT_COUNT:${results.length}`);
const cases = mergeDatasets(dev, holdout);
const resultById = new Map(results.map((item) => [item.caseId, item]));
if (cases.some((item) => !resultById.has(item.id))) {
  throw new Error("BASELINE_CASE_RESULT_MISMATCH");
}

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const countBy = <T>(values: T[], key: (value: T) => string | number | null) =>
  Object.fromEntries(
    [...values.reduce((map, value) => {
      const name = String(key(value) ?? "null");
      map.set(name, (map.get(name) ?? 0) + 1);
      return map;
    }, new Map<string, number>())].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
const latencyValues = results.map((item) => item.latencyMs).sort((a, b) => a - b);
const percentile = (p: number) =>
  latencyValues[Math.max(0, Math.ceil(latencyValues.length * p) - 1)] ?? 0;
const telemetryAvailable = results.some(
  (item) => item.inputTokens > 0 || item.outputTokens > 0 || item.estimatedCostUsd > 0,
);

const caseSummary = cases.map((testCase) => {
  const result = resultById.get(testCase.id)!;
  return {
    caseId: result.caseId,
    split: result.split,
    input: result.input,
    expectedOutcome: testCase.expectedOutcome,
    expectedTargetPopulation: testCase.expectedTargetPopulation,
    expectedSurveyObject: testCase.expectedSurveyObject,
    expectedPurposeConcepts: testCase.expectedPurposeConcepts,
    actualRespondentGroup: result.finalRespondentGroup,
    actualEvaluationTarget: result.finalEvaluationTarget,
    actualPurposeOrGoal: result.description,
    generationSource: result.generationSource,
    classification: result.classification,
    modelCallCount: result.modelCallCount,
    repairCount: result.repairCount,
    fallbackCount: result.fallbackCount,
    errorCode: result.fatalFailures[0]?.code ?? null,
    errorStage: result.fatalFailures[0]?.cluster ?? null,
    schemaIssues: result.schemaIssues,
    semanticIssues: result.semanticIssues,
    qualityIssues: result.qualityIssues,
    questionTitles: result.questions.map((question) => question.title),
    automaticJudgment:
      result.fatalFailures.length === 0 ? "auto_pass" : "auto_failure",
    manualJudgment: null,
    manualRationale: null,
    requestId: result.requestId,
    tokenUsage: telemetryAvailable
      ? {
          input: result.inputTokens,
          cachedInput: result.cachedInputTokens,
          output: result.outputTokens,
          total: result.totalTokens,
          estimatedCostUsd: result.estimatedCostUsd,
        }
      : null,
    latencyMs: result.latencyMs,
  };
});

const manifest = {
  version: "v1",
  frozenAt: new Date().toISOString(),
  runId,
  applicationBaseline: {
    branch: "codex/trace-ai-input-distortion",
    commitSha: "b2c52ca82af1c5c16fae3fb72af20bf34436f8c7",
  },
  evaluationBranch: "codex/survey-ai-regression-100-v1",
  datasetVersion: "v1",
  seeds: { dev: dev.seed, seenHoldout: holdout.seed },
  caseIds: {
    dev: dev.cases.map((item) => item.id),
    seenHoldout: holdout.cases.map((item) => item.id),
  },
  counts: {
    total: results.length,
    dev: dev.cases.length,
    seenHoldout: holdout.cases.length,
    modelCallsIncludingRetries: results.reduce(
      (sum, item) => sum + item.modelCallCount + item.retryCount,
      0,
    ),
    retries: results.reduce((sum, item) => sum + item.retryCount, 0),
    automaticPass: results.filter((item) => item.fatalFailures.length === 0).length,
    automaticFailure: results.filter((item) => item.fatalFailures.length > 0).length,
  },
  generationPaths: countBy(results, (item) => item.classification),
  httpStatus: countBy(results, (item) => item.httpStatus),
  telemetry: {
    tokenUsageAvailable: telemetryAvailable,
    actualEstimatedCostUsd: telemetryAvailable
      ? results.reduce((sum, item) => sum + item.estimatedCostUsd, 0)
      : null,
    projectedCostUsd: 15.601894999999994,
    latencyMs: {
      average:
        results.reduce((sum, item) => sum + item.latencyMs, 0) / results.length,
      median: percentile(0.5),
      p95: percentile(0.95),
      max: Math.max(...latencyValues),
    },
  },
  immutableSources: {
    resultsPath: ".artifacts/survey-regression/v1/preview-100-v1/results.json",
    resultsSha256: sha256(resultsRaw),
    summaryPath: "reports/survey-regression-v1-summary.md",
    summarySha256: sha256(summaryRaw),
  },
};

const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
const caseSummaryRaw = `${JSON.stringify(caseSummary, null, 2)}\n`;
assertNoSecrets(manifestRaw);
assertNoSecrets(caseSummaryRaw);
await Promise.all([
  writeFile(
    resolve(root, "reports/survey-regression-v1-baseline-manifest.json"),
    manifestRaw,
    "utf8",
  ),
  writeFile(
    resolve(root, "reports/survey-regression-v1-case-summary.json"),
    caseSummaryRaw,
    "utf8",
  ),
  writeFile(
    resolve(root, "reports/survey-regression-v1-baseline-summary.md"),
    `${summaryRaw.trimEnd()}\n\n---\n\n이 문서는 run \`${runId}\`의 불변 baseline 사본입니다. 원본 결과 SHA-256은 manifest에 기록돼 있습니다.\n`,
    "utf8",
  ),
]);

process.stdout.write(
  `${JSON.stringify({
    runId,
    cases: caseSummary.length,
    resultsSha256: manifest.immutableSources.resultsSha256,
    telemetryAvailable,
  }, null, 2)}\n`,
);
