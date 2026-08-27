"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteSurvey as deleteSurveyRequest,
  fetchMySurveys,
  fetchPublicSurveys,
  fetchSurvey,
  recordExternalSurveyVisit,
} from "../data/surveys";
import { isUnauthorized } from "../data/http";
import { clearManagedSurveyIfSlug } from "../data/managed-survey";
import type { OwnedSurvey, PublicSurvey } from "../types";

/**
 * The survey lists every browse screen reads from, plus the currently opened one.
 * Loading and error flags are exposed so the UI can render whatever it likes for
 * "loading" and "failed" — the decision of *what* those states are lives here.
 */
export function useSurveyCatalog({
  authToken,
  onUnauthorized,
}: {
  authToken: string;
  onUnauthorized: () => void;
}) {
  const [publicSurveys, setPublicSurveys] = useState<PublicSurvey[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [mySurveys, setMySurveys] = useState<OwnedSurvey[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [mineError, setMineError] = useState("");
  const [activeSurvey, setActiveSurvey] = useState<PublicSurvey | null>(null);

  const refreshPublic = useCallback(async () => {
    setLoadingPublic(true);
    try {
      setPublicSurveys(await fetchPublicSurveys());
    } catch {
      setPublicSurveys([]);
    } finally {
      setLoadingPublic(false);
    }
  }, []);

  const refreshMine = useCallback(async (token: string) => {
    if (!token) {
      setMySurveys([]);
      setLoadingMine(false);
      return;
    }
    setLoadingMine(true);
    setMineError("");
    try {
      setMySurveys(await fetchMySurveys(token));
    } catch (loadError) {
      setMySurveys([]);
      setMineError(
        loadError instanceof Error
          ? loadError.message
          : "내 설문을 불러오지 못했어요.",
      );
    } finally {
      setLoadingMine(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.queueMicrotask(() => {
      if (!cancelled) void refreshPublic();
    });
    return () => {
      cancelled = true;
    };
  }, [refreshPublic]);

  const openSurveyBySlug = useCallback(async (slug: string) => {
    const survey = await fetchSurvey(slug);
    setActiveSurvey(survey);
    return survey;
  }, []);

  const visitExternalSurvey = useCallback(
    async (survey: PublicSurvey) => {
      try {
        await recordExternalSurveyVisit(survey.slug, authToken || undefined);
      } catch {
        // A missed visit count must not block opening the survey.
      }
      void refreshPublic();
    },
    [authToken, refreshPublic],
  );

  const removeOwnedSurvey = useCallback(
    async (survey: OwnedSurvey) => {
      try {
        await deleteSurveyRequest(authToken, survey.slug);
      } catch (deleteError) {
        if (isUnauthorized(deleteError)) onUnauthorized();
        throw deleteError;
      }
      setMySurveys((current) =>
        current.filter((item) => item.slug !== survey.slug),
      );
      setPublicSurveys((current) =>
        current.filter((item) => item.slug !== survey.slug),
      );
      setActiveSurvey((current) =>
        current?.slug === survey.slug ? null : current,
      );
      clearManagedSurveyIfSlug(survey.slug);
      void refreshPublic();
    },
    [authToken, onUnauthorized, refreshPublic],
  );

  /** Puts a freshly published survey at the top without waiting for a refetch. */
  const prependPublicSurvey = useCallback((survey: PublicSurvey) => {
    setPublicSurveys((current) => [
      survey,
      ...current.filter((item) => item.slug !== survey.slug),
    ]);
  }, []);

  return {
    publicSurveys,
    loadingPublic,
    mySurveys,
    loadingMine,
    mineError,
    activeSurvey,
    setActiveSurvey,
    refreshPublic,
    refreshMine,
    openSurveyBySlug,
    visitExternalSurvey,
    removeOwnedSurvey,
    prependPublicSurvey,
  };
}

export type SurveyCatalogController = ReturnType<typeof useSurveyCatalog>;
