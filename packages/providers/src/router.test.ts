import { describe, expect, it } from "vitest";

import { buildHealthMap, selectAffinityProvider, selectProviders } from "./router.js";
import type { ProviderConfigLike, ProviderHealthLike } from "./router.js";

function config(overrides: Partial<ProviderConfigLike> = {}): ProviderConfigLike {
  return {
    name: "acme",
    domain: "VIRTUAL_NUMBER",
    status: "HEALTHY",
    priority: 100,
    enabledCountries: [],
    enabledNetworks: [],
    enabledProductTypes: [],
    deletedAt: null,
    ...overrides
  };
}

function health(overrides: Partial<ProviderHealthLike> = {}): ProviderHealthLike {
  return {
    providerName: "acme",
    status: "HEALTHY",
    checkedAt: new Date(),
    ...overrides
  };
}

describe("selectProviders", () => {
  it("ranks healthy providers by priority", () => {
    const configs = [config({ name: "a", priority: 50 }), config({ name: "b", priority: 10 })];
    const healthMap = buildHealthMap([health({ providerName: "a" }), health({ providerName: "b" })]);
    const result = selectProviders(
      { domain: "VIRTUAL_NUMBER", scope: { productType: "STANDARD" } },
      configs,
      healthMap
    );
    expect(result[0]?.providerName).toBe("b");
    expect(result[0]?.available).toBe(true);
  });

  it("excludes disabled providers", () => {
    const configs = [config({ name: "a", status: "DISABLED" })];
    const result = selectProviders(
      { domain: "VIRTUAL_NUMBER", scope: { productType: "STANDARD" } },
      configs,
      new Map()
    );
    expect(result[0]?.available).toBe(false);
  });
});

describe("selectAffinityProvider", () => {
  it("returns available when the origin provider is healthy", () => {
    const result = selectAffinityProvider("acme", [config()], buildHealthMap([health()]));
    expect(result).toEqual({ providerName: "acme", available: true });
  });

  it("holds and flags when the origin provider is unconfigured", () => {
    const result = selectAffinityProvider("acme", [], new Map());
    expect(result).toEqual({
      providerName: "acme",
      available: false,
      reason: "provider_not_configured"
    });
  });

  it("holds and flags when the origin provider is disabled", () => {
    const result = selectAffinityProvider(
      "acme",
      [config({ status: "DISABLED" })],
      new Map()
    );
    expect(result.available).toBe(false);
    expect(result.reason).toBe("provider_disabled");
  });

  it("holds and flags when the origin provider's latest health is DOWN", () => {
    const result = selectAffinityProvider(
      "acme",
      [config()],
      buildHealthMap([health({ status: "DOWN" })])
    );
    expect(result.available).toBe(false);
    expect(result.reason).toBe("provider_unhealthy");
  });

  it("does not fall back to a healthier provider — affinity is pinned, not re-ranked", () => {
    const configs = [config({ name: "acme", status: "DOWN" }), config({ name: "other" })];
    const result = selectAffinityProvider("acme", configs, new Map());
    expect(result.providerName).toBe("acme");
    expect(result.available).toBe(false);
  });

  it("degraded health still counts as available — only DOWN holds", () => {
    const result = selectAffinityProvider(
      "acme",
      [config()],
      buildHealthMap([health({ status: "DEGRADED" })])
    );
    expect(result.available).toBe(true);
  });
});
