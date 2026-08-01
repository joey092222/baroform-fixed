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
import { lookupVerifiedSurveyKnowledge } from "../../survey-knowledge";
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

const allowedTargetGrades = new Set([
  "1학년",
  "2학년",
  "3학년",
  "4학년",
  "1-2학년",
  "3-4학년",
  "전학년",
]);

function applyDraftSettings(
  blueprint: SurveyBlueprint,
  targetGrade: string,
  questionCount: number,
): SurveyBlueprint {
  const audience = targetGrade === "전학년" ? "전학년 재학생" : `${targetGrade} 재학생`;
  return {
    ...blueprint,
    description: `${audience}을 대상으로 ${blueprint.description}`.slice(0, 500),
    respondentGroup: blueprint.respondentGroup
      ? `${audience} 중 ${blueprint.respondentGroup}`.slice(0, 80)
      : audience,
    detectedSignals: [
      ...(blueprint.detectedSignals ?? []).filter(
        (signal) => !signal.startsWith("응답 학년 ·"),
      ),
      `응답 학년 · ${targetGrade}`,
    ],
    templateQuestions: resizeSurveyQuestions(
      blueprint.templateQuestions,
      Math.min(5, questionCount),
    ),
    aiQuestions: resizeSurveyQuestions(blueprint.aiQuestions, questionCount),
  };
}

function verifiedResearchFallback(
  prompt: string,
  targetGrade: string,
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
  targetGrade: string,
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

function cacheResult(key: string, now: number, result: SurveyDraftResult) {
  responseCache.set(key, {
    expiresAt: now + cacheLifetimeMs,
    result,
  });
}

function normalizePrompt(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return apiError("요청 내용이 너무 길어요.", "REQUEST_TOO_LARGE", 413);
  }

  let payload: {
    prompt?: unknown;
    targetGrade?: unknown;
    questionCount?: unknown;
  };
  try {
    payload = (await request.json()) as {
      prompt?: unknown;
      targetGrade?: unknown;
      questionCount?: unknown;
    };
  } catch {
    return apiError("설문 내용을 읽지 못했어요.", "INVALID_JSON", 400);
  }

  const prompt =
    typeof payload.prompt === "string" ? normalizePrompt(payload.prompt) : "";
  if (prompt.length < 2 || prompt.length > 300) {
    return apiError(
      "설문 내용은 2자 이상 300자 이하로 적어주세요.",
      "INVALID_PROMPT",
      400,
    );
  }
  const targetGrade =
    typeof payload.targetGrade === "string" &&
    allowedTargetGrades.has(payload.targetGrade)
      ? payload.targetGrade
      : "전학년";
  const questionCount =
    typeof payload.questionCount === "number" &&
    Number.isInteger(payload.questionCount)
      ? Math.min(30, Math.max(3, payload.questionCount))
      : 7;

  const now = Date.now();
  pruneMemory(now);
  const cacheKey = `${prompt.toLocaleLowerCase("ko-KR")}|${targetGrade}|${questionCount}`;
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
    const verifiedFallback = verifiedResearchFallback(
      prompt,
      targetGrade,
      questionCount,
    );
    if (verifiedFallback) {
      cacheResult(cacheKey, now, verifiedFallback);
      return fallbackResponse(verifiedFallback, "api-key-missing");
    }
    return apiError(
      "정보조사 연결이 아직 설정되지 않았어요. 운영자가 AI 검색 키를 등록한 뒤 다시 시도해주세요.",
      "AI_NOT_CONFIGURED",
      503,
    );
  }

  const model = process.env.OPENAI_SURVEY_MODEL?.trim() || "gpt-5.6-terra";
  const fallback = applyDraftSettings(
    analyzeSurveyPrompt(prompt),
    targetGrade,
    questionCount,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 32_000);

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
        }),
      ),
      signal: controller.signal,
    });

    if (!upstream.ok) {
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
        return apiError(
          "지금 AI 요청이 많아요. 잠시 후 다시 시도해주세요.",
          "AI_BUSY",
          503,
        );
      }
      return apiError(
        "AI가 초안을 완성하지 못했어요. 잠시 후 다시 시도해주세요.",
        "AI_UPSTREAM_ERROR",
        502,
      );
    }

    const rawResult = (await upstream.json()) as unknown;
    const result = parseSurveyDraftResponse(rawResult, prompt, questionCount);
    cacheResult(cacheKey, now, result);
    return Response.json(result, { headers: noStoreHeaders });
  } catch (error) {
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
    return apiError(
      "AI가 설문을 구성하지 못했어요. 입력을 조금 더 구체적으로 적어주세요.",
      "AI_INVALID_RESULT",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
