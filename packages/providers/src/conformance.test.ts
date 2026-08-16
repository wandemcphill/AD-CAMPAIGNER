// Adapter conformance suite.
//
// Asserts that every adapter satisfies ProviderAdapterBase regardless of
// domain. This is what keeps "every provider is replaceable" from silently
// rotting as adapters accumulate — it must run in CI on every change, not
// only at onboarding time.

import { describe, expect, it } from "vitest";

import {
  CURRENT_INTERFACE_VERSION,
  adapterError,
  declaresWebhooks,
  isRetryableCode,
  toAdapterError,
  AdapterError,
  type AdapterErrorCode,
  type ProviderAdapterBase,
  type ProviderDomain
} from "./contract";
import {
  createCheapDataHubAdapter,
  createClubKonnectAdapter,
  createMobileNigAdapter,
  createMockVtuAdapter,
  createSmeDataAdapter
} from "./vtu";
import {
  createFiveSimRentalAdapter,
  createMockVirtualNumberAdapter,
  createSmsPoolAdapter,
  createSmsPvaAdapter
} from "./virtual-numbers";
import {
  createReloadlyGiftCardAdapter,
  createSogoGiftCardAdapter,
  createMockGiftCardSellProvider,
  createMockGiftCardPurchaseAdapter
} from "./gift-cards";
import {
  createAirtimeToCashAdapter,
  createMockAirtimeCashoutAdapter
} from "./airtime-cashout";
import {
  createMockRemittanceProvider,
  createMockVirtualAccountProvider,
  createMockVirtualCardProvider
} from "./financial-products";

const stubFetch: typeof fetch = () =>
  Promise.resolve(new Response("{}", { status: 200 }));

/**
 * Every adapter in the package, constructed with throwaway credentials.
 * Conformance is a static-shape check — no adapter method that performs I/O is
 * called here, so nothing is ever sent anywhere.
 */
const adapters: Array<{ label: string; adapter: ProviderAdapterBase }> = [
  {
    label: "clubkonnect",
    adapter: createClubKonnectAdapter({
      baseUrl: "https://clubkonnect.test",
      userId: "u",
      apiKey: "k",
      fetcher: stubFetch
    })
  },
  {
    label: "mobilenig",
    adapter: createMobileNigAdapter({
      baseUrl: "https://mobilenig.test",
      apiKey: "k",
      fetcher: stubFetch
    })
  },
  {
    label: "cheapdatahub",
    adapter: createCheapDataHubAdapter({
      baseUrl: "https://cheapdatahub.test",
      apiKey: "k",
      fetcher: stubFetch
    })
  },
  {
    label: "smedata",
    adapter: createSmeDataAdapter({
      baseUrl: "https://smedata.test",
      apiKey: "k",
      fetcher: stubFetch
    })
  },
  { label: "mock-vtu", adapter: createMockVtuAdapter() },
  {
    label: "smspool",
    adapter: createSmsPoolAdapter({
      baseUrl: "https://smspool.test",
      apiKey: "k",
      fetcher: stubFetch
    })
  },
  {
    label: "5sim",
    adapter: createFiveSimRentalAdapter({
      baseUrl: "https://5sim.test",
      apiToken: "t",
      fetcher: stubFetch
    })
  },
  {
    label: "smspva",
    adapter: createSmsPvaAdapter({
      baseUrl: "https://smspva.test",
      apiKey: "k",
      fetcher: stubFetch
    })
  },
  { label: "mock-numbers", adapter: createMockVirtualNumberAdapter() },
  {
    label: "reloadly",
    adapter: createReloadlyGiftCardAdapter({
      clientId: "id",
      clientSecret: "secret",
      sandbox: true,
      fetcher: stubFetch
    })
  },
  {
    label: "sogo",
    adapter: createSogoGiftCardAdapter({
      apiKey: "k",
      sandbox: true,
      fetcher: stubFetch
    })
  },
  { label: "mock-giftcard-sell", adapter: createMockGiftCardSellProvider() },
  { label: "mock-giftcard-buy", adapter: createMockGiftCardPurchaseAdapter() },
  {
    label: "airtimetocash",
    adapter: createAirtimeToCashAdapter({
      apiKey: "k",
      fetcher: stubFetch
    })
  },
  { label: "mock-airtime-cashout", adapter: createMockAirtimeCashoutAdapter() },
  { label: "mock-virtual-account", adapter: createMockVirtualAccountProvider() },
  { label: "mock-virtual-card", adapter: createMockVirtualCardProvider() },
  { label: "mock-remittance", adapter: createMockRemittanceProvider() }
];

