import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  GET as pollSurveyDraft,
  POST as createSurveyDraft,
} from "../app/api/survey-draft/route";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import {
  mergeDatasets,
  readRegressionDataset,
  validateDatasetQuality,
} from "../evals/survey-regression/v1/dataset-utils";
import {
  assertNoSecrets,
  classifyGenerationPath,
  evaluateSemanticResult,
} from "../evals/survey-regression/v1/evaluation";
import {
  assertWithinModelCallCap,
  liveEvaluationConcurrency,
  liveEvaluationCostCapUsd,
  liveEvaluationModelCallCap,
  nextInfrastructureErrorCount,
  pendingCases,
  projectLiveEvaluationCost,
  readCheckpoint,
  writeCheckpoint,
  type LiveCheckpoint,
} from "../evals/survey-regression/v1/runner-utils";
import type {
  SurveyRegressionCase,
  SurveyRegressionResult,
} from "../evals/survey-regression/v1/schema";
import { frontedPurposeSmokeCases } from "../evals/survey-regression/v1.1/fronted-purpose-smoke";

type TraceSnapshot = {
  requestId?: unknown;
  generationSource?: unknown;
  fallbackUsed?: unknown;
  fallbackReason?: unknown;
  modelCallCount?: unknown;
  repairCount?: unknown;
  fallbackCount?: unknown;
  normalizedInternalMetadataPaths?: unknown;
  modelOutputRejectedAt?: unknown;
  modelOutputRejectionCode?: unknown;
  semanticViolationCodes?: unknown;
  qualityViolationCodes?: unknown;
  schemaIssuePaths?: unknown;
  schemaIssueCodes?: unknown;
  questionsBeforePostprocess?: unknown;
  finalQuestions?: unknown;
  responseStatus?: unknown;
  responseIncompleteReason?: unknown;
  outputParsedPresent?: unknown;
  outputItemTypes?: unknown;
  selectedSurveyType?: unknown;
  selectedTemplateKey?: unknown;
  finalMissingRequiredBlockIds?: unknown;
  semanticDuplicateGroups?: unknown;
  totalElapsedMs?: unknown;
  errorCode?: unknown;
  errorStage?: unknown;
};

type UsageLog = {
  requestId?: unknown;
  requestedModel?: unknown;
  actualModel?: unknown;
  inputTokens?: unknown;
  cachedInputTokens?: unknown;
  outputTokens?: unknown;
  totalTokens?: unknown;
  webSearchCalls?: unknown;
  retryCount?: unknown;
  latencyMs?: unknown;
  estimatedCostUsd?: unknown;
};

type BlueprintQuestion = {
  title?: unknown;
  type?: unknown;
  options?: unknown;
  reason?: unknown;
};

type Blueprint = {
  title?: unknown;
  description?: unknown;
  respondentGroup?: unknown;
  evaluationTarget?: unknown;
  aiQuestions?: unknown;
};

