import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { processQueueJob, shouldStartQueueWorker } from "./processors";
import { type QueueName, type QueuePayloads, queueNames, queueRuntimePolicies } from "./queues";
import { processVtuFulfilmentJob } from "./vtu-processor";
import { processVirtualNumbersJob } from "./virtual-numbers-processor";
import { processWorkflowAutomationJob } from "./workflow-automation-processor";
import { processRewardEngineJob } from "./reward-engine-processor";
import { processTrustEngineJob } from "./trust-engine-processor";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

// VTU providers wired to real adapters (see apps/worker/src/vtu-processor.ts). Extend this
// when a new adapter goes live so its catalog/health jobs get scheduled automatically.
const VTU_LIVE_PROVIDERS = ["vtpass", "clubkonnect"];

// Virtual Number providers wired to real adapters (see virtual-numbers-processor.ts).
const VIRTUAL_NUMBER_LIVE_PROVIDERS = ["smspool", "5sim", "smspva"];

async function scheduleWorkflowAutomationJobs() {
  if (!shouldStartQueueWorker("workflow-automation")) return;

  const queue = new Queue<QueuePayloads["workflow-automation"]>("workflow-automation", { connection });

  // Sweep all ACTIVE SCHEDULE workflows every 5 minutes.
  await queue.upsertJobScheduler(
    "workflow-schedule-sweep",
    { every: 5 * 60_000 },
    { name: "evaluate_schedule", data: {} }
  );

  // Sweep threshold-based workflows (budget, wallet, creative-age) every 15 minutes.
  await queue.upsertJobScheduler(
    "workflow-threshold-sweep",
    { every: 15 * 60_000 },
    { name: "evaluate_thresholds", data: {} }
  );

  return queue;
}

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

async function scheduleVirtualNumbersRecurringJobs() {
  if (!shouldStartQueueWorker("virtual-numbers")) return;

  const queue = new Queue<QueuePayloads["virtual-numbers"]>("virtual-numbers", { connection });

  await queue.upsertJobScheduler(
    "vn-poll-messages",
    { every: 2 * 60_000 }, // every 2 minutes — SMS delivery is time-sensitive
    { name: "poll_messages", data: {} }
  );

  await queue.upsertJobScheduler(
    "vn-lifecycle-sweep",
    { every: 15 * 60_000 }, // every 15 minutes
    { name: "lifecycle_sweep", data: {} }
  );

  await queue.upsertJobScheduler(
    "vn-expiry-warning",
    { every: 60 * 60_000 }, // hourly
    { name: "expiry_warning", data: {} }
  );

  await queue.upsertJobScheduler(
    "vn-release-sweep",
    { every: 30 * 60_000 }, // every 30 minutes
    { name: "release", data: {} }
  );

  await queue.upsertJobScheduler(
    "vn-reconcile-sweep",
    { every: 60 * 60_000 }, // hourly
    { name: "reconcile", data: {} }
  );

  await queue.upsertJobScheduler(
    "vn-retention-purge",
    { every: 24 * 60 * 60_000 }, // daily
    { name: "retention_purge", data: {} }
  );

  for (const providerName of VIRTUAL_NUMBER_LIVE_PROVIDERS) {
    await queue.upsertJobScheduler(
      `vn-health-${providerName}`,
      { every: 5 * 60_000 }, // every 5 minutes
      { name: "provider_health", data: { providerName } }
    );
  }

  return queue;
}

const enabledQueues = queueNames.filter((queueName) => shouldStartQueueWorker(queueName));
const disabledQueues = queueNames.filter((queueName) => !shouldStartQueueWorker(queueName));
const workers = enabledQueues.map((queueName) => {
  if (queueName === "vtu-fulfilment") {
    return new Worker<QueuePayloads["vtu-fulfilment"]>(queueName, processVtuFulfilmentJob, {
      connection,
      concurrency: Number(
        process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency
      )
    });
  }

  if (queueName === "virtual-numbers") {
    return new Worker<QueuePayloads["virtual-numbers"]>(queueName, processVirtualNumbersJob, {
      connection,
      concurrency: Number(
        process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency
      )
    });
  }

  if (queueName === "workflow-automation") {
    return new Worker<QueuePayloads["workflow-automation"]>(queueName, processWorkflowAutomationJob, {
      connection,
      concurrency: Number(
        process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency
      )
    });
  }

  if (queueName === "reward-engine") {
    return new Worker<QueuePayloads["reward-engine"]>(queueName, processRewardEngineJob, {
      connection,
      concurrency: Number(
        process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency
      )
    });
  }

  if (queueName === "trust-engine") {
    return new Worker<QueuePayloads["trust-engine"]>(queueName, processTrustEngineJob, {
      connection,
      concurrency: Number(
        process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency
      )
    });
  }

  return new Worker<QueuePayloads[QueueName]>(
    queueName,
    (job) => Promise.resolve(processQueueJob(queueName, job)),
    {
      connection,
      concurrency: Number(
        process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency
      )
    }
  );
});

for (const worker of workers) {
  worker.on("completed", (job) => {
    console.log("job completed", { queue: worker.name, jobId: job.id });
  });

  worker.on("failed", (job, error) => {
    console.error("job failed", { queue: worker.name, jobId: job?.id, error });
  });
}

let vtuSchedulerQueue: Queue<QueuePayloads["vtu-fulfilment"]> | undefined;
let virtualNumbersSchedulerQueue: Queue<QueuePayloads["virtual-numbers"]> | undefined;
let workflowAutomationSchedulerQueue: Queue<QueuePayloads["workflow-automation"]> | undefined;

scheduleVtuRecurringJobs()
  .then((queue) => {
    vtuSchedulerQueue = queue;
    if (queue) console.log("VTU recurring jobs scheduled", { providers: VTU_LIVE_PROVIDERS });
  })
  .catch((error: unknown) => {
    console.error("Failed to schedule VTU recurring jobs", { error });
  });

scheduleVirtualNumbersRecurringJobs()
  .then((queue) => {
    virtualNumbersSchedulerQueue = queue;
    if (queue) {
      console.log("Virtual Numbers recurring jobs scheduled", {
        providers: VIRTUAL_NUMBER_LIVE_PROVIDERS
      });
    }
  })
  .catch((error: unknown) => {
    console.error("Failed to schedule Virtual Numbers recurring jobs", { error });
  });

scheduleWorkflowAutomationJobs()
  .then((queue) => {
    workflowAutomationSchedulerQueue = queue;
    if (queue) console.log("Workflow Automation recurring jobs scheduled");
  })
  .catch((error: unknown) => {
    console.error("Failed to schedule Workflow Automation recurring jobs", { error });
  });

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  if (vtuSchedulerQueue) await vtuSchedulerQueue.close();
  if (virtualNumbersSchedulerQueue) await virtualNumbersSchedulerQueue.close();
  if (workflowAutomationSchedulerQueue) await workflowAutomationSchedulerQueue.close();
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
