import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { surveys } from "@/db/schema";
import {
  getPublicSurvey,
  publicSurveyCacheTag,
} from "@/app/lib/public-survey";
import {
  surveyOpenGraphImagePath,
  surveySharePath,
} from "@/app/survey-share";

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    if (!/^[a-f0-9]{12}$/.test(slug)) {
      return Response.json(
        { error: "공개된 설문을 찾을 수 없어요." },
        { status: 404, headers: noStoreHeaders },
      );
    }
    const survey = await getPublicSurvey(slug);
    if (!survey) {
      return Response.json(
        { error: "공개된 설문을 찾을 수 없어요." },
        { status: 404 },
      );
    }

    return Response.json(
      {
        survey,
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "이 사이트에서 다시 시도해주세요." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  try {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json(
        { error: "설문을 삭제하려면 로그인해주세요." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    const { slug } = await context.params;
    if (!/^[a-f0-9]{12}$/.test(slug)) {
      return Response.json(
        { error: "삭제할 설문을 찾을 수 없어요." },
        { status: 404, headers: noStoreHeaders },
      );
    }

    const db = await getDb();
    const deleted = await db
      .delete(surveys)
      .where(and(eq(surveys.slug, slug), eq(surveys.ownerId, user.id)))
      .returning({ slug: surveys.slug });

    if (deleted.length === 0) {
      return Response.json(
        { error: "삭제할 수 없는 설문이거나 이미 삭제된 설문이에요." },
        { status: 404, headers: noStoreHeaders },
      );
    }

    revalidateTag(publicSurveyCacheTag, { expire: 0 });
    revalidatePath(surveySharePath(slug));
    revalidatePath(surveyOpenGraphImagePath(slug));

    return Response.json(
      { deletedSlug: deleted[0].slug },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
