export type CampusPulse = {
  id: string;
  question: string;
  options: string[];
  createdAt: string;
  expiresAt: string;
  totalVotes: number;
  myVote: number | null;
  overall: number[];
};

export function rankCampusPulses(pulses: CampusPulse[]) {
  return [...pulses].sort((left, right) => {
    const participationGap = right.totalVotes - left.totalVotes;
    if (participationGap !== 0) return participationGap;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function campusPulseTimeLeft(expiresAt: string, now = Date.now()) {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const hours = Math.ceil(remaining / 3_600_000);
  if (hours <= 0) return "마감";
  if (hours < 24) return `${hours}시간 남음`;
  return `${Math.ceil(hours / 24)}일 남음`;
}
