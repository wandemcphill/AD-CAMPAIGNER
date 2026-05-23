import { describe, expect, it } from "vitest";

import { toCanonicalEvent } from "./ai-brain.client";
import { PlatformService } from "./platform.service";
import type { AuthenticatedRequestContext } from "./request-context";

const workspaceA: AuthenticatedRequestContext = {
  workspaceId: "workspace_a",
  userId: "user_a"
};
const workspaceB: AuthenticatedRequestContext = {
  workspaceId: "workspace_b",
  userId: "user_b"
};

function requireReference(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`${label} reference was not created.`);
  }

  return value;
}

describe("PlatformService", () => {
  it("creates campaigns through the provider boundary", async () => {
    const service = new PlatformService();
    const campaign = await service.createCampaign(workspaceA, {
      name: "Test campaign",
      objective: "TRAFFIC",
      destinationKind: "WEBSITE",
      destinationUrl: "https://fliptrybe.com",
      budgetMinor: 100000
    });

    expect(campaign.status).toBe("QUEUED");
    expect(campaign.workspaceId).toBe(workspaceA.workspaceId);
    expect(campaign.creatorUserId).toBe(workspaceA.userId);
    expect(campaign.providerReference).toMatch(/^mock_ads_/);
    expect(service.getEvents()).toHaveLength(1);
    const [event] = service.getEvents();
    expect(event).toBeDefined();
    expect(toCanonicalEvent(event!)?.event).toBe("campaign_created");
  });

  it("tracks payment intents and wallet state", async () => {
    const service = new PlatformService();
    const intent = await service.createPaymentIntent(workspaceA, {
      amountMinor: 250000,
      currency: "NGN"
    });

    expect(intent.status).toBe("PENDING");
    expect(intent.workspaceId).toBe(workspaceA.workspaceId);
    expect(service.getWallet(workspaceA).workspaceId).toBe(workspaceA.workspaceId);
    expect(service.getWallet(workspaceA).availableBalance.amountMinor).toBeGreaterThan(0);
  });

  it("returns local ads insight fallback when AI Brain is disabled", async () => {
    const service = new PlatformService();
    const insights = await service.getAiAdsInsights(workspaceA);

    expect(insights.summary.mode).toBe("local_fallback");
    expect(insights.summary.account_id).toBe(workspaceA.workspaceId);
    expect(insights.items[0]?.reasons).toContain("local_campaign_snapshot");
  });

  it("keeps campaigns and support tickets scoped to the active workspace", async () => {
    const service = new PlatformService();
    await service.createCampaign(workspaceA, { name: "Workspace A campaign" });
    await service.createCampaign(workspaceB, { name: "Workspace B campaign" });
    service.createSupportTicket(workspaceA, { subject: "Workspace A support" });
    service.createSupportTicket(workspaceB, { subject: "Workspace B support" });

    expect(service.listCampaigns(workspaceA)).toEqual([
      expect.objectContaining({ name: "Workspace A campaign", workspaceId: workspaceA.workspaceId })
    ]);
    expect(service.listCampaigns(workspaceB)).toEqual([
      expect.objectContaining({ name: "Workspace B campaign", workspaceId: workspaceB.workspaceId })
    ]);
    expect(service.listSupportTickets(workspaceA)).toEqual([
      expect.objectContaining({
        subject: "Workspace A support",
        workspaceId: workspaceA.workspaceId
      })
    ]);
    expect(service.listSupportTickets(workspaceB)).toEqual([
      expect.objectContaining({
        subject: "Workspace B support",
        workspaceId: workspaceB.workspaceId
      })
    ]);
  });

  it("scopes workspace read models to the active workspace", () => {
    const service = new PlatformService();

    expect(service.getWallet(workspaceA).id).toBe(`wallet_${workspaceA.workspaceId}`);
    expect(service.getAnalyticsOverview(workspaceA).metrics).toEqual(
      expect.arrayContaining([expect.objectContaining({ workspaceId: workspaceA.workspaceId })])
    );
    expect(service.listNotifications(workspaceA)).toEqual([
      expect.objectContaining({ workspaceId: workspaceA.workspaceId })
    ]);
    expect(service.listAuditLogs(workspaceA)).toEqual([
      expect.objectContaining({
        workspaceId: workspaceA.workspaceId,
        actorUserId: workspaceA.userId
      })
    ]);
  });

  it("rejects cross-workspace payment and SMM supplier references", async () => {
    const service = new PlatformService();
    const intent = await service.createPaymentIntent(workspaceA, {
      amountMinor: 250000,
      currency: "NGN"
    });
    const order = await service.createSmmOrder(workspaceA, { quantity: 100 });
    const paymentReference = requireReference(intent.providerReference, "payment");
    const supplierReference = requireReference(order.supplierReference, "supplier");

    await expect(service.verifyPayment(workspaceB, paymentReference)).rejects.toThrow(
      "Payment reference does not belong to the active workspace."
    );
    expect(() =>
      service.getSmmOrderStatuses(workspaceB, {
        supplierReferences: [supplierReference]
      })
    ).toThrow("One or more SMM supplier references do not belong to the active workspace.");
  });

  it("rejects protected platform reads without workspace context", () => {
    const service = new PlatformService();

    expect(() => service.listCampaigns()).toThrow("Authenticated workspace context is required.");
    expect(() => service.getWallet()).toThrow("Authenticated workspace context is required.");
  });
});
