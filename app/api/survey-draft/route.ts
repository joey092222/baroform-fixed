import {
  analyzeSurveyPrompt,
  isExplicitDurationSurveyRequest,
  isLiteralFrequencySurveyRequest,
  isSleepDurationSurveyRequest,
  isSimpleProportionSurveyRequest,
  parseSurveyBrief,
  resizeSurveyQuestions,
  validateSurvey,
  type SurveyBlueprint,
} from "../../survey-intent";
import {
  buildSurveyAiRequest,
  parseSurveyDraftResponse,
  SurveyGenerationResponseError,
  SurveyValidationError,
  type SurveyDraftResult,
} from "../../survey-ai";
import {
  applyTargetGradeToQuestions,
  isTargetGrade,
  respondentGroupForGrade,
  surveyDescriptionForGrade,
  targetGradeValues,
  type TargetGrade,
} from "../../survey-grade";
import { lookupVerifiedSurveyKnowledge } from "../../survey-knowledge";
import {
  maxReferenceFilesTotalBytes,
  referenceFileMimeTypes,
} from "../../reference-files";
import { verifyReferenceFileToken } from "../../reference-file-upload";
import { consumePersistentAiRateLimit } from "@/db";
import { getSessionUser } from "@/db/auth";
import { schoolLabel } from "@/app/survey-board";
import { formatQuestionReason } from "@/app/question-reason";
import {
  defaultSurveyMode,
  parseRequestedSurveyMode,
  surveyModeValues,
  type SurveyMode,
} from "@/app/survey-mode";
import OpenAI from "openai";
import { parseResponse } from "openai/lib/ResponsesParser";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { parseSurveyIntent } from "../../survey-semantic-intent";
import { createSurveyPlan } from "../../survey-planning";
import {
  createSurveyGenerationTrace,
  failSurveyGenerationTrace,
  markSurveyGenerationStage,
  recordSurveyModelCall,
  recordSurveyFallback,
  recordSurveyGenerationSource,
  recordSurveyIntentTrace,
  recordSurveyPlanTrace,
  recordSurveyValidation,
  surveyGenerationTraceSnapshot,
  type GenerationSource,
  type SurveyGenerationTrace,
} from "../../survey-generation-trace";
import { resolveSurveyGenerationModel } from "@/app/lib/ai/model-router";
import {
  createTrackedOpenAiClient,
  logOpenAiUsage,
  openAiMaxRetries,
  runOpenAiWithTransientRetry,
  shouldMockOpenAi,
} from "@/app/lib/ai/openai-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const openAiTimeoutMs = 280_000;
const functionDeadlineMs = 290_000;
const backgroundPollTimeoutMs = 30_000;

export const surveyGenerationRuntime = {
  maxDurationSeconds: maxDuration,
  openAiTimeoutMs,
  functionDeadlineMs,
  backgroundPollTimeoutMs,
  maxRetries: openAiMaxRetries,
} as const;

type CacheEntry = {
  expiresAt: number;
  result: SurveyDraftResult;
  mode: "model" | "verified-fallback";
  reason?: string;
  generationSource?: GenerationSource;
};

type ReadySurveyDraftResult = Extract<
  SurveyDraftResult,
  { blueprint: SurveyBlueprint }
>;

type RateEntry = {
  count: number;
  resetAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const generationFlights = new Map<string, Promise<void>>();
const backgroundGenerationCache = new Map<
  string,
  { expiresAt: number; responseId: string; jobToken: string; status: "queued" | "in_progress" }
>();
const rateBuckets = new Map<string, RateEntry>();
const cacheLifetimeMs = 6 * 60 * 60 * 1000;
const rateWindowMs = 60 * 60 * 1000;
const configuredHourlyLimit = Number.parseInt(
  process.env.BAROFORM_AI_MAX_PER_HOUR ?? "8",
  10,
);
const maxFreshGenerationsPerHour = Number.isFinite(configuredHourlyLimit)
  ? Math.min(100, Math.max(1, configuredHourlyLimit))
  : 8;

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "x-baroform-survey-engine": "semantic-intent-v2",
};

const surveyModeRequestSchema = z.preprocess(
  (value) =>
    value === undefined || value === null || value === ""
      ? defaultSurveyMode
      : value,
  z.enum(surveyModeValues),
);

const surveyDraftRequestSchema = z
  .object({
    prompt: z.string().optional(),
    userInput: z.string().optional(),
    surveyMode: surveyModeRequestSchema,
    targetGrade: z.enum(targetGradeValues).optional(),
    questionCount: z.number().int().min(1).max(30).optional(),
    references: z.unknown().optional(),
  })
  .strict();

function apiError(
  message: string,
  code: string,
  status: number,
  headers: Record<string, string> = {},
  requestId = crypto.randomUUID(),
  stage = "request",
) {
  return Response.json(
    { ok: false, type: "error", error: message, code, stage, requestId },
    {
      status,
      headers: {
        ...noStoreHeaders,
        ...headers,
        "x-baroform-request-id": requestId,
      },
    },
  );
}

function apiSuccess<T extends SurveyDraftResult>(
  result: T,
  headers: Record<string, string>,
  requestId: string,
) {
  return Response.json(
    {
      ...result,
      ok: true,
      type: result.status === "needs_clarification" ? "clarification" : "survey",
      requestId,
    },
    {
      headers: {
        ...noStoreHeaders,
        ...headers,
        "x-baroform-request-id": requestId,
      },
    },
  );
}

function apiPayload<T extends Record<string, unknown>>(
  payload: T,
  status: number,
  headers: Record<string, string>,
  requestId: string,
) {
  return Response.json(
    { ...payload, ok: true, type: "background", requestId },
    {
      status,
      headers: {
        ...noStoreHeaders,
        ...headers,
        "x-baroform-request-id": requestId,
      },
    },
  );
}

function traceHeaders(trace: SurveyGenerationTrace) {
  const snapshot = surveyGenerationTraceSnapshot(trace);
  return {
    "x-baroform-generation-stage": snapshot.stage,
    "x-baroform-model-calls": String(snapshot.modelCallCount),
    "x-baroform-validation-count": String(snapshot.validationCount),
    "x-baroform-repair-count": String(snapshot.repairCount),
    "x-baroform-regeneration-count": String(snapshot.regenerationCount),
    "x-baroform-generation-ms": String(snapshot.elapsedMs),
    "x-baroform-generation-source": snapshot.generationSource ?? "unknown",
    "x-baroform-intent-mode": snapshot.intentMode ?? "unknown",
    "x-baroform-purpose-kinds": snapshot.purposeKinds.join(","),
    "x-baroform-purpose-block-count": String(snapshot.purposeBlockCount),
    "x-baroform-fallback-count": String(snapshot.fallbackCount),
    "x-baroform-original-question-count": String(
      snapshot.originalQuestionCount ?? 0,
    ),
    "x-baroform-repaired-question-ids": snapshot.repairedQuestionIds.join(","),
    "x-baroform-preserved-question-ids": snapshot.preservedQuestionIds.join(","),
    "x-baroform-stage-history": snapshot.stageHistory
      .map((item) => item.stage)
      .join(","),
  };
}

function logTrace(trace: SurveyGenerationTrace) {
  if (process.env.NODE_ENV !== "production") {
    console.info("survey-generation-trace", surveyGenerationTraceSnapshot(trace));
  }
}

