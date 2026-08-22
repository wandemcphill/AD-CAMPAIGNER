/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { describe, expect, it, vi } from "vitest";

import type { SmmSupplierAdapter } from "@fliptrybe/providers";
import { toCanonicalEvent } from "./ai-brain.client";
import { PlatformService } from "./platform.service";
import { PrismaService } from "./prisma.service";
import type { NotificationsService } from "./notifications/notifications.service";
import type { AuthenticatedRequestContext } from "./request-context";

const workspaceA: AuthenticatedRequestContext = {
  workspaceId: "workspace_a",
  userId: "user_a"
};
const workspaceB: AuthenticatedRequestContext = {
  workspaceId: "workspace_b",
  userId: "user_b"
};

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

// Minimal in-memory stand-in for the Prisma client, covering only the models and
// operations PlatformService actually touches (wallet/ledger/growth order lifecycle).
function matchesWhere(row: Record<string, any>, where: Record<string, any> | undefined) {
  return Object.entries(where ?? {}).every(([key, condition]) => {
    if (condition === null) {
      return row[key] === null || row[key] === undefined;
    }
    if (condition && typeof condition === "object") {
      if ("not" in condition) return row[key] !== condition.not;
      if ("in" in condition) return condition.in.includes(row[key]);
      if ("notIn" in condition) return !condition.notIn.includes(row[key]);
      if ("equals" in condition) {
        return String(row[key]).toLowerCase() === String(condition.equals).toLowerCase();
      }
      return true;
    }
    return row[key] === condition;
  });
}

