"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JsonResponseError } from "../../lib/http/json-response";
import {
  surveyGenerationErrorMessage,
  surveyGenerationErrorMetadata,
  type SurveyGenerationFailureStage,
} from "../../survey-generation-client";
import { defaultSurveyMode, type SurveyMode } from "../../survey-mode";
import type { SurveyClarification, SurveyResearch } from "../../survey-ai";
import {
  cancelSurveyDraft,
  pollSurveyDraft,
  requestSurveyDraft,
} from "../data/survey-draft";
import { recordGenerationDuration } from "../data/generation-history";
import {
  hasSurveyReferences,
  type Question,
  type SurveyReferences,
} from "../types";

export const maxPromptLength = 300;
export const minPromptLength = 2;
export const backgroundPollIntervalMs = 2_000;

/** Used when the user attached files but wrote nothing. */
export const referenceOnlyPrompt =
  "첨부 자료를 바탕으로 만족도와 개선점을 조사하고 싶어요.";

export type ClarificationState = {
  prompt: string;
  clarification: SurveyClarification;
  research: SurveyResearch;
};

/** Why a start() call refused to run, so the UI can point at the right control. */
export type GenerationRejection =
  | { reason: "empty-input"; message: string }
  | { reason: "too-long"; message: string }
  | { reason: "already-running"; message: string };

export type GenerationStartResult =
  | { status: "started" }
  | { status: "rejected"; rejection: GenerationRejection };

