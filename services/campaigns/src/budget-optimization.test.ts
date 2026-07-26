import { describe, expect, it } from "vitest";

import { recommendBudgetOptimization, type CampaignPerformanceInput } from "./index";

function campaign(overrides: Partial<CampaignPerformanceInput> = {}): CampaignPerformanceInput {
  return {
    campaignId: "cmp_1",
    name: "Campaign 1",
    currency: "NGN",
    budgetMinor: 5_000_000,
    spentMinor: 2_500_000,
    goal: "SALES",
    ...overrides
  };
}

describe("recommendBudgetOptimization", () => {
  it("recommends moving budget from a costly campaign to a cheaper one when the gap is large", () => {
    const result = recommendBudgetOptimization([
      campaign({
        campaignId: "cmp_cheap",
        name: "Cheap winner",
        spentMinor: 1_000_000,
        outcome: { ordersCount: 20 } // 50,000 minor per order
      }),
      campaign({
        campaignId: "cmp_expensive",
        name: "Expensive loser",
        budgetMinor: 5_000_000,
        spentMinor: 2_000_000,
        outcome: { ordersCount: 5 } // 400,000 minor per order -- 8x worse
      })
    ]);

    expect(result.recommendations).toHaveLength(1);
    const rec = result.recommendations[0]!;
    expect(rec.fromCampaignId).toBe("cmp_expensive");
    expect(rec.toCampaignId).toBe("cmp_cheap");
    expect(rec.amountMinor).toBe(1_500_000); // half of (5,000,000 - 2,000,000) unspent
    expect(rec.reason).toMatch(/Expensive loser/);
  });

  it("does not recommend anything when costs are close", () => {
    const result = recommendBudgetOptimization([
      campaign({ campaignId: "cmp_a", spentMinor: 1_000_000, outcome: { ordersCount: 10 } }),
      campaign({ campaignId: "cmp_b", spentMinor: 1_100_000, outcome: { ordersCount: 10 } })
    ]);

    expect(result.recommendations).toHaveLength(0);
  });

  it("excludes campaigns with no spend or outcome data from scoring, without throwing", () => {
    const result = recommendBudgetOptimization([
      campaign({ campaignId: "cmp_no_outcome", spentMinor: 500_000 }),
      campaign({ campaignId: "cmp_no_spend", spentMinor: 0, outcome: { ordersCount: 3 } }),
      campaign({ campaignId: "cmp_scored", spentMinor: 500_000, outcome: { ordersCount: 5 } })
    ]);

    const scoredEntries = result.scored.filter((entry) => entry.costPerOutcomeMinor !== null);
    expect(scoredEntries).toHaveLength(1);
    expect(scoredEntries[0]?.campaignId).toBe("cmp_scored");
    expect(result.recommendations).toHaveLength(0); // fewer than 2 scorable campaigns
  });

  it("never recommends moving more than the unspent amount, and moves at most half", () => {
    const result = recommendBudgetOptimization([
      campaign({
        campaignId: "cmp_cheap",
        budgetMinor: 5_000_000,
        spentMinor: 1_000_000,
        outcome: { ordersCount: 50 }
      }),
      campaign({
        campaignId: "cmp_expensive",
        budgetMinor: 2_000_000,
        spentMinor: 1_900_000, // only 100,000 unspent
        outcome: { ordersCount: 1 }
      })
    ]);

    const rec = result.recommendations[0];
    expect(rec?.amountMinor).toBeLessThanOrEqual(50_000);
    expect(rec?.amountMinor).toBeLessThanOrEqual(100_000);
  });

  it("only compares campaigns within the same currency", () => {
    const result = recommendBudgetOptimization([
      campaign({ campaignId: "cmp_ngn", currency: "NGN", spentMinor: 1_000_000, outcome: { ordersCount: 1 } }),
      campaign({ campaignId: "cmp_usd", currency: "USD", spentMinor: 1_000_000, outcome: { ordersCount: 100 } })
    ]);

    expect(result.recommendations).toHaveLength(0);
  });

  it("falls back to messagesCount when ordersCount is absent", () => {
    const result = recommendBudgetOptimization([
      campaign({ campaignId: "cmp_cheap", spentMinor: 500_000, outcome: { messagesCount: 50 } }),
      campaign({ campaignId: "cmp_expensive", spentMinor: 500_000, outcome: { messagesCount: 5 } })
    ]);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.fromCampaignId).toBe("cmp_expensive");
  });

  it("always includes the honest scope note", () => {
    const result = recommendBudgetOptimization([]);
    expect(result.note).toMatch(/not cross-platform auto-optimization/i);
  });
});
