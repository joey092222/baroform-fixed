import { and, desc, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
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
import { publicSurveyCacheTag } from "@/app/lib/public-survey";
import { getSiteUrl, surveySharePath } from "@/app/survey-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

/**
 * 발행 직후 공유 카드 이미지를 한 번 미리 렌더해 CDN에 올려 둔다.
 *
 * 카카오톡은 링크를 보내는 그 순간 og:image를 받아오고, 제때 못 받으면 카드를
 * 통째로 포기하고 링크를 맨 텍스트로 띄운다. 방금 만든 설문은 이미지가 한 번도
 * 렌더된 적이 없어 콜드 렌더 2초를 만난다. 그래서 정작 제일 중요한 첫 공유가
 * 카드 없이 나갔다. 한 번 구워 두면 그 뒤로는 0.06초다.
 *
 * 주소를 여기서 새로 만들지 않고 공유 페이지가 실제로 내보내는 og:image를 읽어
 * 쓴다. ?v= 값은 DB 타임스탬프에서 나오므로 직접 조립하면 어긋나고, 어긋나면
 * 엉뚱한 주소만 데워 놓고 정작 카카오톡이 받는 주소는 차갑게 둔다.
 */
function warmSurveyShareCard(slug: string) {
  after(async () => {
    try {
      const pageUrl = new URL(surveySharePath(slug), getSiteUrl()).toString();
      const response = await fetch(pageUrl, { cache: "no-store" });
      if (!response.ok) return;
      const html = await response.text();
      const image = html.match(
        /<meta property="og:image" content="([^"]+)"/,
      )?.[1];
      if (!image) return;
      await fetch(image.replace(/&amp;/g, "&"), { cache: "no-store" });
    } catch {
      // 미리 굽기가 실패해도 발행 자체는 성공이다. 카드만 첫 공유에서 늦어진다.
    }
  });
}

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
          targetAudience: surveys.targetAudience,
          listingRequested: surveys.listingRequested,
          isListed: surveys.isListed,
          manageToken: surveys.manageToken,
          createdAt: surveys.createdAt,
          updatedAt: surveys.updatedAt,
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
        targetAudience: surveys.targetAudience,
        createdAt: surveys.createdAt,
        updatedAt: surveys.updatedAt,
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
      targetAudience?: string;
    };

    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    let ownerName = payload.ownerName?.trim() ?? "";
    const questions = Array.isArray(payload.questions)
      ? payload.questions
      : [];
    const listingRequested = payload.listingRequested === true;
    const category = payload.category ?? "campus";
    const targetAudience = payload.targetAudience?.trim() ?? "";

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
    if (targetAudience.length > 100) {
      return Response.json(
        { error: "설문 대상은 100자 이하로 입력해주세요." },
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
        { error: "설문을 배포하려면 먼저 로그인해주세요." },
        { status: 401, headers: noStoreHeaders },
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
      targetAudience,
      isPublic: true,
      listingRequested: publication.listingRequested,
      isListed: publication.isListed,
      manageToken,
    });

    revalidateTag(publicSurveyCacheTag, { expire: 0 });
    warmSurveyShareCard(slug);

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
          targetAudience,
          listingRequested: publication.listingRequested,
          isListed: publication.isListed,
          manageToken,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
