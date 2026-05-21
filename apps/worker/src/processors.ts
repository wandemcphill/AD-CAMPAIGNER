import type { Job } from "bullmq";

import type { QueueName, QueuePayloads } from "./queues";

export interface ProcessorResult {
  queue: QueueName;
  status: "processed" | "skipped";
  detail: string;
  processedAt: string;
}

export function processQueueJob(
  queue: QueueName,
  job: Job<QueuePayloads[QueueName]>
): ProcessorResult {
  const processedAt = new Date().toISOString();

  switch (queue) {
    case "campaigns": {
      const data = job.data as QueuePayloads["campaigns"];
      return {
        queue,
        status: "processed",
        detail: `Campaign ${data.campaignId} action ${data.action} accepted`,
        processedAt
      };
    }
    case "smm-fulfillment": {
      const data = job.data as QueuePayloads["smm-fulfillment"];
      return {
        queue,
        status: "processed",
        detail: `SMM order ${data.orderId} routed to ${data.supplier}`,
        processedAt
      };
    }
    case "notifications": {
      const data = job.data as QueuePayloads["notifications"];
      return {
        queue,
        status: "processed",
        detail: `Notification ${data.notificationId} queued for ${data.channel}`,
        processedAt
      };
    }
    case "analytics-ingestion": {
      const data = job.data as QueuePayloads["analytics-ingestion"];
      return {
        queue,
        status: "processed",
        detail: `Metric ${data.metric} recorded for ${data.workspaceId}`,
        processedAt
      };
    }
    case "media-processing": {
      const data = job.data as QueuePayloads["media-processing"];
      return {
        queue,
        status: "processed",
        detail: `Asset ${data.assetId} scheduled for ${data.operations.join(", ")}`,
        processedAt
      };
    }
    case "payments": {
      const data = job.data as QueuePayloads["payments"];
      return {
        queue,
        status: "processed",
        detail: `Payment intent ${data.paymentIntentId} action ${data.action} accepted`,
        processedAt
      };
    }
    case "audit-events": {
      const data = job.data as QueuePayloads["audit-events"];
      return {
        queue,
        status: "processed",
        detail: `Audit event ${data.eventId} persisted`,
        processedAt
      };
    }
  }
}
