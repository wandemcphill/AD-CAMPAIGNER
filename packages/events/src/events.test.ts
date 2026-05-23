import { describe, expect, it } from "vitest";

import { createDigitalAccessAutomationJob, createEvent, eventNames } from "./index";

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

  it("creates deterministic Digital Access automation job keys", () => {
    const job = createDigitalAccessAutomationJob({
      kind: "status_changed",
      workspaceId: "workspace_123",
      requestId: "da_req_123",
      previousStatus: "pending",
      nextStatus: "processing"
    });

    expect(job.idempotencyKey).toBe("digital_access:status_changed:da_req_123:processing");
    expect(job.queuedAt).toBeTruthy();
  });
});
