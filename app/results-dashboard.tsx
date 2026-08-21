"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  ListFilter,
  Share2,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { surveySharePath } from "./survey-share";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SurveyQuestion } from "./survey-intent";

export type ResultsStoredAnswer = {
  questionId: number;
  title: string;
  type: SurveyQuestion["type"];
  value: number | string | string[];
};

export type ResultsStoredResponse = {
  id: string;
  answers: ResultsStoredAnswer[];
  completionSeconds: number;
  createdAt: string;
  quality?: {
    score: number;
    status: "usable" | "review" | "exclude";
    reasons: string[];
  };
};

export type ResultExportFormat = "excel" | "word" | "csv";
export type ResultsLoadState = "missing" | "loading" | "error" | "ready";

type ResultsTab = "overview" | "questions" | "responses" | "quality";
type QualityStatus = "usable" | "review" | "exclude";

type QuestionResult = {
  question: SurveyQuestion;
  answeredCount: number;
  unansweredCount: number;
  choices: Array<{
    label: string;
    count: number;
    percentage: number;
    cumulativePercentage: number;
  }>;
  /** 표시 순서와 무관하게 가장 많이 선택된 항목. 요약 문구에서 쓴다. */
  topChoice: { label: string; count: number; percentage: number } | null;
  /** 작성자가 선택지 순서를 정한 문항인지. 정렬하지 않고 그 순서를 지킨다. */
  hasAuthoredOrder: boolean;
  scaleValues: Array<{ value: number; count: number; percentage: number }>;
  average: number | null;
  textResponses: string[];
};

export const LOW_SAMPLE_THRESHOLD = 5;
const overviewQuestionLimit = 4;
const recentResponseLimit = 5;
const resultTabs: Array<{ id: ResultsTab; label: string }> = [
  { id: "overview", label: "개요" },
  { id: "questions", label: "문항별 결과" },
  { id: "responses", label: "개별 응답" },
  { id: "quality", label: "응답 품질" },
];

const responseDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const questionTypeLabels: Record<SurveyQuestion["type"], string> = {
  scale: "척도형",
  single: "단일 선택",
  multiple: "다중 선택",
  dropdown: "드롭다운",
  shortText: "단답형",
  text: "장문형",
  date: "날짜",
  time: "시간",
  section: "섹션",
};

function responseStatus(response: ResultsStoredResponse): QualityStatus {
  return response.quality?.status ?? "usable";
}

/** 설문 주인이 개별 응답에 내린 판단. 서버 품질 판정을 덮어쓴다. */
export type ResponseDecision = "include" | "exclude";
export type ResponseDecisionMap = Record<string, ResponseDecision>;

/**
 * 서버 판정 위에 사람 판단을 얹은 최종 상태.
 *
 * 사람이 include라고 했으면 서버가 exclude라 해도 집계에 넣는다. 그 반대도 같다.
 * 판단이 없으면 서버 판정을 그대로 쓴다.
 */
function effectiveStatus(
  response: ResultsStoredResponse,
  decisions: ResponseDecisionMap,
): QualityStatus {
  const decided = decisions[response.id];
  if (decided === "exclude") return "exclude";
  if (decided === "include") {
    const base = responseStatus(response);
    return base === "exclude" ? "usable" : base;
  }
  return responseStatus(response);
}
function qualityLabel(status: QualityStatus) {
  if (status === "review") return "검토 필요";
  if (status === "exclude") return "분석 제외";
  return "분석 반영";
}

function formatResponseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "제출 시각 미상"
    : responseDateFormatter.format(date);
}

function formatAnswerValue(value: ResultsStoredAnswer["value"]) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "응답 없음";
  if (value === "") return "응답 없음";
  return String(value);
}

function isAnswered(value: ResultsStoredAnswer["value"] | undefined) {
  if (value === undefined || value === "") return false;
  return !Array.isArray(value) || value.length > 0;
}

export function summarizeResponseQuality(responses: ResultsStoredResponse[]) {
  const usable = responses.filter((response) => responseStatus(response) === "usable").length;
  const review = responses.filter((response) => responseStatus(response) === "review").length;
  const excluded = responses.filter((response) => responseStatus(response) === "exclude").length;
  return {
    total: responses.length,
    usable,
    review,
    excluded,
    analysis: usable + review,
  };
}

