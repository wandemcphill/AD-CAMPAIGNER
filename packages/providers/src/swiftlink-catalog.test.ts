import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSwiftlinkAdapter, resetSwiftlinkCaches } from "./vtu";

/**
 * Swiftlink's /get/plans returns GROUPS, not a flat plan list:
 *
 *   data[] -> { subcategory_id, title, category, plan[] -> { plan, amount } }
 *
 * The adapter previously read a flat array looking for network/plan_id/price,
 * none of which exist at any level of that response. Every row came back as
 * network "MTN", an empty plan id and costMinor 0 — the catalog sync would have
 * written data plans that sell for nothing.
 *
 * Payload below is trimmed from the real live response.
 */

const LIVE_PLANS = {
  data: [
    {
      subcategory_id: 1,
      title: "MTN SME",
      category: "Data",
      plan: [
        { plan: "500MB for 30 days", amount: 140 },
        { plan: "1GB for 30 days", amount: 268 },
        { plan: "10GB for 30 days", amount: 2690 }
      ],
      status: 1
    },
    {
      subcategory_id: 47,
      title: "MTN BETA PLAN",
      category: "Data",
      plan: [{ plan: "1000MB [CG] for 30 days", amount: 270 }],
      status: 1
    },
    {
      subcategory_id: 44,
      title: "9MOBILE SPECIAL",
      category: "Data",
      plan: [{ plan: "1GB for 30 days", amount: 180 }],
      status: 1
    },
    {
      subcategory_id: 45,
      title: "MTN HYNET",
      category: "Data",
      plan: [
        { plan: "130GB FUP UNLIMITED for 30 days", amount: 19200 },
        { plan: "1TB for 6 Months", amount: 86400 }
      ],
      status: 1
    },
    {
      subcategory_id: 48,
      title: "MTN AWOOOF",
      category: "Data",
      plan: [{ plan: "GET 1GB  for 1 Day", amount: 240 }],
      status: 1
    },
    // Non-data groups share the same envelope and must be ignored.
    { subcategory_id: 8, title: "MTN", category: "Airtime", status: 1 },
    { subcategory_id: 11, title: "DSTV", category: "Cable", status: 1 },
    {
      subcategory_id: 16,
      title: "Eko-Electric",
      serviceID: "EKEDC - Eko Electric",
      category: "Electricity",
      status: 1
    }
  ]
};

function adapterWith(
  payload: unknown,
  capture?: { body: string | undefined; url: string | undefined }
) {
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (capture) {
      capture.url = String(url);
      capture.body =
        init?.body instanceof URLSearchParams
          ? init.body.toString()
          : typeof init?.body === "string"
            ? init.body
            : undefined;
    }
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  }) as unknown as typeof fetch;

  return createSwiftlinkAdapter({ apiKey: "token", fetcher });
}

// The airtime subcategory cache is process-wide, so it would otherwise carry
// one case's catalogue into the next.
beforeEach(() => {
  resetSwiftlinkCaches();
});

