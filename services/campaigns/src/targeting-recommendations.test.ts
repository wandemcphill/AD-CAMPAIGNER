import { describe, expect, it } from "vitest";

import { recommendCampaignTargeting } from "./index";

describe("recommendCampaignTargeting", () => {
  it("returns three recommendations, broad first", () => {
    const recs = recommendCampaignTargeting({
      goal: "WHATSAPP_MESSAGES",
      budgetMinor: 2_500_000
    });

    expect(recs).toHaveLength(3);
    expect(recs[0]?.label).toMatch(/broad reach/i);
    expect(recs[0]?.optimizeAutomatically).toBe(true);
  });

  it("detects a fashion category from a free-text product description", () => {
    const recs = recommendCampaignTargeting({
      goal: "WHATSAPP_MESSAGES",
      budgetMinor: 2_500_000,
      productDescription: "I sell wigs and human hair in Lagos"
    });

    const focused = recs[1];
    expect(focused?.label).toMatch(/fashion/i);
    expect(focused?.targeting.gender).toBe("FEMALE");
    expect(focused?.targeting.interests).toContain("fashion");
  });

  it("detects a food category and keeps gender broad", () => {
    const recs = recommendCampaignTargeting({
      goal: "SALES",
      budgetMinor: 5_000_000,
      productDescription: "We deliver home-cooked meals and snacks"
    });

    const focused = recs[1];
    expect(focused?.label).toMatch(/food/i);
    expect(focused?.targeting.gender).toBe("ALL");
  });

  it("falls back to a general profile when no description matches", () => {
    const recs = recommendCampaignTargeting({
      goal: "WEBSITE_VISITS",
      budgetMinor: 2_500_000,
      productDescription: "asdkjfh unrelated nonsense text"
    });

    expect(recs[1]?.label).toMatch(/focused audience/i);
    expect(recs[1]?.targeting.ageMin).toBe(18);
    expect(recs[1]?.targeting.ageMax).toBe(65);
  });

  it("includes the city/LGA in the hyper-local recommendation's rationale", () => {
    const recs = recommendCampaignTargeting({
      goal: "SALES",
      budgetMinor: 2_500_000,
      city: "Lagos",
      localGovernmentArea: "Ikeja"
    });

    const hyperLocal = recs[2];
    expect(hyperLocal?.rationale).toContain("Lagos");
    expect(hyperLocal?.rationale).toContain("Ikeja");
    expect(hyperLocal?.targeting.localGovernmentAreas).toEqual(["Ikeja"]);
  });

  it("produces a plausible, labeled estimate range for WhatsApp messages", () => {
    const recs = recommendCampaignTargeting({
      goal: "WHATSAPP_MESSAGES",
      budgetMinor: 2_500_000
    });

    const { estimatedOutcome } = recs[0]!;
    expect(estimatedOutcome.metric).toMatch(/whatsapp messages/i);
    expect(estimatedOutcome.lowEstimate).toBeGreaterThanOrEqual(0);
    expect(estimatedOutcome.highEstimate).toBeGreaterThan(estimatedOutcome.lowEstimate);
    expect(estimatedOutcome.basis).toMatch(/benchmark/i);
  });

  it("produces an impressions-based estimate for goals without a click-based outcome", () => {
    const recs = recommendCampaignTargeting({
      goal: "VIDEO_VIEWS",
      budgetMinor: 5_000_000
    });

    const { estimatedOutcome } = recs[0]!;
    expect(estimatedOutcome.metric).toMatch(/views\/impressions/i);
    expect(estimatedOutcome.highEstimate).toBeGreaterThan(estimatedOutcome.lowEstimate);
  });

  it("never returns a negative estimate for a very small budget", () => {
    const recs = recommendCampaignTargeting({
      goal: "SALES",
      budgetMinor: 1
    });

    for (const rec of recs) {
      expect(rec.estimatedOutcome.lowEstimate).toBeGreaterThanOrEqual(0);
      expect(rec.estimatedOutcome.highEstimate).toBeGreaterThanOrEqual(0);
    }
  });

  it("narrows the hyper-local option to an exact radius when latitude/longitude/radiusKm are given", () => {
    const recs = recommendCampaignTargeting({
      goal: "SALES",
      budgetMinor: 2_500_000,
      productDescription: "used TV for sale in Abuja",
      latitude: 9.0765,
      longitude: 7.3986,
      radiusKm: 5
    });

    const hyperLocal = recs[2];
    expect(hyperLocal?.label).toContain("5km");
    expect(hyperLocal?.targeting.radius).toEqual({ latitude: 9.0765, longitude: 7.3986, radiusKm: 5 });
  });

  it("ignores a partial/invalid radius rather than throwing", () => {
    const recs = recommendCampaignTargeting({
      goal: "SALES",
      budgetMinor: 2_500_000,
      latitude: 9.0765
      // longitude/radiusKm missing -- should be treated as no radius, not an error
    });

    expect(recs[2]?.targeting.radius).toBeUndefined();
  });

  it("clamps an out-of-range radius into the 1-50km bound", () => {
    const recs = recommendCampaignTargeting({
      goal: "SALES",
      budgetMinor: 2_500_000,
      latitude: 6.5244,
      longitude: 3.3792,
      radiusKm: 500
    });

    expect(recs[2]?.targeting.radius?.radiusKm).toBe(50);
  });
});