export function buildQuestionResults(
  questions: SurveyQuestion[],
  responses: ResultsStoredResponse[],
) {
  return questions
    .filter((question) => question.type !== "section")
    .map<QuestionResult>((question) => {
      const values = responses
        .map(
          (response) =>
            response.answers.find((answer) => answer.questionId === question.id)
              ?.value,
        )
        .filter(isAnswered);
      const answeredCount = values.length;
      const optionCounts = new Map<string, number>();
      const textResponses: string[] = [];
      const scaleCounts = new Map<number, number>();

      if (
        question.type === "single" ||
        question.type === "multiple" ||
        question.type === "dropdown"
      ) {
        question.options?.forEach((option) => optionCounts.set(option, 0));
      }

      values.forEach((value) => {
        if (question.type === "scale" && typeof value === "number") {
          scaleCounts.set(value, (scaleCounts.get(value) ?? 0) + 1);
          return;
        }
        if (question.type === "multiple" && Array.isArray(value)) {
          value.forEach((option) =>
            optionCounts.set(option, (optionCounts.get(option) ?? 0) + 1),
          );
          return;
        }
        if (
          question.type === "single" ||
          question.type === "dropdown" ||
          question.type === "date" ||
          question.type === "time"
        ) {
          const label = String(value);
          optionCounts.set(label, (optionCounts.get(label) ?? 0) + 1);
          return;
        }
        if (typeof value === "string" && value.trim()) {
          textResponses.push(value.trim());
        }
      });

      // 작성자가 options로 순서를 정했다면 그 순서가 곧 의미다(1회차 → 2회차 → …).
      // 빈도순으로 다시 정렬하면 분포 모양이 사라지므로 선언 순서를 지킨다.
      // options에 없던 값(자유 입력·날짜 등)만 뒤에 붙이고 그것들끼리 빈도순으로 둔다.
      const authoredOptions = question.options ?? [];
      const hasAuthoredOrder = authoredOptions.length > 0;
      const authoredSet = new Set(authoredOptions);
      const rawCounts = [...optionCounts.entries()].map(([label, count]) => ({
        label,
        count,
        percentage: answeredCount > 0 ? (count / answeredCount) * 100 : 0,
      }));
      const byFrequency = (
        left: { label: string; count: number },
        right: { label: string; count: number },
      ) => right.count - left.count || left.label.localeCompare(right.label, "ko-KR");
      const ordered = hasAuthoredOrder
        ? [
            ...authoredOptions
              .map((option) => rawCounts.find((item) => item.label === option))
              .filter((item): item is (typeof rawCounts)[number] => Boolean(item)),
            ...rawCounts.filter((item) => !authoredSet.has(item.label)).sort(byFrequency),
          ]
        : [...rawCounts].sort(byFrequency);

      // 누적 비율은 순서가 의미 있는 단일 선택 문항에서만 쓴다.
      // 다중 선택은 합이 100%를 넘어 누적이 성립하지 않는다.
      let running = 0;
      const choices = ordered.map((item) => {
        running += item.percentage;
        return { ...item, cumulativePercentage: Math.min(100, running) };
      });
      const topChoice =
        rawCounts.length > 0
          ? [...rawCounts].sort(byFrequency)[0]
          : null;
      const scaleMin = question.scaleMin ?? 1;
      const scaleMax = question.scaleMax ?? 5;
      const scaleValues = Array.from(
        { length: Math.max(1, scaleMax - scaleMin + 1) },
        (_, index) => {
          const value = scaleMin + index;
          const count = scaleCounts.get(value) ?? 0;
          return {
            value,
            count,
            percentage: answeredCount > 0 ? (count / answeredCount) * 100 : 0,
          };
        },
      );
      const scaleTotal = [...scaleCounts.entries()].reduce(
        (total, [value, count]) => total + value * count,
        0,
      );

      return {
        question,
        answeredCount,
        unansweredCount: Math.max(0, responses.length - answeredCount),
        choices,
        topChoice,
        hasAuthoredOrder,
        scaleValues,
        average: answeredCount > 0 && question.type === "scale" ? scaleTotal / answeredCount : null,
        textResponses,
      };
    });
}

/**
 * 제출 건수를 이상 없음 / 검토 / 제외로 나눈 막대 하나.
 *
 * 이전에는 카드 4장(총 응답·분석 반영·검토 필요·분석 제외)이었는데,
 * 42 = 38 + 4 이면서 8은 38 안에 들어 있는 구조라 카드만 봐서는 산술이
 * 읽히지 않았다. 같은 다섯 숫자를 막대 하나로 표현하면 합이 눈에 보인다.
 */
function ResponseFlowBar({
  total,
  usable,
  review,
  excluded,
}: {
  total: number;
  usable: number;
  review: number;
  excluded: number;
}) {
  const analysed = usable + review;
  const segments = [
    { key: "usable", label: "이상 없음", count: usable, tone: "usable" },
    { key: "review", label: "검토", count: review, tone: "review" },
    { key: "excluded", label: "제외", count: excluded, tone: "exclude" },
  ].filter((segment) => segment.count > 0);

  return (
    <section className="results-v2-flow" aria-label="응답 품질 구성">
      <div className="results-v2-flow-head">
        <strong>
          제출 {total.toLocaleString("ko-KR")}건
        </strong>
        <span>
          {total > 0
            ? `이 중 ${analysed.toLocaleString("ko-KR")}건을 분석에 반영`
            : "아직 제출된 응답이 없어요."}
        </span>
      </div>
      {total > 0 && (
        <>
          <div className="results-v2-flow-bar" role="img"
            aria-label={`이상 없음 ${usable}건, 검토 ${review}건, 분석 제외 ${excluded}건`}>
            {segments.map((segment) => (
              <span
                key={segment.key}
                className={`results-v2-flow-seg is-${segment.tone}`}
                style={{ flexGrow: segment.count }}
              >
                {segment.label} {segment.count}
              </span>
            ))}
          </div>
          <ul className="results-v2-flow-legend">
            <li><i className="is-usable" />집계 포함</li>
            <li><i className="is-review" />집계 포함, 확인 권장</li>
            <li><i className="is-exclude" />집계 제외</li>
          </ul>
        </>
      )}
    </section>
  );
}
function LowSampleNotice({ responseCount }: { responseCount: number }) {
  if (responseCount >= LOW_SAMPLE_THRESHOLD) return null;
  return (
    <aside className="results-v2-sample-notice" aria-live="polite">
      <BarChart3 size={18} />
      <div>
        <strong>
          {responseCount === 0
            ? "아직 수집된 응답이 없어요."
            : `현재 응답이 ${responseCount.toLocaleString("ko-KR")}건이에요.`}
        </strong>
        <span>
          {responseCount === 0
            ? "설문 링크를 공유하면 결과가 여기에 표시됩니다."
            : "응답이 더 쌓이면 결과를 더 안정적으로 해석할 수 있어요."}
        </span>
      </div>
    </aside>
  );
}

