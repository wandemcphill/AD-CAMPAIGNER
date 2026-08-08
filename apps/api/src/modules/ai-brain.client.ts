import type { PlatformEvent } from "@fliptrybe/events";

export interface AiBrainClientConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export interface CanonicalAiBrainEvent {
  app: "ads_campaigner";
  actor_id: string;
  actor_type?: string;
  event: string;
  entity_type?: string;
  entity_id?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  schema_version: 1;
  idempotency_key: string;
}

export interface AiBrainAdsInsightsRequest {
  account_id?: string;
  campaign_ids?: string[];
  metrics?: string[];
  filters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AiBrainAdsInsightsResponse {
  summary: Record<string, unknown>;
  items: Array<{
    id: string;
    label?: string | null;
    metrics: Record<string, unknown>;
    dimensions: Record<string, unknown>;
    reasons: string[];
  }>;
  trace_id: string;
}

const eventMap: Record<
  PlatformEvent["name"],
  { event: string; entityType: string; actorType: string }
> = {
  CampaignCreated: { event: "campaign_created", entityType: "campaign", actorType: "merchant" },
  CampaignStarted: { event: "campaign_started", entityType: "campaign", actorType: "merchant" },
  CampaignCompleted: { event: "campaign_completed", entityType: "campaign", actorType: "merchant" },
  PaymentCompleted: { event: "payment_confirmed", entityType: "payment", actorType: "merchant" },
  WithdrawalRequested: {
    event: "withdrawal_requested",
    entityType: "wallet",
    actorType: "merchant"
  },
  LivestreamBoostStarted: {
    event: "live_boost_started",
    entityType: "campaign",
    actorType: "merchant"
  },
  SMMOrderCreated: { event: "smm_order_created", entityType: "smm_order", actorType: "merchant" },
  OtpOrderCreated: { event: "otp_order_created", entityType: "otp_order", actorType: "merchant" },
  OtpOrderWaiting: { event: "otp_order_waiting", entityType: "otp_order", actorType: "merchant" },
  OtpMessageReceived: {
    event: "otp_message_received",
    entityType: "otp_order",
    actorType: "merchant"
  },
  OtpOrderCompleted: {
    event: "otp_order_completed",
    entityType: "otp_order",
    actorType: "merchant"
  },
  OtpOrderRefunded: { event: "otp_order_refunded", entityType: "otp_order", actorType: "merchant" },
  OtpOrderExpired: { event: "otp_order_expired", entityType: "otp_order", actorType: "merchant" },
  DigitalAccessRequestCreated: {
    event: "digital_access_request_created",
    entityType: "digital_access_request",
    actorType: "merchant"
  },
  DigitalAccessRequestUpdated: {
    event: "digital_access_request_updated",
    entityType: "digital_access_request",
    actorType: "merchant"
  },
  DigitalAccessRequestRefunded: {
    event: "digital_access_request_refunded",
    entityType: "digital_access_request",
    actorType: "merchant"
  },
  ManagedAdsRequestCreated: {
    event: "managed_ads_request_created",
    entityType: "managed_ads_request",
    actorType: "merchant"
  },
  ManagedAdsRequestUpdated: {
    event: "managed_ads_request_updated",
    entityType: "managed_ads_request",
    actorType: "merchant"
  },
  ManagedAdsCampaignLaunched: {
    event: "managed_ads_campaign_launched",
    entityType: "campaign",
    actorType: "merchant"
  },
  ManagedAdsPerformanceSnapshotRecorded: {
    event: "managed_ads_performance_snapshot_recorded",
    entityType: "campaign",
    actorType: "merchant"
  },
  VirtualAccountCreated: { event: "virtual_account_created", entityType: "virtual_account", actorType: "merchant" },
  VirtualAccountCredited: { event: "virtual_account_credited", entityType: "virtual_account", actorType: "system" },
  VirtualCardIssued: { event: "virtual_card_issued", entityType: "virtual_card", actorType: "merchant" },
  VirtualCardStatusChanged: { event: "virtual_card_status_changed", entityType: "virtual_card", actorType: "merchant" },
  RemittanceInitiated: { event: "remittance_initiated", entityType: "remittance_transfer", actorType: "merchant" },
  RemittanceCompleted: { event: "remittance_completed", entityType: "remittance_transfer", actorType: "system" },
  RemittanceFailed: { event: "remittance_failed", entityType: "remittance_transfer", actorType: "system" },
  KycStatusChanged: { event: "kyc_status_changed", entityType: "kyc_verification", actorType: "system" }
};

export class AiBrainClient {
  constructor(
    private readonly config: AiBrainClientConfig,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  static fromEnv(source: NodeJS.ProcessEnv = process.env) {
    const baseUrl = (source.AI_BRAIN_BASE_URL ?? "").trim().replace(/\/+$/, "");
    const apiKey = (source.AI_BRAIN_API_KEY ?? "").trim();
    return new AiBrainClient({
      enabled: isTruthy(source.AI_BRAIN_ENABLED) && baseUrl.length > 0 && apiKey.length > 0,
      baseUrl,
      apiKey,
      timeoutMs: readTimeoutMs(source.AI_BRAIN_TIMEOUT_SECONDS)
    });
  }

  get enabled() {
    return this.config.enabled;
  }

  async trackPlatformEvent(event: PlatformEvent, traceId?: string) {
    if (!this.config.enabled) {
      return false;
    }
    const payload = toCanonicalEvent(event);
    if (!payload) {
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(`${this.config.baseUrl}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.config.apiKey,
          ...(traceId ? { "x-trace-id": traceId } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAdsInsights(
    input: AiBrainAdsInsightsRequest,
    traceId?: string
  ): Promise<AiBrainAdsInsightsResponse | null> {
    if (!this.config.enabled) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(`${this.config.baseUrl}/ai/ads_campaigner/ads/insights`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.config.apiKey,
          ...(traceId ? { "x-trace-id": traceId } : {})
        },
        body: JSON.stringify(input),
        signal: controller.signal
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as AiBrainAdsInsightsResponse;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function toCanonicalEvent(event: PlatformEvent): CanonicalAiBrainEvent | null {
  const mapping = eventMap[event.name];
  if (!mapping) {
    return null;
  }
  const payload = event.payload as Record<string, unknown>;
  const entity = readEntity(event.name, payload);
  const actorId = readActorId(entity, payload);

  return {
    app: "ads_campaigner",
    actor_id: actorId,
    actor_type: mapping.actorType,
    event: mapping.event,
    entity_type: mapping.entityType,
    entity_id: readEntityId(entity, payload) ?? event.id,
    timestamp: event.occurredAt,
    metadata: {
      source: "ads_campaigner_platform_events",
      platform_event_id: event.id,
      platform_event_name: event.name,
      tenant_id: event.tenantId,
      ...readProjectionMetadata(entity, payload),
      payload
    },
    schema_version: 1,
    idempotency_key: `ads_campaigner:event:${event.id}`
  };
}

function readEntity(eventName: PlatformEvent["name"], payload: Record<string, unknown>) {
  if (eventName === "CampaignCreated") {
    return payload.campaign as Record<string, unknown> | undefined;
  }
  if (eventName === "PaymentCompleted") {
    return payload.payment as Record<string, unknown> | undefined;
  }
  if (eventName === "SMMOrderCreated") {
    return payload.order as Record<string, unknown> | undefined;
  }
  if (eventName === "DigitalAccessRequestCreated") {
    return payload.request as Record<string, unknown> | undefined;
  }
  if (eventName === "ManagedAdsRequestCreated") {
    return payload.request as Record<string, unknown> | undefined;
  }
  return undefined;
}

function readActorId(
  entity: Record<string, unknown> | undefined,
  payload: Record<string, unknown>
) {
  return (
    text(entity?.creatorUserId) ??
    text(entity?.requesterUserId) ??
    text(payload.userId) ??
    text(payload.actorId) ??
    "user_demo"
  );
}

function readEntityId(
  entity: Record<string, unknown> | undefined,
  payload: Record<string, unknown>
) {
  return (
    text(entity?.id) ??
    text(payload.campaignId) ??
    text(payload.orderId) ??
    text(payload.requestId) ??
    text(payload.walletId)
  );
}

function readProjectionMetadata(
  entity: Record<string, unknown> | undefined,
  payload: Record<string, unknown>
) {
  const campaignId = readEntityId(entity, payload);
  const merchantId =
    text(entity?.creatorUserId) ??
    text(entity?.merchantId) ??
    text(payload.merchantId) ??
    text(payload.userId) ??
    text(payload.actorId);
  return {
    ...(merchantId ? { merchant_id: merchantId } : {}),
    ...(campaignId ? { campaign_id: campaignId } : {}),
    ...(text(payload.provider) ? { provider: text(payload.provider) } : {}),
    ...(text(entity?.channel) ? { channel: text(entity?.channel) } : {}),
    ...(text(entity?.objective) ? { objective: text(entity?.objective) } : {}),
    ...(text(payload.audienceId) ? { audience_id: text(payload.audienceId) } : {}),
    ...(text(payload.audienceSegment) ? { audience_segment: text(payload.audienceSegment) } : {})
  };
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on", "enabled"].includes((value ?? "").trim().toLowerCase());
}

function readTimeoutMs(value: string | undefined) {
  const seconds = Number.parseFloat((value ?? "").trim());
  const clamped = Number.isFinite(seconds) ? Math.min(10, Math.max(0.05, seconds)) : 0.8;
  return Math.round(clamped * 1000);
}
