import { describe, expect, it } from "vitest";

import { processQueueJob } from "./processors";

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
});
