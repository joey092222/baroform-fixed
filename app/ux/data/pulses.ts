import { getJson, sendJson } from "./http";
import type { CampusPulse } from "../../campus-pulse";
import { defaultSchoolId } from "./surveys";

export const pulseMinOptions = 2;
export const pulseMaxOptions = 4;
export const pulseExpiryHourOptions = [6, 24, 72, 168] as const;

export async function fetchPulses(authToken?: string, schoolId = defaultSchoolId) {
  const result = await getJson<{ pulses?: CampusPulse[] }>(
    `/api/pulses?school=${schoolId}`,
    { authToken },
  );
  return result.pulses ?? [];
}

export async function createPulse(
  authToken: string,
  input: { question: string; options: string[]; expiresHours: number },
) {
  await sendJson("/api/pulses", "POST", input, { authToken });
}

export async function votePulse(
  authToken: string,
  pulseId: string,
  optionIndex: number,
) {
  await sendJson(
    `/api/pulses/${encodeURIComponent(pulseId)}/vote`,
    "POST",
    { optionIndex },
    { authToken },
  );
}
