import { createMockSmmSupplier } from "@fliptrybe/providers";
import { describe, expect, it } from "vitest";

import {
  assessSmmOrderFraud,
  calculateSmmMargin,
  calculateSmmPrice,
  calculateSmmRetryDelayMs,
  createSmmFulfillmentQueueJob,
  createSmmServiceHealthMonitor,
  defaultSmmRetryPolicy,
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
});
