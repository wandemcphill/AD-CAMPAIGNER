import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { processQueueJob, shouldStartQueueWorker } from "./processors";
import { type QueueName, type QueuePayloads, queueNames, queueRuntimePolicies } from "./queues";
import { processVtuFulfilmentJob } from "./vtu-processor";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

// VTU providers wired to real adapters (see apps/worker/src/vtu-processor.ts). Extend this
// when a new adapter goes live so its catalog/health jobs get scheduled automatically.
const VTU_LIVE_PROVIDERS = ["vtpass", "clubkonnect"];

async function scheduleVtuRecurringJobs() {
  if (!shouldStartQueueWorker("vtu-fulfilment")) return;

  const queue = new Queue<QueuePayloads["vtu-fulfilment"]>("vtu-fulfilment", { connection });

  await queue.upsertJobScheduler(
    "vtu-reconcile-sweep",
    { every: 10 * 60_000 }, // every 10 minutes
    { name: "reconcile", data: {} }
  );

  for (const providerName of VTU_LIVE_PROVIDERS) {
    await queue.upsertJobScheduler(
      `vtu-plan-sync-${providerName}`,
      { every: 24 * 60 * 60_000 }, // daily
      { name: "plan_catalog_sync", data: { providerName } }
    );

    await queue.upsertJobScheduler(
      `vtu-health-${providerName}`,
      { every: 5 * 60_000 }, // every 5 minutes
      { name: "provider_health", data: { providerName } }
    );
  }

  return queue;
}

const enabledQueues = queueNames.filter((queueName) => shouldStartQueueWorker(queueName));
const disabledQueues = queueNames.filter((queueName) => !shouldStartQueueWorker(queueName));
const workers = enabledQueues.map((queueName) =>
  queueName === "vtu-fulfilment"
    ? new Worker<QueuePayloads["vtu-fulfilment"]>(queueName, processVtuFulfilmentJob, {
        connection,
        concurrency: Number(
          process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency
        )
      })
    : new Worker<QueuePayloads[QueueName]>(
        queueName,
        (job) => Promise.resolve(processQueueJob(queueName, job)),
        {
          connection,
          concurrency: Number(
            process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency
          )
        }
      )
);

for (const worker of workers) {
  worker.on("completed", (job) => {
    console.log("job completed", { queue: worker.name, jobId: job.id });
  });

  worker.on("failed", (job, error) => {
    console.error("job failed", { queue: worker.name, jobId: job?.id, error });
  });
}

let vtuSchedulerQueue: Queue<QueuePayloads["vtu-fulfilment"]> | undefined;

scheduleVtuRecurringJobs()
  .then((queue) => {
    vtuSchedulerQueue = queue;
    if (queue) console.log("VTU recurring jobs scheduled", { providers: VTU_LIVE_PROVIDERS });
  })
  .catch((error: unknown) => {
    console.error("Failed to schedule VTU recurring jobs", { error });
  });

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  if (vtuSchedulerQueue) await vtuSchedulerQueue.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

console.log("FlipTrybe worker listening", { queues: enabledQueues, disabledQueues });
