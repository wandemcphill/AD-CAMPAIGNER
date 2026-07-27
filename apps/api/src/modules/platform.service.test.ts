import { describe, expect, it, vi } from "vitest";

import type { SmmSupplierAdapter } from "@fliptrybe/providers";
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

function createTestSupplier(overrides: Partial<SmmSupplierAdapter> = {}): SmmSupplierAdapter {
  return {
    name: "test-smm",
    listServices: () => Promise.resolve([]),
    quoteService: (input) => Promise.resolve({
      amount: { amountMinor: input.quantity * 25, currency: "NGN" },
      estimatedDeliveryMinutes: 120,
      supplierName: "test-smm"
    }),
    createOrder: () => Promise.resolve({
      supplierReference: "test_supplier_order",
      status: "QUEUED"
    }),
    getBalance: () => Promise.resolve({
      supplierName: "test-smm",
      amount: { amountMinor: 100000000, currency: "NGN" }
    }),
    getOrderStatus: (supplierReference) => Promise.resolve({
      supplierReference,
      status: "PROCESSING",
      remains: 50
    }),
    getOrderStatuses: (supplierReferences) =>
      Promise.resolve(supplierReferences.map((supplierReference) => ({
        supplierReference,
        status: "PROCESSING",
        remains: 50
      }))),
    requestRefill: (supplierReference) => Promise.resolve({
      supplierReference,
      accepted: true
    }),
    requestCancel: (supplierReferences) =>
      Promise.resolve(supplierReferences.map((supplierReference) => ({
        supplierReference,
        accepted: true
      }))),
    ...overrides
  };
}

function replaceSmmSupplier(service: PlatformService, supplier: SmmSupplierAdapter) {
  Object.defineProperty(service, "smmSupplier", {
    value: supplier
  });
}

