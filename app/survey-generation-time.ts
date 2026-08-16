import type { SurveyMode } from "./survey-mode";

const defaultEstimateSeconds: Record<SurveyMode, number> = {
  standard: 80,
  research: 150,
};

const estimateBounds: Record<SurveyMode, { min: number; max: number }> = {
  standard: { min: 45, max: 210 },
  research: { min: 90, max: 360 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

export type SurveyGenerationEstimateInput = {
  surveyMode: SurveyMode;
  questionCount: number;
  attachmentCount: number;
  recentDurations?: readonly number[];
};

export function estimateSurveyGenerationSeconds({
  surveyMode,
  questionCount,
  attachmentCount,
  recentDurations = [],
}: SurveyGenerationEstimateInput) {
  const normalizedDurations = recentDurations
    .filter(
      (duration) =>
        Number.isFinite(duration) && duration >= 15 && duration <= 600,
    )
    .slice(-8);
  const questionAdjustment =
    Math.max(0, questionCount - 7) * (surveyMode === "research" ? 3 : 2);
  const attachmentAdjustment =
    Math.max(0, attachmentCount) * (surveyMode === "research" ? 12 : 8);
  const baseline =
    defaultEstimateSeconds[surveyMode] +
    questionAdjustment +
    attachmentAdjustment;
  const adaptiveEstimate =
    normalizedDurations.length > 0
      ? median(normalizedDurations) * 0.7 + baseline * 0.3
      : baseline;
  const bounds = estimateBounds[surveyMode];

  return Math.round(clamp(adaptiveEstimate, bounds.min, bounds.max));
}

export function formatSurveyGenerationSeconds(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes === 0) return `${remainder}초`;
  if (remainder === 0) return `${minutes}분`;
  return `${minutes}분 ${remainder}초`;
}

export type SurveyGenerationTiming = {
  elapsedSeconds: number;
  remainingSeconds: number;
  isOverEstimate: boolean;
  remainingLabel: string;
};

export function getSurveyGenerationTiming(
  elapsedSeconds: number,
  estimatedTotalSeconds: number,
): SurveyGenerationTiming {
  const elapsed = Math.max(0, Math.floor(elapsedSeconds));
  const remaining = Math.max(0, Math.ceil(estimatedTotalSeconds - elapsed));
  const isOverEstimate = elapsed >= estimatedTotalSeconds;

  return {
    elapsedSeconds: elapsed,
    remainingSeconds: remaining,
    isOverEstimate,
    remainingLabel: isOverEstimate
      ? "예상보다 조금 더 걸리는 중"
      : `약 ${formatSurveyGenerationSeconds(remaining)}`,
  };
}
