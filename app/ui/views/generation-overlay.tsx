"use client";

import {
  Clock3,
  Search,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  estimateSurveyGenerationSeconds,
  formatSurveyGenerationSeconds,
  getSurveyGenerationTiming,
} from "../../survey-generation-time";
import {
  surveyModeLoadingMessages,
  type SurveyMode,
} from "../../survey-mode";
import { readGenerationDurations as readSurveyGenerationDurations } from "../../ux/data/generation-history";

export function GenerationOverlay({
  surveyMode,
  questionCount,
  attachmentCount,
  onCancel,
}: {
  surveyMode: SurveyMode;
  questionCount: number;
  attachmentCount: number;
  onCancel: () => void;
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recentDurations, setRecentDurations] = useState<number[]>([]);

  useEffect(() => {
    const messageTimer = window.setInterval(() => {
      setMessageIndex((current) =>
        Math.min(
          current + 1,
          surveyModeLoadingMessages[surveyMode].length - 1,
        ),
      );
    }, 8_000);
    const startedAt = Date.now();
    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    const historyTimer = window.setTimeout(() => {
      setRecentDurations(readSurveyGenerationDurations(surveyMode));
    }, 0);

    return () => {
      window.clearInterval(messageTimer);
      window.clearInterval(elapsedTimer);
      window.clearTimeout(historyTimer);
    };
  }, [surveyMode]);

  const phaseTitles = surveyModeLoadingMessages[surveyMode];
  const estimatedTotalSeconds = estimateSurveyGenerationSeconds({
    surveyMode,
    questionCount,
    attachmentCount,
    recentDurations,
  });
  const timing = getSurveyGenerationTiming(
    elapsedSeconds,
    estimatedTotalSeconds,
  );

  return (
    <div
      className="generation-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-generation-status"
    >
      <div className="generation-card research-loading-card">
        <span className="generation-orbit">
          <Search size={24} />
        </span>
        <strong id="survey-generation-status" aria-live="polite">
          {phaseTitles[messageIndex]}
        </strong>
        <p>
          {surveyMode === "research"
            ? "연결을 오래 유지하지 않고 백그라운드에서 한 번만 생성한 뒤 완료 상태를 확인해요."
            : "입력한 내용을 바탕으로 바로 편집할 수 있는 설문을 만들고 있어요."}
        </p>
        <div
          className={`generation-time ${timing.isOverEstimate ? "overtime" : ""}`}
        >
          <span><Clock3 size={15} /> 예상 남은 시간</span>
          <output aria-live="polite">{timing.remainingLabel}</output>
        </div>
        <div className="generation-time-meta">
          경과 {formatSurveyGenerationSeconds(timing.elapsedSeconds)} ·{" "}
          {recentDurations.length > 0
            ? "최근 내 생성 기록 기준"
            : "최근 운영 소요 시간 기준"}
        </div>
        <button type="button" className="generation-cancel" onClick={onCancel}>
          생성 취소
        </button>
      </div>
    </div>
  );
}

