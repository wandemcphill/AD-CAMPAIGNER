import type {
  AnalyticsMetric,
  Campaign,
  OtpOrder,
  OtpRefundResult,
  PaymentIntent,
  SmmOrder,
  Wallet
} from "@fliptrybe/types";

export const eventNames = [
  "CampaignCreated",
  "CampaignStarted",
  "CampaignCompleted",
  "PaymentCompleted",
  "WithdrawalRequested",
  "LivestreamBoostStarted",
  "SMMOrderCreated",
  "OtpOrderCreated",
  "OtpOrderWaiting",
  "OtpMessageReceived",
  "OtpOrderCompleted",
  "OtpOrderRefunded",
  "OtpOrderExpired"
] as const;

export type PlatformEventName = (typeof eventNames)[number];

export interface PlatformEventBase<TName extends PlatformEventName, TPayload> {
  id: string;
  name: TName;
  occurredAt: string;
  tenantId?: string;
  payload: TPayload;
}

export type CampaignCreatedEvent = PlatformEventBase<"CampaignCreated", { campaign: Campaign }>;
export type CampaignStartedEvent = PlatformEventBase<"CampaignStarted", { campaignId: string }>;
export type CampaignCompletedEvent = PlatformEventBase<
  "CampaignCompleted",
  { campaignId: string; metrics: AnalyticsMetric[] }
>;
export type PaymentCompletedEvent = PlatformEventBase<
  "PaymentCompleted",
  { payment: PaymentIntent; wallet: Wallet }
>;
export type WithdrawalRequestedEvent = PlatformEventBase<
  "WithdrawalRequested",
  { walletId: string; amountMinor: number; currency: string }
>;
export type LivestreamBoostStartedEvent = PlatformEventBase<
  "LivestreamBoostStarted",
  { campaignId: string; livePromotionId: string }
>;
export type SMMOrderCreatedEvent = PlatformEventBase<"SMMOrderCreated", { order: SmmOrder }>;
export type OtpOrderCreatedEvent = PlatformEventBase<"OtpOrderCreated", { order: OtpOrder }>;
export type OtpOrderWaitingEvent = PlatformEventBase<"OtpOrderWaiting", { orderId: string }>;
export type OtpMessageReceivedEvent = PlatformEventBase<
  "OtpMessageReceived",
  { orderId: string; status: OtpOrder["status"] }
>;
export type OtpOrderCompletedEvent = PlatformEventBase<"OtpOrderCompleted", { orderId: string }>;
export type OtpOrderRefundedEvent = PlatformEventBase<
  "OtpOrderRefunded",
  { orderId: string; refund: OtpRefundResult }
>;
export type OtpOrderExpiredEvent = PlatformEventBase<"OtpOrderExpired", { orderId: string }>;

export type PlatformEvent =
  | CampaignCreatedEvent
  | CampaignStartedEvent
  | CampaignCompletedEvent
  | PaymentCompletedEvent
  | WithdrawalRequestedEvent
  | LivestreamBoostStartedEvent
  | SMMOrderCreatedEvent
  | OtpOrderCreatedEvent
  | OtpOrderWaitingEvent
  | OtpMessageReceivedEvent
  | OtpOrderCompletedEvent
  | OtpOrderRefundedEvent
  | OtpOrderExpiredEvent;

export const platformEvents = eventNames.map((name) => ({ name }));

export function createEvent<TEvent extends PlatformEvent>(
  event: Omit<TEvent, "id" | "occurredAt">
): TEvent {
  const id = globalThis.crypto?.randomUUID?.() ?? `evt_${Math.random().toString(36).slice(2, 12)}`;

  return {
    ...event,
    id,
    occurredAt: new Date().toISOString()
  } as TEvent;
}
