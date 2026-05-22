import { describe, expect, it } from "vitest";

import {
  createCloudinaryStorageProvider,
  createKorapayPaymentGateway,
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

  it("creates and verifies Korapay checkout intents", async () => {
    const korapay = createKorapayPaymentGateway({
      secretKey: "sk_test",
      publicKey: "pk_test",
      encryptionKey: "enc_test",
      defaultRedirectUrl: "https://app.fliptrybe.test/wallet",
      defaultWebhookUrl: "https://api.fliptrybe.test/api/webhooks/korapay",
      fetcher: ((url, init) => {
        const endpoint =
          typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (endpoint.endsWith("/charges/initialize")) {
          expect(init?.method).toBe("POST");

          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: true,
                data: {
                  reference: "ft_pay_123",
                  checkout_url: "https://checkout.korapay.com/pay/ft_pay_123"
                }
              })
            )
          );
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: true,
              data: {
                reference: "ft_pay_123",
                status: "success"
              }
            })
          )
        );
      }) satisfies typeof fetch
    });
    const intent = await korapay.createPaymentIntent({
      amount: { amountMinor: 500000, currency: "NGN" },
      workspaceId: "workspace",
      customerEmail: "customer@fliptrybe.test",
      customerName: "FlipTrybe Customer"
    });
    const verified = await korapay.verifyPayment("ft_pay_123");

    expect(intent.gateway).toBe("KORAPAY");
    expect(intent.checkoutUrl).toContain("checkout.korapay.com");
    expect(verified.status).toBe("COMPLETED");
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

  it("supports Perfect Panel balance, status, refill, and cancel actions", async () => {
    const supplier = createPerfectPanelSmmSupplier({
      name: "ops-panel",
      apiUrl: "https://ops.test/api/v2",
      apiKey: "key",
      fetcher: ((_url, init) => {
        const requestBody = init?.body;
        const body =
          requestBody instanceof URLSearchParams
            ? requestBody.toString()
            : typeof requestBody === "string"
              ? requestBody
              : "";

        if (body.includes("action=balance")) {
          return Promise.resolve(
            new Response(JSON.stringify({ balance: "100.84", currency: "USD" }))
          );
        }
        if (body.includes("action=status") && body.includes("orders=")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                "12345": {
                  charge: "0.28",
                  start_count: "3572",
                  status: "Partial",
                  remains: "157",
                  currency: "USD"
                }
              })
            )
          );
        }
        if (body.includes("action=status")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                charge: "0.28",
                start_count: "3572",
                status: "In progress",
                remains: "157",
                currency: "USD"
              })
            )
          );
        }
        if (body.includes("action=refill")) {
          return Promise.resolve(new Response(JSON.stringify({ refill: 222 })));
        }
        if (body.includes("action=cancel")) {
          return Promise.resolve(new Response(JSON.stringify([{ order: 12345, cancel: 1 }])));
        }

        return Promise.resolve(new Response(JSON.stringify([])));
      }) satisfies typeof fetch
    });

    const balance = await supplier.getBalance();
    const status = await supplier.getOrderStatus("ops-panel:12345");
    const statuses = await supplier.getOrderStatuses(["ops-panel:12345"]);
    const refill = await supplier.requestRefill("ops-panel:12345");
    const cancel = await supplier.requestCancel(["ops-panel:12345"]);

    expect(balance.amount.amountMinor).toBe(10084);
    expect(status.status).toBe("PROCESSING");
    expect(statuses[0]?.status).toBe("PARTIAL");
    expect(refill.refillReference).toBe("222");
    expect(cancel[0]?.accepted).toBe(true);
  });

  it("supports SMM Raja single-order status and cancel conventions", async () => {
    const seenBodies: string[] = [];
    const supplier = createPerfectPanelSmmSupplier({
      name: "smmraja",
      apiUrl: "https://smmraja.test/api/v3",
      apiKey: "key",
      bulkStatusParam: "order",
      cancelMode: "single-order",
      fetcher: ((_url, init) => {
        const requestBody = init?.body;
        const body =
          requestBody instanceof URLSearchParams
            ? requestBody.toString()
            : typeof requestBody === "string"
              ? requestBody
              : "";
        seenBodies.push(body);

        if (body.includes("action=status")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                charge: "0.27819",
                start_count: "3572",
                status: "Partial",
                remains: "157",
                currency: "USD"
              })
            )
          );
        }
        if (body.includes("action=refill")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: "Your order will be refill asap. Thank you for patience." })
            )
          );
        }
        if (body.includes("action=cancel")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: "Your order will be cancel asap. Thank you for patience." })
            )
          );
        }

        return Promise.resolve(new Response(JSON.stringify([])));
      }) satisfies typeof fetch
    });

    const statuses = await supplier.getOrderStatuses(["smmraja:1000000"]);
    const refill = await supplier.requestRefill("smmraja:1000000");
    const cancel = await supplier.requestCancel(["smmraja:1000000"]);

    expect(statuses[0]?.status).toBe("PARTIAL");
    expect(refill.accepted).toBe(true);
    expect(cancel[0]?.accepted).toBe(true);
    expect(seenBodies.some((body) => body.includes("order=1000000"))).toBe(true);
    expect(seenBodies.every((body) => !body.includes("orders="))).toBe(true);
  });
});
