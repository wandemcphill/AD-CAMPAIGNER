import { describe, expect, it } from "vitest";

import {
  createCloudinaryStorageProvider,
  createMockAdsProvider,
  createMockPaymentGateway,
  createMockSmmSupplier,
  createPerfectPanelSmmSupplier,
  createRoutedSmmSupplier
} from "./index";

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

  it("creates Cloudinary unsigned upload URLs", async () => {
    const storage = createCloudinaryStorageProvider({
      cloudName: "fliptrybe",
      uploadPreset: "campaign_assets",
      folder: "ads"
    });

    const upload = await storage.createUploadUrl({
      key: "campaign-assets/hero.png",
      contentType: "image/png"
    });

    expect(upload.uploadUrl).toContain("api.cloudinary.com/v1_1/fliptrybe/image/upload");
    expect(upload.publicUrl).toBe(
      "https://res.cloudinary.com/fliptrybe/image/upload/ads/campaign-assets/hero"
    );
  });

  it("routes SMM orders to the cheapest Perfect Panel supplier", async () => {
    const createFetcher = (rate: string) =>
      ((_url, init) => {
        const requestBody = init?.body;
        const body =
          requestBody instanceof URLSearchParams
            ? requestBody.toString()
            : typeof requestBody === "string"
              ? requestBody
              : "";

        if (body.includes("action=services")) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  service: 10,
                  name: "Instagram Followers",
                  category: "Instagram",
                  type: "Default",
                  rate,
                  min: "10",
                  max: "100000"
                }
              ])
            )
          );
        }

        return Promise.resolve(new Response(JSON.stringify({ order: 12345 })));
      }) satisfies typeof fetch;

    const router = createRoutedSmmSupplier([
      createPerfectPanelSmmSupplier({
        name: "expensive",
        apiUrl: "https://expensive.test/api/v2",
        apiKey: "key",
        fetcher: createFetcher("2.00")
      }),
      createPerfectPanelSmmSupplier({
        name: "cheap",
        apiUrl: "https://cheap.test/api/v2",
        apiKey: "key",
        fetcher: createFetcher("0.50")
      })
    ]);

    const quote = await router.quoteService({
      serviceKind: "FOLLOWERS",
      quantity: 1000,
      destination: { kind: "INSTAGRAM_PROFILE", url: "https://instagram.com/fliptrybe" }
    });
    const order = await router.createOrder({
      id: "smm_test",
      workspaceId: "workspace",
      serviceKind: "FOLLOWERS",
      destination: { kind: "INSTAGRAM_PROFILE", url: "https://instagram.com/fliptrybe" },
      quantity: 1000,
      status: "QUEUED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    expect(quote.amount.amountMinor).toBe(50);
    expect(quote.supplierName).toBe("cheap");
    expect(order.supplierReference).toBe("cheap:12345");
  });

  it("matches channel member services by subscriber synonyms", async () => {
    const supplier = createPerfectPanelSmmSupplier({
      name: "synonym-panel",
      apiUrl: "https://synonym.test/api/v2",
      apiKey: "key",
      fetcher: (() =>
        Promise.resolve(
          new Response(
            JSON.stringify([
              {
                service: 55,
                name: "YouTube Subscribers",
                category: "YouTube",
                type: "Default",
                rate: "1.00",
                min: "10",
                max: "10000"
              }
            ])
          )
        )) satisfies typeof fetch
    });

    const quote = await supplier.quoteService({
      serviceKind: "CHANNEL_MEMBERS",
      quantity: 1000,
      destination: { kind: "YOUTUBE_CHANNEL", url: "https://youtube.com/@fliptrybe" }
    });

    expect(quote.amount.amountMinor).toBe(100);
  });
});
