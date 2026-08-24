export type OperationalEvent =
  | "transaction.created"
  | "transaction.pending"
  | "transaction.succeeded"
  | "transaction.failed"
  | "transaction.reversed"
  | "kyc.pending"
  | "kyc.approved"
  | "kyc.rejected"
  | "security.alert"
  | "card.issued"
  | "giftcard.delivered"
  | "travel.booked"
  | "campaign.updated";

export type OperationalSeverity = "info" | "warning" | "critical";

export interface OperationalNotification {
  event: OperationalEvent;
  severity: OperationalSeverity;
  userId: string;
  transactionId?: string;
  title: string;
  message: string;
  dedupeKey: string;
  channels: Array<"in_app" | "email" | "sms" | "whatsapp">;
}

const CRITICAL_EVENTS = new Set<OperationalEvent>([
  "transaction.failed",
  "transaction.reversed",
  "security.alert",
  "kyc.rejected"
]);

export function notificationSeverity(event: OperationalEvent): OperationalSeverity {
  return CRITICAL_EVENTS.has(event) ? "critical" : event.endsWith("pending") ? "warning" : "info";
}

export function buildNotificationDedupeKey(input: {
  userId: string;
  event: OperationalEvent;
  resourceId?: string;
}): string {
  if (!input.userId) throw new Error("Notification dedupe keys require userId");
  return `ft:notify:${input.userId}:${input.event}:${input.resourceId ?? "account"}`;
}

export function createOperationalNotification(input: Omit<OperationalNotification, "severity" | "dedupeKey"> & { resourceId?: string }): OperationalNotification {
  const dedupeKeyInput: { userId: string; event: OperationalEvent; resourceId?: string } = {
    userId: input.userId,
    event: input.event
  };
  if (input.resourceId !== undefined) dedupeKeyInput.resourceId = input.resourceId;

  return {
    ...input,
    severity: notificationSeverity(input.event),
    dedupeKey: buildNotificationDedupeKey(dedupeKeyInput)
  };
}

export interface SupportContext {
  userId: string;
  transactionId?: string;
  provider?: string;
  providerReference?: string;
  failureClass?: "retryable" | "unknown_delivery" | "rejected" | "configuration";
  nextAction: "retry" | "reconcile" | "review" | "contact_support";
}

export function supportActionForFailure(failureClass: SupportContext["failureClass"]): SupportContext["nextAction"] {
  switch (failureClass) {
    case "retryable": return "retry";
    case "unknown_delivery": return "reconcile";
    case "rejected": return "contact_support";
    default: return "review";
  }
}
