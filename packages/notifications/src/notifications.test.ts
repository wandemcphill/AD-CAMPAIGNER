import { describe, expect, it } from "vitest";

import {
  createManagedAdsNotification,
  createNotification,
  managedAdsNotificationKinds
} from "./index";

describe("notifications", () => {
  it("stamps generic notifications", () => {
    const notification = createNotification({
      workspaceId: "workspace_123",
      channel: "IN_APP",
      title: "Queued",
      body: "Notification queued."
    });

    expect(notification.id).toMatch(/^ntf_/);
    expect(notification.createdAt).toBeTruthy();
    expect(notification.updatedAt).toBe(notification.createdAt);
  });

  it("creates managed ads launch notifications", () => {
    const notification = createManagedAdsNotification({
      workspaceId: "workspace_123",
      kind: "campaign_live",
      requestName: "TikTok LIVE launch sprint",
      requestId: "mads_req_123",
      campaignId: "cmp_123",
      provider: "TIKTOK",
      channel: "WEBSOCKET"
    });

    expect(notification).toMatchObject({
      workspaceId: "workspace_123",
      channel: "WEBSOCKET",
      title: "Managed ads campaign live",
      body: "TikTok LIVE launch sprint is live on TIKTOK."
    });
    expect(JSON.stringify(notification)).not.toContain("mads_req_123");
    expect(JSON.stringify(notification)).not.toContain("cmp_123");
  });

  it("creates managed ads budget notifications with readable amounts", () => {
    const notification = createManagedAdsNotification({
      workspaceId: "workspace_123",
      kind: "budget_attention",
      requestName: "Meta retargeting push",
      amount: { amountMinor: 250000, currency: "NGN" }
    });

    expect(managedAdsNotificationKinds).toContain("budget_attention");
    expect(notification.channel).toBe("IN_APP");
    expect(notification.body).toBe("Meta retargeting push budget needs review at NGN 2500.00.");
  });
});
