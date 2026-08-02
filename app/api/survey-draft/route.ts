import {
  analyzeSurveyPrompt,
  resizeSurveyQuestions,
  type SurveyBlueprint,
} from "../../survey-intent";
import {
  buildSurveyAiRequest,
  parseSurveyDraftResponse,
  type SurveyDraftResult,
} from "../../survey-ai";
import {
  applyTargetGradeToQuestions,
  isTargetGrade,
  respondentGroupForGrade,
  surveyDescriptionForGrade,
  type TargetGrade,
} from "../../survey-grade";
import { lookupVerifiedSurveyKnowledge } from "../../survey-knowledge";
import {
  maxReferenceFilesTotalBytes,
  referenceFileMimeTypes,
} from "../../reference-files";
import { verifyReferenceFileToken } from "../../reference-file-upload";
import { consumePersistentAiRateLimit } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CacheEntry = {
  expiresAt: number;
  result: SurveyDraftResult;
};

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

function apiError(message: string, code: string, status: number) {
  return Response.json(
    { error: message, code },
    { status, headers: noStoreHeaders },
  );
}

function fallbackResponse(result: SurveyDraftResult, reason: string) {
  return Response.json(result, {
    headers: {
      ...noStoreHeaders,
      "x-baroform-ai-mode": "verified-fallback",
      "x-baroform-ai-fallback": reason,
    },
  });
}

function invalidResultReason(error: unknown) {
  if (!(error instanceof Error)) return "invalid-result";
  if (/필수 정보조사|정보조사가 끝까지/.test(error.message)) {
    return "research-incomplete";
  }
  if (/출처|URL/.test(error.message)) return "source-validation";
  if (/조사 방식 표현|이용 대상으로|문맥|평가 대상/.test(error.message)) {
    return "semantic-validation";
  }
  if (/형식|JSON|비어|상태/.test(error.message)) return "response-format";
  return "invalid-result";
}

function applyDraftSettings(
  blueprint: SurveyBlueprint,
  targetGrade: TargetGrade,
  questionCount: number,
): SurveyBlueprint {
  const templateCount = Math.min(5, questionCount);
  const aiQuestions = applyTargetGradeToQuestions(
    resizeSurveyQuestions(blueprint.aiQuestions, questionCount),
    targetGrade,
    questionCount,
  );
  return {
    ...blueprint,
    description: surveyDescriptionForGrade(
      blueprint.description,
      targetGrade,
    ),
    respondentGroup: respondentGroupForGrade(
      blueprint.respondentGroup,
      targetGrade,
    ),
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
    ),
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
    sources: knowledge.sources.map((source) => ({
      ...source,
      domain: new URL(source.url).hostname.replace(/^www\./, ""),
    })),
  };
  const hasExplicitIntent =
    /(만족|불만|문제|개선|평가|선호|수요|인지|의향|경험|이용\s*(?:현황|행태|빈도)|가입\s*(?:여부|의향)|참여\s*(?:여부|경험)|조사|설문)/.test(
      prompt,
    );
  if (!hasExplicitIntent) {
    return {
      status: "needs_clarification",
      prompt,
      clarification: {
        question: `‘${knowledge.canonicalName}’에서 무엇을 알아보고 싶나요?`,
        reason:
          "대상의 정체는 확인했지만 조사 목적에 따라 질문 구성이 크게 달라져요.",
        options: [
          "이용 만족도와 개선점",
          "이용 경험과 불편 사항",
          "직접 설명할게요",
        ],
      },
      research,
    };
  }

  return {
    status: "ready",
    prompt,
    blueprint,
    research,
  };
}

function fastDraftFallback(
  prompt: string,
  targetGrade: TargetGrade,
  questionCount: number,
): SurveyDraftResult {
  const blueprint = applyDraftSettings(
    analyzeSurveyPrompt(prompt),
    targetGrade,
    questionCount,
  );
  return {
    status: "ready",
    prompt,
    blueprint,
    research: {
      status: "fallback",
      entity: null,
      summary:
        "자료 확인이 지연되어 입력 문맥을 기준으로 먼저 문항을 설계했어요. 편집 화면에서 바로 다듬을 수 있어요.",
      facts: [],
      sources: [],
    },
  };
}

