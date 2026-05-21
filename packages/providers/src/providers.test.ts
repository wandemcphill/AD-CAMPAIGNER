import { describe, expect, it } from "vitest";

import { createMockAdsProvider, createMockPaymentGateway, createMockSmmSupplier } from "./index";

describe("provider contracts", () => {
  it("quotes campaigns through the ads adapter", async () => {
    const quote = await createMockAdsProvider().quoteCampaign({
      objective: "ENGAGEMENT",
      budgetMinor: 100000,
      currency: "NGN",
      destinationKind: "TIKTOK_LIVE"
    });

    expect(quote.estimatedReach.max).toBeGreaterThan(quote.estimatedReach.min);
  });

  it("creates payment intents through the payment adapter", async () => {
    const intent = await createMockPaymentGateway().createPaymentIntent({
      amount: { amountMinor: 50000, currency: "NGN" },
      workspaceId: "workspace"
    });

    expect(intent.gateway).toBe("MOCK");
  });

  it("quotes SMM fulfillment through supplier adapters", async () => {
    const quote = await createMockSmmSupplier().quoteService({
      serviceKind: "FOLLOWERS",
      quantity: 1000,
      destination: { kind: "INSTAGRAM_PROFILE", url: "https://instagram.com/fliptrybe" }
    });

    expect(quote.amount.amountMinor).toBe(25000);
  });
});
