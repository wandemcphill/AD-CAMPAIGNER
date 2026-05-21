import { describe, expect, it } from "vitest";

import { processQueueJob } from "./processors";
import { createQueueJobOptions } from "./queues";

describe("queue processors", () => {
  it("processes campaign jobs", () => {
    const result = processQueueJob("campaigns", {
      data: { campaignId: "cmp_123", action: "start" }
    } as never);

    expect(result.status).toBe("processed");
    expect(result.detail).toContain("cmp_123");
  });

  it("processes media jobs", () => {
    const result = processQueueJob("media-processing", {
      data: { assetId: "asset_123", operations: ["thumbnail-generation"] }
    } as never);

    expect(result.detail).toContain("thumbnail-generation");
  });

  it("holds risky SMM jobs for review", () => {
    const result = processQueueJob("smm-fulfillment", {
      data: {
        orderId: "smm_123",
        supplier: "live",
        fulfillment: {
          orderId: "smm_123",
          workspaceId: "workspace",
          serviceKind: "FOLLOWERS",
          destinationKind: "INSTAGRAM_PROFILE",
          destinationUrl: "https://instagram.com/fliptrybe",
          quantity: 10000,
          supplierCost: { amountMinor: 1000, currency: "NGN" },
          customerPrice: { amountMinor: 1600, currency: "NGN" },
          grossMargin: { amountMinor: 600, currency: "NGN" },
          fraudRiskLevel: "HIGH",
          retryPolicy: {
            attempts: 5,
            baseDelayMs: 30000,
            maxDelayMs: 900000,
            jitterRatio: 0.2
          },
          enqueuedAt: "2026-05-21T12:00:00.000Z"
        }
      }
    } as never);

    expect(result.status).toBe("skipped");
    expect(result.detail).toContain("risk review");
  });

  it("creates durable BullMQ job options", () => {
    const options = createQueueJobOptions("smm-fulfillment");

    expect(options.attempts).toBe(5);
    expect(options.removeOnFail.count).toBeGreaterThan(options.removeOnComplete.count);
  });
});
