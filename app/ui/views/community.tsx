"use client";

import {
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  communityCategories,
  communityCategoryLabel,
  type CommunityCategory,
  type CommunityScope,
} from "../../community";
import { schoolLabel } from "../../survey-board";
import type { CommunityComment, CommunityPost } from "../../ux/types";
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  fetchCommunityComments,
  fetchCommunityPosts,
  toggleCommunityLike,
} from "../../ux/data/community";

type CommunityUser = {
  id: string;
  name: string;
  schoolId: string;
};

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function CommunityView({
  user,
  authToken,
  onAuth,
  onCreateSurvey,
}: {
  user: CommunityUser | null;
  authToken: string;
  onAuth: () => void;
  onCreateSurvey: () => void;
}) {
  const [scope, setScope] = useState<CommunityScope>("all");
  const [category, setCategory] = useState<"all" | CommunityCategory>("all");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftScope, setDraftScope] = useState<CommunityScope>("all");
  const [draftCategory, setDraftCategory] = useState<CommunityCategory>("free");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [expandedPostId, setExpandedPostId] = useState("");
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPosts(
        await fetchCommunityPosts(
          { scope, category, schoolId: user?.schoolId },
          authToken || undefined,
        ),
      );
    } catch (loadError) {
      setPosts([]);
      setError(loadError instanceof Error ? loadError.message : "커뮤니티 글을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [authToken, category, scope, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  const visiblePosts = useMemo(() => {
    const keyword = search.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return posts;
    return posts.filter((post) =>
      [post.title, post.content, post.authorName, communityCategoryLabel(post.category)]
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(keyword),
    );
  }, [posts, search]);

  const openComposer = () => {
    if (!user) {
      onAuth();
      return;
    }
    setDraftScope(scope);
    setComposerOpen(true);
    setPostError("");
  };

  const createPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return onAuth();
    setPosting(true);
    setPostError("");
    try {
      const created = await createCommunityPost(authToken, {
        title: draftTitle,
        content: draftContent,
        category: draftCategory,
        visibility: draftScope,
      });
      setDraftTitle("");
      setDraftContent("");
      setComposerOpen(false);
      setScope(draftScope);
      setCategory("all");
      setPosts((current) => [created, ...current]);
    } catch (submitError) {
      setPostError(submitError instanceof Error ? submitError.message : "글을 올리지 못했어요.");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post: CommunityPost) => {
    if (!authToken) return onAuth();
    const previous = { liked: post.liked, likeCount: post.likeCount };
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, liked: !item.liked, likeCount: Math.max(0, item.likeCount + (item.liked ? -1 : 1)) }
      : item));
    try {
      const result = await toggleCommunityLike(authToken, post.id);
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, liked: result.liked, likeCount: result.likeCount }
        : item));
    } catch {
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, ...previous } : item));
    }
  };

  const openComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId("");
      return;
    }
    setExpandedPostId(postId);
    setComments([]);
    setCommentsLoading(true);
    try {
      setComments(await fetchCommunityComments(postId).catch(() => []));
    } finally {
      setCommentsLoading(false);
    }
  };

  const createComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return onAuth();
    if (!expandedPostId || !commentValue.trim()) return;
    setCommentSaving(true);
    try {
      const comment = await createCommunityComment(
        authToken,
        expandedPostId,
        commentValue,
      );
      setComments((current) => [...current, comment]);
      setPosts((current) => current.map((post) => post.id === expandedPostId
        ? { ...post, commentCount: post.commentCount + 1 }
        : post));
      setCommentValue("");
    } finally {
      setCommentSaving(false);
    }
  };

  const deletePost = async (postId: string) => {
    if (!authToken || !window.confirm("이 글과 댓글을 삭제할까요?")) return;
    try {
      await deleteCommunityPost(authToken, postId);
    } catch {
      return;
    }
    setPosts((current) => current.filter((post) => post.id !== postId));
    if (expandedPostId === postId) setExpandedPostId("");
  };

  const unanswered = visiblePosts
    .filter((post) => post.commentCount === 0)
    .slice(0, 3);
  // 반응이 하나도 없는 글은 순위에 올리지 않습니다 — 「많이 읽은 글」에 댓글 0이
  // 줄줄이 서면 그 칸이 거짓말을 합니다. 그때는 칸 자체가 사라집니다.
  const popular = [...visiblePosts]
    .filter((post) => post.commentCount + post.likeCount > 0)
    .sort(
      (left, right) =>
        right.commentCount + right.likeCount - (left.commentCount + left.likeCount) ||
        right.createdAt.localeCompare(left.createdAt),
    )
    .slice(0, 5);

  return (
    <main className="cm-wrap">
      <div className="cm-head">
        <h1>커뮤니티</h1>
        <p>설문 만들다 막힌 것을 묻고, 응답자 모으는 방법을 나눕니다.</p>
      </div>

      <div className="cm-cols">
        <div>
          <div className="cm-filters">
            <div className="cm-scope" role="group" aria-label="커뮤니티 범위">
              <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
                전체
              </button>
              <button type="button" aria-pressed={scope === "school"} onClick={() => setScope("school")}>
                우리 학교
              </button>
            </div>
            <div className="cm-cats" role="group" aria-label="글 분류">
              <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
                전체
              </button>
              {communityCategories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="cm-searchwrap">
              <span className="sr-only">글 검색</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="글 검색"
              />
            </label>
          </div>

          <div className="cm-write">
            <button type="button" className="cm-writefield" onClick={openComposer}>
              {user ? "새 글을 작성해주세요" : "로그인하고 글을 남겨보세요"}
            </button>
          </div>

          {loading ? (
            <div className="cm-list">
              <div className="pz-empty"><b>글을 불러오고 있어요</b></div>
            </div>
          ) : error ? (
            <div className="cm-list">
              <div className="pz-empty">
                <b>글을 불러오지 못했어요</b>
                <p>{error}</p>
              </div>
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="cm-list">
              <div className="pz-empty">
                <b>{search ? "찾는 글이 없어요" : "아직 올라온 글이 없어요"}</b>
                <p>
                  {search
                    ? "다른 말로 검색하거나 분류를 바꿔보세요."
                    : "설문 만들다 막힌 것을 물어보면 누군가 답합니다."}
                </p>
                <button type="button" className="pz-go" onClick={openComposer}>
                  첫 글 쓰기
                </button>
              </div>
            </div>
          ) : (
            <div className="cm-list">
              {visiblePosts.map((post) => (
                <div className="cm-row" key={post.id}>
                  <button
                    type="button"
                    className="cm-open"
                    onClick={() => void openComments(post.id)}
                  >
                    <span className="cm-title">
                      {post.title}
                      {post.commentCount > 0 ? <em>{post.commentCount}</em> : null}
                      {post.commentCount === 0 ? <span className="cm-hot">답변 필요</span> : null}
                    </span>
                    <p className="cm-preview">{post.content}</p>
                    <span className="cm-meta">
                      <span className="cm-cat">{communityCategoryLabel(post.category)}</span>
                      <s />
                      <span>{post.authorName}</span>
                      <s />
                      <span>
                        {post.visibility === "school" ? schoolLabel(post.schoolId) : "대학생 전체"}
                      </span>
                      <s />
                      <span>{relativeTime(post.createdAt)}</span>
                    </span>
                  </button>
                  <div className="cm-rowacts">
                    <button
                      type="button"
                      className={post.liked ? "cm-liked" : undefined}
                      onClick={() => void toggleLike(post)}
                    >
                      공감 {post.likeCount}
                    </button>
                    <button type="button" onClick={() => void openComments(post.id)}>
                      댓글 {post.commentCount}
                    </button>
                    {post.isMine ? (
                      <button type="button" className="cm-del" onClick={() => void deletePost(post.id)}>
                        삭제
                      </button>
                    ) : null}
                  </div>
                  {expandedPostId === post.id ? (
                    <div className="cm-thread">
                      {commentsLoading ? (
                        <p className="cm-preview" style={{ margin: "11px 0" }}>댓글을 불러오고 있어요.</p>
                      ) : comments.length === 0 ? (
                        <p className="cm-preview" style={{ margin: "11px 0" }}>첫 댓글을 남겨보세요.</p>
                      ) : (
                        comments.map((comment) => (
                          <div className="cm-comment" key={comment.id}>
                            <b>{comment.authorName}</b>
                            <small>
                              {schoolLabel(comment.schoolId)} · {relativeTime(comment.createdAt)}
                            </small>
                            <p>{comment.content}</p>
                          </div>
                        ))
                      )}
                      <form className="cm-commentform" onSubmit={createComment}>
                        <input
                          value={commentValue}
                          onChange={(event) => setCommentValue(event.target.value)}
                          placeholder={user ? "댓글을 입력해주세요" : "로그인하고 댓글을 남겨보세요"}
                          maxLength={500}
                          onFocus={() => {
                            if (!user) onAuth();
                          }}
                        />
                        <button
                          type="submit"
                          className="pz-go"
                          style={{ flex: "none", padding: "0 16px" }}
                          disabled={commentSaving || !commentValue.trim()}
                        >
                          등록
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cm-side">
          {popular.length > 0 ? (
            <div className="pz-box">
              <h2>이번 주 많이 읽은 글</h2>
              {popular.map((post, index) => (
                <button
                  type="button"
                  className="pz-post"
                  key={post.id}
                  onClick={() => void openComments(post.id)}
                >
                  <span className={index < 3 ? "pz-rank pz-top" : "pz-rank"}>{index + 1}</span>
                  <span>
                    <span className="pz-post-t">{post.title}</span>
                    <span className="pz-post-m">
                      <span>{communityCategoryLabel(post.category)}</span>
                      <em>{post.commentCount}</em>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {/* 인기 글만 띄우면 인기 경쟁이 됩니다. 미해결 질문을 위에 둡니다. */}
          {unanswered.length > 0 ? (
            <div className="pz-box">
              <h2>답변을 기다리는 질문</h2>
              {unanswered.map((post) => (
                <div className="cm-ask" key={post.id}>
                  <button type="button" onClick={() => void openComments(post.id)}>
                    {post.title}
                  </button>
                  <span>답변 없음 · {relativeTime(post.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="pz-box pz-biz">
            <h2 style={{ padding: 0, border: 0, fontSize: 14.5 }}>여기 온 이유가 설문이라면</h2>
            <p>커뮤니티는 설문을 만들다 막혔을 때 쓰는 곳입니다. 바로 만들려면 아래로.</p>
            <button type="button" onClick={onCreateSurvey}>설문 만들기</button>
          </div>
        </div>
      </div>

      {composerOpen && (
      <form className="community-composer" onSubmit={createPost}>
        <div className="community-composer-top">
          <div>
            <strong>새 글 작성</strong>
            <span>{schoolLabel(user?.schoolId ?? "yonsei")}</span>
          </div>
          <button type="button" onClick={() => setComposerOpen(false)} aria-label="글쓰기 닫기"><X size={18} /></button>
        </div>
        <div className="community-compose-options">
          <select value={draftScope} onChange={(event) => setDraftScope(event.target.value as CommunityScope)} aria-label="공개 범위">
            <option value="all">대학생 전체에 공개</option>
            <option value="school">우리 학교에만 공개</option>
          </select>
          <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value as CommunityCategory)} aria-label="글 카테고리">
            {communityCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <input className="community-title-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="제목을 입력해주세요" maxLength={100} required />
        <textarea value={draftContent} onChange={(event) => setDraftContent(event.target.value)} placeholder="대학생들에게 나누고 싶은 내용을 적어주세요." rows={5} maxLength={2000} required />
        {postError && <p className="community-form-error" role="alert">{postError}</p>}
        <div className="community-composer-footer">
          <span>{draftContent.length}/2,000</span>
          <button type="submit" disabled={posting || draftTitle.trim().length < 2 || draftContent.trim().length < 5}>
            {posting ? "올리는 중…" : "글 올리기"}<Send size={16} />
          </button>
        </div>
      </form>
      )}
    </main>
  );
}
