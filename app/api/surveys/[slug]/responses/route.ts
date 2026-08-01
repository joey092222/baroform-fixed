import { and, desc, eq } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { responses, surveys } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

type StoredQuestion = {
  id: number;
  title: string;
  type: "scale" | "single" | "multiple" | "text";
  options?: string[];
  required: boolean;
};

type IncomingAnswer = {
  questionId?: unknown;
  value?: unknown;
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

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "이 사이트에서 다시 시도해주세요." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 150_000) {
    return Response.json(
      { error: "응답 내용이 너무 커요." },
      { status: 413, headers: noStoreHeaders },
    );
  }

  try {
    const { slug } = await context.params;
    if (!/^[a-f0-9]{12}$/.test(slug)) {
      return Response.json(
        { error: "응답을 받을 수 없는 설문이에요." },
        { status: 404, headers: noStoreHeaders },
      );
    }
    const payload = (await request.json()) as {
      answers?: unknown[];
      completionSeconds?: number;
    };

    if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
      return Response.json(
        { error: "응답 내용이 비어 있어요." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const [survey] = await db
      .select({
        id: surveys.id,
        questionsJson: surveys.questionsJson,
      })
      .from(surveys)
      .where(and(eq(surveys.slug, slug), eq(surveys.isPublic, true)))
      .limit(1);

    if (!survey) {
      return Response.json(
        { error: "응답을 받을 수 없는 설문이에요." },
        { status: 404 },
      );
    }

    const questions = JSON.parse(survey.questionsJson) as StoredQuestion[];
    const incomingAnswers = new Map<number, IncomingAnswer>();
    for (const item of payload.answers.slice(0, 30)) {
      if (
        typeof item === "object" &&
        item !== null &&
        Number.isInteger((item as IncomingAnswer).questionId)
      ) {
        incomingAnswers.set(
          Number((item as IncomingAnswer).questionId),
          item as IncomingAnswer,
        );
      }
    }

    const normalizedAnswers: Array<{
      questionId: number;
      title: string;
      type: StoredQuestion["type"];
      value: number | string | string[];
    }> = [];

    for (const question of questions) {
      const raw = incomingAnswers.get(question.id)?.value;

      if (question.type === "scale") {
        const value =
          typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 5
            ? raw
            : null;
        if (question.required && value === null) {
          return Response.json(
            { error: `필수 질문 “${question.title}”에 응답해주세요.` },
            { status: 400 },
          );
        }
        if (value !== null) {
          normalizedAnswers.push({
            questionId: question.id,
            title: question.title,
            type: question.type,
            value,
          });
        }
        continue;
      }

      if (question.type === "multiple") {
        const allowed = new Set(question.options ?? []);
        const value = Array.isArray(raw)
          ? [
              ...new Set(
                raw
                  .filter((item): item is string => typeof item === "string")
                  .filter((item) => allowed.has(item))
                  .slice(0, 12),
              ),
            ]
          : [];
        if (question.required && value.length === 0) {
          return Response.json(
            { error: `필수 질문 “${question.title}”에 응답해주세요.` },
            { status: 400 },
          );
        }
        if (value.length > 0) {
          normalizedAnswers.push({
            questionId: question.id,
            title: question.title,
            type: question.type,
            value,
          });
        }
        continue;
      }

      if (question.type === "single") {
        const allowed = new Set(question.options ?? []);
        const value =
          typeof raw === "string" && allowed.has(raw) ? raw : "";
        if (question.required && value.length === 0) {
          return Response.json(
            { error: `필수 질문 “${question.title}”에 응답해주세요.` },
            { status: 400 },
          );
        }
        if (value.length > 0) {
          normalizedAnswers.push({
            questionId: question.id,
            title: question.title,
            type: question.type,
            value,
          });
        }
        continue;
      }

      const value = typeof raw === "string" ? raw.trim().slice(0, 4000) : "";
      if (question.required && value.length === 0) {
        return Response.json(
          { error: `필수 질문 “${question.title}”에 응답해주세요.` },
          { status: 400 },
        );
      }
      if (value.length > 0) {
        normalizedAnswers.push({
          questionId: question.id,
          title: question.title,
          type: question.type,
          value,
        });
      }
    }

    await db.insert(responses).values({
      id: crypto.randomUUID(),
      surveyId: survey.id,
      answersJson: JSON.stringify(normalizedAnswers),
      completionSeconds: Math.max(
        0,
        Math.min(86400, Math.round(payload.completionSeconds ?? 0)),
      ),
    });

    return Response.json(
      { ok: true },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 503, headers: noStoreHeaders },
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    if (!/^[a-f0-9]{12}$/.test(slug)) {
      return Response.json(
        { error: "결과를 볼 권한이 없어요." },
        { status: 403, headers: noStoreHeaders },
      );
    }
    const token =
      request.headers.get("x-baroform-manage-token")?.trim() ??
      new URL(request.url).searchParams.get("token") ??
      "";
    const db = await getDb();
    const [survey] = await db
      .select({
        id: surveys.id,
        manageToken: surveys.manageToken,
      })
      .from(surveys)
      .where(eq(surveys.slug, slug))
      .limit(1);

    if (!survey || !token || token !== survey.manageToken) {
      return Response.json(
        { error: "결과를 볼 권한이 없어요." },
        { status: 403 },
      );
    }

    const rows = await db
      .select({
        id: responses.id,
        answersJson: responses.answersJson,
        completionSeconds: responses.completionSeconds,
        createdAt: responses.createdAt,
      })
      .from(responses)
      .where(eq(responses.surveyId, survey.id))
      .orderBy(desc(responses.createdAt))
      .limit(500);

    const parsed = rows.map((row) => ({
      id: row.id,
      answers: JSON.parse(row.answersJson),
      completionSeconds: row.completionSeconds,
      createdAt: row.createdAt,
    }));

    return Response.json({ responses: parsed }, { headers: noStoreHeaders });
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
