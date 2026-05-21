import { Worker } from "bullmq";
import IORedis from "ioredis";

import { processQueueJob } from "./processors";
import { type QueueName, type QueuePayloads, queueNames, queueRuntimePolicies } from "./queues";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const workers = queueNames.map(
  (queueName) =>
    new Worker<QueuePayloads[QueueName]>(
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

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

console.log("FlipTrybe worker listening", { queues: queueNames });
