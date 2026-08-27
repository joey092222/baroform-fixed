import type { ManagedSurveySnapshot, Question } from "../types";

/**
 * The handle to the most recently published survey, kept locally so a visitor
 * who published before signing in can still reach their results — and so the
 * survey can be claimed onto the account at sign-in.
 */

const storageKey = "baroform:last-managed-survey";
const slugPattern = /^[a-f0-9]{12}$/;
const manageTokenPattern = /^[a-f0-9]{32}$/;
const maxStoredTitleLength = 100;
const maxStoredQuestions = 30;

export function isValidSurveySlug(value: unknown): value is string {
  return typeof value === "string" && slugPattern.test(value);
}

export function isValidManageToken(value: unknown): value is string {
  return typeof value === "string" && manageTokenPattern.test(value);
}

export function readManagedSurvey(): ManagedSurveySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const snapshot = JSON.parse(stored) as Partial<ManagedSurveySnapshot>;
    if (
      !isValidSurveySlug(snapshot.slug) ||
      !isValidManageToken(snapshot.manageToken) ||
      typeof snapshot.title !== "string" ||
      !Array.isArray(snapshot.questions)
    ) {
      clearManagedSurvey();
      return null;
    }
    return {
      slug: snapshot.slug,
      manageToken: snapshot.manageToken,
      title: snapshot.title.slice(0, maxStoredTitleLength),
      questions: (snapshot.questions as Question[]).slice(0, maxStoredQuestions),
    };
  } catch {
    clearManagedSurvey();
    return null;
  }
}

export function writeManagedSurvey(snapshot: ManagedSurveySnapshot) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // Losing the local handle is recoverable once the user signs in.
  }
}

export function clearManagedSurvey() {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

export function clearManagedSurveyIfSlug(slug: string) {
  const snapshot = readManagedSurvey();
  if (snapshot?.slug === slug) clearManagedSurvey();
}
