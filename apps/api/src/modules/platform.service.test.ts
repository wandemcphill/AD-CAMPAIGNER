import { describe, expect, it } from "vitest";

import { PlatformService } from "./platform.service";

describe("PlatformService", () => {
  it("creates campaigns through the provider boundary", async () => {
    const service = new PlatformService();
    const campaign = await service.createCampaign({
      name: "Test campaign",
      objective: "TRAFFIC",
      destinationKind: "WEBSITE",
      destinationUrl: "https://fliptrybe.com",
      budgetMinor: 100000
    });

    expect(campaign.status).toBe("QUEUED");
    expect(campaign.providerReference).toMatch(/^mock_ads_/);
    expect(service.getEvents()).toHaveLength(1);
  });

  it("tracks payment intents and wallet state", async () => {
    const service = new PlatformService();
    const intent = await service.createPaymentIntent({ amountMinor: 250000, currency: "NGN" });

    expect(intent.status).toBe("PENDING");
    expect(service.getWallet().availableBalance.amountMinor).toBeGreaterThan(0);
  });
});
