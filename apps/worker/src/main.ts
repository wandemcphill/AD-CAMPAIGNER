import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { processQueueJob, shouldStartQueueWorker } from "./processors";
import { type QueueName, type QueuePayloads, queueNames, queueRuntimePolicies } from "./queues";
import { processVtuFulfilmentJob } from "./vtu-processor";
import { processVirtualNumbersJob } from "./virtual-numbers-processor";
import { processWorkflowAutomationJob } from "./workflow-automation-processor";
import { processRewardEngineJob } from "./reward-engine-processor";
import { processTrustEngineJob } from "./trust-engine-processor";
import { processNotificationDispatchJob } from "./notifications-processor";
import { processManagedAdsAutomationJob } from "./managed-ads-automation-processor";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const VTU_LIVE_PROVIDERS = ["clubkonnect", "gsubz", "sirpdata", "topupwizard"];
const VTU_DATA_CATALOG_PROVIDERS = ["gsubz"];
const VTU_CABLE_CATALOG_PROVIDERS = ["clubkonnect"];
const VTU_BETTING_CATALOG_PROVIDERS = ["clubkonnect"];
const VTU_EDUCATION_CATALOG_PROVIDERS = ["sirpdata", "topupwizard"];
const VIRTUAL_NUMBER_LIVE_PROVIDERS = ["smspool", "5sim", "smspva"];

async function scheduleManagedAdsRecurringJobs() {
  if (!shouldStartQueueWorker("managed-ads-automation")) return;
  const queue = new Queue<QueuePayloads["managed-ads-automation"]>("managed-ads-automation", { connection });
  await queue.upsertJobScheduler("ma-lifecycle-sweep", { every: 15 * 60_000 }, {
    name: "lifecycle_sweep",
    data: {
      id: "ma-lifecycle-sweep",
      kind: "lifecycle_sweep",
      workspaceId: "system",
      requestId: "lifecycle-sweep",
      idempotencyKey: "managed-ads:lifecycle_sweep",
      queuedAt: new Date().toISOString()
    }
  });
  return queue;
}

async function scheduleWorkflowAutomationJobs() {
  if (!shouldStartQueueWorker("workflow-automation")) return;
  const queue = new Queue<QueuePayloads["workflow-automation"]>("workflow-automation", { connection });
  await queue.upsertJobScheduler("workflow-schedule-sweep", { every: 5 * 60_000 }, { name: "evaluate_schedule", data: {} });
  await queue.upsertJobScheduler("workflow-threshold-sweep", { every: 15 * 60_000 }, { name: "evaluate_thresholds", data: {} });
  return queue;
}

async function scheduleVtuRecurringJobs() {
  if (!shouldStartQueueWorker("vtu-fulfilment")) return;

  const queue = new Queue<QueuePayloads["vtu-fulfilment"]>("vtu-fulfilment", { connection });

  await queue.upsertJobScheduler("vtu-reconcile-sweep", { every: 10 * 60_000 }, { name: "reconcile", data: {} });

  // Warm the production DATA/CABLE catalogs immediately after worker startup.
  // The recurring schedulers below keep them fresh daily. This removes the
  // first-deploy window where the database can remain empty until the first tick.
  for (const providerName of VTU_DATA_CATALOG_PROVIDERS) {
    await queue.add(
      "plan_catalog_sync",
      { name: "plan_catalog_sync", providerName },
      { jobId: `vtu-plan-sync-warmup-${providerName}`, removeOnComplete: true, removeOnFail: 100 }
    );
  }

  for (const providerName of VTU_CABLE_CATALOG_PROVIDERS) {
    await queue.add(
      "cable_catalog_sync",
      { name: "cable_catalog_sync", providerName },
      { jobId: `vtu-cable-sync-warmup-${providerName}`, removeOnComplete: true, removeOnFail: 100 }
    );
  }

  for (const providerName of VTU_DATA_CATALOG_PROVIDERS) {
    await queue.upsertJobScheduler(
      `vtu-plan-sync-${providerName}`,
      { every: 24 * 60 * 60_000 },
      { name: "plan_catalog_sync", data: { providerName } }
    );
  }

  for (const providerName of VTU_CABLE_CATALOG_PROVIDERS) {
    await queue.upsertJobScheduler(
      `vtu-cable-sync-${providerName}`,
      { every: 24 * 60 * 60_000 },
      { name: "cable_catalog_sync", data: { providerName } }
    );
  }

  for (const providerName of VTU_BETTING_CATALOG_PROVIDERS) {
    await queue.upsertJobScheduler(
      `vtu-betting-sync-${providerName}`,
      { every: 24 * 60 * 60_000 },
      { name: "betting_catalog_sync", data: { providerName } }
    );
  }

  for (const providerName of VTU_EDUCATION_CATALOG_PROVIDERS) {
    await queue.upsertJobScheduler(
      `vtu-education-sync-${providerName}`,
      { every: 24 * 60 * 60_000 },
      { name: "education_catalog_sync", data: { providerName } }
    );
  }

  for (const providerName of VTU_LIVE_PROVIDERS) {
    await queue.upsertJobScheduler(
      `vtu-health-${providerName}`,
      { every: 5 * 60_000 },
      { name: "provider_health", data: { providerName } }
    );
    await queue.upsertJobScheduler(
      `vtu-balance-${providerName}`,
      { every: 30 * 60_000 },
      { name: "provider_balance_check", data: { providerName } }
    );
    await queue.upsertJobScheduler(
      `vtu-price-sync-${providerName}`,
      { every: 6 * 60 * 60_000 },
      { name: "price_sync", data: { providerName } }
    );
  }

  return queue;
}

