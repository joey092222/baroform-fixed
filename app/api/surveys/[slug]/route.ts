import { and, eq } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { surveys } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

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
    const db = await getDb();
    const [row] = await db
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
      })
      .from(surveys)
      .where(and(eq(surveys.slug, slug), eq(surveys.isPublic, true)))
      .limit(1);

    if (!row) {
      return Response.json(
        { error: "공개된 설문을 찾을 수 없어요." },
        { status: 404 },
      );
    }

    return Response.json(
      {
        survey: {
          ...row,
          questions: JSON.parse(row.questionsJson),
          questionsJson: undefined,
        },
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
