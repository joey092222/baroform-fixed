export const defaultSurveyRewardCash = 30;

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
