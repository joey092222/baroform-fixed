import { getJson, sendJson } from "./http";
import type { SurveyCategory } from "../../survey-board";
import type {
  OwnedSurvey,
  PublicSurvey,
  Question,
  StoredResponse,
  SurveyReward,
} from "../types";

export const defaultSchoolId = "yonsei";

/**
 * Public catalog = internal surveys + externally hosted surveys, newest first.
 * An external-listing failure must not hide the internal ones.
 */
export async function fetchPublicSurveys(schoolId = defaultSchoolId) {
  const [internal, external] = await Promise.all([
    getJson<{ surveys?: PublicSurvey[] }>(`/api/surveys?school=${schoolId}`),
    getJson<{ surveys?: PublicSurvey[] }>(
      `/api/external-surveys?school=${schoolId}`,
    ).catch(() => ({ surveys: [] as PublicSurvey[] })),
  ]);
  return [...(internal.surveys ?? []), ...(external.surveys ?? [])].sort(
    (left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""),
  );
}

export async function fetchMySurveys(authToken: string) {
  const result = await getJson<{ surveys?: OwnedSurvey[] }>(
    "/api/surveys?mine=true",
    { authToken },
  );
  return result.surveys ?? [];
}

export async function fetchSurvey(slug: string) {
  const result = await getJson<{ survey?: PublicSurvey }>(
    `/api/surveys/${encodeURIComponent(slug)}`,
  );
  if (!result.survey) throw new Error("공개된 설문을 찾을 수 없어요.");
  return result.survey;
}

export type CreatedSurvey = {
  slug: string;
  title: string;
  description: string;
  ownerName: string;
  schoolId: string;
  category: SurveyCategory;
  campus: string;
  durationMinutes: number;
  rewardCash: number;
  targetAudience: string;
  targetResponses: number;
  listingRequested: boolean;
  isListed: boolean;
  manageToken: string;
  createdAt: string;
  updatedAt: string;
};

export async function createSurvey(
  authToken: string,
  input: {
    title: string;
    description: string;
    ownerName: string;
    questions: Question[];
    listingRequested: boolean;
    category: SurveyCategory;
    targetAudience: string;
    /** 0 이면 목표를 정하지 않은 것. 링크만 배포할 때가 그 경우입니다. */
    targetResponses: number;
  },
) {
  const result = await sendJson<{ survey?: CreatedSurvey }>(
    "/api/surveys",
    "POST",
    input,
    { authToken },
  );
  if (!result.survey) throw new Error("공개 링크를 만들지 못했어요.");
  return result.survey;
}

export async function deleteSurvey(authToken: string, slug: string) {
  const result = await sendJson<{ deletedSlug?: string }>(
    `/api/surveys/${encodeURIComponent(slug)}`,
    "DELETE",
    undefined,
    { authToken },
  );
  if (result.deletedSlug !== slug) {
    throw new Error("설문을 삭제하지 못했어요.");
  }
}

/**
 * Attaches a survey that was published before sign-in to the now-signed-in account.
 * Failure is expected when the survey already belongs to someone else.
 */
export function claimSurvey(
  authToken: string,
  input: { slug: string; manageToken: string },
) {
  return sendJson("/api/surveys/claim", "POST", input, { authToken });
}

export async function fetchSurveyResponses(slug: string, manageToken: string) {
  const result = await getJson<{ responses?: StoredResponse[] }>(
    `/api/surveys/${encodeURIComponent(slug)}/responses`,
    { headers: { "x-baroform-manage-token": manageToken } },
  );
  return result.responses ?? [];
}

export async function submitSurveyResponse(
  slug: string,
  input: {
    answers: Array<{
      questionId: number;
      title: string;
      type: Question["type"];
      value: number | string | string[];
    }>;
    completionSeconds: number;
  },
  authToken?: string,
) {
  const result = await sendJson<{ reward?: SurveyReward }>(
    `/api/surveys/${encodeURIComponent(slug)}/responses`,
    "POST",
    input,
    { authToken },
  );
  return result.reward ?? null;
}

export function recordExternalSurveyVisit(slug: string, authToken?: string) {
  return sendJson(
    `/api/external-surveys/${encodeURIComponent(slug)}/visit`,
    "POST",
    undefined,
    { authToken },
  );
}

export async function createExternalSurvey(
  authToken: string,
  input: {
    title: string;
    externalUrl: string;
    description: string;
    durationMinutes: number;
    targetResponses: number;
    category: SurveyCategory;
  },
) {
  await sendJson("/api/external-surveys", "POST", input, { authToken });
}