function fallbackResponse(
  result: SurveyDraftResult,
  reason: string,
  surveyMode: SurveyMode,
  requestId: string,
  trace?: SurveyGenerationTrace,
  generationSource: GenerationSource = "resilient_fallback",
) {
  recordSurveyFallback(trace, reason, generationSource);
  markSurveyGenerationStage(trace, "fallback-started");
  if (result.status !== "needs_clarification") {
    recordSurveyValidation(trace, "semantic-validation");
    let issues: string[] = [];
    try {
      const brief = parseSurveyBrief(result.prompt);
      issues = validateSurvey(result.prompt, brief, result.blueprint);
    } catch (error) {
      console.warn("survey-fallback-validation-skipped", {
        requestId,
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }
    if (issues.length > 0) {
      if (trace) {
        markSurveyGenerationStage(trace, "repair-validation");
        failSurveyGenerationTrace(
          trace,
          "REPAIR_EXHAUSTED",
          new Error(issues.join(" ")),
        );
      }
      return apiError(
        `안전한 설문 초안을 만들지 못했어요. ${issues.join(" ")}`,
        "REPAIR_EXHAUSTED",
        422,
        {
          "x-baroform-ai-mode": "verified-fallback",
          "x-baroform-ai-fallback": reason,
          ...(trace ? traceHeaders(trace) : {}),
        },
        requestId,
        "repair-validation",
      );
    }
  }
  markSurveyGenerationStage(trace, "fallback-completed");
  markSurveyGenerationStage(trace, "response-ready");
  return apiSuccess(
    result,
    {
      "x-baroform-ai-mode": "verified-fallback",
      "x-baroform-ai-fallback": reason,
      "x-baroform-survey-mode": surveyMode,
      ...(trace ? traceHeaders(trace) : {}),
    },
    requestId,
  );
}

function generatedQuestionCount(result: SurveyDraftResult) {
  return result.status === "needs_clarification"
    ? 0
    : result.blueprint.aiQuestions.length;
}

function creatorClarificationResult(
  prompt: string,
  intent: ReturnType<typeof parseSurveyIntent>,
): SurveyDraftResult {
  return {
    status: "needs_clarification",
    prompt,
    clarification: {
      question: "평가할 수업은 어떻게 정할까요?",
      reason:
        "수업별 만족도를 비교하려면 평가할 수업 목록이나 반복 평가 방식을 먼저 정해야 해요.",
      options: [
        "평가할 수업 목록을 직접 입력할게요",
        "응답자가 수강한 수업명을 입력하게 할게요",
        "응답자가 현재 수강 중인 여러 수업을 각각 평가하게 할게요",
      ],
    },
    research: {
      status: "not-needed",
      entity: null,
      summary: "복수 평가 대상의 목록 또는 평가 방식을 확인하고 있어요.",
      facts: [],
      sources: [],
      classification: "unresolved",
      limitations: intent.missingInformation,
    },
  };
}

function responseUsedWebSearch(response: unknown) {
  if (!response || typeof response !== "object") return false;
  const output = (response as { output?: unknown }).output;
  return (
    Array.isArray(output) &&
    output.some(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        (item as { type?: unknown }).type === "web_search_call",
    )
  );
}

function responseRequestId(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const value = (response as { _request_id?: unknown })._request_id;
  return typeof value === "string" && value ? value : null;
}

function responseDiagnostics(response: unknown) {
  if (!response || typeof response !== "object") {
    return {
      status: null,
      incompleteReason: null,
      hasOutputParsed: false,
      outputTypes: [] as string[],
    };
  }
  const payload = response as {
    status?: unknown;
    incomplete_details?: unknown;
    output_parsed?: unknown;
    output?: unknown;
  };
  const incompleteReason =
    payload.incomplete_details && typeof payload.incomplete_details === "object"
      ? (payload.incomplete_details as { reason?: unknown }).reason
      : null;
  const outputTypes = Array.isArray(payload.output)
    ? payload.output
        .map((item) =>
          item && typeof item === "object"
            ? (item as { type?: unknown }).type
            : null,
        )
        .filter((value): value is string => typeof value === "string")
    : [];
  return {
    status: typeof payload.status === "string" ? payload.status : null,
    incompleteReason:
      typeof incompleteReason === "string" ? incompleteReason : null,
    hasOutputParsed:
      payload.output_parsed !== null && payload.output_parsed !== undefined,
    outputTypes,
  };
}

function logGenerationMetric({
  surveyMode,
  startedAt,
  success,
  questionCount,
  searchUsed,
  requestId,
  outcome,
}: {
  surveyMode: SurveyMode;
  startedAt: number;
  success: boolean;
  questionCount: number;
  searchUsed: boolean;
  requestId?: string | null;
  outcome:
    | "model"
    | "cache"
    | "verified-fallback"
    | "validation-error"
    | "intent-clarification";
}) {
  console.info("survey-generation-metric", {
    surveyMode,
    durationMs: Math.max(0, Date.now() - startedAt),
    success,
    questionCount,
    searchUsed,
    openAiRequestId: requestId ?? null,
    outcome,
  });
}

function applyDraftSettings(
  blueprint: SurveyBlueprint,
  targetGrade: TargetGrade,
  questionCount: number,
): SurveyBlueprint {
  const preserveExplicitAudience =
    targetGrade === "전학년" &&
    Boolean(blueprint.respondentGroup) &&
    !/(?:연세대|연세대학교)/.test(blueprint.respondentGroup ?? "") &&
    /(?:전\s*연령대|모든\s*연령대|일반인|\d{1,2}대|대학생|대학원생|중학생|고등학생|청년|직장인|학부모|교사|사용자|이용자|소비자|고객)/.test(
      blueprint.respondentGroup ?? "",
    );
  const templateCount = Math.min(5, questionCount);
  const aiQuestions = applyTargetGradeToQuestions(
    resizeSurveyQuestions(blueprint.aiQuestions, questionCount),
    targetGrade,
    questionCount,
  ).map((question) => ({
    ...question,
    reason: formatQuestionReason(question.reason),
  }));
  return {
    ...blueprint,
    description: preserveExplicitAudience
      ? blueprint.description
      : surveyDescriptionForGrade(blueprint.description, targetGrade),
    respondentGroup: preserveExplicitAudience
      ? blueprint.respondentGroup
      : respondentGroupForGrade(blueprint.respondentGroup, targetGrade),
    detectedSignals: [
      ...(blueprint.detectedSignals ?? []).filter(
        (signal) => !signal.startsWith("응답 학년 ·"),
      ),
      `응답 학년 · ${targetGrade}`,
    ],
    templateQuestions: applyTargetGradeToQuestions(
      resizeSurveyQuestions(blueprint.templateQuestions, templateCount),
      targetGrade,
      templateCount,
    ).map((question) => ({
      ...question,
      reason: formatQuestionReason(question.reason),
    })),
    aiQuestions,
  };
}

function verifiedResearchFallback(
  prompt: string,
  targetGrade: TargetGrade,
  questionCount: number,
): SurveyDraftResult | null {
  const knowledge = lookupVerifiedSurveyKnowledge(prompt);
  if (!knowledge) return null;
  const blueprint = applyDraftSettings(
    analyzeSurveyPrompt(prompt),
    targetGrade,
    questionCount,
  );
  const normalizedTarget = (blueprint.evaluationTarget ?? blueprint.subject)
    .replace(/\s+/g, "")
    .toLocaleLowerCase("ko-KR");
  const knowledgeIsEvaluationTarget = knowledge.aliases.some((alias) =>
    normalizedTarget.includes(
      alias.replace(/\s+/g, "").toLocaleLowerCase("ko-KR"),
    ),
  );
  if (!knowledgeIsEvaluationTarget) return null;

  const research = {
    status: "cached" as const,
    entity: knowledge.canonicalName,
    summary: knowledge.summary,
    facts: knowledge.stableFacts,
    classification: "verified" as const,
    limitations: [] as string[],
    sources: knowledge.sources.map((source) => ({
      ...source,
      domain: new URL(source.url).hostname.replace(/^www\./, ""),
    })),
  };
  return {
    status: "ready_with_caution",
    prompt,
    blueprint,
    research,
  };
}

function fastDraftFallback(
  prompt: string,
  targetGrade: TargetGrade,
  questionCount: number,
): ReadySurveyDraftResult {
  const blueprint = applyDraftSettings(
    analyzeSurveyPrompt(prompt),
    targetGrade,
    questionCount,
  );
  return {
    status: "ready_with_caution",
    prompt,
    blueprint,
    research: {
      status: "fallback",
      entity: null,
      summary:
        "자료 확인이 지연되어 입력 문맥을 기준으로 먼저 문항을 설계했어요. 편집 화면에서 바로 다듬을 수 있어요.",
      facts: [],
      sources: [],
      classification: "unresolved",
      limitations: [
        "공개 자료 검색을 완료하지 못해 사용자 입력과 일반적인 조사 설계 원칙만 반영했습니다.",
      ],
    },
  };
}

function resilientDraftFallback(
  prompt: string,
  targetGrade: TargetGrade,
  questionCount: number,
) {
  return fastDraftFallback(prompt, targetGrade, questionCount);
}

function cacheResult(
  key: string,
  now: number,
  result: SurveyDraftResult,
  mode: CacheEntry["mode"] = "verified-fallback",
  reason?: string,
  generationSource?: GenerationSource,
) {
  responseCache.set(key, {
    expiresAt: now + cacheLifetimeMs,
    result,
    mode,
    reason,
    generationSource,
  });
}

function normalizePrompt(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function generationCacheKey(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function generationRequestScope(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  const anonymousScope = [
    request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "local",
    request.headers.get("user-agent")?.slice(0, 120) ?? "unknown",
  ].join("|");
  return createHash("sha256")
    .update(authorization || anonymousScope)
    .digest("hex");
}

function backgroundJobToken(responseId: string, apiKey: string) {
  return createHmac("sha256", apiKey)
    .update(`baroform-survey:${responseId}`)
    .digest("base64url");
}

function validBackgroundJobToken(
  responseId: string,
  token: string,
  apiKey: string,
) {
  const expected = backgroundJobToken(responseId, apiKey);
  const receivedBytes = Buffer.from(token);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

function combineRequestAndDeadlineSignals(request: Request) {
  const deadlineController = new AbortController();
  let deadlineReached = false;
  const timer = setTimeout(() => {
    deadlineReached = true;
    deadlineController.abort();
  }, functionDeadlineMs);
  return {
    signal: AbortSignal.any([request.signal, deadlineController.signal]),
    deadlineReached: () => deadlineReached,
    dispose: () => clearTimeout(timer),
  };
}

type SurveyReferences = {
  images: Array<{ name: string; dataUrl: string }>;
  files: Array<{
    name: string;
    mimeType: string;
    size: number;
    dataUrl?: string;
    fileId?: string;
  }>;
  links: string[];
};
const maxReferenceDataLength = 3_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized === "::1" ||
    /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
      normalized,
    )
  );
}

async function parseSurveyReferences(value: unknown): Promise<SurveyReferences | null> {
  if (value === undefined) return { images: [], files: [], links: [] };
  if (!isRecord(value)) return null;
  const rawImages = value.images === undefined ? [] : value.images;
  const rawFiles = value.files === undefined ? [] : value.files;
  const rawLinks = value.links === undefined ? [] : value.links;
  if (
    !Array.isArray(rawImages) ||
    !Array.isArray(rawFiles) ||
    !Array.isArray(rawLinks)
  ) {
    return null;
  }
  if (rawImages.length > 10 || rawFiles.length > 3 || rawLinks.length > 3) {
    return null;
  }

  const images: SurveyReferences["images"] = [];
  for (const item of rawImages) {
    if (!isRecord(item)) return null;
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 80) : "";
    const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl.trim() : "";
    if (
      !name ||
      dataUrl.length < 80 ||
      dataUrl.length > 300_000 ||
      !/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+={0,2}$/i.test(dataUrl)
    ) {
      return null;
    }
    images.push({ name, dataUrl });
  }

  const files: SurveyReferences["files"] = [];
  for (const item of rawFiles) {
    if (!isRecord(item)) return null;
    const fileToken =
      typeof item.fileToken === "string" ? item.fileToken.trim() : "";
    if (fileToken) {
      const verified = await verifyReferenceFileToken(fileToken);
      if (!verified) return null;
      files.push({
        name: verified.name,
        mimeType: verified.mimeType,
        size: verified.size,
        fileId: verified.fileId,
      });
      continue;
    }

    const name = typeof item.name === "string" ? item.name.trim().slice(0, 120) : "";
    const mimeType =
      typeof item.mimeType === "string" ? item.mimeType.trim().toLowerCase() : "";
    const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl.trim() : "";
    const extension = name.split(".").pop()?.toLowerCase() ?? "";
    const expectedMimeType = referenceFileMimeTypes[extension];
    const dataPrefix = expectedMimeType
      ? `data:${expectedMimeType};base64,`
      : "";
    const encodedData = dataPrefix && dataUrl.startsWith(dataPrefix)
      ? dataUrl.slice(dataPrefix.length)
      : "";
    if (
      !name ||
      !expectedMimeType ||
      mimeType !== expectedMimeType ||
      dataUrl.length < 20 ||
      dataUrl.length > maxReferenceDataLength ||
      !encodedData ||
      !/^[a-z0-9+/]+={0,2}$/i.test(encodedData)
    ) {
      return null;
    }
    const padding = encodedData.endsWith("==") ? 2 : encodedData.endsWith("=") ? 1 : 0;
    const size = Math.floor((encodedData.length * 3) / 4) - padding;
    files.push({ name, dataUrl, mimeType, size });
  }

  const totalReferenceDataLength = [...images, ...files].reduce(
    (total, item) => total + ("dataUrl" in item ? item.dataUrl?.length ?? 0 : 0),
    0,
  );
  if (totalReferenceDataLength > maxReferenceDataLength) return null;
  const totalReferenceFileBytes = files.reduce(
    (total, file) => total + file.size,
    0,
  );
  if (totalReferenceFileBytes > maxReferenceFilesTotalBytes) return null;

  const links: string[] = [];
  for (const item of rawLinks) {
    if (typeof item !== "string" || item.length > 2048) return null;
    try {
      const url = new URL(item);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        isPrivateHostname(url.hostname)
      ) {
        return null;
      }
      url.hash = "";
      const normalized = url.toString();
      if (!links.includes(normalized)) links.push(normalized);
    } catch {
      return null;
    }
  }

  return { images, files, links };
}

