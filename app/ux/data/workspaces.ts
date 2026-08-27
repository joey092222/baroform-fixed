import { getJson, sendJson } from "./http";
import type {
  CollaborationWorkspace,
  ReviewWorkspace,
} from "../workspace-types";

export async function fetchWorkspaces(authToken: string) {
  const result = await getJson<{ workspaces?: CollaborationWorkspace[] }>(
    "/api/workspaces",
    { authToken },
  );
  return result.workspaces ?? [];
}

export type WorkspaceActionResult = {
  workspaceId?: string;
  /** True when an invited member has not signed up yet. */
  pending?: boolean;
};

/** All mutations share one endpoint; `payload.action` selects the operation. */
export function runWorkspaceAction(
  authToken: string,
  payload: Record<string, unknown>,
) {
  return sendJson<WorkspaceActionResult>(
    "/api/workspaces",
    "POST",
    payload,
    { authToken },
  );
}

/** Token-only access: reviewers never sign in. */
export async function fetchWorkspaceReview(token: string) {
  const result = await getJson<{ review?: ReviewWorkspace }>(
    `/api/workspaces?reviewToken=${encodeURIComponent(token)}`,
  );
  if (!result.review) throw new Error("검토 공간을 불러오지 못했어요.");
  return result.review;
}
