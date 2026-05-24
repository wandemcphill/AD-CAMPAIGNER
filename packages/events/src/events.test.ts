import { describe, expect, it } from "vitest";

import {
  createDigitalAccessAutomationJob,
  createEvent,
  createManagedAdsAutomationJob,
  eventNames,
  managedAdsAutomationJobKinds,
  managedAdsChannels,
  managedAdsRequestStatuses,
  type ManagedAdsRequestCreatedEvent
} from "./index";

describe("platform events", () => {
  it("keeps the public event contract available", () => {
    expect(eventNames).toContain("CampaignCreated");
    expect(eventNames).toContain("PaymentCompleted");
    expect(eventNames).toContain("SMMOrderCreated");
    expect(eventNames).toContain("ManagedAdsRequestCreated");
    expect(eventNames).toContain("ManagedAdsCampaignLaunched");
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

  it("defines managed ads MVP event vocabulary", () => {
    expect(managedAdsRequestStatuses).toEqual([
      "submitted",
      "in_review",
      "approved",
      "launching",
      "active",
      "paused",
      "completed",
      "rejected",
      "cancelled"
    ]);
    expect(managedAdsChannels).toEqual(["META", "TIKTOK", "GOOGLE", "MANUAL"]);
    expect(managedAdsAutomationJobKinds).toContain("performance_sync");
  });

  it("stamps managed ads request events", () => {
    const event = createEvent<ManagedAdsRequestCreatedEvent>({
      name: "ManagedAdsRequestCreated",
      tenantId: "workspace_123",
      payload: {
        request: {
          id: "mads_req_123",
          workspaceId: "workspace_123",
          creatorUserId: "user_123",
          name: "TikTok LIVE launch sprint",
          objective: "LIVE_VIEWERS",
          status: "submitted",
          budget: { amountMinor: 500000, currency: "NGN" },
          destinationKind: "TIKTOK_LIVE",
          channels: ["TIKTOK"]
        }
      }
    });

    expect(event.id).toMatch(/^evt_|-/);
    expect(event.name).toBe("ManagedAdsRequestCreated");
    expect(event.payload.request.status).toBe("submitted");
  });

  it("creates deterministic Managed Ads automation job keys", () => {
    const job = createManagedAdsAutomationJob({
      kind: "campaign_launch",
      workspaceId: "workspace_123",
      requestId: "mads_req_123",
      campaignId: "cmp_123",
      provider: "TIKTOK",
      objective: "LIVE_VIEWERS",
      destinationKind: "TIKTOK_LIVE",
      nextStatus: "launching",
      amountMinor: 500000,
      currency: "NGN"
    });

    expect(job.idempotencyKey).toBe(
      "managed_ads:campaign_launch:mads_req_123:launching:cmp_123:tiktok"
    );
    expect(job.queuedAt).toBeTruthy();
  });
});