function createFakeDb() {
  const wallets: Record<string, any>[] = [];
  const ledgerEntries: Record<string, any>[] = [];
  const growthOrders: Record<string, any>[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  const db: Record<string, any> = {
    wallet: {
      upsert: async ({ where, create }: any) => {
        const key = where.workspaceId_currency;
        let row = wallets.find(
          (item) => item.workspaceId === key.workspaceId && item.currency === key.currency
        );
        if (!row) {
          row = {
            id: nextId("wallet"),
            workspaceId: create.workspaceId,
            currency: create.currency,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          wallets.push(row);
        }
        return row;
      }
    },
    ledgerEntry: {
      upsert: async ({ where, create }: any) => {
        if (where.idempotencyKey) {
          const existing = ledgerEntries.find(
            (item) => item.idempotencyKey === where.idempotencyKey
          );
          if (existing) return existing;
        }
        const row = { id: nextId("ledger"), createdAt: new Date(), updatedAt: new Date(), ...create };
        ledgerEntries.push(row);
        return row;
      },
      create: async ({ data }: any) => {
        const row = { id: nextId("ledger"), createdAt: new Date(), updatedAt: new Date(), ...data };
        ledgerEntries.push(row);
        return row;
      },
      findMany: async ({ where }: any) => ledgerEntries.filter((row) => matchesWhere(row, where))
    },
    growthOrder: {
      create: async ({ data }: any) => {
        const row = {
          quantityDelivered: 0,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data
        };
        growthOrders.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = growthOrders.find((item) => item.id === where.id);
        if (!row) {
          throw new Error(`Fake growthOrder.update: no row with id ${where.id}`);
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      findUnique: async ({ where }: any) => {
        if (where.idempotencyKey) {
          return growthOrders.find((item) => item.idempotencyKey === where.idempotencyKey) ?? null;
        }
        return growthOrders.find((item) => item.id === where.id) ?? null;
      },
      findFirst: async ({ where }: any) => growthOrders.find((row) => matchesWhere(row, where)) ?? null,
      findMany: async ({ where }: any) => growthOrders.filter((row) => matchesWhere(row, where))
    },
    growthServiceOverride: {
      findMany: async () => []
    },
    $transaction: async (fn: (tx: Record<string, any>) => Promise<any>) => fn(db)
  };

  return db;
}

async function fundWallet(
  db: Record<string, any>,
  workspaceId: string,
  amountMinor: number,
  currency = "NGN"
) {
  const wallet = await db.wallet.upsert({
    where: { workspaceId_currency: { workspaceId, currency } },
    update: {},
    create: { workspaceId, currency }
  });
  await db.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      kind: "CREDIT",
      amountMinor,
      currency,
      reference: "test_funding",
      description: "Test wallet funding",
      sourceType: "Test",
      sourceId: "seed"
    }
  });

  return wallet;
}

function createTestService(db: Record<string, any> = createFakeDb()) {
  const prisma = new PrismaService(db as any);
  const notifications = { send: vi.fn(() => Promise.resolve([])) } as unknown as NotificationsService;
  return { service: new PlatformService(prisma, notifications), db };
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
      const { service } = createTestService();

      expect(service.getHealth().providers).toEqual(
        expect.objectContaining({
          ads: "managed-ads",
          ai: "anthropic",
          payments: "not-configured",
          storage: "not-configured",
          // F-05: production with no live Termii credentials must report
          // "not-configured", never claim a mock provider is healthy delivery.
          notifications: "not-configured"
        })
      );
      expect(service.getAdminOverview().queueHealth.notifications).toBe("not-configured");
      expect(service.listCampaigns(workspaceA)).toEqual([]);
      expect(service.listLivePromotions(workspaceA)).toEqual([]);
      expect(service.listNotifications(workspaceA)).toEqual([]);
      expect(service.listAuditLogs(workspaceA)).toEqual([]);
      expect(await service.search()).toEqual({ query: "", results: [] });
      expect(service.getHealth().providers.smm).toBe("smm-router:none");
      await expect(service.getSmmSupplierBalance()).rejects.toThrow(
        "No SMM supplier could return a balance."
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

  it("reports the notification provider as mock outside production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousNotificationProvider = process.env.NOTIFICATION_PROVIDER;
    delete process.env.NODE_ENV;
    delete process.env.NOTIFICATION_PROVIDER;

    try {
      const { service } = createTestService();

      expect(service.getHealth().providers.notifications).toBe("mock");
      expect(service.getAdminOverview().queueHealth.notifications).toBe("healthy");
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousNotificationProvider === undefined) delete process.env.NOTIFICATION_PROVIDER;
      else process.env.NOTIFICATION_PROVIDER = previousNotificationProvider;
    }
  });

  it("reports the notification provider as termii in production once live credentials are configured", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllowMockProviders = process.env.ALLOW_MOCK_PROVIDERS;
    const previousNotificationProvider = process.env.NOTIFICATION_PROVIDER;
    const previousTermiiApiKey = process.env.TERMII_API_KEY;

    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_MOCK_PROVIDERS;
    process.env.NOTIFICATION_PROVIDER = "live";
    process.env.TERMII_API_KEY = "test-key";

    try {
      const { service } = createTestService();

      expect(service.getHealth().providers.notifications).toBe("termii");
      expect(service.getAdminOverview().queueHealth.notifications).toBe("healthy");
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousAllowMockProviders === undefined) delete process.env.ALLOW_MOCK_PROVIDERS;
      else process.env.ALLOW_MOCK_PROVIDERS = previousAllowMockProviders;
      if (previousNotificationProvider === undefined) delete process.env.NOTIFICATION_PROVIDER;
      else process.env.NOTIFICATION_PROVIDER = previousNotificationProvider;
      if (previousTermiiApiKey === undefined) delete process.env.TERMII_API_KEY;
      else process.env.TERMII_API_KEY = previousTermiiApiKey;
    }
  });

  it('reports "not-configured", never "termii", when NOTIFICATION_PROVIDER=termii in production with mocks disabled', () => {
    // "termii" is not a valid live sentinel — see notifications-processor.ts.
    // Health must reflect that: a legacy/typo'd value must never read as a
    // configured, healthy provider.
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllowMockProviders = process.env.ALLOW_MOCK_PROVIDERS;
    const previousNotificationProvider = process.env.NOTIFICATION_PROVIDER;
    const previousTermiiApiKey = process.env.TERMII_API_KEY;

    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_MOCK_PROVIDERS;
    process.env.NOTIFICATION_PROVIDER = "termii";
    process.env.TERMII_API_KEY = "test-key";

    try {
      const { service } = createTestService();

      expect(service.getHealth().providers.notifications).toBe("not-configured");
      expect(service.getAdminOverview().queueHealth.notifications).toBe("not-configured");
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousAllowMockProviders === undefined) delete process.env.ALLOW_MOCK_PROVIDERS;
      else process.env.ALLOW_MOCK_PROVIDERS = previousAllowMockProviders;
      if (previousNotificationProvider === undefined) delete process.env.NOTIFICATION_PROVIDER;
      else process.env.NOTIFICATION_PROVIDER = previousNotificationProvider;
      if (previousTermiiApiKey === undefined) delete process.env.TERMII_API_KEY;
      else process.env.TERMII_API_KEY = previousTermiiApiKey;
    }
  });

  it("creates campaigns through the provider boundary", async () => {
    const { service } = createTestService();
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

  it("tracks wallet state after funding", async () => {
    const { service, db } = createTestService();
    await fundWallet(db, workspaceA.workspaceId, 250000);

    const wallet = await service.getWallet(workspaceA);
    expect(wallet.workspaceId).toBe(workspaceA.workspaceId);
    expect(wallet.availableBalance.amountMinor).toBeGreaterThan(0);
  });

  it("returns local ads insight fallback when AI Brain is disabled", async () => {
    const { service } = createTestService();
    const insights = await service.getAiAdsInsights(workspaceA);

    expect(insights.summary.mode).toBe("local_fallback");
    expect(insights.summary.account_id).toBe(workspaceA.workspaceId);
    expect(insights.items[0]?.reasons).toContain("local_campaign_snapshot");
  });

  it("keeps campaigns and support tickets scoped to the active workspace", async () => {
    const { service } = createTestService();
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

  it("scopes workspace read models to the active workspace", async () => {
    const { service } = createTestService();

    const wallet = await service.getWallet(workspaceA);
    expect(wallet.workspaceId).toBe(workspaceA.workspaceId);
    expect((await service.getAnalyticsOverview(workspaceA)).metrics).toEqual(
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

  it("rejects protected platform reads without workspace context", async () => {
    const { service } = createTestService();

    expect(() => service.listCampaigns()).toThrow("Authenticated workspace context is required.");
    await expect(service.getWallet()).rejects.toThrow("Authenticated workspace context is required.");
  });

  it("blocks Growth supplier execution when funds cannot be reserved", async () => {
    const { service } = createTestService();
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
    const walletBefore = await service.getWallet(workspaceA);

    await expect(
      service.createGrowthOrder(workspaceA, {
        serviceCode: "tiktok-views",
        quantity: 100,
        destinationUrl: "https://www.tiktok.com/@fliptrybe/video/100",
        idempotencyKey: "growth-unfunded"
      })
    ).rejects.toThrow("Growth order requires a paid invoice or enough wallet balance");

    expect(createOrder).not.toHaveBeenCalled();
    const walletAfter = await service.getWallet(workspaceA);
    expect(walletAfter.availableBalance.amountMinor).toBe(walletBefore.availableBalance.amountMinor);
    expect(await service.listGrowthOrders(workspaceA)).toHaveLength(0);
    expect((await service.getGrowthOverview(workspaceA)).monitoring.unpaidExecutionAttempts).toBe(1);
  });

  it("reserves Growth funds and prevents duplicate active supplier submissions", async () => {
    const { service, db } = createTestService();
    await fundWallet(db, workspaceA.workspaceId, 10000000);
    replaceSmmSupplier(service, createTestSupplier());
    const walletBefore = await service.getWallet(workspaceA);
    const destinationUrl = "https://www.tiktok.com/@fliptrybe/video/101";

    const created = await service.createGrowthOrder(workspaceA, {
      serviceCode: "tiktok-views",
      quantity: 100,
      destinationUrl,
      idempotencyKey: "growth-duplicate-guard"
    });

    expect(created.order.paymentStatus).toBe("FUNDS_RESERVED");
    expect(created.order.reservationLedgerEntryId).toMatch(/^ledger_/);
    const walletAfterReserve = await service.getWallet(workspaceA);
    expect(walletAfterReserve.availableBalance.amountMinor).toBe(
      walletBefore.availableBalance.amountMinor - created.order.amount.amountMinor
    );
    expect(walletAfterReserve.heldBalance.amountMinor).toBe(created.order.amount.amountMinor);

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
    const { service, db } = createTestService();
    await fundWallet(db, workspaceA.workspaceId, 10000000);
    const walletBefore = await service.getWallet(workspaceA);
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
    const walletAfter = await service.getWallet(workspaceA);
    expect(walletAfter.availableBalance.amountMinor).toBe(walletBefore.availableBalance.amountMinor);
    expect(walletAfter.heldBalance.amountMinor).toBe(0);
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
    const { service, db } = createTestService();
    await fundWallet(db, workspaceA.workspaceId, 10000000);
    replaceSmmSupplier(service, createTestSupplier());
    const walletBefore = await service.getWallet(workspaceA);
    const created = await service.createGrowthOrder(workspaceA, {
      serviceCode: "tiktok-views",
      quantity: 100,
      destinationUrl: "https://www.tiktok.com/@fliptrybe/video/103",
      idempotencyKey: "growth-refund"
    });

    const completed = await service.updateGrowthOrder(workspaceA, created.order.id, {
      status: "COMPLETED",
      quantityDelivered: created.order.quantityOrdered
    });

    expect(completed.paymentStatus).toBe("FUNDS_CAPTURED");
    expect(completed.captureLedgerEntryId).toMatch(/^ledger_/);
    const walletAfterCapture = await service.getWallet(workspaceA);
    expect(walletAfterCapture.heldBalance.amountMinor).toBe(0);
    expect(walletAfterCapture.availableBalance.amountMinor).toBe(
      walletBefore.availableBalance.amountMinor - created.order.amount.amountMinor
    );
    await expect(
      service.updateGrowthOrder(workspaceA, created.order.id, {
        status: "FAILED",
        failureReason: "Invalid downgrade"
      })
    ).rejects.toThrow("Completed Growth orders can only transition to refunded.");

    const refunded = await service.updateGrowthOrder(workspaceA, created.order.id, {
      status: "REFUNDED",
      failureReason: "Supplier rejected fulfilled order"
    });

    expect(refunded.paymentStatus).toBe("REFUNDED");
    expect(refunded.refundLedgerEntryId).toMatch(/^ledger_/);
    const walletAfterRefund = await service.getWallet(workspaceA);
    expect(walletAfterRefund.availableBalance.amountMinor).toBe(
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
