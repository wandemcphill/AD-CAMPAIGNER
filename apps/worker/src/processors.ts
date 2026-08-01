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
  managedAdsWorkerEnabled: boolean;
  managedAdsAutomationEnabled: boolean;
  digitalAccessWorkerEnabled: boolean;
  digitalAccessAutomationEnabled: boolean;
}

export interface ProcessorOptions {
  env?: NodeJS.ProcessEnv;
  flags?: Partial<ProcessorFlags>;
}

const digitalAccessQueueFlagNames = {
  "digital-access-automation": "digitalAccessAutomationEnabled"
} as const satisfies Partial<Record<QueueName, keyof ProcessorFlags>>;

const managedAdsQueueFlagNames = {
  "managed-ads-automation": "managedAdsAutomationEnabled"
} as const satisfies Partial<Record<QueueName, keyof ProcessorFlags>>;

function readBooleanFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE" || value === "yes" || value === "on";
}

export function resolveProcessorFlags(options?: ProcessorOptions): ProcessorFlags {
  const env = options?.env ?? process.env;

  return {
    managedAdsWorkerEnabled: readBooleanFlag(env.MANAGED_ADS_WORKER_ENABLED),
    managedAdsAutomationEnabled: readBooleanFlag(env.MANAGED_ADS_AUTOMATION_WORKER_ENABLED),
    digitalAccessWorkerEnabled: readBooleanFlag(env.DIGITAL_ACCESS_WORKER_ENABLED),
    digitalAccessAutomationEnabled: readBooleanFlag(env.DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED),
    ...options?.flags
  };
}

function isDigitalAccessQueueEnabled(
  queue: keyof typeof digitalAccessQueueFlagNames,
  flags: ProcessorFlags
): boolean {
  return flags.digitalAccessWorkerEnabled && flags[digitalAccessQueueFlagNames[queue]];
}

function isManagedAdsQueueEnabled(
  queue: keyof typeof managedAdsQueueFlagNames,
  flags: ProcessorFlags
): boolean {
  return flags.managedAdsWorkerEnabled && flags[managedAdsQueueFlagNames[queue]];
}

function isDigitalAccessQueueName(
  queue: QueueName
): queue is keyof typeof digitalAccessQueueFlagNames {
  return queue in digitalAccessQueueFlagNames;
}

function isManagedAdsQueueName(queue: QueueName): queue is keyof typeof managedAdsQueueFlagNames {
  return queue in managedAdsQueueFlagNames;
}

export function shouldStartQueueWorker(queue: QueueName, options?: ProcessorOptions): boolean {
  const flags = resolveProcessorFlags(options);

  if (isDigitalAccessQueueName(queue)) {
    return isDigitalAccessQueueEnabled(queue, flags);
  }

  if (isManagedAdsQueueName(queue)) {
    return isManagedAdsQueueEnabled(queue, flags);
  }

  return true;
}

function createDigitalAccessSkippedResult(
  queue: keyof typeof digitalAccessQueueFlagNames,
  processedAt: string
): ProcessorResult {
  return {
    queue,
    status: "skipped",
    detail: `${queue} skipped because Digital Access worker flags are disabled`,
    details: {
      reason: "digital_access_worker_disabled",
      sideEffects: false
    },
    processedAt
  };
}

