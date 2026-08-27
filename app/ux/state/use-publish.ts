"use client";

import { useCallback, useState } from "react";
import { isUnauthorized } from "../data/http";
import { createSurvey, type CreatedSurvey } from "../data/surveys";
import { writeManagedSurvey } from "../data/managed-survey";
import { surveyAudienceLabel, type TargetGrade } from "../../survey-grade";
import type { SurveyCategory } from "../../survey-board";
import type { PublicSurvey, Question } from "../types";

export type PublishInput = {
  ownerName: string;
  listingRequested: boolean;
  category: SurveyCategory;
  /** 0 이면 목표를 정하지 않은 것 — 링크만 배포하는 경우입니다. */
  targetResponses: number;
};

export type PublishOutcome =
  | { status: "published"; survey: PublicSurvey; created: CreatedSurvey }
  | { status: "requires-auth" }
  | { status: "failed"; message: string };

/**
 * Turning a draft into a live, shareable survey.
 *
 * Publishing requires an account; responding never does. When publishing is
 * attempted while signed out, the flow parks itself (`pendingAfterAuth`) so the
 * UI can resume it after sign-in instead of losing the draft.
 */
export function usePublish({
  authToken,
  isSignedIn,
  onUnauthorized,
}: {
  authToken: string;
  isSignedIn: boolean;
  onUnauthorized: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [publishedSlug, setPublishedSlug] = useState("");
  const [manageToken, setManageToken] = useState("");
  const [listingRequested, setListingRequested] = useState(false);
  const [pendingAfterAuth, setPendingAfterAuth] = useState(false);

  const publish = useCallback(
    async (
      input: PublishInput,
      draft: {
        title: string;
        description: string;
        questions: Question[];
        targetGrade: TargetGrade;
      },
    ): Promise<PublishOutcome> => {
      if (!isSignedIn || !authToken) {
        setPendingAfterAuth(true);
        return { status: "requires-auth" };
      }

      setPublishing(true);
      setError("");
      try {
        const created = await createSurvey(authToken, {
          title: draft.title,
          description: draft.description,
          ownerName: input.ownerName,
          questions: draft.questions,
          listingRequested: input.listingRequested,
          category: input.category,
          targetAudience: surveyAudienceLabel(draft.targetGrade),
          targetResponses: input.targetResponses,
        });

        const survey: PublicSurvey = {
          slug: created.slug,
          title: created.title,
          description: created.description,
          ownerName: created.ownerName,
          schoolId: created.schoolId,
          category: created.category,
          campus: created.campus,
          durationMinutes: created.durationMinutes,
          rewardCash: created.rewardCash ?? 30,
          targetAudience:
            created.targetAudience || surveyAudienceLabel(draft.targetGrade),
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          questions: draft.questions,
        };

        setPublishedSlug(created.slug);
        setManageToken(created.manageToken);
        setListingRequested(created.listingRequested);
        writeManagedSurvey({
          slug: created.slug,
          manageToken: created.manageToken,
          title: created.title,
          questions: draft.questions,
        });

        return { status: "published", survey, created };
      } catch (publishError) {
        if (isUnauthorized(publishError)) onUnauthorized();
        const message =
          publishError instanceof Error
            ? publishError.message
            : "공개 링크를 만들지 못했어요.";
        setError(message);
        return { status: "failed", message };
      } finally {
        setPublishing(false);
      }
    },
    [authToken, isSignedIn, onUnauthorized],
  );

  /** Points the results flow at an already-published survey the user owns. */
  const adoptOwnedSurvey = useCallback(
    (survey: { slug: string; manageToken: string }) => {
      setPublishedSlug(survey.slug);
      setManageToken(survey.manageToken);
    },
    [],
  );

  const forgetIfSlug = useCallback((slug: string) => {
    setPublishedSlug((current) => (current === slug ? "" : current));
    setManageToken((current) => (publishedSlug === slug ? "" : current));
  }, [publishedSlug]);

  return {
    publishing,
    error,
    publishedSlug,
    manageToken,
    listingRequested,
    pendingAfterAuth,
    setPendingAfterAuth,
    setError,
    publish,
    adoptOwnedSurvey,
    forgetIfSlug,
  };
}

export type PublishController = ReturnType<typeof usePublish>;