function hasUsableSurveyDirection(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (
    /^(?:설문|설문\s*조사|조사|만족도|의견|생각|평가|수요|문제점|개선점|대학생\s*설문|학교\s*설문)$/.test(
      normalized,
    )
  ) {
    return false;
  }
  return /(만족|불만|문제|개선|평가|선호|수요|인지|의향|경험|이용|사용|가입|참여|적응|학교생활|대학생활|등하교|통학|구매|불편|장벽|행태|빈도)/.test(
    normalized,
  );
}

function clarificationOptions(blueprint: SurveyBlueprint) {
  switch (blueprint.domain) {
    case "club":
      return [
        "가입 의향과 망설이는 이유",
        "활동 만족도와 개선점",
        "인지도와 관심 정도",
      ];
    case "event":
      return [
        "참여 만족도와 개선점",
        "참여 의향과 불참 이유",
        "프로그램 선호와 수요",
      ];
    case "course":
      return [
        "수업 만족도와 개선점",
        "학습 경험과 어려움",
        "과제·평가 방식에 대한 의견",
      ];
    case "cafeteria":
    case "building":
    case "library":
    case "dormitory":
    case "service":
    case "facility":
      return [
        "이용 만족도와 개선점",
        "이용 중 불편 사항",
        "이용 경험과 빈도",
      ];
    default:
      return [
        "만족도와 개선점",
        "수요와 참여 의향",
        "경험과 불편 사항",
      ];
  }
}

function clarificationFallback(
  prompt: string,
  targetGrade: TargetGrade,
  questionCount: number,
): SurveyDraftResult {
  const blueprint = applyDraftSettings(
    analyzeSurveyPrompt(prompt),
    targetGrade,
    questionCount,
  );
  const target = (blueprint.evaluationTarget ?? blueprint.subject).trim();
  return {
    status: "needs_clarification",
    prompt,
    clarification: {
      question: target
        ? `‘${target}’에 대해 무엇을 알아보고 싶나요?`
        : "이 설문으로 무엇을 알아보고 싶나요?",
      reason:
        "문장이 짧아서가 아니라, 선택에 따라 문항 구성이 크게 달라지는 한 가지만 확인할게요.",
      options: clarificationOptions(blueprint),
    },
    research: {
      status: "fallback",
      entity: target || null,
      summary:
        "입력 문맥에서 대상은 파악했고, 조사 목적만 확인하면 바로 문항을 설계할 수 있어요.",
      facts: [],
      sources: [],
    },
  };
}

function resilientDraftFallback(
  prompt: string,
  targetGrade: TargetGrade,
  questionCount: number,
) {
  return hasUsableSurveyDirection(prompt)
    ? fastDraftFallback(prompt, targetGrade, questionCount)
    : clarificationFallback(prompt, targetGrade, questionCount);
}

function cacheResult(key: string, now: number, result: SurveyDraftResult) {
  responseCache.set(key, {
    expiresAt: now + cacheLifetimeMs,
    result,
  });
}

