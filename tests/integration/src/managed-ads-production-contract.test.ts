import { describe, expect, it } from "vitest";

import {
  createEvent,
  createManagedAdsAutomationJob,
  managedAdsAutomationJobKinds,
  managedAdsChannels,
  managedAdsRequestStatuses,
  type ManagedAdsCampaignLaunchedEvent,
  type ManagedAdsPerformanceSnapshotRecordedEvent,
  type ManagedAdsRequestCreatedEvent,
  type ManagedAdsRequestUpdatedEvent
} from "../../../packages/events/src/index";
import {
  createManagedAdsNotification,
  managedAdsNotificationKinds
} from "../../../packages/notifications/src/index";

const request = {
  id: "mads_req_launch_001",
  workspaceId: "workspace_launch_001",
  creatorUserId: "user_launch_001",
  name: "June Growth Push",
  objective: "LEADS",
  status: "submitted",
  budget: { amountMinor: 5000000, currency: "NGN" },
  destinationKind: "WEBSITE",
  channels: ["META", "TIKTOK"]
} satisfies ManagedAdsRequestCreatedEvent["payload"]["request"];

const campaignId = "cmp_launch_001";
const providerReference = "tiktok_external_001";

describe("managed ads production contracts", () => {
  it("keeps launch-critical status, channel, job, and notification vocabularies available", () => {
    expect(managedAdsRequestStatuses).toEqual(
      expect.arrayContaining([
        "submitted",
        "in_review",
        "approved",
        "launching",
        "active",
        "paused",
        "completed",
        "rejected",
        "cancelled"
      ])
    );
    expect(managedAdsChannels).toEqual(expect.arrayContaining(["META", "TIKTOK", "MANUAL"]));
    expect(managedAdsAutomationJobKinds).toEqual(
      expect.arrayContaining([
        "request_submitted",
        "status_changed",
        "campaign_launch",
        "performance_sync",
        "budget_check"
      ])
    );
    expect(managedAdsNotificationKinds).toEqual(
      expect.arrayContaining([
        "request_submitted",
        "review_approved",
        "launch_ready",
        "campaign_live",
        "performance_digest",
        "budget_attention"
      ])
    );
  });

  it("creates a stable request-submitted job and client-safe notification", () => {
    const event = createEvent<ManagedAdsRequestCreatedEvent>({
      name: "ManagedAdsRequestCreated",
      tenantId: request.workspaceId,
      payload: { request }
    });
    const job = createManagedAdsAutomationJob({
      kind: "request_submitted",
      workspaceId: event.tenantId ?? request.workspaceId,
      requestId: event.payload.request.id,
      objective: event.payload.request.objective,
      destinationKind: event.payload.request.destinationKind,
      amountMinor: event.payload.request.budget.amountMinor,
      currency: event.payload.request.budget.currency,
      sourceEventId: event.id
    });
    const notification = createManagedAdsNotification({
      workspaceId: request.workspaceId,
      kind: "request_submitted",
      requestName: request.name,
      requestId: request.id
    });

    expect(job.idempotencyKey).toBe("managed_ads:request_submitted:mads_req_launch_001");
    expect(job.sourceEventId).toBe(event.id);
    expect(job.amountMinor).toBe(5000000);
    expect(notification).toMatchObject({
      workspaceId: request.workspaceId,
      channel: "IN_APP",
      title: "Managed ads request submitted",
      body: "June Growth Push is queued for managed ads review."
    });
    expect(JSON.stringify(notification)).not.toContain(request.id);
    expect(JSON.stringify(notification)).not.toContain(request.creatorUserId);
  });

  it("creates a stable status-change job without leaking raw IDs to client copy", () => {
    const event = createEvent<ManagedAdsRequestUpdatedEvent>({
      name: "ManagedAdsRequestUpdated",
      tenantId: request.workspaceId,
      payload: {
        requestId: request.id,
        previousStatus: "in_review",
        nextStatus: "approved",
        campaignId
      }
    });
    const job = createManagedAdsAutomationJob({
      kind: "status_changed",
      workspaceId: request.workspaceId,
      requestId: event.payload.requestId,
      campaignId,
      previousStatus: "in_review",
      nextStatus: event.payload.nextStatus,
      sourceEventId: event.id
    });
    const notification = createManagedAdsNotification({
      workspaceId: request.workspaceId,
      kind: "review_approved",
      requestName: request.name,
      requestId: request.id,
      campaignId
    });

    expect(job.idempotencyKey).toBe(
      "managed_ads:status_changed:mads_req_launch_001:approved:cmp_launch_001"
    );
    expect(notification.body).toBe("June Growth Push is approved for launch planning.");
    expect(JSON.stringify(notification)).not.toContain("cmp_launch_001");
  });

  it("creates provider-scoped launch jobs and human-readable launch notifications", () => {
    const event = createEvent<ManagedAdsCampaignLaunchedEvent>({
      name: "ManagedAdsCampaignLaunched",
      tenantId: request.workspaceId,
      payload: {
        requestId: request.id,
        campaignId,
        provider: "TIKTOK",
        providerReference
      }
    });
    const job = createManagedAdsAutomationJob({
      kind: "campaign_launch",
      workspaceId: request.workspaceId,
      requestId: event.payload.requestId,
      campaignId: event.payload.campaignId,
      provider: event.payload.provider,
      providerReference,
      sourceEventId: event.id
    });
    const notification = createManagedAdsNotification({
      workspaceId: request.workspaceId,
      kind: "campaign_live",
      requestName: request.name,
      campaignId: event.payload.campaignId,
      provider: event.payload.provider
    });

    expect(job.idempotencyKey).toBe(
      "managed_ads:campaign_launch:mads_req_launch_001:cmp_launch_001:tiktok"
    );
    expect(job.providerReference).toBe("tiktok_external_001");
    expect(notification.body).toBe("June Growth Push is live on TIKTOK.");
    expect(JSON.stringify(notification)).not.toContain("tiktok_external_001");
  });

  it("creates performance and budget follow-up jobs with distinct idempotency keys", () => {
    const event = createEvent<ManagedAdsPerformanceSnapshotRecordedEvent>({
      name: "ManagedAdsPerformanceSnapshotRecorded",
      tenantId: request.workspaceId,
      payload: {
        requestId: request.id,
        campaignId: "cmp_launch_001",
        recordedAt: "2026-05-27T00:00:00.000Z",
        metrics: [
          { name: "spend", unit: "minor", value: 2750000 },
          { name: "impressions", unit: "count", value: 120000 },
          { name: "clicks", unit: "count", value: 4200 }
        ]
      }
    });
    const performanceJob = createManagedAdsAutomationJob({
      kind: "performance_sync",
      workspaceId: request.workspaceId,
      requestId: event.payload.requestId,
      campaignId: event.payload.campaignId,
      sourceEventId: event.id
    });
    const budgetJob = createManagedAdsAutomationJob({
      kind: "budget_check",
      workspaceId: request.workspaceId,
      requestId: event.payload.requestId,
      campaignId: event.payload.campaignId,
      amountMinor: 2250000,
      currency: "NGN",
      sourceEventId: event.id
    });
    const performanceNotification = createManagedAdsNotification({
      workspaceId: request.workspaceId,
      kind: "performance_digest",
      requestName: request.name,
      campaignId: event.payload.campaignId
    });
    const budgetNotification = createManagedAdsNotification({
      workspaceId: request.workspaceId,
      kind: "budget_attention",
      requestName: request.name,
      amount: { amountMinor: 2250000, currency: "NGN" }
    });

    expect(performanceJob.idempotencyKey).toBe(
      "managed_ads:performance_sync:mads_req_launch_001:cmp_launch_001"
    );
    expect(budgetJob.idempotencyKey).toBe(
      "managed_ads:budget_check:mads_req_launch_001:cmp_launch_001"
    );
    expect(performanceNotification.body).toBe("June Growth Push has a new performance snapshot.");
    expect(budgetNotification.body).toBe("June Growth Push budget needs review at NGN 22500.00.");
  });
});
