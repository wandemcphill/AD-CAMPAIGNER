"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeToSessionChanges } from "./lib/api-client";
import { loadAdminDashboard, type AdminDashboardData } from "./api";

export function useAdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await loadAdminDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load admin dashboard.");
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
