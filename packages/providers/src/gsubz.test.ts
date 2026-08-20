import type { SmmOrder } from "@fliptrybe/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGsubzAdapter, createGsubzSocialSupplier, resetGsubzCaches } from "./gsubz";

function jsonResponse(payload: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  );
}

function routeFrom(input: RequestInfo | URL) {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(href);
  return `${url.pathname}${url.search}`;
}

beforeEach(() => {
  resetGsubzCaches();
});

describe("createGsubzAdapter", () => {
  it("parses GSUBZ data categories and plans into VTU catalog offers", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      switch (routeFrom(input)) {
        case "/api/sub-category?category=data":
          return jsonResponse([
            { displayName: "MTN SME", name: "mtn_sme" },
            { displayName: "GLO Data", name: "glo_data" },
            { displayName: "Airtime", name: "mtn" }
          ]);
        case "/api/plans?service=mtn_sme":
          return jsonResponse({
            discount: "2%",
            plans: [{ displayName: "1GB for 30 days", value: "mtn1", price: 270 }]
          });
        case "/api/plans?service=glo_data":
          return jsonResponse({
            plans: [{ display_name: "500MB for 14 days", value: "glo500", price: "150" }]
          });
        default:
          return jsonResponse({ plans: [] });
      }
    }) as unknown as typeof fetch;

    const plans = await createGsubzAdapter({ apiKey: "token", fetcher }).listDataPlans();

    expect(plans).toEqual([
      {
        providerPlanId: "mtn_sme:mtn1",
        network: "MTN",
        planType: "SME",
        displayName: "MTN SME 1GB for 30 days",
        sizeMb: 1024,
        validityDays: 30,
        costMinor: 27_000,
        currency: "NGN"
      },
      {
        providerPlanId: "glo_data:glo500",
        network: "GLO",
        planType: "SME",
        displayName: "GLO Data 500MB for 14 days",
        sizeMb: 500,
        validityDays: 14,
        costMinor: 15_000,
        currency: "NGN"
      }
    ]);
  });

  it("submits data purchases with the GSUBZ service and plan identifiers", async () => {
    const payBodies: string[] = [];
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      switch (routeFrom(input)) {
        case "/api/sub-category?category=data":
          return jsonResponse([{ displayName: "MTN SME", name: "mtn_sme" }]);
        case "/api/plans?service=mtn_sme":
          return jsonResponse({
            plans: [{ displayName: "1GB for 30 days", value: "mtn1", price: 270 }]
          });
        case "/api/pay":
          payBodies.push(init?.body instanceof URLSearchParams ? init.body.toString() : "");
          return jsonResponse({ content: { status: "processing" } });
        default:
          return jsonResponse({});
      }
    }) as unknown as typeof fetch;

    const result = await createGsubzAdapter({ apiKey: "token", fetcher }).purchaseData({
      network: "MTN",
      msisdn: "08030000000",
      providerPlanId: "mtn_sme:mtn1",
      reference: "GSZORDER1"
    });

    expect(result).toEqual({ providerReference: "GSZORDER1", status: "SUBMITTED" });
    expect(payBodies).toEqual([
      "api=token&serviceID=mtn_sme&plan=mtn1&amount=270.00&phone=08030000000&requestID=GSZORDER1"
    ]);
  });
});

describe("createGsubzSocialSupplier", () => {
  it("quotes GSUBZ social plans by platform, kind, and quantity", async () => {
    const supplier = createGsubzSocialSupplier({
      fetcher: gsubzSocialFetcher()
    });

    const quote = await supplier.quoteService({
      serviceKind: "FOLLOWERS",
      quantity: 1500,
      destination: { kind: "INSTAGRAM_PROFILE", url: "https://instagram.com/fliptrybe" }
    });

    expect(quote).toEqual({
      amount: { amountMinor: 375_000, currency: "NGN" },
      estimatedDeliveryMinutes: 120,
      supplierName: "gsubz"
    });
  });

  it("creates social orders through GSUBZ pay/verify identifiers", async () => {
    const payBodies: string[] = [];
    const supplier = createGsubzSocialSupplier({
      apiKey: "token",
      fetcher: gsubzSocialFetcher(payBodies)
    });

    const result = await supplier.createOrder({
      id: "order_123",
      workspaceId: "ws_123",
      serviceKind: "FOLLOWERS",
      destination: { kind: "INSTAGRAM_PROFILE", url: "https://instagram.com/fliptrybe" },
      quantity: 1500,
      status: "QUEUED",
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z"
    } satisfies SmmOrder);

    expect(result).toEqual({ supplierReference: "gsubz:GSMSORDER123", status: "PROCESSING" });
    expect(payBodies).toEqual([
      "api=token&serviceID=socials&plan=ig-followers&amount=3750.00&customerID=https%3A%2F%2Finstagram.com%2Ffliptrybe&link=https%3A%2F%2Finstagram.com%2Ffliptrybe&quantity=1500&phone=00000000000&requestID=GSMSORDER123"
    ]);
  });
});

function gsubzSocialFetcher(payBodies: string[] = []) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    switch (routeFrom(input)) {
      case "/api/sub-category?category=mobile_vtu":
        return jsonResponse([{ displayName: "Socials", name: "socials" }]);
      case "/api/plans?service=socials":
        return jsonResponse({
          list: [
            {
              display_name: "Instagram Followers Fast",
              value: "ig-followers",
              price: 2500,
              min: 100,
              max: 10000,
              category: "Instagram",
              description: "Refill: No"
            },
            {
              display_name: "YouTube Views",
              value: "yt-views",
              price: 1000,
              min: 100,
              max: 50000,
              category: "YouTube"
            }
          ]
        });
      case "/api/pay":
        payBodies.push(init?.body instanceof URLSearchParams ? init.body.toString() : "");
        return jsonResponse({ content: { status: "processing" } });
      case "/api/verify":
        return jsonResponse({ content: { status: "completed" } });
      default:
        return jsonResponse({});
    }
  };
}
