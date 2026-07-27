"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeToSessionChanges } from "../lib/api-client";
import { loadOtpDashboard, type OtpDashboardData } from "./api";

export function useOtpDashboard() {
  const [data, setData] = useState<OtpDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await loadOtpDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load OTP marketplace.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { data, error, isLoading, refresh };
}
