"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { submitSurveyResponse } from "../data/surveys";
import {
  answerProgress,
  answerableQuestions,
  buildResponsePayload,
  completionSeconds,
  firstMissingRequired,
  toggleChoiceAnswer,
  type AnswerMap,
  type AnswerValue,
} from "../survey-response";
import type { PublicSurvey, Question, SurveyReward } from "../types";

export type SurveyResponseOutcome = {
  /** Which question blocked submission, so the UI can bring it into view. */
  blockedQuestion: Question | null;
  reward: SurveyReward | null;
};

/**
 * Answering one survey. Everything a respondent screen needs and nothing else —
 * no markup decisions, no scroll behavior (the caller reacts to `blockedQuestionId`).
 */
export function useSurveyResponse({
  survey,
  authToken,
  onRewarded,
}: {
  survey: PublicSurvey;
  authToken: string;
  onRewarded?: () => void;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [blockedQuestionId, setBlockedQuestionId] = useState<number | null>(null);
  const [reward, setReward] = useState<SurveyReward | null>(null);
  const startedAtRef = useRef(0);

  const questions = useMemo(() => survey.questions ?? [], [survey.questions]);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [survey.slug]);

  const progress = useMemo(
    () => answerProgress(questions, answers),
    [answers, questions],
  );

  const setAnswer = useCallback((questionId: number, value: AnswerValue) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }, []);

  const toggleChoice = useCallback((questionId: number, choice: string) => {
    setAnswers((current) => toggleChoiceAnswer(current, questionId, choice));
  }, []);

  const submit = useCallback(async (): Promise<SurveyResponseOutcome> => {
    const missing = firstMissingRequired(questions, answers);
    if (missing) {
      setError(`필수 질문 “${missing.title}”에 응답해주세요.`);
      setBlockedQuestionId(missing.id);
      return { blockedQuestion: missing, reward: null };
    }

    setBlockedQuestionId(null);
    setSubmitting(true);
    setError("");
    try {
      const earned = await submitSurveyResponse(
        survey.slug,
        {
          answers: buildResponsePayload(questions, answers),
          completionSeconds: completionSeconds(startedAtRef.current, Date.now()),
        },
        authToken || undefined,
      );
      setReward(earned);
      setSubmitted(true);
      if ((earned?.amount ?? 0) > 0) onRewarded?.();
      return { blockedQuestion: null, reward: earned };
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "응답을 저장하지 못했어요.",
      );
      return { blockedQuestion: null, reward: null };
    } finally {
      setSubmitting(false);
    }
  }, [answers, authToken, onRewarded, questions, survey.slug]);

  return {
    questions,
    answerableCount: answerableQuestions(questions).length,
    answers,
    progress,
    submitting,
    submitted,
    error,
    blockedQuestionId,
    reward,
    canSubmit: questions.length > 0 && !submitting,
    setAnswer,
    toggleChoice,
    submit,
  };
}

export type SurveyResponseController = ReturnType<typeof useSurveyResponse>;
