import {
  buildSurveyRevisionRequest,
  parseSurveyRevisionResponse,
} from "@/app/survey-revision";
import type { SurveyQuestion } from "@/app/survey-intent";

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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return Response.json(
        { error: "AI 수정 연결이 아직 설정되지 않았어요." },
        { status: 503, headers: noStoreHeaders },
      );
    }
    const model = process.env.OPENAI_SURVEY_MODEL?.trim() || "gpt-5.6-terra";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), revisionTimeoutMs);
    try {
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(
          buildSurveyRevisionRequest({
            model,
            title,
            description,
            questions,
            instruction,
            targetGrade,
          }),
        ),
        signal: AbortSignal.any([request.signal, controller.signal]),
      });
      if (!upstream.ok) {
        return Response.json(
          {
            error:
              upstream.status === 429
                ? "지금 AI 수정 요청이 많아요. 잠시 후 다시 시도해주세요."
                : "AI가 설문을 수정하지 못했어요. 잠시 후 다시 시도해주세요.",
          },
          { status: 503, headers: noStoreHeaders },
        );
      }
      const result = parseSurveyRevisionResponse(await upstream.json());
      return Response.json(result, { headers: noStoreHeaders });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "AI 수정 시간이 길어졌어요. 수정 요청을 조금 더 짧게 적어주세요."
        : error instanceof Error
          ? error.message
          : "AI가 설문을 수정하지 못했어요.";
    return Response.json(
      { error: message },
      { status: 502, headers: noStoreHeaders },
    );
  }
}
