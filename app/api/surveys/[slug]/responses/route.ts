import { and, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { cashTransactions, responses, surveys } from "@/db/schema";
import { surveyRewardAmount } from "@/app/rewards";
import {
  addBatchQualityFlags,
  assessResponseQuality,
  responseTextFingerprint,
} from "@/app/response-quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

type StoredQuestion = {
  id: number;
  title: string;
  type:
    | "scale"
    | "single"
    | "multiple"
    | "dropdown"
    | "shortText"
    | "text"
    | "date"
    | "time"
    | "section";
  options?: string[];
  required: boolean;
  scaleMin?: number;
  scaleMax?: number;
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
    const sessionUser = await getSessionUser(request);
    const [survey] = await db
      .select({
        id: surveys.id,
        title: surveys.title,
        ownerId: surveys.ownerId,
        rewardCash: surveys.rewardCash,
        questionsJson: surveys.questionsJson,
        durationMinutes: surveys.durationMinutes,
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

    if (sessionUser) {
      const [previousResponse] = await db
        .select({ id: responses.id })
        .from(responses)
        .where(
          and(
            eq(responses.surveyId, survey.id),
            eq(responses.memberId, sessionUser.id),
          ),
        )
        .limit(1);
      if (previousResponse) {
        return Response.json(
          { error: "이미 참여한 설문이에요. 캐시는 설문마다 한 번만 받을 수 있어요." },
          { status: 409, headers: noStoreHeaders },
        );
      }
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

      if (question.type === "section") continue;

      if (question.type === "scale") {
        const minimum = question.scaleMin === 0 ? 0 : 1;
        const maximum = Math.min(10, Math.max(2, question.scaleMax ?? 5));
        const value =
          typeof raw === "number" &&
          Number.isInteger(raw) &&
          raw >= minimum &&
          raw <= maximum
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

      if (question.type === "single" || question.type === "dropdown") {
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

    const responseId = crypto.randomUUID();
    const requestFingerprint = [
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      request.headers.get("user-agent")?.slice(0, 240) ?? "unknown",
      survey.id,
    ].join("|");
    const fingerprintHash = createHash("sha256")
      .update(requestFingerprint)
      .digest("hex");
    const responseValues = {
      id: responseId,
      surveyId: survey.id,
      memberId: sessionUser?.id ?? null,
      answersJson: JSON.stringify(normalizedAnswers),
      completionSeconds: Math.max(
        0,
        Math.min(86400, Math.round(payload.completionSeconds ?? 0)),
      ),
      fingerprintHash,
    };

    const rewardAmount = surveyRewardAmount({
      respondentId: sessionUser?.id,
      ownerId: survey.ownerId,
      rewardCash: survey.rewardCash,
    });

    if (sessionUser && rewardAmount > 0) {
      // The response and its reward have to land together: a stored response
      // with no payout silently owes the respondent cash, and a payout with no
      // response pays for nothing. One transaction, so neither can happen.
      await db.transaction(async (tx) => {
        await tx.insert(responses).values(responseValues);
        await tx.insert(cashTransactions).values({
          id: crypto.randomUUID(),
          memberId: sessionUser.id,
          surveyId: survey.id,
          responseId,
          amount: rewardAmount,
          description: `설문 참여 적립 · ${survey.title.slice(0, 80)}`,
        });
      });
    } else {
      await db.insert(responses).values(responseValues);
    }

    let balance: number | null = null;
    if (sessionUser) {
      const [wallet] = await db
        .select({
          balance: sql<number>`COALESCE(SUM(${cashTransactions.amount}), 0)::int`.mapWith(Number),
        })
        .from(cashTransactions)
        .where(eq(cashTransactions.memberId, sessionUser.id));
      balance = Number(wallet?.balance ?? 0);
    }

    return Response.json(
      {
        ok: true,
        reward: {
          amount: rewardAmount,
          balance,
          requiresLogin: !sessionUser,
          ownSurvey: Boolean(sessionUser && sessionUser.id === survey.ownerId),
        },
      },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /duplicate key|unique constraint|responses_member_survey_unique/i.test(error.message)
    ) {
      return Response.json(
        { error: "이미 참여한 설문이에요. 캐시는 설문마다 한 번만 받을 수 있어요." },
        { status: 409, headers: noStoreHeaders },
      );
    }
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
        questionsJson: surveys.questionsJson,
        durationMinutes: surveys.durationMinutes,
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
        fingerprintHash: responses.fingerprintHash,
        createdAt: responses.createdAt,
      })
      .from(responses)
      .where(eq(responses.surveyId, survey.id))
      .orderBy(desc(responses.createdAt))
      .limit(500);

    const questions = JSON.parse(survey.questionsJson) as StoredQuestion[];
    const fingerprintCounts = new Map<string, number>();
    const textCounts = new Map<string, number>();
    const base = rows.map((row) => {
      const answers = JSON.parse(row.answersJson);
      const textFingerprint = responseTextFingerprint(answers);
      if (row.fingerprintHash) {
        fingerprintCounts.set(
          row.fingerprintHash,
          (fingerprintCounts.get(row.fingerprintHash) ?? 0) + 1,
        );
      }
      if (textFingerprint) {
        textCounts.set(textFingerprint, (textCounts.get(textFingerprint) ?? 0) + 1);
      }
      return { row, answers, textFingerprint };
    });
    const parsed = base.map(({ row, answers, textFingerprint }) => ({
      id: row.id,
      answers,
      completionSeconds: row.completionSeconds,
      createdAt: row.createdAt,
      quality: addBatchQualityFlags(
        assessResponseQuality({
          answers,
          questions,
          completionSeconds: row.completionSeconds,
          durationMinutes: survey.durationMinutes,
        }),
        {
          duplicateDevice: Boolean(
            row.fingerprintHash && (fingerprintCounts.get(row.fingerprintHash) ?? 0) > 1,
          ),
          duplicateText: Boolean(
            textFingerprint && (textCounts.get(textFingerprint) ?? 0) > 1,
          ),
        },
      ),
    }));

    return Response.json({ responses: parsed }, { headers: noStoreHeaders });
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
