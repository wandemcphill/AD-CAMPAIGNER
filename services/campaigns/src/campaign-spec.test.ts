import { describe, expect, it } from "vitest";

import { normalizeCampaignSpec, type CampaignSpecInput } from "./index";

function baseInput(overrides: Partial<CampaignSpecInput> = {}): CampaignSpecInput {
  return {
    goal: "WHATSAPP_MESSAGES",
    link: "https://wa.me/2348012345678",
    budgetMinor: 2_500_000,
    city: "Lagos",
    ...overrides
  };
}

describe("normalizeCampaignSpec", () => {
  it("maps WhatsApp messages to a LEADS objective with a WhatsApp destination", () => {
    const spec = normalizeCampaignSpec(baseInput());

    expect(spec.goal).toBe("WHATSAPP_MESSAGES");
    expect(spec.objective).toBe("LEADS");
    expect(spec.destination.kind).toBe("WHATSAPP_CHANNEL");
    expect(spec.budget).toEqual({ amountMinor: 2_500_000, currency: "NGN" });
    expect(spec.warnings).toHaveLength(0);
  });

  it("defaults country to NG and age to 18-65, gender to ALL", () => {
    const spec = normalizeCampaignSpec(baseInput());

    expect(spec.targeting.countries).toEqual(["NG"]);
    expect(spec.targeting.cities).toEqual(["Lagos"]);
    expect(spec.targeting.ageMin).toBe(18);
    expect(spec.targeting.ageMax).toBe(65);
    expect(spec.targeting.gender).toBe("ALL");
  });

  it("maps website visits to TRAFFIC and a WEBSITE destination", () => {
    const spec = normalizeCampaignSpec(
      baseInput({ goal: "WEBSITE_VISITS", link: "https://myshop.com.ng/product/42" })
    );

    expect(spec.objective).toBe("TRAFFIC");
    expect(spec.destination.kind).toBe("WEBSITE");
  });

  it("infers TIKTOK_LIVE and flags live-viewer campaigns for review", () => {
    const spec = normalizeCampaignSpec(
      baseInput({ goal: "LIVE_VIEWERS", link: "https://www.tiktok.com/@seller/live" })
    );

    expect(spec.objective).toBe("LIVE_VIEWERS");
    expect(spec.destination.kind).toBe("TIKTOK_LIVE");
    expect(spec.warnings.join(" ")).toMatch(/LIVE-promotion/i);
  });

  it("infers INSTAGRAM_REEL for video-view campaigns on a reel link", () => {
    const spec = normalizeCampaignSpec(
      baseInput({ goal: "VIDEO_VIEWS", link: "https://instagram.com/reel/abc123" })
    );

    expect(spec.objective).toBe("ENGAGEMENT");
    expect(spec.destination.kind).toBe("INSTAGRAM_REEL");
  });

  it("flags store-visit campaigns as not yet supported", () => {
    const spec = normalizeCampaignSpec(
      baseInput({ goal: "STORE_VISITS", link: "https://maps.example.com/store" })
    );

    expect(spec.objective).toBe("AWARENESS");
    expect(spec.warnings.join(" ")).toMatch(/not available yet/i);
  });

  it("understands plain-language goals from the wizard", () => {
    const spec = normalizeCampaignSpec(
      baseInput({ goal: "Get more WhatsApp messages", link: "https://wa.me/234800" })
    );

    expect(spec.goal).toBe("WHATSAPP_MESSAGES");
  });

  it("normalizes gender and age inputs", () => {
    const spec = normalizeCampaignSpec(
      baseInput({ gender: "women", ageMin: 20, ageMax: 40 })
    );

    expect(spec.targeting.gender).toBe("FEMALE");
    expect(spec.targeting.ageMin).toBe(20);
    expect(spec.targeting.ageMax).toBe(40);
  });

  it("orders swapped age bounds and clamps out-of-range ages", () => {
    const spec = normalizeCampaignSpec(baseInput({ ageMin: 70, ageMax: 10 }));

    expect(spec.targeting.ageMin).toBeLessThanOrEqual(spec.targeting.ageMax);
    expect(spec.targeting.ageMax).toBeLessThanOrEqual(65);
    expect(spec.targeting.ageMin).toBeGreaterThanOrEqual(13);
  });

  it("warns on below-minimum budgets", () => {
    const spec = normalizeCampaignSpec(baseInput({ budgetMinor: 50_000 }));

    expect(spec.warnings.join(" ")).toMatch(/below the recommended minimum/i);
  });

  it("rejects an invalid link", () => {
    expect(() => normalizeCampaignSpec(baseInput({ link: "not-a-url" }))).toThrow(/valid public/i);
  });

  it("rejects a non-positive budget", () => {
    expect(() => normalizeCampaignSpec(baseInput({ budgetMinor: 0 }))).toThrow(/positive/i);
  });

  it("dedupes interests and cities", () => {
    const spec = normalizeCampaignSpec(
      baseInput({ cities: ["Lagos", "Lagos", " Abuja "], interests: ["thrift", "thrift", "fashion"] })
    );

    expect(spec.targeting.cities).toEqual(["Lagos", "Abuja"]);
    expect(spec.targeting.interests).toEqual(["thrift", "fashion"]);
  });

  it("rejects a shortlet campaign that links off-platform instead of to a FlipTrybe listing", () => {
    expect(() =>
      normalizeCampaignSpec(
        baseInput({
          link: "https://wa.me/2348012345678",
          productDescription: "2 bedroom shortlet apartment in Lekki"
        })
      )
    ).toThrow(/FlipTrybe listing/i);
  });

  it("allows a shortlet campaign once the link points at a FlipTrybe listing", () => {
    const spec = normalizeCampaignSpec(
      baseInput({
        link: "https://fliptrybe.store/listings/shortlet-lekki-42",
        productDescription: "2 bedroom shortlet apartment in Lekki"
      })
    );

    expect(spec.destination.kind).toBe("FLIPTRYBE_STORE");
  });

  it("rejects a TradeHub-style wholesale campaign that links off-platform", () => {
    expect(() =>
      normalizeCampaignSpec(
        baseInput({
          link: "https://wa.me/2348012345678",
          productDescription: "CAC registered distributor, wholesale bulk supply of rice"
        })
      )
    ).toThrow(/FlipTrybe listing/i);
  });

  it("allows a TradeHub campaign once the link points at a FlipTrybe listing", () => {
    const spec = normalizeCampaignSpec(
      baseInput({
        link: "https://fliptrybe.store/sell?lane=tradehub",
        productDescription: "CAC registered distributor, wholesale bulk supply of rice"
      })
    );

    expect(spec.destination.kind).toBe("FLIPTRYBE_STORE");
  });

  it("does not gate categories outside the marketplace-lane list", () => {
    const spec = normalizeCampaignSpec(
      baseInput({ link: "https://instagram.com/myshop", productDescription: "I sell wigs in Lagos" })
    );

    expect(spec.destination.kind).toBe("INSTAGRAM_PROFILE");
  });

  it("applies radius targeting when latitude/longitude/radiusKm are all valid", () => {
    const spec = normalizeCampaignSpec(baseInput({ latitude: 6.5244, longitude: 3.3792, radiusKm: 10 }));

    expect(spec.targeting.radius).toEqual({ latitude: 6.5244, longitude: 3.3792, radiusKm: 10 });
  });

  it("omits radius targeting when only some of latitude/longitude/radiusKm are given", () => {
    const spec = normalizeCampaignSpec(baseInput({ latitude: 6.5244, radiusKm: 10 }));

    expect(spec.targeting.radius).toBeUndefined();
  });

  it("omits radius targeting when coordinates are out of bounds", () => {
    const spec = normalizeCampaignSpec(baseInput({ latitude: 200, longitude: 3.3792, radiusKm: 10 }));

    expect(spec.targeting.radius).toBeUndefined();
  });
});
