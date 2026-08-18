import { readFile, writeFile } from "node:fs/promises";

import { openAiPricing } from "../../../app/lib/ai/openai-runtime";
import { resolveSurveyGenerationModel } from "../../../app/lib/ai/model-router";
import type { SurveyRegressionCase, SurveyRegressionResult } from "./schema";

export const liveEvaluationCostCapUsd = 100;
export const liveEvaluationModelCallCap = 150;
export const liveEvaluationConcurrency = 2;

export type LiveCheckpointCaseSummary = {
  caseId: string;
  split: "dev" | "holdout";
  requestId: string | null;
  classification: SurveyRegressionResult["classification"];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  errorCode: string | null;
  errorStage: string | null;
  resultFile: string;
};

export type LiveCheckpoint = {
  version: "v1";
  runId: string;
  completedCaseIds: string[];
  caseSummaries: LiveCheckpointCaseSummary[];
  modelCallsIncludingRetries: number;
  consecutiveInfrastructureErrors: number;
  updatedAt: string;
};

export function emptyCheckpoint(runId: string): LiveCheckpoint {
  return {
    version: "v1",
    runId,
    completedCaseIds: [],
    caseSummaries: [],
    modelCallsIncludingRetries: 0,
    consecutiveInfrastructureErrors: 0,
    updatedAt: new Date(0).toISOString(),
  };
}

export async function readCheckpoint(path: string, runId: string) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as LiveCheckpoint;
    if (parsed.version !== "v1" || parsed.runId !== runId) {
      throw new Error("CHECKPOINT_VERSION_OR_RUN_ID_MISMATCH");
    }
    parsed.caseSummaries = Array.isArray(parsed.caseSummaries) ? parsed.caseSummaries : [];
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyCheckpoint(runId);
    throw error;
  }
}

export async function writeCheckpoint(path: string, checkpoint: LiveCheckpoint) {
  const safe = {
    ...checkpoint,
    completedCaseIds: [...new Set(checkpoint.completedCaseIds)].sort(),
    caseSummaries: [...checkpoint.caseSummaries]
      .sort((left, right) => left.caseId.localeCompare(right.caseId))
      .filter((item, index, values) => index === 0 || values[index - 1].caseId !== item.caseId),
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
}

export function pendingCases(
  cases: SurveyRegressionCase[],
  checkpoint: LiveCheckpoint,
) {
  const completed = new Set(checkpoint.completedCaseIds);
  return cases.filter((item) => !completed.has(item.id));
}

function perCaseCost(
  mode: "standard" | "research",
  inputTokens: number,
  outputTokens: number,
) {
  const model = resolveSurveyGenerationModel(mode).model;
  const pricing = openAiPricing.perMillionTokens[model];
  return {
    model,
    costUsd:
      (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000,
  };
}

export function projectLiveEvaluationCost(
  cases: SurveyRegressionCase[],
  options: {
    averageInputTokens?: number;
    averageOutputTokens?: number;
    transientRetryBuffer?: number;
    estimatedWebSearchCostUsd?: number;
  } = {},
) {
  const inputTokens = options.averageInputTokens ?? 25_202;
  const outputTokens = options.averageOutputTokens ?? 3_495;
  const retryBuffer = options.transientRetryBuffer ?? 0.1;
  const estimatedWebSearchCostUsd =
    options.estimatedWebSearchCostUsd ?? cases.length * (10 / 1_000);
  let baseCostUsd = 0;
  const byMode = {
    standard: { cases: 0, model: "", costUsd: 0 },
    research: { cases: 0, model: "", costUsd: 0 },
  };
  for (const item of cases) {
    const estimate = perCaseCost(item.surveyMode, inputTokens, outputTokens);
    baseCostUsd += estimate.costUsd;
    byMode[item.surveyMode].cases += 1;
    byMode[item.surveyMode].model = estimate.model;
    byMode[item.surveyMode].costUsd += estimate.costUsd;
  }
  const projectedCostUsd =
    baseCostUsd * (1 + retryBuffer) + estimatedWebSearchCostUsd;
  return {
    baseline: { inputTokens, outputTokens },
    byMode,
    baseCostUsd,
    retryBuffer,
    estimatedWebSearchCostUsd,
    projectedCostUsd,
    capUsd: liveEvaluationCostCapUsd,
    withinCap: projectedCostUsd <= liveEvaluationCostCapUsd,
  };
}

export function assertWithinModelCallCap(modelCallsIncludingRetries: number) {
  if (modelCallsIncludingRetries > liveEvaluationModelCallCap) {
    throw new Error(
      `LIVE_EVAL_MODEL_CALL_CAP_EXCEEDED:${modelCallsIncludingRetries}:${liveEvaluationModelCallCap}`,
    );
  }
}

export function isInfrastructureFailure(result: SurveyRegressionResult) {
  return result.classification === "request_failure" && result.fatalFailures.some((item) =>
    item.code === "REQUEST_FAILURE" ||
    /timeout|network|connection|http:429|http:5\d\d/i.test(item.message),
  );
}

export function nextInfrastructureErrorCount(
  current: number,
  result: SurveyRegressionResult,
) {
  return isInfrastructureFailure(result) ? current + 1 : 0;
}
