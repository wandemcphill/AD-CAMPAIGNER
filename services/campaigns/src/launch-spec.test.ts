import { describe, expect, it } from "vitest";

import { buildMetaLaunchSpec, normalizeCampaignSpec } from "./index";

describe("buildMetaLaunchSpec", () => {
  it("builds a copyable Meta spec sheet for a WhatsApp-messages goal", () => {
    const spec = normalizeCampaignSpec({
      goal: "WHATSAPP_MESSAGES",
      link: "https://wa.me/2348012345678",
      budgetMinor: 2_500_000,
      city: "Lagos",
      interests: ["thrift fashion"]
    });

    const launchSpec = buildMetaLaunchSpec(spec, "Amaka's Thrift Store");

    expect(launchSpec.platform).toBe("META");
    expect(launchSpec.campaign.objective).toBe("OUTCOME_LEADS");
    expect(launchSpec.campaign.name).toContain("Amaka's Thrift Store");
    expect(launchSpec.adSet.dailyBudgetMinor).toBe(2_500_000);
    expect(launchSpec.adSet.targeting.cities).toEqual(["Lagos"]);
    expect(launchSpec.adSet.targeting.genders).toEqual(["MALE", "FEMALE"]);
    expect(launchSpec.ad.destinationUrl).toBe("https://wa.me/2348012345678");
    expect(launchSpec.ad.callToAction).toBe("SEND_WHATSAPP_MESSAGE");
    expect(launchSpec.copyInstructions.length).toBeGreaterThan(0);
    expect(launchSpec.copyInstructions.some((line) => line.includes("thrift fashion"))).toBe(true);
    expect(launchSpec.warnings).toEqual([]);
  });

  it("maps SALES to a sales objective with a shop-now call to action", () => {
    const spec = normalizeCampaignSpec({
      goal: "SALES",
      link: "https://myshop.example.com/checkout",
      budgetMinor: 5_000_000
    });

    const launchSpec = buildMetaLaunchSpec(spec, "Lekki Phone Accessories");

    expect(launchSpec.campaign.objective).toBe("OUTCOME_SALES");
    expect(launchSpec.ad.callToAction).toBe("SHOP_NOW");
  });

  it("propagates unsupported-goal warnings from the CampaignSpec onto the launch spec", () => {
    const spec = normalizeCampaignSpec({
      goal: "LIVE_VIEWERS",
      link: "https://www.tiktok.com/@seller/live",
      budgetMinor: 2_500_000
    });

    const launchSpec = buildMetaLaunchSpec(spec, "Seller");

    expect(launchSpec.warnings.join(" ")).toMatch(/LIVE-promotion/i);
  });

  it("narrows gender targeting when a specific gender was requested", () => {
    const spec = normalizeCampaignSpec({
      goal: "WEBSITE_VISITS",
      link: "https://myshop.example.com",
      budgetMinor: 2_500_000,
      gender: "female"
    });

    const launchSpec = buildMetaLaunchSpec(spec, "Store");

    expect(launchSpec.adSet.targeting.genders).toEqual(["FEMALE"]);
  });

  it("notes when no interests were requested instead of omitting the instruction", () => {
    const spec = normalizeCampaignSpec({
      goal: "WEBSITE_VISITS",
      link: "https://myshop.example.com",
      budgetMinor: 2_500_000
    });

    const launchSpec = buildMetaLaunchSpec(spec, "Store");

    expect(launchSpec.copyInstructions.some((line) => /no specific interest targeting/i.test(line))).toBe(
      true
    );
  });
});