function waitForBackgroundPoll(signal: AbortSignal, delayMs: number) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    function onAbort() {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * The AI generation flow: request, optional clarification, optional background
 * polling, cancellation, and error reporting.
 *
 * Contract a replacement UI must honor: while `isGenerating` is true, offer
 * `cancel()` — it is what tells the server to drop a background job.
 */
export function useSurveyGeneration({
  surveyMode,
  targetGrade,
  questionCount,
  references,
  onReady,
  onError,
}: {
  surveyMode: SurveyMode;
  targetGrade: string;
  questionCount: number;
  references: SurveyReferences;
  onReady: (draft: {
    title: string;
    description: string;
    questions: Question[];
    prompt: string;
  }) => void;
  onError: (message: string) => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [clarification, setClarification] = useState<ClarificationState | null>(
    null,
  );
  const requestRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const backgroundJobRef = useRef<{
    responseId: string;
    jobToken: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  /** Any edit to the inputs invalidates an in-flight or pending result. */
  const invalidate = useCallback(() => {
    requestRef.current += 1;
    setClarification(null);
    setIsGenerating(false);
  }, []);

  const start = useCallback(
    async (rawPrompt: string): Promise<GenerationStartResult> => {
      if (inFlightRef.current) {
        return {
          status: "rejected",
          rejection: {
            reason: "already-running",
            message: "이미 설문을 만들고 있어요.",
          },
        };
      }

      const enteredPrompt = rawPrompt.trim();
      if (!enteredPrompt && !hasSurveyReferences(references)) {
        return {
          status: "rejected",
          rejection: {
            reason: "empty-input",
            message: "설문 내용을 적거나 참고할 사진·파일·링크를 추가해주세요.",
          },
        };
      }
      if (enteredPrompt.length > maxPromptLength) {
        return {
          status: "rejected",
          rejection: {
            reason: "too-long",
            message: `설문 내용은 ${maxPromptLength}자 이하로 적어주세요.`,
          },
        };
      }

      const requestedPrompt = enteredPrompt || referenceOnlyPrompt;
      const selectedSurveyMode: SurveyMode =
        surveyMode === "research" ? "research" : defaultSurveyMode;
      const clientRequestId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const startedAt = Date.now();
      let failureStage: SurveyGenerationFailureStage = "initial-request";

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      inFlightRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      backgroundJobRef.current = null;
      setIsGenerating(true);
      setClarification(null);

      try {
        let result = await requestSurveyDraft({
          prompt: requestedPrompt,
          surveyMode: selectedSurveyMode,
          targetGrade,
          questionCount,
          references,
          clientRequestId,
          signal: controller.signal,
        });

        if (result.type === "background" && result.jobToken) {
          const job = {
            responseId: result.responseId,
            jobToken: result.jobToken,
          };
          backgroundJobRef.current = job;
          failureStage = "background-poll";
          while (
            result.type === "background" &&
            (result.status === "queued" || result.status === "in_progress")
          ) {
            await waitForBackgroundPoll(
              controller.signal,
              backgroundPollIntervalMs,
            );
            result = await pollSurveyDraft(job, controller.signal);
          }
          backgroundJobRef.current = null;
        }

        // A newer request (or a cancel) superseded this one.
        if (requestRef.current !== requestId) return { status: "started" };

        if (result.type === "error") {
          throw new JsonResponseError(
            result.error || "AI 초안을 만들지 못했어요.",
            {
              code: result.code ?? "SERVER_REQUEST_FAILED",
              status: 502,
              requestId: result.requestId,
              stage: result.stage,
              generationSource: result.generationSource,
              fallbackReason: result.fallbackReason,
              responseType: result.type,
              responseStatus: result.status,
            },
          );
        }

        if (result.type === "clarification") {
          setClarification({
            prompt: requestedPrompt,
            clarification: result.clarification,
            research: result.research,
          });
          return { status: "started" };
        }

        if (result.type === "background") {
          throw new JsonResponseError(
            `백그라운드 설문 생성 상태를 적용할 수 없어요: ${result.status}`,
            {
              code: "BACKGROUND_RESPONSE_UNRESOLVED",
              status: 502,
              requestId: result.requestId,
              stage: result.stage,
              generationSource: result.generationSource,
              fallbackReason: result.fallbackReason,
              responseType: result.type,
              responseStatus: result.status,
            },
          );
        }

        failureStage = "response-apply";
        recordGenerationDuration(
          selectedSurveyMode,
          Math.ceil((Date.now() - startedAt) / 1_000),
        );
        onReady({
          title: result.blueprint.title,
          description: result.blueprint.description,
          questions: result.blueprint.aiQuestions,
          prompt: requestedPrompt,
        });
        return { status: "started" };
      } catch (generationError) {
        if (requestRef.current !== requestId) return { status: "started" };
        console.error(
          "survey-generation-client-error",
          surveyGenerationErrorMetadata(
            generationError,
            selectedSurveyMode,
            failureStage,
            clientRequestId,
          ),
        );
        onError(surveyGenerationErrorMessage(generationError));
        return { status: "started" };
      } finally {
        inFlightRef.current = false;
        if (abortRef.current === controller) abortRef.current = null;
        backgroundJobRef.current = null;
        if (requestRef.current === requestId) setIsGenerating(false);
      }
    },
    [onError, onReady, questionCount, references, surveyMode, targetGrade],
  );

  /** Stops the client request and asks the server to drop any background job. */
  const cancel = useCallback(() => {
    if (!inFlightRef.current) return false;
    const job = backgroundJobRef.current;
    requestRef.current += 1;
    inFlightRef.current = false;
    backgroundJobRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    if (job) void cancelSurveyDraft(job);
    return true;
  }, []);

  const answerClarification = useCallback(
    (answer: string) => {
      const current = clarification;
      if (!current) return null;
      const nextPrompt = `${current.prompt} — 추가 설명: ${answer}`;
      setClarification(null);
      void start(nextPrompt);
      return nextPrompt;
    },
    [clarification, start],
  );

  const dismissClarification = useCallback(() => setClarification(null), []);

  return {
    isGenerating,
    clarification,
    start,
    cancel,
    invalidate,
    answerClarification,
    dismissClarification,
  };
}

export type SurveyGenerationController = ReturnType<typeof useSurveyGeneration>;
