import type { SurveyMode } from "../../survey-mode";

/**
 * Recent generation durations, kept locally so the UI can show a realistic
 * estimate instead of a generic spinner. Best-effort: storage failures are ignored.
 */

const storageKey = "baroform-survey-generation-duration-v1";
const minDurationSeconds = 15;
const maxDurationSeconds = 600;
const keptSamples = 8;

type DurationHistory = Partial<Record<SurveyMode, number[]>>;

function readHistory(): DurationHistory {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "{}",
    ) as DurationHistory;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isUsableDuration(duration: number) {
  return (
    Number.isFinite(duration) &&
    duration >= minDurationSeconds &&
    duration <= maxDurationSeconds
  );
}

export function readGenerationDurations(surveyMode: SurveyMode) {
  const durations = readHistory()[surveyMode];
  return Array.isArray(durations)
    ? durations.filter(isUsableDuration).slice(-keptSamples)
    : [];
}

export function recordGenerationDuration(
  surveyMode: SurveyMode,
  durationSeconds: number,
) {
  if (typeof window === "undefined" || !isUsableDuration(durationSeconds)) return;
  const history = readHistory();
  history[surveyMode] = [
    ...(Array.isArray(history[surveyMode]) ? history[surveyMode] : []),
    Math.round(durationSeconds),
  ].slice(-keptSamples);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    // Generation continues even when local storage is unavailable.
  }
}
