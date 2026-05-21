import { describe, expect, it } from "vitest";

import { createEvent, eventNames } from "./index";

describe("platform events", () => {
  it("keeps the public event contract available", () => {
    expect(eventNames).toContain("CampaignCreated");
    expect(eventNames).toContain("PaymentCompleted");
    expect(eventNames).toContain("SMMOrderCreated");
  });

  it("stamps new events", () => {
    const event = createEvent({
      name: "CampaignStarted",
      payload: { campaignId: "cmp_123" }
    });

    expect(event.id).toMatch(/^evt_|-/);
    expect(event.occurredAt).toBeTruthy();
  });
});
