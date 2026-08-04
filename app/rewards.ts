export const defaultSurveyRewardCash = 30;

export function rewardCashForDuration(durationMinutes: number) {
  const minutes = Number.isFinite(durationMinutes)
    ? Math.max(1, Math.round(durationMinutes))
    : 1;
  if (minutes <= 3) return 30;
  if (minutes <= 6) return 50;
  return 70;
}

export function surveyRewardAmount(input: {
  respondentId?: string | null;
  ownerId?: string | null;
  rewardCash?: number | null;
}) {
  if (!input.respondentId || input.respondentId === input.ownerId) return 0;
  const amount = Number.isFinite(input.rewardCash)
    ? Math.round(input.rewardCash ?? defaultSurveyRewardCash)
    : defaultSurveyRewardCash;
  return Math.max(0, Math.min(1000, amount));
}
