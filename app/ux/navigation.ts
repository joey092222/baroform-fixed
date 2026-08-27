/**
 * Which screens exist and how a URL maps onto them.
 * Pure — no React, no DOM — so entry handling is testable.
 */

export const appViews = [
  "landing",
  "home",
  "board",
  "pulses",
  "community",
  "workspace",
  "workspace-review",
  "mypage",
  "create",
  "editor",
  "published",
  "survey",
  "analytics",
] as const;

export type AppView = (typeof appViews)[number];

export function isAppView(value: string): value is AppView {
  return (appViews as readonly string[]).includes(value);
}

const reviewTokenPattern = /^[a-f0-9]{32}$/;

/** What the incoming URL is asking for, before any data is loaded. */
export type EntryIntent =
  | { kind: "landing" }
  | { kind: "app" }
  | { kind: "survey"; slug: string }
  | { kind: "workspace-review"; token: string };

export function readEntryIntent(search: string): EntryIntent {
  const params = new URLSearchParams(search);
  const reviewToken = params.get("workspaceReview") ?? "";
  if (reviewTokenPattern.test(reviewToken)) {
    return { kind: "workspace-review", token: reviewToken };
  }
  const slug = params.get("survey");
  if (slug) return { kind: "survey", slug };
  // 랜딩은 별도 사이트가 맡습니다. 이 앱의 루트는 광장이고, 랜딩을 보려면
  // ?landing=1 로 명시해야 합니다 — 예전 시안을 확인할 때만 씁니다.
  if (params.get("landing") === "1") return { kind: "landing" };
  return { kind: "app" };
}

/** The URL that should be showing for a given view. */
export function urlForView(view: AppView, pathname: string) {
  return view === "landing" ? `${pathname}?landing=1` : pathname;
}

/** The survey view owns its own `?survey=` URL, so navigation leaves it alone. */
export function viewOwnsItsUrl(view: AppView) {
  return view === "survey";
}
