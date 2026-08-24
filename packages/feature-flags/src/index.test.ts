import { afterEach, describe, expect, it } from "vitest";

import {
  featureFlagDefaults,
  featureFlagEnvName,
  resolveFeatureFlags
} from "./index";

const TOUCHED = [
  "FEATURE_VIRTUAL_ACCOUNTS",
  "FEATURE_TRUST_ENGINE",
  "FEATURE_VTU",
  "FEATURE_LIVE_PROVIDER_INTEGRATIONS",
  "FINANCIAL_PROVIDER_SIGNOFF"
];

afterEach(() => {
  for (const key of TOUCHED) {
    delete process.env[key];
  }
});

describe("featureFlagEnvName", () => {
  it("converts camelCase flags to FEATURE_UPPER_SNAKE", () => {
    expect(featureFlagEnvName("virtualAccounts")).toBe("FEATURE_VIRTUAL_ACCOUNTS");
    expect(featureFlagEnvName("vtu")).toBe("FEATURE_VTU");
    expect(featureFlagEnvName("billsElectricity")).toBe("FEATURE_BILLS_ELECTRICITY");
    expect(featureFlagEnvName("kybVerification")).toBe("FEATURE_KYB_VERIFICATION");
  });
});

describe("resolveFeatureFlags", () => {
  it("uses code defaults when no env override is present", () => {
    expect(resolveFeatureFlags().virtualAccounts).toBe(featureFlagDefaults.virtualAccounts);
    expect(resolveFeatureFlags().vtu).toBe(featureFlagDefaults.vtu);
  });

  it("turns a default-off vertical on from the environment", () => {
    process.env["FEATURE_TRUST_ENGINE"] = "true";
    expect(resolveFeatureFlags().trustEngine).toBe(true);
  });

  it("keeps financial product flags off without FINANCIAL_PROVIDER_SIGNOFF", () => {
    process.env["FEATURE_VIRTUAL_ACCOUNTS"] = "true";
    expect(resolveFeatureFlags().virtualAccounts).toBe(false);
  });

  it("turns a financial product flag on when FINANCIAL_PROVIDER_SIGNOFF is set", () => {
    process.env["FINANCIAL_PROVIDER_SIGNOFF"] = "true";
    process.env["FEATURE_VIRTUAL_ACCOUNTS"] = "true";
    expect(resolveFeatureFlags().virtualAccounts).toBe(true);
  });

  it("turns a default-on vertical off from the environment", () => {
    process.env["FEATURE_VTU"] = "false";
    expect(resolveFeatureFlags().vtu).toBe(false);
  });

  it("accepts the common truthy and falsy spellings, case-insensitively", () => {
    for (const raw of ["1", "yes", "ON", " True "]) {
      process.env["FEATURE_TRUST_ENGINE"] = raw;
      expect(resolveFeatureFlags().trustEngine).toBe(true);
    }
    for (const raw of ["0", "no", "OFF", " False "]) {
      process.env["FEATURE_VTU"] = raw;
      expect(resolveFeatureFlags().vtu).toBe(false);
    }
  });

  it("keeps the default when the variable is blank or unparseable", () => {
    // A Render variable left empty must never silently disable a live vertical.
    for (const raw of ["", "   ", "maybe"]) {
      process.env["FEATURE_VTU"] = raw;
      expect(resolveFeatureFlags().vtu).toBe(featureFlagDefaults.vtu);
    }
  });

  it("resolves every declared flag to a boolean", () => {
    const resolved = resolveFeatureFlags();
    for (const key of Object.keys(featureFlagDefaults)) {
      expect(typeof resolved[key as keyof typeof featureFlagDefaults]).toBe("boolean");
    }
  });
});
