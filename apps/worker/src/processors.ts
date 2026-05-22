import type { Job } from "bullmq";
import { calculateSmmRetryDelayMs } from "@fliptrybe/service-smm";

import { queueRiskPolicies } from "./queues";
import type { QueueName, QueuePayloads } from "./queues";

export interface ProcessorResult {
  queue: QueueName;
  status: "processed" | "skipped";
  detail: string;
  details?: Record<string, boolean | number | string>;
  processedAt: string;
}

export interface ProcessorFlags {
  otpWorkerEnabled: boolean;
  otpAllocationEnabled: boolean;
  otpPollingEnabled: boolean;
  otpRefundsEnabled: boolean;
  otpProviderHealthEnabled: boolean;
}

export interface ProcessorOptions {
  env?: NodeJS.ProcessEnv;
  flags?: Partial<ProcessorFlags>;
}

const otpQueueFlagNames = {
  "otp-allocation": "otpAllocationEnabled",
  "otp-polling": "otpPollingEnabled",
  "otp-refunds": "otpRefundsEnabled",
  "otp-provider-health": "otpProviderHealthEnabled"
} as const satisfies Partial<Record<QueueName, keyof ProcessorFlags>>;

function readBooleanFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE" || value === "yes" || value === "on";
}

function resolveProcessorFlags(options?: ProcessorOptions): ProcessorFlags {
  const env = options?.env ?? process.env;

  return {
    otpWorkerEnabled: readBooleanFlag(env.OTP_WORKER_ENABLED),
    otpAllocationEnabled: readBooleanFlag(env.OTP_ALLOCATION_WORKER_ENABLED),
    otpPollingEnabled: readBooleanFlag(env.OTP_POLLING_WORKER_ENABLED),
    otpRefundsEnabled: readBooleanFlag(env.OTP_REFUNDS_WORKER_ENABLED),
    otpProviderHealthEnabled: readBooleanFlag(env.OTP_PROVIDER_HEALTH_WORKER_ENABLED),
    ...options?.flags
  };
}

function isOtpQueueEnabled(queue: keyof typeof otpQueueFlagNames, flags: ProcessorFlags): boolean {
  return flags.otpWorkerEnabled && flags[otpQueueFlagNames[queue]];
}

function createOtpSkippedResult(
  queue: keyof typeof otpQueueFlagNames,
  processedAt: string
): ProcessorResult {
  return {
    queue,
    status: "skipped",
    detail: `${queue} skipped because OTP worker flags are disabled`,
    details: {
      reason: "otp_worker_disabled",
      sideEffects: false
    },
    processedAt
  };
}

export function processQueueJob(
  queue: QueueName,
  job: Job<QueuePayloads[QueueName]>,
  options?: ProcessorOptions
): ProcessorResult {
  const processedAt = new Date().toISOString();
  const flags = resolveProcessorFlags(options);

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
      const fulfillment = data.fulfillment;

      if (fulfillment) {
        const riskPolicy = queueRiskPolicies[fulfillment.fraudRiskLevel];

        if (
          !riskPolicy.allowAutomatedFulfillment ||
          fulfillment.quantity > riskPolicy.maxQuantity
        ) {
          return {
            queue,
            status: "skipped",
            detail: `SMM order ${data.orderId} held for ${fulfillment.fraudRiskLevel} risk review`,
            processedAt
          };
        }

        return {
          queue,
          status: "processed",
          detail: `SMM order ${data.orderId} queued for ${fulfillment.supplierName ?? data.supplier}; retry ${calculateSmmRetryDelayMs(fulfillment.retryPolicy, 1, 0.5)}ms`,
          processedAt
        };
      }

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
    case "otp-allocation": {
      if (!isOtpQueueEnabled(queue, flags)) {
        return createOtpSkippedResult(queue, processedAt);
      }

      const data = job.data as QueuePayloads["otp-allocation"];
      return {
        queue,
        status: "processed",
        detail: `OTP allocation ${data.requestId} accepted for ${data.countryCode}/${data.serviceCode}`,
        details: {
          requestId: data.requestId,
          orderId: data.orderId,
          workspaceId: data.workspaceId,
          countryCode: data.countryCode,
          serviceCode: data.serviceCode,
          provider: data.provider,
          maxPriceMinor: data.maxPriceMinor,
          currency: data.currency,
          sideEffects: false
        },
        processedAt
      };
    }
    case "otp-polling": {
      if (!isOtpQueueEnabled(queue, flags)) {
        return createOtpSkippedResult(queue, processedAt);
      }

      const data = job.data as QueuePayloads["otp-polling"];
      return {
        queue,
        status: "processed",
        detail: `OTP polling ${data.allocationId} attempt ${data.attempt} scheduled`,
        details: {
          allocationId: data.allocationId,
          orderId: data.orderId,
          provider: data.provider,
          attempt: data.attempt,
          pollAfter: data.pollAfter,
          sideEffects: false
        },
        processedAt
      };
    }
    case "otp-refunds": {
      if (!isOtpQueueEnabled(queue, flags)) {
        return createOtpSkippedResult(queue, processedAt);
      }

      const data = job.data as QueuePayloads["otp-refunds"];
      return {
        queue,
        status: "processed",
        detail: `OTP refund ${data.refundId} accepted for ${data.reason}`,
        details: {
          refundId: data.refundId,
          orderId: data.orderId,
          allocationId: data.allocationId,
          reason: data.reason,
          amountMinor: data.amountMinor,
          currency: data.currency,
          sideEffects: false
        },
        processedAt
      };
    }
    case "otp-provider-health": {
      if (!isOtpQueueEnabled(queue, flags)) {
        return createOtpSkippedResult(queue, processedAt);
      }

      const data = job.data as QueuePayloads["otp-provider-health"];
      return {
        queue,
        status: "processed",
        detail: `OTP provider health ${data.checkId} accepted for ${data.provider}`,
        details: {
          checkId: data.checkId,
          provider: data.provider,
          region: data.region,
          sampledAt: data.sampledAt,
          degradedThresholdMs: data.degradedThresholdMs,
          sideEffects: false
        },
        processedAt
      };
    }
  }
}
