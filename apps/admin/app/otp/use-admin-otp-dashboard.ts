"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeToSessionChanges } from "../lib/api-client";
import { loadAdminOtpDashboard, type AdminOtpDashboardData } from "./api";

export function useAdminOtpDashboard() {
  const [data, setData] = useState<AdminOtpDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await loadAdminOtpDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load admin OTP dashboard.");
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
