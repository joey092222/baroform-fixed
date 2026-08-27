import { getJson, sendJson } from "./http";
import { defaultSchoolId } from "./surveys";
import type { CommunityCategory, CommunityScope } from "../../community";
import type { CommunityComment, CommunityPost } from "../types";

export async function fetchCommunityPosts(
  input: {
    scope: CommunityScope;
    category: "all" | CommunityCategory;
    schoolId?: string;
  },
  authToken?: string,
) {
  const params = new URLSearchParams({
    scope: input.scope,
    school: input.schoolId ?? defaultSchoolId,
  });
  if (input.category !== "all") params.set("category", input.category);
  const result = await getJson<{ posts?: CommunityPost[] }>(
    `/api/community?${params}`,
    { authToken },
  );
  return result.posts ?? [];
}

export async function createCommunityPost(
  authToken: string,
  input: {
    title: string;
    content: string;
    category: CommunityCategory;
    visibility: CommunityScope;
  },
) {
  const result = await sendJson<{ post?: CommunityPost }>(
    "/api/community",
    "POST",
    input,
    { authToken },
  );
  if (!result.post) throw new Error("글을 올리지 못했어요.");
  return result.post;
}

export async function toggleCommunityLike(authToken: string, postId: string) {
  const result = await sendJson<{ liked?: boolean; likeCount?: number }>(
    `/api/community/${encodeURIComponent(postId)}/like`,
    "POST",
    undefined,
    { authToken },
  );
  if (typeof result.liked !== "boolean") {
    throw new Error("좋아요를 저장하지 못했어요.");
  }
  return { liked: result.liked, likeCount: Number(result.likeCount ?? 0) };
}

export async function fetchCommunityComments(postId: string) {
  const result = await getJson<{ comments?: CommunityComment[] }>(
    `/api/community/${encodeURIComponent(postId)}/comments`,
  );
  return result.comments ?? [];
}

export async function createCommunityComment(
  authToken: string,
  postId: string,
  content: string,
) {
  const result = await sendJson<{ comment?: CommunityComment }>(
    `/api/community/${encodeURIComponent(postId)}/comments`,
    "POST",
    { content },
    { authToken },
  );
  if (!result.comment) throw new Error("댓글을 저장하지 못했어요.");
  return result.comment;
}

export function deleteCommunityPost(authToken: string, postId: string) {
  return sendJson(
    `/api/community/${encodeURIComponent(postId)}`,
    "DELETE",
    undefined,
    { authToken },
  );
}
