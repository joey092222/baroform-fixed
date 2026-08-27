"use client";

import {
  ArrowRight,
  Link2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  rankCampusPulses,
  type CampusPulse,
} from "../../campus-pulse";
import {
  communityCategoryLabel,
} from "../../community";
import {
  categoryLabel,
  surveyCategories,
  type SurveyCategory,
} from "../../survey-board";
import {
  type AuthUser,
  type OwnedSurvey,
  type PublicSurvey,
} from "../../ux/types";
import { createExternalSurvey } from "../../ux/data/surveys";
import { fetchPulses } from "../../ux/data/pulses";
import { fetchCommunityPosts } from "../../ux/data/community";
import { PlazaSurveyCard, surveyTarget } from "../shared/plaza-card";

/** How many community posts the home preview shows. */
const homeCommunityPreviewCount = 5;

/** Sorts the plaza offers, in the order they appear. */
const plazaSorts = [
  { id: "recent", label: "최신순" },
  { id: "due", label: "마감 임박" },
  { id: "reward", label: "캐시 높은순" },
  { id: "popular", label: "이번 주 인기" },
] as const;
type PlazaSort = (typeof plazaSorts)[number]["id"];

import { PulseCreateModal } from "../shared/campus-pulse";
import {
  Footer,
} from "../shared/chrome";
import {
  HomeOwnedSurveyCard,
  homeRelativeTime,
  type HomeCommunityPost,
} from "../shared/survey-cards";

export function ExternalSurveyModal({
  authToken,
  onClose,
  onSaved,
}: {
  authToken: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [targetResponses, setTargetResponses] = useState(50);
  const [category, setCategory] = useState<SurveyCategory>("campus");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createExternalSurvey(authToken, {
        title,
        externalUrl,
        description,
        durationMinutes,
        targetResponses,
        category,
      });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "외부 설문을 등록하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop feature-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="external-survey-title">
      <form className="feature-modal" onSubmit={submit}>
        <button type="button" className="feature-modal-close" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        <span className="feature-modal-kicker"><Link2 size={16} /> EXTERNAL SURVEY</span>
        <h2 id="external-survey-title">이미 만든 설문도 바로 모집하세요.</h2>
        <p>Google Forms, Typeform 등 공개 링크를 등록하면 학교 설문 목록에서 응답자를 찾을 수 있어요.</p>
        <label><span>설문 제목</span><input required minLength={2} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 축제 라인업 만족도 조사" /></label>
        <label><span>설문 링크</span><input required type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://forms.google.com/..." /></label>
        <label><span>한 줄 소개 <small>선택</small></span><textarea maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="누가, 왜 참여하면 좋은지 알려주세요." /></label>
        <div className="feature-modal-row">
          <label><span>예상 시간</span><input type="number" min={1} max={60} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} /><em>분</em></label>
          <label><span>목표 인원</span><input type="number" min={5} max={5000} value={targetResponses} onChange={(event) => setTargetResponses(Number(event.target.value))} /><em>명</em></label>
        </div>
        <label><span>카테고리</span><select value={category} onChange={(event) => setCategory(event.target.value as SurveyCategory)}>{surveyCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        {error && <span className="feature-modal-error" role="alert">{error}</span>}
        <button type="submit" className="feature-modal-submit" disabled={saving}>{saving ? "등록 중…" : "학교 게시판에 등록하기"}<ArrowRight size={17} /></button>
      </form>
    </div>
  );
}

