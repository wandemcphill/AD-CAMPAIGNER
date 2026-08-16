/* Test doubles (hand-rolled Prisma clients, vi.fn() spies) are untyped by
   design — same disable block platform.service.test.ts uses. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Unit tests for the VTU multi-provider routing engine.
// These tests exercise the scoring function and the route/routeExcluding methods
// using an in-memory Prisma mock — no database or adapters are invoked.

import { describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { VtuRouterService } from "./vtu-router.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<{
  providerName: string;
  status: string;
  maintenanceMode: boolean;
  enabledServices: string[];
  costWeight: number;
  successRateWeight: number;
  latencyWeight: number;
  balanceWeight: number;
  minBalanceMinor: number;
  maxTransactionMinor: number;
  trafficAllocationPct: number;
}> = {}) {
  return {
    providerName: "clubkonnect",
    status: "ACTIVE",
    maintenanceMode: false,
    enabledServices: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "EDUCATION"],
    costWeight: 70,
    successRateWeight: 20,
    latencyWeight: 5,
    balanceWeight: 5,
    minBalanceMinor: 0,
    maxTransactionMinor: 50000000,
    trafficAllocationPct: 100,
    ...overrides
  };
}

function makeHealth(overrides: Partial<{
  providerName: string;
  status: string;
  latencyMs: number;
  successRateBps: number;
  checkedAt: Date;
}> = {}) {
  return {
    providerName: "clubkonnect",
    status: "HEALTHY",
    latencyMs: 300,
    successRateBps: 9800,
    checkedAt: new Date(),
    ...overrides
  };
}

function makeBalance(overrides: Partial<{
  providerName: string;
  balanceMinor: number;
  status: string;
  checkedAt: Date;
}> = {}) {
  return {
    providerName: "clubkonnect",
    balanceMinor: 10_000_000,
    status: "HEALTHY",
    checkedAt: new Date(),
    ...overrides
  };
}

function makeMapping(overrides: Partial<{
  id: string;
  providerName: string;
  providerSku: string;
  canonicalSkuId: string;
  costMinor: number;
  adminApproved: boolean;
  active: boolean;
  lastSyncedAt: Date | null;
}> = {}) {
  return {
    id: "map_1",
    providerName: "clubkonnect",
    providerSku: "1000.00",
    canonicalSkuId: "sku_mtn_1gb",
    costMinor: 56300,
    adminApproved: true,
    active: true,
    lastSyncedAt: new Date(),
    ...overrides
  };
}

// ─── Mock PrismaService ──────────────────────────────────────────────────────

function buildMockPrisma(overrides: {
  configs?: object[];
  health?: object[];
  balances?: object[];
  mappings?: object[];
} = {}) {
  const configs = overrides.configs ?? [makeConfig()];
  const health = overrides.health ?? [makeHealth()];
  const balances = overrides.balances ?? [makeBalance()];
  const mappings = overrides.mappings ?? [];

  return {
    client: {
      vtuProviderConfig: {
        findMany: vi.fn().mockResolvedValue(configs)
      },
      providerHealth: {
        findMany: vi.fn().mockResolvedValue(health)
      },
      vtuProviderBalance: {
        findMany: vi.fn().mockResolvedValue(balances)
      },
      vtuProviderSkuMapping: {
        findMany: vi.fn().mockResolvedValue(mappings)
      },
      providerRoutingAttempt: {
        create: vi.fn().mockResolvedValue({})
      }
    }
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("VtuRouterService", () => {
  let router: VtuRouterService;
  let prismaService: { client: Record<string, unknown> };

  async function buildRouter(prismaOverrides: Parameters<typeof buildMockPrisma>[0] = {}) {
    prismaService = buildMockPrisma(prismaOverrides);

    const module = await Test.createTestingModule({
      providers: [
        VtuRouterService,
        { provide: PrismaService, useValue: prismaService }
      ]
    }).compile();

    router = module.get(VtuRouterService);
    return router;
  }

  describe("route()", () => {
    it("returns the only eligible provider when one config exists", async () => {
      await buildRouter({
        configs: [makeConfig({ providerName: "clubkonnect", enabledServices: ["AIRTIME"] })]
      });
      const result = await router.route({ productType: "AIRTIME", network: "MTN" });
      expect(result.winner.providerName).toBe("clubkonnect");
    });

    it("throws BadRequestException when no provider supports the product", async () => {
      await buildRouter({
        configs: [makeConfig({ providerName: "clubkonnect", enabledServices: ["DATA"] })]
      });
      await expect(
        router.route({ productType: "AIRTIME", network: "MTN" })
      ).rejects.toThrow(BadRequestException);
    });

    it("skips a provider whose health is DOWN", async () => {
      await buildRouter({
        configs: [
          makeConfig({ providerName: "clubkonnect", enabledServices: ["AIRTIME"] }),
          makeConfig({ providerName: "swiftlink", enabledServices: ["AIRTIME"] })
        ],
        health: [
          makeHealth({ providerName: "clubkonnect", status: "DOWN" }),
          makeHealth({ providerName: "swiftlink", status: "HEALTHY" })
        ],
        balances: [
          makeBalance({ providerName: "clubkonnect" }),
          makeBalance({ providerName: "swiftlink" })
        ]
      });
      const result = await router.route({ productType: "AIRTIME", network: "MTN" });
      expect(result.winner.providerName).toBe("swiftlink");
    });

    it("skips a provider in maintenance mode", async () => {
      await buildRouter({
        configs: [
          makeConfig({ providerName: "clubkonnect", maintenanceMode: true, enabledServices: ["DATA"] }),
          makeConfig({ providerName: "inlomax", maintenanceMode: false, enabledServices: ["DATA"] })
        ]
      });
      const result = await router.route({ productType: "DATA", network: "MTN" });
      expect(result.winner.providerName).toBe("inlomax");
    });

    it("skips a provider whose balance is below minBalanceMinor", async () => {
      await buildRouter({
        configs: [
          makeConfig({ providerName: "clubkonnect", minBalanceMinor: 5_000_000, enabledServices: ["AIRTIME"] }),
          makeConfig({ providerName: "swiftlink", minBalanceMinor: 0, enabledServices: ["AIRTIME"] })
        ],
        balances: [
          makeBalance({ providerName: "clubkonnect", balanceMinor: 1_000 }), // below threshold
          makeBalance({ providerName: "swiftlink", balanceMinor: 10_000_000 })
        ]
      });
      const result = await router.route({ productType: "AIRTIME", network: "MTN" });
      expect(result.winner.providerName).toBe("swiftlink");
    });

    it("selects the lower-cost provider when costs differ significantly", async () => {
      // Two ACTIVE providers; cheaper one should win on cost-dominant weights.
      const cheapMapping = makeMapping({
        id: "map_cheap",
        providerName: "inlomax",
        costMinor: 40_000
      });
      const expensiveMapping = makeMapping({
        id: "map_exp",
        providerName: "clubkonnect",
        costMinor: 80_000
      });
      await buildRouter({
        configs: [
          makeConfig({ providerName: "inlomax", enabledServices: ["DATA"], costWeight: 90, successRateWeight: 5, latencyWeight: 3, balanceWeight: 2 }),
          makeConfig({ providerName: "clubkonnect", enabledServices: ["DATA"], costWeight: 90, successRateWeight: 5, latencyWeight: 3, balanceWeight: 2 })
        ],
        mappings: [cheapMapping, expensiveMapping]
      });
      const result = await router.route({
        productType: "DATA",
        network: "MTN",
        canonicalSkuId: "sku_mtn_1gb"
      });
      expect(result.winner.providerName).toBe("inlomax");
      expect(result.winner.score).toBeGreaterThan(
        result.allCandidates.find((c) => c.providerName === "clubkonnect")!.score
      );
    });

    it("returns all candidates ranked by score (winner first)", async () => {
      await buildRouter({
        configs: [
          makeConfig({ providerName: "clubkonnect", enabledServices: ["AIRTIME"] }),
          makeConfig({ providerName: "swiftlink", enabledServices: ["AIRTIME"] })
        ],
        health: [
          makeHealth({ providerName: "clubkonnect", successRateBps: 9900, latencyMs: 200 }),
          makeHealth({ providerName: "swiftlink", successRateBps: 8000, latencyMs: 1200 })
        ],
        balances: [
          makeBalance({ providerName: "clubkonnect" }),
          makeBalance({ providerName: "swiftlink" })
        ]
      });
      const { winner, allCandidates } = await router.route({ productType: "AIRTIME", network: "MTN" });
      expect(allCandidates[0]!.providerName).toBe(winner.providerName);
      expect(allCandidates.length).toBe(2);
      // Scores are descending.
      expect(allCandidates[0]!.score).toBeGreaterThanOrEqual(allCandidates[1]!.score);
    });

    it("treats missing health as usable (defaults to mid-tier scores)", async () => {
      await buildRouter({
        configs: [makeConfig({ providerName: "clubkonnect", enabledServices: ["AIRTIME"] })],
        health: [] // no health data yet
      });
      const result = await router.route({ productType: "AIRTIME", network: "MTN" });
      expect(result.winner.providerName).toBe("clubkonnect");
    });

    it("requires adminApproved mapping when canonicalSkuId is provided", async () => {
      const unapproved = makeMapping({ adminApproved: false });
      await buildRouter({
        configs: [makeConfig({ enabledServices: ["DATA"] })],
        mappings: [unapproved]
      });
      // No approved mapping → no candidates → BadRequestException.
      await expect(
        router.route({ productType: "DATA", network: "MTN", canonicalSkuId: "sku_mtn_1gb" })
      ).rejects.toThrow(BadRequestException);
    });

    it("skips stale pricing (lastSyncedAt > 7 days ago)", async () => {
      const stale = makeMapping({
        lastSyncedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000) // 8 days old
      });
      await buildRouter({
        configs: [makeConfig({ enabledServices: ["DATA"] })],
        mappings: [stale]
      });
      await expect(
        router.route({ productType: "DATA", network: "MTN", canonicalSkuId: "sku_mtn_1gb" })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("routeExcluding()", () => {
    it("excludes the specified provider and selects the next best", async () => {
      await buildRouter({
        configs: [
          makeConfig({ providerName: "clubkonnect", enabledServices: ["AIRTIME"] }),
          makeConfig({ providerName: "swiftlink", enabledServices: ["AIRTIME"] })
        ],
        health: [
          makeHealth({ providerName: "clubkonnect" }),
          makeHealth({ providerName: "swiftlink" })
        ],
        balances: [
          makeBalance({ providerName: "clubkonnect" }),
          makeBalance({ providerName: "swiftlink" })
        ]
      });
      const fallback = await router.routeExcluding(
        { productType: "AIRTIME", network: "MTN" },
        ["clubkonnect"]
      );
      expect(fallback).not.toBeNull();
      expect(fallback!.providerName).toBe("swiftlink");
    });

    it("returns null when all providers are excluded", async () => {
      await buildRouter({
        configs: [makeConfig({ providerName: "clubkonnect", enabledServices: ["AIRTIME"] })]
      });
      const fallback = await router.routeExcluding(
        { productType: "AIRTIME", network: "MTN" },
        ["clubkonnect"]
      );
      expect(fallback).toBeNull();
    });
  });

  describe("recordAttempt()", () => {
    it("writes a ProviderRoutingAttempt row", async () => {
      await buildRouter();
      await router.recordAttempt({
        orderId: "order_abc",
        orderType: "AIRTIME",
        providerName: "clubkonnect",
        score: 85,
        status: "SELECTED"
      });
      expect(
        (prismaService.client.providerRoutingAttempt as { create: ReturnType<typeof vi.fn> }).create
      ).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "SELECTED" }) })
      );
    });
  });
});

// ─── VtuQuoteService margin tests ────────────────────────────────────────────

import { VtuQuoteService } from "./vtu-quote.service";
import { PricingRuleService } from "../providers/pricing-rule.service";

describe("VtuQuoteService", () => {
  let quoteService: VtuQuoteService;

  async function buildQuoteService(resolvedMarkupBps = 300) {
    const mockDb = {
      vtuQuote: {
        create: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({})
      },
      vtuCanonicalSku: {
        findUnique: vi.fn().mockResolvedValue({ minMarginBps: 200 })
      }
    };

    const mockPrisma = { client: mockDb };
    const mockPricingRules = {
      resolveMarkupBps: vi.fn().mockResolvedValue(resolvedMarkupBps)
    };

    const module = await Test.createTestingModule({
      providers: [
        VtuQuoteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PricingRuleService, useValue: mockPricingRules }
      ]
    }).compile();

    quoteService = module.get(VtuQuoteService);
    return { quoteService, mockDb, mockPricingRules };
  }

  it("creates a quote with correct markup applied", async () => {
    const { quoteService } = await buildQuoteService(300); // 3% markup
    const result = await quoteService.createQuote({
      productType: "DATA",
      providerName: "clubkonnect",
      providerSku: "1000.00",
      costMinor: 56300
    });
    expect(result.markupBps).toBe(300);
    expect(result.customerPriceMinor).toBe(Math.ceil(56300 * 1.03));
    expect(result.markupMinor).toBe(result.customerPriceMinor - 56300);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("throws when markup would fall below the minimum margin", async () => {
    const { quoteService } = await buildQuoteService(50); // 0.5% — below 200 bps floor
    await expect(
      quoteService.createQuote({
        productType: "DATA",
        providerName: "clubkonnect",
        providerSku: "1000.00",
        costMinor: 56300,
        canonicalSkuId: "sku_mtn_1gb"
      })
    ).rejects.toThrow(/margin protection/i);
  });

  it("consumeQuote marks quote as used and returns frozen pricing", async () => {
    const frozen = {
      id: "vquote_1",
      providerName: "clubkonnect",
      providerSku: "1000.00",
      productType: "DATA",
      costMinor: 56300,
      customerPriceMinor: 58000,
      markupMinor: 1700,
      markupBps: 302,
      currency: "NGN",
      expiresAt: new Date(Date.now() + 5 * 60_000),
      usedAt: null,
      network: "MTN",
      canonicalSkuId: null,
      orderId: null
    };

    const { quoteService, mockDb } = await buildQuoteService();
    (mockDb.vtuQuote.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(frozen);
    (mockDb.vtuQuote.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...frozen, usedAt: new Date(), orderId: "order_x" });

    const result = await quoteService.consumeQuote("vquote_1", "order_x");
    expect(result.costMinor).toBe(56300);
    expect(result.customerPriceMinor).toBe(58000);
    expect(mockDb.vtuQuote.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: "order_x" }) })
    );
  });

  it("rejects a consumed quote (usedAt already set)", async () => {
    const { quoteService, mockDb } = await buildQuoteService();
    (mockDb.vtuQuote.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "vquote_1",
      usedAt: new Date(Date.now() - 60_000), // already used
      expiresAt: new Date(Date.now() + 5 * 60_000)
    });
    await expect(quoteService.consumeQuote("vquote_1", "order_y")).rejects.toThrow(/already been used/i);
  });

  it("rejects an expired quote", async () => {
    const { quoteService, mockDb } = await buildQuoteService();
    (mockDb.vtuQuote.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "vquote_1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1_000) // expired 1 second ago
    });
    await expect(quoteService.consumeQuote("vquote_1", "order_z")).rejects.toThrow(/expired/i);
  });
});
