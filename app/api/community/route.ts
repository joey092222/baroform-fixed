import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { databaseErrorMessage, getDb, isDatabaseConfigured } from "@/db";
import { getSessionUser } from "@/db/auth";
import {
  communityPosts,
  members,
} from "@/db/schema";
import {
  isCommunityCategory,
  isCommunityScope,
  normalizedCommunityPost,
} from "@/app/community";
import { isSchoolId } from "@/app/survey-board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
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

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return Response.json({ posts: [] }, { headers });
  }

  try {
    const url = new URL(request.url);
    const sessionUser = await getSessionUser(request);
    const requestedScope = url.searchParams.get("scope") ?? "all";
    const scope = isCommunityScope(requestedScope) ? requestedScope : "all";
    const requestedSchool = url.searchParams.get("school") ?? sessionUser?.schoolId ?? "yonsei";
    const schoolId = isSchoolId(requestedSchool) ? requestedSchool : "yonsei";
    const requestedCategory = url.searchParams.get("category") ?? "";
    const conditions = [eq(communityPosts.visibility, scope)];
    if (scope === "school") conditions.push(eq(communityPosts.schoolId, schoolId));
    if (isCommunityCategory(requestedCategory)) {
      conditions.push(eq(communityPosts.category, requestedCategory));
    }

    const db = await getDb();
    const rows = await db
      .select({
        id: communityPosts.id,
        title: communityPosts.title,
        content: communityPosts.content,
        category: communityPosts.category,
        visibility: communityPosts.visibility,
        schoolId: communityPosts.schoolId,
        authorName: members.name,
        createdAt: communityPosts.createdAt,
        likeCount: sql<number>`(
          SELECT COUNT(*)::int FROM community_likes
          WHERE community_likes.post_id = community_posts.id
        )`.mapWith(Number),
        commentCount: sql<number>`(
          SELECT COUNT(*)::int FROM community_comments
          WHERE community_comments.post_id = community_posts.id
        )`.mapWith(Number),
        liked: sessionUser
          ? sql<boolean>`EXISTS (
              SELECT 1 FROM community_likes
              WHERE community_likes.post_id = community_posts.id
                AND community_likes.member_id = ${sessionUser.id}
            )`
          : sql<boolean>`FALSE`,
        isMine: sessionUser
          ? sql<boolean>`${communityPosts.memberId} = ${sessionUser.id}`
          : sql<boolean>`FALSE`,
      })
      .from(communityPosts)
      .innerJoin(members, eq(communityPosts.memberId, members.id))
      .where(and(...conditions))
      .orderBy(desc(communityPosts.createdAt))
      .limit(50);

    return Response.json({ posts: rows }, { headers });
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403, headers });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 12_000) {
    return Response.json({ error: "글 내용이 너무 커요." }, { status: 413, headers });
  }

  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json({ error: "글을 쓰려면 로그인해주세요." }, { status: 401, headers });
    }
    const payload = normalizedCommunityPost(await request.json());
    if (payload.title.length < 2 || payload.title.length > 100) {
      return Response.json({ error: "제목은 2자 이상 100자 이하로 적어주세요." }, { status: 400, headers });
    }
    if (payload.content.length < 5 || payload.content.length > 2000) {
      return Response.json({ error: "내용은 5자 이상 2,000자 이하로 적어주세요." }, { status: 400, headers });
    }

    const db = await getDb();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [recent] = await db
      .select({ value: count() })
      .from(communityPosts)
      .where(and(eq(communityPosts.memberId, sessionUser.id), gte(communityPosts.createdAt, oneHourAgo)));
    if (Number(recent?.value ?? 0) >= 5) {
      return Response.json({ error: "한 시간에 글은 5개까지 작성할 수 있어요." }, { status: 429, headers });
    }

    const id = crypto.randomUUID();
    await db.insert(communityPosts).values({
      id,
      memberId: sessionUser.id,
      schoolId: sessionUser.schoolId,
      visibility: payload.visibility,
      category: payload.category,
      title: payload.title,
      content: payload.content,
    });

    return Response.json(
      {
        post: {
          id,
          ...payload,
          schoolId: sessionUser.schoolId,
          authorName: sessionUser.name,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          commentCount: 0,
          liked: false,
          isMine: true,
        },
      },
      { status: 201, headers },
    );
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers });
  }
}
