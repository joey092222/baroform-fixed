"use client";

import { useCallback, useEffect, useState } from "react";
import {
  authenticate,
  clearStoredAuthToken,
  endSession,
  fetchSession,
  readStoredAuthToken,
  writeStoredAuthToken,
  type AuthCredentials,
  type AuthMode,
} from "../data/auth";
import { emptyWallet, fetchWallet } from "../data/wallet";
import type { AuthUser, WalletData } from "../types";

/**
 * Who is signed in, and their cash balance.
 * `signOutLocally` exists so any 401 anywhere can drop the session without a round trip.
 */
export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [wallet, setWallet] = useState<WalletData>(emptyWallet);
  const [restoring, setRestoring] = useState(true);

  const refreshWallet = useCallback(async (token: string) => {
    if (!token) {
      setWallet(emptyWallet);
      return;
    }
    try {
      setWallet(await fetchWallet(token));
    } catch {
      setWallet(emptyWallet);
    }
  }, []);

  // Restore a stored token once on mount, dropping it if the server rejects it.
  useEffect(() => {
    let cancelled = false;
    window.queueMicrotask(() => {
      if (cancelled) return;
      const storedToken = readStoredAuthToken();
      if (!storedToken) {
        setRestoring(false);
        return;
      }
      fetchSession(storedToken)
        .then((sessionUser) => {
          if (cancelled) return;
          setAuthToken(storedToken);
          setUser(sessionUser);
        })
        .catch(() => {
          clearStoredAuthToken();
          if (!cancelled) setAuthToken("");
        })
        .finally(() => {
          if (!cancelled) setRestoring(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((token: string, nextUser: AuthUser) => {
    writeStoredAuthToken(token);
    setAuthToken(token);
    setUser(nextUser);
  }, []);

  const submitCredentials = useCallback(
    async (mode: AuthMode, credentials: AuthCredentials) => {
      const result = await authenticate(mode, credentials);
      signIn(result.token, result.user);
      return result.user;
    },
    [signIn],
  );

  /** Clears local session state without calling the server (used on any 401). */
  const signOutLocally = useCallback(() => {
    setUser(null);
    setAuthToken("");
    setWallet(emptyWallet);
    clearStoredAuthToken();
  }, []);

  const signOut = useCallback(() => {
    const token = authToken;
    signOutLocally();
    if (token) void endSession(token).catch(() => undefined);
  }, [authToken, signOutLocally]);

  return {
    user,
    authToken,
    wallet,
    restoring,
    isSignedIn: Boolean(user && authToken),
    signIn,
    submitCredentials,
    signOut,
    signOutLocally,
    refreshWallet,
  };
}

export type SessionController = ReturnType<typeof useSession>;
