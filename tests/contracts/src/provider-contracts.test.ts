import { describe, expect, it } from "vitest";

import {
  createMockAdsProvider,
  createMockAiProvider,
  createMockNotificationProvider,
  createMockPaymentGateway,
  createMockSmmSupplier,
  createMockStorageProvider
} from "@fliptrybe/providers";

describe("provider adapter contracts", () => {
  it("keeps mock providers replaceable by live providers", async () => {
    const ads = createMockAdsProvider();
    const payments = createMockPaymentGateway();
    const smm = createMockSmmSupplier();
    const ai = createMockAiProvider();
    const notifications = createMockNotificationProvider();
    const storage = createMockStorageProvider();

    await expect(
      ads.quoteCampaign({
        objective: "TRAFFIC",
        budgetMinor: 100000,
        currency: "NGN",
        destinationKind: "WEBSITE"
      })
    ).resolves.toHaveProperty("estimatedReach");
    await expect(
      payments.createPaymentIntent({
        amount: { amountMinor: 100000, currency: "NGN" },
        workspaceId: "workspace"
      })
    ).resolves.toHaveProperty("providerReference");
    await expect(
      smm.quoteService({
        serviceKind: "VIEWS",
        quantity: 1000,
        destination: { kind: "YOUTUBE_CHANNEL", url: "https://youtube.com/@fliptrybe" }
      })
    ).resolves.toHaveProperty("estimatedDeliveryMinutes");
    await expect(
      ai.generateCampaignCopy({
        objective: "ENGAGEMENT",
        destinationKind: "INSTAGRAM_REEL",
        audience: "creators"
      })
    ).resolves.toHaveProperty("hashtags");
    await expect(
      notifications.send({
        channel: "IN_APP",
        to: "user",
        title: "Ready",
        body: "Provider contract ok"
      })
    ).resolves.toHaveProperty("accepted", true);
    await expect(
      storage.createUploadUrl({ key: "asset.png", contentType: "image/png" })
    ).resolves.toHaveProperty("publicUrl");
  });
});
