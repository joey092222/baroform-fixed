import {
  buildSurveyRevisionRequest,
  parseSurveyRevisionResponse,
} from "@/app/survey-revision";
import type { SurveyQuestion } from "@/app/survey-intent";
import { resolveSurveyRevisionModel } from "@/app/lib/ai/model-router";
import {
  createTrackedOpenAiClient,
  logOpenAiUsage,
  runOpenAiWithTransientRetry,
  shouldMockOpenAi,
} from "@/app/lib/ai/openai-runtime";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const revisionTimeoutMs = 280_000;

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "이 사이트에서 다시 시도해주세요." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 120_000) {
    return Response.json(
      { error: "수정할 설문 내용이 너무 커요." },
      { status: 413, headers: noStoreHeaders },
    );
  }

  try {
    const payload = (await request.json()) as {
      title?: unknown;
      description?: unknown;
      questions?: unknown;
      instruction?: unknown;
      targetGrade?: unknown;
    };
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    const instruction = typeof payload.instruction === "string" ? payload.instruction.replace(/\s+/g, " ").trim() : "";
    const targetGrade = typeof payload.targetGrade === "string" ? payload.targetGrade.slice(0, 20) : "전학년";
    const questions = Array.isArray(payload.questions)
      ? (payload.questions.slice(0, 30) as SurveyQuestion[])
      : [];
    if (!title || questions.length === 0 || instruction.length < 2 || instruction.length > 500) {
      return Response.json(
        { error: "수정할 내용은 2자 이상 500자 이하로 적어주세요." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const requestId = crypto.randomUUID();
    const modelRoute = resolveSurveyRevisionModel(instruction);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (shouldMockOpenAi()) {
      return Response.json(
        {
          title,
          description,
          questions,
          message: "비용 없는 테스트 모드에서 수정 요청을 확인했어요.",
          mock: true,
        },
        { headers: noStoreHeaders },
      );
    }
    if (!apiKey) {
      return Response.json(
        { error: "AI 수정 연결이 아직 설정되지 않았어요." },
        { status: 503, headers: noStoreHeaders },
      );
    }
    const openai = createTrackedOpenAiClient(apiKey, revisionTimeoutMs);
    const startedAt = performance.now();
    let usageLogged = false;
    let actualRetryCount = 0;
    try {
      const attempted = await runOpenAiWithTransientRetry(
        () => openai.responses.create(buildSurveyRevisionRequest({
          model: modelRoute.model,
          title,
          description,
          questions,
          instruction,
          targetGrade,
          reasoningEffort: modelRoute.reasoningEffort,
          serviceTier: modelRoute.requestedServiceTier,
        }), {
          signal: request.signal,
        }),
        (retryCount) => {
          actualRetryCount = retryCount;
        },
      );
      const upstream = attempted.value;
      actualRetryCount = attempted.retryCount;
      logOpenAiUsage(upstream, {
        requestId,
        requestType: "survey_ai_edit",
        model: modelRoute.model,
        reasoningEffort: modelRoute.reasoningEffort,
        requestedServiceTier: modelRoute.requestedServiceTier,
        retryCount: actualRetryCount,
        startedAt,
        success: true,
      });
      usageLogged = true;
      const result = parseSurveyRevisionResponse(upstream);
      return Response.json(result, { headers: noStoreHeaders });
    } catch (error) {
      if (!usageLogged) {
        logOpenAiUsage(null, {
          requestId,
          requestType: "survey_ai_edit",
          model: modelRoute.model,
          reasoningEffort: modelRoute.reasoningEffort,
          requestedServiceTier: modelRoute.requestedServiceTier,
          retryCount: actualRetryCount,
          startedAt,
          success: false,
          errorCode:
            error instanceof OpenAI.APIConnectionTimeoutError
              ? "MODEL_TIMEOUT"
              : error instanceof OpenAI.APIError && error.status === 429
                ? "MODEL_RATE_LIMITED"
                : "MODEL_REQUEST_FAILED",
        });
      }
      throw error;
    }
  } catch (error) {
    const message =
      error instanceof OpenAI.APIConnectionTimeoutError
        ? "AI 수정 시간이 길어졌어요. 수정 요청을 조금 더 짧게 적어주세요."
        : error instanceof OpenAI.APIUserAbortError ||
            (error instanceof Error && error.name === "AbortError")
          ? "사용자가 AI 수정을 취소했어요."
          : error instanceof OpenAI.APIError && error.status === 429
            ? "지금 AI 수정 요청이 많아요. 잠시 후 다시 시도해주세요."
        : error instanceof Error
          ? "AI가 설문을 수정하지 못했어요. 잠시 후 다시 시도해주세요."
          : "AI가 설문을 수정하지 못했어요.";
    return Response.json(
      { error: message },
      { status: 502, headers: noStoreHeaders },
    );
  }
}
