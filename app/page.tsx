"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Eye,
  GripVertical,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  School,
  Search,
  Share2,
  Sparkles,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeSurveyPrompt,
  type SurveyBlueprint,
  type SurveyQuestion,
} from "./survey-intent";
import type {
  SurveyClarification,
  SurveyResearch,
} from "./survey-ai";

type View =
  | "home"
  | "choose"
  | "editor"
  | "published"
  | "survey"
  | "analytics";

type PublicSurvey = {
  slug: string;
  title: string;
  description: string;
  ownerName: string;
  campus: string;
  durationMinutes: number;
  createdAt?: string;
  questions?: Question[];
};

type StoredAnswer = {
  questionId: number;
  title: string;
  type: Question["type"];
  value: number | string | string[];
};

type StoredResponse = {
  id: string;
  answers: StoredAnswer[];
  completionSeconds: number;
  createdAt: string;
};

type AnalyzedDraft = {
  prompt: string;
  blueprint: SurveyBlueprint;
  research: SurveyResearch;
};

type ClarificationState = {
  prompt: string;
  clarification: SurveyClarification;
  research: SurveyResearch;
};

type Question = SurveyQuestion;

type ManagedSurveySnapshot = {
  slug: string;
  manageToken: string;
  title: string;
  questions: Question[];
};

const managedSurveyStorageKey = "baroform:last-managed-survey";

const promptSuggestions = [
  "신입생 학교생활 적응 조사",
  "축제 참여자 만족도",
  "새 서비스 사용 경험",
];

const defaultBlueprint = analyzeSurveyPrompt(promptSuggestions[0]);
const initialQuestions = defaultBlueprint.templateQuestions;

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "brand-mark compact" : "brand-mark"} aria-hidden>
      <span />
      <span />
    </span>
  );
}

