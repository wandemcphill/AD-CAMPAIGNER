"use client";

import { useCallback, useEffect, useState } from "react";

import {
  defaultState,
  loadDigitalAccessData,
  subscribeToSessionChanges,
  type DigitalAccessState
} from "./api";

export function useDigitalAccessData({ includeRequests = true } = {}) {
  const [state, setState] = useState<DigitalAccessState>({
    ...defaultState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadDigitalAccessData(includeRequests));
    } catch (caught) {
      setState({
        ...defaultState,
        error: caught instanceof Error ? caught.message : "Digital Access API is unavailable.",
        loading: false,
        source: "fallback"
      });
    }
  }, [includeRequests]);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, refresh };
}
