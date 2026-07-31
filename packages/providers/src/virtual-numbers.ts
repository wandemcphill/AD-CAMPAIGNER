// Virtual Number (international SMS rental) provider adapter contract + adapters.
// SMS receive only — no VoIP, dialer, calling, forwarding, or voicemail capability.

export type NumberCapability = "SMS";
export type NumberRentalKind = "TEMPORARY" | "STANDARD" | "EXTENDED" | "LONG_TERM";

export interface NumberCountryAvailability {
  countryCode: string;
  countryName: string;
  minPriceMinorUsd: number;
}

export interface NumberOffer {
  providerName: string;
  countryCode: string;
  rentalKind: NumberRentalKind;
  durationDays: number;
  costMinorUsd: number;
  providerProductRef: string;
}

export interface ProviderNumberSnapshot {
  providerNumberId: string;
  status: "ACTIVE" | "EXPIRED" | "RELEASED" | "FAILED";
  expiresAt?: string;
}

export interface ProviderInboundMessage {
  providerMessageId: string;
  senderRaw?: string;
  body: string;
  receivedAt: string;
}

export interface VirtualNumberProviderBalance {
  providerName: string;
  balanceMinorUsd: number;
}

export interface VirtualNumberHealthSnapshot {
  providerName: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED";
  latencyMs: number;
  reason?: string;
}

export interface VirtualNumberProviderAdapter {
  readonly name: string;

  listCountries(): Promise<NumberCountryAvailability[]>;
  searchNumbers(input: {
    country: string;
    durationDays: number;
  }): Promise<NumberOffer[]>;
  reserveNumber(offer: NumberOffer): Promise<{ reservationId: string; expiresAt: string }>;
  provisionNumber(input: {
    reservationId?: string;
    offer: NumberOffer;
  }): Promise<{ providerNumberId: string; e164: string; expiresAt: string }>;
  getNumberStatus(providerNumberId: string): Promise<ProviderNumberSnapshot>;
  getMessages(providerNumberId: string, since?: string): Promise<ProviderInboundMessage[]>;
  renewNumber(
    providerNumberId: string,
    durationDays: number
  ): Promise<{ expiresAt: string; sameNumber: boolean }>;
  releaseNumber(providerNumberId: string): Promise<{ released: boolean }>;
  getBalance(): Promise<VirtualNumberProviderBalance>;
  checkHealth(): Promise<VirtualNumberHealthSnapshot>;
}

function maskSender(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.length <= 4 ? "****" : `${raw.slice(0, 2)}****${raw.slice(-2)}`;
}

// ─── SMSPool adapter ────────────────────────────────────────────────────────────
// Long-term rentals (US/CA/UK). REST API, api_key as query/body param.

export interface SmsPoolConfig {
  apiKey: string;
  baseUrl?: string; // default https://api.smspool.net
  fetcher?: typeof fetch;
}

async function smsPoolPost(
  config: SmsPoolConfig,
  path: string,
  body: Record<string, string>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? "https://api.smspool.net"}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: config.apiKey, ...body })
  });
  if (!res.ok) throw new Error(`SMSPool ${path} returned HTTP ${res.status}`);
  return res.json();
}

