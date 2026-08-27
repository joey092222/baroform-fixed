"use client";

import { useEffect } from "react";
import { claimSurvey } from "../data/surveys";
import { readManagedSurvey } from "../data/managed-survey";

/**
 * Attaches a survey published while signed out to the account that just signed in.
 *
 * Without this, a visitor who published anonymously and then registered would
 * lose access to their own survey. Failure is normal — the survey may already
 * belong to another account — so it never surfaces an error.
 */
export function useSurveyClaim({
  authToken,
  onSettled,
}: {
  authToken: string;
  onSettled: (authToken: string) => void | Promise<void>;
}) {
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    const run = async () => {
      const snapshot = readManagedSurvey();
      if (snapshot) {
        try {
          await claimSurvey(authToken, {
            slug: snapshot.slug,
            manageToken: snapshot.manageToken,
          });
        } catch {
          // Already owned by someone else — nothing to recover.
        }
      }
      if (!cancelled) await onSettled(authToken);
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);
}
