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
  choices: Array<{ label: string; count: number; percentage: number }>;
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

      const choices = [...optionCounts.entries()]
        .map(([label, count]) => ({
          label,
          count,
          percentage: answeredCount > 0 ? (count / answeredCount) * 100 : 0,
        }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ko-KR"));
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
        scaleValues,
        average: answeredCount > 0 && question.type === "scale" ? scaleTotal / answeredCount : null,
        textResponses,
      };
    });
}

function ResultMetricCard({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: number;
  description: string;
  tone?: "default" | "review" | "exclude";
}) {
  return (
    <article className={`results-v2-metric results-v2-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}건</strong>
      <p>{description}</p>
    </article>
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
}: {
  choices: QuestionResult["choices"];
}) {
  if (choices.length === 0) {
    return <p className="results-v2-inline-empty">아직 선택된 응답이 없어요.</p>;
  }
  const topCount = choices[0]?.count ?? 0;
  return (
    <div className="results-v2-choice-list">
      {choices.map((choice) => (
        <div className={choice.count === topCount && topCount > 0 ? "is-top" : ""} key={choice.label}>
          <div className="results-v2-choice-copy">
            <span>{choice.label}</span>
            <strong>
              {choice.count.toLocaleString("ko-KR")}명 · {choice.percentage.toFixed(1)}%
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
        <ChoiceDistribution choices={result.choices} />
      )}
    </article>
  );
}

function overviewResultLabel(result: QuestionResult) {
  if (result.average !== null) return `평균 ${result.average.toFixed(1)}점`;
  if (result.choices[0]) {
    return `${result.choices[0].label} · ${result.choices[0].percentage.toFixed(1)}%`;
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
                : result.choices[0]?.percentage ??
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
  const usable = responses.filter((response) => responseStatus(response) === "usable").length;
  const review = responses.filter((response) => responseStatus(response) === "review").length;
  const excluded = responses.filter((response) => responseStatus(response) === "exclude").length;
  return (
    <section className="results-v2-panel results-v2-quality-summary">
      <header className="results-v2-section-heading">
        <div>
          <span>응답 품질</span>
          <h2>품질 점검 요약</h2>
        </div>
        <ShieldCheck size={20} />
      </header>
      <div className="results-v2-quality-counts">
        <span><small>이상 없음</small><strong>{usable}건</strong></span>
        <span><small>검토 필요</small><strong>{review}건</strong></span>
        <span><small>분석 제외</small><strong>{excluded}건</strong></span>
      </div>
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

function ResponseTable({
  responses,
  onOpen,
}: {
  responses: ResultsStoredResponse[];
  onOpen: (response: ResultsStoredResponse) => void;
}) {
  const [filter, setFilter] = useState<"all" | QualityStatus>("all");
  const filtered = responses.filter(
    (response) => filter === "all" || responseStatus(response) === filter,
  );
  return (
    <section className="results-v2-response-section">
      <header className="results-v2-section-heading results-v2-response-heading">
        <div>
          <span>개별 응답</span>
          <h2>제출 기록 {responses.length.toLocaleString("ko-KR")}건</h2>
        </div>
        <div className="results-v2-filter" aria-label="품질 상태 필터">
          <ListFilter size={15} />
          {(["all", "usable", "review", "exclude"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "전체" : qualityLabel(value)}
            </button>
          ))}
        </div>
      </header>
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
                  <th>제출 시각</th>
                  <th>품질 상태</th>
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
                      <td>{formatResponseDate(response.createdAt)}</td>
                      <td><QualityBadge status={responseStatus(response)} /></td>
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

function QualityReviewList({
  responses,
  onOpen,
}: {
  responses: ResultsStoredResponse[];
  onOpen: (response: ResultsStoredResponse) => void;
}) {
  const flagged = responses.filter((response) => responseStatus(response) !== "usable");
  return (
    <section className="results-v2-panel results-v2-quality-list">
      <header className="results-v2-section-heading">
        <div>
          <span>검토 목록</span>
          <h2>확인이 필요한 응답</h2>
        </div>
        <span>{flagged.length.toLocaleString("ko-KR")}건</span>
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
            return (
              <article key={response.id}>
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
                <div className="results-v2-quality-row-footer">
                  <span><Clock3 size={14} /> {response.completionSeconds || 0}초 소요</span>
                  <button type="button" onClick={() => onOpen(response)}>
                    상세 응답 확인 <ArrowRight size={14} />
                  </button>
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

  const usableResponses = useMemo(
    () => responses.filter((response) => responseStatus(response) === "usable"),
    [responses],
  );
  const reviewResponses = useMemo(
    () => responses.filter((response) => responseStatus(response) === "review"),
    [responses],
  );
  const excludedResponses = useMemo(
    () => responses.filter((response) => responseStatus(response) === "exclude"),
    [responses],
  );
  const analysisResponses = useMemo(
    () => responses.filter((response) => responseStatus(response) !== "exclude"),
    [responses],
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
            <div className="results-v2-metrics" aria-label="핵심 지표">
              <ResultMetricCard label="총 응답" value={responses.length} description="저장된 전체 제출 기준" />
              <ResultMetricCard label="분석 반영" value={analysisResponses.length} description={`${usableResponses.length}건 정상 · ${reviewResponses.length}건 검토 표시`} />
              <ResultMetricCard label="검토 필요" value={reviewResponses.length} description="분석 반영에 포함된 주의 응답" tone="review" />
              <ResultMetricCard label="분석 제외" value={excludedResponses.length} description="원본은 보존하고 집계에서 제외" tone="exclude" />
            </div>

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
                <ResponseTable responses={responses} onOpen={setDetailResponse} />
              </div>
            )}

            {activeTab === "quality" && (
              <div id="results-panel-quality" role="tabpanel" className="results-v2-quality-tab">
                <div className="results-v2-quality-metrics">
                  <ResultMetricCard label="전체 응답" value={responses.length} description="품질 검사를 실행한 제출" />
                  <ResultMetricCard label="이상 없음" value={usableResponses.length} description="별도 확인 신호 없음" />
                  <ResultMetricCard label="검토 필요" value={reviewResponses.length} description="분석에는 포함해 표시" tone="review" />
                  <ResultMetricCard label="분석 제외" value={excludedResponses.length} description="원본 데이터는 그대로 보존" tone="exclude" />
                </div>
                <QualityReviewList responses={responses} onOpen={setDetailResponse} />
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
