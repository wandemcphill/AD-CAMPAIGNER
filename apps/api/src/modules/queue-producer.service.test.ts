import { describe, expect, it } from "vitest";

import { QueueProducerService } from "./queue-producer.service";

describe("QueueProducerService", () => {
  it("does not fail request flows when Redis is not configured", async () => {
    const previousRedisUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;

    const service = new QueueProducerService();
    const result = await service.enqueueDigitalAccessAutomation({
      id: "da_job_123",
      kind: "request_created",
      workspaceId: "workspace_123",
      requestId: "da_req_123",
      idempotencyKey: "digital_access:request_created:da_req_123",
      queuedAt: "2026-05-23T12:00:00.000Z"
    });

    expect(result).toEqual({
      enqueued: false,
      queue: "digital-access-automation",
      reason: "disabled"
    });

    if (previousRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousRedisUrl;
    }
  });
});
