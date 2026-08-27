"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readEntryIntent,
  urlForView,
  viewOwnsItsUrl,
  type AppView,
  type EntryIntent,
} from "../navigation";

/**
 * Which screen is showing, and keeping the URL in step with it.
 *
 * Deliberately knows nothing about data loading or overlays: it reports the
 * entry intent and each navigation, and the composition layer reacts.
 */
export function useNavigation({
  initialView,
  onEntry,
  onNavigate,
  resetScroll = true,
}: {
  initialView: AppView;
  onEntry?: (intent: EntryIntent) => void;
  onNavigate?: (view: AppView) => void;
  resetScroll?: boolean;
}) {
  const [view, setView] = useState<AppView>(initialView);
  const [workspaceReviewToken, setWorkspaceReviewToken] = useState("");

  // Read the incoming URL once, then hand the intent to the caller.
  // Deferred to a microtask so the first paint is not a cascading re-render.
  useEffect(() => {
    let cancelled = false;
    window.queueMicrotask(() => {
      if (cancelled) return;
      const intent = readEntryIntent(window.location.search);
      if (intent.kind === "workspace-review") {
        setWorkspaceReviewToken(intent.token);
        setView("workspace-review");
      }
      onEntry?.(intent);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browser back/forward re-derives the view from the URL.
  useEffect(() => {
    const syncFromUrl = () => {
      const intent = readEntryIntent(window.location.search);
      if (intent.kind === "workspace-review") {
        setWorkspaceReviewToken(intent.token);
        setView("workspace-review");
        return;
      }
      if (intent.kind === "survey") return;
      setView(intent.kind === "app" ? "home" : "landing");
      if (resetScroll) window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [resetScroll]);

  const navigate = useCallback(
    (nextView: AppView) => {
      setView(nextView);
      onNavigate?.(nextView);
      if (!viewOwnsItsUrl(nextView)) {
        const nextUrl = urlForView(nextView, window.location.pathname);
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== nextUrl) {
          window.history.replaceState({}, "", nextUrl);
        }
      }
      if (resetScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onNavigate, resetScroll],
  );

  /** Crossing from the marketing page into the app — a real history entry. */
  const enterApp = useCallback(
    (destination: AppView = "home") => {
      window.history.pushState(
        { baroformEntry: "app" },
        "",
        `${window.location.pathname}?app=1`,
      );
      setView(destination);
      onNavigate?.(destination);
      if (resetScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onNavigate, resetScroll],
  );

  /** Replaces the URL with a shareable survey link without a navigation. */
  const showSurveyUrl = useCallback((slug: string) => {
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?survey=${slug}`,
    );
  }, []);

  const exitWorkspaceReview = useCallback(() => {
    setWorkspaceReviewToken("");
    window.history.replaceState({}, "", window.location.pathname);
    setView("landing");
    if (resetScroll) window.scrollTo({ top: 0 });
  }, [resetScroll]);

  return {
    view,
    setView,
    navigate,
    enterApp,
    showSurveyUrl,
    workspaceReviewToken,
    setWorkspaceReviewToken,
    exitWorkspaceReview,
  };
}

export type NavigationController = ReturnType<typeof useNavigation>;