export function ProductHomeView({
  surveys,
  ownedSurveys,
  loadingSurveys,
  user,
  authToken,
  cashBalance,
  onAuth,
  onRefreshSurveys,
  onCreate,
  onOpenBoard,
  onOpenSurvey,
  onOpenOwnedSurvey,
  onOpenCommunity,
  onOpenPulseBoard,
}: {
  surveys: PublicSurvey[];
  ownedSurveys: OwnedSurvey[];
  loadingSurveys: boolean;
  user: AuthUser | null;
  authToken: string;
  cashBalance: number;
  onAuth: () => void;
  onRefreshSurveys: () => void;
  onCreate: (prompt?: string) => void;
  onOpenBoard: () => void;
  onOpenSurvey: (survey: PublicSurvey) => void;
  onOpenOwnedSurvey: (survey: OwnedSurvey) => void;
  onOpenCommunity: () => void;
  onOpenPulseBoard: () => void;
}) {
  const [communityPosts, setCommunityPosts] = useState<HomeCommunityPost[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [surveySearch, setSurveySearch] = useState("");
  const [surveyFilter, setSurveyFilter] = useState<"all" | SurveyCategory>("all");
  const [sort, setSort] = useState<PlazaSort>("recent");
  const [tab, setTab] = useState<"open" | "mine">("open");
  const [shown, setShown] = useState(9);
  const [externalSurveyOpen, setExternalSurveyOpen] = useState(false);
  const [pulseCreateOpen, setPulseCreateOpen] = useState(false);
  const [pulses, setPulses] = useState<CampusPulse[]>([]);

  const loadPulses = useCallback(async () => {
    try {
      setPulses(await fetchPulses(authToken));
    } catch {
      setPulses([]);
    }
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    fetchPulses(authToken)
      .then((nextPulses) => {
        if (!cancelled) setPulses(nextPulses);
      })
      .catch(() => {
        if (!cancelled) setPulses([]);
      });
    return () => { cancelled = true; };
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    const loadCommunityPreview = async () => {
      try {
        const posts = await fetchCommunityPosts({
          scope: "all",
          category: "all",
        });
        if (!cancelled) {
          setCommunityPosts(posts.slice(0, homeCommunityPreviewCount));
        }
      } catch {
        if (!cancelled) setCommunityPosts([]);
      } finally {
        if (!cancelled) setLoadingCommunity(false);
      }
    };
    void loadCommunityPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredHomeSurveys = useMemo(() => {
    const keyword = surveySearch.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
    const matching = [...surveys]
      .filter((survey) => surveyFilter === "all" || survey.category === surveyFilter)
      .filter((survey) =>
        !keyword ||
        [survey.title, survey.ownerName, survey.description, categoryLabel(survey.category)]
          .join(" ")
          .toLocaleLowerCase("ko-KR")
          .includes(keyword),
      );
    const byRecent = (left: PublicSurvey, right: PublicSurvey) =>
      (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
    if (sort === "reward") {
      return matching.sort(
        (left, right) => right.rewardCash - left.rewardCash || byRecent(left, right),
      );
    }
    if (sort === "popular") {
      return matching.sort(
        (left, right) =>
          (right.responseCount ?? 0) - (left.responseCount ?? 0) || byRecent(left, right),
      );
    }
    if (sort === "due") {
      // 목표에 가까운 설문이 먼저 닫힙니다. 마감일을 저장하지 않으므로
      // 「얼마나 찼는지」가 그 대리 지표입니다.
      const filled = (survey: PublicSurvey) =>
        (survey.responseCount ?? 0) / surveyTarget(survey);
      return matching.sort(
        (left, right) => filled(right) - filled(left) || byRecent(left, right),
      );
    }
    return matching.sort(byRecent);
  }, [sort, surveyFilter, surveySearch, surveys]);

  const visibleSurveys = filteredHomeSurveys.slice(0, shown);
  const myResponses = ownedSurveys.reduce(
    (total, survey) => total + survey.responseCount,
    0,
  );
  const featuredPulse = useMemo(() => rankCampusPulses(pulses)[0], [pulses]);

  const initial = (user?.name ?? "손").slice(0, 1);

  return (
    <>
      <main className="pz">
        <div className="pz-wrap">
          <div className="pz-head">
            <h1>광장</h1>
            <p>참여하면 캐시가 쌓이고, 그 캐시로 내 설문의 응답자를 구합니다.</p>
          </div>

          <div className="pz-cols">
            {/* ── 좌측: 내 현황 ── */}
            <div className="pz-rail">
              <div className="pz-box pz-prof">
                <div className="pz-id">
                  <span className="pz-av" aria-hidden="true">{initial}</span>
                  <span className="pz-who">
                    <b>{user ? user.name : "로그인하지 않음"}</b>
                    <span>{user ? "연세대학교 신촌캠퍼스" : "참여는 되지만 캐시는 안 쌓입니다"}</span>
                  </span>
                </div>
                {user ? (
                  <>
                    <div className="pz-wallet">
                      <span>내 캐시</span>
                      <b>{cashBalance.toLocaleString("ko-KR")}</b>
                    </div>
                    <div className="pz-kpis">
                      <div><b>{ownedSurveys.length}</b><span>만든 설문</span></div>
                      <div><b>{myResponses.toLocaleString("ko-KR")}</b><span>받은 응답</span></div>
                    </div>
                  </>
                ) : (
                  <button type="button" className="pz-go" style={{ marginTop: 14, width: "100%" }} onClick={onAuth}>
                    로그인하고 캐시 받기
                  </button>
                )}
              </div>

              <div className="pz-box">
                <button type="button" className="pz-link" onClick={() => onCreate()}>
                  설문 만들기<em>＋</em>
                </button>
                <button type="button" className="pz-link" onClick={onOpenBoard}>
                  설문 전체 보기<em>{surveys.length}</em>
                </button>
                <button type="button" className="pz-link" onClick={onOpenPulseBoard}>
                  캠퍼스 투표<em>{pulses.length}</em>
                </button>
                <button type="button" className="pz-link" onClick={onOpenCommunity}>
                  커뮤니티<em>↗</em>
                </button>
                <button type="button" className="pz-link" onClick={() => setExternalSurveyOpen(true)}>
                  외부 설문 등록<em>↗</em>
                </button>
              </div>
            </div>

            {/* ── 중앙: 설문 카드 ── */}
            <div>
              <div className="pz-tabs" role="tablist" aria-label="설문 목록">
                <button type="button" role="tab" aria-selected={tab === "open"} onClick={() => setTab("open")}>
                  참여할 설문<i>{surveys.length}</i>
                </button>
                <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>
                  내가 만든 설문<i>{ownedSurveys.length}</i>
                </button>
              </div>

              {tab === "open" ? (
                <>
                  <div className="pz-sortbar">
                    <label className="pz-search">
                      <span className="sr-only">설문 검색</span>
                      <input
                        value={surveySearch}
                        onChange={(event) => setSurveySearch(event.target.value)}
                        placeholder="설문 제목·주제 검색"
                      />
                    </label>
                    <div className="pz-cats">
                      <button
                        type="button"
                        aria-pressed={surveyFilter === "all"}
                        onClick={() => setSurveyFilter("all")}
                      >
                        전체
                      </button>
                      {surveyCategories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          aria-pressed={surveyFilter === category.id}
                          onClick={() => setSurveyFilter(category.id)}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                    <div className="pz-sorts">
                      {plazaSorts.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={sort === option.id}
                          onClick={() => setSort(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingSurveys ? (
                    <div className="pz-box pz-empty"><b>설문을 불러오고 있어요</b></div>
                  ) : visibleSurveys.length === 0 ? (
                    <div className="pz-box pz-empty">
                      <b>{surveySearch.trim() ? "찾는 설문이 없어요" : "아직 참여할 설문이 없어요"}</b>
                      <p>
                        {surveySearch.trim()
                          ? "다른 말로 검색하거나 정렬을 바꿔보세요."
                          : "첫 설문을 만들면 이 자리에 올라가고, 다른 학생들이 답해줍니다."}
                      </p>
                      <button type="button" className="pz-go" onClick={() => onCreate()}>
                        설문 만들기
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="pz-grid">
                        {visibleSurveys.map((survey) => (
                          <PlazaSurveyCard
                            key={survey.slug}
                            survey={survey}
                            onOpen={() => onOpenSurvey(survey)}
                            onDetail={onOpenBoard}
                          />
                        ))}
                      </div>
                      {filteredHomeSurveys.length > visibleSurveys.length ? (
                        <button type="button" className="pz-more" onClick={() => setShown((count) => count + 9)}>
                          설문 더 보기 ({filteredHomeSurveys.length - visibleSurveys.length}개 남음)
                        </button>
                      ) : null}
                    </>
                  )}
                </>
              ) : ownedSurveys.length === 0 ? (
                <div className="pz-box pz-empty" style={{ marginTop: 16 }}>
                  <b>아직 만든 설문이 없어요</b>
                  <p>주제를 한 줄 적으면 문항과 선택지, 척도까지 설계해드립니다.</p>
                  <button type="button" className="pz-go" onClick={() => onCreate()}>
                    설문 만들기
                  </button>
                </div>
              ) : (
                <div className="pz-grid" style={{ marginTop: 16 }}>
                  {ownedSurveys.map((survey) => (
                    <HomeOwnedSurveyCard
                      key={survey.slug}
                      survey={survey}
                      onClick={() => onOpenOwnedSurvey(survey)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── 우측: 커뮤니티 · 투표 ── */}
            <div className="pz-side">
              <div className="pz-box">
                <h2>
                  커뮤니티에서 오늘
                  <button type="button" onClick={onOpenCommunity}>더 보기</button>
                </h2>
                {loadingCommunity ? (
                  <p className="pz-poll-total" style={{ padding: "14px 16px", margin: 0 }}>
                    불러오는 중…
                  </p>
                ) : communityPosts.length === 0 ? (
                  <p className="pz-poll-total" style={{ padding: "14px 16px", margin: 0 }}>
                    아직 글이 없어요. 설문 만들다 막힌 걸 물어보세요.
                  </p>
                ) : (
                  communityPosts.map((post, index) => (
                    <button type="button" className="pz-post" key={post.id} onClick={onOpenCommunity}>
                      <span className={index < 3 ? "pz-rank pz-top" : "pz-rank"}>{index + 1}</span>
                      <span>
                        <span className="pz-post-t">{post.title}</span>
                        <span className="pz-post-m">
                          <span>{communityCategoryLabel(post.category)}</span>
                          <em>{post.commentCount}</em>
                          <span>{homeRelativeTime(post.createdAt)}</span>
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>

              {featuredPulse ? (
                <div className="pz-box pz-poll">
                  <p className="pz-poll-q" style={{ margin: 0 }}>{featuredPulse.question}</p>
                  <div className="pz-poll-opts">
                    {featuredPulse.options.map((option, index) => {
                      const votes = featuredPulse.overall[index] ?? 0;
                      const share = featuredPulse.totalVotes
                        ? Math.round((votes / featuredPulse.totalVotes) * 100)
                        : 0;
                      return (
                        <button type="button" className="pz-poll-opt" key={option} onClick={onOpenPulseBoard}>
                          <i style={{ width: `${share}%` }} />
                          <span>{option}</span>
                          <em>{share}%</em>
                        </button>
                      );
                    })}
                  </div>
                  <p className="pz-poll-total">
                    {featuredPulse.totalVotes.toLocaleString("ko-KR")}명 참여
                  </p>
                </div>
              ) : null}

              <div className="pz-box pz-biz">
                <h2 style={{ padding: 0, border: 0, fontSize: 14.5 }}>기업 리서치</h2>
                <p>조건에 맞는 응답자에게 설문을 배정합니다. 학년·학과·이용 경험까지 지정할 수 있습니다.</p>
                <button type="button" onClick={() => setExternalSurveyOpen(true)}>문의하기</button>
              </div>
            </div>
          </div>

          <p className="pz-credit">
            표지 사진 제공: <a href="https://www.pexels.com" target="_blank" rel="noreferrer noopener">Pexels</a>
          </p>
        </div>
      </main>
      <Footer />
      {externalSurveyOpen && (
        <ExternalSurveyModal
          authToken={authToken}
          onClose={() => setExternalSurveyOpen(false)}
          onSaved={onRefreshSurveys}
        />
      )}
      {pulseCreateOpen && (
        <PulseCreateModal
          authToken={authToken}
          onClose={() => setPulseCreateOpen(false)}
          onSaved={() => void loadPulses()}
        />
      )}
    </>
  );
}


