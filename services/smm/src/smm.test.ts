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
        supplierName: "smdpanel"
      },
      serviceKind: "FOLLOWERS"
    });

    expect(priced.customerPrice.amountMinor).toBeGreaterThan(priced.supplierCost.amountMinor);
    expect(priced.grossMargin.amountMinor).toBeGreaterThanOrEqual(150);
    expect(priced.marginBps).toBeGreaterThan(0);
    expect(priced.supplierName).toBe("smdpanel");
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
        supplierName: "justanotherpanel"
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
    expect(job.supplierName).toBe("justanotherpanel");
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

  it("defines a Growth Services catalog with customer-facing service families", () => {
    expect(defaultGrowthServicesCatalog.map((service) => service.code)).toEqual([
      "tiktok-views",
      "tiktok-likes",
      "tiktok-followers",
      "instagram-followers",
      "instagram-likes",
      "youtube-views",
      "youtube-subscribers",
      "telegram-members",
      "website-traffic"
    ]);
    expect(
      defaultGrowthServicesCatalog.find((service) => service.code === "website-traffic")?.enabled
    ).toBe(false);
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
    const service = defaultGrowthServicesCatalog[0]!;
    const updated = applyGrowthServiceAdminControls(service, {
      enabled: false,
      marginBps: 9000,
      preferredSupplier: "smdpanel",
      maximumQuantity: 2000
    });

    expect(updated.enabled).toBe(false);
    expect(updated.marginBps).toBe(9000);
    expect(updated.maximumQuantity).toBe(2000);
    expect(updated.supplierRouting.strategy).toBe("PREFERRED_FIRST");
    expect(updated.supplierRouting.preferredSupplier).toBe("smdpanel");
  });

  it("produces supplier audit and risk report artifacts", () => {
    const audit = createSmmSupplierAudit({
      providers: [
        {
          name: "mock-smm",
          mode: "mock",
          configured: true,
          supportedCategories: ["FOLLOWERS"],
          pricingModel: "per-1000-rate-card",
          routingRole: "primary",
          serviceMapCoverage: []
        }
      ],
      reliability: [
        {
          supplierName: "mock-smm",
          status: "healthy",
          latencyMs: 12,
          checkedAt: timestamp
        }
      ]
    });
    const risk = getGrowthServiceRiskReport(defaultGrowthServicesCatalog);

    expect(audit.supportedProviders[0]?.name).toBe("mock-smm");
    expect(audit.pricingModels.length).toBeGreaterThan(0);
    expect(
      risk.find((service) => service.serviceCode === "youtube-subscribers")?.risk.accountRisk
    ).toBe("HIGH");
  });
});
