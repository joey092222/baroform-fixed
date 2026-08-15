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
  parseRequestedSurveyMode,
  type SurveyMode,
} from "@/app/survey-mode";
import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CacheEntry = {
  expiresAt: number;
  result: SurveyDraftResult;
  mode: "model" | "verified-fallback";
  reason?: string;
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
};

const surveyDraftRequestSchema = z
  .object({
    prompt: z.string().optional(),
    surveyMode: z.unknown().optional(),
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
) {
  return Response.json(
    { ok: false, error: message, code, requestId },
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
    { ...result, ok: true, requestId },
    {
      headers: {
        ...noStoreHeaders,
        ...headers,
        "x-baroform-request-id": requestId,
      },
    },
  );
}

function fallbackResponse(
  result: SurveyDraftResult,
  reason: string,
  surveyMode: SurveyMode,
  requestId: string,
) {
  if (result.status !== "needs_clarification") {
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
      return apiError(
        `안전한 설문 초안을 만들지 못했어요. ${issues.join(" ")}`,
        "SURVEY_GENERATION_FAILED",
        422,
        {
          "x-baroform-ai-mode": "verified-fallback",
          "x-baroform-ai-fallback": reason,
        },
        requestId,
      );
    }
  }
  return apiSuccess(
    result,
    {
      "x-baroform-ai-mode": "verified-fallback",
      "x-baroform-ai-fallback": reason,
      "x-baroform-survey-mode": surveyMode,
    },
    requestId,
  );
}