function Header({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (view: View) => void;
}) {
  const scrollToSurveys = () => {
    if (view !== "home") {
      onNavigate("home");
      window.setTimeout(
        () =>
          document
            .getElementById("school-surveys")
            ?.scrollIntoView({ behavior: "smooth" }),
        80,
      );
      return;
    }
    document
      .getElementById("school-surveys")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToMaker = () => {
    if (view !== "home") {
      onNavigate("home");
      window.setTimeout(
        () => document.getElementById("survey-maker")?.focus(),
        80,
      );
      return;
    }
    document.getElementById("survey-maker")?.focus();
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          className="brand"
          type="button"
          onClick={() => onNavigate("home")}
          aria-label="바로폼 홈"
        >
          <BrandMark />
          <strong>바로폼</strong>
        </button>
        <nav className="main-nav" aria-label="주요 메뉴">
          <button type="button" onClick={scrollToSurveys}>
            학교 설문
          </button>
          <button type="button" onClick={scrollToMaker}>
            설문 만들기
          </button>
          <button type="button" onClick={() => onNavigate("analytics")}>
            결과 분석
          </button>
        </nav>
        <div className="header-actions">
          <span className="no-login-note">
            <Check size={13} strokeWidth={2.5} />
            설문 참여는 로그인 없이
          </span>
          <button
            className="nav-cta"
            type="button"
            onClick={scrollToMaker}
          >
            설문 만들기
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

function CampusSurveyCard({
  survey,
  onClick,
  featured = false,
}: {
  survey: PublicSurvey;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      className={`survey-card accent-blue ${featured ? "featured" : ""}`}
      onClick={onClick}
    >
      <div className="survey-card-top">
        <span className="category-pill">학교 공개 설문</span>
        <span className="deadline">로그인 없이 참여</span>
      </div>
      <div className="survey-owner">
        {survey.ownerName || "게시자 이름 미표시"}
      </div>
      <h3>{survey.title}</h3>
      <p className="survey-description">{survey.description}</p>
      <div className="reward-line">
        <span className="reward-icon">
          <Clock3 size={15} />
        </span>
        <strong>약 {survey.durationMinutes}분</strong>
        <span className="survey-time">
          참여하기
          <ArrowRight size={13} />
        </span>
      </div>
    </button>
  );
}

function HomeView({
  prompt,
  setPrompt,
  onCreate,
  onOpenSurvey,
  surveys,
  loadingSurveys,
  isAnalyzing,
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  onCreate: () => void;
  onOpenSurvey: (survey: PublicSurvey) => void;
  surveys: PublicSurvey[];
  loadingSurveys: boolean;
  isAnalyzing: boolean;
}) {
  const [filter, setFilter] = useState("전체");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const makerRef = useRef<HTMLTextAreaElement | null>(null);

  const visibleSurveys = useMemo(() => {
    let filtered = [...surveys];
    if (filter === "최근 등록") {
      filtered = [...filtered].sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      );
    }
    if (search.trim()) {
      const keyword = search.trim().toLowerCase();
      filtered = filtered.filter(
        (survey) =>
          survey.title.toLowerCase().includes(keyword) ||
          survey.ownerName.toLowerCase().includes(keyword),
      );
    }
    return filtered;
  }, [filter, search, surveys]);

  return (
    <>
      <main className="home-main">
        <section className="home-intro">
          <div className="campus-kicker">
            <span className="campus-symbol">Y</span>
            <span>연세대학교 신촌캠퍼스 · 베타</span>
          </div>
          <h1>
            우리 학교의 생각을 모으고,
            <br />
            설문은 <span>바로</span> 만들어요.
          </h1>
          <p>
            교내 설문에 로그인 없이 참여하고, 만들고 싶은 설문은 한
            문장으로 시작하세요.
          </p>
        </section>

        <section className="first-viewport-grid">
          <div className="maker-panel">
            <div className="panel-label">
              <span className="sparkle-box">
                <Sparkles size={18} />
              </span>
              <div>
                <small>BAROFORM SMART DRAFT</small>
                <strong>어떤 설문을 만들까요?</strong>
              </div>
            </div>
            <p className="maker-helper">
              조사 목적과 대상을 한 문장으로 적으면, 어떤 주제든 공개
              자료를 먼저 조사한 뒤 질문과 선택지를 만들어요.
            </p>
            <div className="prompt-box">
              <textarea
                id="survey-maker"
                ref={makerRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="예) 연세대 재학생의 도서관 이용 만족도를 조사하고 싶어요"
                rows={3}
                maxLength={300}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    onCreate();
                  }
                }}
              />
              <div className="prompt-footer">
                <span>목적 · 조사 대상 · 알고 싶은 점</span>
                <button
                  type="button"
                  className="prompt-submit"
                  onClick={onCreate}
                  disabled={isAnalyzing}
                  aria-label="설문 만들기 시작"
                >
                  {isAnalyzing ? <Sparkles size={19} /> : <ArrowUp size={20} />}
                </button>
              </div>
            </div>
            <div className="suggestion-row">
              <span>빠른 시작</span>
              {promptSuggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => {
                    setPrompt(suggestion);
                    makerRef.current?.focus();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="maker-trust">
              <span>
                <CheckCircle2 size={15} />
                로그인 없이 초안 만들기
              </span>
              <span>
                <WandSparkles size={15} />
                문항 자동 추천
              </span>
              <span>
                <BarChart3 size={15} />
                자동 결과 분석
              </span>
            </div>
          </div>

          <div
            className={`campus-preview-panel ${
              !loadingSurveys && surveys.length === 0 ? "empty" : ""
            }`}
          >
            <div className="section-title-row compact-title-row">
              <div>
                <span className="eyebrow">지금 우리 학교</span>
                <h2>참여를 기다리는 설문</h2>
              </div>
              <button
                type="button"
                className="text-link"
                hidden={!loadingSurveys && surveys.length === 0}
                onClick={() =>
                  document
                    .getElementById("school-surveys")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                전체 보기
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="preview-survey-grid">
              {loadingSurveys ? (
                <div className="survey-loading-state" aria-live="polite">
                  <span />
                  <span />
                  <span />
                  <p>공개 설문을 불러오고 있어요.</p>
                </div>
              ) : surveys.length > 0 ? (
                surveys.slice(0, 3).map((survey, index) => (
                  <CampusSurveyCard
                    key={survey.slug}
                    survey={survey}
                    featured={index === 0}
                    onClick={() => onOpenSurvey(survey)}
                  />
                ))
              ) : (
                <div className="real-empty-state">
                  <span className="empty-state-icon">
                    <School size={25} />
                  </span>
                  <strong>아직 공개된 학교 설문이 없어요.</strong>
                  <p>
                    실제로 배포되고 확인을 마친 설문만 이곳에 표시돼요.
                    첫 설문을 만들어 의견을 모아보세요.
                  </p>
                  <button
                    type="button"
                    onClick={() => makerRef.current?.focus()}
                  >
                    첫 교내 설문 만들기
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {(loadingSurveys || surveys.length > 0) && (
        <section className="school-surveys-section" id="school-surveys">
          <div className="section-title-row">
            <div>
              <span className="eyebrow">YONSEI CAMPUS VOICE</span>
              <h2>학교 안의 다양한 설문을 만나보세요</h2>
              <p>짧게 참여하고, 우리 학교의 다음 변화를 함께 만들어요.</p>
            </div>
            <div className="survey-tools">
              <div className={`survey-search ${searchOpen ? "open" : ""}`}>
                <button
                  type="button"
                  aria-label="설문 검색"
                  onClick={() => setSearchOpen((value) => !value)}
                >
                  <Search size={17} />
                </button>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="설문 검색"
                  aria-label="설문 검색어"
                />
              </div>
              <div className="filter-tabs" role="tablist" aria-label="설문 필터">
                {["전체", "최근 등록"].map((item) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === item}
                    className={filter === item ? "active" : ""}
                    key={item}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {visibleSurveys.length > 0 ? (
            <div className="all-surveys-grid">
              {visibleSurveys.map((survey) => (
                <CampusSurveyCard
                  key={survey.slug}
                  survey={survey}
                  onClick={() => onOpenSurvey(survey)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-search public-empty">
              {search ? <Search size={24} /> : <School size={24} />}
              <strong>
                {search
                  ? "일치하는 설문이 없어요."
                  : "현재 공개된 학교 설문이 없어요."}
              </strong>
              <span>
                {search
                  ? "다른 검색어를 입력해보세요."
                  : "실제로 공개된 설문이 생기면 여기에 바로 표시돼요."}
              </span>
            </div>
          )}
        </section>
        )}

        <section className="campus-cta">
          <div>
            <span className="cta-label">내가 찾는 설문이 없나요?</span>
            <h2>
              질문 한 문장이면,
              <br />
              바로폼이 설문을 완성해요.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              window.setTimeout(() => makerRef.current?.focus(), 450);
            }}
          >
            내 설문 만들기
            <ArrowUp size={18} />
          </button>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ChooseView({
  prompt,
  blueprint,
  research,
  onBack,
  onSelect,
}: {
  prompt: string;
  blueprint: SurveyBlueprint;
  research: SurveyResearch;
  onBack: () => void;
  onSelect: (mode: "template" | "ai") => void;
}) {
  return (
    <main className="flow-page">
      <div className="flow-shell">
        <button className="back-link" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          다시 입력하기
        </button>
        <div className="prompt-recap">
          <span>내가 만들 설문</span>
          <strong>“{prompt}”</strong>
        </div>
        <div className="flow-heading">
          <div>
            <span className="step-number">01</span>
            <span className="eyebrow">START YOUR SURVEY</span>
          </div>
          <h1>어떻게 시작할까요?</h1>
          <p>
            바로 쓸 수 있는 추천 템플릿을 고르거나, 목적에 맞춰 AI가 새로
            만들 수 있어요.
          </p>
        </div>
        <div className="choice-grid">
          <button
            className="choice-card template-choice"
            type="button"
            onClick={() => onSelect("template")}
          >
            <div className="choice-topline">
              <span className="choice-icon">
                <LayoutTemplate size={22} />
              </span>
              <span className="recommended-badge">가장 빠름</span>
            </div>
            <div className="choice-copy">
              <span>추천 템플릿 · {blueprint.intentLabel}</span>
              <h2>{blueprint.templateTitle}</h2>
              <p>{blueprint.templateSummary}</p>
            </div>
            <div className="template-preview intent-preview">
              {blueprint.templateQuestions.slice(0, 3).map((question, index) => (
                <span key={question.id}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <em>{question.title}</em>
                </span>
              ))}
            </div>
            <div className="choice-footer">
              <span>{blueprint.templateQuestions.length}개 문항으로 시작</span>
              <ArrowRight size={18} />
            </div>
          </button>

          <button
            className="choice-card ai-choice"
            type="button"
            onClick={() => onSelect("ai")}
          >
            <div className="choice-topline">
              <span className="choice-icon">
                <WandSparkles size={22} />
              </span>
              <span className="ai-badge">맞춤 초안</span>
            </div>
            <div className="choice-copy">
              <span>AI가 문맥을 이렇게 이해했어요</span>
              <h2>{blueprint.aiTitle ?? `${blueprint.subject} 맞춤 설문`}</h2>
              <p>
                응답 대상과 평가할 경험을 분리한 뒤, 질문 순서와
                선택지를 주제에 맞게 구성해요.
              </p>
            </div>
            <div className="ai-preview intent-analysis-preview">
              <div className="ai-glow" />
              <Sparkles size={22} />
              <div className="analysis-signal-list">
                {blueprint.detectedSignals.map((signal) => (
                  <span key={signal}>
                    <Check size={12} />
                    {signal}
                  </span>
                ))}
                <span>
                  <Check size={12} />
                  {blueprint.aiQuestions.length}개 맞춤 문항
                </span>
              </div>
            </div>
            <div className="choice-footer">
              <span>AI에게 맡기기</span>
              <ArrowRight size={18} />
            </div>
          </button>
        </div>
        {research.status !== "not-needed" && (
          <section
            className={`research-card ${research.status}`}
            aria-label="AI 자료 확인 결과"
          >
            <div className="research-card-icon">
              {research.status === "searched" || research.status === "cached" ? (
                <Search size={19} />
              ) : (
                <CircleHelp size={19} />
              )}
            </div>
            <div className="research-card-copy">
              <span>
                {research.status === "searched"
                  ? "AI가 웹에서 먼저 조사했어요"
                  : research.status === "cached"
                    ? "검증된 공개 자료를 불러왔어요"
                    : "정보조사를 완료하지 못했어요"}
              </span>
              <strong>
                {research.entity
                  ? `‘${research.entity}’의 실제 맥락을 문항에 반영했어요.`
                  : "응답 대상과 평가할 경험을 분리했어요."}
              </strong>
              <p>{research.summary}</p>
              {research.facts.length > 0 && (
                <ul>
                  {research.facts.slice(0, 3).map((fact) => (
                    <li key={fact}>
                      <Check size={12} />
                      {fact}
                    </li>
                  ))}
                </ul>
              )}
              {research.sources.length > 0 && (
                <div className="research-sources">
                  <span>확인한 출처</span>
                  <div>
                    {research.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.title}
                        <small>{source.domain}</small>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        <p className="choice-footnote">
          어떤 방식을 골라도 다음 화면에서 질문과 선택지를 자유롭게 바꿀
          수 있어요.
        </p>
      </div>
    </main>
  );
}

function ClarificationModal({
  state,
  onChoose,
  onClose,
}: {
  state: ClarificationState;
  onChoose: (option: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="generation-overlay" role="dialog" aria-modal="true">
      <div className="clarification-card">
        <span className="clarification-icon">
          <CircleHelp size={24} />
        </span>
        <span className="clarification-label">정확한 설문을 위해 한 가지만</span>
        <h2>{state.clarification.question}</h2>
        <p>{state.clarification.reason}</p>
        {state.research.sources.length > 0 && (
          <small>공개 자료를 확인했지만 이 부분은 임의로 정하지 않았어요.</small>
        )}
        <div className="clarification-options">
          {state.clarification.options.map((option) => (
            <button type="button" key={option} onClick={() => onChoose(option)}>
              {option}
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
        <button className="clarification-close" type="button" onClick={onClose}>
          직접 문장을 다시 적을게요
        </button>
      </div>
    </div>
  );
}

function EditorView({
  title,
  setTitle,
  description,
  setDescription,
  questions,
  setQuestions,
  onBack,
  onPublish,
}: {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  questions: Question[];
  setQuestions: (value: Question[]) => void;
  onBack: () => void;
  onPublish: () => void;
}) {
  const [selectedId, setSelectedId] = useState(questions[0]?.id ?? 1);
  const [preview, setPreview] = useState(false);
  const selectedQuestion =
    questions.find((question) => question.id === selectedId) ?? questions[0];

  function updateQuestion<K extends keyof Question>(
    id: number,
    key: K,
    value: Question[K],
  ) {
    setQuestions(
      questions.map((question) =>
        question.id === id ? { ...question, [key]: value } : question,
      ),
    );
  }

  const addQuestion = () => {
    if (questions.length >= 30) return;
    const id = Math.max(...questions.map((question) => question.id), 0) + 1;
    const next: Question = {
      id,
      title: "새 질문을 입력해주세요.",
      reason: "이 질문이 필요한 이유를 AI가 함께 정리해드려요.",
      type: "single",
      options: ["선택지 1", "선택지 2", "선택지 3"],
      required: false,
    };
    setQuestions([...questions, next]);
    setSelectedId(id);
  };

  const removeQuestion = (id: number) => {
    if (questions.length === 1) return;
    const next = questions.filter((question) => question.id !== id);
    setQuestions(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? 1);
  };

  const changeQuestionType = (id: number, type: Question["type"]) => {
    setQuestions(
      questions.map((question) =>
        question.id === id
          ? {
              ...question,
              type,
              options:
                type === "single" || type === "multiple"
                  ? question.options?.length
                    ? question.options
                    : ["선택지 1", "선택지 2", "선택지 3"]
                  : undefined,
            }
          : question,
      ),
    );
  };

  const updateOption = (id: number, optionIndex: number, value: string) => {
    setQuestions(
      questions.map((question) =>
        question.id === id
          ? {
              ...question,
              options: (question.options ?? []).map((option, index) =>
                index === optionIndex ? value : option,
              ),
            }
          : question,
      ),
    );
  };

  const addOption = (id: number) => {
    setQuestions(
      questions.map((question) =>
        question.id === id
          ? {
              ...question,
              options:
                (question.options?.length ?? 0) >= 12
                  ? question.options
                  : [
                      ...(question.options ?? []),
                      `선택지 ${(question.options?.length ?? 0) + 1}`,
                    ],
            }
          : question,
      ),
    );
  };

  const shortenSelectedQuestion = () => {
    if (!selectedQuestion) return;
    const shortened = selectedQuestion.title
      .replace("현재 ", "")
      .replace("전반적으로 ", "")
      .replace("가장 먼저 ", "")
      .trim();
    updateQuestion(
      selectedQuestion.id,
      "title",
      shortened || selectedQuestion.title,
    );
  };

  const deduplicateSelectedOptions = () => {
    if (!selectedQuestion?.options) return;
    const unique = [
      ...new Set(
        selectedQuestion.options
          .map((option) => option.trim())
          .filter(Boolean),
      ),
    ];
    updateQuestion(selectedQuestion.id, "options", unique);
  };

  const addNeutralOption = () => {
    if (
      !selectedQuestion ||
      (selectedQuestion.type !== "single" &&
        selectedQuestion.type !== "multiple")
    ) {
      return;
    }
    const options = selectedQuestion.options ?? [];
    if (options.includes("잘 모르겠음")) return;
    updateQuestion(selectedQuestion.id, "options", [
      ...options,
      "잘 모르겠음",
    ]);
  };

  const structureChecks = [
    questions.length >= 3,
    questions.every((question) => question.title.trim().length >= 5),
    questions
      .filter(
        (question) =>
          question.type === "single" || question.type === "multiple",
      )
      .every((question) => (question.options ?? []).filter(Boolean).length >= 2),
  ];
  const structureScore = Math.round(
    (structureChecks.filter(Boolean).length / structureChecks.length) * 100,
  );

  return (
    <main className="editor-page">
      <div className="editor-topbar">
        <div className="editor-brand">
          <button type="button" onClick={onBack} aria-label="이전 화면">
            <ArrowLeft size={19} />
          </button>
          <BrandMark compact />
          <strong>바로폼</strong>
          <span className="save-state">
            <WandSparkles size={12} />
            초안 편집 중
          </span>
        </div>
        <div className="editor-tabs" role="tablist">
          <button
            type="button"
            className={!preview ? "active" : ""}
            onClick={() => setPreview(false)}
          >
            설문 편집
          </button>
          <button
            type="button"
            className={preview ? "active" : ""}
            onClick={() => setPreview(true)}
          >
            미리보기
          </button>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="더 보기"
          >
            <MoreHorizontal size={19} />
          </button>
          <button
            type="button"
            className="preview-button"
            onClick={() => setPreview((value) => !value)}
          >
            <Eye size={16} />
            미리보기
          </button>
          <button type="button" className="publish-button" onClick={onPublish}>
            배포하기
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className={`editor-layout ${preview ? "preview-mode" : ""}`}>
        {!preview && (
          <aside className="question-sidebar">
            <div className="sidebar-heading">
              <span>설문 구성</span>
              <button type="button" aria-label="설문 구성 도움말">
                <CircleHelp size={15} />
              </button>
            </div>
            <button
              type="button"
              className="outline-intro"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <span className="outline-number">00</span>
              <span>
                <strong>설문 소개</strong>
                <small>제목과 안내문</small>
              </span>
            </button>
            <div className="outline-list">
              {questions.map((question, index) => (
                <button
                  type="button"
                  key={question.id}
                  className={selectedId === question.id ? "active" : ""}
                  onClick={() => setSelectedId(question.id)}
                >
                  <GripVertical size={14} />
                  <span className="outline-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{question.title}</strong>
                    <small>
                      {question.type === "scale"
                        ? "선형 배율"
                        : question.type === "single"
                          ? "단일 선택"
                          : question.type === "multiple"
                            ? "복수 선택"
                          : "장문형"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="add-outline"
              onClick={addQuestion}
              disabled={questions.length >= 30}
            >
              <Plus size={16} />
              질문 추가
            </button>
            <div className="outline-progress">
              <span>
                <strong>{questions.length}</strong>개 질문
              </span>
              <span>예상 {Math.max(1, Math.ceil(questions.length / 2))}분</span>
            </div>
          </aside>
        )}

        <section className="editor-canvas">
          <div className="canvas-width">
            <div className="survey-title-card">
              <span className="tiny-brand">BAROFORM</span>
              {preview ? (
                <>
                  <h1>{title}</h1>
                  <p>{description}</p>
                </>
              ) : (
                <>
                  <input
                    className="title-input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    aria-label="설문 제목"
                    maxLength={100}
                  />
                  <textarea
                    className="description-input"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    aria-label="설문 설명"
                    maxLength={600}
                  />
                </>
              )}
              <div className="survey-meta-pills">
                <span>익명 응답</span>
                <span>약 {Math.max(1, Math.ceil(questions.length / 2))}분</span>
              </div>
            </div>

            {questions.map((question, index) => (
              <article
                className={`question-card ${
                  !preview && selectedId === question.id ? "selected" : ""
                }`}
                key={question.id}
                onClick={() => !preview && setSelectedId(question.id)}
              >
                <div className="question-card-heading">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div className="question-copy">
                    {preview ? (
                      <h2>
                        {question.title}
                        {question.required && <em>*</em>}
                      </h2>
                    ) : (
                      <input
                        value={question.title}
                        onChange={(event) =>
                          updateQuestion(
                            question.id,
                            "title",
                            event.target.value,
                          )
                        }
                        onFocus={() => setSelectedId(question.id)}
                        aria-label={`${index + 1}번 질문`}
                        maxLength={200}
                      />
                    )}
                    <p>
                      <Sparkles size={13} />
                      {question.reason}
                    </p>
                  </div>
                  {!preview && (
                    <button
                      type="button"
                      aria-label="질문 삭제"
                      disabled={questions.length === 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeQuestion(question.id);
                      }}
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>

                {question.type === "scale" && (
                  <div className="scale-options">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button type="button" key={value}>
                        {value}
                      </button>
                    ))}
                    <div className="scale-labels">
                      <span>전혀 그렇지 않음</span>
                      <span>매우 그러함</span>
                    </div>
                  </div>
                )}

                {(question.type === "single" ||
                  question.type === "multiple") && (
                  <div className="multiple-options">
                    {question.options?.map((option, optionIndex) => (
                      <label key={`${question.id}-${optionIndex}`}>
                        <input
                          type={
                            question.type === "single" ? "radio" : "checkbox"
                          }
                          name={
                            question.type === "single"
                              ? `question-${question.id}`
                              : undefined
                          }
                          disabled={!preview}
                        />
                        {preview ? (
                          <span>{option}</span>
                        ) : (
                          <input
                            className="option-text-input"
                            value={option}
                            onChange={(event) =>
                              updateOption(
                                question.id,
                                optionIndex,
                                event.target.value,
                              )
                            }
                            aria-label={`${index + 1}번 질문 선택지 ${optionIndex + 1}`}
                            maxLength={100}
                          />
                        )}
                      </label>
                    ))}
                    {!preview && (
                      <button
                        type="button"
                        className="add-option"
                        onClick={() => addOption(question.id)}
                        disabled={(question.options?.length ?? 0) >= 12}
                      >
                        <Plus size={14} />
                        선택지 추가
                      </button>
                    )}
                  </div>
                )}

                {question.type === "text" && (
                  <textarea
                    className="long-answer"
                    rows={3}
                    placeholder="응답을 입력해주세요."
                    disabled={!preview}
                    maxLength={4000}
                  />
                )}

                {!preview && (
                  <div className="question-controls">
                    <select
                      value={question.type}
                      aria-label="질문 유형"
                      onChange={(event) =>
                        changeQuestionType(
                          question.id,
                          event.target.value as Question["type"],
                        )
                      }
                    >
                      <option value="scale">선형 배율</option>
                      <option value="single">단일 선택</option>
                      <option value="multiple">복수 선택</option>
                      <option value="text">장문형</option>
                    </select>
                    <label className="required-toggle">
                      <span>필수</span>
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(event) =>
                          updateQuestion(
                            question.id,
                            "required",
                            event.target.checked,
                          )
                        }
                      />
                      <i />
                    </label>
                  </div>
                )}
              </article>
            ))}
            {!preview && (
              <button
                type="button"
                className="canvas-add"
                onClick={addQuestion}
                disabled={questions.length >= 30}
              >
                <Plus size={17} />
                질문 추가하기
              </button>
            )}
            {preview && (
              <button type="button" className="survey-submit-preview">
                응답 제출하기
              </button>
            )}
          </div>
        </section>

        {!preview && (
          <aside className="ai-sidebar">
            <div className="ai-assistant-title">
              <span>
                <CheckCircle2 size={16} />
              </span>
              <div>
                <strong>문항 도우미</strong>
                <small>선택한 질문을 빠르게 점검해요</small>
              </div>
            </div>
            <div className="selected-question-box">
              <span>현재 선택</span>
              <strong>{selectedQuestion?.title}</strong>
            </div>
            <div className="assistant-suggestions">
              <span>빠른 수정</span>
              <button type="button" onClick={shortenSelectedQuestion}>
                문장을 더 짧게 정리
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={deduplicateSelectedOptions}
                disabled={
                  selectedQuestion?.type !== "single" &&
                  selectedQuestion?.type !== "multiple"
                }
              >
                중복 선택지 정리
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={addNeutralOption}
                disabled={
                  selectedQuestion?.type !== "single" &&
                  selectedQuestion?.type !== "multiple"
                }
              >
                ‘잘 모르겠음’ 추가
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="ai-quality">
              <div>
                <span>기본 구조 점검</span>
                <strong>{structureScore === 100 ? "완료" : "확인 필요"}</strong>
              </div>
              <div className="quality-track">
                <span style={{ width: `${structureScore}%` }} />
              </div>
              <p>
                질문 수, 제목, 선택지 구성을 기준으로 확인한 결과예요.
              </p>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

function PublishModal({
  title,
  onClose,
  onConfirm,
  saving,
  error,
}: {
  title: string;
  onClose: () => void;
  onConfirm: (ownerName: string, listingRequested: boolean) => void;
  saving: boolean;
  error: string;
}) {
  const [ownerName, setOwnerName] = useState("");
  const [listingRequested, setListingRequested] = useState(false);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="publish-modal">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={20} />
        </button>
        <span className="modal-step">마지막 한 단계</span>
        <span className="publish-icon">
          <Share2 size={24} />
        </span>
        <h2>완성한 설문을 배포할까요?</h2>
        <p>
          링크가 있는 누구나 로그인 없이 참여할 수 있고, 결과는 바로폼에서
          실시간으로 확인할 수 있어요.
        </p>
        <div className="publish-summary">
          <span>설문 제목</span>
          <strong>{title}</strong>
          <div>
            <span>
              <Check size={14} />
              공개 설문
            </span>
            <span>
              <Clock3 size={14} />
              약 2분
            </span>
          </div>
        </div>
        <div className="publish-option">
          <label htmlFor="owner-name">게시자 이름</label>
          <input
            id="owner-name"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            placeholder="예) 경영대 학생 프로젝트팀"
            maxLength={50}
          />
          <small>실제 소속이나 팀 이름만 입력해주세요.</small>
        </div>
        <label className="listing-consent">
          <input
            type="checkbox"
            checked={listingRequested}
            onChange={(event) => setListingRequested(event.target.checked)}
          />
          <span>
            <strong>우리 학교 설문 목록 공개 요청</strong>
            <small>
              실제 교내 설문인지 확인한 뒤 학교 목록에 표시돼요.
            </small>
          </span>
        </label>
        {error && (
          <p className="publish-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="modal-confirm"
          onClick={() => onConfirm(ownerName, listingRequested)}
          disabled={saving}
        >
          {saving ? "공개 링크 만드는 중…" : "공개 링크 만들기"}
          {!saving && <ArrowRight size={17} />}
        </button>
        <span className="modal-note">
          <CheckCircle2 size={14} />
          응답자는 바로폼 계정 없이 참여할 수 있어요
        </span>
      </div>
    </div>
  );
}

function PublishedView({
  title,
  slug,
  listingRequested,
  onSurvey,
  onAnalytics,
  onHome,
}: {
  title: string;
  slug: string;
  listingRequested: boolean;
  onSurvey: () => void;
  onAnalytics: () => void;
  onHome: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window === "undefined"
      ? `?survey=${slug}`
      : `${window.location.origin}/?survey=${slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard access can be unavailable in an embedded preview.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="published-page">
      <div className="published-shell">
        <span className="success-check">
          <Check size={28} />
        </span>
        <span className="published-kicker">배포 준비 완료</span>
        <h1>{title}</h1>
        <p>
          아래 링크를 보내면 누구나 로그인 없이 바로 응답할 수 있어요.
        </p>
        <div className="share-box">
          <span>{shareUrl}</span>
          <button type="button" onClick={copyLink}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "복사됨" : "링크 복사"}
          </button>
        </div>
        <div className="share-banner">
          <div>
            <BrandMark compact />
            <span>BAROFORM SURVEY</span>
          </div>
          <h2>{title}</h2>
          <p>로그인 없이 참여 · 익명 응답</p>
          <span className="share-banner-badge">링크를 복사해 바로 공유하세요</span>
        </div>
        <div className="access-info">
          <div>
            <span>공개 범위</span>
            <strong>링크가 있는 모든 사람</strong>
          </div>
          <div>
            <span>학교 설문 목록</span>
            <strong>
              {listingRequested ? "확인 요청됨" : "표시하지 않음"}
            </strong>
          </div>
          <div>
            <span>응답자 로그인</span>
            <strong>필요 없음</strong>
          </div>
        </div>
        <div className="published-actions">
          <button type="button" className="secondary" onClick={onSurvey}>
            설문 화면 보기
            <Eye size={16} />
          </button>
          <button type="button" className="primary" onClick={onAnalytics}>
            응답 받기 시작
            <ArrowRight size={16} />
          </button>
        </div>
        <button type="button" className="home-text-button" onClick={onHome}>
          홈으로 돌아가기
        </button>
      </div>
    </main>
  );
}

function SurveyView({
  survey,
  onBack,
}: {
  survey: PublicSurvey;
  onBack: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number | string | string[]>>(
    {},
  );
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);
  const questions = survey.questions ?? [];

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const toggleChoice = (questionId: number, choice: string) => {
    const current = Array.isArray(answers[questionId])
      ? (answers[questionId] as string[])
      : [];
    setAnswers({
      ...answers,
      [questionId]: current.includes(choice)
        ? current.filter((item) => item !== choice)
        : [...current, choice],
    });
  };

  const submitResponse = async () => {
    const missing = questions.find((question) => {
      if (!question.required) return false;
      const answer = answers[question.id];
      return (
        answer === undefined ||
        answer === "" ||
        (Array.isArray(answer) && answer.length === 0)
      );
    });
    if (missing) {
      setError(`필수 질문 “${missing.title}”에 응답해주세요.`);
      document
        .getElementById(`question-${missing.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/surveys/${survey.slug}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((question) => ({
            questionId: question.id,
            title: question.title,
            type: question.type,
            value: answers[question.id] ?? "",
          })),
          completionSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "응답을 저장하지 못했어요.");
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "응답을 저장하지 못했어요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="respondent-page submitted-page">
        <div className="submission-card">
          <span className="success-check">
            <Check size={27} />
          </span>
          <span className="eyebrow">응답 완료</span>
          <h1>소중한 의견을 보내주셔서 감사해요.</h1>
          <p>
            응답은 익명으로 안전하게 저장됐어요. 설문 게시자가 정한
            목적에 맞게 결과에 반영됩니다.
          </p>
          <div className="reward-result completion-info">
            <CheckCircle2 size={20} />
            <span>
              <small>제출 상태</small>
              <strong>정상적으로 저장됐어요</strong>
            </span>
          </div>
          <button type="button" onClick={onBack}>
            다른 학교 설문 보기
            <ArrowRight size={16} />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="respondent-page">
      <div className="respondent-header">
        <button type="button" onClick={onBack} aria-label="홈으로">
          <BrandMark compact />
          <strong>바로폼</strong>
        </button>
        <span>
          <Check size={13} />
          로그인 없이 참여 중
        </span>
      </div>
      <div className="respondent-shell">
        <div className="reward-banner">
          <span className="reward-circle">
            <CheckCircle2 size={19} />
          </span>
          <div>
            <small>공개 설문</small>
            <strong>{survey.ownerName || "게시자 이름 미표시"}</strong>
          </div>
          <span className="reward-time">
            <Clock3 size={14} />
            약 {survey.durationMinutes}분
          </span>
        </div>

        <section className="survey-cover">
          <span className="tiny-brand">BAROFORM</span>
          <h1>{survey.title}</h1>
          <p>{survey.description}</p>
          <div className="survey-meta-pills">
            <span>익명 응답</span>
            <span>약 {survey.durationMinutes}분</span>
          </div>
        </section>

        {questions.map((question, index) => (
          <section
            className="respond-question"
            id={`question-${question.id}`}
            key={question.id}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>
              {question.title}
              {question.required && <em>*</em>}
            </h2>
            {question.type === "scale" && (
              <div className="respond-scale">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={answers[question.id] === value ? "selected" : ""}
                    onClick={() =>
                      setAnswers({ ...answers, [question.id]: value })
                    }
                  >
                    {value}
                  </button>
                ))}
                <div>
                  <span>전혀 그렇지 않음</span>
                  <span>매우 그러함</span>
                </div>
              </div>
            )}
            {(question.type === "single" ||
              question.type === "multiple") && (
              <>
                <p className="question-caption">
                  {question.type === "single"
                    ? "하나만 선택해주세요."
                    : "복수 선택이 가능해요."}
                </p>
                <div className="respond-choices">
                  {(question.options ?? []).map((choice) => {
                    const selected =
                      question.type === "single"
                        ? answers[question.id] === choice
                        : Array.isArray(answers[question.id])
                          ? (answers[question.id] as string[]).includes(choice)
                          : false;
                    return (
                      <button
                        type="button"
                        key={choice}
                        className={selected ? "selected" : ""}
                        onClick={() =>
                          question.type === "single"
                            ? setAnswers({
                                ...answers,
                                [question.id]: choice,
                              })
                            : toggleChoice(question.id, choice)
                        }
                      >
                        <span>{selected && <Check size={14} />}</span>
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {question.type === "text" && (
              <textarea
                rows={5}
                value={
                  typeof answers[question.id] === "string"
                    ? (answers[question.id] as string)
                    : ""
                }
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    [question.id]: event.target.value,
                  })
                }
                placeholder="솔직한 의견을 들려주세요."
                maxLength={4000}
              />
            )}
          </section>
        ))}

        {error && (
          <p className="response-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="respond-submit"
          disabled={submitting || questions.length === 0}
          onClick={submitResponse}
        >
          {submitting ? "응답 저장 중…" : "응답 제출하기"}
          {!submitting && <ArrowRight size={17} />}
        </button>
        <p className="privacy-note">
          응답 내용은 설문 결과를 위해서만 저장되며 공개 목록에 노출되지
          않아요.
        </p>
      </div>
    </main>
  );
}

/*
Kept as a visual reference while the live dashboard below uses only persisted responses.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AnalyticsView({
  survey,
  manageToken,
  onHome,
  onCreate,
}: {
  survey: PublicSurvey | null;
  manageToken: string;
  onHome: () => void;
  onCreate: () => void;
}) {
  const [tab, setTab] = useState("한눈에 보기");
  const [responses, setResponses] = useState<StoredResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!survey?.slug || !manageToken) {
      setResponses([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/surveys/${encodeURIComponent(survey.slug)}/responses`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "x-baroform-manage-token": manageToken },
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          responses?: StoredResponse[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "응답 결과를 불러오지 못했어요.");
        }
        setResponses(result.responses ?? []);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "응답 결과를 불러오지 못했어요.",
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [manageToken, survey?.slug]);

  const questionSummaries = useMemo<QuestionSummary[]>(() => {
    const questions = survey?.questions ?? [];
    return questions.map((question) => {
      const values = responses
        .map(
          (response) =>
            response.answers.find(
              (answer) => answer.questionId === question.id,
            )?.value,
        )
        .filter(
          (value): value is number | string | string[] =>
            value !== undefined &&
            value !== "" &&
            (!Array.isArray(value) || value.length > 0),
        );

      if (question.type === "scale") {
        const numbers = values.filter(
          (value): value is number => typeof value === "number",
        );
        const average =
          numbers.length > 0
            ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
            : 0;
        return {
          id: question.id,
          title: question.title,
          type: question.type,
          responseCount: numbers.length,
          headline: numbers.length > 0 ? `${average.toFixed(1)} / 5` : "응답 대기 중",
          percentage: Math.round((average / 5) * 100),
          bars: [1, 2, 3, 4, 5].map((score) => {
            const count = numbers.filter((value) => value === score).length;
            return {
              label: `${score}점`,
              count,
              percentage:
                numbers.length > 0 ? Math.round((count / numbers.length) * 100) : 0,
            };
          }),
        };
      }

      if (question.type === "multiple") {
        const choices = values.flatMap((value) =>
          Array.isArray(value) ? value : [],
        );
        const optionCounts = (question.options ?? []).map((option) => ({
          label: option,
          count: choices.filter((choice) => choice === option).length,
          percentage:
            values.length > 0
              ? Math.round(
                  (choices.filter((choice) => choice === option).length /
                    values.length) *
                    100,
                )
              : 0,
        }));
        const top = [...optionCounts].sort((a, b) => b.count - a.count)[0];
        return {
          id: question.id,
          title: question.title,
          type: question.type,
          responseCount: values.length,
          headline:
            top && top.count > 0
              ? `${top.label} ${top.percentage}%`
              : "응답 대기 중",
          percentage: top?.percentage ?? 0,
          bars: optionCounts,
        };
      }

      return {
        id: question.id,
        title: question.title,
        type: question.type,
        responseCount: values.length,
        headline:
          values.length > 0 ? `서술형 응답 ${values.length}개` : "응답 대기 중",
        percentage: 0,
        bars: [],
      };
    });
  }, [responses, survey?.questions]);

  const averageSeconds =
    responses.length > 0
      ? Math.round(
          responses.reduce(
            (sum, response) => sum + response.completionSeconds,
            0,
          ) / responses.length,
        )
      : 0;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder > 0 ? `${minutes}분 ${remainder}초` : `${minutes}분`;
  };

  const parseStoredDate = (value: string) => {
    const normalized = value.includes("T")
      ? value
      : `${value.replace(" ", "T")}Z`;
    return new Date(normalized);
  };

  const formatResponseDate = (value: string) => {
    const date = parseStoredDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const trend = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const count = responses.filter((response) => {
        const createdAt = parseStoredDate(response.createdAt);
        return createdAt >= date && createdAt < next;
      }).length;
      return { label: formatter.format(date), count };
    });
  }, [responses]);

  const maxTrend = Math.max(...trend.map((item) => item.count), 1);

  const copySurveyLink = async () => {
    if (!survey) return;
    const url = `${window.location.origin}/?survey=${survey.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("브라우저에서 링크를 복사하지 못했어요.");
    }
  };

  const downloadCsv = () => {
    if (!survey || responses.length === 0) return;
    const questions = survey.questions ?? [];
    const escapeCell = (value: unknown) => {
      const text = Array.isArray(value) ? value.join(" · ") : String(value ?? "");
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["응답 ID", "응답 시간", "소요 시간(초)", ...questions.map((q) => q.title)],
      ...responses.map((response) => [
        response.id,
        response.createdAt,
        response.completionSeconds,
        ...questions.map(
          (question) =>
            response.answers.find(
              (answer) => answer.questionId === question.id,
            )?.value ?? "",
        ),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${survey.title}-응답.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!survey) {
    return (
      <main className="analytics-page">
        <div className="analytics-topbar">
          <button type="button" className="brand" onClick={onHome}>
            <BrandMark />
            <strong>바로폼</strong>
          </button>
        </div>
        <div className="analytics-empty-wrap">
          <div className="analytics-empty-card">
            <span>
              <BarChart3 size={25} />
            </span>
            <h1>분석할 설문이 아직 없어요.</h1>
            <p>설문을 배포하고 응답이 들어오면 실제 결과가 여기에 표시돼요.</p>
            <button type="button" onClick={onCreate}>
              내 설문 만들기
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="analytics-page">
      <div className="analytics-topbar">
        <button type="button" className="brand" onClick={onHome}>
          <BrandMark />
          <strong>바로폼</strong>
        </button>
        <div className="analytics-survey-select">
          <span>신촌캠 학생 식당 만족도 조사</span>
          <ChevronDown size={15} />
        </div>
        <button type="button" className="share-results">
          <Share2 size={15} />
          결과 공유
        </button>
      </div>
      <div className="analytics-shell">
        <div className="analytics-heading">
          <div>
            <span className="eyebrow">RESULTS</span>
            <h1>응답에서 답을 찾았어요.</h1>
            <p>목적에 가장 가까운 결과부터 자동으로 정리했어요.</p>
          </div>
          <span className="live-state">
            <i />
            실시간 업데이트
          </span>
        </div>
        <div className="metric-grid">
          <div className="metric-card dark">
            <span>유효 응답 / 목표 응답</span>
            <strong>
              247<small>/300</small>
            </strong>
            <div className="metric-track">
              <span />
            </div>
            <p>목표까지 53개 남았어요</p>
          </div>
          <div className="metric-card">
            <span>전체 응답</span>
            <strong>253</strong>
            <p className="positive">
              <TrendingUp size={14} />
              어제보다 48개 증가
            </p>
          </div>
          <div className="metric-card">
            <span>마지막 응답</span>
            <strong className="time-metric">3분 전</strong>
            <p>오늘 14:32</p>
          </div>
          <button type="button" className="metric-card metric-action">
            <span>결과 내보내기</span>
            <strong>응답 원본 파일</strong>
            <Download size={18} />
          </button>
        </div>
        <div className="analytics-tabs" role="tablist">
          {["한눈에 보기", "문항별 결과", "응답 관리"].map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? "active" : ""}
              key={item}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "한눈에 보기" && (
          <div className="analytics-dashboard">
            <section className="satisfaction-card">
              <div className="card-title">
                <span>가장 중요한 결과</span>
                <h2>학교생활 만족도</h2>
              </div>
              <div className="satisfaction-content">
                <div className="donut">
                  <div>
                    <strong>72%</strong>
                    <span>긍정 응답</span>
                  </div>
                </div>
                <div>
                  <strong>10명 중 7명은 현재 경험에 만족해요.</strong>
                  <p>
                    특히 2학년의 긍정 응답이 가장 높았고, 1학년은 시설
                    개선을 더 많이 요청했어요.
                  </p>
                  <div className="legend">
                    <span>
                      <i className="positive-dot" /> 긍정 72%
                    </span>
                    <span>
                      <i className="neutral-dot" /> 보통 18%
                    </span>
                    <span>
                      <i className="negative-dot" /> 부정 10%
                    </span>
                  </div>
                </div>
              </div>
            </section>
            <section className="insight-card">
              <div className="card-title horizontal">
                <div>
                  <span>AI가 찾은 핵심</span>
                  <h2>결과 요약</h2>
                </div>
                <Sparkles size={18} />
              </div>
              <ol>
                <li>
                  <span>01</span>
                  <p>
                    <strong>교우 관계</strong>가 전체 만족도를 가장 크게
                    설명하고 있어요.
                  </p>
                </li>
                <li>
                  <span>02</span>
                  <p>
                    <strong>학교 시설</strong> 개선 요구는 1학년에서 두 배
                    높았어요.
                  </p>
                </li>
                <li>
                  <span>03</span>
                  <p>
                    응답자의 63%가 <strong>야간 열람 공간</strong> 확대를
                    원해요.
                  </p>
                </li>
              </ol>
            </section>
            <section className="bar-card">
              <div className="card-title horizontal">
                <div>
                  <span>만족한 경험</span>
                  <h2>어떤 경험이 만족도를 만들었나요?</h2>
                </div>
                <button type="button">
                  문항 상세
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="horizontal-bars">
                {[
                  ["교우 관계", 78],
                  ["수업 및 학습", 67],
                  ["동아리 활동", 54],
                  ["학교 시설", 41],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <i>
                      <b style={{ width: `${value}%` }} />
                    </i>
                    <strong>{value}%</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="response-trend-card">
              <div className="card-title">
                <span>응답 추이</span>
                <h2>최근 7일</h2>
              </div>
              <div className="mini-chart">
                {[31, 47, 38, 69, 58, 82, 72].map((value, index) => (
                  <i key={index}>
                    <b style={{ height: `${value}%` }} />
                    <span>{["목", "금", "토", "일", "월", "화", "수"][index]}</span>
                  </i>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "문항별 결과" && (
          <div className="question-results-list">
            {[
              ["01", "현재 학교생활에 전반적으로 얼마나 만족하시나요?", "4.1 / 5"],
              ["02", "학교생활에서 가장 만족하는 부분은 무엇인가요?", "교우 관계 78%"],
              ["03", "가장 먼저 개선되었으면 하는 점은 무엇인가요?", "시설 개선 41%"],
            ].map(([number, question, result]) => (
              <article key={number}>
                <span>{number}</span>
                <div>
                  <h2>{question}</h2>
                  <div className="result-bar">
                    <i>
                      <b style={{ width: number === "01" ? "82%" : "68%" }} />
                    </i>
                    <strong>{result}</strong>
                  </div>
                </div>
                <ChevronRight size={18} />
              </article>
            ))}
          </div>
        )}

        {tab === "응답 관리" && (
          <div className="response-table-card">
            <div className="response-table-header">
              <div>
                <h2>개별 응답</h2>
                <p>중복·불성실 응답을 확인하고 관리할 수 있어요.</p>
              </div>
              <button type="button">
                <Download size={15} />
                CSV 내보내기
              </button>
            </div>
            <div className="response-table">
              <div className="response-row table-head">
                <span>응답 ID</span>
                <span>응답 시간</span>
                <span>소요 시간</span>
                <span>상태</span>
              </div>
              {responseRows.map((row) => (
                <div className="response-row" key={row[0]}>
                  {row.map((cell, index) => (
                    <span key={cell} className={index === 3 ? "status-cell" : ""}>
                      {cell}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
*/

function RealAnalyticsView({
  onHome,
  title,
  slug,
  manageToken,
  questions,
}: {
  onHome: () => void;
  title: string;
  slug: string;
  manageToken: string;
  questions: Question[];
}) {
  const [responses, setResponses] = useState<StoredResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(slug && manageToken));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug || !manageToken) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `/api/surveys/${encodeURIComponent(slug)}/responses`,
          {
            cache: "no-store",
            headers: { "x-baroform-manage-token": manageToken },
          },
        );
        const result = (await response.json()) as {
          responses?: StoredResponse[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "결과를 불러오지 못했어요.");
        }
        if (!cancelled) setResponses(result.responses ?? []);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "결과를 불러오지 못했어요.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, manageToken]);

  const averageSeconds =
    responses.length > 0
      ? Math.round(
          responses.reduce(
            (total, response) => total + response.completionSeconds,
            0,
          ) / responses.length,
        )
      : 0;
  const lastResponse = responses[0]?.createdAt
    ? new Date(responses[0].createdAt).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "아직 없음";

  const questionSummaries = questions.map((question) => {
    const values = responses
      .map(
        (response) =>
          response.answers.find(
            (answer) => answer.questionId === question.id,
          )?.value,
      )
      .filter((value) => value !== undefined && value !== "");

    if (question.type === "scale") {
      const numbers = values.filter(
        (value): value is number => typeof value === "number",
      );
      const average =
        numbers.length > 0
          ? numbers.reduce((total, value) => total + value, 0) / numbers.length
          : 0;
      return {
        question,
        label: numbers.length > 0 ? `평균 ${average.toFixed(1)} / 5` : "응답 없음",
        percentage: numbers.length > 0 ? (average / 5) * 100 : 0,
      };
    }

    if (question.type === "single" || question.type === "multiple") {
      const counts = new Map<string, number>();
      values.forEach((value) => {
        if (typeof value === "string") {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        } else if (Array.isArray(value)) {
          value.forEach((choice) =>
            counts.set(choice, (counts.get(choice) ?? 0) + 1),
          );
        }
      });
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        question,
        label: top ? `${top[0]} · ${top[1]}명` : "응답 없음",
        percentage:
          top && responses.length > 0 ? (top[1] / responses.length) * 100 : 0,
      };
    }

    return {
      question,
      label: values.length > 0 ? `주관식 ${values.length}개` : "응답 없음",
      percentage:
        responses.length > 0 ? (values.length / responses.length) * 100 : 0,
    };
  });

  return (
    <main className="analytics-page">
      <div className="analytics-topbar">
        <button type="button" className="brand" onClick={onHome}>
          <BrandMark />
          <strong>바로폼</strong>
        </button>
        <div className="analytics-survey-select">
          <span>{title || "분석할 설문을 선택해주세요"}</span>
        </div>
        <button type="button" className="share-results" onClick={onHome}>
          홈으로
        </button>
      </div>
      <div className="analytics-shell">
        <div className="analytics-heading">
          <div>
            <span className="eyebrow">LIVE RESULTS</span>
            <h1>{title ? `${title} 결과` : "아직 분석할 설문이 없어요."}</h1>
            <p>
              {title
                ? "실제로 제출된 응답만 집계해 보여드려요."
                : "설문을 만들고 배포하면 실제 응답 결과가 이곳에 나타나요."}
            </p>
          </div>
          {title && (
            <span className="live-state">
              <i />
              실제 저장 데이터
            </span>
          )}
        </div>

        {!slug || !manageToken ? (
          <div className="analytics-empty">
            <span>
              <BarChart3 size={28} />
            </span>
            <strong>관리 중인 설문이 없어요.</strong>
            <p>먼저 설문을 만든 뒤 공개 링크를 생성해주세요.</p>
            <button type="button" onClick={onHome}>
              설문 만들러 가기
              <ArrowRight size={15} />
            </button>
          </div>
        ) : loading ? (
          <div className="analytics-empty">
            <span className="loading-symbol">
              <BarChart3 size={28} />
            </span>
            <strong>실제 응답을 불러오고 있어요.</strong>
          </div>
        ) : error ? (
          <div className="analytics-empty">
            <span>
              <CircleHelp size={28} />
            </span>
            <strong>결과를 불러오지 못했어요.</strong>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="metric-grid real-metrics">
              <div className="metric-card dark">
                <span>저장된 전체 응답</span>
                <strong>{responses.length}</strong>
                <p>실제 제출 완료 기준</p>
              </div>
              <div className="metric-card">
                <span>평균 응답 시간</span>
                <strong className="time-metric">
                  {averageSeconds > 0 ? `${averageSeconds}초` : "—"}
                </strong>
                <p>제출까지 걸린 시간</p>
              </div>
              <div className="metric-card">
                <span>마지막 응답</span>
                <strong className="time-metric">{lastResponse}</strong>
                <p>실시간 저장 기준</p>
              </div>
            </div>

            {responses.length === 0 ? (
              <div className="analytics-empty response-empty">
                <span>
                  <UsersRound size={28} />
                </span>
                <strong>아직 도착한 응답이 없어요.</strong>
                <p>
                  공개 링크를 공유하면 첫 응답부터 이 화면에 바로 집계돼요.
                </p>
              </div>
            ) : (
              <div className="real-results-grid">
                <section className="question-results-live">
                  <div className="card-title">
                    <span>문항별 실제 결과</span>
                    <h2>총 {responses.length}개의 응답을 반영했어요</h2>
                  </div>
                  <div className="live-summary-list">
                    {questionSummaries.map((summary, index) => (
                      <article key={summary.question.id}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <strong>{summary.question.title}</strong>
                          <i>
                            <b
                              style={{
                                width: `${Math.min(100, summary.percentage)}%`,
                              }}
                            />
                          </i>
                        </div>
                        <em>{summary.label}</em>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="recent-responses-live">
                  <div className="card-title">
                    <span>최근 응답</span>
                    <h2>개별 제출 기록</h2>
                  </div>
                  <div>
                    {responses.slice(0, 8).map((response, index) => (
                      <article key={response.id}>
                        <span>#{String(responses.length - index).padStart(3, "0")}</span>
                        <strong>
                          {new Date(response.createdAt).toLocaleString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </strong>
                        <small>{response.completionSeconds || 0}초</small>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <span className="footer-brand">
          <BrandMark compact />
          <strong>바로폼</strong>
        </span>
        <p>학교의 생각을 가장 빠르게 만나는 곳.</p>
      </div>
      <span>© 2026 BAROFORM</span>
    </footer>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [prompt, setPrompt] = useState("");
  const [surveyTitle, setSurveyTitle] = useState(defaultBlueprint.title);
  const [description, setDescription] = useState(
    defaultBlueprint.description,
  );
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [publicSurveys, setPublicSurveys] = useState<PublicSurvey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [activeSurvey, setActiveSurvey] = useState<PublicSurvey | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedDraft, setAnalyzedDraft] = useState<AnalyzedDraft | null>(null);
  const [clarification, setClarification] =
    useState<ClarificationState | null>(null);
  const analysisRequestRef = useRef(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishedSlug, setPublishedSlug] = useState("");
  const [manageToken, setManageToken] = useState("");
  const [publishedListingRequested, setPublishedListingRequested] =
    useState(false);
  const [toast, setToast] = useState("");
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();
  const promptBlueprint = useMemo(() => {
    if (analyzedDraft?.prompt === normalizedPrompt) {
      return analyzedDraft.blueprint;
    }
    return analyzeSurveyPrompt(normalizedPrompt || promptSuggestions[0]);
  }, [analyzedDraft, normalizedPrompt]);
  const promptResearch: SurveyResearch =
    analyzedDraft?.prompt === normalizedPrompt
      ? analyzedDraft.research
      : {
          status: "not-needed",
          entity: null,
          summary: "응답 대상과 평가 경험을 분리해 문항을 구성했어요.",
          facts: [],
          sources: [],
        };

  const loadSurvey = async (slug: string) => {
    const response = await fetch(`/api/surveys/${slug}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as {
      survey?: PublicSurvey;
      error?: string;
    };
    if (!response.ok || !result.survey) {
      throw new Error(result.error || "공개된 설문을 찾을 수 없어요.");
    }
    setActiveSurvey(result.survey);
    setView("survey");
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    let cancelled = false;

    try {
      const stored = window.localStorage.getItem(managedSurveyStorageKey);
      if (stored) {
        const snapshot = JSON.parse(stored) as Partial<ManagedSurveySnapshot>;
        if (
          typeof snapshot.slug === "string" &&
          /^[a-f0-9]{12}$/.test(snapshot.slug) &&
          typeof snapshot.manageToken === "string" &&
          /^[a-f0-9]{32}$/.test(snapshot.manageToken) &&
          typeof snapshot.title === "string" &&
          Array.isArray(snapshot.questions)
        ) {
          window.queueMicrotask(() => {
            if (cancelled) return;
            setPublishedSlug(snapshot.slug as string);
            setManageToken(snapshot.manageToken as string);
            setSurveyTitle((snapshot.title as string).slice(0, 100));
            setQuestions((snapshot.questions as Question[]).slice(0, 30));
          });
        }
      }
    } catch {
      window.localStorage.removeItem(managedSurveyStorageKey);
    }

    fetch("/api/surveys", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          surveys?: PublicSurvey[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error);
        return result.surveys ?? [];
      })
      .then((surveys) => {
        if (!cancelled) setPublicSurveys(surveys);
      })
      .catch(() => {
        if (!cancelled) setPublicSurveys([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSurveys(false);
      });

    const directSlug = new URLSearchParams(window.location.search).get("survey");
    if (directSlug) {
      fetch(`/api/surveys/${directSlug}`, { cache: "no-store" })
        .then(async (response) => {
          const result = (await response.json()) as {
            survey?: PublicSurvey;
            error?: string;
          };
          if (!response.ok || !result.survey) {
            throw new Error(result.error || "공개된 설문을 찾을 수 없어요.");
          }
          return result.survey;
        })
        .then((survey) => {
          if (!cancelled) {
            setActiveSurvey(survey);
            setView("survey");
            window.scrollTo({ top: 0 });
          }
        })
        .catch((loadError) => {
          if (!cancelled) {
            setToast(
              loadError instanceof Error
                ? loadError.message
                : "설문을 불러오지 못했어요.",
            );
            window.setTimeout(() => setToast(""), 2400);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const navigate = (nextView: View) => {
    setView(nextView);
    if (nextView !== "survey" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updatePrompt = (value: string) => {
    analysisRequestRef.current += 1;
    setPrompt(value);
    setAnalyzedDraft(null);
    setClarification(null);
    setIsAnalyzing(false);
  };

  const startCreate = async (promptOverride?: string) => {
    const requestedPrompt = (promptOverride ?? prompt)
      .replace(/\s+/g, " ")
      .trim();
    if (!requestedPrompt) {
      setToast("만들고 싶은 설문을 한 문장으로 적어주세요.");
      window.setTimeout(() => setToast(""), 2200);
      document.getElementById("survey-maker")?.focus();
      return;
    }
    if (requestedPrompt.length > 300) {
      setToast("설문 내용은 300자 이하로 적어주세요.");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }

    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;
    setIsAnalyzing(true);
    setClarification(null);

    try {
      const response = await fetch("/api/survey-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: requestedPrompt }),
      });
      const result = (await response.json()) as
        | {
            status: "ready";
            prompt: string;
            blueprint: SurveyBlueprint;
            research: SurveyResearch;
          }
        | {
            status: "needs_clarification";
            prompt: string;
            clarification: SurveyClarification;
            research: SurveyResearch;
          }
        | { error?: string; code?: string };

      if (analysisRequestRef.current !== requestId) return;
      if (!response.ok || !("status" in result)) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "AI 초안을 만들지 못했어요.",
        );
      }

      if (result.status === "needs_clarification") {
        setClarification({
          prompt: requestedPrompt,
          clarification: result.clarification,
          research: result.research,
        });
        return;
      }

      setAnalyzedDraft({
        prompt: requestedPrompt,
        blueprint: result.blueprint,
        research: result.research,
      });
      if (prompt !== requestedPrompt) setPrompt(requestedPrompt);
      navigate("choose");
    } catch (analysisError) {
      if (analysisRequestRef.current !== requestId) return;
      setToast(
        analysisError instanceof Error
          ? analysisError.message
          : "정보조사를 완료하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      window.setTimeout(() => setToast(""), 5200);
    } finally {
      if (analysisRequestRef.current === requestId) setIsAnalyzing(false);
    }
  };

  const chooseMode = (mode: "template" | "ai") => {
    const blueprint = promptBlueprint;
    setSurveyTitle(blueprint.title);
    setDescription(blueprint.description);

    if (mode === "ai") {
      setQuestions(blueprint.aiQuestions);
      navigate("editor");
      return;
    }
    setQuestions(blueprint.templateQuestions);
    navigate("editor");
  };

  const openSurvey = async (survey: PublicSurvey) => {
    setToast("설문을 불러오고 있어요.");
    try {
      await loadSurvey(survey.slug);
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?survey=${survey.slug}`,
      );
      setToast("");
    } catch (loadError) {
      setToast(
        loadError instanceof Error
          ? loadError.message
          : "설문을 불러오지 못했어요.",
      );
      window.setTimeout(() => setToast(""), 2400);
    }
  };

  const publishSurvey = async (
    ownerName: string,
    listingRequested: boolean,
  ) => {
    setPublishing(true);
    setPublishError("");
    try {
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: surveyTitle,
          description,
          ownerName,
          questions,
          listingRequested,
        }),
      });
      const result = (await response.json()) as {
        survey?: {
          slug: string;
          title: string;
          description: string;
          ownerName: string;
          durationMinutes: number;
          listingRequested: boolean;
          manageToken: string;
        };
        error?: string;
      };
      if (!response.ok || !result.survey) {
        throw new Error(result.error || "공개 링크를 만들지 못했어요.");
      }
      const savedSurvey: PublicSurvey = {
        slug: result.survey.slug,
        title: result.survey.title,
        description: result.survey.description,
        ownerName: result.survey.ownerName,
        campus: "연세대학교 신촌캠퍼스",
        durationMinutes: result.survey.durationMinutes,
        questions,
      };
      setActiveSurvey(savedSurvey);
      setPublishedSlug(result.survey.slug);
      setManageToken(result.survey.manageToken);
      setPublishedListingRequested(result.survey.listingRequested);
      window.localStorage.setItem(
        managedSurveyStorageKey,
        JSON.stringify({
          slug: result.survey.slug,
          manageToken: result.survey.manageToken,
          title: result.survey.title,
          questions,
        } satisfies ManagedSurveySnapshot),
      );
      setPublishOpen(false);
      navigate("published");
    } catch (saveError) {
      setPublishError(
        saveError instanceof Error
          ? saveError.message
          : "공개 링크를 만들지 못했어요.",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="app-shell">
      {view === "home" && (
        <>
          <Header view={view} onNavigate={navigate} />
          <HomeView
            prompt={prompt}
            setPrompt={updatePrompt}
            onCreate={() => void startCreate()}
            onOpenSurvey={openSurvey}
            surveys={publicSurveys}
            loadingSurveys={loadingSurveys}
            isAnalyzing={isAnalyzing}
          />
        </>
      )}
      {view === "choose" && (
        <>
          <Header view={view} onNavigate={navigate} />
          <ChooseView
            prompt={prompt}
            blueprint={promptBlueprint}
            research={promptResearch}
            onBack={() => navigate("home")}
            onSelect={chooseMode}
          />
        </>
      )}
      {view === "editor" && (
        <EditorView
          title={surveyTitle}
          setTitle={setSurveyTitle}
          description={description}
          setDescription={setDescription}
          questions={questions}
          setQuestions={setQuestions}
          onBack={() => navigate("choose")}
          onPublish={() => setPublishOpen(true)}
        />
      )}
      {view === "published" && (
        <PublishedView
          title={surveyTitle}
          slug={publishedSlug}
          listingRequested={publishedListingRequested}
          onSurvey={() => navigate("survey")}
          onAnalytics={() => navigate("analytics")}
          onHome={() => navigate("home")}
        />
      )}
      {view === "survey" && activeSurvey && (
        <SurveyView survey={activeSurvey} onBack={() => navigate("home")} />
      )}
      {view === "analytics" && (
        <RealAnalyticsView
          onHome={() => navigate("home")}
          title={publishedSlug ? surveyTitle : ""}
          slug={publishedSlug}
          manageToken={manageToken}
          questions={publishedSlug ? questions : []}
        />
      )}
      {publishOpen && (
        <PublishModal
          title={surveyTitle}
          onClose={() => setPublishOpen(false)}
          onConfirm={publishSurvey}
          saving={publishing}
          error={publishError}
        />
      )}
      {isAnalyzing && (
        <div className="generation-overlay" role="status" aria-live="polite">
          <div className="generation-card research-loading-card">
            <span className="generation-orbit">
              <Search size={24} />
            </span>
            <strong>입력한 내용을 정확히 이해하고 있어요</strong>
            <p>
              모든 주제를 공개 자료에서 먼저 조사하고, 응답 대상과 평가
              경험을 나눈 뒤 질문과 선택지를 구성해요.
            </p>
            <div className="research-loading-steps" aria-hidden>
              <span>문맥 분석</span>
              <span>자료 확인</span>
              <span>문항 설계</span>
            </div>
            <div className="loading-line">
              <span />
            </div>
          </div>
        </div>
      )}
      {clarification && !isAnalyzing && (
        <ClarificationModal
          state={clarification}
          onClose={() => {
            setClarification(null);
            window.setTimeout(
              () => document.getElementById("survey-maker")?.focus(),
              80,
            );
          }}
          onChoose={(option) => {
            const nextPrompt = `${clarification.prompt} — 추가 설명: ${option}`;
            setPrompt(nextPrompt);
            setClarification(null);
            void startCreate(nextPrompt);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CircleHelp size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
