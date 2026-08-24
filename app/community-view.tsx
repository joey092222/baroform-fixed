"use client";

import {
  ArrowRight,
  Coins,
  Heart,
  MessageCircle,
  PenLine,
  School,
  Search,
  Send,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  communityCategories,
  communityCategoryLabel,
  type CommunityCategory,
  type CommunityScope,
} from "./community";
import { schoolLabel } from "./survey-board";

type CommunityUser = {
  id: string;
  name: string;
  schoolId: string;
};

type CommunityPost = {
  id: string;
  title: string;
  content: string;
  category: CommunityCategory;
  visibility: CommunityScope;
  schoolId: string;
  authorName: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  isMine: boolean;
};

type CommunityComment = {
  id: string;
  content: string;
  authorName: string;
  schoolId: string;
  createdAt: string;
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

  const authHeaders: Record<string, string> = authToken
    ? { authorization: `Bearer ${authToken}` }
    : {};

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        scope,
        school: user?.schoolId ?? "yonsei",
      });
      if (category !== "all") params.set("category", category);
      const response = await fetch(`/api/community?${params}`, {
        cache: "no-store",
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
      });
      const result = (await response.json()) as { posts?: CommunityPost[]; error?: string };
      if (!response.ok) throw new Error(result.error || "커뮤니티 글을 불러오지 못했어요.");
      setPosts(result.posts ?? []);
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
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({
          title: draftTitle,
          content: draftContent,
          category: draftCategory,
          visibility: draftScope,
        }),
      });
      const result = (await response.json()) as { post?: CommunityPost; error?: string };
      if (!response.ok || !result.post) throw new Error(result.error || "글을 올리지 못했어요.");
      setDraftTitle("");
      setDraftContent("");
      setComposerOpen(false);
      setScope(draftScope);
      setCategory("all");
      setPosts((current) => [result.post as CommunityPost, ...current]);
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
      const response = await fetch(`/api/community/${post.id}/like`, { method: "POST", headers: authHeaders });
      const result = (await response.json()) as { liked?: boolean; likeCount?: number; error?: string };
      if (!response.ok || typeof result.liked !== "boolean") throw new Error(result.error);
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, liked: result.liked as boolean, likeCount: Number(result.likeCount ?? 0) }
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
      const response = await fetch(`/api/community/${postId}/comments`, { cache: "no-store" });
      const result = (await response.json()) as { comments?: CommunityComment[] };
      setComments(response.ok ? result.comments ?? [] : []);
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
      const response = await fetch(`/api/community/${expandedPostId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({ content: commentValue }),
      });
      const result = (await response.json()) as { comment?: CommunityComment; error?: string };
      if (!response.ok || !result.comment) throw new Error(result.error);
      setComments((current) => [...current, result.comment as CommunityComment]);
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
    const response = await fetch(`/api/community/${postId}`, { method: "DELETE", headers: authHeaders });
    if (response.ok) {
      setPosts((current) => current.filter((post) => post.id !== postId));
      if (expandedPostId === postId) setExpandedPostId("");
    }
  };

  return (
    <main className="community-page">
      <section className="community-hero community-hero-compact">
        <div>
          <h1>커뮤니티</h1>
          <p>설문 만드는 사람들의 이야기</p>
        </div>
      </section>

      <section className="community-layout">
        <div className="community-feed-column">
          <div className="community-scope-tabs" role="tablist" aria-label="커뮤니티 범위">
            <button type="button" className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>
              <UsersRound size={17} /> 대학생 전체
            </button>
            <button type="button" className={scope === "school" ? "active" : ""} onClick={() => setScope("school")}>
              <School size={17} /> 우리 학교
            </button>
          </div>

          <div className="community-toolbar">
            <div className="community-category-tabs">
              <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>전체</button>
              {communityCategories.map((item) => (
                <button type="button" key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <label className="community-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="글 검색" aria-label="커뮤니티 글 검색" />
            </label>
            <button type="button" className="community-write-inline" onClick={openComposer}>
              <PenLine size={15} />
              글쓰기
            </button>
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

          {loading ? (
            <div className="community-state">커뮤니티 글을 불러오고 있어요.</div>
          ) : error ? (
            <div className="community-state error"><strong>글을 불러오지 못했어요.</strong><span>{error}</span><button type="button" onClick={() => void loadPosts()}>다시 시도</button></div>
          ) : visiblePosts.length === 0 ? (
            <div className="community-state empty">
              <MessageCircle size={28} />
              <strong>{search ? "검색 결과가 없어요." : "아직 올라온 글이 없어요."}</strong>
              <span>{search ? "다른 검색어를 입력해보세요." : "첫 글을 남겨 커뮤니티를 시작해보세요."}</span>
              {!search && <button type="button" onClick={openComposer}>첫 글 쓰기</button>}
            </div>
          ) : (
            <div className="community-post-list">
              {visiblePosts.map((post) => (
                <article className={`community-post-card ${expandedPostId === post.id ? "expanded" : ""}`} key={post.id}>
                  <div className="community-post-meta">
                    <span>{communityCategoryLabel(post.category)}</span>
                    <strong>{post.authorName}</strong>
                    <small>{post.visibility === "school" ? schoolLabel(post.schoolId) : "대학생 전체"} · {relativeTime(post.createdAt)}</small>
                    {post.isMine && <button type="button" onClick={() => void deletePost(post.id)} aria-label="내 글 삭제"><Trash2 size={15} /></button>}
                  </div>
                  <button type="button" className="community-post-content" onClick={() => void openComments(post.id)}>
                    <h2>{post.title}</h2>
                    <p>{post.content}</p>
                  </button>
                  <div className="community-post-actions">
                    <button type="button" className={post.liked ? "liked" : ""} onClick={() => void toggleLike(post)}>
                      <Heart size={17} fill={post.liked ? "currentColor" : "none"} /> 공감 {post.likeCount}
                    </button>
                    <button type="button" onClick={() => void openComments(post.id)}>
                      <MessageCircle size={17} /> 댓글 {post.commentCount}
                    </button>
                  </div>
                  {expandedPostId === post.id && (
                    <div className="community-comments">
                      {commentsLoading ? (
                        <p>댓글을 불러오고 있어요.</p>
                      ) : comments.length === 0 ? (
                        <p>첫 댓글을 남겨보세요.</p>
                      ) : (
                        <div className="community-comment-list">
                          {comments.map((comment) => (
                            <article key={comment.id}>
                              <div><strong>{comment.authorName}</strong><small>{schoolLabel(comment.schoolId)} · {relativeTime(comment.createdAt)}</small></div>
                              <p>{comment.content}</p>
                            </article>
                          ))}
                        </div>
                      )}
                      <form className="community-comment-form" onSubmit={createComment}>
                        <input value={commentValue} onChange={(event) => setCommentValue(event.target.value)} placeholder={user ? "댓글을 입력해주세요" : "로그인하고 댓글을 남겨보세요"} maxLength={500} onFocus={() => { if (!user) onAuth(); }} />
                        <button type="submit" disabled={commentSaving || !commentValue.trim()} aria-label="댓글 등록"><Send size={16} /></button>
                      </form>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="community-side">
          <section className="community-school-card">
            <span><School size={17} /> 우리 학교 공간</span>
            <strong>{schoolLabel(user?.schoolId ?? "yonsei")}</strong>
            <p>{user ? "학교 탭의 글은 같은 학교 구성원끼리 나누는 이야기예요." : "로그인하면 내 학교 커뮤니티가 자동으로 연결돼요."}</p>
          </section>
          <section className="community-cash-card">
            <span className="community-cash-icon"><Coins size={21} /></span>
            <div>
              <strong>설문 참여하고 30C</strong>
              <p>로그인 후 설문을 완료하면 설문마다 한 번 캐시가 쌓여요.</p>
            </div>
            {!user && <button type="button" onClick={onAuth}>로그인하고 시작하기 <ArrowRight size={15} /></button>}
          </section>
          <section className="community-guide-card">
            <strong>커뮤니티 이용 안내</strong>
            <ul>
              <li>개인정보가 포함된 응답을 요구하지 마세요.</li>
              <li>같은 모집 글을 반복해서 올리지 마세요.</li>
              <li>서로 존중하는 표현을 사용해주세요.</li>
            </ul>
          </section>
          <button type="button" className="community-survey-cta" onClick={onCreateSurvey}>
            설문을 만들고 참여자 모집하기 <ArrowRight size={16} />
          </button>
        </aside>
      </section>
    </main>
  );
}
