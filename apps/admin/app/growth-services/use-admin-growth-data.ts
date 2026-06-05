"use client";

import { useCallback, useEffect, useState } from "react";

import {
  defaultState,
  loadAdminGrowthData,
  subscribeToSessionChanges,
  type AdminGrowthState
} from "./api";

export function useAdminGrowthData() {
  const [state, setState] = useState<AdminGrowthState>({
    ...defaultState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => {
      const next = { ...current };

      delete next.error;

      return { ...next, loading: true };
    });

    try {
      setState(await loadAdminGrowthData());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Growth admin data failed.";

      setState({
        ...defaultState,
        error: message,
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

  return {
    ...state,
    refresh
  };
}
