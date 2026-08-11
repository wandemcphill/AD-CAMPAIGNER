"use client";

import { apiRequest } from "../lib/api-client";

export type NotificationRecord = {
  id: string;
  workspaceId: string;
  recipientUserId?: string | null;
  channel: string;
  category: string;
  priority: string;
  status: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreferenceRecord = {
  id: string;
  eventName: string;
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
};

export async function loadNotifications() {
  return apiRequest<NotificationRecord[]>("/notifications");
}

export async function markNotificationRead(id: string) {
  return apiRequest<NotificationRecord>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH"
  });
}

export async function markAllNotificationsRead() {
  return apiRequest<{ ok: boolean }>("/notifications/read-all", { method: "POST" });
}

export async function loadNotificationPreferences() {
  return apiRequest<NotificationPreferenceRecord[]>("/notifications/preferences");
}

export async function updateNotificationPreference(
  eventName: string,
  input: { inApp?: boolean; email?: boolean; sms?: boolean; whatsapp?: boolean }
) {
  return apiRequest<NotificationPreferenceRecord>(
    `/notifications/preferences/${encodeURIComponent(eventName)}`,
    { method: "PUT", body: JSON.stringify(input) }
  );
}

export function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}