describe("Swiftlink listDataPlans", () => {
  it("parses the nested group response into flat plan offers", async () => {
    const plans = await adapterWith(LIVE_PLANS).listDataPlans();

    // 3 MTN SME + 1 BETA + 1 9mobile + 2 HYNET + 1 AWOOOF = 8. Airtime, cable
    // and electricity groups are excluded.
    expect(plans).toHaveLength(8);
    expect(plans.every((p) => p.costMinor > 0)).toBe(true);
  });

  it("reads real costs rather than defaulting to zero", async () => {
    const plans = await adapterWith(LIVE_PLANS).listDataPlans();
    const mtn1gb = plans.find((p) => p.providerPlanId === "1:1GB for 30 days");

    expect(mtn1gb?.costMinor).toBe(26_800); // ₦268
    expect(mtn1gb?.network).toBe("MTN");
    expect(mtn1gb?.planType).toBe("SME");
    expect(mtn1gb?.sizeMb).toBe(1024);
    expect(mtn1gb?.validityDays).toBe(30);
  });

  it("derives the network from the group title, not a default", async () => {
    const plans = await adapterWith(LIVE_PLANS).listDataPlans();
    const nineMobile = plans.find((p) => p.network === "NINE_MOBILE");

    expect(nineMobile?.costMinor).toBe(18_000); // ₦180
    expect(nineMobile?.providerPlanId).toBe("44:1GB for 30 days");
  });

  it("encodes subcategory_id so a purchase can identify the product family", async () => {
    const plans = await adapterWith(LIVE_PLANS).listDataPlans();

    // Same customer-facing volume, different Swiftlink families and prices.
    expect(plans.find((p) => p.providerPlanId.startsWith("47:"))?.planType).toBe("CG");
    expect(plans.find((p) => p.providerPlanId.startsWith("1:"))?.planType).toBe("SME");
  });

  it("parses TB and month-based validity", async () => {
    const plans = await adapterWith(LIVE_PLANS).listDataPlans();
    const oneTb = plans.find((p) => p.providerPlanId === "45:1TB for 6 Months");

    expect(oneTb?.sizeMb).toBe(1024 * 1024);
    expect(oneTb?.validityDays).toBe(180);
  });

  it("keeps FUP UNLIMITED products with their stated volume", async () => {
    const plans = await adapterWith(LIVE_PLANS).listDataPlans();
    const fup = plans.find((p) => p.providerPlanId.includes("130GB FUP UNLIMITED"));

    expect(fup?.sizeMb).toBe(130 * 1024);
    expect(fup?.costMinor).toBe(1_920_000); // ₦19,200
  });

  it("skips a plan whose amount cannot be read rather than selling it free", async () => {
    const plans = await adapterWith({
      data: [
        {
          subcategory_id: 1,
          title: "MTN SME",
          category: "Data",
          plan: [
            { plan: "1GB for 30 days", amount: 268 },
            { plan: "Broken plan", amount: 0 },
            { plan: "Also broken", amount: "n/a" }
          ]
        }
      ]
    }).listDataPlans();

    expect(plans).toHaveLength(1);
    expect(plans[0]!.costMinor).toBe(26_800);
  });
});

describe("Swiftlink purchaseData", () => {
  it("sends the plan label and its own subcategory_id", async () => {
    const capture: { body: string | undefined; url: string | undefined } = {
      body: undefined,
      url: undefined
    };
    const adapter = adapterWith({ status: 1 }, capture);

    await adapter.purchaseData({
      network: "MTN",
      msisdn: "08140003288",
      providerPlanId: "47:1000MB [CG] for 30 days",
      reference: "SWLREF1"
    });

    const sent = new URLSearchParams(capture.body ?? "");
    // subcategory comes from the plan's family (47 = MTN BETA), not the network.
    expect(sent.get("subcategory_id")).toBe("47");
    expect(sent.get("plan_id")).toBe("1000MB [CG] for 30 days");
    expect(sent.get("phonenumber")).toBe("08140003288");
    expect(sent.get("customer_reference")).toBe("SWLREF1");
  });

  it("falls back to the configured per-network map for unencoded plan ids", async () => {
    const capture: { body: string | undefined } = { body: undefined };
    const fetcher = vi.fn((url: string, init?: RequestInit) => {
      capture.body =
        init?.body instanceof URLSearchParams
          ? init.body.toString()
          : typeof init?.body === "string"
            ? init.body
            : undefined;
      return Promise.resolve(new Response(JSON.stringify({ status: 1 }), { status: 200 }));
    }) as unknown as typeof fetch;

    const adapter = createSwiftlinkAdapter({
      apiKey: "token",
      dataSubcategoryId: { MTN: "1" },
      fetcher
    });

    await adapter.purchaseData({
      network: "MTN",
      msisdn: "08140003288",
      providerPlanId: "1GB for 30 days",
      reference: "SWLREF2"
    });

    const sent = new URLSearchParams(capture.body ?? "");
    expect(sent.get("subcategory_id")).toBe("1");
    expect(sent.get("plan_id")).toBe("1GB for 30 days");
  });
});

