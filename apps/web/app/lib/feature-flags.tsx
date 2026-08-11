"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { apiRequest } from "./api-client";

/**
 * Client-side mirror of the API's runtime feature flags.
 *
 * The API resolves flags from `FEATURE_*` environment variables at process
 * start (see packages/feature-flags). A browser bundle cannot read those, so it
 * fetches the resolved set once from `GET /v1/platform/feature-flags` and uses
 * it to hide navigation and screens for verticals this deployment does not run.
 * Without this the sidebar links to endpoints that answer 503.
 *
 * Until the fetch resolves, `ready` is false and `isEnabled` returns false, so
 * nothing flashes into view and then disappears. A failed fetch leaves every
 * flag off rather than guessing — an unreachable API means the vertical would
 * not work anyway.
 */
export type FeatureFlagMap = Record<string, boolean>;

interface FeatureFlagState {
  flags: FeatureFlagMap;
  ready: boolean;
  error?: string;
}

const FeatureFlagContext = createContext<FeatureFlagState>({ flags: {}, ready: false });

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FeatureFlagState>({ flags: {}, ready: false });

  useEffect(() => {
    let cancelled = false;

    apiRequest<{ flags: FeatureFlagMap }>("/platform/feature-flags")
      .then((response) => {
        if (!cancelled) {
          setState({ flags: response.flags ?? {}, ready: true });
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setState({
            flags: {},
            ready: true,
            error: caught instanceof Error ? caught.message : "Feature flags unavailable."
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <FeatureFlagContext.Provider value={state}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

/** True only once flags have loaded AND the named flag is on. */
export function useFeatureEnabled(flag: string) {
  const { flags, ready } = useFeatureFlags();
  return ready && flags[flag] === true;
}

/** Filters a list by an optional `flag` field; entries without one always pass. */
export function useFlagFilter<T extends { flag?: string }>(items: T[]) {
  const { flags, ready } = useFeatureFlags();

  return useMemo(
    () => items.filter((item) => !item.flag || (ready && flags[item.flag] === true)),
    [items, flags, ready]
  );
}
