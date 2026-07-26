"use client";

import { useCallback, useEffect, useState } from "react";

import { defaultState, loadGrowthData, subscribeToSessionChanges, type GrowthState } from "./api";

export function useGrowthData(includeOrders = true) {
  const [state, setState] = useState<GrowthState>({
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
      setState(await loadGrowthData(includeOrders));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Growth Services data failed.";

      setState({
        ...defaultState,
        error: message,
        loading: false,
        source: "fallback"
      });
    }
  }, [includeOrders]);

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
