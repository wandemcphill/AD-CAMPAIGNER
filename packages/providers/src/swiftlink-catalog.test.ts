import { describe, expect, it, vi } from "vitest";

import { createSwiftlinkAdapter } from "./vtu";

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
