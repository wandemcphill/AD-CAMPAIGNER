// RMB-buy provider adapter — Alipay/WeChat/bank-transfer orders to China. Verified
// live against the real Sogo Partner API on 2026-08-06 (GET /rmb/buy/rates).

import {
  CURRENT_INTERFACE_VERSION,
  type ProviderAdapterBase,
  type ProviderCapabilities,
  type ProviderHealthSnapshot
} from "./contract.js";

export type RmbChannel = "alipay" | "wechat" | "bank";
export type RmbAccountType = "nigerian" | "chinese";

export interface RmbRateTier {
  minRmb: number;
  maxRmb: number | null;
  ngnPerRmb: number;
}

export interface RmbChannelRates {
  channel: RmbChannel;
  name: string;
  isAvailable: boolean;
  accountTypes: Array<{ type: RmbAccountType; name: string; isAvailable: boolean; rates: RmbRateTier[] }>;
  rates: RmbRateTier[];
}

export interface RmbRatesSnapshot {
  channels: RmbChannelRates[];
  limits: { minRmb: number; maxRmb: number; currency: "CNY" };
}

export interface RmbBuySubmitResult {
  providerReference: string;
  status: "processing";
  exchangeRate: number;
  ngnAmountMinor: number;
}

export interface RmbBuyProvider extends ProviderAdapterBase {
  getRates(): Promise<RmbRatesSnapshot>;
  submitOrder(input: {
    channel: RmbChannel;
    accountType?: RmbAccountType;
    rmbAmount: number;
    recipientName: string;
    recipientIdentifier?: string;
    recipientBankName?: string;
    recipientBankAccountNumber?: string;
    description: string;
    /** Hosted URL of the recipient's QR code (already uploaded to our storage provider) — fetched server-side and forwarded to Sogo as multipart. */
    qrCodeUrl?: string;
    idempotencyKey: string;
  }): Promise<RmbBuySubmitResult>;
}

// Sogo signs RMB webhooks with HMAC-SHA256 too, but this adapter doesn't implement
// verifyWebhookSignature/normalizeWebhook yet — declare "none" honestly rather than
// claim a capability with no implementation behind it (see contract.ts).
function rmbCapabilities(): ProviderCapabilities {
  return {
    domain: "RMB",
    countries: ["NG", "CN"],
    productTypes: ["RMB_BUY"],
    reliability: { idempotency: "strong", ordering: "none", webhookSignature: "none" }
  };
}

export interface SogoRmbConfig {
  apiKey: string;
  sandbox?: boolean;
  baseUrl?: string | undefined;
  fetcher?: typeof fetch;
}

interface SogoRmbRateTierResponse {
  min_rmb: number;
  max_rmb: number | null;
  ngn_per_rmb: number;
}

interface SogoRmbChannelResponse {
  channel: string;
  name: string;
  is_available: boolean;
  account_types?: Array<{
    type: string;
    name: string;
    is_available: boolean;
    rates: SogoRmbRateTierResponse[];
  }>;
  rates: SogoRmbRateTierResponse[];
}

function mapRateTiers(rates: SogoRmbRateTierResponse[]): RmbRateTier[] {
  return rates.map((r) => ({ minRmb: r.min_rmb, maxRmb: r.max_rmb, ngnPerRmb: r.ngn_per_rmb }));
}

function resolveBaseUrl(config: SogoRmbConfig): string {
  const configured = config.baseUrl?.replace(/\/+$/, "");
  if (configured) {
    return configured.endsWith("/v1") ? configured : `${configured}/v1`;
  }
  return config.sandbox ? "https://sandbox.sogo.africa/v1" : "https://api.sogo.africa/v1";
}

