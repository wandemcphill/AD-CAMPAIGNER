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
  data?: unknown;
}

interface PayscribeProvider {
  code?: string;
  provider_code?: string;
}

interface PayscribeProduct {
  sku?: string;
  receive_currency?: string;
  send_currency?: string;
  current_rate?: string | number;
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

function arrayFromEnvelope(payload: unknown, key: string): unknown[] {
  if (typeof payload !== "object" || payload === null) return [];
  const envelope = payload as PayscribeEnvelope;

  if (Array.isArray(envelope.data)) return envelope.data;
  if (typeof envelope.data === "object" && envelope.data !== null && key in envelope.data) {
    const value = (envelope.data as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  if (Array.isArray(envelope.message)) return envelope.message;
  if (typeof envelope.message === "object" && envelope.message !== null) {
    const message = envelope.message as Record<string, unknown>;
    if (Array.isArray(message.details)) return message.details;
    if (Array.isArray(message.data)) return message.data;
    if (Array.isArray(message[key])) return message[key];
  }
  return [];
}

async function getJson(config: PayscribeFxConfig, path: string) {
  if (!config.apiKey) throw new Error("Payscribe FX requires PAYSCRIBE_API_KEY.");

  const response = await (config.fetcher ?? fetch)(`${baseUrl(config)}${path}`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    }
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null && "description" in payload
      ? responseMessage(payload as PayscribeEnvelope)
      : `HTTP ${response.status}`;
    throw new Error(`Payscribe FX API error: ${detail}`);
  }
  if (typeof payload === "object" && payload !== null && "status" in payload && (payload as PayscribeEnvelope).status === false) {
    throw new Error(responseMessage(payload as PayscribeEnvelope));
  }
  return payload;
}

async function resolveNgRateProduct(config: PayscribeFxConfig) {
  const providersPayload = await getJson(config, "/international-bills/providers?iso=NG");
  const providers = arrayFromEnvelope(providersPayload, "providers") as PayscribeProvider[];
  if (providers.length === 0) {
    throw new Error("Payscribe returned no NG international-bills providers.");
  }

  const errors: string[] = [];
  for (const provider of providers) {
    const providerCode = provider.code ?? provider.provider_code;
    if (!providerCode) continue;

    try {
      const productsPayload = await getJson(
        config,
        `/international-bills/products?iso=NG&code=${encodeURIComponent(providerCode)}`
      );
      const products = arrayFromEnvelope(productsPayload, "products") as PayscribeProduct[];
      const product = products.find(
        (candidate) =>
          typeof candidate.sku === "string" &&
          (candidate.receive_currency ?? "").toUpperCase() === "NGN" &&
          (candidate.send_currency ?? "USD").toUpperCase() === "USD" &&
          (parseNumber(candidate.current_rate) ?? 0) > 0
      );
      if (product?.sku) {
        return {
          providerCode,
          sku: product.sku,
          currentRate: parseNumber(product.current_rate)!
        };
      }
      errors.push(`${providerCode}: no USD/NGN product with current_rate`);
    } catch (error) {
      errors.push(`${providerCode}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Payscribe returned no usable USD/NGN rate product (${errors.join("; ")}).`);
}

export function createPayscribeFxProvider(config: PayscribeFxConfig): FxProvider {
  async function getRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate> {
    if (baseCurrency !== "USD" || quoteCurrency !== "NGN") {
      throw new Error(`Payscribe FX currently supports USD/NGN only, not ${baseCurrency}/${quoteCurrency}.`);
    }

    const resolved = await resolveNgRateProduct(config);

    return {
      baseCurrency,
      quoteCurrency,
      rateMicros: BigInt(Math.round(resolved.currentRate * 1_000_000)),
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
