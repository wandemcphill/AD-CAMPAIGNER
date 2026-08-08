import type {
  AnalyticsMetric,
  Campaign,
  CampaignObjective,
  CurrencyCode,
  DigitalAccessRefundResult,
  DigitalAccessRequest,
  DestinationKind,
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
  "DigitalAccessRequestRefunded",
  "ManagedAdsRequestCreated",
  "ManagedAdsRequestUpdated",
  "ManagedAdsCampaignLaunched",
  "ManagedAdsPerformanceSnapshotRecorded",
  // Financial products
  "VirtualAccountCreated",
  "VirtualAccountCredited",
  "VirtualCardIssued",
  "VirtualCardStatusChanged",
  "RemittanceInitiated",
  "RemittanceCompleted",
  "RemittanceFailed",
  "KycStatusChanged"
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
export const managedAdsRequestStatuses = [
  "submitted",
  "in_review",
  "approved",
  "launching",
  "active",
  "paused",
  "completed",
  "rejected",
  "cancelled"
] as const;
export type ManagedAdsRequestStatus = (typeof managedAdsRequestStatuses)[number];
export const managedAdsChannels = ["META", "TIKTOK", "GOOGLE", "MANUAL"] as const;
export type ManagedAdsChannel = (typeof managedAdsChannels)[number];

export interface ManagedAdsMoney {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface ManagedAdsRequestSnapshot {
  id: string;
  workspaceId: string;
  creatorUserId?: string;
  name: string;
  objective: CampaignObjective;
  status: ManagedAdsRequestStatus;
  budget: ManagedAdsMoney;
  destinationKind: DestinationKind;
  channels: ManagedAdsChannel[];
}

export interface ManagedAdsMetricSnapshot {
  name: "spend" | "impressions" | "clicks" | "conversions" | "roas";
  value: number;
  unit: "minor" | "count" | "ratio";
}

export type ManagedAdsRequestCreatedEvent = PlatformEventBase<
  "ManagedAdsRequestCreated",
  { request: ManagedAdsRequestSnapshot }
>;
export type ManagedAdsRequestUpdatedEvent = PlatformEventBase<
  "ManagedAdsRequestUpdated",
  {
    requestId: string;
    previousStatus?: ManagedAdsRequestStatus;
    nextStatus: ManagedAdsRequestStatus;
    campaignId?: string;
  }
>;
export type ManagedAdsCampaignLaunchedEvent = PlatformEventBase<
  "ManagedAdsCampaignLaunched",
  {
    requestId: string;
    campaignId: string;
    provider: ManagedAdsChannel;
    providerReference?: string;
  }
>;
export type ManagedAdsPerformanceSnapshotRecordedEvent = PlatformEventBase<
  "ManagedAdsPerformanceSnapshotRecorded",
  {
    requestId: string;
    campaignId: string;
    metrics: ManagedAdsMetricSnapshot[];
    recordedAt: string;
  }
>;

export type ManagedAdsPlatformEvent =
  | ManagedAdsRequestCreatedEvent
  | ManagedAdsRequestUpdatedEvent
  | ManagedAdsCampaignLaunchedEvent
  | ManagedAdsPerformanceSnapshotRecordedEvent;

// ─── Financial Product Events ──────────────────────────────────────────────────

export type VirtualAccountCreatedEvent = PlatformEventBase<
  "VirtualAccountCreated",
  { virtualAccountId: string; workspaceId: string; currency: string; accountNumber: string }
>;

export type VirtualAccountCreditedEvent = PlatformEventBase<
  "VirtualAccountCredited",
  {
    virtualAccountId: string;
    creditId: string;
    workspaceId: string;
    amountMinor: number;
    currency: string;
    senderName?: string;
    creditLedgerEntryId?: string;
  }
>;

export type VirtualCardIssuedEvent = PlatformEventBase<
  "VirtualCardIssued",
  { virtualCardId: string; workspaceId: string; currency: string; last4: string }
>;

export type VirtualCardStatusChangedEvent = PlatformEventBase<
  "VirtualCardStatusChanged",
  { virtualCardId: string; workspaceId: string; previousStatus: string; nextStatus: string }
>;

export type RemittanceInitiatedEvent = PlatformEventBase<
  "RemittanceInitiated",
  {
    transferId: string;
    workspaceId: string;
    sourceAmountMinor: number;
    sourceCurrency: string;
    destinationAmountMinor: number;
    destinationCurrency: string;
    recipientName: string;
  }
>;

export type RemittanceCompletedEvent = PlatformEventBase<
  "RemittanceCompleted",
  { transferId: string; workspaceId: string; providerReference?: string }
>;

export type RemittanceFailedEvent = PlatformEventBase<
  "RemittanceFailed",
  { transferId: string; workspaceId: string; reason?: string }
>;

export type KycStatusChangedEvent = PlatformEventBase<
  "KycStatusChanged",
  {
    kycVerificationId: string;
    userId: string;
    workspaceId: string;
    previousStatus: string;
    nextStatus: string;
    level: string;
  }
>;

export type FinancialProductPlatformEvent =
  | VirtualAccountCreatedEvent
  | VirtualAccountCreditedEvent
  | VirtualCardIssuedEvent
  | VirtualCardStatusChangedEvent
  | RemittanceInitiatedEvent
  | RemittanceCompletedEvent
  | RemittanceFailedEvent
  | KycStatusChangedEvent;

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
  | DigitalAccessRequestRefundedEvent
  | ManagedAdsPlatformEvent
  | FinancialProductPlatformEvent;

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

export const managedAdsAutomationJobKinds = [
  "request_submitted",
  "status_changed",
  "campaign_launch",
  "performance_sync",
  "budget_check"
] as const;

export type ManagedAdsAutomationJobKind = (typeof managedAdsAutomationJobKinds)[number];

export interface ManagedAdsAutomationJob {
  id: string;
  kind: ManagedAdsAutomationJobKind;
  workspaceId: string;
  requestId: string;
  campaignId?: string;
  provider?: ManagedAdsChannel;
  providerReference?: string;
  objective?: CampaignObjective;
  destinationKind?: DestinationKind;
  previousStatus?: ManagedAdsRequestStatus;
  nextStatus?: ManagedAdsRequestStatus;
  amountMinor?: number;
  currency?: CurrencyCode;
  sourceEventId?: string;
  idempotencyKey: string;
  queuedAt: string;
}

export function createManagedAdsAutomationJob(
  input: Omit<ManagedAdsAutomationJob, "id" | "idempotencyKey" | "queuedAt"> &
    Partial<Pick<ManagedAdsAutomationJob, "id" | "idempotencyKey" | "queuedAt">>
): ManagedAdsAutomationJob {
  const statusSuffix = input.nextStatus ? `:${input.nextStatus}` : "";
  const campaignSuffix = input.campaignId ? `:${input.campaignId}` : "";
  const providerSuffix = input.provider ? `:${input.provider.toLowerCase()}` : "";

  return {
    id:
      input.id ??
      globalThis.crypto?.randomUUID?.() ??
      `ma_job_${Math.random().toString(36).slice(2, 12)}`,
    kind: input.kind,
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
    ...(input.provider === undefined ? {} : { provider: input.provider }),
    ...(input.providerReference === undefined
      ? {}
      : { providerReference: input.providerReference }),
    ...(input.objective === undefined ? {} : { objective: input.objective }),
    ...(input.destinationKind === undefined ? {} : { destinationKind: input.destinationKind }),
    ...(input.previousStatus === undefined ? {} : { previousStatus: input.previousStatus }),
    ...(input.nextStatus === undefined ? {} : { nextStatus: input.nextStatus }),
    ...(input.amountMinor === undefined ? {} : { amountMinor: input.amountMinor }),
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    ...(input.sourceEventId === undefined ? {} : { sourceEventId: input.sourceEventId }),
    idempotencyKey:
      input.idempotencyKey ??
      `managed_ads:${input.kind}:${input.requestId}${statusSuffix}${campaignSuffix}${providerSuffix}`,
    queuedAt: input.queuedAt ?? new Date().toISOString()
  };
}
