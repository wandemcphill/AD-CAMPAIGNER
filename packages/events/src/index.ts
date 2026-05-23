import type {
  AnalyticsMetric,
  Campaign,
  DigitalAccessRefundResult,
  DigitalAccessRequest,
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
  "OtpOrderExpired",
  "DigitalAccessRequestCreated",
  "DigitalAccessRequestUpdated",
  "DigitalAccessRequestRefunded"
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
export type DigitalAccessRequestCreatedEvent = PlatformEventBase<
  "DigitalAccessRequestCreated",
  { request: DigitalAccessRequest }
>;
export type DigitalAccessRequestUpdatedEvent = PlatformEventBase<
  "DigitalAccessRequestUpdated",
  { requestId: string; status: DigitalAccessRequest["status"] }
>;
export type DigitalAccessRequestRefundedEvent = PlatformEventBase<
  "DigitalAccessRequestRefunded",
  { requestId: string; refund: DigitalAccessRefundResult }
>;

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
  | OtpOrderExpiredEvent
  | DigitalAccessRequestCreatedEvent
  | DigitalAccessRequestUpdatedEvent
  | DigitalAccessRequestRefundedEvent;

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

export const digitalAccessAutomationJobKinds = [
  "request_created",
  "status_changed",
  "refund_completed",
  "reconciliation_check"
] as const;

export type DigitalAccessAutomationJobKind = (typeof digitalAccessAutomationJobKinds)[number];

export interface DigitalAccessAutomationJob {
  id: string;
  kind: DigitalAccessAutomationJobKind;
  workspaceId: string;
  requestId: string;
  userId?: string;
  actorUserId?: string;
  serviceId?: string;
  planId?: string;
  previousStatus?: DigitalAccessRequest["status"];
  nextStatus?: DigitalAccessRequest["status"];
  amountMinor?: number;
  currency?: string;
  sourceEventId?: string;
  idempotencyKey: string;
  queuedAt: string;
}

export function createDigitalAccessAutomationJob(
  input: Omit<DigitalAccessAutomationJob, "id" | "idempotencyKey" | "queuedAt"> &
    Partial<Pick<DigitalAccessAutomationJob, "id" | "idempotencyKey" | "queuedAt">>
): DigitalAccessAutomationJob {
  const suffix = input.nextStatus ? `:${input.nextStatus}` : "";

  return {
    id:
      input.id ??
      globalThis.crypto?.randomUUID?.() ??
      `da_job_${Math.random().toString(36).slice(2, 12)}`,
    kind: input.kind,
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    ...(input.actorUserId === undefined ? {} : { actorUserId: input.actorUserId }),
    ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
    ...(input.planId === undefined ? {} : { planId: input.planId }),
    ...(input.previousStatus === undefined ? {} : { previousStatus: input.previousStatus }),
    ...(input.nextStatus === undefined ? {} : { nextStatus: input.nextStatus }),
    ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    ...(input.sourceEventId === undefined ? {} : { sourceEventId: input.sourceEventId }),
    idempotencyKey:
      input.idempotencyKey ?? `digital_access:${input.kind}:${input.requestId}${suffix}`,
    queuedAt: input.queuedAt ?? new Date().toISOString()
  };
}
