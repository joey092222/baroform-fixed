import { and, desc, eq, sql } from "drizzle-orm";
import {
  databaseErrorMessage,
  getDb,
  isDatabaseConfigured,
} from "@/db";
import { getSessionUser } from "@/db/auth";
import { surveys } from "@/db/schema";
import {
  isSchoolId,
  isSurveyCategory,
  schoolLabel,
  surveyPublicationState,
} from "@/app/survey-board";
import { rewardCashForDuration } from "@/app/rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

type IncomingQuestion = {
  id?: number;
  title?: string;
  reason?: string;
  type?:
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
  required?: boolean;
  description?: string;
  shuffleOptions?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
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

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return Response.json(
      { surveys: [], storageConfigured: false },
      { headers: noStoreHeaders },
    );
  }

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("mine") === "true") {
      const sessionUser = await getSessionUser(request);
      if (!sessionUser) {
        return Response.json(
          { error: "내 설문을 보려면 로그인해주세요." },
          { status: 401, headers: noStoreHeaders },
        );
      }

      const db = await getDb();
      const rows = await db
        .select({
          slug: surveys.slug,
          title: surveys.title,
          description: surveys.description,
          ownerName: surveys.ownerName,
          schoolId: surveys.schoolId,
          category: surveys.category,
          campus: surveys.campus,
          questionsJson: surveys.questionsJson,
          durationMinutes: surveys.durationMinutes,
          rewardCash: surveys.rewardCash,
          listingRequested: surveys.listingRequested,
          isListed: surveys.isListed,
          manageToken: surveys.manageToken,
          createdAt: surveys.createdAt,
          responseCount: sql<number>`(
            SELECT COUNT(*)::int
            FROM responses
            WHERE responses.survey_id = ${surveys.id}
          )`.mapWith(Number),
        })
        .from(surveys)
        .where(eq(surveys.ownerId, sessionUser.id))
        .orderBy(desc(surveys.createdAt))
        .limit(100);

      return Response.json(
        {
          surveys: rows.map(({ questionsJson, ...survey }) => ({
            ...survey,
            questions: JSON.parse(questionsJson),
          })),
          storageConfigured: true,
        },
        { headers: noStoreHeaders },
      );
    }

    const requestedSchool = url.searchParams.get("school") ?? "yonsei";
    const schoolId = isSchoolId(requestedSchool) ? requestedSchool : "yonsei";
    const db = await getDb();
    const rows = await db
      .select({
        slug: surveys.slug,
        title: surveys.title,
        description: surveys.description,
        ownerName: surveys.ownerName,
        schoolId: surveys.schoolId,
        category: surveys.category,
        campus: surveys.campus,
        durationMinutes: surveys.durationMinutes,
        rewardCash: surveys.rewardCash,
        createdAt: surveys.createdAt,
        questionsJson: surveys.questionsJson,
        responseCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM responses
          WHERE responses.survey_id = ${surveys.id}
        )`.mapWith(Number),
      })
      .from(surveys)
      .where(
        and(
          eq(surveys.isListed, true),
          eq(surveys.isPublic, true),
          eq(surveys.schoolId, schoolId),
        ),
      )
      .orderBy(desc(surveys.createdAt))
      .limit(30);

    return Response.json(
      {
        surveys: rows.map(({ questionsJson, ...survey }) => ({
          ...survey,
          questionCount: (JSON.parse(questionsJson) as IncomingQuestion[])
            .filter((question) => question.type !== "section").length,
        })),
        storageConfigured: true,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 503, headers: noStoreHeaders },
    );
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
  if (Number.isFinite(contentLength) && contentLength > 100_000) {
    return Response.json(
      { error: "설문 내용이 너무 커요." },
      { status: 413, headers: noStoreHeaders },
    );
  }

  try {
    const payload = (await request.json()) as {
      title?: string;
      description?: string;
      ownerName?: string;
      questions?: IncomingQuestion[];
      listingRequested?: boolean;
      category?: string;
    };

    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    let ownerName = payload.ownerName?.trim() ?? "";
    const questions = Array.isArray(payload.questions)
      ? payload.questions
      : [];
    const listingRequested = payload.listingRequested === true;
    const category = payload.category ?? "campus";

    if (title.length < 2 || title.length > 100) {
      return Response.json(
        { error: "설문 제목은 2자 이상 100자 이하로 입력해주세요." },
        { status: 400 },
      );
    }
    if (description.length > 600) {
      return Response.json(
        { error: "설문 안내문은 600자 이하로 입력해주세요." },
        { status: 400 },
      );
    }
    if (questions.length < 1 || questions.length > 30) {
      return Response.json(
        { error: "질문은 1개 이상 30개 이하로 구성해주세요." },
        { status: 400 },
      );
    }
    if (
      questions.some(
        (question) =>
          !question.title?.trim() ||
          question.title.trim().length > 200 ||
          (question.reason?.trim().length ?? 0) > 500 ||
          ![
            "scale",
            "single",
            "multiple",
            "dropdown",
            "shortText",
            "text",
            "date",
            "time",
            "section",
          ].includes(
            question.type ?? "",
          ),
      )
    ) {
      return Response.json(
        { error: "비어 있는 질문이나 올바르지 않은 질문 유형이 있어요." },
        { status: 400 },
      );
    }
    if (
      questions.some(
        (question) =>
          (question.type === "single" ||
            question.type === "multiple" ||
            question.type === "dropdown") &&
          (question.options ?? [])
            .map((option) => option.trim())
            .filter(Boolean).length < 2,
      )
    ) {
      return Response.json(
        { error: "객관식 질문에는 선택지를 2개 이상 입력해주세요." },
        { status: 400 },
      );
    }
    if (listingRequested && !isSurveyCategory(category)) {
      return Response.json(
        { error: "학교 게시판에 올릴 카테고리를 선택해주세요." },
        { status: 400 },
      );
    }

    const sessionUser = await getSessionUser(request);
    const publication = surveyPublicationState(
      listingRequested,
      Boolean(sessionUser),
    );
    if (publication.requiresLogin) {
      return Response.json(
        { error: "학교 게시판에 올리려면 먼저 로그인해주세요." },
        { status: 401 },
      );
    }
    if (sessionUser && ownerName.length < 2) ownerName = sessionUser.name;

    const id = crypto.randomUUID();
    const slug = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const manageToken = crypto.randomUUID().replaceAll("-", "");
    const estimatedSeconds = questions.reduce((total, question) => {
      if (question.type === "section") return total;
      if (question.type === "text") return total + 55;
      if (question.type === "shortText") return total + 28;
      if (question.type === "multiple") return total + 30;
      return total + 20;
    }, 20);
    const durationMinutes = Math.max(1, Math.ceil(estimatedSeconds / 60));
    const rewardCash = rewardCashForDuration(durationMinutes);

    const normalizedQuestions = questions.map((question, index) => ({
      id: index + 1,
      title: question.title?.trim().slice(0, 200),
      reason: question.reason?.trim().slice(0, 500) ?? "",
      type: question.type,
      description: question.description?.trim().slice(0, 300) ?? "",
      options:
        question.type === "single" ||
        question.type === "multiple" ||
        question.type === "dropdown"
          ? (question.options ?? [])
              .map((option) => option.trim())
              .filter(Boolean)
              .slice(0, 12)
          : undefined,
      required: question.required === true,
      shuffleOptions: question.shuffleOptions === true,
      scaleMin: question.type === "scale" && question.scaleMin === 0 ? 0 : 1,
      scaleMax:
        question.type === "scale"
          ? Math.min(10, Math.max(2, Math.round(question.scaleMax ?? 5)))
          : undefined,
      scaleMinLabel: question.scaleMinLabel?.trim().slice(0, 40) ?? "",
      scaleMaxLabel: question.scaleMaxLabel?.trim().slice(0, 40) ?? "",
    }));

    const db = await getDb();
    await db.insert(surveys).values({
      id,
      slug,
      title,
      description,
      ownerName,
      ownerId: sessionUser?.id ?? null,
      schoolId: sessionUser?.schoolId ?? "yonsei",
      category: isSurveyCategory(category) ? category : "campus",
      campus: schoolLabel(sessionUser?.schoolId ?? "yonsei"),
      questionsJson: JSON.stringify(normalizedQuestions),
      durationMinutes,
      rewardCash,
      isPublic: true,
      listingRequested: publication.listingRequested,
      isListed: publication.isListed,
      manageToken,
    });

    return Response.json(
      {
        survey: {
          slug,
          title,
          description,
          ownerName,
          schoolId: sessionUser?.schoolId ?? "yonsei",
          category: isSurveyCategory(category) ? category : "campus",
          campus: schoolLabel(sessionUser?.schoolId ?? "yonsei"),
          durationMinutes,
          rewardCash,
          listingRequested: publication.listingRequested,
          isListed: publication.isListed,
          manageToken,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
