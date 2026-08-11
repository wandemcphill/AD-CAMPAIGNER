import { describe, expect, it, vi } from "vitest";

import { createMapleradFxProvider } from "./index";

// Mapped against real live-verified sandbox responses (maplerad.dev, checked
// 2026-08-11) — see docs/providers/maplerad.md. Real sandbox quote for
// USD->NGN amount:10000 returned rate:600, target.amount:6000000.

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body)
  } as Response;
}

describe("Maplerad FX adapter — mapped against official docs + live-verified sandbox behavior", () => {
  it("getRate() posts /fx/quote and maps rate to rateMicros", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        message: "Quote generated successfully",
        data: {
          reference: "6fffb1fb214648ab8b81539a242c5ed4",
          source: { currency: "USD", amount: 10000, human_readable_amount: 100 },
          target: { currency: "NGN", amount: 6000000, human_readable_amount: 60000 },
          rate: 600
        }
      })
    );

    const provider = createMapleradFxProvider({ apiKey: "mpr_sandbox_sk_x" }, fetcher);
    const rate = await provider.getRate("USD", "NGN");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.maplerad.com/v1/fx/quote",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer mpr_sandbox_sk_x" }),
        body: JSON.stringify({ source_currency: "USD", target_currency: "NGN", amount: 10000 })
      })
    );
    expect(rate.baseCurrency).toBe("USD");
    expect(rate.quoteCurrency).toBe("NGN");
    expect(rate.rateMicros).toBe(600_000_000n);
    expect(rate.provider).toBe("maplerad");
  });

  it("getRates() fans out getRate() across quote currencies", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        message: "Quote generated successfully",
        data: {
          reference: "ref",
          source: { currency: "USD", amount: 10000, human_readable_amount: 100 },
          target: { currency: "GHS", amount: 81000, human_readable_amount: 810 },
          rate: 8.1
        }
      })
    );

    const provider = createMapleradFxProvider({ apiKey: "mpr_sandbox_sk_x" }, fetcher);
    const rates = await provider.getRates("USD", ["GHS"]);

    expect(rates).toHaveLength(1);
    expect(rates[0]?.rateMicros).toBe(8_100_000n);
  });

  it("getSupportedCurrencies() returns the live-confirmed GET /currencies set", async () => {
    const provider = createMapleradFxProvider({ apiKey: "mpr_sandbox_sk_x" });
    const currencies = await provider.getSupportedCurrencies();

    expect(currencies).toContain("NGN");
    expect(currencies).toContain("USD");
    expect(currencies).toContain("GHS");
  });

  it("throws when the response envelope carries status:false", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ status: false, message: "invalid currency pair" })
    );

    const provider = createMapleradFxProvider({ apiKey: "mpr_sandbox_sk_x" }, fetcher);
    await expect(provider.getRate("USD", "XXX")).rejects.toThrow(/invalid currency pair/);
  });

  it("healthCheck() reflects a successful quote call", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        message: "Quote generated successfully",
        data: {
          reference: "ref",
          source: { currency: "USD", amount: 10000, human_readable_amount: 100 },
          target: { currency: "NGN", amount: 6000000, human_readable_amount: 60000 },
          rate: 600
        }
      })
    );

    const provider = createMapleradFxProvider({ apiKey: "mpr_sandbox_sk_x" }, fetcher);
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it("healthCheck() reports unhealthy on request failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ status: false, message: "unauthorized" }, false, 401));

    const provider = createMapleradFxProvider({ apiKey: "bad_key" }, fetcher);
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.message).toMatch(/unauthorized/);
  });
});
