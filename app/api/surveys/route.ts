import { and, desc, eq } from "drizzle-orm";
import {
  databaseErrorMessage,
  getDb,
  isDatabaseConfigured,
} from "@/db";
import { surveys } from "@/db/schema";

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
  type?: "scale" | "single" | "multiple" | "text";
  options?: string[];
  required?: boolean;
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

export async function GET() {
  if (!isDatabaseConfigured()) {
    return Response.json(
      { surveys: [], storageConfigured: false },
      { headers: noStoreHeaders },
    );
  }

  try {
    const db = await getDb();
    const rows = await db
      .select({
        slug: surveys.slug,
        title: surveys.title,
        description: surveys.description,
        ownerName: surveys.ownerName,
        campus: surveys.campus,
        durationMinutes: surveys.durationMinutes,
        createdAt: surveys.createdAt,
      })
      .from(surveys)
      .where(and(eq(surveys.isListed, true), eq(surveys.isPublic, true)))
      .orderBy(desc(surveys.createdAt))
      .limit(30);

    return Response.json(
      { surveys: rows, storageConfigured: true },
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
    };

    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    const ownerName = payload.ownerName?.trim() ?? "";
    const questions = Array.isArray(payload.questions)
      ? payload.questions
      : [];
    const listingRequested = payload.listingRequested === true;

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
          !["scale", "single", "multiple", "text"].includes(
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
          (question.type === "single" || question.type === "multiple") &&
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
    if (listingRequested && ownerName.length < 2) {
      return Response.json(
        { error: "학교 설문 목록에 공개하려면 게시자 이름을 입력해주세요." },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const slug = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const manageToken = crypto.randomUUID().replaceAll("-", "");
    const durationMinutes = Math.max(1, Math.ceil(questions.length / 2));

    const normalizedQuestions = questions.map((question, index) => ({
      id: index + 1,
      title: question.title?.trim().slice(0, 200),
      reason: question.reason?.trim().slice(0, 500) ?? "",
      type: question.type,
      options:
        question.type === "single" || question.type === "multiple"
          ? (question.options ?? [])
              .map((option) => option.trim())
              .filter(Boolean)
              .slice(0, 12)
          : undefined,
      required: question.required === true,
    }));

    const db = await getDb();
    await db.insert(surveys).values({
      id,
      slug,
      title,
      description,
      ownerName,
      campus: "연세대학교 신촌캠퍼스",
      questionsJson: JSON.stringify(normalizedQuestions),
      durationMinutes,
      isPublic: true,
      listingRequested,
      isListed: false,
      manageToken,
    });

    return Response.json(
      {
        survey: {
          slug,
          title,
          description,
          ownerName,
          durationMinutes,
          listingRequested,
          manageToken,
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
