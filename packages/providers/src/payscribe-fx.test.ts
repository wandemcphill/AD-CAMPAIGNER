import { describe, expect, it, vi } from "vitest";

import { createPayscribeFxProvider } from "./payscribe-fx";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body)
  } as Response;
}

describe("Payscribe FX adapter", () => {
  it("discovers an NG USD→NGN product and returns usd_rate", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, message: { details: [{ code: "NG_TEST" }] } }))
      .mockResolvedValueOnce(jsonResponse({ status: true, message: { details: [{ sku: "NGN_TEST", send_currency: "USD", receive_currency: "NGN" }] } }))
      .mockResolvedValueOnce(jsonResponse({ status: true, message: { details: { receive: 100, usd_rate: 1500, amount: 0.0667 } } }));

    const provider = createPayscribeFxProvider({ apiKey: "ps_live_test", fetcher });
    const rate = await provider.getRate("USD", "NGN");

    expect(rate.provider).toBe("payscribe");
    expect(rate.baseCurrency).toBe("USD");
    expect(rate.quoteCurrency).toBe("NGN");
    expect(rate.rateMicros).toBe(1_500_000_000n);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects unsupported direct crosses instead of synthesizing them", async () => {
    const provider = createPayscribeFxProvider({
      apiKey: "ps_live_test",
      fetcher: vi.fn()
    });

    await expect(provider.getRate("GBP", "NGN")).rejects.toThrow(/supports USD\/NGN only/);
  });
});
