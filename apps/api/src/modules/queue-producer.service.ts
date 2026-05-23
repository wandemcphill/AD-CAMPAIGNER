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
