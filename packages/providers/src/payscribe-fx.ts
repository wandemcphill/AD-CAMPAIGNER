import type { FxProvider, FxRate } from "./index.js";

export interface PayscribeFxConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

interface PayscribeEnvelope {
  status?: boolean;
  description?: string;
  message?: unknown;
}

interface PayscribeRateResponse {
  receive?: string | number;
  usd_rate?: string | number;
  amount?: string | number;
}

interface PayscribeProvider {
  code?: string;
}

interface PayscribeProduct {
  sku?: string;
  receive_currency?: string;
  send_currency?: string;
}

function baseUrl(config: PayscribeFxConfig) {
  return (config.baseUrl ?? "https://api.payscribe.ng/api/v1").replace(/\/+$/, "");
}

function parseNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function responseMessage(payload: PayscribeEnvelope) {
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.message === "object" && payload.message !== null && "description" in payload.message) {
    const description = (payload.message as { description?: unknown }).description;
    if (typeof description === "string") return description;
  }
  return payload.description ?? "Payscribe API error.";
}

async function getJson(config: PayscribeFxConfig, path: string) {
  if (!config.apiKey) {
    throw new Error("Payscribe FX requires PAYSCRIBE_API_KEY.");
  }

  const response = await (config.fetcher ?? fetch)(`${baseUrl(config)}${path}`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    }
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`Payscribe FX API returned HTTP ${response.status}.`);
  }
  if (
    typeof payload === "object" &&
    payload !== null &&
    "status" in payload &&
    (payload as PayscribeEnvelope).status === false
  ) {
    throw new Error(responseMessage(payload as PayscribeEnvelope));
  }

  return payload;
}

async function resolveNgProduct(config: PayscribeFxConfig) {
  const providersPayload = (await getJson(config, "/international-bills/providers?iso=NG")) as {
    message?: { details?: PayscribeProvider[] } | PayscribeProvider[];
  };

  const providers = Array.isArray(providersPayload.message)
    ? providersPayload.message
    : providersPayload.message?.details ?? [];
  const providerCode = providers.find((provider) => provider.code)?.code;

  if (!providerCode) {
    throw new Error("Payscribe returned no usable NG international-bills provider.");
  }

  const productsPayload = (await getJson(
    config,
    `/international-bills/products?iso=NG&code=${encodeURIComponent(providerCode)}`
  )) as {
    message?: { details?: PayscribeProduct[] } | PayscribeProduct[];
  };

  const products = Array.isArray(productsPayload.message)
    ? productsPayload.message
    : productsPayload.message?.details ?? [];

  const product = products.find(
    (candidate) =>
      typeof candidate.sku === "string" &&
      (candidate.receive_currency ?? "").toUpperCase() === "NGN" &&
      (candidate.send_currency ?? "USD").toUpperCase() === "USD"
  );

  if (!product?.sku) {
    throw new Error("Payscribe returned no USD→NGN international-bills product.");
  }

  return product.sku;
}

export function createPayscribeFxProvider(
  config: PayscribeFxConfig
): FxProvider {
  async function getRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate> {
    if (baseCurrency !== "USD" || quoteCurrency !== "NGN") {
      throw new Error(`Payscribe FX currently supports USD/NGN only, not ${baseCurrency}/${quoteCurrency}.`);
    }

    const sku = await resolveNgProduct(config);
    const payload = (await getJson(
      config,
      `/international-bills/rate?iso=NG&sku=${encodeURIComponent(sku)}&amount=1`
    )) as PayscribeRateResponse;

    const rate = parseNumber(payload.usd_rate);
    if (rate === null || rate <= 0) {
      throw new Error("Payscribe did not return a positive USD/NGN rate.");
    }

    return {
      baseCurrency,
      quoteCurrency,
      rateMicros: BigInt(Math.round(rate * 1_000_000)),
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
      if (!config.apiKey) {
        return { healthy: false, message: "PAYSCRIBE_API_KEY is not configured." };
      }

      const started = Date.now();
      try {
        await getRate("USD", "NGN");
        return { healthy: true, message: `USD/NGN rate endpoint healthy in ${Date.now() - started}ms.` };
      } catch (error) {
        return {
          healthy: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}
