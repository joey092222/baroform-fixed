import { sendJson } from "./http";
import { readSurveyGenerationResponse } from "../../survey-generation-client";
import type { SurveyMode } from "../../survey-mode";
import type { SurveyBlueprint } from "../../survey-intent";
import type { SurveyClarification, SurveyResearch } from "../../survey-ai";
import type { Question, SurveyReferences } from "../types";

export type SurveyGenerationReadyPayload = {
  blueprint: SurveyBlueprint;
};

export type SurveyGenerationClarificationPayload = {
  clarification: SurveyClarification;
  research: SurveyResearch;
};

export type SurveyGenerationBackgroundPayload = {
  responseId: string;
  jobToken?: string;
};

export type SurveyDraftRequest = {
  prompt: string;
  surveyMode: SurveyMode;
  targetGrade: string;
  questionCount: number;
  references: SurveyReferences;
  clientRequestId: string;
  signal: AbortSignal;
};

function serializeReferences(references: SurveyReferences) {
  return {
    images: references.images.map(({ name, dataUrl }) => ({ name, dataUrl })),
    files: references.files.map(({ fileToken }) => ({ fileToken })),
    links: references.links,
  };
}

/** Kicks off generation. May resolve to a finished draft, a question, or a background job. */
export async function requestSurveyDraft(input: SurveyDraftRequest) {
  const response = await fetch("/api/survey-draft", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-baroform-client-request-id": input.clientRequestId,
    },
    signal: input.signal,
    body: JSON.stringify({
      prompt: input.prompt,
      userInput: input.prompt,
      surveyMode: input.surveyMode,
      targetGrade: input.targetGrade,
      questionCount: input.questionCount,
      references: serializeReferences(input.references),
    }),
  });
  return readSurveyGenerationResponse<
    SurveyGenerationReadyPayload,
    SurveyGenerationClarificationPayload,
    SurveyGenerationBackgroundPayload
  >(response, "AI 초안을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
}

function backgroundStatusUrl(responseId: string, jobToken: string) {
  const url = new URL("/api/survey-draft", window.location.origin);
  url.searchParams.set("responseId", responseId);
  url.searchParams.set("jobToken", jobToken);
  return url;
}

export async function pollSurveyDraft(
  job: { responseId: string; jobToken: string },
  signal: AbortSignal,
) {
  const response = await fetch(backgroundStatusUrl(job.responseId, job.jobToken), {
    method: "GET",
    signal,
    cache: "no-store",
  });
  return readSurveyGenerationResponse<
    SurveyGenerationReadyPayload,
    SurveyGenerationClarificationPayload,
    SurveyGenerationBackgroundPayload
  >(response, "정밀·연구 설문 상태를 확인하지 못했어요.");
}

/**
 * Tells the server to stop a background job. Uses keepalive so it still lands
 * when the user navigates away in the same gesture.
 */
export function cancelSurveyDraft(job: { responseId: string; jobToken: string }) {
  return fetch(backgroundStatusUrl(job.responseId, job.jobToken), {
    method: "DELETE",
    keepalive: true,
  }).catch(() => undefined);
}

export async function reviseSurvey(input: {
  title: string;
  description: string;
  questions: Question[];
  instruction: string;
  targetGrade: string;
}) {
  const result = await sendJson<{
    title?: string;
    description?: string;
    questions?: Question[];
    message?: string;
  }>("/api/survey-revise", "POST", input);
  if (!result.title || !Array.isArray(result.questions)) {
    throw new Error("AI가 설문을 수정하지 못했어요.");
  }
  return {
    title: result.title,
    description: result.description ?? "",
    questions: result.questions,
    message: result.message || "요청한 내용으로 설문을 수정했어요.",
  };
}
