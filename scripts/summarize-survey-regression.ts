import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  mergeDatasets,
  readRegressionDataset,
  validateDatasetQuality,
} from "../evals/survey-regression/v1/dataset-utils";
import type {
  GenerationPath,
  SurveyRegressionResult,
} from "../evals/survey-regression/v1/schema";

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...rest] = argument.split("=");
    return [key.replace(/^--/, ""), rest.join("=") || "true"];
  }),
);
const runId = args.get("run-id");
if (!runId || !/^[A-Za-z0-9._-]{3,100}$/.test(runId)) {
  throw new Error("RUN_ID_REQUIRED");
}

const root = process.cwd();
const datasets = await Promise.all([
  readRegressionDataset(resolve(root, "evals/survey-regression/v1/dev.json")),
  readRegressionDataset(resolve(root, "evals/survey-regression/v1/holdout.json")),
]);
const cases = mergeDatasets(...datasets);
const quality = validateDatasetQuality(cases);
const artifactDirectory = resolve(root, ".artifacts/survey-regression/v1", runId);
const results = JSON.parse(
  await readFile(resolve(artifactDirectory, "results.json"), "utf8"),
) as SurveyRegressionResult[];
const projection = JSON.parse(
  await readFile(resolve(artifactDirectory, "cost-projection.json"), "utf8"),
) as Record<string, unknown>;

const generationPaths: GenerationPath[] = [
  "clean_model_success",
  "deterministic_metadata_normalization",
  "partial_repair",
  "hard_fallback",
  "request_failure",
  "clarification",
];

function count(path: GenerationPath, split?: "dev" | "holdout") {
  return results.filter((item) => item.classification === path && (!split || item.split === split)).length;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[Math.max(0, index)];
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metric(values: number[]) {
  return {
    average: average(values),
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: values.length === 0 ? 0 : Math.max(...values),
  };
}

function stableSample(items: SurveyRegressionResult[], count: number, seed: string) {
  return [...items]
    .sort((left, right) =>
      createHash("sha256").update(`${seed}:${left.caseId}`).digest("hex")
        .localeCompare(createHash("sha256").update(`${seed}:${right.caseId}`).digest("hex")),
    )
    .slice(0, count)
    .map((item) => item.caseId);
}

const clearResults = results.filter((item) => !item.expected.clarificationExpected);
const clarificationResults = results.filter((item) => item.expected.clarificationExpected);
const fatalFailures = results.flatMap((item) =>
  item.fatalFailures.map((failure) => ({ ...failure, caseId: item.caseId, requestId: item.requestId })),
);
const clusterCounts = new Map<string, string[]>();
for (const failure of fatalFailures) {
  clusterCounts.set(failure.cluster, [...(clusterCounts.get(failure.cluster) ?? []), failure.caseId]);
}
const cleanOrNormalized = clearResults.filter((item) =>
  item.classification === "clean_model_success" ||
  item.classification === "deterministic_metadata_normalization",
).length;
const partialRepair = clearResults.filter((item) => item.classification === "partial_repair").length;
const criteria = {
  complete: results.length === 100,
  noFatal: fatalFailures.length === 0,
  noClearHardFallback: clearResults.every((item) => item.classification !== "hard_fallback"),
  noRequestFailure: results.every((item) => item.classification !== "request_failure"),
  clarificationPerfect:
    clarificationResults.length === 8 &&
    clarificationResults.every((item) => item.classification === "clarification" && item.fatalFailures.length === 0),
  noUnexpectedClarification: clearResults.every((item) => item.classification !== "clarification"),
  cleanOrNormalizedAtLeast90:
    clearResults.length > 0 && cleanOrNormalized / clearResults.length >= 0.9,
  partialRepairAtMost10:
    clearResults.length > 0 && partialRepair / clearResults.length <= 0.1,
  holdoutNoFatal: results.filter((item) => item.split === "holdout").every((item) => item.fatalFailures.length === 0),
  holdoutNoHardFallback: results.filter((item) => item.split === "holdout").every((item) => item.classification !== "hard_fallback"),
  holdoutNoRequestFailure: results.filter((item) => item.split === "holdout").every((item) => item.classification !== "request_failure"),
};
const verdict = Object.values(criteria).every(Boolean)
  ? "READY_FOR_TOKEN_OPTIMIZATION"
  : "NOT_READY_FOR_TOKEN_OPTIMIZATION";
const tokens = {
  input: metric(results.map((item) => item.inputTokens).filter((value) => value > 0)),
  output: metric(results.map((item) => item.outputTokens).filter((value) => value > 0)),
  total: metric(results.map((item) => item.totalTokens).filter((value) => value > 0)),
  latency: metric(results.map((item) => item.latencyMs).filter((value) => value > 0)),
};
const actualCost = results.reduce((sum, item) => sum + item.estimatedCostUsd, 0);
const usageTelemetryAvailable = results.some(
  (item) => item.inputTokens > 0 || item.outputTokens > 0 || item.estimatedCostUsd > 0,
);
const actualCalls = results.reduce((sum, item) => sum + item.modelCallCount + item.retryCount, 0);
const retries = results.reduce((sum, item) => sum + item.retryCount, 0);
const webSearchCalls = results.reduce((sum, item) => sum + item.webSearchCalls, 0);
const auditManifest = {
  allRequestFailures: results.filter((item) => item.classification === "request_failure").map((item) => item.caseId),
  allHardFallbacks: results.filter((item) => item.classification === "hard_fallback").map((item) => item.caseId),
  allPartialRepairs: results.filter((item) => item.classification === "partial_repair").map((item) => item.caseId),
  allClarifications: results.filter((item) => item.classification === "clarification").map((item) => item.caseId),
  allFatalFailures: [...new Set(fatalFailures.map((item) => item.caseId))],
  sampledCleanModelSuccess: stableSample(
    results.filter((item) => item.classification === "clean_model_success"),
    20,
    "baroform-regression-v1-audit-clean",
  ),
  sampledDeterministicNormalization: stableSample(
    results.filter((item) => item.classification === "deterministic_metadata_normalization"),
    10,
    "baroform-regression-v1-audit-normalized",
  ),
};
await writeFile(
  resolve(artifactDirectory, "audit-manifest.json"),
  `${JSON.stringify(auditManifest, null, 2)}\n`,
);

const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const byCategory = Object.entries(quality.byCategory)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([category, total]) => {
    const categoryResults = results.filter((item) => item.expected.category === category);
    const passed = categoryResults.filter((item) => item.fatalFailures.length === 0).length;
    return `| ${category} | ${total} | ${passed} | ${total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0"}% |`;
  })
  .join("\n");