export function createSmsPoolAdapter(config: SmsPoolConfig): VirtualNumberProviderAdapter {
  return {
    name: "smspool",

    async listCountries() {
      const res = (await smsPoolPost(config, "/country/retrieve_all", {})) as Array<{
        ID?: string | number;
        name?: string;
        short_name?: string;
      }>;
      return (Array.isArray(res) ? res : []).map((c) => ({
        countryCode: String(c.short_name ?? c.ID ?? ""),
        countryName: c.name ?? "",
        minPriceMinorUsd: 0
      }));
    },

    async searchNumbers({ country, durationDays }) {
      const res = (await smsPoolPost(config, "/request/pricing", {
        country
      })) as Record<string, { price?: string | number; pool?: string | number }>;

      const offers: NumberOffer[] = [];
      for (const [productRef, info] of Object.entries(res)) {
        offers.push({
          providerName: "smspool",
          countryCode: country,
          rentalKind: durationDays >= 90 ? "LONG_TERM" : "STANDARD",
          durationDays,
          costMinorUsd: Math.round(parseFloat(String(info.price ?? 0)) * 100),
          providerProductRef: productRef
        });
      }
      return offers;
    },

    async reserveNumber(offer) {
      const res = (await smsPoolPost(config, "/purchase/sms", {
        country: offer.countryCode,
        pool: offer.providerProductRef
      })) as { order_id?: string | number; expiration?: string };
      return {
        reservationId: String(res.order_id ?? ""),
        expiresAt: res.expiration ?? new Date(Date.now() + 15 * 60_000).toISOString()
      };
    },

    async provisionNumber({ reservationId, offer }) {
      const res = (await smsPoolPost(config, "/sms/check", {
        orderid: reservationId ?? ""
      })) as { number?: string; expiration?: string };
      if (!res.number) throw new Error("SMSPool did not return a provisioned number");
      return {
        providerNumberId: reservationId ?? offer.providerProductRef,
        e164: res.number,
        expiresAt: res.expiration ?? new Date(Date.now() + offer.durationDays * 86_400_000).toISOString()
      };
    },

    async getNumberStatus(providerNumberId) {
      const res = (await smsPoolPost(config, "/sms/check", {
        orderid: providerNumberId
      })) as { status?: string | number };
      const status = String(res.status ?? "");
      return {
        providerNumberId,
        status: status === "3" || status === "success" ? "ACTIVE" : "EXPIRED"
      };
    },

    async getMessages(providerNumberId) {
      const res = (await smsPoolPost(config, "/sms/check", {
        orderid: providerNumberId
      })) as { sms?: string; number?: string };
      if (!res.sms) return [];
      return [
        {
          providerMessageId: `${providerNumberId}:${res.sms.length}:${res.sms.slice(0, 8)}`,
          body: res.sms,
          receivedAt: new Date().toISOString()
        }
      ];
    },

    async renewNumber(providerNumberId, durationDays) {
      const res = (await smsPoolPost(config, "/request/renew", {
        orderid: providerNumberId
      })) as { expiration?: string };
      return {
        expiresAt: res.expiration ?? new Date(Date.now() + durationDays * 86_400_000).toISOString(),
        sameNumber: true
      };
    },

    async releaseNumber(providerNumberId) {
      await smsPoolPost(config, "/sms/cancel", { orderid: providerNumberId });
      return { released: true };
    },

    async getBalance() {
      const res = (await smsPoolPost(config, "/request/balance", {})) as {
        balance?: string | number;
      };
      return {
        providerName: "smspool",
        balanceMinorUsd: Math.round(parseFloat(String(res.balance ?? 0)) * 100)
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await smsPoolPost(config, "/request/balance", {});
        return { providerName: "smspool", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "smspool",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "SMSPool health check failed"
        };
      }
    }
  };
}

// ─── 5SIM adapter ─────────────────────────────────────────────────────────────
// Short-to-medium rentals, 153 countries. Bearer token auth.

export interface FiveSimConfig {
  apiToken: string;
  baseUrl?: string; // default https://5sim.net/v1
  fetcher?: typeof fetch;
}