/**
 * Airtime subcategory_id used to be hand-configured via
 * SWIFTLINK_AIRTIME_SUBCATEGORIES, and a purchase failed before it was even
 * sent when that env var was missing — which it was, on every service. The same
 * /get/plans response the data catalogue comes from also carries the airtime
 * groups, so it is resolved rather than configured.
 */
function routingAdapter(payload: unknown = LIVE_PLANS) {
  const calls: string[] = [];
  const purchases: URLSearchParams[] = [];
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    const target = String(url);
    calls.push(target);

    if (target.includes("/purchase/airtime")) {
      purchases.push(new URLSearchParams(init?.body instanceof URLSearchParams ? init.body.toString() : ""));

      return Promise.resolve(new Response(JSON.stringify({ status: 1 }), { status: 200 }));
    }

    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  }) as unknown as typeof fetch;

  return { calls, purchases, fetcher };
}

/**
 * Swiftlink issues either a static dashboard token or an email/password login.
 * The /login contract is assumed rather than verified (see swiftlinkLogin), so
 * these pin the behaviour that does not depend on it: precedence, caching, and
 * recovery when a token goes stale.
 */
describe("Swiftlink authentication", () => {
  function loginAdapter(options: {
    unauthorizedFirst?: boolean;
    loginBody?: unknown;
  } = {}) {
    const calls: string[] = [];
    const authorizations: Array<string | null> = [];
    let served = 0;
    const fetcher = vi.fn((url: string, init?: RequestInit) => {
      const target = String(url);
      calls.push(target);

      if (target.endsWith("/login")) {
        const body = options.loginBody ?? { token: `issued-${calls.filter((c) => c.endsWith("/login")).length}` };

        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }

      authorizations.push(new Headers(init?.headers).get("authorization"));
      served += 1;

      if (options.unauthorizedFirst && served === 1) {
        return Promise.resolve(new Response("", { status: 401 }));
      }

      return Promise.resolve(new Response(JSON.stringify(LIVE_PLANS), { status: 200 }));
    }) as unknown as typeof fetch;

    return { calls, authorizations, fetcher };
  }

  it("logs in with email and password when no api key is configured", async () => {
    const { calls, authorizations, fetcher } = loginAdapter();
    const adapter = createSwiftlinkAdapter({
      email: "ops@fliptrybe.xyz",
      password: "secret",
      fetcher
    });

    await adapter.listDataPlans();

    expect(calls[0]).toContain("/login");
    expect(authorizations[0]).toBe("Bearer issued-1");
  });

  it("prefers a static api key and never calls login", async () => {
    const { calls, authorizations, fetcher } = loginAdapter();
    const adapter = createSwiftlinkAdapter({
      apiKey: "dashboard-token",
      email: "ops@fliptrybe.xyz",
      password: "secret",
      fetcher
    });

    await adapter.listDataPlans();

    expect(calls.some((url) => url.endsWith("/login"))).toBe(false);
    expect(authorizations[0]).toBe("Bearer dashboard-token");
  });

  it("re-authenticates once on a 401 rather than failing the call", async () => {
    const { calls, authorizations, fetcher } = loginAdapter({ unauthorizedFirst: true });
    const adapter = createSwiftlinkAdapter({
      email: "ops@fliptrybe.xyz",
      password: "secret",
      fetcher
    });

    // The token lifetime is undocumented; expiry is discovered via the 401.
    await expect(adapter.listDataPlans()).resolves.toHaveLength(8);
    expect(calls.filter((url) => url.endsWith("/login"))).toHaveLength(2);
    expect(authorizations).toEqual(["Bearer issued-1", "Bearer issued-2"]);
  });

  it("reuses a cached token across adapter instances", async () => {
    const { calls, fetcher } = loginAdapter();

    for (let i = 0; i < 3; i += 1) {
      await createSwiftlinkAdapter({
        email: "ops@fliptrybe.xyz",
        password: "secret",
        fetcher
      }).listDataPlans();
    }

    expect(calls.filter((url) => url.endsWith("/login"))).toHaveLength(1);
  });

  it("reads a token nested under data, not just at the top level", async () => {
    const { authorizations, fetcher } = loginAdapter({ loginBody: { data: { access_token: "nested" } } });
    const adapter = createSwiftlinkAdapter({
      email: "ops@fliptrybe.xyz",
      password: "secret",
      fetcher
    });

    await adapter.listDataPlans();

    expect(authorizations[0]).toBe("Bearer nested");
  });

  it("says what is missing when neither credential is configured", async () => {
    const { fetcher } = loginAdapter();
    const adapter = createSwiftlinkAdapter({ fetcher });

    await expect(adapter.listDataPlans()).rejects.toThrow(/SWIFTLINK_API_KEY/);
  });
});

