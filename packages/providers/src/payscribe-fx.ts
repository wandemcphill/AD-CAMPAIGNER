import { z } from "zod";

import type { FxProvider, FxRate } from "./types";

const responseSchema = z.object({
  status: z.string(),
  data: z.object({
    currentRate: z.number()
  })
});

export interface PayscribeFxConfig {
  apiKey?: string;
  baseUrl?: string;
}

export function createPayscribeFxProvider(config: PayscribeFxConfig): FxProvider {
  const baseUrl = config.baseUrl ?? "https://api.payscribe.co";

  async function getRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate> {
    const response = await fetch(`${baseUrl}/v1/rates/${baseCurrency}/${quoteCurrency}`, {
      headers: {
        Authorization: `Bearer ${config.apiKey ?? ""}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Payscribe FX request failed with ${response.status}`);
    }

    const payload = responseSchema.parse(await response.json());
    if (payload.status.toLowerCase() !== "success") {
      throw new Error("Payscribe FX returned an unsuccessful status.");
    }

    return {
      baseCurrency,
      quoteCurrency,
      rateMicros: BigInt(Math.round(payload.data.currentRate * 1_000_000)),
      timestamp: new Date(),
      provider: "payscribe"
    };
  }

  return {
    name: "payscribe",
    getRate,
    async getRates(baseCurrency: string, quoteCurrencies: string[]) {
      const rates: FxRate[] = [];
      for (const quoteCurrency of quoteCurrencies) {
        try {
          rates.push(await getRate(baseCurrency, quoteCurrency));
        } catch {
          // Unsupported corridors are intentionally omitted.
        }
      }
      return rates;
    },
    async getSupportedCurrencies() {
      return ["USD", "NGN"];
    },
    async healthCheck() {
      if (!config.apiKey) return { healthy: false, message: "PAYSCRIBE_API_KEY is not configured." };
      const started = Date.now();
      try {
        await getRate("USD", "NGN");
        return { healthy: true, message: `USD/NGN product current_rate healthy in ${Date.now() - started}ms.` };
      } catch (error) {
        return { healthy: false, message: error instanceof Error ? error.message : String(error) };
      }
    }
  };
}