async function fiveSimGet(config: FiveSimConfig, path: string): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? "https://5sim.net/v1"}${path}`, {
    headers: { Authorization: `Bearer ${config.apiToken}`, Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`5SIM ${path} returned HTTP ${res.status}`);
  return res.json();
}

export function createFiveSimRentalAdapter(config: FiveSimConfig): VirtualNumberProviderAdapter {
  return {
    name: "5sim",

    async listCountries() {
      const res = (await fiveSimGet(config, "/guest/countries")) as Record<
        string,
        { text_en?: string }
      >;
      return Object.entries(res)
        .filter(([code]) => code !== "any")
        .map(([code, info]) => ({
          countryCode: code,
          countryName: info.text_en ?? code,
          minPriceMinorUsd: 0
        }));
    },

    async searchNumbers({ country, durationDays }) {
      const res = (await fiveSimGet(
        config,
        `/guest/products/${encodeURIComponent(country)}/any`
      )) as Record<string, { Qty?: number; Price?: number }>;

      const offers: NumberOffer[] = [];
      for (const [productRef, info] of Object.entries(res)) {
        if (!info.Qty || info.Qty <= 0) continue;
        offers.push({
          providerName: "5sim",
          countryCode: country,
          rentalKind: durationDays <= 1 ? "TEMPORARY" : "STANDARD",
          durationDays,
          costMinorUsd: Math.round((info.Price ?? 0) * 100),
          providerProductRef: productRef
        });
      }
      return offers;
    },

    async reserveNumber(offer) {
      const res = (await fiveSimGet(
        config,
        `/user/buy/activation/${encodeURIComponent(offer.countryCode)}/any/${encodeURIComponent(offer.providerProductRef)}`
      )) as { id?: number; expires?: string };
      return {
        reservationId: String(res.id ?? ""),
        expiresAt: res.expires ?? new Date(Date.now() + 20 * 60_000).toISOString()
      };
    },

    async provisionNumber({ reservationId, offer }) {
      const res = (await fiveSimGet(config, `/user/check/${reservationId}`)) as {
        phone?: string;
        expires?: string;
      };
      if (!res.phone) throw new Error("5SIM did not return a provisioned number");
      return {
        providerNumberId: reservationId ?? offer.providerProductRef,
        e164: res.phone,
        expiresAt: res.expires ?? new Date(Date.now() + offer.durationDays * 86_400_000).toISOString()
      };
    },

    async getNumberStatus(providerNumberId) {
      const res = (await fiveSimGet(config, `/user/check/${providerNumberId}`)) as {
        status?: string;
      };
      const status = res.status ?? "";
      return {
        providerNumberId,
        status:
          status === "RECEIVED" || status === "PENDING"
            ? "ACTIVE"
            : status === "CANCELED"
              ? "RELEASED"
              : "EXPIRED"
      };
    },

    async getMessages(providerNumberId) {
      const res = (await fiveSimGet(config, `/user/check/${providerNumberId}`)) as {
        sms?: Array<{ id?: number; text?: string; sender?: string; date?: string }>;
      };
      return (res.sms ?? []).map((m) => ({
        providerMessageId: String(m.id ?? ""),
        ...(m.sender ? { senderRaw: m.sender } : {}),
        body: m.text ?? "",
        receivedAt: m.date ?? new Date().toISOString()
      }));
    },

    renewNumber(_providerNumberId, durationDays) {
      // 5SIM rentals are not renewable in place — a fresh purchase is required, so the
      // caller must treat this as a new number, not a same-number renewal.
      return Promise.resolve({
        expiresAt: new Date(Date.now() + durationDays * 86_400_000).toISOString(),
        sameNumber: false
      });
    },

    async releaseNumber(providerNumberId) {
      await fiveSimGet(config, `/user/cancel/${providerNumberId}`);
      return { released: true };
    },

    async getBalance() {
      const res = (await fiveSimGet(config, "/user/profile")) as { balance?: number };
      return { providerName: "5sim", balanceMinorUsd: Math.round((res.balance ?? 0) * 100) };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await fiveSimGet(config, "/user/profile");
        return { providerName: "5sim", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "5sim",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "5SIM health check failed"
        };
      }
    }
  };
}

// ─── SMSPVA adapter ───────────────────────────────────────────────────────────
// Rental API: getcountries, getdata (weekly/monthly pricing), order state. Query-param auth.

export interface SmsPvaConfig {
  apiKey: string;
  baseUrl?: string; // default https://smspva.com/priemnik.php
  fetcher?: typeof fetch;
}

async function smsPvaGet(
  config: SmsPvaConfig,
  params: Record<string, string>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const url = new URL(config.baseUrl ?? "https://smspva.com/priemnik.php");
  url.searchParams.set("apikey", config.apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await f(url.toString());
  if (!res.ok) throw new Error(`SMSPVA request returned HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function createSmsPvaAdapter(config: SmsPvaConfig): VirtualNumberProviderAdapter {
  return {
    name: "smspva",

    async listCountries() {
      const res = (await smsPvaGet(config, { metod: "getcountries" })) as Record<
        string,
        { name?: string }
      >;
      return Object.entries(res ?? {}).map(([code, info]) => ({
        countryCode: code,
        countryName: info.name ?? code,
        minPriceMinorUsd: 0
      }));
    },

    async searchNumbers({ country, durationDays }) {
      const res = (await smsPvaGet(config, {
        metod: "getdata",
        country
      })) as Array<{ id?: string; price_week?: string | number; price_month?: string | number }>;

      const offers: NumberOffer[] = [];
      for (const item of Array.isArray(res) ? res : []) {
        const usesMonthly = durationDays >= 28;
        const price = usesMonthly ? item.price_month : item.price_week;
        offers.push({
          providerName: "smspva",
          countryCode: country,
          rentalKind: usesMonthly ? "EXTENDED" : "STANDARD",
          durationDays,
          costMinorUsd: Math.round(parseFloat(String(price ?? 0)) * 100),
          providerProductRef: item.id ?? ""
        });
      }
      return offers;
    },

    async reserveNumber(offer) {
      const res = (await smsPvaGet(config, {
        metod: "get_rent_number",
        country: offer.countryCode,
        service: offer.providerProductRef
      })) as { id?: string | number; number?: string; end_date?: string };
      return {
        reservationId: String(res.id ?? ""),
        expiresAt: res.end_date ?? new Date(Date.now() + offer.durationDays * 86_400_000).toISOString()
      };
    },

    async provisionNumber({ reservationId, offer }) {
      const res = (await smsPvaGet(config, {
        metod: "get_rent_number_status",
        id: reservationId ?? ""
      })) as { number?: string; end_date?: string };
      if (!res.number) throw new Error("SMSPVA did not return a provisioned number");
      return {
        providerNumberId: reservationId ?? offer.providerProductRef,
        e164: res.number,
        expiresAt: res.end_date ?? new Date(Date.now() + offer.durationDays * 86_400_000).toISOString()
      };
    },

    async getNumberStatus(providerNumberId) {
      const res = (await smsPvaGet(config, {
        metod: "get_rent_number_status",
        id: providerNumberId
      })) as { status?: string };
      const status = (res.status ?? "").toLowerCase();
      return {
        providerNumberId,
        status:
          status === "active"
            ? "ACTIVE"
            : status === "finished" || status === "canceled"
              ? "RELEASED"
              : "EXPIRED"
      };
    },

    async getMessages(providerNumberId) {
      const res = (await smsPvaGet(config, {
        metod: "get_rent_number_sms",
        id: providerNumberId
      })) as Array<{ id?: string | number; sender?: string; text?: string; date?: string }>;
      return (Array.isArray(res) ? res : []).map((m) => ({
        providerMessageId: String(m.id ?? ""),
        ...(m.sender ? { senderRaw: m.sender } : {}),
        body: m.text ?? "",
        receivedAt: m.date ?? new Date().toISOString()
      }));
    },

    async renewNumber(providerNumberId, durationDays) {
      const res = (await smsPvaGet(config, {
        metod: "prolong_rent_number",
        id: providerNumberId,
        days: String(durationDays)
      })) as { end_date?: string };
      return {
        expiresAt: res.end_date ?? new Date(Date.now() + durationDays * 86_400_000).toISOString(),
        sameNumber: true
      };
    },

    async releaseNumber(providerNumberId) {
      await smsPvaGet(config, { metod: "set_rent_status", id: providerNumberId, status: "1" });
      return { released: true };
    },

    async getBalance() {
      const res = (await smsPvaGet(config, { metod: "get_balance" })) as {
        balance?: string | number;
      };
      return {
        providerName: "smspva",
        balanceMinorUsd: Math.round(parseFloat(String(res.balance ?? 0)) * 100)
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await smsPvaGet(config, { metod: "get_balance" });
        return { providerName: "smspva", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "smspva",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "SMSPVA health check failed"
        };
      }
    }
  };
}

