import type { CurrencyCode, NotificationMessage } from "@fliptrybe/types";

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

export const managedAdsNotificationKinds = [
  "request_submitted",
  "review_approved",
  "launch_ready",
  "campaign_live",
  "performance_digest",
  "budget_attention"
] as const;

export type ManagedAdsNotificationKind = (typeof managedAdsNotificationKinds)[number];

export interface ManagedAdsNotificationMoney {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface ManagedAdsNotificationInput {
  workspaceId: string;
  kind: ManagedAdsNotificationKind;
  requestName: string;
  requestId?: string;
  campaignId?: string;
  provider?: "META" | "TIKTOK" | "GOOGLE" | "MANUAL";
  nextStatus?: string;
  amount?: ManagedAdsNotificationMoney;
  channel?: NotificationMessage["channel"];
}

function formatMoney(amount: ManagedAdsNotificationMoney) {
  return `${amount.currency} ${(amount.amountMinor / 100).toFixed(2)}`;
}

function managedAdsNotificationContent(input: ManagedAdsNotificationInput) {
  switch (input.kind) {
    case "request_submitted":
      return {
        title: "Managed ads request submitted",
        body: `${input.requestName} is queued for managed ads review.`
      };
    case "review_approved":
      return {
        title: "Managed ads request approved",
        body: `${input.requestName} is approved for launch planning.`
      };
    case "launch_ready":
      return {
        title: "Managed ads launch ready",
        body: `${input.requestName} is ready to launch${input.provider ? ` on ${input.provider}` : ""}.`
      };
    case "campaign_live":
      return {
        title: "Managed ads campaign live",
        body: `${input.requestName} is live${input.provider ? ` on ${input.provider}` : ""}.`
      };
    case "performance_digest":
      return {
        title: "Managed ads performance update",
        body: `${input.requestName} has a new performance snapshot.`
      };
    case "budget_attention":
      return {
        title: "Managed ads budget needs attention",
        body: `${input.requestName} budget needs review${
          input.amount ? ` at ${formatMoney(input.amount)}` : ""
        }.`
      };
  }
}

export function createManagedAdsNotification(
  input: ManagedAdsNotificationInput
): NotificationMessage {
  const content = managedAdsNotificationContent(input);

  return createNotification({
    workspaceId: input.workspaceId,
    channel: input.channel ?? "IN_APP",
    title: content.title,
    body: content.body
  });
}