const pathRows = generationPaths.map((path) => {
  const total = count(path);
  return `| ${path} | ${count(path, "dev")} | ${count(path, "holdout")} | ${total} | ${results.length ? ((total / results.length) * 100).toFixed(1) : "0.0"}% |`;
}).join("\n");
const clusterRows = [...clusterCounts.entries()]
  .sort((left, right) => right[1].length - left[1].length)
  .map(([cluster, caseIds], index) =>
    `| ${index + 1} | ${cluster} | ${caseIds.length} | ${caseIds.slice(0, 3).join(", ")} | 결과 artifact의 최초 실패 단계 확인 필요 |`,
  ).join("\n") || "| - | 없음 | 0 | - | - |";
const fatalRows = fatalFailures.map((item) =>
  `| ${item.caseId} | ${item.code} | ${item.cluster} | ${item.requestId ?? "-"} | ${item.message.replace(/\|/g, "\\|")} |`,
).join("\n") || "| - | 없음 | - | - | - |";
const largestInputs = [...results].sort((a, b) => b.inputTokens - a.inputTokens).slice(0, 10)
  .map((item) => `${item.caseId} (${item.inputTokens.toLocaleString()} tokens)`).join(", ");
const slowest = [...results].sort((a, b) => b.latencyMs - a.latencyMs).slice(0, 10)
  .map((item) => `${item.caseId} (${(item.latencyMs / 1000).toFixed(1)}s)`).join(", ");

