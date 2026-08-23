import { createMockSmmSupplier } from "@fliptrybe/providers";
import { describe, expect, it } from "vitest";

import {
  applyGrowthServiceAdminControls,
  assessSmmOrderFraud,
  calculateGrowthDeliveredQuantity,
  calculateSmmMargin,
  calculateSmmPrice,
  calculateSmmRetryDelayMs,
  createSmmSupplierAudit,
  createSmmFulfillmentQueueJob,
  createSmmServiceHealthMonitor,
  defaultGrowthServicesCatalog,
  defaultSmmPricingRules,
  defaultSmmRetryPolicy,
  getGrowthServiceRiskReport,
  mapSmmOrderStatusToGrowthStatus,
  summarizeSmmSupplierHealth
} from "./index";

const timestamp = new Date("2026-05-21T12:00:00.000Z").toISOString();

describe("SMM operations", () => {
  it("calculates customer price and protected margin from supplier quotes", () => {
    const priced = calculateSmmPrice({
      quote: {
        amount: { amountMinor: 1000, currency: "NGN" },
        estimatedDeliveryMinutes: 120,
        supplierName: "gsubz"
      },
      serviceKind: "FOLLOWERS"
    });

    expect(priced.customerPrice.amountMinor).toBeGreaterThan(priced.supplierCost.amountMinor);
    expect(priced.grossMargin.amountMinor).toBeGreaterThanOrEqual(150);
    expect(priced.marginBps).toBeGreaterThan(0);
    expect(priced.supplierName).toBe("gsubz");
  });

  it("calculates raw margin for same-currency money values", () => {
    const margin = calculateSmmMargin({
      supplierCost: { amountMinor: 700, currency: "USD" },
      customerPrice: { amountMinor: 1000, currency: "USD" }
    });

    expect(margin.grossMargin.amountMinor).toBe(300);
    expect(margin.isProfitable).toBe(true);
  });

  it("flags impossible live viewer orders before fulfillment", () => {
    const fraud = assessSmmOrderFraud({
      order: {
        id: "smm_test",
        workspaceId: "workspace",
        serviceKind: "LIVE_VIEWERS",
        destination: { kind: "INSTAGRAM_PROFILE", url: "https://instagram.com/fliptrybe" },
        quantity: 250000,
        status: "QUEUED",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    expect(fraud.action).toBe("BLOCK");
    expect(fraud.signals.map((signal) => signal.code)).toContain("DESTINATION_SERVICE_MISMATCH");
  });

  it("creates queue payloads with retry and fraud metadata", () => {
    const pricedQuote = calculateSmmPrice({
      quote: {
        amount: { amountMinor: 500, currency: "NGN" },
        estimatedDeliveryMinutes: 120,
        supplierName: "gsubz"
      },
      serviceKind: "VIEWS"
    });
    const job = createSmmFulfillmentQueueJob({
      order: {
        id: "smm_job",
        workspaceId: "workspace",
        serviceKind: "VIEWS",
        destination: { kind: "TIKTOK_PROFILE", url: "https://tiktok.com/@fliptrybe" },
        quantity: 1000,
        status: "QUEUED",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      pricedQuote,
      fraudAssessment: { action: "ALLOW", riskLevel: "LOW", score: 0, signals: [] },
      enqueuedAt: timestamp
    });

    expect(job.retryPolicy.attempts).toBe(defaultSmmRetryPolicy.attempts);
    expect(job.supplierName).toBe("gsubz");
    expect(job.fraudRiskLevel).toBe("LOW");
  });

  it("uses bounded exponential retry delays", () => {
    const delay = calculateSmmRetryDelayMs(defaultSmmRetryPolicy, 3, 0.5);

    expect(delay).toBe(120000);
  });

  it("checks supplier health and summarizes the fleet", async () => {
    const monitor = createSmmServiceHealthMonitor([createMockSmmSupplier()], {
      now: () => 1,
      degradedLatencyMs: 100
    });
    const results = await monitor.checkAll();

    expect(results[0]?.status).toBe("healthy");
    expect(summarizeSmmSupplierHealth(results)).toBe("healthy");
  });

  it("exposes the original catalogue plus Nigeria-specific service families", () => {
    expect(defaultGrowthServicesCatalog.length).toBeGreaterThan(30);
    expect(defaultGrowthServicesCatalog.some((service) => service.code === "tiktok-views")).toBe(true);
    expect(defaultGrowthServicesCatalog.some((service) => service.code === "tiktok-live-viewers-ng")).toBe(true);
    expect(defaultGrowthServicesCatalog.some((service) => service.code === "instagram-live-viewers-ng")).toBe(true);
    expect(defaultGrowthServicesCatalog.some((service) => service.code === "youtube-subscribers-ng")).toBe(true);
    expect(defaultGrowthServicesCatalog.some((service) => service.code === "telegram-members-ng")).toBe(true);

    const liveNg = defaultGrowthServicesCatalog.find((service) => service.code === "tiktok-live-viewers-ng");
    expect(liveNg?.supplierRouting.preferredSupplier).toBe("gsubz");
    expect(liveNg?.supplierRouting.fallbackSuppliers).toEqual(["sizzle"]);
  });

  it("keeps the website traffic service disabled until a provider path is approved", () => {
    expect(
      defaultGrowthServicesCatalog.find((service) => service.code === "website-traffic")?.enabled
    ).toBe(false);
  });

  it("keeps the service-kind pricing rules complete", () => {
    expect(defaultSmmPricingRules.map((rule) => rule.serviceKind)).toEqual([
      "FOLLOWERS",
      "LIKES",
      "VIEWS",
      "COMMENTS",
      "SHARES",
      "LIVE_VIEWERS",
      "CHANNEL_MEMBERS"
    ]);
  });

  it("maps supplier order states into the Growth lifecycle", () => {
    expect(mapSmmOrderStatusToGrowthStatus("QUEUED")).toBe("SUBMITTED");
    expect(mapSmmOrderStatusToGrowthStatus("PROCESSING")).toBe("IN_PROGRESS");
    expect(mapSmmOrderStatusToGrowthStatus("COMPLETED")).toBe("COMPLETED");
    expect(mapSmmOrderStatusToGrowthStatus("CANCELLED")).toBe("REFUNDED");
  });

  it("calculates transparent delivered quantity from supplier remains", () => {
    expect(
      calculateGrowthDeliveredQuantity({
        quantityOrdered: 1000,
        status: "IN_PROGRESS",
        remains: 125
      })
    ).toBe(875);
    expect(
      calculateGrowthDeliveredQuantity({
        quantityOrdered: 1000,
        status: "COMPLETED"
      })
    ).toBe(1000);
  });

  it("applies admin controls to Growth services", () => {
    const service = defaultGrowthServicesCatalog.find((item) => item.code === "tiktok-views")!;
    const updated = applyGrowthServiceAdminControls(service, {
      enabled: false,
      marginBps: 9000,
      preferredSupplier: "gsubz",
      maximumQuantity: 2000
    });

    expect(updated.enabled).toBe(false);
    expect(updated.marginBps).toBe(9000);
    expect(updated.maximumQuantity).toBe(2000);
    expect(updated.supplierRouting.strategy).toBe("PREFERRED_FIRST");
    expect(updated.supplierRouting.preferredSupplier).toBe("gsubz");
  });

  it("produces supplier audit and risk report artifacts", () => {
    const audit = createSmmSupplierAudit({
      providers: [
        {
          name: "gsubz",
          mode: "gsubz-api",
          configured: true,
          supportedCategories: ["FOLLOWERS"],
          pricingModel: "per-1000-rate-card",
          routingRole: "primary",
          serviceMapCoverage: ["FOLLOWERS"]
        },
        {
          name: "sizzle",
          mode: "perfect-panel",
          configured: true,
          supportedCategories: ["FOLLOWERS"],
          pricingModel: "per-1000-rate-card",
          routingRole: "fallback",
          serviceMapCoverage: ["FOLLOWERS"]
        }
      ],
      reliability: [
        {
          supplierName: "gsubz",
          status: "healthy",
          latencyMs: 12,
          checkedAt: timestamp
        }
      ]
    });
    const risk = getGrowthServiceRiskReport(defaultGrowthServicesCatalog);

    expect(audit.supportedProviders.map((provider) => provider.name)).toEqual(["gsubz", "sizzle"]);
    expect(audit.pricingModels.length).toBeGreaterThan(0);
    expect(
      risk.find((service) => service.serviceCode === "youtube-subscribers-ng")?.risk.accountRisk
    ).toBe("HIGH");
  });
});
