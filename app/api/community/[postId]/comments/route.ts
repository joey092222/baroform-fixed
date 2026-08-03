import { asc, eq } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { communityComments, communityPosts, members } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff" };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return origin === new URL(request.url).origin; } catch { return false; }
}

export async function GET(_request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await context.params;
    const db = await getDb();
    const rows = await db
      .select({
        id: communityComments.id,
        content: communityComments.content,
        authorName: members.name,
        schoolId: members.schoolId,
        createdAt: communityComments.createdAt,
      })
      .from(communityComments)
      .innerJoin(members, eq(communityComments.memberId, members.id))
      .where(eq(communityComments.postId, postId))
      .orderBy(asc(communityComments.createdAt))
      .limit(100);
    return Response.json({ comments: rows }, { headers });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers });
  }
}

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403, headers });
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "댓글을 쓰려면 로그인해주세요." }, { status: 401, headers });
    const { postId } = await context.params;
    const payload = (await request.json()) as { content?: unknown };
    const content = typeof payload.content === "string" ? payload.content.trim() : "";
    if (content.length < 1 || content.length > 500) {
      return Response.json({ error: "댓글은 1자 이상 500자 이하로 적어주세요." }, { status: 400, headers });
    }
    const db = await getDb();
    const [post] = await db.select({ id: communityPosts.id }).from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
    if (!post) return Response.json({ error: "글을 찾을 수 없어요." }, { status: 404, headers });
    const id = crypto.randomUUID();
    await db.insert(communityComments).values({ id, postId, memberId: user.id, content });
    return Response.json({ comment: { id, content, authorName: user.name, schoolId: user.schoolId, createdAt: new Date().toISOString() } }, { status: 201, headers });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers });
  }
}
