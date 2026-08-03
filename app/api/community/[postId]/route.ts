import { and, eq } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { communityPosts } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff" };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return origin === new URL(request.url).origin; } catch { return false; }
}

export async function DELETE(request: Request, context: { params: Promise<{ postId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403, headers });
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401, headers });
    const { postId } = await context.params;
    const db = await getDb();
    const deleted = await db
      .delete(communityPosts)
      .where(and(eq(communityPosts.id, postId), eq(communityPosts.memberId, user.id)))
      .returning({ id: communityPosts.id });
    if (deleted.length === 0) return Response.json({ error: "삭제할 수 없는 글이에요." }, { status: 404, headers });
    return new Response(null, { status: 204, headers });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers });
  }
}