describe("Swiftlink purchaseAirtime", () => {
  it("resolves subcategory_id from the catalogue with nothing configured", async () => {
    const { purchases, fetcher } = routingAdapter();
    const adapter = createSwiftlinkAdapter({ apiKey: "token", fetcher });

    const result = await adapter.purchaseAirtime({
      network: "MTN",
      msisdn: "08140003288",
      faceValueMinor: 50_000,
      reference: "SWLAIR1"
    });

    // subcategory_id 8 is the MTN Airtime group in the live response.
    expect(purchases[0]?.get("subcategory_id")).toBe("8");
    expect(purchases[0]?.get("amount")).toBe("500.00");
    expect(purchases[0]?.get("phonenumber")).toBe("08140003288");
    expect(result.status).not.toBe("FAILED");
  });

  it("lets an explicit override beat the catalogue without fetching it", async () => {
    const { calls, purchases, fetcher } = routingAdapter();
    const adapter = createSwiftlinkAdapter({
      apiKey: "token",
      airtimeSubcategoryId: { MTN: "99" },
      fetcher
    });

    await adapter.purchaseAirtime({
      network: "MTN",
      msisdn: "08140003288",
      faceValueMinor: 50_000,
      reference: "SWLAIR2"
    });

    expect(purchases[0]?.get("subcategory_id")).toBe("99");
    expect(calls.some((url) => url.includes("/get/plans"))).toBe(false);
  });

  it("fails cleanly for a network the account cannot sell", async () => {
    const { purchases, fetcher } = routingAdapter();
    const adapter = createSwiftlinkAdapter({ apiKey: "token", fetcher });

    // The live response carries an MTN airtime group and no GLO one.
    const result = await adapter.purchaseAirtime({
      network: "GLO",
      msisdn: "08140003288",
      faceValueMinor: 50_000,
      reference: "SWLAIR3"
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toContain("GLO");
    expect(purchases).toHaveLength(0);
  });

  it("caches the catalogue across adapters instead of re-pulling it per purchase", async () => {
    const { calls, fetcher } = routingAdapter();

    // buildAdapter constructs a fresh adapter per call in both the API and the
    // worker, so the cache has to outlive the instance to be worth anything.
    for (const reference of ["SWLAIR4", "SWLAIR5", "SWLAIR6"]) {
      await createSwiftlinkAdapter({ apiKey: "token", fetcher }).purchaseAirtime({
        network: "MTN",
        msisdn: "08140003288",
        faceValueMinor: 50_000,
        reference
      });
    }

    expect(calls.filter((url) => url.includes("/get/plans"))).toHaveLength(1);
    expect(calls.filter((url) => url.includes("/purchase/airtime"))).toHaveLength(3);
  });
});
