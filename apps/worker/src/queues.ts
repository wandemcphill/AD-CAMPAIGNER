import { defaultSmmRetryPolicy } from "@fliptrybe/service-smm";
import type {
  SmmFraudRiskLevel,
  SmmFulfillmentQueueJob,
  SmmRetryPolicy
} from "@fliptrybe/service-smm";

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
  fulfillment?: SmmFulfillmentQueueJob;
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

export interface QueueRuntimePolicy {
  concurrency: number;
  retryPolicy: SmmRetryPolicy;
  removeOnComplete: {
    ageSeconds: number;
    count: number;
  };
  removeOnFail: {
    ageSeconds: number;
    count: number;
  };
}

export interface QueueJobOptions {
  attempts: number;
  backoff: {
    type: "exponential";
    delay: number;
  };
  removeOnComplete: {
    age: number;
    count: number;
  };
  removeOnFail: {
    age: number;
    count: number;
  };
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

export const queueRuntimePolicies: Record<QueueName, QueueRuntimePolicy> = {
  campaigns: {
    concurrency: 8,
    retryPolicy: { attempts: 4, baseDelayMs: 15_000, maxDelayMs: 300_000, jitterRatio: 0.15 },
    removeOnComplete: { ageSeconds: 86_400, count: 5_000 },
    removeOnFail: { ageSeconds: 604_800, count: 10_000 }
  },
  "smm-fulfillment": {
    concurrency: 12,
    retryPolicy: defaultSmmRetryPolicy,
    removeOnComplete: { ageSeconds: 172_800, count: 20_000 },
    removeOnFail: { ageSeconds: 1_209_600, count: 25_000 }
  },
  notifications: {
    concurrency: 20,
    retryPolicy: { attempts: 6, baseDelayMs: 5_000, maxDelayMs: 300_000, jitterRatio: 0.2 },
    removeOnComplete: { ageSeconds: 86_400, count: 10_000 },
    removeOnFail: { ageSeconds: 604_800, count: 10_000 }
  },
  "analytics-ingestion": {
    concurrency: 25,
    retryPolicy: { attempts: 3, baseDelayMs: 10_000, maxDelayMs: 120_000, jitterRatio: 0.1 },
    removeOnComplete: { ageSeconds: 43_200, count: 25_000 },
    removeOnFail: { ageSeconds: 259_200, count: 5_000 }
  },
  "media-processing": {
    concurrency: 4,
    retryPolicy: { attempts: 4, baseDelayMs: 60_000, maxDelayMs: 900_000, jitterRatio: 0.2 },
    removeOnComplete: { ageSeconds: 172_800, count: 10_000 },
    removeOnFail: { ageSeconds: 1_209_600, count: 10_000 }
  },
  payments: {
    concurrency: 6,
    retryPolicy: { attempts: 5, baseDelayMs: 20_000, maxDelayMs: 600_000, jitterRatio: 0.1 },
    removeOnComplete: { ageSeconds: 604_800, count: 20_000 },
    removeOnFail: { ageSeconds: 2_592_000, count: 50_000 }
  },
  "audit-events": {
    concurrency: 30,
    retryPolicy: { attempts: 8, baseDelayMs: 5_000, maxDelayMs: 300_000, jitterRatio: 0.1 },
    removeOnComplete: { ageSeconds: 604_800, count: 50_000 },
    removeOnFail: { ageSeconds: 2_592_000, count: 50_000 }
  }
};

export const queueRiskPolicies: Record<
  SmmFraudRiskLevel,
  { allowAutomatedFulfillment: boolean; maxQuantity: number }
> = {
  LOW: { allowAutomatedFulfillment: true, maxQuantity: 100_000 },
  MEDIUM: { allowAutomatedFulfillment: true, maxQuantity: 25_000 },
  HIGH: { allowAutomatedFulfillment: false, maxQuantity: 5_000 },
  BLOCKED: { allowAutomatedFulfillment: false, maxQuantity: 0 }
};

export function createQueueJobOptions(queue: QueueName): QueueJobOptions {
  const policy = queueRuntimePolicies[queue];

  return {
    attempts: policy.retryPolicy.attempts,
    backoff: {
      type: "exponential",
      delay: policy.retryPolicy.baseDelayMs
    },
    removeOnComplete: {
      age: policy.removeOnComplete.ageSeconds,
      count: policy.removeOnComplete.count
    },
    removeOnFail: {
      age: policy.removeOnFail.ageSeconds,
      count: policy.removeOnFail.count
    }
  };
}