const traceSnapshots = new Map<string, TraceSnapshot>();
const usageLogs = new Map<string, UsageLog>();
const originalInfo = console.info;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseArguments() {
  const args = new Map(
    process.argv.slice(2).map((argument) => {
      const [key, ...rest] = argument.split("=");
      return [key.replace(/^--/, ""), rest.join("=") || "true"];
    }),
  );
  const split = args.get("split") ?? "all";
  if (!/^(?:dev|holdout|all)$/.test(split)) throw new Error(`INVALID_SPLIT:${split}`);
  const suite = args.get("suite") ?? "v1";
  if (!/^(?:v1|fronted-purpose)$/.test(suite)) {
    throw new Error(`INVALID_SUITE:${suite}`);
  }
  const runId = args.get("run-id") ?? `live-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(runId)) throw new Error("INVALID_RUN_ID");
  const deployment = args.get("deployment") ?? null;
  const expectedBuildSha = args.get("expected-build-sha") ?? null;
  const expectedBranch = args.get("expected-branch") ?? null;
  const vercelPnpm = args.get("vercel-pnpm") ?? null;
  const previewShareUrl = process.env.BAROFORM_PREVIEW_SHARE_URL?.trim() || null;
  const maxCasesRaw = args.get("max-cases") ?? null;
  const maxCases = maxCasesRaw === null ? null : Number(maxCasesRaw);
  if (maxCases !== null && (!Number.isInteger(maxCases) || maxCases < 1)) {
    throw new Error("INVALID_MAX_CASES");
  }
  const caseIds = (args.get("case-ids") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (caseIds.some((value) => !/^[A-Za-z0-9._-]{3,100}$/.test(value))) {
    throw new Error("INVALID_CASE_IDS");
  }
  const remotePreview = Boolean(deployment);
  if (
    remotePreview &&
    (!expectedBuildSha || !expectedBranch || (!vercelPnpm && !previewShareUrl))
  ) {
    throw new Error("REMOTE_PREVIEW_ARGUMENTS_REQUIRED");
  }
  return {
    split: split as "dev" | "holdout" | "all",
    suite: suite as "v1" | "fronted-purpose",
    runId,
    estimateOnly: args.get("estimate-only") === "true",
    deployment,
    expectedBuildSha,
    expectedBranch,
    vercelPnpm,
    previewShareUrl,
    remotePreview,
    maxCases,
    caseIds,
  };
}

let previewAccessCookies: string | null = null;

function setCookiePairs(headers: Headers) {
  const getSetCookie = (headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie;
  const values = getSetCookie?.call(headers) ?? [];
  return values
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter((value): value is string => Boolean(value));
}

async function authenticatePreviewAccess() {
  if (!args.previewShareUrl) throw new Error("PREVIEW_SHARE_URL_MISSING");
  const cookies = new Map<string, string>();
  let currentUrl = args.previewShareUrl;
  for (let redirectCount = 0; redirectCount < 8; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: cookies.size > 0
        ? { cookie: [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ") }
        : undefined,
    });
    for (const pair of setCookiePairs(response.headers)) {
      const separator = pair.indexOf("=");
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location) break;
    currentUrl = new URL(location, currentUrl).toString();
  }
  if (cookies.size === 0) throw new Error("PREVIEW_SHARE_COOKIE_MISSING");
  previewAccessCookies = [...cookies.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function directPreviewRequest(
  path: string,
  method: "GET" | "POST",
  body?: string,
) {
  if (!args.deployment) throw new Error("REMOTE_PREVIEW_NOT_CONFIGURED");
  if (!previewAccessCookies) await authenticatePreviewAccess();
  const baseUrl = /^https?:\/\//u.test(args.deployment)
    ? args.deployment
    : `https://${args.deployment}`;
  const response = await fetch(new URL(path, baseUrl), {
    method,
    redirect: "manual",
    headers: {
      cookie: previewAccessCookies ?? "",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body,
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("PREVIEW_ACCESS_NOT_AUTHENTICATED");
  }
  return response;
}

function requireLiveEnvironment(remotePreview = false) {
  if (remotePreview) {
    return {
      traceEnabled: true,
      liveTestsAllowed: true,
      previewOpenAiAllowed: true,
      mockDisabled: true,
      apiKeyConfigured: true,
      nonProduction: true,
      transport: "vercel-preview" as const,
    };
  }
  const booleans = {
    traceEnabled: process.env.BAROFORM_AI_TRACE === "true",
    liveTestsAllowed: process.env.BAROFORM_ALLOW_LIVE_AI_TESTS === "true",
    previewOpenAiAllowed:
      process.env.ALLOW_REAL_OPENAI_IN_NON_PRODUCTION === "true",
    mockDisabled: process.env.AI_MOCK_MODE === "false",
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    nonProduction:
      process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production",
  };
  if (Object.values(booleans).some((value) => !value)) {
    throw new Error(
      `LIVE_ENVIRONMENT_GUARD_FAILED:${Object.entries(booleans)
        .filter(([, value]) => !value)
        .map(([key]) => key)
        .join(",")}`,
    );
  }
  return booleans;
}

function headerNumber(headers: Headers, name: string) {
  const value = Number(headers.get(name));
  return Number.isFinite(value) ? value : 0;
}

function headerStrings(headers: Headers, name: string) {
  return (headers.get(name) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function traceFromResponse(response: Response): TraceSnapshot {
  const headers = response.headers;
  return {
    requestId: headers.get("x-baroform-request-id"),
    generationSource: headers.get("x-baroform-generation-source"),
    fallbackUsed: Boolean(headers.get("x-baroform-ai-fallback")),
    fallbackReason: headers.get("x-baroform-ai-fallback"),
    modelCallCount: headerNumber(headers, "x-baroform-model-calls"),
    repairCount: headerNumber(headers, "x-baroform-repair-count"),
    fallbackCount: headerNumber(headers, "x-baroform-fallback-count"),
    normalizedInternalMetadataPaths: headerStrings(
      headers,
      "x-baroform-normalized-metadata",
    ),
    modelOutputRejectedAt: headers.get("x-baroform-model-rejected-at"),
    modelOutputRejectionCode: headers.get("x-baroform-model-rejection-code"),
    semanticViolationCodes: headerStrings(
      headers,
      "x-baroform-final-role-mismatches",
    ),
    qualityViolationCodes: headerStrings(
      headers,
      "x-baroform-final-semantic-duplicates",
    ),
    schemaIssuePaths: headerStrings(headers, "x-baroform-schema-issue-paths"),
    schemaIssueCodes: headerStrings(headers, "x-baroform-schema-issue-codes"),
    responseStatus: headers.get("x-baroform-openai-status"),
    responseIncompleteReason: headers.get(
      "x-baroform-openai-incomplete-reason",
    ),
    outputParsedPresent: headers.get("x-baroform-output-parsed") === "true",
    outputItemTypes: headerStrings(headers, "x-baroform-output-types"),
    selectedSurveyType: headers.get("x-baroform-selected-survey-type"),
    selectedTemplateKey: headers.get("x-baroform-selected-template-key"),
    finalMissingRequiredBlockIds: headerStrings(
      headers,
      "x-baroform-final-missing-blocks",
    ),
    semanticDuplicateGroups: headerStrings(
      headers,
      "x-baroform-final-semantic-duplicates",
    ),
    totalElapsedMs: headerNumber(headers, "x-baroform-generation-ms"),
    errorCode: headers.get("x-baroform-error-code"),
    errorStage: headers.get("x-baroform-error-stage"),
  };
}

function parseVercelCurlResponse(raw: string) {
  const trimmed = raw.trim();
  let wire = trimmed;
  if (!trimmed.startsWith("HTTP/")) {
    let envelope: { response?: unknown; requestId?: unknown } | null = null;
    try {
      envelope = JSON.parse(trimmed) as { response?: unknown; requestId?: unknown };
    } catch {
      const marker = trimmed.lastIndexOf('{"response"');
      if (marker >= 0) {
        envelope = JSON.parse(trimmed.slice(marker)) as {
          response?: unknown;
          requestId?: unknown;
        };
      }
    }
    if (!envelope || typeof envelope.response !== "string") {
      throw new Error("VERCEL_CURL_CONTRACT_INVALID");
    }
    wire = envelope.response;
  }
  const statusStart = wire.lastIndexOf("HTTP/");
  if (statusStart < 0) throw new Error("VERCEL_CURL_HTTP_STATUS_MISSING");
  const crlfEnd = wire.indexOf("\r\n\r\n", statusStart);
  const lfEnd = wire.indexOf("\n\n", statusStart);
  const headerEnd = crlfEnd >= 0 ? crlfEnd : lfEnd;
  const separatorLength = crlfEnd >= 0 ? 4 : 2;
  if (headerEnd < 0) throw new Error("VERCEL_CURL_HEADERS_INVALID");
  const headerBlock = wire.slice(statusStart, headerEnd);
  const lines = headerBlock.split(/\r?\n/);
  const status = Number(lines[0]?.match(/\s(\d{3})(?:\s|$)/)?.[1]);
  if (!Number.isInteger(status)) throw new Error("VERCEL_CURL_STATUS_INVALID");
  const headers = new Headers();
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    headers.append(
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim(),
    );
  }
  return new Response(wire.slice(headerEnd + separatorLength), {
    status,
    headers,
  });
}

async function vercelPreviewRequest(
  path: string,
  method: "GET" | "POST",
  body?: string,
) {
  if (
    !args.deployment ||
    !args.expectedBuildSha ||
    !args.expectedBranch
  ) {
    throw new Error("REMOTE_PREVIEW_NOT_CONFIGURED");
  }
  if (args.previewShareUrl) {
    const response = await directPreviewRequest(path, method, body);
    const buildSha = response.headers.get("x-baroform-build-sha");
    const environment = response.headers.get("x-baroform-environment");
    const branch = response.headers.get("x-baroform-git-branch");
    if (buildSha !== args.expectedBuildSha) {
      throw new Error(`REMOTE_BUILD_SHA_MISMATCH:${buildSha ?? "missing"}`);
    }
    if (environment !== "preview") {
      throw new Error(`REMOTE_ENVIRONMENT_NOT_PREVIEW:${environment ?? "missing"}`);
    }
    if (branch !== args.expectedBranch) {
      throw new Error(`REMOTE_BRANCH_MISMATCH:${branch ?? "missing"}`);
    }
    return response;
  }
  if (!args.vercelPnpm) throw new Error("VERCEL_PNPM_REQUIRED");
  const commandArguments = [
    "dlx",
    "vercel@59.1.3",
    "curl",
    path,
    "--deployment",
    args.deployment,
    "--json",
    "--",
    "--request",
    method,
    "--silent",
    "--show-error",
    "--include",
  ];
  if (body !== undefined) {
    commandArguments.push(
      "--header",
      "content-type: application/json",
      "--data-binary",
      body,
    );
  }
  const output = await new Promise<string>((resolveOutput, reject) => {
    const pnpmDirectory = dirname(args.vercelPnpm!);
    const executable = process.platform === "win32"
      ? resolve(pnpmDirectory, "../../node/bin/node.exe")
      : args.vercelPnpm!;
    const executableArguments = process.platform === "win32"
      ? [
          resolve(pnpmDirectory, "../../node/node_modules/pnpm/bin/pnpm.mjs"),
          ...commandArguments,
        ]
      : commandArguments;
    const child = spawn(executable, executableArguments, {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.resume();
    child.on("error", () => reject(new Error("VERCEL_CURL_SPAWN_FAILED")));
    child.on("close", (code) => {
      if (code === 0) resolveOutput(stdout);
      else reject(new Error(`VERCEL_CURL_EXIT_${code ?? "UNKNOWN"}`));
    });
  });
  const response = parseVercelCurlResponse(output);
  const buildSha = response.headers.get("x-baroform-build-sha");
  const environment = response.headers.get("x-baroform-environment");
  const branch = response.headers.get("x-baroform-git-branch");
  if (buildSha !== args.expectedBuildSha) {
    throw new Error(`REMOTE_BUILD_SHA_MISMATCH:${buildSha ?? "missing"}`);
  }
  if (environment !== "preview") {
    throw new Error(`REMOTE_ENVIRONMENT_NOT_PREVIEW:${environment ?? "missing"}`);
  }
  if (branch !== args.expectedBranch) {
    throw new Error(`REMOTE_BRANCH_MISMATCH:${branch ?? "missing"}`);
  }
  return response;
}

console.info = (...args: unknown[]) => {
  const [marker, payload] = args;
  if (marker === "survey-generation-trace") {
    const snapshot = payload as TraceSnapshot;
    if (typeof snapshot.requestId === "string") {
      traceSnapshots.set(snapshot.requestId, snapshot);
    }
    return;
  }
  if (marker === "baroform-ai-usage") {
    const usage = payload as UsageLog;
    if (typeof usage.requestId === "string") usageLogs.set(usage.requestId, usage);
    return;
  }
  if (marker === "baroform-ai-trace") return;
  originalInfo(...args);
};

async function responseBody(response: Response) {
  try {
    return record(await response.json()) ?? {};
  } catch {
    return {};
  }
}

async function pollBackground(
  responseId: string,
  jobToken: string,
) {
  const deadline = Date.now() + 320_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const url = new URL("http://localhost/api/survey-draft");
    url.searchParams.set("responseId", responseId);
    url.searchParams.set("jobToken", jobToken);
    const response = args.remotePreview
      ? await vercelPreviewRequest(
          `/api/survey-draft?responseId=${encodeURIComponent(responseId)}&jobToken=${encodeURIComponent(jobToken)}`,
          "GET",
        )
      : await pollSurveyDraft(
          new Request(url, {
            method: "GET",
            headers: { origin: "http://localhost", "user-agent": "baroform-regression-v1" },
          }),
        );
    const body = await responseBody(response);
    if (body.type !== "background" || (body.status !== "queued" && body.status !== "in_progress")) {
      return { response, body };
    }
  }
  throw new Error("BACKGROUND_POLL_TIMEOUT");
}

function blueprintQuestions(blueprint: Blueprint | null) {
  const raw = Array.isArray(blueprint?.aiQuestions)
    ? blueprint?.aiQuestions as BlueprintQuestion[]
    : [];
  return raw.map((item) => ({
    title: text(item.title),
    type: text(item.type) || null,
    options: strings(item.options),
    reason: text(item.reason) || null,
  })).filter((item) => item.title);
}

async function executeCase(testCase: SurveyRegressionCase): Promise<SurveyRegressionResult> {
  const requestId = `reg-v1-${testCase.id}-${randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();
  let finalResponse: Response | null = null;
  let finalBody: Record<string, unknown> = {};
  let finalTrace: TraceSnapshot = {};
  try {
    const payload = JSON.stringify({
      prompt: testCase.input,
      userInput: testCase.input,
      surveyMode: testCase.surveyMode,
      targetGrade: "전학년",
      questionCount: testCase.questionCount,
      references: { images: [], files: [], links: [] },
    });
    const initialResponse = args.remotePreview
      ? await vercelPreviewRequest("/api/survey-draft", "POST", payload)
      : await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-regression-v1",
          "x-baroform-client-request-id": requestId,
          "x-baroform-client-submit-at": String(startedAt),
        },
        body: payload,
      }),
    );
    const initialBody = await responseBody(initialResponse);
    const initialSnapshot = args.remotePreview
      ? traceFromResponse(initialResponse)
      : traceSnapshots.get(requestId) ?? {};
    if (args.remotePreview) traceSnapshots.set(requestId, initialSnapshot);
    finalResponse = initialResponse;
    finalBody = initialBody;
    finalTrace = initialSnapshot;
    if (initialBody.type === "background") {
      const responseId = text(initialBody.responseId);
      const jobToken = text(initialBody.jobToken);
      if (!responseId || !jobToken) throw new Error("BACKGROUND_JOB_CONTRACT_INVALID");
      const polled = await pollBackground(responseId, jobToken);
      finalResponse = polled.response;
      finalBody = polled.body;
      const finalRequestId = text(finalBody.requestId);
      finalTrace = args.remotePreview
        ? traceFromResponse(polled.response)
        : traceSnapshots.get(finalRequestId) ?? finalTrace;
    }

    const initialTrace = traceSnapshots.get(requestId) ?? {};
    const usage = usageLogs.get(requestId) ?? {};
    const serverRequestId =
      text(finalBody.requestId) ||
      text(finalTrace.requestId) ||
      text(initialTrace.requestId) ||
      requestId;
    const blueprint = record(finalBody.blueprint) as Blueprint | null;
    const questions = blueprintQuestions(blueprint);
    const canonical = parseCanonicalSurveyIntent(
      testCase.input,
      testCase.surveyMode === "research" ? "research" : "general",
    );
    const generationSource =
      text(finalBody.generationSource) || text(finalTrace.generationSource) ||
      text(initialTrace.generationSource) || null;
    const fallbackReason =
      text(finalBody.fallbackReason) || text(finalTrace.fallbackReason) ||
      text(initialTrace.fallbackReason) || null;
    const responseCode =
      text(finalBody.code) || text(finalTrace.errorCode) ||
      text(initialTrace.errorCode) || null;
    const responseStage =
      text(finalBody.stage) || text(finalTrace.errorStage) ||
      text(initialTrace.errorStage) || null;
    const normalizedMetadataPaths = strings(finalTrace.normalizedInternalMetadataPaths);
    const modelCallCount = Math.max(
      numberValue(initialTrace.modelCallCount),
      numberValue(finalTrace.modelCallCount),
    );
    const repairCount = Math.max(
      numberValue(initialTrace.repairCount),
      numberValue(finalTrace.repairCount),
    );
    const fallbackCount = Math.max(
      numberValue(initialTrace.fallbackCount),
      numberValue(finalTrace.fallbackCount),
    );
    const base = {
      caseId: testCase.id,
      split: testCase.split,
      input: testCase.input,
      expected: testCase,
      requestId: serverRequestId,
      model: text(usage.actualModel) || text(usage.requestedModel) || null,
      httpStatus: finalResponse.status,
      responseType: text(finalBody.type) || null,
      responseStatus: text(finalBody.status) || null,
      responseCode,
      responseStage,
      generationSource,
      modelCallCount,
      repairCount,
      fallbackCount,
      retryCount: numberValue(usage.retryCount),
      fallbackReason,
      normalizedMetadataPaths,
      modelOutputRejected: Boolean(finalTrace.modelOutputRejectedAt),
      canonicalTargetPopulation: canonical.surveyIntent.targetPopulation,
      finalRespondentGroup: text(blueprint?.respondentGroup) || null,
      canonicalSurveyObject:
        canonical.surveyIntent.evaluationTargets.join(" 및 ") ||
        canonical.surveyIntent.surveyObject || null,
      finalEvaluationTarget: text(blueprint?.evaluationTarget) || null,
      title: text(blueprint?.title) || null,
      description: text(blueprint?.description) || null,
      questions,
      questionsBeforePostprocess: strings(finalTrace.questionsBeforePostprocess),
      schemaIssues: [
        ...strings(finalTrace.schemaIssueCodes),
        ...strings(finalTrace.schemaIssuePaths),
      ],
      semanticIssues: strings(finalTrace.semanticViolationCodes),
      qualityIssues: strings(finalTrace.qualityViolationCodes),
      inputTokens: numberValue(usage.inputTokens),
      cachedInputTokens: numberValue(usage.cachedInputTokens),
      outputTokens: numberValue(usage.outputTokens),
      totalTokens: numberValue(usage.totalTokens),
      webSearchCalls: numberValue(usage.webSearchCalls),
      estimatedCostUsd: numberValue(usage.estimatedCostUsd),
      latencyMs: numberValue(usage.latencyMs) || Date.now() - startedAt,
      responseDiagnostics: {
        status: text(finalTrace.responseStatus) || null,
        incompleteReason: text(finalTrace.responseIncompleteReason) || null,
        outputParsed: finalTrace.outputParsedPresent === true,
        outputItemTypes: strings(finalTrace.outputItemTypes),
      },
    };
    const classification = classifyGenerationPath({
      ...base,
      outputParsed: base.responseDiagnostics.outputParsed,
    });
    const semantic = evaluateSemanticResult(testCase, { ...base, classification });
    return { ...base, classification, ...semantic };
  } catch (error) {
    const trace = traceSnapshots.get(requestId) ?? finalTrace;
    const usage = usageLogs.get(requestId) ?? {};
    const serverRequestId =
      text(finalBody.requestId) || text(trace.requestId) || requestId;
    const canonical = parseCanonicalSurveyIntent(
      testCase.input,
      testCase.surveyMode === "research" ? "research" : "general",
    );
    const base = {
      caseId: testCase.id,
      split: testCase.split,
      input: testCase.input,
      expected: testCase,
      requestId: serverRequestId,
      model: text(usage.actualModel) || text(usage.requestedModel) || null,
      httpStatus: finalResponse?.status ?? null,
      responseType: "error",
      responseStatus: "error",
      responseCode:
        text(finalBody.code) || text(trace.errorCode) || null,
      responseStage:
        text(finalBody.stage) || text(trace.errorStage) || null,
      generationSource: text(trace.generationSource) || null,
      modelCallCount: numberValue(trace.modelCallCount),
      repairCount: numberValue(trace.repairCount),
      fallbackCount: numberValue(trace.fallbackCount),
      retryCount: numberValue(usage.retryCount),
      fallbackReason: text(trace.fallbackReason) || null,
      normalizedMetadataPaths: strings(trace.normalizedInternalMetadataPaths),
      modelOutputRejected: Boolean(trace.modelOutputRejectedAt),
      canonicalTargetPopulation: canonical.surveyIntent.targetPopulation,
      finalRespondentGroup: null,
      canonicalSurveyObject:
        canonical.surveyIntent.evaluationTargets.join(" 및 ") ||
        canonical.surveyIntent.surveyObject || null,
      finalEvaluationTarget: null,
      title: null,
      description: null,
      questions: [],
      questionsBeforePostprocess: strings(trace.questionsBeforePostprocess),
      schemaIssues: strings(trace.schemaIssueCodes),
      semanticIssues: strings(trace.semanticViolationCodes),
      qualityIssues: strings(trace.qualityViolationCodes),
      inputTokens: numberValue(usage.inputTokens),
      cachedInputTokens: numberValue(usage.cachedInputTokens),
      outputTokens: numberValue(usage.outputTokens),
      totalTokens: numberValue(usage.totalTokens),
      webSearchCalls: numberValue(usage.webSearchCalls),
      estimatedCostUsd: numberValue(usage.estimatedCostUsd),
      latencyMs: numberValue(usage.latencyMs) || Date.now() - startedAt,
      responseDiagnostics: {
        status: text(trace.responseStatus) || null,
        incompleteReason: text(trace.responseIncompleteReason) || null,
        outputParsed: trace.outputParsedPresent === true,
        outputItemTypes: strings(trace.outputItemTypes),
      },
    };
    const classification = classifyGenerationPath({
      ...base,
      outputParsed: base.responseDiagnostics.outputParsed,
    });
    const semantic = evaluateSemanticResult(testCase, { ...base, classification });
    semantic.fatalFailures.unshift({
      code: "REQUEST_FAILURE",
      message: error instanceof Error ? `${error.name}:${error.message}` : "UnknownError",
      cluster: "request_transport",
      fatal: true,
    });
    return { ...base, classification, ...semantic };
  }
}

async function existingResults(directory: string) {
  try {
    return JSON.parse(await readFile(resolve(directory, "results.json"), "utf8")) as SurveyRegressionResult[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function persistResults(directory: string, results: SurveyRegressionResult[]) {
  const serialized = `${JSON.stringify(results, null, 2)}\n`;
  assertNoSecrets(serialized);
  await writeFile(resolve(directory, "results.json"), serialized, "utf8");
}

function checkpointCaseSummary(result: SurveyRegressionResult) {
  return {
    caseId: result.caseId,
    split: result.split,
    requestId: result.requestId,
    classification: result.classification,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.totalTokens,
    latencyMs: result.latencyMs,
    estimatedCostUsd: result.estimatedCostUsd,
    errorCode: result.fatalFailures[0]?.code ?? null,
    errorStage: result.fatalFailures[0]?.cluster ?? null,
    resultFile: `cases/${result.caseId}.json`,
  };
}

const args = parseArguments();
const root = process.cwd();
const allCases = args.suite === "fronted-purpose"
  ? [...frontedPurposeSmokeCases]
  : mergeDatasets(
      ...(await Promise.all([
        readRegressionDataset(resolve(root, "evals/survey-regression/v1/dev.json")),
        readRegressionDataset(resolve(root, "evals/survey-regression/v1/holdout.json")),
      ])),
    );
if (args.suite === "v1") {
  const quality = validateDatasetQuality(allCases);
  if (quality.errors.length > 0) throw new Error(quality.errors.join("\n"));
}
const requestedCaseIds = new Set(args.caseIds);
const selectedCases = allCases
  .filter((item) => args.split === "all" || item.split === args.split)
  .filter((item) => requestedCaseIds.size === 0 || requestedCaseIds.has(item.id))
  .slice(0, args.maxCases ?? undefined);
if (requestedCaseIds.size > 0 && selectedCases.length !== requestedCaseIds.size) {
  const selectedIds = new Set(selectedCases.map((item) => item.id));
  const missing = [...requestedCaseIds].filter((id) => !selectedIds.has(id));
  throw new Error(`UNKNOWN_OR_FILTERED_CASE_IDS:${missing.join(",")}`);
}
const projection = projectLiveEvaluationCost(selectedCases);
if (!projection.withinCap) {
  throw new Error(
    `LIVE_EVAL_COST_CAP_EXCEEDED:${projection.projectedCostUsd.toFixed(6)}:${liveEvaluationCostCapUsd}`,
  );
}

const artifactDirectory = resolve(
  root,
  ".artifacts/survey-regression",
  args.suite === "v1" ? "v1" : "v1.1-fronted-purpose",
  args.runId,
);
await mkdir(resolve(artifactDirectory, "cases"), { recursive: true });
await writeFile(resolve(artifactDirectory, "cost-projection.json"), `${JSON.stringify(projection, null, 2)}\n`);
if (args.estimateOnly) {
  process.stdout.write(`${JSON.stringify({ runId: args.runId, estimateOnly: true, projection }, null, 2)}\n`);
  console.info = originalInfo;
  process.exit(0);
}

const environment = requireLiveEnvironment(args.remotePreview);
const checkpointPath = resolve(artifactDirectory, "checkpoint.json");
const checkpoint: LiveCheckpoint = await readCheckpoint(checkpointPath, args.runId);
let results = await existingResults(artifactDirectory);
const resultIds = new Set(results.map((item) => item.caseId));
checkpoint.completedCaseIds = [
  ...new Set([
    ...checkpoint.completedCaseIds.filter((id) => resultIds.has(id)),
    ...resultIds,
  ]),
];
checkpoint.caseSummaries = results.map(checkpointCaseSummary);
const pending = pendingCases(selectedCases, checkpoint);

try {
  for (let index = 0; index < pending.length; index += liveEvaluationConcurrency) {
    if (checkpoint.modelCallsIncludingRetries >= liveEvaluationModelCallCap) {
      throw new Error(
        `LIVE_EVAL_MODEL_CALL_CAP_REACHED:${checkpoint.modelCallsIncludingRetries}:${liveEvaluationModelCallCap}`,
      );
    }
    const costBeforeBatch = results.reduce(
      (sum, item) => sum + item.estimatedCostUsd + item.webSearchCalls * (10 / 1_000),
      0,
    );
    if (costBeforeBatch >= liveEvaluationCostCapUsd) {
      throw new Error(
        `LIVE_EVAL_COST_CAP_REACHED:${costBeforeBatch.toFixed(6)}:${liveEvaluationCostCapUsd}`,
      );
    }
    const batch = pending.slice(index, index + liveEvaluationConcurrency);
    const batchResults = await Promise.all(batch.map(executeCase));
    for (const result of batchResults) {
      if (
        args.remotePreview &&
        checkpoint.completedCaseIds.length === 0 &&
        result.classification !== "environment_rate_limited" &&
        (result.modelCallCount < 1 ||
          result.fallbackReason === "api-key-missing" ||
          result.generationSource === "initial_local_blueprint")
      ) {
        throw new Error(
          `REMOTE_OPENAI_RUNTIME_NOT_ACTIVE:${result.generationSource ?? "unknown"}:${result.fallbackReason ?? "none"}:${result.modelCallCount}`,
        );
      }
      if (
        args.remotePreview &&
        checkpoint.completedCaseIds.length === 0 &&
        result.classification === "environment_rate_limited"
      ) {
        throw new Error(
          `RATE_WINDOW_STILL_ACTIVE:${result.requestId ?? "unknown"}`,
        );
      }
      if (checkpoint.completedCaseIds.includes(result.caseId)) {
        throw new Error(`LIVE_EVAL_DUPLICATE_COMPLETED_CASE:${result.caseId}`);
      }
      results = results.filter((item) => item.caseId !== result.caseId);
      results.push(result);
      checkpoint.completedCaseIds.push(result.caseId);
      checkpoint.caseSummaries = checkpoint.caseSummaries.filter(
        (item) => item.caseId !== result.caseId,
      );
      checkpoint.caseSummaries.push(checkpointCaseSummary(result));
      checkpoint.modelCallsIncludingRetries += result.modelCallCount + result.retryCount;
      checkpoint.consecutiveInfrastructureErrors = nextInfrastructureErrorCount(
        checkpoint.consecutiveInfrastructureErrors,
        result,
      );
      assertWithinModelCallCap(checkpoint.modelCallsIncludingRetries);
      const cumulativeEstimatedCostUsd = results.reduce(
        (sum, item) => sum + item.estimatedCostUsd + item.webSearchCalls * (10 / 1_000),
        0,
      );
      if (cumulativeEstimatedCostUsd > liveEvaluationCostCapUsd) {
        throw new Error(
          `LIVE_EVAL_COST_CAP_REACHED:${cumulativeEstimatedCostUsd.toFixed(6)}:${liveEvaluationCostCapUsd}`,
        );
      }
      const casePayload = `${JSON.stringify(result, null, 2)}\n`;
      assertNoSecrets(casePayload);
      await writeFile(resolve(artifactDirectory, "cases", `${result.caseId}.json`), casePayload);
      if (checkpoint.consecutiveInfrastructureErrors >= 3) {
        throw new Error("LIVE_EVAL_THREE_CONSECUTIVE_INFRASTRUCTURE_ERRORS");
      }
    }
    await Promise.all([
      writeCheckpoint(checkpointPath, checkpoint),
      persistResults(artifactDirectory, results),
    ]);
    originalInfo("survey-regression-checkpoint", {
      runId: args.runId,
      completed: checkpoint.completedCaseIds.length,
      selected: selectedCases.length,
      modelCallsIncludingRetries: checkpoint.modelCallsIncludingRetries,
    });
  }
} finally {
  console.info = originalInfo;
}

results.sort((left, right) => left.caseId.localeCompare(right.caseId));
await persistResults(artifactDirectory, results);
process.stdout.write(
  `${JSON.stringify(
    {
      runId: args.runId,
      split: args.split,
      environment,
      attemptedCases: selectedCases.length,
      completedCases: checkpoint.completedCaseIds.length,
      modelCallsIncludingRetries: checkpoint.modelCallsIncludingRetries,
      projectedCostUsd: projection.projectedCostUsd,
      actualEstimatedCostUsd: results.reduce((sum, item) => sum + item.estimatedCostUsd, 0),
      artifactDirectory,
    },
    null,
    2,
  )}\n`,
);
