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

function extractArrays(value: unknown, wantedKeys: string[], seen = new Set<object>()): unknown[][] {
  if (typeof value !== "object" || value === null) return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const objectValue = value as Record<string, unknown>;
  const found: unknown[][] = [];
  for (const [key, child] of Object.entries(objectValue)) {
    if (wantedKeys.includes(key) && Array.isArray(child)) found.push(child);
    found.push(...extractArrays(child, wantedKeys, seen));
  }
  return found;
}

function arrayFromEnvelope(payload: unknown, key: string): unknown[] {
  const directMatches = extractArrays(payload, [key]);
  if (directMatches.length > 0) return directMatches.flat();

  const genericDetails = extractArrays(payload, ["details", "data"]);
  return genericDetails[0] ?? [];
}

function findNestedNumber(value: unknown, key: string, seen = new Set<object>()): number | null {
  const direct = parseNumber(value);
  if (direct !== null) return direct;
  if (typeof value !== "object" || value === null) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const objectValue = value as Record<string, unknown>;
  const keyed = parseNumber(objectValue[key]);
  if (keyed !== null) return keyed;
  for (const child of Object.values(objectValue)) {
    const nested = findNestedNumber(child, key, seen);
    if (nested !== null) return nested;
  }
  return null;
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

      const nestedRate = findNestedNumber(productsPayload, "current_rate");
      const nestedSku = findNestedString(productsPayload, "sku");
      const nestedSend = findNestedString(productsPayload, "send_currency")?.toUpperCase();
      const nestedReceive = findNestedString(productsPayload, "receive_currency")?.toUpperCase();
      if (nestedSku && nestedRate && nestedRate > 0 && (nestedSend ?? "USD") === "USD" && nestedReceive === "NGN") {
        return { providerCode, sku: nestedSku, currentRate: nestedRate };
      }

      errors.push(`${providerCode}: no USD/NGN product with current_rate`);
    } catch (error) {
      errors.push(`${providerCode}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Payscribe returned no usable USD/NGN rate product (${errors.join("; ")}).`);
}

function findNestedString(value: unknown, key: string, seen = new Set<object>()): string | null {
  if (typeof value !== "object" || value === null) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const objectValue = value as Record<string, unknown>;
  if (typeof objectValue[key] === "string" && objectValue[key].trim()) return objectValue[key];
  for (const child of Object.values(objectValue)) {
    const nested = findNestedString(child, key, seen);
    if (nested !== null) return nested;
  }
  return null;
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
      await Promise.resolve();
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
