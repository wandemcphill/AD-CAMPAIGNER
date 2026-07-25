import { describe, expect, it } from "vitest";

import { assessCampaignRisk, type CampaignRiskInput } from "./index";

function baseInput(overrides: Partial<CampaignRiskInput> = {}): CampaignRiskInput {
  return {
    accountType: "MANAGED",
    budgetMinor: 2_500_000, // ₦25,000
    destinationUrl: "https://instagram.com/reel/abc123",
    destinationKind: "INSTAGRAM_REEL",
    contentText: "Women's thrift fashion in Lagos",
    productCategory: "thrift fashion",
    advertiser: { kycStatus: "VERIFIED", priorCampaigns: 5, priorViolations: 0 },
    ...overrides
  };
}

describe("assessCampaignRisk", () => {
  it("allows a clean, verified campaign with auto-launch eligibility", () => {
    const result = assessCampaignRisk(baseInput());

    expect(result.action).toBe("ALLOW");
    expect(result.riskLevel).toBe("LOW");
    expect(result.autoLaunchEligible).toBe(true);
    expect(result.score).toBe(0);
    expect(result.signals).toHaveLength(0);
  });

  it("blocks prohibited content regardless of account type", () => {
    const result = assessCampaignRisk(
      baseInput({
        accountType: "CONNECTED",
        contentText: "Best online casino and betting bonuses",
        productCategory: "gambling"
      })
    );

    expect(result.action).toBe("BLOCK");
    expect(result.riskLevel).toBe("BLOCKED");
    expect(result.autoLaunchEligible).toBe(false);
    expect(result.categories).toContain("gambling");
  });

  it("blocks misleading financial claims", () => {
    const result = assessCampaignRisk(
      baseInput({ contentText: "Invest now for guaranteed returns and double your money" })
    );

    expect(result.action).toBe("BLOCK");
    expect(result.categories).toContain("misleading-claims");
  });

  it("routes restricted (financial) content to review", () => {
    const result = assessCampaignRisk(
      baseInput({ contentText: "Learn forex trading and crypto investment" })
    );

    expect(result.action).toBe("REVIEW");
    expect(result.categories).toContain("financial-services");
    expect(result.autoLaunchEligible).toBe(false);
  });

  it("flags an unverified advertiser on a funded (managed) account for review", () => {
    const result = assessCampaignRisk(
      baseInput({ advertiser: { kycStatus: "UNVERIFIED", priorCampaigns: 0 } })
    );

    expect(result.action).toBe("REVIEW");
    expect(result.signals.map((signal) => signal.code)).toContain("UNVERIFIED_FUNDED_ADVERTISER");
  });

  it("does not penalise an unverified advertiser on their own connected account", () => {
    const result = assessCampaignRisk(
      baseInput({
        accountType: "CONNECTED",
        advertiser: { kycStatus: "UNVERIFIED", priorCampaigns: 0 }
      })
    );

    expect(result.action).toBe("ALLOW");
    expect(result.signals).toHaveLength(0);
  });

  it("blocks an advertiser who failed KYC", () => {
    const result = assessCampaignRisk(baseInput({ advertiser: { kycStatus: "REJECTED" } }));

    expect(result.action).toBe("BLOCK");
    expect(result.signals.map((signal) => signal.code)).toContain("KYC_REJECTED");
  });

  it("flags a missing or non-public destination link", () => {
    const missing = assessCampaignRisk(baseInput({ destinationUrl: "" }));
    const invalid = assessCampaignRisk(baseInput({ destinationUrl: "not-a-url" }));

    expect(missing.signals.map((s) => s.code)).toContain("MISSING_DESTINATION");
    expect(invalid.signals.map((s) => s.code)).toContain("INVALID_DESTINATION_URL");
  });

  it("flags below-minimum budgets", () => {
    const result = assessCampaignRisk(baseInput({ budgetMinor: 50_000 })); // ₦500

    expect(result.signals.map((signal) => signal.code)).toContain("BELOW_MIN_BUDGET");
  });

  it("applies stricter review thresholds to dedicated (high-value) accounts", () => {
    // A lone first-funded-campaign signal (score 20) clears auto-launch on MANAGED but not DEDICATED.
    const managed = assessCampaignRisk(
      baseInput({ accountType: "MANAGED", advertiser: { kycStatus: "VERIFIED", priorCampaigns: 0 } })
    );
    const dedicated = assessCampaignRisk(
      baseInput({
        accountType: "DEDICATED",
        advertiser: { kycStatus: "VERIFIED", priorCampaigns: 0 }
      })
    );

    expect(managed.score).toBe(20);
    expect(managed.action).toBe("ALLOW");
    expect(dedicated.score).toBe(20);
    expect(dedicated.action).toBe("REVIEW");
  });

  it("detects duplicate-destination velocity", () => {
    const url = "https://tiktok.com/@seller/video/123";
    const result = assessCampaignRisk(
      baseInput({ destinationUrl: url, recentCampaignUrls: [url, url, url] })
    );

    expect(result.signals.map((signal) => signal.code)).toContain("DUPLICATE_DESTINATION_VELOCITY");
  });

  it("caps the score at 100 when many signals stack", () => {
    const result = assessCampaignRisk(
      baseInput({
        contentText: "casino betting forex crypto supplement weight loss",
        destinationUrl: "",
        budgetMinor: 1,
        advertiser: { kycStatus: "UNVERIFIED", priorCampaigns: 0, priorViolations: 5 }
      })
    );

    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThan(0);
    expect(result.action).toBe("BLOCK");
  });
});