function ResultsTabs({
  activeTab,
  onChange,
}: {
  activeTab: ResultsTab;
  onChange: (tab: ResultsTab) => void;
}) {
  return (
    <div className="results-v2-tabs-scroll">
      <div className="results-v2-tabs" role="tablist" aria-label="결과 화면">
        {resultTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`results-panel-${tab.id}`}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QualityBadge({ status }: { status: QualityStatus }) {
  return (
    <span className={`results-v2-quality-badge ${status}`}>
      {qualityLabel(status)}
    </span>
  );
}

function ChoiceDistribution({
  choices,
  showCumulative = false,
}: {
  choices: QuestionResult["choices"];
  /** 순서가 의미 있는 단일 선택 문항에서만 누적 비율을 붙인다. */
  showCumulative?: boolean;
}) {
  if (choices.length === 0) {
    return <p className="results-v2-inline-empty">아직 선택된 응답이 없어요.</p>;
  }
  // 선언 순서를 지키므로 choices[0]이 최다가 아니다. 실제 최댓값을 따로 구한다.
  const topCount = choices.reduce((max, choice) => Math.max(max, choice.count), 0);
  return (
    <div className="results-v2-choice-list">
      {choices.map((choice) => (
        <div className={choice.count === topCount && topCount > 0 ? "is-top" : ""} key={choice.label}>
          <div className="results-v2-choice-copy">
            <span>
              {choice.label}
              {choice.count === topCount && topCount > 0 && (
                <b className="results-v2-choice-top">가장 많음</b>
              )}
            </span>
            <strong>
              {choice.count.toLocaleString("ko-KR")}명 · {choice.percentage.toFixed(1)}%
              {showCumulative && (
                <small className="results-v2-choice-cumulative">
                  누적 {choice.cumulativePercentage.toFixed(1)}%
                </small>
              )}
            </strong>
          </div>
          <span className="results-v2-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, choice.percentage)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 순서가 정해진 선택형 문항을 세로 막대로 그린다.
 *
 * 가로 목록은 한 줄에 하나씩이라 분포 모양이 눈에 안 들어온다.
 * 세로로 세우면 어느 선택지로 몰렸는지가 한눈에 보인다.
 *
 * 선택지가 많거나 이름이 길어도 막대로 그린다. 라벨은 두 줄까지 접고,
 * 칸이 좁아지면 가로로 스크롤한다. 좁은 화면에서 8개를 억지로 우겨넣지 않기 위해서다.
 */
function ChoiceBarChart({
  choices,
}: {
  choices: QuestionResult["choices"];
}) {
  const top = choices.reduce((max, choice) => Math.max(max, choice.percentage), 0);
  return (
    <div className="results-v2-vbars-scroll">
      <div className="results-v2-vbars">
      {choices.map((choice) => {
        const isTop = top > 0 && choice.percentage === top;
        return (
          <div key={choice.label}>
            <span className="results-v2-vbar-value">{choice.percentage.toFixed(1)}%</span>
            <span className="results-v2-vbar-track">
              <i
                className={isTop ? "is-top" : ""}
                style={{ height: `${top > 0 ? Math.max(4, (choice.percentage / top) * 100) : 4}%` }}
              />
            </span>
            <span className="results-v2-vbar-label">{choice.label}</span>
            <span className="results-v2-vbar-count">
              {choice.count.toLocaleString("ko-KR")}명
            </span>
          </div>
        );
      })}
      </div>
    </div>
  );
}
function ScaleDistribution({ result }: { result: QuestionResult }) {
  if (result.average === null) {
    return <p className="results-v2-inline-empty">아직 척도 응답이 없어요.</p>;
  }
  const maxValue = result.question.scaleMax ?? 5;
  return (
    <div className="results-v2-scale-result">
      <div className="results-v2-scale-average">
        <span>평균 점수</span>
        <strong>{result.average.toFixed(1)}</strong>
        <small>/ {maxValue}</small>
      </div>
      <div className="results-v2-scale-bars" aria-label="점수별 응답 분포">
        {result.scaleValues.map((item) => (
          <div key={item.value}>
            <span className="results-v2-scale-track">
              <i style={{ height: `${Math.max(item.percentage, item.count > 0 ? 8 : 0)}%` }} />
            </span>
            <strong>{item.value}</strong>
            <small>{item.count}명</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextResponseList({ responses }: { responses: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (responses.length === 0) {
    return <p className="results-v2-inline-empty">아직 작성된 응답이 없어요.</p>;
  }
  const visible = expanded ? responses : responses.slice(0, 4);
  return (
    <div className="results-v2-text-responses">
      <div>
        {visible.map((response, index) => (
          <p key={`${index}-${response}`}>{response}</p>
        ))}
      </div>
      {responses.length > 4 && (
        <button type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "응답 접기" : `전체 응답 ${responses.length}건 보기`}
          <ChevronDown size={15} />
        </button>
      )}
    </div>
  );
}

function QuestionResultCard({ result, index }: { result: QuestionResult; index: number }) {
  const isText = result.question.type === "shortText" || result.question.type === "text";
  return (
    <article className="results-v2-question-card">
      <header>
        <div>
          <span className="results-v2-question-number">Q{String(index + 1).padStart(2, "0")}</span>
          <h2>{result.question.title}</h2>
        </div>
        <div className="results-v2-question-meta">
          <span>{questionTypeLabels[result.question.type]}</span>
          <span>응답 {result.answeredCount}건</span>
          <span>무응답 {result.unansweredCount}건</span>
        </div>
      </header>
      {result.question.type === "scale" ? (
        <ScaleDistribution result={result} />
      ) : isText ? (
        <TextResponseList responses={result.textResponses} />
      ) : (
        (() => {
          // 선택형 문항은 모두 막대로 그린다.
          if (result.choices.length === 0) {
            return <ChoiceDistribution choices={result.choices} />;
          }
          // 누적은 순서가 정해진 단일 선택에서만 뜻이 있다.
          // 다중 선택은 합이 100%를 넘어 누적이 성립하지 않는다.
          const ordered =
            result.hasAuthoredOrder &&
            (result.question.type === "single" || result.question.type === "dropdown");
          return (
            <>
              {ordered && (
                <p className="results-v2-cumulative-note">
                  순서형 · 누적{" "}
                  {result.choices
                    .map((choice) => `${choice.cumulativePercentage.toFixed(0)}%`)
                    .join(" → ")}
                </p>
              )}
              <ChoiceBarChart choices={result.choices} />
            </>
          );
        })()
      )}
    </article>
  );
}

function overviewResultLabel(result: QuestionResult) {
  if (result.average !== null) return `평균 ${result.average.toFixed(1)}점`;
  if (result.topChoice) {
    return `${result.topChoice.label} · ${result.topChoice.percentage.toFixed(1)}%`;
  }
  if (result.textResponses.length > 0) return `작성 응답 ${result.textResponses.length}건`;
  return "응답 없음";
}

function QuestionHighlights({
  results,
  onViewAll,
}: {
  results: QuestionResult[];
  onViewAll: () => void;
}) {
  return (
    <section className="results-v2-panel results-v2-highlights">
      <header className="results-v2-section-heading">
        <div>
          <span>문항 요약</span>
          <h2>문항별 핵심 결과</h2>
        </div>
        {results.length > overviewQuestionLimit && (
          <button type="button" onClick={onViewAll}>
            전체 보기 <ArrowRight size={15} />
          </button>
        )}
      </header>
      {results.length === 0 ? (
        <SmallEmptyState
          title="표시할 문항 결과가 없어요."
          description="응답이 수집되면 문항별 요약이 여기에 나타납니다."
        />
      ) : (
        <div className="results-v2-highlight-list">
          {results.slice(0, overviewQuestionLimit).map((result, index) => {
            const percentage =
              result.average !== null
                ? (result.average / (result.question.scaleMax ?? 5)) * 100
                : result.topChoice?.percentage ??
                  (result.answeredCount > 0 ? 100 : 0);
            return (
              <article key={result.question.id}>
                <span>Q{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{result.question.title}</strong>
                  <span className="results-v2-bar" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, percentage)}%` }} />
                  </span>
                </div>
                <em>{overviewResultLabel(result)}</em>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function QualitySummary({
  responses,
  onViewQuality,
}: {
  responses: ResultsStoredResponse[];
  onViewQuality: () => void;
}) {
  // 이상 없음 / 검토 / 제외 건수는 화면 위 제출 구성 막대가 이미 보여준다.
  // 여기서는 사용자가 실제로 할 일(확인이 남은 건수)만 남긴다.
  const pending = responses.filter(
    (response) => responseStatus(response) !== "usable",
  ).length;
  return (
    <section className="results-v2-panel results-v2-quality-summary">
      <header className="results-v2-section-heading">
        <div>
          <span>응답 품질</span>
          <h2>품질 점검 요약</h2>
        </div>
        <ShieldCheck size={20} />
      </header>
      <p className="results-v2-quality-lead">
        {pending > 0
          ? `확인이 남은 응답이 ${pending.toLocaleString("ko-KR")}건 있어요.`
          : "확인이 필요한 응답이 없어요."}
      </p>
      <button type="button" onClick={onViewQuality}>
        품질 검사 결과 보기 <ArrowRight size={15} />
      </button>
    </section>
  );
}

function RecentResponses({
  responses,
  onOpen,
  onViewAll,
}: {
  responses: ResultsStoredResponse[];
  onOpen: (response: ResultsStoredResponse) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="results-v2-panel results-v2-recent">
      <header className="results-v2-section-heading">
        <div>
          <span>최근 응답</span>
          <h2>최근 제출 기록</h2>
        </div>
        {responses.length > recentResponseLimit && (
          <button type="button" onClick={onViewAll}>전체 보기</button>
        )}
      </header>
      {responses.length === 0 ? (
        <SmallEmptyState
          title="아직 제출된 응답이 없어요."
          description="첫 응답이 도착하면 제출 시각과 품질 상태를 보여드려요."
        />
      ) : (
        <div className="results-v2-recent-list">
          {responses.slice(0, recentResponseLimit).map((response, index) => (
            <button type="button" key={response.id} onClick={() => onOpen(response)}>
              <span>#{String(responses.length - index).padStart(3, "0")}</span>
              <div>
                <strong>{formatResponseDate(response.createdAt)}</strong>
                <small>{response.completionSeconds || 0}초 소요</small>
              </div>
              <QualityBadge status={responseStatus(response)} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SmallEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="results-v2-small-empty">
      <BarChart3 size={21} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

/** 필터 이름과 각 상태의 건수를 한 곳에서 만든다. */
function filterOptionLabel(
  value: "all" | "changed" | QualityStatus,
  counts: { all: number; changed: number; usable: number; review: number; exclude: number },
) {
  if (value === "all") return `전체 ${counts.all}`;
  if (value === "changed") return `직접 바꿈 ${counts.changed}`;
  return `${qualityLabel(value)} ${counts[value]}`;
}
const maxAnswerColumns = 3;

function ResponseTable({
  responses,
  questions,
  decisions,
  onOpen,
}: {
  responses: ResultsStoredResponse[];
  questions: SurveyQuestion[];
  /** 표시는 최종 상태로 하되 원본 판정 열은 그대로 남긴다. */
  decisions: ResponseDecisionMap;
  onOpen: (response: ResultsStoredResponse) => void;
}) {
  // "changed"는 사람이 서버 판정을 뒤집은 응답만 모아 본다.
  const [filter, setFilter] = useState<"all" | "changed" | QualityStatus>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  // 평소에는 현재 필터만 보여주고, 누르면 나머지 선택지를 아래로 편다.
  const [filterOpen, setFilterOpen] = useState(false);

  // 표에 답을 직접 띄울 문항. 표가 읽히도록 최대 3개까지만 고른다.
  const answerable = useMemo(
    () => questions.filter((question) => question.type !== "section"),
    [questions],
  );
  const [columnIds, setColumnIds] = useState<number[]>(() =>
    answerable.slice(0, 2).map((question) => question.id),
  );
  const columns = useMemo(
    () =>
      columnIds
        .map((id) => answerable.find((question) => question.id === id))
        .filter((question): question is SurveyQuestion => Boolean(question)),
    [answerable, columnIds],
  );
  const toggleColumn = useCallback((id: number) => {
    setColumnIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= maxAnswerColumns) return current;
      return [...current, id];
    });
  }, []);

  const filtered = responses.filter((response) => {
    if (filter === "all") return true;
    if (filter === "changed") return Boolean(decisions[response.id]);
    return effectiveStatus(response, decisions) === filter;
  });
  const changedCount = responses.filter(
    (response) => Boolean(decisions[response.id]),
  ).length;
  const filterCounts = {
    all: responses.length,
    changed: changedCount,
    usable: responses.filter(
      (response) => effectiveStatus(response, decisions) === "usable",
    ).length,
    review: responses.filter(
      (response) => effectiveStatus(response, decisions) === "review",
    ).length,
    exclude: responses.filter(
      (response) => effectiveStatus(response, decisions) === "exclude",
    ).length,
  };
  return (
    <section className="results-v2-response-section">
      <header className="results-v2-section-heading results-v2-response-heading">
        <div>
          <span>개별 응답</span>
          <h2>제출 기록 {responses.length.toLocaleString("ko-KR")}건</h2>
        </div>
        <div className="results-v2-response-tools">
          <button
            type="button"
            className={`results-v2-column-toggle${pickerOpen ? " is-open" : ""}`}
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
          >
            표시 문항 {columns.length}
          </button>
        <div className="results-v2-filter" aria-label="품질 상태 필터">
          <button
            type="button"
            className={`results-v2-filter-current${filterOpen ? " is-open" : ""}`}
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((open) => !open)}
          >
            <ListFilter size={15} />
            {filterOptionLabel(filter, filterCounts)}
          </button>
        </div>
        </div>
      </header>
      {filterOpen && (
        <div className="results-v2-filter-panel">
          {(["all", "usable", "review", "exclude", "changed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "is-on" : ""}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setFilterOpen(false);
              }}
            >
              {filterOptionLabel(value, filterCounts)}
            </button>
          ))}
        </div>
      )}
      {pickerOpen && (
        <div className="results-v2-column-picker">
          <p>
            표에 답을 그대로 띄울 문항을 고르세요. 최대 {maxAnswerColumns}개까지 고를 수 있어요.
          </p>
          <div>
            {answerable.map((question, index) => {
              const on = columnIds.includes(question.id);
              const full = !on && columnIds.length >= maxAnswerColumns;
              return (
                <button
                  key={question.id}
                  type="button"
                  className={on ? "is-on" : ""}
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggleColumn(question.id)}
                >
                  Q{String(index + 1).padStart(2, "0")} {question.title.slice(0, 22)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <SmallEmptyState
          title={responses.length === 0 ? "아직 제출된 응답이 없어요." : "해당 상태의 응답이 없어요."}
          description={responses.length === 0 ? "설문 링크를 공유하면 개별 응답을 확인할 수 있어요." : "다른 품질 상태를 선택해보세요."}
        />
      ) : (
        <>
          <div className="results-v2-response-table-wrap">
            <table className="results-v2-response-table">
              <thead>
                <tr>
                  <th>응답 번호</th>
                  {columns.map((question) => (
                    <th key={question.id}>{question.title.slice(0, 16)}</th>
                  ))}
                  <th>제출 시각</th>
                  <th>품질 검사</th>
                  <th>집계 반영</th>
                  <th>응답 시간</th>
                  <th><span className="sr-only">상세 보기</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((response) => {
                  const originalIndex = responses.findIndex((item) => item.id === response.id);
                  return (
                    <tr key={response.id}>
                      <td>#{String(responses.length - originalIndex).padStart(3, "0")}</td>
                      {columns.map((question) => {
                        const answer = response.answers.find(
                          (item) => item.questionId === question.id,
                        );
                        return (
                          <td key={question.id} className="results-v2-answer-cell">
                            {answer && isAnswered(answer.value)
                              ? formatAnswerValue(answer.value)
                              : "—"}
                          </td>
                        );
                      })}
                      <td>{formatResponseDate(response.createdAt)}</td>
                      {/* 서버가 내린 원본 판정. 사람이 뭘 바꾸든 여기 그대로 남는다. */}
                      <td><QualityBadge status={responseStatus(response)} /></td>
                      <td>
                        {(() => {
                          const decided = decisions[response.id];
                          const included = effectiveStatus(response, decisions) !== "exclude";
                          return (
                            <span
                              className={`results-v2-included${
                                included ? " is-in" : " is-out"
                              }${decided ? " is-changed" : ""}`}
                            >
                              {included ? "반영" : "제외"}
                              {decided && <em>직접 바꿈</em>}
                            </span>
                          );
                        })()}
                      </td>
                      <td>{response.completionSeconds || 0}초</td>
                      <td>
                        <button type="button" onClick={() => onOpen(response)}>
                          상세 보기 <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="results-v2-response-cards">
            {filtered.map((response) => {
              const originalIndex = responses.findIndex((item) => item.id === response.id);
              return (
                <button type="button" key={response.id} onClick={() => onOpen(response)}>
                  <div>
                    <strong>#{String(responses.length - originalIndex).padStart(3, "0")}</strong>
                    <QualityBadge status={responseStatus(response)} />
                  </div>
                  <span>{formatResponseDate(response.createdAt)}</span>
                  <small>{response.completionSeconds || 0}초 소요</small>
                  <em>상세 보기 <ArrowRight size={14} /></em>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}


/**
 * 판단 전후로 대표 수치가 얼마나 달라지는지 비교한다.
 *
 * 설문 주인이 실제로 알고 싶은 건 "이 응답이 왜 이상한가"보다
 * "빼면 결과가 달라지나"다. 안 달라지면 검토에 시간을 안 써도 된다.
 */
function ExclusionImpact({
  baseline,
  current,
  excludedCount,
  totalCount,
}: {
  baseline: ReturnType<typeof buildQuestionResults>;
  current: ReturnType<typeof buildQuestionResults>;
  excludedCount: number;
  totalCount: number;
}) {
  // 비교 기준은 첫 번째 선택형 문항. 척도만 있는 설문이면 평균을 쓴다.
  const index = baseline.findIndex(
    (result) => result.topChoice !== null || result.average !== null,
  );
  if (index < 0 || excludedCount === 0) return null;

  const before = baseline[index];
  const after = current[index];
  if (!after) return null;

  const isScale = before.average !== null;
  const beforeValue = isScale ? before.average : before.topChoice?.percentage ?? null;
  const afterValue = isScale
    ? after.average
    : after.choices.find((choice) => choice.label === before.topChoice?.label)
        ?.percentage ?? null;
  if (beforeValue === null || afterValue === null) return null;

  const digits = isScale ? 1 : 1;
  const unit = isScale ? "점" : "%";
  const delta = afterValue - beforeValue;
  const label = isScale
    ? `${before.question.title} 평균`
    : `${before.question.title} · ${before.topChoice?.label}`;

  return (
    <section className="results-v2-impact" aria-label="제외가 결과에 미치는 영향">
      <div>
        <small>{totalCount.toLocaleString("ko-KR")}건 전부 포함</small>
        <strong>{beforeValue.toFixed(digits)}{unit}</strong>
      </div>
      <span className="results-v2-impact-arrow" aria-hidden="true">→</span>
      <div>
        <small>{excludedCount.toLocaleString("ko-KR")}건 제외 (현재)</small>
        <strong className="is-current">{afterValue.toFixed(digits)}{unit}</strong>
      </div>
      <p>
        <b>{label}</b>
        {Math.abs(delta) < 0.05
          ? " 기준으로 결과가 사실상 그대로입니다."
          : ` 기준으로 ${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(digits)}${isScale ? "점" : "%p"} 움직입니다.`}
      </p>
    </section>
  );
}

function QualityReviewList({
  responses,
  decisions,
  onDecide,
  onResetDecisions,
  onOpen,
}: {
  responses: ResultsStoredResponse[];
  decisions: ResponseDecisionMap;
  onDecide: (responseId: string, decision: ResponseDecision | null) => void;
  onResetDecisions: () => void;
  onOpen: (response: ResultsStoredResponse) => void;
}) {
  // 서버가 신호를 준 응답은 판단이 끝나도 목록에 남긴다. 사라지면 되돌릴 수가 없다.
  const flagged = responses.filter((response) => responseStatus(response) !== "usable");
  const undecided = flagged.filter((response) => !decisions[response.id]).length;
  // 검토 목록 밖의 응답도 직접 바꿨을 수 있으므로 전체를 센다.
  const decidedCount = Object.keys(decisions).length;
  return (
    <section className="results-v2-panel results-v2-quality-list">
      <header className="results-v2-section-heading">
        <div>
          <span>검토 목록</span>
          <h2>확인이 필요한 응답</h2>
        </div>
        <div className="results-v2-review-head-right">
          <span>
            {undecided > 0
              ? `${undecided.toLocaleString("ko-KR")}건 남음 / ${flagged.length.toLocaleString("ko-KR")}건`
              : `${flagged.length.toLocaleString("ko-KR")}건 모두 확인함`}
          </span>
          {decidedCount > 0 && (
            <button type="button" className="results-v2-reset" onClick={onResetDecisions}>
              원본으로 되돌리기 ({decidedCount})
            </button>
          )}
        </div>
      </header>
      {flagged.length === 0 ? (
        <SmallEmptyState
          title="확인할 패턴이 없어요."
          description="현재 수집된 응답에서 별도로 검토할 품질 신호가 발견되지 않았어요."
        />
      ) : (
        <div className="results-v2-quality-rows">
          {flagged.map((response) => {
            const originalIndex = responses.findIndex((item) => item.id === response.id);
            const reasons = response.quality?.reasons ?? [];
            const decided = decisions[response.id];
            return (
              <article key={response.id} className={decided ? `is-decided is-${decided}` : ""}>
                <div className="results-v2-quality-row-title">
                  <strong>#{String(responses.length - originalIndex).padStart(3, "0")}</strong>
                  <span>{formatResponseDate(response.createdAt)}</span>
                  <QualityBadge status={responseStatus(response)} />
                </div>
                {reasons.length > 0 ? (
                  <div className="results-v2-reason-list">
                    {reasons.map((reason) => <span key={reason}>{reason}</span>)}
                  </div>
                ) : (
                  <p className="results-v2-no-reason">기록된 검토 사유가 없습니다.</p>
                )}
                <p className="results-v2-quality-answers">
                  {response.answers
                    .filter((answer) => isAnswered(answer.value))
                    .slice(0, 3)
                    .map((answer) => (
                      <span key={answer.questionId}>
                        {answer.title.slice(0, 18)}
                        <b>{formatAnswerValue(answer.value).slice(0, 24)}</b>
                      </span>
                    ))}
                </p>
                <div className="results-v2-quality-row-footer">
                  <span><Clock3 size={14} /> {response.completionSeconds || 0}초 소요</span>
                  <div className="results-v2-decide">
                    <button
                      type="button"
                      className={decided === "include" ? "is-on is-include" : ""}
                      aria-pressed={decided === "include"}
                      onClick={() => onDecide(response.id, decided === "include" ? null : "include")}
                    >
                      집계에 포함
                    </button>
                    <button
                      type="button"
                      className={decided === "exclude" ? "is-on is-exclude" : ""}
                      aria-pressed={decided === "exclude"}
                      onClick={() => onDecide(response.id, decided === "exclude" ? null : "exclude")}
                    >
                      집계에서 제외
                    </button>
                    <button type="button" className="is-link" onClick={() => onOpen(response)}>
                      전체 보기 <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ResponseDetailDrawer({
  response,
  responseNumber,
  onClose,
}: {
  response: ResultsStoredResponse | null;
  responseNumber: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!response) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, response]);

  if (!response) return null;
  const reasons = response.quality?.reasons ?? [];
  return (
    <div className="results-v2-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="results-v2-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="response-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>개별 응답</span>
            <h2 id="response-detail-title">#{String(responseNumber).padStart(3, "0")}</h2>
          </div>
          <button type="button" aria-label="상세 응답 닫기" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="results-v2-drawer-meta">
          <QualityBadge status={responseStatus(response)} />
          <span>{formatResponseDate(response.createdAt)}</span>
          <span>{response.completionSeconds || 0}초 소요</span>
        </div>
        {reasons.length > 0 && (
          <section className="results-v2-drawer-quality">
            <strong>품질 확인 사유</strong>
            <div>{reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
          </section>
        )}
        <div className="results-v2-drawer-answers">
          {response.answers.length === 0 ? (
            <SmallEmptyState title="저장된 답변이 없어요." description="이 응답에는 확인할 답변 데이터가 없습니다." />
          ) : (
            response.answers.map((answer, index) => (
              <article key={`${answer.questionId}-${index}`}>
                <span>Q{String(index + 1).padStart(2, "0")}</span>
                <strong>{answer.title}</strong>
                <p>{formatAnswerValue(answer.value)}</p>
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function ShareResultsModal({
  open,
  title,
  responseCount,
  shareQuestion,
  shareResult,
  sharePath,
  sharing,
  shareStatus,
  onClose,
  onInstagramShare,
  onDownload,
}: {
  open: boolean;
  title: string;
  responseCount: number;
  shareQuestion: string;
  shareResult: string;
  sharePath: string;
  sharing: boolean;
  shareStatus: string;
  onClose: () => void;
  onInstagramShare: () => void;
  onDownload: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="results-v2-share-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="results-v2-share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="results-share-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="results-v2-modal-close" aria-label="결과 공유 닫기" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="results-v2-share-preview">
          <div className="results-v2-share-brand"><strong>BAROFORM</strong><span>결과 카드</span></div>
          <h2>{title || "우리 학교 설문 결과"}</h2>
          <span>분석에 반영된 응답</span>
          <strong>{responseCount.toLocaleString("ko-KR")}건</strong>
          <div>
            <small>가장 눈에 띄는 결과</small>
            <p>{shareQuestion}</p>
            <b>{shareResult}</b>
          </div>
          <footer>
            <span>응답 {responseCount.toLocaleString("ko-KR")}건 기준</span>
            <strong>baroform-fixed.vercel.app{sharePath}</strong>
            <small>개별 응답 내용은 포함하지 않았으며 전체 학생을 대표하지 않을 수 있어요.</small>
          </footer>
        </div>
        <div className="results-v2-share-controls">
          <span>결과 공유</span>
          <h2 id="results-share-title">인스타그램용 결과 카드를 만들어요.</h2>
          <p>모바일에서는 공유 앱 목록에서 Instagram을 선택할 수 있어요. 지원하지 않는 기기에서는 이미지와 캡션을 저장합니다.</p>
          <button type="button" className="primary" disabled={sharing} onClick={onInstagramShare}>
            <Share2 size={18} /> {sharing ? "카드 만드는 중…" : "인스타그램에 공유"}
          </button>
          <button type="button" disabled={sharing} onClick={onDownload}>
            <Download size={17} /> 이미지 저장 + 캡션 복사
          </button>
          {shareStatus && <span className="results-v2-share-status" role="status">{shareStatus}</span>}
        </div>
      </section>
    </div>
  );
}

function ResultsHeader({
  title,
  hasSurvey,
  responseCount,
  lastUpdated,
  exporting,
  exportDisabled,
  shareDisabled,
  onBack,
  onViewSurvey,
  onExport,
  onShare,
}: {
  title: string;
  hasSurvey: boolean;
  responseCount: number;
  lastUpdated: string;
  exporting: ResultExportFormat | null;
  exportDisabled: boolean;
  shareDisabled: boolean;
  onBack: () => void;
  onViewSurvey: () => void;
  onExport: (format: ResultExportFormat) => void;
  onShare: () => void;
}) {
  return (
    <header className="results-v2-header">
      <div className="results-v2-header-inner">
        <button type="button" className="results-v2-back" onClick={onBack}>
          <ArrowLeft size={17} /> 설문 목록으로 돌아가기
        </button>
        <div className="results-v2-title-row">
          <div className="results-v2-title-copy">
            <h1>{title || "설문 결과 및 분석"}</h1>
            <div>
              <span className="results-v2-status"><i />{hasSurvey ? "응답 수집 중" : "설문 없음"}</span>
              <span>총 응답 {responseCount.toLocaleString("ko-KR")}건</span>
              <span>마지막 업데이트 {lastUpdated}</span>
            </div>
          </div>
          <div className="results-v2-header-actions">
            <button type="button" disabled={!hasSurvey} onClick={onViewSurvey}><Eye size={16} /> 설문 보기</button>
            <details className="results-v2-export-menu">
              <summary
                aria-disabled={exportDisabled}
                onClick={(event) => {
                  if (exportDisabled) event.preventDefault();
                }}
              >
                <Download size={16} /> 결과 내보내기 <ChevronDown size={14} />
              </summary>
              <div>
                <button type="button" disabled={exportDisabled || exporting !== null} onClick={() => onExport("excel")}>
                  <FileSpreadsheet size={16} /> {exporting === "excel" ? "Excel 준비 중…" : "Excel"}
                </button>
                <button type="button" disabled={exportDisabled || exporting !== null} onClick={() => onExport("word")}>
                  <FileText size={16} /> {exporting === "word" ? "Word 준비 중…" : "Word"}
                </button>
                <button type="button" disabled={exportDisabled || exporting !== null} onClick={() => onExport("csv")}>
                  <Download size={16} /> {exporting === "csv" ? "CSV 준비 중…" : "CSV"}
                </button>
              </div>
            </details>
            <button type="button" className="primary" disabled={shareDisabled} onClick={onShare}><Share2 size={16} /> 결과 공유</button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function ResultsDashboard({
  title,
  slug,
  responses,
  questions,
  state,
  error,
  exporting,
  exportError,
  shareOpen,
  sharing,
  shareStatus,
  shareQuestion,
  shareResult,
  sharePath,
  onHome,
  onExport,
  onOpenShare,
  onCloseShare,
  onShareToInstagram,
  onDownloadShare,
  decisions,
  onDecide,
  onResetDecisions,
  decisionError,
}: {
  title: string;
  slug: string;
  responses: ResultsStoredResponse[];
  questions: SurveyQuestion[];
  state: ResultsLoadState;
  error: string;
  exporting: ResultExportFormat | null;
  exportError: string;
  shareOpen: boolean;
  sharing: boolean;
  shareStatus: string;
  shareQuestion: string;
  shareResult: string;
  sharePath: string;
  onHome: () => void;
  onExport: (format: ResultExportFormat) => void;
  onOpenShare: () => void;
  onCloseShare: () => void;
  onShareToInstagram: () => void;
  onDownloadShare: () => void;
  /** 설문 주인이 응답별로 내린 포함/제외 판단. 서버에 저장된 값이다. */
  decisions: ResponseDecisionMap;
  /** decision을 null로 부르면 사람 판단을 지우고 서버 판정으로 되돌린다. */
  onDecide: (responseId: string, decision: ResponseDecision | null) => void;
  /** 이 설문에 내린 사람 판단을 전부 지우고 서버 판정으로 되돌린다. */
  onResetDecisions: () => void;
  /** 판단 저장이 실패했을 때 보여줄 문구. 조용히 되돌리면 사용자는 원인을 알 수 없다. */
  decisionError: string;
}) {
  const [activeTab, setActiveTab] = useState<ResultsTab>("overview");
  const [detailResponse, setDetailResponse] = useState<ResultsStoredResponse | null>(null);

  useEffect(() => {
    const syncFromUrl = () => {
      const tab = new URLSearchParams(window.location.search).get("resultsTab");
      if (resultTabs.some((item) => item.id === tab)) setActiveTab(tab as ResultsTab);
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const changeTab = useCallback((tab: ResultsTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("resultsTab", tab);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // 아래 집계는 모두 사람 판단이 반영된 상태를 기준으로 센다.
  // 그래야 '빼고 보기'가 실제로 숫자를 바꾼다.
  const usableResponses = useMemo(
    () => responses.filter((response) => effectiveStatus(response, decisions) === "usable"),
    [responses, decisions],
  );
  const reviewResponses = useMemo(
    () => responses.filter((response) => effectiveStatus(response, decisions) === "review"),
    [responses, decisions],
  );
  const excludedResponses = useMemo(
    () => responses.filter((response) => effectiveStatus(response, decisions) === "exclude"),
    [responses, decisions],
  );
  const analysisResponses = useMemo(
    () => responses.filter((response) => effectiveStatus(response, decisions) !== "exclude"),
    [responses, decisions],
  );
  // 아무 판단도 안 했을 때의 결과. 제외가 결론을 바꾸는지 비교하는 데 쓴다.
  const baselineResults = useMemo(
    () => buildQuestionResults(questions, responses),
    [questions, responses],
  );
  const questionResults = useMemo(
    () => buildQuestionResults(questions, analysisResponses),
    [analysisResponses, questions],
  );
  const lastUpdated = useMemo(() => {
    const latest = responses.reduce<number>((current, response) => {
      const timestamp = new Date(response.createdAt).getTime();
      return Number.isNaN(timestamp) ? current : Math.max(current, timestamp);
    }, 0);
    return latest > 0 ? responseDateFormatter.format(new Date(latest)) : "아직 없음";
  }, [responses]);
  const detailNumber = detailResponse
    ? Math.max(1, responses.length - responses.findIndex((item) => item.id === detailResponse.id))
    : 0;

  return (
    <main className="results-v2-page">
      <ResultsHeader
        title={title}
        hasSurvey={Boolean(slug)}
        responseCount={responses.length}
        lastUpdated={lastUpdated}
        exporting={exporting}
        exportDisabled={responses.length === 0}
        shareDisabled={analysisResponses.length === 0}
        onBack={onHome}
        onViewSurvey={() => window.open(surveySharePath(slug), "_blank", "noopener,noreferrer")}
        onExport={onExport}
        onShare={onOpenShare}
      />
      <div className="results-v2-container">
        {state === "missing" ? (
          <div className="results-v2-page-state">
            <UsersRound size={28} />
            <h2>관리 중인 설문이 없어요.</h2>
            <p>먼저 설문을 만들고 배포하면 실제 응답 결과를 확인할 수 있어요.</p>
            <button type="button" onClick={onHome}>설문 만들러 가기 <ArrowRight size={15} /></button>
          </div>
        ) : state === "loading" ? (
          <div className="results-v2-page-state" role="status">
            <span className="results-v2-loader" />
            <h2>응답 결과를 불러오고 있어요.</h2>
            <p>저장된 응답과 품질 정보를 함께 정리하고 있습니다.</p>
          </div>
        ) : state === "error" ? (
          <div className="results-v2-page-state" role="alert">
            <BarChart3 size={28} />
            <h2>결과를 불러오지 못했어요.</h2>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <LowSampleNotice responseCount={responses.length} />
            <ResultsTabs activeTab={activeTab} onChange={changeTab} />
            {exportError && <p className="results-v2-export-error" role="alert">{exportError}</p>}
            <ResponseFlowBar
              total={responses.length}
              usable={usableResponses.length}
              review={reviewResponses.length}
              excluded={excludedResponses.length}
            />

            {activeTab === "overview" && (
              <div id="results-panel-overview" role="tabpanel" className="results-v2-overview">
                <QuestionHighlights results={questionResults} onViewAll={() => changeTab("questions")} />
                <aside className="results-v2-overview-side">
                  <QualitySummary responses={responses} onViewQuality={() => changeTab("quality")} />
                  <RecentResponses responses={responses} onOpen={setDetailResponse} onViewAll={() => changeTab("responses")} />
                </aside>
              </div>
            )}

            {activeTab === "questions" && (
              <section id="results-panel-questions" role="tabpanel" className="results-v2-question-results">
                <header className="results-v2-content-heading">
                  <div><span>문항별 결과</span><h2>질문마다 응답 분포를 확인하세요.</h2></div>
                  <p>분석 제외 응답을 빼고 {analysisResponses.length.toLocaleString("ko-KR")}건을 반영했습니다.</p>
                </header>
                {questionResults.length === 0 ? (
                  <SmallEmptyState title="표시할 문항 결과가 없어요." description="응답이 수집되면 문항별 분포가 여기에 표시됩니다." />
                ) : (
                  <div>{questionResults.map((result, index) => <QuestionResultCard result={result} index={index} key={result.question.id} />)}</div>
                )}
              </section>
            )}

            {activeTab === "responses" && (
              <div id="results-panel-responses" role="tabpanel">
                <ResponseTable
                  responses={responses}
                  questions={questions}
                  decisions={decisions}
                  onOpen={setDetailResponse}
                />
              </div>
            )}

            {activeTab === "quality" && (
              <div id="results-panel-quality" role="tabpanel" className="results-v2-quality-tab">
                {decisionError && (
                  <p className="results-v2-decision-error" role="alert">
                    {decisionError}
                  </p>
                )}
                <ExclusionImpact
                  baseline={baselineResults}
                  current={questionResults}
                  excludedCount={excludedResponses.length}
                  totalCount={responses.length}
                />
                <QualityReviewList
                  responses={responses}
                  decisions={decisions}
                  onDecide={onDecide}
                  onResetDecisions={onResetDecisions}
                  onOpen={setDetailResponse}
                />
              </div>
            )}
          </>
        )}
      </div>
      <ResponseDetailDrawer response={detailResponse} responseNumber={detailNumber} onClose={() => setDetailResponse(null)} />
      <ShareResultsModal
        open={shareOpen}
        title={title}
        responseCount={analysisResponses.length}
        shareQuestion={shareQuestion}
        shareResult={shareResult}
        sharePath={sharePath}
        sharing={sharing}
        shareStatus={shareStatus}
        onClose={onCloseShare}
        onInstagramShare={onShareToInstagram}
        onDownload={onDownloadShare}
      />
    </main>
  );
}
