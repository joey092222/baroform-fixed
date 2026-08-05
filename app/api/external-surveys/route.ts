import { and, desc, eq, sql } from "drizzle-orm";
import { databaseErrorMessage, getDb, isDatabaseConfigured } from "@/db";
import { getSessionUser } from "@/db/auth";
import { externalSurveys, members } from "@/db/schema";
import { isSurveyCategory, schoolLabel } from "@/app/survey-board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function parsePublicUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLocaleLowerCase("en-US");
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local")
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function platformFor(url: string) {
  const host = new URL(url).hostname.toLocaleLowerCase("en-US");
  if (host.includes("docs.google.com")) return "Google Forms";
  if (host.includes("typeform.com")) return "Typeform";
  if (host.includes("tally.so")) return "Tally";
  return "외부 설문";
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return Response.json({ surveys: [], storageConfigured: false }, { headers: noStoreHeaders });
  }
  try {
    const schoolId = new URL(request.url).searchParams.get("school")?.slice(0, 30) || "yonsei";
    const db = await getDb();
    const rows = await db
      .select({
        id: externalSurveys.id,
        title: externalSurveys.title,
        description: externalSurveys.description,
        externalUrl: externalSurveys.externalUrl,
        platform: externalSurveys.platform,
        schoolId: externalSurveys.schoolId,
        category: externalSurveys.category,
        campus: externalSurveys.campus,
        durationMinutes: externalSurveys.durationMinutes,
        targetResponses: externalSurveys.targetResponses,
        createdAt: externalSurveys.createdAt,
        ownerName: members.name,
        participantCount: sql<number>`(
          SELECT COUNT(*)::int FROM external_survey_visits
          WHERE external_survey_visits.external_survey_id = ${externalSurveys.id}
        )`.mapWith(Number),
      })
      .from(externalSurveys)
      .leftJoin(members, eq(externalSurveys.ownerId, members.id))
      .where(and(eq(externalSurveys.schoolId, schoolId), eq(externalSurveys.isActive, true)))
      .orderBy(desc(externalSurveys.createdAt))
      .limit(30);

    return Response.json(
      {
        surveys: rows.map((row) => ({
          source: "external" as const,
          slug: row.id,
          ...row,
          ownerName: row.ownerName ?? "학교 구성원",
          rewardCash: 0,
          responseCount: row.participantCount,
          questionCount: 0,
        })),
        storageConfigured: true,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403, headers: noStoreHeaders });
  }
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json({ error: "외부 설문을 등록하려면 로그인해주세요." }, { status: 401, headers: noStoreHeaders });
    }
    const payload = (await request.json()) as {
      title?: string;
      description?: string;
      externalUrl?: string;
      durationMinutes?: number;
      targetResponses?: number;
      category?: string;
    };
    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    const externalUrl = parsePublicUrl(payload.externalUrl?.trim() ?? "");
    const durationMinutes = Math.round(Number(payload.durationMinutes));
    const targetResponses = Math.round(Number(payload.targetResponses));
    const category = payload.category ?? "campus";
    if (title.length < 2 || title.length > 100) {
      return Response.json({ error: "설문 제목은 2~100자로 입력해주세요." }, { status: 400, headers: noStoreHeaders });
    }
    if (!externalUrl) {
      return Response.json({ error: "공개된 http 또는 https 설문 링크를 입력해주세요." }, { status: 400, headers: noStoreHeaders });
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 60) {
      return Response.json({ error: "예상 시간은 1~60분으로 입력해주세요." }, { status: 400, headers: noStoreHeaders });
    }
    if (!Number.isFinite(targetResponses) || targetResponses < 5 || targetResponses > 5000) {
      return Response.json({ error: "목표 인원은 5~5,000명으로 입력해주세요." }, { status: 400, headers: noStoreHeaders });
    }
    if (!isSurveyCategory(category)) {
      return Response.json({ error: "설문 카테고리를 선택해주세요." }, { status: 400, headers: noStoreHeaders });
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const db = await getDb();
    await db.insert(externalSurveys).values({
      id,
      ownerId: user.id,
      schoolId: user.schoolId,
      title,
      description: description.slice(0, 600),
      externalUrl,
      platform: platformFor(externalUrl),
      category,
      campus: schoolLabel(user.schoolId),
      durationMinutes,
      targetResponses,
      createdAt,
    });
    return Response.json({ survey: { id, createdAt } }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers: noStoreHeaders });
  }
}
