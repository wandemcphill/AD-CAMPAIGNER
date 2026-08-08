import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { DigitalAccessAutomationJob } from "@fliptrybe/events";
import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export interface QueueProducerResult {
  enqueued: boolean;
  queue: string;
  jobId?: string;
  reason?: "disabled" | "unavailable" | "error";
}

const isDisabled = (value: string | undefined) =>
  value === "0" || value === "false" || value === "FALSE" || value === "off";

@Injectable()
export class QueueProducerService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueProducerService.name);
  private readonly queues = new Map<string, Queue>();
  private connection?: IORedis;

  async enqueueDigitalAccessAutomation(
    job: DigitalAccessAutomationJob
  ): Promise<QueueProducerResult> {
    return this.enqueue("digital-access-automation", job.kind, job, {
      jobId: job.idempotencyKey,
      attempts: 6,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { age: 604_800, count: 20_000 },
      removeOnFail: { age: 2_592_000, count: 50_000 }
    });
  }

  async enqueueVtuOpsReview(orderId: string): Promise<QueueProducerResult> {
    return this.enqueue("vtu-fulfilment", "ops_review", { orderId }, {
      jobId: `vtu_ops_${orderId}`,
      attempts: 1,
      removeOnComplete: { age: 604_800 },
      removeOnFail: { age: 2_592_000, count: 10_000 }
    });
  }

  async enqueueVtuPollStatus(orderId: string): Promise<QueueProducerResult> {
    return this.enqueue("vtu-fulfilment", "poll_status", { orderId }, {
      jobId: `vtu_poll_${orderId}`,
      attempts: 8,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: { age: 604_800 },
      removeOnFail: { age: 2_592_000, count: 10_000 }
    });
  }

  async enqueueRewardVerification(completionId: string): Promise<QueueProducerResult> {
    return this.enqueue("reward-engine", "verify_task", { completionId }, {
      jobId: `reward_verify_${completionId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { age: 604_800 },
      removeOnFail: { age: 2_592_000, count: 20_000 }
    });
  }

  async enqueueRewardFulfillment(entitlementId: string): Promise<QueueProducerResult> {
    return this.enqueue("reward-engine", "fulfill", { entitlementId }, {
      jobId: `reward_fulfill_${entitlementId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { age: 604_800 },
      removeOnFail: { age: 2_592_000, count: 20_000 }
    });
  }

  async enqueueRewardOpsReview(entitlementId: string): Promise<QueueProducerResult> {
    return this.enqueue("reward-engine", "ops_review", { entitlementId }, {
      jobId: `reward_ops_${entitlementId}`,
      attempts: 1,
      removeOnComplete: { age: 604_800 },
      removeOnFail: { age: 2_592_000, count: 10_000 }
    });
  }

  async enqueueRewardCampaignLifecycle(campaignId: string): Promise<QueueProducerResult> {
    return this.enqueue("reward-engine", "campaign_lifecycle", { campaignId }, {
      jobId: `reward_lifecycle_${campaignId}_${Date.now()}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 604_800, count: 5_000 }
    });
  }

  async enqueueLeaderboardRefresh(campaignId: string): Promise<QueueProducerResult> {
    return this.enqueue("reward-engine", "leaderboard_refresh", { campaignId }, {
      jobId: `reward_leaderboard_${campaignId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 604_800, count: 5_000 }
    });
  }

  async enqueueDigitalValueProcessing(
    transactionId: string,
    type: "GIFT_CARD_SELL" | "GIFT_CARD_BUY" | "AIRTIME_CASHOUT" | "AIRTIME_BUY"
  ): Promise<QueueProducerResult> {
    return this.enqueue("digital-value-processing", type, { transactionId, type }, {
      jobId: `dv_${type}_${transactionId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: { age: 604_800, count: 20_000 },
      removeOnFail: { age: 2_592_000, count: 20_000 }
    });
  }

  async enqueueGiftCardSellOpsReview(transactionId: string): Promise<QueueProducerResult> {
    const type = "GIFT_CARD_SELL_OPS_REVIEW" as const;
    return this.enqueue("digital-value-processing", type, { transactionId, type }, {
      jobId: `dv_ops_review_${transactionId}`,
      attempts: 1,
      removeOnComplete: { age: 604_800, count: 20_000 },
      removeOnFail: { age: 2_592_000, count: 20_000 }
    });
  }

  async enqueueNotificationDispatch(
    notificationId: string,
    channel: "EMAIL" | "SMS" | "WHATSAPP"
  ): Promise<QueueProducerResult> {
    return this.enqueue("notifications", channel, { notificationId, channel }, {
      jobId: `notify_${notificationId}_${channel}`,
      attempts: 6,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 604_800, count: 10_000 }
    });
  }

  async enqueueTrustEngineValidation(submissionId: string): Promise<QueueProducerResult> {
    return this.enqueue("trust-engine", "validate", { submissionId }, {
      jobId: `trust_engine_${submissionId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 604_800, count: 30_000 },
      removeOnFail: { age: 2_592_000, count: 30_000 }
    });
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));

    if (this.connection) {
      await this.connection.quit();
    }
  }

  private async enqueue(
    queueName: string,
    jobName: string,
    data: unknown,
    options: JobsOptions
  ): Promise<QueueProducerResult> {
    if (!this.isEnabled()) {
      return { enqueued: false, queue: queueName, reason: "disabled" };
    }

    const queue = this.getQueue(queueName);

    if (!queue) {
      return { enqueued: false, queue: queueName, reason: "unavailable" };
    }

    try {
      const job = await queue.add(jobName, data, options);

      return {
        enqueued: true,
        queue: queueName,
        ...(job.id === undefined ? {} : { jobId: job.id })
      };
    } catch (error) {
      this.logger.error(`Failed to enqueue ${queueName}:${jobName}`, {
        error: error instanceof Error ? error.message : String(error)
      });

      return { enqueued: false, queue: queueName, reason: "error" };
    }
  }

  private isEnabled() {
    return Boolean(process.env.REDIS_URL) && !isDisabled(process.env.QUEUE_PRODUCER_ENABLED);
  }

  private getQueue(queueName: string) {
    const connection = this.getConnection();

    if (!connection) {
      return undefined;
    }

    const existing = this.queues.get(queueName);

    if (existing) {
      return existing;
    }

    const queue = new Queue(queueName, { connection });
    this.queues.set(queueName, queue);

    return queue;
  }

  private getConnection() {
    if (!this.isEnabled()) {
      return undefined;
    }

    if (!this.connection) {
      this.connection = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      });
    }

    return this.connection;
  }
}
