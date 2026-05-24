import { describe, expect, it } from "vitest";

import {
  createEvent,
  createManagedAdsAutomationJob,
  type ManagedAdsRequestUpdatedEvent
} from "../../../packages/events/src/index";
import { createManagedAdsNotification } from "../../../packages/notifications/src/index";

describe("managed ads helper flow", () => {
  it("connects request events, automation jobs, and notifications without API/schema state", () => {
    const event = createEvent<ManagedAdsRequestUpdatedEvent>({
      name: "ManagedAdsRequestUpdated",
      tenantId: "workspace_thread_fg",
      payload: {
        requestId: "mads_req_thread_fg",
        previousStatus: "in_review",
        nextStatus: "approved",
        campaignId: "cmp_thread_fg"
      }
    });
    const job = createManagedAdsAutomationJob({
      kind: "status_changed",
      workspaceId: event.tenantId ?? "workspace_thread_fg",
      requestId: event.payload.requestId,
      campaignId: event.payload.campaignId!,
      previousStatus: event.payload.previousStatus!,
      nextStatus: event.payload.nextStatus,
      sourceEventId: event.id
    });
    const notification = createManagedAdsNotification({
      workspaceId: event.tenantId ?? "workspace_thread_fg",
      kind: "review_approved",
      requestName: "Thread F/G launch sprint",
      requestId: event.payload.requestId,
      campaignId: event.payload.campaignId!
    });

    expect(job.idempotencyKey).toBe(
      "managed_ads:status_changed:mads_req_thread_fg:approved:cmp_thread_fg"
    );
    expect(job.sourceEventId).toBe(event.id);
    expect(notification).toMatchObject({
      workspaceId: "workspace_thread_fg",
      channel: "IN_APP",
      title: "Managed ads request approved",
      body: "Thread F/G launch sprint is approved for launch planning."
    });
    expect(JSON.stringify(notification)).not.toContain("mads_req_thread_fg");
    expect(JSON.stringify(notification)).not.toContain("cmp_thread_fg");
  });
});
