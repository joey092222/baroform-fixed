import { getJson, sendJson } from "./http";
import type { AuthUser } from "../types";

export const authTokenStorageKey = "baroform:session-token";

export type AuthMode = "login" | "register";

export type AuthCredentials = {
  email: string;
  password: string;
  name?: string;
  schoolId?: string;
};

export async function authenticate(mode: AuthMode, credentials: AuthCredentials) {
  const result = await sendJson<{ token?: string; user?: AuthUser }>(
    `/api/auth/${mode}`,
    "POST",
    credentials,
  );
  if (!result.token || !result.user) {
    throw new Error("로그인 정보를 확인하지 못했어요.");
  }
  return { token: result.token, user: result.user };
}

export async function fetchSession(authToken: string) {
  const result = await getJson<{ user?: AuthUser }>("/api/auth/session", {
    authToken,
  });
  if (!result.user) throw new Error("세션을 확인하지 못했어요.");
  return result.user;
}

export function endSession(authToken: string) {
  return sendJson("/api/auth/session", "DELETE", undefined, { authToken });
}

export function readStoredAuthToken() {
  try {
    return window.localStorage.getItem(authTokenStorageKey) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredAuthToken(token: string) {
  try {
    window.localStorage.setItem(authTokenStorageKey, token);
  } catch {
    // Private browsing can reject storage writes; the session still works in memory.
  }
}

export function clearStoredAuthToken() {
  try {
    window.localStorage.removeItem(authTokenStorageKey);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
