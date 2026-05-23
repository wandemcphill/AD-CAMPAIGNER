"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  clearStoredToken,
  fetchCurrentSession,
  getStoredToken,
  login,
  logout,
  register,
  subscribeToSessionChanges,
  type ApiSession,
  type AuthCredentials
} from "./api-client";

export function useApiSession() {
  const [session, setSession] = useState<ApiSession>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setSession(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setSession(await fetchCurrentSession());
      setError(undefined);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 401) {
        clearStoredToken();
      }
      setSession(undefined);
      setError(caught instanceof Error ? caught.message : "Could not load the current session.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  const signIn = useCallback(async (credentials: AuthCredentials) => {
    setLoading(true);
    try {
      const result = await login(credentials);
      setSession(result.session);
      setError(undefined);

      return result.session;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Login failed.";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (credentials: AuthCredentials) => {
    setLoading(true);
    try {
      const result = await register(credentials);
      setSession(result.session);
      setError(undefined);

      return result.session;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Registration failed.";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await logout();
      setSession(undefined);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Logout failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { error, loading, refresh, session, signIn, signOut, signUp };
}