async function referenceFingerprint(references: SurveyReferences) {
  if (
    references.images.length === 0 &&
    references.files.length === 0 &&
    references.links.length === 0
  ) {
    return "none";
  }
  const source = [
    ...references.links,
    ...references.images.map((image) => `${image.name}:${image.dataUrl}`),
    ...references.files.map(
      (file) =>
        `${file.name}:${file.mimeType}:${file.fileId ?? file.dataUrl ?? ""}`,
    ),
  ].join("|");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function pruneMemory(now: number) {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
  for (const [key, entry] of rateBuckets) {
    if (entry.resetAt <= now) rateBuckets.delete(key);
  }
  for (const [key, entry] of backgroundGenerationCache) {
    if (entry.expiresAt <= now) backgroundGenerationCache.delete(key);
  }
  while (responseCache.size > 100) {
    const oldest = responseCache.keys().next().value as string | undefined;
    if (!oldest) break;
    responseCache.delete(oldest);
  }
}

async function clientFingerprint(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 90) ?? "unknown";
  const bytes = new TextEncoder().encode(`${ip}|${agent}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function consumeRateLimit(request: Request, now: number) {
  const key = await clientFingerprint(request);

  try {
    const persistent = await consumePersistentAiRateLimit(
      key,
      maxFreshGenerationsPerHour,
    );
    if (persistent !== null) return persistent;
  } catch {
    // If the optional database is unavailable, retain a per-instance guard.
  }

  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + rateWindowMs });
    return true;
  }
  if (existing.count >= maxFreshGenerationsPerHour) return false;
  existing.count += 1;
  rateBuckets.set(key, existing);
  return true;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return request.headers.get("sec-fetch-site") !== "cross-site";
  }
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function createSurveyDraftResponse(request: Request, requestId: string) {
  const generationStartedAt = Date.now();
  const trace = createSurveyGenerationTrace(requestId);
  const earlyError = (
    message: string,
    code: string,
    status: number,
  ) => {
    failSurveyGenerationTrace(trace, code, new Error(message));
    logTrace(trace);
    return apiError(
      message,
      code,
      status,
      traceHeaders(trace),
      requestId,
      trace.failureStage ?? "request-received",
    );
  };
  const clientRequestId =
    request.headers.get("x-baroform-client-request-id")?.slice(0, 80) ?? null;
  if (!sameOrigin(request)) {
    return earlyError(
      "이 사이트에서 다시 시도해주세요.",
      "INVALID_ORIGIN",
      403,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 3_600_000) {
    return earlyError(
      "요청 내용이 너무 길어요.",
      "REQUEST_TOO_LARGE",
      413,
    );
  }

  let rawPayload: unknown;
  markSurveyGenerationStage(trace, "input-parsing");
  try {
    rawPayload = await request.json();
  } catch {
    return earlyError(
      "설문 내용을 읽지 못했어요.",
      "INVALID_JSON",
      400,
    );
  }

  const parsedPayload = surveyDraftRequestSchema.safeParse(rawPayload);
  markSurveyGenerationStage(trace, "request-schema-validation");
  if (!parsedPayload.success) {
    const invalidSurveyMode = parsedPayload.error.issues.some(
      (issue) => issue.path[0] === "surveyMode",
    );
    console.warn("survey-generation-invalid-request", {
      requestId,
      clientRequestId,
      code: invalidSurveyMode ? "INVALID_SURVEY_MODE" : "INVALID_REQUEST",
      issuePaths: parsedPayload.error.issues.map((issue) =>
        issue.path.join("."),
      ),
    });
    return earlyError(
      invalidSurveyMode
        ? "설문 제작 방식을 다시 선택해주세요."
        : "설문 생성 요청 형식을 확인해주세요.",
      invalidSurveyMode ? "INVALID_SURVEY_MODE" : "INVALID_REQUEST",
      400,
    );
  }
  const payload = parsedPayload.data;

  markSurveyGenerationStage(trace, "input-preprocessing");
  const surveyMode =
    parseRequestedSurveyMode(payload.surveyMode) ?? defaultSurveyMode;

  const enteredPrompt =
    typeof payload.prompt === "string"
      ? normalizePrompt(payload.prompt)
      : typeof payload.userInput === "string"
        ? normalizePrompt(payload.userInput)
        : "";
  const references = await parseSurveyReferences(payload.references);
  if (!references) {
    return earlyError(
      "첨부한 사진·파일·링크를 확인해주세요.",
      "INVALID_REFERENCES",
      400,
    );
  }
  const hasReferences =
    references.images.length > 0 ||
    references.files.length > 0 ||
    references.links.length > 0;
  markSurveyGenerationStage(trace, "intent-extraction");
  const intent = parseSurveyIntent(
    enteredPrompt,
    surveyMode === "research" ? "research" : "general",
  );
  recordSurveyIntentTrace(trace, {
    topic: intent.surveyObject,
    variables: intent.researchIntent.variables.map(
      (item) => `${item.name}:${item.scope}:${item.role}`,
    ),
    relations: intent.researchIntent.relations.map(
      (item) => `${item.type}:${item.fromVariableId}->${item.toVariableId}`,
    ),
  });
  markSurveyGenerationStage(trace, "intent-analysis");
  if (process.env.NODE_ENV !== "production") {
    console.info("survey-generation-request", {
      requestId,
      clientRequestId,
      surveyMode,
      inputLength: enteredPrompt.length,
      attachmentCount:
        references.images.length +
        references.files.length +
        references.links.length,
      intent: {
        objectKind: intent.objectKind,
        hasTargetPopulation: Boolean(intent.targetPopulation),
        constructCount: intent.constructs.length,
        hasExplicitTimeframe: Boolean(intent.explicitTimeframe),
        screeningRequired: intent.screeningRequired,
        includesNonUsers: intent.includesNonUsers,
        ambiguityLevel: intent.ambiguityLevel,
      },
    });
  }
  if (enteredPrompt.length > 300 || (enteredPrompt.length < 2 && !hasReferences)) {
    return earlyError(
      "설문 내용은 2자 이상 300자 이하로 적거나 참고 자료를 추가해주세요.",
      "INVALID_PROMPT",
      400,
    );
  }
  const prompt =
    enteredPrompt || "첨부 자료를 바탕으로 만족도와 개선점을 조사하고 싶어요.";
  const targetGrade =
    typeof payload.targetGrade === "string" &&
    isTargetGrade(payload.targetGrade)
      ? payload.targetGrade
      : "전학년";
  const requestedQuestionCount =
    typeof payload.questionCount === "number" &&
    Number.isInteger(payload.questionCount)
      ? Math.min(30, Math.max(1, payload.questionCount))
      : 7;
  const isDirectProportion =
    !hasReferences && isSimpleProportionSurveyRequest(prompt);
  const isDirectFrequency =
    !hasReferences && isLiteralFrequencySurveyRequest(prompt);
  const isDirectSleepDuration =
    !hasReferences && isSleepDurationSurveyRequest(prompt);
  const isDirectDuration =
    !hasReferences && isExplicitDurationSurveyRequest(prompt);
  const questionCount = isDirectProportion
    ? targetGrade === "전학년"
      ? 1
      : 2
    : (isDirectFrequency || isDirectSleepDuration || isDirectDuration) &&
        targetGrade !== "전학년"
      ? Math.max(2, requestedQuestionCount)
      : requestedQuestionCount;
  const surveyPlan = createSurveyPlan(intent, questionCount);
  recordSurveyPlanTrace(trace, {
    intentKind: intent.objectKind,
    intentMode: intent.intentMode,
    purposeKinds: intent.purposeBlocks.map((block) => block.kind),
    purposeBlockCount: intent.purposeBlocks.length,
    blocks: surveyPlan.blocks.map(
      (block) =>
        `${block.id}:${block.kind}:askable=${block.directlyAskable}:variables=${block.variableIds.join("+")}:question=${block.questionType ?? "none"}:analysis=${block.analysisType ?? "none"}`,
    ),
  });

  if (enteredPrompt && intent.requiresCreatorClarification) {
    const clarification = creatorClarificationResult(prompt, intent);
    recordSurveyGenerationSource(trace, "intent_clarification");
    markSurveyGenerationStage(trace, "response-ready");
    logGenerationMetric({
      surveyMode,
      startedAt: generationStartedAt,
      success: true,
      questionCount: 0,
      searchUsed: false,
      outcome: "intent-clarification",
    });
    logTrace(trace);
    return apiSuccess(
      clarification,
      {
        "x-baroform-ai-mode": "intent-clarification",
        "x-baroform-survey-mode": surveyMode,
        ...traceHeaders(trace),
      },
      requestId,
    );
  }

  const now = Date.now();
  pruneMemory(now);
  const referenceKey = await referenceFingerprint(references);
  const cacheKey = generationCacheKey({
    requestScope: generationRequestScope(request),
    surveyMode,
    prompt: prompt.toLocaleLowerCase("ko-KR"),
    targetGrade,
    questionCount,
    referenceKey,
  });
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    const cachedSource =
      cached.generationSource ??
      (cached.mode === "model" ? "openai" : "initial_local_blueprint");
    if (cached.reason) recordSurveyFallback(trace, cached.reason, cachedSource);
    else recordSurveyGenerationSource(trace, cachedSource);
    markSurveyGenerationStage(trace, "response-ready");
    logTrace(trace);
    logGenerationMetric({
      surveyMode,
      startedAt: generationStartedAt,
      success: true,
      questionCount: generatedQuestionCount(cached.result),
      searchUsed: cached.result.research.status === "searched",
      outcome: "cache",
    });
    return apiSuccess(
      cached.result,
      {
        "x-baroform-ai-mode": cached.mode,
        "x-baroform-ai-cache": "hit",
        "x-baroform-survey-mode": surveyMode,
        ...(cached.reason ? { "x-baroform-ai-fallback": cached.reason } : {}),
        ...traceHeaders(trace),
      },
      requestId,
    );
  }
  const activeBackground = backgroundGenerationCache.get(cacheKey);
  if (
    surveyMode === "research" &&
    activeBackground &&
    activeBackground.expiresAt > now
  ) {
    return apiPayload(
      {
        status: activeBackground.status,
        responseId: activeBackground.responseId,
        jobToken: activeBackground.jobToken,
      },
      202,
      {
        "x-baroform-ai-mode": "background",
        "x-baroform-ai-cache": "background-hit",
        "x-baroform-survey-mode": surveyMode,
      },
      requestId,
    );
  }

  if (!(await consumeRateLimit(request, now))) {
    return apiError(
      "짧은 시간에 AI 초안을 많이 만들었어요. 잠시 후 다시 시도해주세요.",
      "RATE_LIMITED",
      429,
      {},
      requestId,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const mockMode = shouldMockOpenAi();
  if (!apiKey || mockMode) {
    const fallbackReason = mockMode ? "mock-mode" : "api-key-missing";
    if (hasReferences && !mockMode) {
      return apiError(
        "첨부 자료 분석 연결을 확인하는 중이에요. 잠시 후 다시 시도해주세요.",
        "REFERENCE_AI_UNAVAILABLE",
        503,
        {},
        requestId,
      );
    }
    markSurveyGenerationStage(trace, "survey-planning");
    const verifiedFallback = verifiedResearchFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    markSurveyGenerationStage(trace, "question-generation");
    if (verifiedFallback) {
      const response = fallbackResponse(
        verifiedFallback,
        fallbackReason,
        surveyMode,
        requestId,
        trace,
        "initial_local_blueprint",
      );
      if (response.ok) {
        cacheResult(
          cacheKey,
          now,
          verifiedFallback,
          "verified-fallback",
          fallbackReason,
          "initial_local_blueprint",
        );
      }
      logGenerationMetric({
        surveyMode,
        startedAt: generationStartedAt,
        success: response.ok,
        questionCount: generatedQuestionCount(verifiedFallback),
        searchUsed: false,
        outcome: "verified-fallback",
      });
      logTrace(trace);
      return response;
    }
    const resilientFallback = resilientDraftFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    const response = fallbackResponse(
      resilientFallback,
      fallbackReason,
      surveyMode,
      requestId,
      trace,
      intent.intentMode === "composite"
        ? "composite_plan_fallback"
        : "resilient_fallback",
    );
    if (response.ok) {
      cacheResult(
        cacheKey,
        now,
        resilientFallback,
        "verified-fallback",
        fallbackReason,
        intent.intentMode === "composite"
          ? "composite_plan_fallback"
          : "resilient_fallback",
      );
    }
    logGenerationMetric({
      surveyMode,
      startedAt: generationStartedAt,
      success: response.ok,
      questionCount: generatedQuestionCount(resilientFallback),
      searchUsed: false,
      outcome: "verified-fallback",
    });
    logTrace(trace);
    return response;
  }

  const modelRoute = resolveSurveyGenerationModel(surveyMode);
  const model = modelRoute.model;
  const activeFlight = generationFlights.get(cacheKey);
  if (activeFlight) {
    await activeFlight;
    const shared = responseCache.get(cacheKey);
    if (shared && shared.expiresAt > Date.now()) {
      return apiSuccess(
        shared.result,
        {
          "x-baroform-ai-mode": shared.mode,
          "x-baroform-ai-cache": "shared-in-flight",
          "x-baroform-survey-mode": surveyMode,
          ...traceHeaders(trace),
        },
        requestId,
      );
    }
    const sharedBackground = backgroundGenerationCache.get(cacheKey);
    if (surveyMode === "research" && sharedBackground) {
      return apiPayload(
        {
          status: sharedBackground.status,
          responseId: sharedBackground.responseId,
          jobToken: sharedBackground.jobToken,
        },
        202,
        {
          "x-baroform-ai-mode": "background",
          "x-baroform-ai-cache": "shared-in-flight",
          "x-baroform-survey-mode": surveyMode,
        },
        requestId,
      );
    }
  }

  let releaseFlight = () => {};
  const currentFlight = new Promise<void>((resolve) => {
    releaseFlight = resolve;
  });
  generationFlights.set(cacheKey, currentFlight);

  markSurveyGenerationStage(trace, "survey-planning");
  markSurveyGenerationStage(trace, "question-generation");
  let planBasedFallback: SurveyDraftResult | null = null;
  const getPlanBasedFallback = () => {
    if (planBasedFallback) return planBasedFallback;
    planBasedFallback =
      verifiedResearchFallback(prompt, targetGrade, questionCount) ??
      resilientDraftFallback(prompt, targetGrade, questionCount);
    return planBasedFallback;
  };
  const respondWithPlanBasedFallback = (
    reason: string,
    generationSource: GenerationSource,
  ) => {
    const result = getPlanBasedFallback();
    const response = fallbackResponse(
      result,
      reason,
      surveyMode,
      requestId,
      trace,
      generationSource,
    );
    if (response.ok) {
      cacheResult(
        cacheKey,
        now,
        result,
        "verified-fallback",
        reason,
        generationSource,
      );
    }
    logGenerationMetric({
      surveyMode,
      startedAt: generationStartedAt,
      success: response.ok,
      questionCount: generatedQuestionCount(result),
      searchUsed: false,
      outcome: "verified-fallback",
    });
    logTrace(trace);
    return response;
  };
  let organizationLocationContext: string | null = null;
  let sessionUserId: string | null = null;
  try {
    const sessionUser = await getSessionUser(request);
    if (sessionUser) {
      sessionUserId = sessionUser.id;
      organizationLocationContext = `로그인 프로필 학교: ${schoolLabel(sessionUser.schoolId)}`;
    }
  } catch {
    // 로그인 저장소가 연결되지 않아도 사용자 원문만으로 설문을 생성한다.
  }

  const lifecycle = combineRequestAndDeadlineSignals(request);
  const openai = createTrackedOpenAiClient(apiKey, openAiTimeoutMs);
  const modelRequest = buildSurveyAiRequest(prompt, null, model, {
    surveyMode,
    targetGrade,
    questionCount,
    references,
    organizationLocationContext,
    reasoningEffort: modelRoute.reasoningEffort,
    serviceTier: modelRoute.requestedServiceTier,
  });
  let upstreamCompleted = false;
  let modelCallStarted = false;
  let usageLogged = false;
  let actualRetryCount = 0;
  const modelCallStartedAt = performance.now();

  try {
    let rawResult: Awaited<ReturnType<typeof openai.responses.parse>>;
    try {
      recordSurveyModelCall(trace);
      modelCallStarted = true;
      const attempted = await runOpenAiWithTransientRetry(
        () => openai.responses.parse(
          surveyMode === "research"
            ? {
                ...modelRequest,
                background: true,
                store: true,
                metadata: {
                  baro_prompt: prompt,
                  baro_target_grade: targetGrade,
                  baro_question_count: String(questionCount),
                  baro_has_references: String(hasReferences),
                  baro_reference_key: referenceKey,
                  baro_request_scope: generationRequestScope(request),
                  baro_organization_context:
                    organizationLocationContext ?? "",
                },
              }
            : modelRequest,
          { signal: lifecycle.signal },
        ),
        (retryCount) => {
          actualRetryCount = retryCount;
        },
      );
      rawResult = attempted.value;
      actualRetryCount = attempted.retryCount;
      upstreamCompleted = true;
      markSurveyGenerationStage(trace, "model-response");

      logOpenAiUsage(rawResult, {
        requestId,
        userId: sessionUserId,
        requestType: "survey_generate",
        surveyMode,
        model: modelRoute.model,
        reasoningEffort: modelRoute.reasoningEffort,
        requestedServiceTier: modelRoute.requestedServiceTier,
        webSearchCalls: responseUsedWebSearch(rawResult) ? 1 : 0,
        retryCount: actualRetryCount,
        startedAt: modelCallStartedAt,
        success: true,
      });
      usageLogged = true;

      if (
        surveyMode === "research" &&
        (rawResult.status === "queued" || rawResult.status === "in_progress")
      ) {
        const jobToken = backgroundJobToken(rawResult.id, apiKey);
        backgroundGenerationCache.set(cacheKey, {
          expiresAt: Date.now() + cacheLifetimeMs,
          responseId: rawResult.id,
          jobToken,
          status: rawResult.status,
        });
        return apiPayload(
          {
            status: rawResult.status,
            responseId: rawResult.id,
            jobToken,
          },
          202,
          {
            "x-baroform-ai-mode": "background",
            "x-baroform-survey-mode": surveyMode,
          },
          requestId,
        );
      }
      if (surveyMode === "research" && rawResult.status !== "completed") {
        return apiError(
          "정밀·연구 설문 생성이 완료되지 않았어요. 다시 시도해 주세요.",
          rawResult.status === "incomplete"
            ? "SURVEY_GENERATION_INCOMPLETE"
            : "SURVEY_GENERATION_BACKGROUND_FAILED",
          502,
          {},
          requestId,
        );
      }
    } catch (error) {
      const isTimeout =
        error instanceof OpenAI.APIConnectionTimeoutError ||
        error instanceof OpenAI.APIUserAbortError ||
        (error instanceof Error && error.name === "AbortError");
      const isInvalidStructuredOutput =
        error instanceof SyntaxError ||
        (error instanceof Error && error.name === "ZodError");
      const isHttpFailure =
        error instanceof OpenAI.APIError &&
        !(error instanceof OpenAI.APIConnectionError);

      if (isInvalidStructuredOutput && intent.intentMode === "composite") {
        return respondWithPlanBasedFallback(
          "model-output-rejected",
          intent.intentMode === "composite"
            ? "composite_plan_fallback"
            : "parse_failure_fallback",
        );
      }

      if (isTimeout || isInvalidStructuredOutput || isHttpFailure) {
        throw error;
      }

      console.warn("survey-generation-transport-fallback", {
        requestId,
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return respondWithPlanBasedFallback(
        "responses-api-error",
        intent.intentMode === "composite"
          ? "composite_plan_fallback"
          : "openai_failure_fallback",
      );
    }
    console.info("survey-generation-upstream", {
      requestId,
      openAiRequestId: responseRequestId(rawResult),
      ...responseDiagnostics(rawResult),
    });
    let result = parseSurveyDraftResponse(
      rawResult as unknown,
      prompt,
      questionCount,
      targetGrade,
      hasReferences,
      trace,
    );

    if (
      result.status !== "needs_clarification" &&
      (isDirectProportion ||
        isDirectFrequency ||
        isDirectSleepDuration ||
        isDirectDuration)
    ) {
      const deterministic = fastDraftFallback(
        prompt,
        targetGrade,
        questionCount,
      );
      result = {
        ...deterministic,
        status: result.status,
        research: result.research,
        surveyPlan: result.surveyPlan,
        qualityCheck: result.qualityCheck,
        completionMessage: result.completionMessage,
      };
      recordSurveyFallback(
        trace,
        "deterministic-direct-measurement",
        "fast_draft_fallback",
      );
    }

    cacheResult(
      cacheKey,
      now,
      result,
      "model",
      trace.fallbackReason ?? undefined,
      trace.generationSource ?? "openai",
    );
    markSurveyGenerationStage(trace, "response-ready");
    logGenerationMetric({
      surveyMode,
      startedAt: generationStartedAt,
      success: true,
      questionCount: generatedQuestionCount(result),
      searchUsed: responseUsedWebSearch(rawResult),
      requestId: responseRequestId(rawResult),
      outcome: "model",
    });
    logTrace(trace);
    return apiSuccess(
      result,
      {
        "x-baroform-ai-mode": "model",
        "x-baroform-ai-attempt": "single-response",
        "x-baroform-survey-mode": surveyMode,
        ...traceHeaders(trace),
      },
      requestId,
    );
  } catch (error) {
    const tracedError = (
      message: string,
      code: string,
      status: number,
      headers: Record<string, string> = {},
    ) => {
      failSurveyGenerationTrace(trace, code, error);
      logTrace(trace);
      return apiError(
        message,
        code,
        status,
        { ...headers, ...traceHeaders(trace) },
        requestId,
        trace.failureStage ?? trace.stage,
      );
    };
    if (
      upstreamCompleted &&
      intent.intentMode === "composite" &&
      (error instanceof SurveyValidationError ||
        error instanceof SurveyGenerationResponseError ||
        error instanceof SyntaxError ||
        (error instanceof Error && error.name === "ZodError"))
    ) {
      console.warn("survey-generation-output-fallback", {
        requestId,
        name: error instanceof Error ? error.name : "UnknownError",
        issues:
          error instanceof SurveyValidationError
            ? error.issues.slice(0, 8)
            : undefined,
      });
      return respondWithPlanBasedFallback(
        "model-output-rejected",
        intent.intentMode === "composite"
          ? "composite_plan_fallback"
          : error instanceof SurveyValidationError && error.category === "semantic"
            ? "semantic_repair_fallback"
            : "parse_failure_fallback",
      );
    }

    if (error instanceof SurveyValidationError) {
      logGenerationMetric({
        surveyMode,
        startedAt: generationStartedAt,
        success: false,
        questionCount: 0,
        searchUsed: false,
        outcome: "validation-error",
      });
      return tracedError(
        `생성된 설문 구조를 안전하게 적용하지 못했어요. ${error.issues.join(" ")}`,
        error.category === "schema"
          ? "OUTPUT_SCHEMA_INVALID"
          : "SEMANTIC_VALIDATION_FAILED",
        422,
      );
    }

    const openAiRequestId =
      error instanceof OpenAI.APIError ? error.requestID : undefined;
    console.error("survey-generation-failed", {
      requestId,
      openAiRequestId,
      name: error instanceof Error ? error.name : "UnknownError",
      status: error instanceof OpenAI.APIError ? error.status : undefined,
      code:
        error instanceof SurveyGenerationResponseError ? error.code : undefined,
      incompleteReason:
        error instanceof SurveyGenerationResponseError
          ? error.incompleteReason
          : undefined,
    });

    if (error instanceof SurveyGenerationResponseError) {
      const canonicalCode = (() => {
        switch (error.code) {
          case "SURVEY_GENERATION_INCOMPLETE":
          case "SURVEY_GENERATION_MESSAGE_MISSING":
          case "SURVEY_GENERATION_OUTPUT_MISSING":
            return "EMPTY_MODEL_RESPONSE";
          case "SURVEY_GENERATION_FILTERED":
          case "SURVEY_GENERATION_REFUSED":
          case "SURVEY_GENERATION_UPSTREAM_FAILED":
            return "MODEL_REQUEST_FAILED";
        }
      })();
      return tracedError(
        error.message,
        canonicalCode,
        error.statusCode,
        error.incompleteReason
          ? { "x-baroform-incomplete-reason": error.incompleteReason }
          : {},
      );
    }

    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.name === "ZodError")
    ) {
      return tracedError(
        "생성된 설문 구조를 확인하지 못했어요. 다시 시도해주세요.",
        "OUTPUT_JSON_INVALID",
        502,
      );
    }

    if (lifecycle.deadlineReached()) {
      return tracedError(
        "설문 생성 시간이 서버의 안전 한도에 가까워져 작업을 마쳤어요. 다시 시도해 주세요.",
        "GENERATION_TIMEOUT",
        504,
      );
    }

    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return tracedError(
        "설문 생성 서비스의 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
        "MODEL_TIMEOUT",
        504,
      );
    }

    if (
      error instanceof OpenAI.APIUserAbortError ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return tracedError(
        "사용자가 설문 생성을 취소했어요.",
        "CLIENT_CANCELLED",
        499,
      );
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return tracedError(
        "설문 생성 서비스와 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
        "MODEL_REQUEST_FAILED",
        502,
      );
    }

    if (error instanceof OpenAI.APIError) {
      return tracedError(
        "설문 생성 서비스에 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
        error.status === 429 ? "MODEL_RATE_LIMITED" : "MODEL_REQUEST_FAILED",
        502,
      );
    }

    if (upstreamCompleted && error instanceof Error) {
      console.warn("survey-generation-output-fallback", {
        requestId,
        name: error.name,
      });
      return respondWithPlanBasedFallback(
        "model-output-rejected",
        error instanceof SurveyValidationError && error.category === "semantic"
          ? "semantic_repair_fallback"
          : "parse_failure_fallback",
      );
    }

    return tracedError(
      "설문 생성 중 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      "UNKNOWN_GENERATION_ERROR",
      500,
    );
  } finally {
    lifecycle.dispose();
    if (modelCallStarted && !usageLogged) {
      logOpenAiUsage(null, {
        requestId,
        userId: sessionUserId,
        requestType: "survey_generate",
        surveyMode,
        model: modelRoute.model,
        reasoningEffort: modelRoute.reasoningEffort,
        requestedServiceTier: modelRoute.requestedServiceTier,
        retryCount: actualRetryCount,
        startedAt: modelCallStartedAt,
        success: false,
        errorCode: "MODEL_REQUEST_FAILED",
      });
    }
    if (generationFlights.get(cacheKey) === currentFlight) {
      generationFlights.delete(cacheKey);
    }
    releaseFlight();
  }
}

function backgroundMetadata(response: OpenAIResponse) {
  const metadata = response.metadata ?? {};
  const prompt = normalizePrompt(metadata.baro_prompt ?? "");
  const targetGrade = isTargetGrade(metadata.baro_target_grade)
    ? metadata.baro_target_grade
    : null;
  const parsedCount = Number.parseInt(metadata.baro_question_count ?? "", 10);
  if (
    !prompt ||
    !targetGrade ||
    !Number.isInteger(parsedCount) ||
    parsedCount < 1 ||
    parsedCount > 30
  ) {
    return null;
  }
  return {
    prompt,
    targetGrade,
    questionCount: parsedCount,
    hasReferences: metadata.baro_has_references === "true",
    referenceKey: metadata.baro_reference_key || "none",
    requestScope: metadata.baro_request_scope || "background",
    organizationLocationContext:
      metadata.baro_organization_context?.trim() || null,
  };
}

function backgroundJobParams(request: Request) {
  const params = new URL(request.url).searchParams;
  const responseId = params.get("responseId")?.trim() ?? "";
  const jobToken = params.get("jobToken")?.trim() ?? "";
  if (!/^resp_[A-Za-z0-9_-]{8,200}$/.test(responseId) || !jobToken) {
    return null;
  }
  return { responseId, jobToken };
}

async function handleBackgroundStatus(request: Request, requestId: string) {
  if (!sameOrigin(request)) {
    return apiError(
      "현재 사이트에서 다시 시도해 주세요.",
      "INVALID_ORIGIN",
      403,
      {},
      requestId,
    );
  }
  const job = backgroundJobParams(request);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!job || !apiKey || !validBackgroundJobToken(job.responseId, job.jobToken, apiKey)) {
    return apiError(
      "정밀·연구 설문 작업 정보를 확인하지 못했어요.",
      "INVALID_BACKGROUND_JOB",
      400,
      {},
      requestId,
    );
  }

  try {
    const openai = createTrackedOpenAiClient(apiKey, backgroundPollTimeoutMs);
    const response = await openai.responses.retrieve(job.responseId, {}, {
      signal: request.signal,
    });
    if (response.status === "queued" || response.status === "in_progress") {
      return apiPayload(
        { status: response.status, responseId: response.id },
        202,
        {
          "x-baroform-ai-mode": "background",
          "x-baroform-survey-mode": "research",
        },
        requestId,
      );
    }
    if (response.status === "cancelled") {
      return apiError(
        "사용자가 정밀·연구 설문 생성을 취소했어요.",
        "SURVEY_GENERATION_CANCELLED",
        499,
        {},
        requestId,
      );
    }
    if (response.status === "incomplete") {
      return apiError(
        "정밀·연구 설문의 응답이 완전하지 않아 적용하지 않았어요.",
        "SURVEY_GENERATION_INCOMPLETE",
        502,
        {},
        requestId,
      );
    }
    if (response.status !== "completed") {
      return apiError(
        "정밀·연구 설문 생성에 실패했어요. 다시 시도해 주세요.",
        "SURVEY_GENERATION_BACKGROUND_FAILED",
        502,
        {},
        requestId,
      );
    }

    const context = backgroundMetadata(response);
    if (!context) {
      return apiError(
        "정밀·연구 설문의 작업 정보를 복원하지 못했어요.",
        "SURVEY_GENERATION_BACKGROUND_FAILED",
        502,
        {},
        requestId,
      );
    }
    const modelRoute = resolveSurveyGenerationModel("research");
    const model = modelRoute.model;
    const parseParams = buildSurveyAiRequest(context.prompt, null, model, {
      surveyMode: "research",
      targetGrade: context.targetGrade,
      questionCount: context.questionCount,
      organizationLocationContext: context.organizationLocationContext,
      reasoningEffort: modelRoute.reasoningEffort,
      serviceTier: modelRoute.requestedServiceTier,
    });
    const backgroundCacheKey = generationCacheKey({
      requestScope: context.requestScope,
      surveyMode: "research",
      prompt: context.prompt.toLocaleLowerCase("ko-KR"),
      targetGrade: context.targetGrade,
      questionCount: context.questionCount,
      referenceKey: context.referenceKey,
    });
    backgroundGenerationCache.delete(backgroundCacheKey);
    let result: SurveyDraftResult;
    try {
      const parsedResponse = parseResponse(response, parseParams);
      result = parseSurveyDraftResponse(
        parsedResponse,
        context.prompt,
        context.questionCount,
        context.targetGrade,
        context.hasReferences,
      );
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        error instanceof SurveyGenerationResponseError ||
        (error instanceof Error && error.name === "ZodError")
      ) {
        throw error;
      }
      if (!(error instanceof Error)) throw error;

      console.warn("survey-background-output-fallback", {
        requestId,
        responseId: response.id,
        name: error.name,
      });
      const verifiedFallback = verifiedResearchFallback(
        context.prompt,
        context.targetGrade,
        context.questionCount,
      );
      const resilientFallback =
        verifiedFallback ??
        resilientDraftFallback(
          context.prompt,
          context.targetGrade,
          context.questionCount,
        );
      const outputFallbackResponse = fallbackResponse(
        resilientFallback,
        "model-output-rejected",
        "research",
        requestId,
        undefined,
        "parse_failure_fallback",
      );
      if (outputFallbackResponse.ok) {
        cacheResult(
          backgroundCacheKey,
          Date.now(),
          resilientFallback,
          "verified-fallback",
          "model-output-rejected",
          "parse_failure_fallback",
        );
      }
      return outputFallbackResponse;
    }

    const isDirectProportion =
      !context.hasReferences && isSimpleProportionSurveyRequest(context.prompt);
    const isDirectFrequency =
      !context.hasReferences && isLiteralFrequencySurveyRequest(context.prompt);
    const isDirectSleepDuration =
      !context.hasReferences && isSleepDurationSurveyRequest(context.prompt);
    const isDirectDuration =
      !context.hasReferences && isExplicitDurationSurveyRequest(context.prompt);
    if (
      result.status !== "needs_clarification" &&
      (isDirectProportion ||
        isDirectFrequency ||
        isDirectSleepDuration ||
        isDirectDuration)
    ) {
      const deterministic = fastDraftFallback(
        context.prompt,
        context.targetGrade,
        context.questionCount,
      );
      result = {
        ...deterministic,
        status: result.status,
        research: result.research,
        surveyPlan: result.surveyPlan,
        qualityCheck: result.qualityCheck,
        completionMessage: result.completionMessage,
      };
    }

    cacheResult(
      backgroundCacheKey,
      Date.now(),
      result,
      "model",
      undefined,
      "openai",
    );
    return apiSuccess(
      result,
      {
        "x-baroform-ai-mode": "background",
        "x-baroform-ai-attempt": "single-background-response",
        "x-baroform-survey-mode": "research",
      },
      requestId,
    );
  } catch (error) {
    console.error("survey-background-status-failed", {
      requestId,
      responseId: job.responseId,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return apiError(
        "정밀·연구 설문 상태 확인이 지연되고 있어요. 잠시 후 다시 확인해 주세요.",
        "SURVEY_GENERATION_OPENAI_TIMEOUT",
        504,
        {},
        requestId,
      );
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return apiError(
        "설문 생성 서비스와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
        "SURVEY_GENERATION_CONNECTION_ERROR",
        502,
        {},
        requestId,
      );
    }
    if (
      error instanceof SyntaxError ||
      error instanceof SurveyGenerationResponseError ||
      error instanceof SurveyValidationError
    ) {
      return apiError(
        "정밀·연구 설문의 응답이 완전하지 않아 적용하지 않았어요.",
        "SURVEY_GENERATION_INCOMPLETE",
        502,
        {},
        requestId,
      );
    }
    return apiError(
      "정밀·연구 설문 생성에 실패했어요. 다시 시도해 주세요.",
      "SURVEY_GENERATION_BACKGROUND_FAILED",
      502,
      {},
      requestId,
    );
  }
}

async function cancelBackgroundJob(request: Request, requestId: string) {
  if (!sameOrigin(request)) {
    return apiError(
      "현재 사이트에서 다시 시도해 주세요.",
      "INVALID_ORIGIN",
      403,
      {},
      requestId,
    );
  }
  const job = backgroundJobParams(request);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!job || !apiKey || !validBackgroundJobToken(job.responseId, job.jobToken, apiKey)) {
    return apiError(
      "정밀·연구 설문 작업 정보를 확인하지 못했어요.",
      "INVALID_BACKGROUND_JOB",
      400,
      {},
      requestId,
    );
  }
  try {
    const openai = createTrackedOpenAiClient(apiKey, backgroundPollTimeoutMs);
    await openai.responses.cancel(job.responseId, { signal: request.signal });
    for (const [key, entry] of backgroundGenerationCache) {
      if (entry.responseId === job.responseId) backgroundGenerationCache.delete(key);
    }
    return apiPayload(
      { status: "cancelled", responseId: job.responseId },
      200,
      { "x-baroform-ai-mode": "background" },
      requestId,
    );
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status === 409) {
      return apiPayload(
        { status: "completed", responseId: job.responseId },
        200,
        { "x-baroform-ai-mode": "background" },
        requestId,
      );
    }
    return apiError(
      "정밀·연구 설문 취소 요청을 처리하지 못했어요.",
      "SURVEY_GENERATION_BACKGROUND_FAILED",
      502,
      {},
      requestId,
    );
  }
}

export async function GET(request: Request) {
  return handleBackgroundStatus(request, crypto.randomUUID());
}

export async function DELETE(request: Request) {
  return cancelBackgroundJob(request, crypto.randomUUID());
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    return await createSurveyDraftResponse(request, requestId);
  } catch (error) {
    console.error("survey-generation-unhandled", {
      requestId,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return apiError(
      "설문 생성 중 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      "SURVEY_GENERATION_INTERNAL_ERROR",
      500,
      {},
      requestId,
    );
  }
}
