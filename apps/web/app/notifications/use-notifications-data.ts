"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeToSessionChanges } from "../lib/api-client";
import { loadNotifications, type NotificationRecord } from "./api";

export function useNotificationsData() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      setNotifications(await loadNotifications());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications failed to load.");
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

  return { notifications, loading, error, refresh, setNotifications };
}
