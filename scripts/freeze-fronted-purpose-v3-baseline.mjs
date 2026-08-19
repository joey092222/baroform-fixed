import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const firstRunPath = resolve(
  root,
  ".artifacts/survey-regression/v1.1-fronted-purpose/fronted-purpose-remediation-42dccef-a1/results.json",
);
const retryRunPath = resolve(
  root,
  ".artifacts/survey-regression/v1.1-fronted-purpose/fronted-purpose-remediation-42dccef-rate-retry-a1/results.json",
);
const jsonTarget = resolve(root, "reports/fronted-purpose-v3-partial-repair-baseline.json");
const markdownTarget = resolve(root, "reports/fronted-purpose-v3-partial-repair-baseline.md");

const firstRun = JSON.parse(await readFile(firstRunPath, "utf8"));
const retryRun = JSON.parse(await readFile(retryRunPath, "utf8"));
const byCaseId = new Map(firstRun.map((item) => [item.caseId, item]));
for (const item of retryRun) byCaseId.set(item.caseId, item);
const results = [...byCaseId.values()].sort((left, right) =>
  left.caseId.localeCompare(right.caseId),
);

const pathCounts = Object.fromEntries(
  [...new Set(results.map((item) => item.classification))].sort().map((path) => [
    path,
    results.filter((item) => item.classification === path).length,
  ]),
);

const repairEvidence = {
  "fronted-clear-001": {
    issue: "전반적 만족도를 직접 측정하지 않는다는 quality issue",
    observed: "기존 직접 만족도 척도 뒤에 유사 만족도 선택 문항이 추가됨",
  },
  "fronted-clear-002": {
    issue: "PREDICATE_ENTITY_MISMATCH",
    observed: "canonical 대상의 문맥상 축약 표현을 관계 불일치로 판정함",
  },
  "fronted-control-001": {
    issue: "UNNECESSARY_SCREENING",
    observed: "전체 학생 대상 이용 여부 routing을 탈락형 screening으로 판정함",
  },
  "fronted-noisy-002": {
    issue: "PREDICATE_ENTITY_MISMATCH",
    observed: "noisy 입력에서도 canonical 대상의 축약 표현을 관계 불일치로 판정함",
  },
};

const snapshot = {
  schemaVersion: 3,
  baselineId: "fronted-purpose-v3-partial-repair-baseline",
  immutable: true,
  capturedAt: "2026-08-19",
  source: {
    branch: "codex/fix-survey-regression-root-causes-v1",
    commit: "42dccef5f32568f5078429d29917fdb5418b7384",
    runs: [
      "fronted-purpose-remediation-42dccef-a1",
      "fronted-purpose-remediation-42dccef-rate-retry-a1",
    ],
    environment: "Preview",
    note: "첫 실행의 429 사례만 허용된 1회 재시도 결과로 교체함",
  },
  summary: {
    completed: results.length,
    expectedSurveys: 17,
    expectedClarifications: 3,
    paths: pathCounts,
    fatalCases: results.filter((item) => item.fatalFailures.length > 0).length,
    actualModelCalls: results.reduce((sum, item) => sum + item.modelCallCount, 0),
    infrastructureRetries: retryRun.length,
    aggregateUsageFromPreviewLogs: {
      inputTokens: 292_879,
      outputTokens: 49_294,
      totalTokens: 342_173,
      webSearchCalls: 3,
      estimatedCostUsd: 1.436845,
    },
    modelLatencyMsFromPreviewLogs: {
      average: 31_027,
      p95: 84_430,
      maximum: 84_430,
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
    generationSource: item.generationSource,
    fallbackReason: item.fallbackReason,
    classification: item.classification,
    modelCallCount: item.modelCallCount,
    repairCount: item.repairCount,
    fallbackCount: item.fallbackCount,
    normalizedMetadataPaths: item.normalizedMetadataPaths,
    finalRespondentGroup: item.finalRespondentGroup,
    finalEvaluationTarget: item.finalEvaluationTarget,
    title: item.title,
    description: item.description,
    questions: item.questions,
    questionsBeforePostprocess: item.questionsBeforePostprocess,
    schemaIssues: item.schemaIssues,
    semanticIssues: item.semanticIssues,
    qualityIssues: item.qualityIssues,
    fatalFailures: item.fatalFailures,
    warnings: item.warnings,
    repairEvidence: repairEvidence[item.caseId] ?? null,
    latencyMs: item.latencyMs,
  })),
};

await writeFile(jsonTarget, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

const lines = [
  "# Fronted-purpose v3 partial-repair baseline",
  "",
  `- 브랜치: ${snapshot.source.branch}`,
  `- 기준 커밋: ${snapshot.source.commit}`,
  `- 완료: ${snapshot.summary.completed}/20`,
  `- 경로: ${Object.entries(pathCounts).map(([key, value]) => `${key} ${value}`).join(", ")}`,
  `- 모델 호출: ${snapshot.summary.actualModelCalls}, 인프라 429 재시도: ${snapshot.summary.infrastructureRetries}`,
  `- 사용량: input ${snapshot.summary.aggregateUsageFromPreviewLogs.inputTokens}, output ${snapshot.summary.aggregateUsageFromPreviewLogs.outputTokens}, total ${snapshot.summary.aggregateUsageFromPreviewLogs.totalTokens}, cost $${snapshot.summary.aggregateUsageFromPreviewLogs.estimatedCostUsd}`,
  "- 비밀값, Preview share token, Authorization, Cookie, 전체 developer prompt를 포함하지 않음.",
  "",
];

for (const item of snapshot.cases) {
  lines.push(
    `## ${item.caseId}`,
    "",
    `- 입력: ${item.input}`,
    `- requestId: ${item.requestId ?? "null"}`,
    `- 경로: ${item.generationSource ?? "null"} / ${item.classification}`,
    `- model / repair / fallback: ${item.modelCallCount} / ${item.repairCount} / ${item.fallbackCount}`,
    `- respondentGroup: ${item.finalRespondentGroup ?? "null"}`,
    `- evaluationTarget: ${item.finalEvaluationTarget ?? "null"}`,
    `- repair issue: ${item.repairEvidence?.issue ?? "없음"}`,
    `- 관측: ${item.repairEvidence?.observed ?? "없음"}`,
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
