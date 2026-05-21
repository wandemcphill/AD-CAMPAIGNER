export const queueNames = [
  "campaigns",
  "smm-fulfillment",
  "notifications",
  "analytics-ingestion",
  "media-processing",
  "payments",
  "audit-events"
] as const;

export type QueueName = (typeof queueNames)[number];

export interface CampaignJob {
  campaignId: string;
  action: "create" | "start" | "pause" | "complete";
}

export interface SmmFulfillmentJob {
  orderId: string;
  supplier: "mock" | "sandbox" | "live";
}

export interface NotificationJob {
  notificationId: string;
  channel: "EMAIL" | "IN_APP" | "WEBSOCKET" | "WHATSAPP";
}

export interface AnalyticsIngestionJob {
  workspaceId: string;
  metric: string;
  value: number;
  dimensions: Record<string, string>;
}

export interface MediaProcessingJob {
  assetId: string;
  operations: Array<"image-optimization" | "video-compression" | "thumbnail-generation">;
}

export interface PaymentJob {
  paymentIntentId: string;
  action: "verify" | "settle" | "refund";
}

export interface AuditEventJob {
  eventId: string;
  action: string;
  entityType: string;
  entityId: string;
}

export type QueuePayloads = {
  campaigns: CampaignJob;
  "smm-fulfillment": SmmFulfillmentJob;
  notifications: NotificationJob;
  "analytics-ingestion": AnalyticsIngestionJob;
  "media-processing": MediaProcessingJob;
  payments: PaymentJob;
  "audit-events": AuditEventJob;
};
