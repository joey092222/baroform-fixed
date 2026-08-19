import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(
  root,
  ".artifacts/survey-regression/v1.1-fronted-purpose/fronted-purpose-v2-20260819-222801-a1/results.json",
);
const jsonTarget = resolve(root, "reports/fronted-purpose-v2-before-remediation.json");
const markdownTarget = resolve(root, "reports/fronted-purpose-v2-before-remediation.md");
const results = JSON.parse(await readFile(source, "utf8"));

const paths = Object.fromEntries(
  [...new Set(results.map((item) => item.classification))].map((path) => [
    path,
    results.filter((item) => item.classification === path).length,
  ]),
);

const knownRejectionEvidence = {
  "fronted-clear-002": [
    "문항 3가 앞선 문항과 중복됩니다.",
    "SEMANTIC_RELATION_INVALID: 사용자 입력에 없는 제품·서비스가 행동 대상으로 추가됨.",
  ],
  "fronted-noisy-002": [
    "SEMANTIC_RELATION_INVALID: 사용자 입력에 없는 제품·서비스가 행동 대상으로 추가됨.",
  ],
  "fronted-clear-007": [
    "모델 self-report respondent_path_simulation_passed=false가 전체 설문 거절을 유발함.",
  ],
  "fronted-clear-008": [
    "모델 self-report double_barreled_questions_removed=false가 전체 설문 거절을 유발함.",
  ],
  "fronted-control-001": [
    "빈도 선택지 '한 학기에 1~2회'와 '한 달에 1~3회'가 서로 겹침.",
  ],
};

const evaluatorFalsePositiveIds = new Set([
  "fronted-clear-004",
  "fronted-noisy-001",
  "fronted-control-003",
]);

const snapshot = {
  schemaVersion: 2,
  baselineId: "fronted-purpose-v2-before-remediation",
  immutable: true,
  capturedAt: "2026-08-19",
  source: {
    branch: "codex/fix-survey-regression-root-causes-v1",
    commit: "4083eacb18794e2771aca80322d058e8f59940bc",
    runId: "fronted-purpose-v2-20260819-222801-a1",
    artifact: ".artifacts/survey-regression/v1.1-fronted-purpose/fronted-purpose-v2-20260819-222801-a1/results.json",
    environment: "Preview",
  },
  summary: {
    completed: results.length,
    expectedSurveys: 17,
    expectedClarifications: 3,
    actualModelCalls: results.reduce((sum, item) => sum + item.modelCallCount, 0),
    retries: results.reduce((sum, item) => sum + item.retryCount, 0),
    paths,
    fatalCases: results.filter((item) => item.fatalFailures.length > 0).length,
    evaluatorFalsePositives: evaluatorFalsePositiveIds.size,
    aggregateUsageFromPreviewLogs: {
      inputTokens: 295_018,
      cachedInputTokens: 15_450,
      outputTokens: 52_612,
      totalTokens: 347_630,
      webSearchCalls: 3,
      estimatedCostUsd: 1.491962,
    },
    modelLatencyMsFromPreviewLogs: {
      average: 28_725,
      p95: 45_505,
      maximum: 45_505,
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
    normalizedMetadataPaths: item.normalizedMetadataPaths,
    finalRespondentGroup: item.finalRespondentGroup,
    finalEvaluationTarget: item.finalEvaluationTarget,
    title: item.title,
    description: item.description,
    questions: item.questions,
    responseDiagnostics: item.responseDiagnostics,
    fatalFailures: item.fatalFailures,
    warnings: item.warnings,
    evaluatorFalsePositive: evaluatorFalsePositiveIds.has(item.caseId),
    modelQualityCheck: "not_exposed_in_response_artifact",
    rejectionEvidence: knownRejectionEvidence[item.caseId] ?? [],
    latencyMs: item.latencyMs,
  })),
};

await writeFile(jsonTarget, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

const lines = [
  "# Fronted-purpose v2 before remediation",
  "",
  `- 브랜치: ${snapshot.source.branch}`,
  `- 기준 커밋: ${snapshot.source.commit}`,
  `- 실행: ${snapshot.source.runId}`,
  `- 완료: ${snapshot.summary.completed}/20, 실제 모델 호출: ${snapshot.summary.actualModelCalls}, retry: ${snapshot.summary.retries}`,
  `- 경로: ${Object.entries(paths).map(([key, value]) => `${key} ${value}`).join(", ")}`,
  `- evaluator false positive: ${snapshot.summary.evaluatorFalsePositives}`,
  `- Preview 로그 집계: input ${snapshot.summary.aggregateUsageFromPreviewLogs.inputTokens}, cached ${snapshot.summary.aggregateUsageFromPreviewLogs.cachedInputTokens}, output ${snapshot.summary.aggregateUsageFromPreviewLogs.outputTokens}, total ${snapshot.summary.aggregateUsageFromPreviewLogs.totalTokens}, cost $${snapshot.summary.aggregateUsageFromPreviewLogs.estimatedCostUsd}`,
  "- 모델 quality_check 원문은 API 응답 artifact에 노출되지 않아 `not_exposed_in_response_artifact`로 명시함. 알려진 거절 필드는 같은 requestId의 Preview runtime log 근거만 기록함.",
  "- 비밀값, Preview share token, Authorization, Cookie, 전체 developer prompt를 포함하지 않음.",
  "",
];

for (const item of snapshot.cases) {
  lines.push(
    `## ${item.caseId}`,
    "",
    `- 입력: ${item.input}`,
    `- requestId: ${item.requestId ?? "null"}`,
    `- HTTP / 응답: ${item.httpStatus ?? "null"} / ${item.responseType ?? "null"} / ${item.responseStatus ?? "null"}`,
    `- 생성 경로: ${item.generationSource ?? "null"} / ${item.classification}`,
    `- fallbackReason: ${item.fallbackReason ?? "null"}`,
    `- model / repair / fallback / retry: ${item.modelCallCount} / ${item.repairCount} / ${item.fallbackCount} / ${item.retryCount}`,
    `- evaluator false positive: ${item.evaluatorFalsePositive}`,
    `- model quality_check: ${item.modelQualityCheck}`,
    `- rejection evidence: ${item.rejectionEvidence.join(" | ") || "없음"}`,
    `- fatal: ${item.fatalFailures.map((issue) => `${issue.code}: ${issue.message}`).join(" | ") || "없음"}`,
    `- respondentGroup: ${item.finalRespondentGroup ?? "null"}`,
    `- evaluationTarget: ${item.finalEvaluationTarget ?? "null"}`,
    `- 제목: ${item.title ?? "null"}`,
    `- 설명: ${item.description ?? "null"}`,
    `- latency: ${item.latencyMs}ms`,
    "",
    "### 최종 문항",
    "",
  );
  if (item.questions.length === 0) {
    lines.push("- 반환된 최종 문항 없음", "");
  } else {
    item.questions.forEach((question, index) => {
      const options = question.options.length > 0
        ? ` — ${question.options.join(" / ")}`
        : "";
      lines.push(`${index + 1}. ${question.title} (${question.type})${options}`);
    });
    lines.push("");
  }
}

await writeFile(markdownTarget, `${lines.join("\n").trimEnd()}\n`, "utf8");
