import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const runId = "fronted-purpose-v9-da89f2e-20260820";
const sourcePath = resolve(
  root,
  `.artifacts/survey-regression/v1.1-fronted-purpose/${runId}/results.json`,
);
const jsonTarget = resolve(root, "reports/fronted-purpose-v4-da89f2e-baseline.json");
const markdownTarget = resolve(root, "reports/fronted-purpose-v4-da89f2e-baseline.md");

const results = JSON.parse(await readFile(sourcePath, "utf8"));
const pathCounts = Object.fromEntries(
  [...new Set(results.map((item) => item.classification))]
    .sort()
    .map((path) => [
      path,
      results.filter((item) => item.classification === path).length,
    ]),
);
const sum = (field) =>
  results.reduce((total, item) => total + Number(item[field] ?? 0), 0);
const latencies = results
  .map((item) => Number(item.latencyMs ?? 0))
  .filter((value) => value > 0)
  .sort((left, right) => left - right);

const snapshot = {
  schemaVersion: 4,
  baselineId: "fronted-purpose-v4-da89f2e-baseline",
  immutable: true,
  capturedAt: "2026-08-20",
  source: {
    branch: "codex/fix-survey-regression-root-causes-v1",
    commit: "da89f2e02812c711ddc40eb9fdad13db0e64c8fd",
    runId,
    environment: "Preview",
    deploymentId: "dpl_FyW5zqddjryb8ZGn1robJbbuRf8j",
  },
  summary: {
    completed: results.length,
    paths: pathCounts,
    fatalCases: results.filter((item) => item.fatalFailures.length > 0).length,
    modelCalls: sum("modelCallCount"),
    repairCount: sum("repairCount"),
    fallbackCount: sum("fallbackCount"),
    retryCount: sum("retryCount"),
    inputTokens: sum("inputTokens"),
    cachedInputTokens: sum("cachedInputTokens"),
    outputTokens: sum("outputTokens"),
    totalTokens: sum("totalTokens"),
    webSearchCalls: sum("webSearchCalls"),
    estimatedCostUsd: sum("estimatedCostUsd"),
    latencyMs: {
      average:
        latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0,
      p95: latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0,
      maximum: latencies.at(-1) ?? 0,
    },
  },
  security: {
    containsApiKey: false,
    containsAuthorizationHeader: false,
    containsCookie: false,
    containsPreviewShareToken: false,
    containsFullDeveloperPrompt: false,
  },
  cases: results.map((item) => ({
    caseId: item.caseId,
    input: item.input,
    expected: item.expected,
    requestId: item.requestId,
    httpStatus: item.httpStatus,
    responseType: item.responseType,
    responseStatus: item.responseStatus,
    responseCode: item.responseCode,
    responseStage: item.responseStage,
    generationSource: item.generationSource,
    fallbackReason: item.fallbackReason,
    classification: item.classification,
    modelCallCount: item.modelCallCount,
    repairCount: item.repairCount,
    fallbackCount: item.fallbackCount,
    retryCount: item.retryCount,
    changedQuestionIds: item.changedQuestionIds,
    changedFieldsByQuestion: item.changedFieldsByQuestion,
    metadataOnlyNormalization: item.metadataOnlyNormalization,
    respondentFacingContentChanged: item.respondentFacingContentChanged,
    modelOutputRejectedAt: item.modelOutputRejectedAt,
    modelOutputRejectionCode: item.modelOutputRejectionCode,
    modelOutputRejectionIssues: item.modelOutputRejectionIssues,
    modelOutputRejectionIssuePaths: item.modelOutputRejectionIssuePaths,
    canonicalTargetPopulation: item.canonicalTargetPopulation,
    finalRespondentGroup: item.finalRespondentGroup,
    canonicalSurveyObject: item.canonicalSurveyObject,
    finalEvaluationTarget: item.finalEvaluationTarget,
    title: item.title,
    description: item.description,
    questionsBeforePostprocess: item.questionsBeforePostprocess,
    questions: item.questions,
    schemaIssues: item.schemaIssues,
    semanticIssues: item.semanticIssues,
    qualityIssues: item.qualityIssues,
    fatalFailures: item.fatalFailures,
    warnings: item.warnings,
    inputTokens: item.inputTokens,
    cachedInputTokens: item.cachedInputTokens,
    outputTokens: item.outputTokens,
    totalTokens: item.totalTokens,
    estimatedCostUsd: item.estimatedCostUsd,
    latencyMs: item.latencyMs,
  })),
};

await writeFile(jsonTarget, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

const lines = [
  "# Fronted-purpose v4 da89f2e baseline",
  "",
  `- 브랜치: ${snapshot.source.branch}`,
  `- 기준 커밋: ${snapshot.source.commit}`,
  `- Preview deployment: ${snapshot.source.deploymentId}`,
  `- 완료: ${snapshot.summary.completed}/20`,
  `- 경로: ${Object.entries(pathCounts).map(([key, value]) => `${key} ${value}`).join(", ")}`,
  `- model / repair / fallback / retry: ${snapshot.summary.modelCalls} / ${snapshot.summary.repairCount} / ${snapshot.summary.fallbackCount} / ${snapshot.summary.retryCount}`,
  `- token input / cached / output / total: ${snapshot.summary.inputTokens} / ${snapshot.summary.cachedInputTokens} / ${snapshot.summary.outputTokens} / ${snapshot.summary.totalTokens}`,
  `- 예상 비용: $${snapshot.summary.estimatedCostUsd.toFixed(6)}`,
  `- latency 평균 / p95 / 최대: ${snapshot.summary.latencyMs.average} / ${snapshot.summary.latencyMs.p95} / ${snapshot.summary.latencyMs.maximum}ms`,
  "- 비밀값, Authorization, Cookie, Preview share token, 전체 prompt는 포함하지 않음.",
  "",
];

for (const item of snapshot.cases) {
  lines.push(
    `## ${item.caseId}`,
    "",
    `- 입력: ${item.input}`,
    `- requestId: ${item.requestId ?? "null"}`,
    `- 경로: ${item.generationSource ?? "null"} / ${item.classification}`,
    `- fallback: ${item.fallbackReason ?? "없음"}`,
    `- model / repair / fallback / retry: ${item.modelCallCount} / ${item.repairCount} / ${item.fallbackCount} / ${item.retryCount}`,
    `- 오류: ${[...item.fatalFailures, ...item.warnings].map((issue) => issue.code).join(", ") || "없음"}`,
    `- token total / latency / cost: ${item.totalTokens ?? 0} / ${item.latencyMs ?? 0}ms / $${Number(item.estimatedCostUsd ?? 0).toFixed(6)}`,
    "",
    "### 최종 문항",
    "",
  );
  item.questions.forEach((question, index) => {
    const options = question.options.length > 0 ? ` — ${question.options.join(" / ")}` : "";
    lines.push(`${index + 1}. ${question.title} (${question.type})${options}`);
  });
  lines.push("");
}

await writeFile(markdownTarget, `${lines.join("\n").trimEnd()}\n`, "utf8");