async function scheduleVirtualNumbersRecurringJobs() {
  if (!shouldStartQueueWorker("virtual-numbers")) return;
  const queue = new Queue<QueuePayloads["virtual-numbers"]>("virtual-numbers", { connection });
  await queue.upsertJobScheduler("vn-poll-messages", { every: 2 * 60_000 }, { name: "poll_messages", data: {} });
  await queue.upsertJobScheduler("vn-lifecycle-sweep", { every: 15 * 60_000 }, { name: "lifecycle_sweep", data: {} });
  await queue.upsertJobScheduler("vn-expiry-warning", { every: 60 * 60_000 }, { name: "expiry_warning", data: {} });
  await queue.upsertJobScheduler("vn-release-sweep", { every: 30 * 60_000 }, { name: "release", data: {} });
  await queue.upsertJobScheduler("vn-reconcile-sweep", { every: 60 * 60_000 }, { name: "reconcile", data: {} });
  await queue.upsertJobScheduler("vn-retention-purge", { every: 24 * 60 * 60_000 }, { name: "retention_purge", data: {} });
  for (const providerName of VIRTUAL_NUMBER_LIVE_PROVIDERS) {
    await queue.upsertJobScheduler(`vn-health-${providerName}`, { every: 5 * 60_000 }, { name: "provider_health", data: { providerName } });
  }
  return queue;
}

const enabledQueues = queueNames.filter((queueName) => shouldStartQueueWorker(queueName));
const disabledQueues = queueNames.filter((queueName) => !shouldStartQueueWorker(queueName));
const workers = enabledQueues.map((queueName) => {
  if (queueName === "vtu-fulfilment") {
    return new Worker<QueuePayloads["vtu-fulfilment"]>(queueName, processVtuFulfilmentJob, {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency)
    });
  }
  if (queueName === "virtual-numbers") {
    return new Worker<QueuePayloads["virtual-numbers"]>(queueName, processVirtualNumbersJob, {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency)
    });
  }
  if (queueName === "workflow-automation") {
    return new Worker<QueuePayloads["workflow-automation"]>(queueName, processWorkflowAutomationJob, {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency)
    });
  }
  if (queueName === "reward-engine") {
    return new Worker<QueuePayloads["reward-engine"]>(queueName, processRewardEngineJob, {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency)
    });
  }
  if (queueName === "trust-engine") {
    return new Worker<QueuePayloads["trust-engine"]>(queueName, processTrustEngineJob, {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency)
    });
  }
  if (queueName === "notifications") {
    return new Worker<QueuePayloads["notifications"]>(queueName, processNotificationDispatchJob, {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency)
    });
  }
  if (queueName === "managed-ads-automation") {
    return new Worker<QueuePayloads["managed-ads-automation"]>(queueName, processManagedAdsAutomationJob, {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency)
    });
  }
  return new Worker<QueuePayloads[QueueName]>(queueName, (job) => Promise.resolve(processQueueJob(queueName, job)), {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? queueRuntimePolicies[queueName].concurrency)
  });
});

for (const worker of workers) {
  worker.on("completed", (job) => console.log("job completed", { queue: worker.name, jobId: job.id }));
  worker.on("failed", (job, error) => console.error("job failed", { queue: worker.name, jobId: job?.id, error }));
}

let vtuSchedulerQueue: Queue<QueuePayloads["vtu-fulfilment"]> | undefined;
let virtualNumbersSchedulerQueue: Queue<QueuePayloads["virtual-numbers"]> | undefined;
let workflowAutomationSchedulerQueue: Queue<QueuePayloads["workflow-automation"]> | undefined;
let managedAdsSchedulerQueue: Queue<QueuePayloads["managed-ads-automation"]> | undefined;

scheduleVtuRecurringJobs()
  .then((queue) => {
    vtuSchedulerQueue = queue;
    if (queue) console.log("VTU recurring jobs scheduled", { providers: VTU_LIVE_PROVIDERS });
  })
  .catch((error: unknown) => console.error("Failed to schedule VTU recurring jobs", { error }));

scheduleVirtualNumbersRecurringJobs()
  .then((queue) => {
    virtualNumbersSchedulerQueue = queue;
    if (queue) console.log("Virtual Numbers recurring jobs scheduled", { providers: VIRTUAL_NUMBER_LIVE_PROVIDERS });
  })
  .catch((error: unknown) => console.error("Failed to schedule Virtual Numbers recurring jobs", { error }));

scheduleWorkflowAutomationJobs()
  .then((queue) => {
    workflowAutomationSchedulerQueue = queue;
    if (queue) console.log("Workflow Automation recurring jobs scheduled");
  })
  .catch((error: unknown) => console.error("Failed to schedule Workflow Automation jobs", { error }));

scheduleManagedAdsRecurringJobs()
  .then((queue) => {
    managedAdsSchedulerQueue = queue;
    if (queue) console.log("Managed Ads recurring jobs scheduled");
  })
  .catch((error: unknown) => console.error("Failed to schedule Managed Ads jobs", { error }));

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  if (vtuSchedulerQueue) await vtuSchedulerQueue.close();
  if (virtualNumbersSchedulerQueue) await virtualNumbersSchedulerQueue.close();
  if (workflowAutomationSchedulerQueue) await workflowAutomationSchedulerQueue.close();
  if (managedAdsSchedulerQueue) await managedAdsSchedulerQueue.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

console.log("FlipTrybe worker listening", { queues: enabledQueues, disabledQueues });
