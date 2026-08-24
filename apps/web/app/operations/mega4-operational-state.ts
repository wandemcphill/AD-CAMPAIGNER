export type OperationalSeverity = "info" | "success" | "warning" | "critical";

export type CustomerEventKind =
  | "transaction"
  | "verification"
  | "security"
  | "card"
  | "gift_card"
  | "travel"
  | "campaign"
  | "support";

export type OperationalState =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "reversed"
  | "needs_review"
  | "verification_required"
  | "restricted";

export interface CustomerEvent {
  id: string;
  kind: CustomerEventKind;
  severity: OperationalSeverity;
  title: string;
  body: string;
  createdAt: string;
  actionHref?: string;
}

export interface OperationalCase {
  id: string;
  state: OperationalState;
  title: string;
  reason: string;
  customerId?: string;
  providerReference?: string;
  createdAt: string;
}

export const CUSTOMER_EVENT_LABELS: Record<CustomerEventKind, string> = {
  transaction: "Transaction",
  verification: "Verification",
  security: "Security",
  card: "Card",
  gift_card: "Gift card",
  travel: "Travel",
  campaign: "Campaign",
  support: "Support",
};

export function isActionableOperationalState(state: OperationalState): boolean {
  return state === "needs_review" || state === "verification_required" || state === "restricted";
}

export function customerEventHref(event: CustomerEvent): string | undefined {
  return event.actionHref;
}