function normalizePrompt(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return apiError("이 사이트에서 다시 시도해주세요.", "INVALID_ORIGIN", 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 3_600_000) {
    return apiError("요청 내용이 너무 길어요.", "REQUEST_TOO_LARGE", 413);
  }

  let payload: {
    prompt?: unknown;
    targetGrade?: unknown;
    questionCount?: unknown;
    references?: unknown;
  };
  try {
    payload = (await request.json()) as {
      prompt?: unknown;
      targetGrade?: unknown;
      questionCount?: unknown;
      references?: unknown;
    };
  } catch {
    return apiError("설문 내용을 읽지 못했어요.", "INVALID_JSON", 400);
  }

  const enteredPrompt =
    typeof payload.prompt === "string" ? normalizePrompt(payload.prompt) : "";
  const references = await parseSurveyReferences(payload.references);
  if (!references) {
    return apiError(
      "첨부한 사진·파일·링크를 확인해주세요.",
      "INVALID_REFERENCES",
      400,
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
    );
  }
  const prompt =
    enteredPrompt || "첨부 자료를 바탕으로 만족도와 개선점을 조사하고 싶어요.";
  const targetGrade =
    typeof payload.targetGrade === "string" &&
    isTargetGrade(payload.targetGrade)
      ? payload.targetGrade
      : "전학년";
  const questionCount =
    typeof payload.questionCount === "number" &&
    Number.isInteger(payload.questionCount)
      ? Math.min(30, Math.max(3, payload.questionCount))
      : 7;

  const now = Date.now();
  pruneMemory(now);
  const referenceKey = await referenceFingerprint(references);
  const cacheKey = `${prompt.toLocaleLowerCase("ko-KR")}|${targetGrade}|${questionCount}|${referenceKey}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return Response.json(cached.result, { headers: noStoreHeaders });
  }

  if (!(await consumeRateLimit(request, now))) {
    return apiError(
      "짧은 시간에 AI 초안을 많이 만들었어요. 잠시 후 다시 시도해주세요.",
      "RATE_LIMITED",
      429,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (hasReferences) {
      return apiError(
        "첨부 자료 분석 연결을 확인하는 중이에요. 잠시 후 다시 시도해주세요.",
        "REFERENCE_AI_UNAVAILABLE",
        503,
      );
    }
    const verifiedFallback = verifiedResearchFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    if (verifiedFallback) {
      cacheResult(cacheKey, now, verifiedFallback);
      return fallbackResponse(verifiedFallback, "api-key-missing");
    }
    const resilientFallback = resilientDraftFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    cacheResult(cacheKey, now, resilientFallback);
    return fallbackResponse(resilientFallback, "api-key-missing");
  }

  const model = process.env.OPENAI_SURVEY_MODEL?.trim() || "gpt-5.6-terra";
  const fallback = applyDraftSettings(
    analyzeSurveyPrompt(prompt),
    targetGrade,
    questionCount,
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    hasReferences ? 50_000 : 32_000,
  );

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildSurveyAiRequest(prompt, fallback, model, {
          targetGrade,
          questionCount,
          references,
        }),
      ),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      if (hasReferences) {
        return apiError(
          upstream.status === 429
            ? "첨부 자료 분석 요청이 많아요. 잠시 후 다시 시도해주세요."
            : "첨부한 사진·파일·링크를 분석하지 못했어요. 잠시 후 다시 시도해주세요.",
          "REFERENCE_AI_UNAVAILABLE",
          upstream.status === 429 ? 429 : 503,
        );
      }
      const verifiedFallback = verifiedResearchFallback(
        prompt,
        targetGrade,
        questionCount,
      );
      if (verifiedFallback) {
        cacheResult(cacheKey, now, verifiedFallback);
        return fallbackResponse(
          verifiedFallback,
          `upstream-${upstream.status}`,
        );
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return apiError(
          "AI 검색 연결을 확인하는 중이에요. 잠시 후 다시 시도해주세요.",
          "AI_AUTH_ERROR",
          503,
        );
      }
      if (upstream.status === 429) {
        const resilientFallback = resilientDraftFallback(
          prompt,
          targetGrade,
          questionCount,
        );
        cacheResult(cacheKey, now, resilientFallback);
        return fallbackResponse(resilientFallback, "upstream-429");
      }
      const resilientFallback = resilientDraftFallback(
        prompt,
        targetGrade,
        questionCount,
      );
      cacheResult(cacheKey, now, resilientFallback);
      return fallbackResponse(
        resilientFallback,
        `upstream-${upstream.status}`,
      );
    }

    const rawResult = (await upstream.json()) as unknown;
    const result = parseSurveyDraftResponse(
      rawResult,
      prompt,
      questionCount,
      targetGrade,
      hasReferences,
    );
    cacheResult(cacheKey, now, result);
    return Response.json(result, { headers: noStoreHeaders });
  } catch (error) {
    if (hasReferences) {
      return apiError(
        error instanceof Error && error.name === "AbortError"
          ? "첨부 자료 분석이 조금 오래 걸리고 있어요. 잠시 후 다시 시도해주세요."
          : "첨부 자료를 정확히 읽지 못했어요. 사진·파일·공개 링크를 확인해주세요.",
        "REFERENCE_ANALYSIS_FAILED",
        503,
      );
    }
    const verifiedFallback = verifiedResearchFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    if (verifiedFallback) {
      cacheResult(cacheKey, now, verifiedFallback);
      return fallbackResponse(verifiedFallback, invalidResultReason(error));
    }
    if (error instanceof Error && error.name === "AbortError") {
      const quickFallback = fastDraftFallback(
        prompt,
        targetGrade,
        questionCount,
      );
      cacheResult(cacheKey, now, quickFallback);
      return Response.json(quickFallback, {
        headers: { ...noStoreHeaders, "x-baroform-ai-status": "timeout-fallback" },
      });
    }
    const resilientFallback = resilientDraftFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    cacheResult(cacheKey, now, resilientFallback);
    return fallbackResponse(resilientFallback, invalidResultReason(error));
  } finally {
    clearTimeout(timeout);
  }
}
