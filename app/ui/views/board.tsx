"use client";

import {
  ArrowRight,
  School,
  Search,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";
import {
  categoryLabel,
  surveyCategories,
  type SurveyCategory,
  schoolLabel,
} from "../../survey-board";
import {
  type PublicSurvey,
} from "../../ux/types";
import { PlazaSurveyCard } from "../shared/plaza-card";

export function SchoolBoardView({
  surveys,
  loadingSurveys,
  onOpenSurvey,
  onCreate,
}: {
  surveys: PublicSurvey[];
  loadingSurveys: boolean;
  onOpenSurvey: (survey: PublicSurvey) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState<"all" | SurveyCategory>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"latest" | "short" | "reward" | "popular">("latest");

  const visibleSurveys = useMemo(() => {
    let filtered = [...surveys];
    if (filter !== "all") {
      filtered = filtered.filter((survey) => survey.category === filter);
    }
    if (search.trim()) {
      const keyword = search.trim().toLocaleLowerCase("ko-KR");
      filtered = filtered.filter(
        (survey) =>
          survey.title.toLocaleLowerCase("ko-KR").includes(keyword) ||
          survey.ownerName.toLocaleLowerCase("ko-KR").includes(keyword) ||
          survey.description.toLocaleLowerCase("ko-KR").includes(keyword) ||
          categoryLabel(survey.category).includes(keyword),
      );
    }
    filtered.sort((a, b) => {
      if (sort === "short") return a.durationMinutes - b.durationMinutes;
      if (sort === "reward") return b.rewardCash - a.rewardCash;
      if (sort === "popular") return (b.responseCount ?? 0) - (a.responseCount ?? 0);
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
    return filtered;
  }, [filter, search, sort, surveys]);

  return (
    <>
      <main className="bd-wrap">
        <div className="bd-head">
          <h1>전체 설문</h1>
          <p>{schoolLabel("yonsei")} · 참여하면 캐시가 쌓입니다.</p>
          <button type="button" className="bd-new" onClick={onCreate}>
            ＋ 내 설문 올리기
          </button>
        </div>

        <div className="bd-bar">
          <label className="bd-search">
            <span className="sr-only">설문 검색</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="제목·게시자·분류 검색"
            />
          </label>
          <div className="pz-cats">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              전체
            </button>
            {surveyCategories.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="pz-sorts">
            {[
              { id: "latest" as const, label: "최신순" },
              { id: "short" as const, label: "짧은 순" },
              { id: "reward" as const, label: "캐시 높은순" },
              { id: "popular" as const, label: "참여 많은순" },
            ].map((option) => (
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
          <span className="bd-count">
            {loadingSurveys ? "불러오는 중" : `${visibleSurveys.length}개`}
          </span>
        </div>

          {loadingSurveys ? (
            <div className="board-loading" aria-live="polite">
              <span />
              <span />
              <span />
              <p>학교 설문을 불러오고 있어요.</p>
            </div>
          ) : visibleSurveys.length > 0 ? (
            <div className="pz-grid pz-grid-board">
              {visibleSurveys.map((survey) => (
                <PlazaSurveyCard
                  key={survey.slug}
                  survey={survey}
                  onOpen={() => onOpenSurvey(survey)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-search public-empty board-empty-state">
              {search ? <Search size={27} /> : <School size={27} />}
              <strong>
                {search
                  ? "일치하는 설문이 없어요."
                  : "아직 공개된 학교 설문이 없어요."}
              </strong>
              <span>
                {search
                  ? "검색어나 카테고리를 바꿔보세요."
                  : "첫 설문을 올리면 연세대 게시판에서 바로 응답을 모집할 수 있어요."}
              </span>
              {!search && (
                <button type="button" onClick={onCreate}>
                  첫 학교 설문 만들기
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
      </main>
    </>
  );
}

