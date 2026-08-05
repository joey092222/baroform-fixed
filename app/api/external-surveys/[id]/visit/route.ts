import { and, eq } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { externalSurveys, externalSurveyVisits } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403 });
  try {
    const { id } = await context.params;
    if (!/^[a-f0-9-]{36}$/i.test(id)) return Response.json({ error: "설문을 찾지 못했어요." }, { status: 404 });
    const db = await getDb();
    const [survey] = await db
      .select({ id: externalSurveys.id })
      .from(externalSurveys)
      .where(and(eq(externalSurveys.id, id), eq(externalSurveys.isActive, true)))
      .limit(1);
    if (!survey) return Response.json({ error: "설문을 찾지 못했어요." }, { status: 404 });
    const user = await getSessionUser(request);
    await db.insert(externalSurveyVisits).values({
      id: crypto.randomUUID(),
      externalSurveyId: id,
      memberId: user?.id ?? null,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503 });
  }
}