function generatedQuestionCount(result: SurveyDraftResult) {
  return result.status === "needs_clarification"
    ? 0
    : result.blueprint.aiQuestions.length;
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
  outcome: "model" | "cache" | "verified-fallback" | "validation-error";
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
    /(?:대학생|대학원생|중학생|고등학생|청년|직장인|학부모|교사|사용자|이용자|소비자)/.test(
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
) {
  responseCache.set(key, {
    expiresAt: now + cacheLifetimeMs,
    result,
    mode,
    reason,
  });
}

function normalizePrompt(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
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
  if (!sameOrigin(request)) {
    return apiError(
      "이 사이트에서 다시 시도해주세요.",
      "INVALID_ORIGIN",
      403,
      {},
      requestId,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 3_600_000) {
    return apiError(
      "요청 내용이 너무 길어요.",
      "REQUEST_TOO_LARGE",
      413,
      {},
      requestId,
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return apiError(
      "설문 내용을 읽지 못했어요.",
      "INVALID_JSON",
      400,
      {},
      requestId,
    );
  }

  const parsedPayload = surveyDraftRequestSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return apiError(
      "설문 생성 요청 형식을 확인해주세요.",
      "INVALID_REQUEST",
      400,
      {},
      requestId,
    );
  }
  const payload = parsedPayload.data;

  const surveyMode = parseRequestedSurveyMode(payload.surveyMode);
  if (!surveyMode) {
    return apiError(
      "설문 제작 방식을 다시 선택해주세요.",
      "INVALID_SURVEY_MODE",
      400,
      {},
      requestId,
    );
  }

  const enteredPrompt =
    typeof payload.prompt === "string" ? normalizePrompt(payload.prompt) : "";
  const references = await parseSurveyReferences(payload.references);
  if (!references) {
    return apiError(
      "첨부한 사진·파일·링크를 확인해주세요.",
      "INVALID_REFERENCES",
      400,
      {},
      requestId,
    );
  }
  const hasReferences =
    references.images.length > 0 ||
    references.files.length > 0 ||
    references.links.length > 0;
  if (enteredPrompt.length > 300 || (enteredPrompt.length < 2 && !hasReferences)) {
    return apiError(
      "설문 내용은 2자 이상 300자 이하로 적거나 참고 자료를 추가해주세요.",
      "INVALID_PROMPT",
      400,
      {},
      requestId,
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

  const now = Date.now();
  pruneMemory(now);
  const referenceKey = await referenceFingerprint(references);
  const cacheKey = `${surveyMode}|${prompt.toLocaleLowerCase("ko-KR")}|${targetGrade}|${questionCount}|${referenceKey}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
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
  if (!apiKey) {
    if (hasReferences) {
      return apiError(
        "첨부 자료 분석 연결을 확인하는 중이에요. 잠시 후 다시 시도해주세요.",
        "REFERENCE_AI_UNAVAILABLE",
        503,
        {},
        requestId,
      );
    }
    const verifiedFallback = verifiedResearchFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    if (verifiedFallback) {
      cacheResult(
        cacheKey,
        now,
        verifiedFallback,
        "verified-fallback",
        "api-key-missing",
      );
      const response = fallbackResponse(
        verifiedFallback,
        "api-key-missing",
        surveyMode,
        requestId,
      );
      logGenerationMetric({
        surveyMode,
        startedAt: generationStartedAt,
        success: response.ok,
        questionCount: generatedQuestionCount(verifiedFallback),
        searchUsed: false,
        outcome: "verified-fallback",
      });
      return response;
    }
    const resilientFallback = resilientDraftFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    cacheResult(
      cacheKey,
      now,
      resilientFallback,
      "verified-fallback",
      "api-key-missing",
    );
    const response = fallbackResponse(
      resilientFallback,
      "api-key-missing",
      surveyMode,
      requestId,
    );
    logGenerationMetric({
      surveyMode,
      startedAt: generationStartedAt,
      success: response.ok,
      questionCount: generatedQuestionCount(resilientFallback),
      searchUsed: false,
      outcome: "verified-fallback",
    });
    return response;
  }

  const model = process.env.OPENAI_SURVEY_MODEL?.trim() || "gpt-5.6";
  const fallback = applyDraftSettings(
    analyzeSurveyPrompt(prompt),
    targetGrade,
    questionCount,
  );
  let organizationLocationContext: string | null = null;
  try {
    const sessionUser = await getSessionUser(request);
    if (sessionUser) {
      organizationLocationContext = `로그인 프로필 학교: ${schoolLabel(sessionUser.schoolId)}`;
    }
  } catch {
    // 로그인 저장소가 연결되지 않아도 사용자 원문만으로 설문을 생성한다.
  }

  const controller = new AbortController();
  const timeoutMs = hasReferences ? 285_000 : 280_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const openai = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: timeoutMs,
  });

  try {
    let rawResult: Awaited<ReturnType<typeof openai.responses.parse>>;
    try {
      rawResult = await openai.responses.parse(
        buildSurveyAiRequest(prompt, fallback, model, {
          surveyMode,
          targetGrade,
          questionCount,
          references,
          organizationLocationContext,
        }),
        { signal: controller.signal },
      );
    } catch (error) {
      const isTimeout =
        error instanceof OpenAI.APIConnectionTimeoutError ||
        (error instanceof Error && error.name === "AbortError");
      const isInvalidStructuredOutput =
        error instanceof SyntaxError ||
        (error instanceof Error && error.name === "ZodError");
      const isHttpFailure =
        error instanceof OpenAI.APIError &&
        !(error instanceof OpenAI.APIConnectionError);

      if (isTimeout || isInvalidStructuredOutput || isHttpFailure) {
        throw error;
      }

      console.warn("survey-generation-transport-fallback", {
        requestId,
        name: error instanceof Error ? error.name : "UnknownError",
      });
      const verifiedFallback = verifiedResearchFallback(
        prompt,
        targetGrade,
        questionCount,
      );
      const resilientFallback =
        verifiedFallback ??
        resilientDraftFallback(prompt, targetGrade, questionCount);
      cacheResult(
        cacheKey,
        now,
        resilientFallback,
        "verified-fallback",
        "responses-api-error",
      );
      const fallbackApiResponse = fallbackResponse(
        resilientFallback,
        "responses-api-error",
        surveyMode,
        requestId,
      );
      logGenerationMetric({
        surveyMode,
        startedAt: generationStartedAt,
        success: fallbackApiResponse.ok,
        questionCount: generatedQuestionCount(resilientFallback),
        searchUsed: false,
        outcome: "verified-fallback",
      });
      return fallbackApiResponse;
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
    }

    cacheResult(cacheKey, now, result, "model");
    logGenerationMetric({
      surveyMode,
      startedAt: generationStartedAt,
      success: true,
      questionCount: generatedQuestionCount(result),
      searchUsed: responseUsedWebSearch(rawResult),
      requestId: responseRequestId(rawResult),
      outcome: "model",
    });
    return apiSuccess(
      result,
      {
        "x-baroform-ai-mode": "model",
        "x-baroform-ai-attempt": "single-response",
        "x-baroform-survey-mode": surveyMode,
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof SurveyValidationError) {
      logGenerationMetric({
        surveyMode,
        startedAt: generationStartedAt,
        success: false,
        questionCount: 0,
        searchUsed: false,
        outcome: "validation-error",
      });
      return apiError(
        `생성된 설문 구조를 안전하게 적용하지 못했어요. ${error.issues.join(" ")}`,
        "SURVEY_VALIDATION_FAILED",
        422,
        {},
        requestId,
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
      return apiError(
        error.message,
        error.code,
        error.statusCode,
        error.incompleteReason
          ? { "x-baroform-incomplete-reason": error.incompleteReason }
          : {},
        requestId,
      );
    }

    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.name === "ZodError")
    ) {
      return apiError(
        "생성된 설문 구조를 확인하지 못했어요. 다시 시도해주세요.",
        "SURVEY_GENERATION_OUTPUT_INVALID",
        502,
        {},
        requestId,
      );
    }

    if (
      error instanceof OpenAI.APIConnectionTimeoutError ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return apiError(
        "설문 생성 서비스의 응답 시간이 초과됐어요. 잠시 후 다시 시도해주세요.",
        "SURVEY_GENERATION_TIMEOUT",
        504,
        {},
        requestId,
      );
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return apiError(
        "설문 생성 서비스와 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
        "SURVEY_GENERATION_CONNECTION_ERROR",
        502,
        {},
        requestId,
      );
    }

    if (error instanceof OpenAI.APIError) {
      return apiError(
        "설문 생성 서비스에 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
        "SURVEY_GENERATION_UPSTREAM_ERROR",
        502,
        {},
        requestId,
      );
    }

    return apiError(
      "설문 생성 중 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      "SURVEY_GENERATION_FAILED",
      500,
      {},
      requestId,
    );
  } finally {
    clearTimeout(timeout);
  }
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