// ─── Mock adapter (CI / tests) ────────────────────────────────────────────────

export function createMockVirtualNumberAdapter(name = "mock-numbers"): VirtualNumberProviderAdapter {
  return {
    name,
    listCountries() {
      return Promise.resolve([
        { countryCode: "US", countryName: "United States", minPriceMinorUsd: 1800 },
        { countryCode: "GB", countryName: "United Kingdom", minPriceMinorUsd: 5500 }
      ]);
    },
    searchNumbers({ country, durationDays }) {
      return Promise.resolve([
        {
          providerName: name,
          countryCode: country,
          rentalKind: durationDays >= 90 ? "LONG_TERM" : "STANDARD",
          durationDays,
          costMinorUsd: 1800,
          providerProductRef: "mock_product"
        }
      ]);
    },
    reserveNumber() {
      return Promise.resolve({
        reservationId: `mock_res_${Math.random().toString(36).slice(2, 10)}`,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
      });
    },
    provisionNumber({ reservationId, offer }) {
      return Promise.resolve({
        providerNumberId: reservationId ?? `mock_num_${Math.random().toString(36).slice(2, 10)}`,
        e164: "+15550001234",
        expiresAt: new Date(Date.now() + offer.durationDays * 86_400_000).toISOString()
      });
    },
    getNumberStatus(providerNumberId) {
      return Promise.resolve({ providerNumberId, status: "ACTIVE" as const });
    },
    getMessages() {
      return Promise.resolve([]);
    },
    renewNumber(_providerNumberId, durationDays) {
      return Promise.resolve({
        expiresAt: new Date(Date.now() + durationDays * 86_400_000).toISOString(),
        sameNumber: true
      });
    },
    releaseNumber() {
      return Promise.resolve({ released: true });
    },
    getBalance() {
      return Promise.resolve({ providerName: name, balanceMinorUsd: 500_000 });
    },
    checkHealth() {
      return Promise.resolve({ providerName: name, status: "HEALTHY" as const, latencyMs: 5 });
    }
  };
}

export { maskSender };
