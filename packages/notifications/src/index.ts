import type { NotificationMessage } from "@fliptrybe/types";

export function createNotification(
  input: Omit<NotificationMessage, "id" | "createdAt" | "updatedAt">
): NotificationMessage {
  const now = new Date().toISOString();

  return {
    ...input,
    id: `ntf_${Math.random().toString(36).slice(2, 12)}`,
    createdAt: now,
    updatedAt: now
  };
}
