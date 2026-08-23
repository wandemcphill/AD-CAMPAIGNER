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
  it("discovers an NG USD→NGN product and uses its current_rate", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, message: { details: [{ code: "NG_TEST" }] } }))
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        message: {
          details: [
            { sku: "OTHER", send_currency: "USD", receive_currency: "GHS", current_rate: 12.5 },
            { sku: "NGN_TEST", send_currency: "USD", receive_currency: "NGN", current_rate: 1500 }
          ]
        }
      }));

    const provider = createPayscribeFxProvider({ apiKey: "ps_live_test", fetcher });
    const rate = await provider.getRate("USD", "NGN");

    expect(rate.provider).toBe("payscribe");
    expect(rate.baseCurrency).toBe("USD");
    expect(rate.quoteCurrency).toBe("NGN");
    expect(rate.rateMicros).toBe(1_500_000_000n);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("tries all NG providers until one exposes a USD→NGN product", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        message: { details: [{ code: "FIRST" }, { code: "SECOND" }] }
      }))
      .mockResolvedValueOnce(jsonResponse({ status: true, message: { details: [{ sku: "NO_NGN", send_currency: "USD", receive_currency: "GHS", current_rate: 12.5 }] } }))
      .mockResolvedValueOnce(jsonResponse({ status: true, message: { details: [{ sku: "NGN_TEST", send_currency: "USD", receive_currency: "NGN", current_rate: "1495.75" }] } }));

    const provider = createPayscribeFxProvider({ apiKey: "ps_live_test", fetcher });
    const rate = await provider.getRate("USD", "NGN");

    expect(rate.rateMicros).toBe(1_495_750_000n);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects unsupported direct crosses instead of synthesizing them", async () => {
    const provider = createPayscribeFxProvider({
      apiKey: "ps_live_test",
      fetcher: vi.fn()
    });

    await expect(provider.getRate("GBP", "NGN")).rejects.toThrow(/supports USD\/NGN only/);
  });

  it("fails clearly when Payscribe has no NG providers", async () => {
    const provider = createPayscribeFxProvider({
      apiKey: "ps_live_test",
      fetcher: vi.fn().mockResolvedValueOnce(jsonResponse({ status: true, message: { details: [] } }))
    });

    await expect(provider.getRate("USD", "NGN")).rejects.toThrow(/no NG international-bills providers/i);
  });
});