describe("PlatformService", () => {
  it("does not expose legacy mock provider data in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllowMockProviders = process.env.ALLOW_MOCK_PROVIDERS;
    const previousAiProvider = process.env.AI_PROVIDER;

    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_MOCK_PROVIDERS;
    process.env.AI_PROVIDER = "anthropic";

    try {
      const service = new PlatformService();

      expect(service.getHealth().providers).toEqual(
        expect.objectContaining({
          ads: "managed-ads",
          ai: "anthropic",
          payments: "not-configured",
          storage: "not-configured"
        })
      );
      expect(service.listCampaigns(workspaceA)).toEqual([]);
      expect(service.listLivePromotions(workspaceA)).toEqual([]);
      expect(service.listNotifications(workspaceA)).toEqual([]);
      expect(service.listAuditLogs(workspaceA)).toEqual([]);
      expect(service.search()).toEqual({ query: "", results: [] });
      expect(service.getHealth().providers.smm).toBe("smm-router:none");
      await expect(service.createSmmOrder(workspaceA, { quantity: 100 })).rejects.toThrow(
        "No SMM supplier could quote this service."
      );
      await expect(service.quoteCampaign({})).rejects.toThrow("legacy mock provider");
      await expect(service.createCampaign(workspaceA, { name: "Launch" })).rejects.toThrow(
        "legacy mock provider"
      );
      await expect(service.createAiSuggestion()).rejects.toThrow("legacy mock provider");
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousAllowMockProviders === undefined) {
        delete process.env.ALLOW_MOCK_PROVIDERS;
      } else {
        process.env.ALLOW_MOCK_PROVIDERS = previousAllowMockProviders;
      }
      if (previousAiProvider === undefined) {
        delete process.env.AI_PROVIDER;
      } else {
        process.env.AI_PROVIDER = previousAiProvider;
      }
    }
  });

  it("creates campaigns through the provider boundary", async () => {
    const service = new PlatformService();
    const campaign = await service.createCampaign(workspaceA, {
      name: "Test campaign",
      objective: "TRAFFIC",
      destinationKind: "WEBSITE",
      destinationUrl: "https://fliptrybe.store",
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

  it("blocks Growth supplier execution when funds cannot be reserved", async () => {
    const service = new PlatformService();
    const createOrder = vi.fn(() => Promise.resolve({
      supplierReference: "should_not_execute",
      status: "QUEUED" as const
    }));
    replaceSmmSupplier(
      service,
      createTestSupplier({
        quoteService: () => Promise.resolve({
          amount: { amountMinor: 1300000, currency: "NGN" },
          estimatedDeliveryMinutes: 120,
          supplierName: "test-smm"
        }),
        createOrder
      })
    );
    const walletBefore = service.getWallet(workspaceA);

    await expect(
      service.createGrowthOrder(workspaceA, {
        serviceCode: "tiktok-views",
        quantity: 100,
        destinationUrl: "https://www.tiktok.com/@fliptrybe/video/100",
        idempotencyKey: "growth-unfunded"
      })
    ).rejects.toThrow("Growth order requires a paid invoice or enough wallet balance");

    expect(createOrder).not.toHaveBeenCalled();
    expect(service.getWallet(workspaceA).availableBalance.amountMinor).toBe(
      walletBefore.availableBalance.amountMinor
    );
    expect((await service.listGrowthOrders(workspaceA))).toHaveLength(0);
    expect((await service.getGrowthOverview(workspaceA)).monitoring.unpaidExecutionAttempts).toBe(1);
  });

  it("reserves Growth funds and prevents duplicate active supplier submissions", async () => {
    const service = new PlatformService();
    const walletBefore = service.getWallet(workspaceA);
    const destinationUrl = "https://www.tiktok.com/@fliptrybe/video/101";

    const created = await service.createGrowthOrder(workspaceA, {
      serviceCode: "tiktok-views",
      quantity: 100,
      destinationUrl,
      idempotencyKey: "growth-duplicate-guard"
    });

    expect(created.order.paymentStatus).toBe("FUNDS_RESERVED");
    expect(created.order.reservationLedgerEntryId).toMatch(/^ledger_/);
    expect(service.getWallet(workspaceA).availableBalance.amountMinor).toBe(
      walletBefore.availableBalance.amountMinor - created.order.amount.amountMinor
    );
    expect(service.getWallet(workspaceA).heldBalance.amountMinor).toBe(
      created.order.amount.amountMinor
    );

    await expect(
      service.createGrowthOrder(workspaceA, {
        serviceCode: "tiktok-views",
        quantity: 100,
        destinationUrl,
        idempotencyKey: "growth-duplicate-guard-new-key"
      })
    ).rejects.toThrow("An active Growth order already exists");

    const replay = await service.createGrowthOrder(workspaceA, {
      serviceCode: "tiktok-views",
      quantity: 100,
      destinationUrl,
      idempotencyKey: "growth-duplicate-guard"
    });
    const orders = await service.listGrowthOrders(workspaceA);

    expect(replay.order.id).toBe(created.order.id);
    expect(orders.filter((order) => order.destinationUrl === destinationUrl)).toHaveLength(1);
    expect(
      (await service.getGrowthOverview(workspaceA)).monitoring
        .duplicateSupplierSubmissionsPrevented
    ).toBeGreaterThanOrEqual(1);
  });

  it("releases reserved Growth funds when supplier submission fails", async () => {
    const service = new PlatformService();
    const walletBefore = service.getWallet(workspaceA);
    const createOrder = vi.fn(() => Promise.reject(new Error("Supplier timeout")));
    replaceSmmSupplier(service, createTestSupplier({ createOrder }));

    const result = await service.createGrowthOrder(workspaceA, {
      serviceCode: "tiktok-views",
      quantity: 100,
      destinationUrl: "https://www.tiktok.com/@fliptrybe/video/102",
      idempotencyKey: "growth-supplier-failure"
    });

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(result.order.status).toBe("FAILED");
    expect(result.order.paymentStatus).toBe("FUNDS_RELEASED");
    expect(result.order.releaseLedgerEntryId).toMatch(/^ledger_/);
    expect(service.getWallet(workspaceA).availableBalance.amountMinor).toBe(
      walletBefore.availableBalance.amountMinor
    );
    expect(service.getWallet(workspaceA).heldBalance.amountMinor).toBe(0);
    expect(service.listAuditLogs(workspaceA)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "growth.funds_released",
          entityId: result.order.id
        })
      ])
    );
    expect((await service.getGrowthOverview(workspaceA)).monitoring.failedSupplierOrders).toBe(1);
  });

  it("captures completed Growth funds and records refund reversals", async () => {
    const service = new PlatformService();
    const walletBefore = service.getWallet(workspaceA);
    const created = await service.createGrowthOrder(workspaceA, {
      serviceCode: "tiktok-views",
      quantity: 100,
      destinationUrl: "https://www.tiktok.com/@fliptrybe/video/103",
      idempotencyKey: "growth-refund"
    });

    const completed = service.updateGrowthOrder(workspaceA, created.order.id, {
      status: "COMPLETED",
      quantityDelivered: created.order.quantityOrdered
    });

    expect(completed.paymentStatus).toBe("FUNDS_CAPTURED");
    expect(completed.captureLedgerEntryId).toMatch(/^ledger_/);
    expect(service.getWallet(workspaceA).heldBalance.amountMinor).toBe(0);
    expect(service.getWallet(workspaceA).availableBalance.amountMinor).toBe(
      walletBefore.availableBalance.amountMinor - created.order.amount.amountMinor
    );
    expect(() =>
      service.updateGrowthOrder(workspaceA, created.order.id, {
        status: "FAILED",
        failureReason: "Invalid downgrade"
      })
    ).toThrow("Completed Growth orders can only transition to refunded.");

    const refunded = service.updateGrowthOrder(workspaceA, created.order.id, {
      status: "REFUNDED",
      failureReason: "Supplier rejected fulfilled order"
    });

    expect(refunded.paymentStatus).toBe("REFUNDED");
    expect(refunded.refundLedgerEntryId).toMatch(/^ledger_/);
    expect(service.getWallet(workspaceA).availableBalance.amountMinor).toBe(
      walletBefore.availableBalance.amountMinor
    );
    expect(service.listAuditLogs(workspaceA)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "growth.refund_recorded",
          entityId: created.order.id
        })
      ])
    );
  });
});