const VALID_DOMAINS: ProviderDomain[] = [
  "VIRTUAL_NUMBER",
  "VTU",
  "GIFT_CARD",
  "AIRTIME_CASHOUT",
  "VIRTUAL_ACCOUNT",
  "VIRTUAL_CARD",
  "REMITTANCE"
];

describe.each(adapters)("adapter conformance: $label", ({ adapter }) => {
  it("declares a stable identity", () => {
    expect(adapter.name).toBeTruthy();
    expect(typeof adapter.name).toBe("string");
    expect(VALID_DOMAINS).toContain(adapter.domain);
  });

  it("declares the current interface version", () => {
    expect(adapter.interfaceVersion).toBe(CURRENT_INTERFACE_VERSION);
  });

  it("declares capabilities consistent with its own domain", () => {
    const caps = adapter.getCapabilities();
    expect(caps.domain).toBe(adapter.domain);
    expect(caps.productTypes.length).toBeGreaterThan(0);
    expect(Array.isArray(caps.countries)).toBe(true);
  });

  it("declares reliability honestly, with valid values", () => {
    const { reliability } = adapter.getCapabilities();
    expect(["strong", "weak", "none"]).toContain(reliability.idempotency);
    expect(["sequence", "timestamp", "none"]).toContain(reliability.ordering);
    expect(["hmac_sha256", "hmac_sha512", "shared_secret", "none"]).toContain(
      reliability.webhookSignature
    );
  });

  it("implements webhook handling if and only if it declares a signature scheme", () => {
    if (declaresWebhooks(adapter)) {
      expect(typeof adapter.verifyWebhookSignature).toBe("function");
      expect(typeof adapter.normalizeWebhook).toBe("function");
    } else {
      // Polling-only providers must not ship stub webhook handlers — an
      // unreachable stub reads as support that isn't there.
      expect(typeof adapter.normalizeWebhook).toBe("undefined");
    }
  });

  it("reports health without throwing, even when the provider misbehaves", async () => {
    // stubFetch returns an empty 200 body — a well-behaved adapter degrades
    // rather than throwing when a provider responds with nonsense.
    const health = await adapter.checkHealth();
    expect(health.providerName).toBeTruthy();
    expect(["HEALTHY", "DEGRADED", "DOWN", "DISABLED"]).toContain(health.status);
    expect(typeof health.latencyMs).toBe("number");
  });
});

describe("adapter identity is unique across the package", () => {
  it("has no duplicate provider names within a domain", () => {
    const seen = new Set<string>();
    for (const { adapter } of adapters) {
      const key = `${adapter.domain}:${adapter.name}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("error taxonomy", () => {
  it("normalizes an unmapped failure to unknown_provider_error", () => {
    const err = toAdapterError(new Error("socket hang up"));
    expect(err.code).toBe("unknown_provider_error");
    expect(err.message).toBe("socket hang up");
    expect(err).toBeInstanceOf(AdapterError);
  });

  it("passes an existing AdapterError through unchanged", () => {
    const original = adapterError("insufficient_funds", "no balance");
    expect(toAdapterError(original)).toBe(original);
  });

  it("never throws on a non-Error value", () => {
    expect(toAdapterError("plain string").code).toBe("unknown_provider_error");
    expect(toAdapterError(undefined).message).toBe("Unknown provider error");
    expect(toAdapterError(null).code).toBe("unknown_provider_error");
  });

  it("derives retryability from the code by default", () => {
    expect(adapterError("provider_unavailable", "down").retryable).toBe(true);
    expect(adapterError("rate_limited", "slow down").retryable).toBe(true);
    expect(adapterError("insufficient_funds", "no balance").retryable).toBe(false);
    expect(adapterError("invalid_request", "bad input").retryable).toBe(false);
  });

  it("allows an explicit retryable override", () => {
    expect(
      adapterError("unknown_provider_error", "ambiguous", { retryable: true })
        .retryable
    ).toBe(true);
  });

  it("retains the raw provider code without surfacing it in the message", () => {
    const err = adapterError("invalid_request", "Invalid MSISDN", {
      providerRawCode: "ERR_016"
    });
    expect(err.providerRawCode).toBe("ERR_016");
    expect(err.message).not.toContain("ERR_016");
    expect(err.toJSON().providerRawCode).toBe("ERR_016");
  });

  it("classifies every code as retryable or not without gaps", () => {
    const codes: AdapterErrorCode[] = [
      "insufficient_funds",
      "provider_unavailable",
      "invalid_request",
      "resource_not_found",
      "rate_limited",
      "compliance_hold",
      "unknown_provider_error"
    ];
    for (const code of codes) {
      expect(typeof isRetryableCode(code)).toBe("boolean");
    }
  });
});