const report = `# 바로폼 설문 회귀·Holdout 평가 v1

## 1. 기준 환경

- 기준 브랜치: \`codex/trace-ai-input-distortion\`
- 기준 커밋: \`b2c52ca82af1c5c16fae3fb72af20bf34436f8c7\`
- 평가 브랜치: \`${branch}\`
- 평가 HEAD: \`${commit}\`
- 실제 호출 수(재시도 포함): ${actualCalls}
- 재시도: ${retries}
- 웹 검색 호출: ${webSearchCalls}
- 실행 전 예상 비용: $${Number(projection.projectedCostUsd ?? 0).toFixed(4)}
- 로그 기반 실제 추정 비용: ${usageTelemetryAvailable ? `$${actualCost.toFixed(4)}` : "미수집 (Vercel 로그 조회 결과 없음)"}

## 2. 데이터셋 구성

- 개발 세트: ${quality.counts.dev}
- Holdout: ${quality.counts.holdout}
- 총 사례: ${quality.counts.total}
- 일반/정밀·연구: ${quality.counts.standard}/${quality.counts.research}
- clarification: ${quality.counts.clarification}
- 부정 표현: ${quality.counts.negation}
- 실제 복수 대상: ${quality.counts.multipleTargets}
- 개발 seed: \`${datasets[0].seed}\`
- Holdout seed: \`${datasets[1].seed}\`
- 중복 및 유사도 0.88 이상: ${quality.highSimilarityPairs.length}건

## 3. 생성 경로 분포

| 경로 | 개발 | Holdout | 전체 | 비율 |
|---|---:|---:|---:|---:|
${pathRows}

## 4. 치명적 오류

| case ID | 오류 | 군집 | requestId | 실제 내용 |
|---|---|---|---|---|
${fatalRows}

## 5. 카테고리별 성공률

| 카테고리 | 사례 | 치명적 오류 없음 | 비율 |
|---|---:|---:|---:|
${byCategory}

## 6. Holdout 결과

- 사례 수: ${results.filter((item) => item.split === "holdout").length}
- 치명적 오류: ${results.filter((item) => item.split === "holdout" && item.fatalFailures.length > 0).length}
- hard fallback: ${count("hard_fallback", "holdout")}
- request failure: ${count("request_failure", "holdout")}

## 7. 비용·속도 기준

- 평균 input tokens: ${usageTelemetryAvailable ? tokens.input.average.toFixed(1) : "미수집"}
- 중앙값 input tokens: ${usageTelemetryAvailable ? tokens.input.median : "미수집"}
- p95 input tokens: ${usageTelemetryAvailable ? tokens.input.p95 : "미수집"}
- 최대 input tokens: ${usageTelemetryAvailable ? tokens.input.max : "미수집"}
- 평균 output tokens: ${usageTelemetryAvailable ? tokens.output.average.toFixed(1) : "미수집"}
- 평균 total tokens: ${usageTelemetryAvailable ? tokens.total.average.toFixed(1) : "미수집"}
- 평균 latency: ${(tokens.latency.average / 1000).toFixed(2)}초
- p95 latency: ${(tokens.latency.p95 / 1000).toFixed(2)}초
- 최대 latency: ${(tokens.latency.max / 1000).toFixed(2)}초
- input token 상위 10개: ${usageTelemetryAvailable ? largestInputs || "없음" : "미수집"}
- latency 상위 10개: ${slowest || "없음"}

## 8. 다음 수정 우선순위

| 우선순위 | 실패 군집 | 사례 수 | 대표 case ID | 공통 최초 실패 단계 |
|---:|---|---:|---|---|
${clusterRows}

이번 평가 브랜치에서는 위 오류를 수정하지 않는다.

## 9. 수동 감사 범위

- manifest: \`.artifacts/survey-regression/v1/${runId}/audit-manifest.json\`
- request failure, hard fallback, partial repair, clarification, fatal failure는 전수 감사 대상이다.
- clean model success 20개와 deterministic normalization 10개는 고정 seed 표본이다.

## 10. 토큰 최적화 진입 판정

판정: **${verdict}**

\`\`\`json
${JSON.stringify(criteria, null, 2)}
\`\`\`
`;

await writeFile(resolve(root, "reports/survey-regression-v1-summary.md"), report, "utf8");
process.stdout.write(`${JSON.stringify({
  runId,
  verdict,
  criteria,
  actualCalls,
  retries,
  actualCost: usageTelemetryAvailable ? actualCost : null,
  usageTelemetryAvailable,
  tokens: usageTelemetryAvailable ? tokens : { latency: tokens.latency },
}, null, 2)}\n`);
