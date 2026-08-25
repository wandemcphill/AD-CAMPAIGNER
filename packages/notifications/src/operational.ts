import type { NotificationMessage } from "@fliptrybe/types";

import { createNotification } from "./index.js";

export const operationalEventKinds = [
  "TRANSACTION_PROCESSING",
  "TRANSACTION_COMPLETED",
  "TRANSACTION_FAILED",
  "TRANSACTION_REVIEW",
  "TRANSACTION_REVERSED",
  "VERIFICATION_REQUIRED",
  "VERIFICATION_COMPLETED",
  "VERIFICATION_REJECTED",
  "SECURITY_ALERT",
  "CARD_READY",
  "GIFT_CARD_READY",
  "TRAVEL_CONFIRMED",
  "CAMPAIGN_LIVE",
  "SUPPORT_UPDATE"
] as const;

export type OperationalEventKind = (typeof operationalEventKinds)[number];

export interface OperationalNotificationInput {
  workspaceId: string;
  kind: OperationalEventKind;
  title: string;
  body: string;
  actionHref?: string;
  channel?: NotificationMessage["channel"];
}

/** Build notifications only after the corresponding durable state transition. */
export function createOperationalNotification(
  input: OperationalNotificationInput
): NotificationMessage {
  return createNotification({
    workspaceId: input.workspaceId,
    channel: input.channel ?? "IN_APP",
    title: input.title,
    body: input.actionHref ? `${input.body} ${input.actionHref}` : input.body
  });
}

export function isSecurityNotification(kind: OperationalEventKind): boolean {
  return kind === "SECURITY_ALERT";
}

export function isFinancialOutcomeNotification(kind: OperationalEventKind): boolean {
  return (
    kind === "TRANSACTION_COMPLETED" ||
    kind === "TRANSACTION_FAILED" ||
    kind === "TRANSACTION_REVIEW" ||
    kind === "TRANSACTION_REVERSED"
  );
}

export function defaultOperationalEventName(kind: OperationalEventKind): string {
  return kind.toLowerCase();
}
