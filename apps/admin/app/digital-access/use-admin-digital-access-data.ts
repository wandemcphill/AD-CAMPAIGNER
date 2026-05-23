"use client";

import { useCallback, useEffect, useState } from "react";

import {
  defaultState,
  loadAdminDigitalAccessData,
  subscribeToSessionChanges,
  type AdminDigitalAccessState
} from "./api";

export function useAdminDigitalAccessData() {
  const [state, setState] = useState<AdminDigitalAccessState>({
    ...defaultState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadAdminDigitalAccessData());
    } catch (caught) {
      setState({
        ...defaultState,
        error: caught instanceof Error ? caught.message : "Digital Access admin API is unavailable.",
        loading: false,
        source: "fallback"
      });
    }
  }, []);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, refresh };
}
