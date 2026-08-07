import { describe, expect, it, vi } from "vitest";

import { createClubKonnectTelecomAdapter, createMockTelecomAdapter, createReloadlyTelecomAdapter } from "./telecom.js";
import type { VtuProviderAdapter } from "./vtu.js";

function fakeVtuAdapter(overrides: Partial<VtuProviderAdapter> = {}): VtuProviderAdapter {
  return {
    name: "clubkonnect",
    interfaceVersion: "1.0",
    domain: "VTU",
    getCapabilities: () => ({
      domain: "VTU",
      countries: ["NG"],
      productTypes: ["AIRTIME", "DATA"],
      reliability: { idempotency: "weak", ordering: "none", webhookSignature: "none" }
    }),
    checkHealth: () => Promise.resolve({ providerName: "clubkonnect", status: "HEALTHY", latencyMs: 10 }),
    buildReference: (order) => `CK${order.id}`,
    listDataPlans: () =>
      Promise.resolve([
        {
          providerPlanId: "1000",
          network: "MTN",
          planType: "SME",
          displayName: "MTN 1GB",
          sizeMb: 1024,
          validityDays: 30,
          costMinor: 41000,
          currency: "NGN"
        }
      ]),
    getAirtimeDiscountBps: () => Promise.resolve(300),
    purchaseAirtime: (input) => Promise.resolve({ providerReference: input.reference, status: "DELIVERED" }),
    purchaseData: (input) => Promise.resolve({ providerReference: input.reference, status: "DELIVERED" }),
    getOrderStatus: (reference) => Promise.resolve({ providerReference: reference, status: "DELIVERED" }),
    getBalance: () => Promise.resolve({ providerName: "clubkonnect", balanceMinor: 1_000_000, currency: "NGN" }),
    ...overrides
  };
}

describe("createClubKonnectTelecomAdapter", () => {
  it("only returns operators for Nigeria", async () => {
    const adapter = createClubKonnectTelecomAdapter(
      { userId: "u", apiKey: "k" },
      fakeVtuAdapter()
    );
    const ngOperators = await adapter.getOperators("NG");
    expect(ngOperators).toHaveLength(4);
    expect(ngOperators.map((o) => o.operatorId)).toContain("clubkonnect:MTN");

    const ghOperators = await adapter.getOperators("GH");
    expect(ghOperators).toHaveLength(0);
  });

  it("translates operatorId back to VtuNetwork for purchases", async () => {
    const purchaseAirtime = vi.fn().mockResolvedValue({ providerReference: "ref1", status: "DELIVERED" });
    const adapter = createClubKonnectTelecomAdapter(
      { userId: "u", apiKey: "k" },
      fakeVtuAdapter({ purchaseAirtime })
    );

    const result = await adapter.purchaseAirtime({
      operatorId: "clubkonnect:MTN",
      msisdn: "+2348012345678",
      amountMinor: 50000,
      reference: "ref1"
    });

    expect(purchaseAirtime).toHaveBeenCalledWith({
      network: "MTN",
      msisdn: "+2348012345678",
      faceValueMinor: 50000,
      reference: "ref1"
    });
    expect(result.status).toBe("DELIVERED");
  });

  it("maps data plans into unified bundle DTOs", async () => {
    const adapter = createClubKonnectTelecomAdapter({ userId: "u", apiKey: "k" }, fakeVtuAdapter());
    const bundles = await adapter.getDataBundles("clubkonnect:MTN");
    expect(bundles).toEqual([
      {
        operatorId: "clubkonnect:MTN",
        bundleId: "1000",
        displayName: "MTN 1GB",
        sizeMb: 1024,
        validityDays: 30,
        costMinor: 41000,
        currency: "NGN"
      }
    ]);
  });
});

describe("createReloadlyTelecomAdapter", () => {
  function fetcherReturning(responses: Record<string, unknown>) {
    return vi.fn((url: string) => {
      if (url.includes("auth.reloadly.com")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      for (const [pattern, body] of Object.entries(responses)) {
        if (url.includes(pattern)) return new Response(JSON.stringify(body), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;
  }

  it("fetches an OAuth token once and reuses it across calls", async () => {
    const fetcher = fetcherReturning({ "/accounts/balance": { balance: 100, currencyCode: "USD" } });
    const adapter = createReloadlyTelecomAdapter({
      clientId: "id",
      clientSecret: "secret",
      fetcher
    });

    await adapter.getBalance();
    await adapter.getBalance();

    const authCalls = (fetcher as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).includes("auth.reloadly.com")
    );
    expect(authCalls).toHaveLength(1);
  });

  it("maps a successful topup response to DELIVERED", async () => {
    const fetcher = fetcherReturning({ "/topups": { transactionId: 555, status: "SUCCESSFUL" } });
    const adapter = createReloadlyTelecomAdapter({ clientId: "id", clientSecret: "secret", fetcher });

    const result = await adapter.purchaseAirtime({
      operatorId: "reloadly:341",
      msisdn: "+233241234567",
      amountMinor: 1000,
      reference: "ref-1"
    });

    expect(result).toEqual({ providerReference: "555", status: "DELIVERED" });
  });

  it("returns FAILED when the topup response has no transactionId", async () => {
    const fetcher = fetcherReturning({ "/topups": { message: "Insufficient balance" } });
    const adapter = createReloadlyTelecomAdapter({ clientId: "id", clientSecret: "secret", fetcher });

    const result = await adapter.purchaseAirtime({
      operatorId: "reloadly:341",
      msisdn: "+233241234567",
      amountMinor: 1000,
      reference: "ref-2"
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toBe("Insufficient balance");
  });
});

describe("createMockTelecomAdapter", () => {
  it("always reports healthy and delivers purchases", async () => {
    const adapter = createMockTelecomAdapter("mock-x");
    const health = await adapter.checkHealth();
    expect(health.status).toBe("HEALTHY");

    const result = await adapter.purchaseData({
      operatorId: "mock-x:mock-op",
      msisdn: "+15551234567",
      bundleId: "mock-1gb",
      reference: "ref-3"
    });
    expect(result.status).toBe("DELIVERED");
  });
});