export function createSogoRmbAdapter(config: SogoRmbConfig): RmbBuyProvider {
  const baseUrl = resolveBaseUrl(config);
  const f = config.fetcher ?? fetch;

  return {
    name: "sogo",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "RMB" as const,
    getCapabilities: rmbCapabilities,

    async getRates() {
      const res = await f(`${baseUrl}/rmb/buy/rates`, {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Sogo rmb/buy/rates returned HTTP ${res.status}: ${body}`);
      }

      const body = (await res.json()) as {
        data: {
          channels: SogoRmbChannelResponse[];
          limits: { min_rmb: number; max_rmb: number; currency: "CNY" };
        };
      };

      return {
        channels: body.data.channels.map((c) => ({
          channel: c.channel as RmbChannel,
          name: c.name,
          isAvailable: c.is_available,
          accountTypes: (c.account_types ?? []).map((a) => ({
            type: a.type as RmbAccountType,
            name: a.name,
            isAvailable: a.is_available,
            rates: mapRateTiers(a.rates)
          })),
          rates: mapRateTiers(c.rates)
        })),
        limits: {
          minRmb: body.data.limits.min_rmb,
          maxRmb: body.data.limits.max_rmb,
          currency: "CNY"
        }
      };
    },

    async submitOrder(input) {
      const form = new FormData();
      form.set("channel", input.channel);
      if (input.accountType) {
        form.set(
          input.channel === "wechat" ? "wechat_account_type" : "alipay_account_type",
          input.accountType
        );
      }
      form.set("rmb_amount", String(input.rmbAmount));
      form.set("description", input.description);
      if (input.recipientIdentifier) form.set("recipient_identifier", input.recipientIdentifier);
      if (input.recipientBankName) form.set("recipient_bank_name", input.recipientBankName);
      if (input.recipientBankAccountNumber) {
        form.set("recipient_bank_account_number", input.recipientBankAccountNumber);
      }
      if (input.qrCodeUrl) {
        const qrRes = await f(input.qrCodeUrl);
        if (!qrRes.ok) {
          throw new Error(`Could not fetch QR code image from ${input.qrCodeUrl}: HTTP ${qrRes.status}`);
        }
        const qrBlob = await qrRes.blob();
        form.set("qr_code", qrBlob, "qr-code.jpg");
      }

      const res = await f(`${baseUrl}/rmb/buy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Idempotency-Key": input.idempotencyKey },
        body: form
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Sogo rmb/buy returned HTTP ${res.status}: ${body}`);
      }

      const body = (await res.json()) as {
        data: { reference: string; exchange_rate: number; ngn_amount: { raw: number } };
      };

      return {
        providerReference: body.data.reference,
        status: "processing" as const,
        exchangeRate: body.data.exchange_rate,
        ngnAmountMinor: Math.round(body.data.ngn_amount.raw * 100)
      };
    },

    async checkHealth(): Promise<ProviderHealthSnapshot> {
      const start = Date.now();
      try {
        const res = await f(`${baseUrl}/rmb/buy/rates`, {
          headers: { Authorization: `Bearer ${config.apiKey}` }
        });
        return {
          providerName: "sogo",
          status: res.ok ? "HEALTHY" : "DEGRADED",
          latencyMs: Date.now() - start
        };
      } catch (err) {
        return {
          providerName: "sogo",
          status: "DOWN",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "Sogo RMB health check failed"
        };
      }
    }
  };
}

export function createMockRmbBuyProvider(name = "mock-rmb"): RmbBuyProvider {
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "RMB" as const,
    getCapabilities: rmbCapabilities,

    getRates() {
      return Promise.resolve({
        channels: [
          {
            channel: "alipay",
            name: "Alipay",
            isAvailable: true,
            accountTypes: [
              {
                type: "nigerian",
                name: "Nigerian (Personal)",
                isAvailable: true,
                rates: [{ minRmb: 0, maxRmb: null, ngnPerRmb: 215 }]
              }
            ],
            rates: [{ minRmb: 0, maxRmb: null, ngnPerRmb: 215 }]
          }
        ],
        limits: { minRmb: 100, maxRmb: 100_000, currency: "CNY" }
      });
    },

    submitOrder(input) {
      return Promise.resolve({
        providerReference: `mock_${input.idempotencyKey}`,
        status: "processing" as const,
        exchangeRate: 215,
        ngnAmountMinor: Math.round(input.rmbAmount * 215 * 100)
      });
    },

    checkHealth() {
      return Promise.resolve({ providerName: name, status: "HEALTHY", latencyMs: 5 });
    }
  };
}