function createManagedAdsSkippedResult(
  queue: keyof typeof managedAdsQueueFlagNames,
  processedAt: string
): ProcessorResult {
  return {
    queue,
    status: "skipped",
    detail: `${queue} skipped because Managed Ads worker flags are disabled`,
    details: {
      reason: "managed_ads_worker_disabled",
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
    case "managed-ads-automation": {
      if (!isManagedAdsQueueEnabled(queue, flags)) {
        return createManagedAdsSkippedResult(queue, processedAt);
      }

      const data = job.data as QueuePayloads["managed-ads-automation"];
      return {
        queue,
        status: "processed",
        detail: `Managed Ads automation ${data.kind} accepted for ${data.requestId}`,
        details: {
          kind: data.kind,
          workspaceId: data.workspaceId,
          requestId: data.requestId,
          ...(data.campaignId === undefined ? {} : { campaignId: data.campaignId }),
          ...(data.provider === undefined ? {} : { provider: data.provider }),
          ...(data.objective === undefined ? {} : { objective: data.objective }),
          ...(data.destinationKind === undefined ? {} : { destinationKind: data.destinationKind }),
          ...(data.previousStatus === undefined ? {} : { previousStatus: data.previousStatus }),
          ...(data.nextStatus === undefined ? {} : { nextStatus: data.nextStatus }),
          ...(data.amountMinor === undefined ? {} : { amountMinor: data.amountMinor }),
          ...(data.currency === undefined ? {} : { currency: data.currency }),
          sideEffects: false
        },
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
    case "digital-access-automation": {
      if (!isDigitalAccessQueueEnabled(queue, flags)) {
        return createDigitalAccessSkippedResult(queue, processedAt);
      }

      const data = job.data as QueuePayloads["digital-access-automation"];
      return {
        queue,
        status: "processed",
        detail: `Digital Access automation ${data.kind} accepted for ${data.requestId}`,
        details: {
          kind: data.kind,
          workspaceId: data.workspaceId,
          requestId: data.requestId,
          ...(data.serviceId === undefined ? {} : { serviceId: data.serviceId }),
          ...(data.planId === undefined ? {} : { planId: data.planId }),
          ...(data.previousStatus === undefined ? {} : { previousStatus: data.previousStatus }),
          ...(data.nextStatus === undefined ? {} : { nextStatus: data.nextStatus }),
          ...(data.amountMinor === undefined ? {} : { amountMinor: data.amountMinor }),
          ...(data.currency === undefined ? {} : { currency: data.currency }),
          sideEffects: false
        },
        processedAt
      };
    }
    case "vtu-fulfilment": {
      const data = job.data as QueuePayloads["vtu-fulfilment"];
      return {
        queue,
        status: "processed",
        detail: `VTU ${job.name} accepted${data.orderId ? ` for order ${data.orderId}` : ""}`,
        details: {
          jobName: job.name,
          ...(data.orderId === undefined ? {} : { orderId: data.orderId }),
          ...(data.providerName === undefined ? {} : { providerName: data.providerName }),
          sideEffects: false
        },
        processedAt
      };
    }
    case "virtual-numbers": {
      const data = job.data as QueuePayloads["virtual-numbers"];
      return {
        queue,
        status: "processed",
        detail: `Virtual Numbers ${job.name} accepted${data.numberId ? ` for number ${data.numberId}` : ""}`,
        details: {
          jobName: job.name,
          ...(data.numberId === undefined ? {} : { numberId: data.numberId }),
          ...(data.providerName === undefined ? {} : { providerName: data.providerName }),
          sideEffects: false
        },
        processedAt
      };
    }
    case "workflow-automation": {
      // Handled by processWorkflowAutomationJob in main.ts — this stub satisfies the type-switch.
      return {
        queue,
        status: "skipped",
        detail: "workflow-automation is handled by its dedicated processor",
        processedAt
      };
    }
    case "reward-engine": {
      const data = job.data as QueuePayloads["reward-engine"];
      return {
        queue,
        status: "processed",
        detail: `Reward engine ${job.name} accepted`,
        details: {
          jobName: job.name,
          ...(data.completionId === undefined ? {} : { completionId: data.completionId }),
          ...(data.entitlementId === undefined ? {} : { entitlementId: data.entitlementId }),
          ...(data.campaignId === undefined ? {} : { campaignId: data.campaignId }),
          sideEffects: false
        },
        processedAt
      };
    }
    case "digital-value-processing": {
      const data = job.data as QueuePayloads["digital-value-processing"];
      return {
        queue,
        status: "processed",
        detail: `Digital value ${data.type} accepted for transaction ${data.transactionId}`,
        processedAt
      };
    }
    case "trust-engine": {
      const data = job.data as QueuePayloads["trust-engine"];
      return {
        queue,
        status: "processed",
        detail: `Trust engine validation accepted for submission ${data.submissionId}`,
        details: {
          submissionId: data.submissionId,
          retryCount: data.retryCount ?? 0,
          sideEffects: false
        },
        processedAt
      };
    }
    default: {
      const _exhaustive: never = queue;
      return {
        queue: _exhaustive,
        status: "skipped",
        detail: `Unknown queue: ${String(_exhaustive)}`,
        processedAt
      };
    }
  }
}
