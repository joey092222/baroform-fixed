import { and, count, eq } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { communityLikes, communityPosts } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff" };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403, headers });
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "공감하려면 로그인해주세요." }, { status: 401, headers });
    const { postId } = await context.params;
    const db = await getDb();
    const [post] = await db.select({ id: communityPosts.id }).from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
    if (!post) return Response.json({ error: "글을 찾을 수 없어요." }, { status: 404, headers });
    const [existing] = await db
      .select({ postId: communityLikes.postId })
      .from(communityLikes)
      .where(and(eq(communityLikes.postId, postId), eq(communityLikes.memberId, user.id)))
      .limit(1);
    let liked = false;
    if (existing) {
      await db.delete(communityLikes).where(and(eq(communityLikes.postId, postId), eq(communityLikes.memberId, user.id)));
    } else {
      await db.insert(communityLikes).values({ postId, memberId: user.id });
      liked = true;
    }
    const [total] = await db.select({ value: count() }).from(communityLikes).where(eq(communityLikes.postId, postId));
    return Response.json({ liked, likeCount: Number(total?.value ?? 0) }, { headers });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers });
  }
}
