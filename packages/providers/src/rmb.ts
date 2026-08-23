// RMB-buy provider adapter — Alipay/WeChat/bank-transfer orders to China.
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

export class SogoRmbProviderError extends Error {
  readonly statusCode: number;
  readonly responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    super(`Sogo RMB request returned HTTP ${statusCode}: ${responseBody}`);
    this.name = "SogoRmbProviderError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
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
    /** Hosted URL of the recipient's QR code (already uploaded to our storage provider). */
    qrCodeUrl?: string;
    idempotencyKey: string;
  }): Promise<RmbBuySubmitResult>;
}

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
        throw new SogoRmbProviderError(res.status, body);
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

      if (input.channel === "alipay" || input.channel === "wechat") {
        if (!input.accountType) {
          throw new Error(`${input.channel} account type is required`);
        }
        form.set(
          input.channel === "wechat" ? "wechat_account_type" : "alipay_account_type",
          input.accountType
        );
        if (!input.qrCodeUrl) {
          throw new Error("qrCodeUrl is required for Alipay and WeChat RMB orders");
        }
      }

      form.set("rmb_amount", String(input.rmbAmount));
      form.set("recipient_name", input.recipientName);
      form.set("description", input.description);

      if (input.recipientIdentifier) {
        form.set("recipient_identifier", input.recipientIdentifier);
      }
      if (input.recipientBankName) {
        form.set("recipient_bank_name", input.recipientBankName);
      }
      if (input.recipientBankAccountNumber) {
        form.set("recipient_bank_account_number", input.recipientBankAccountNumber);
        if (input.channel === "bank" && !input.recipientIdentifier) {
          form.set("recipient_identifier", input.recipientBankAccountNumber);
        }
      }

      if (input.qrCodeUrl) {
        const qrRes = await f(input.qrCodeUrl);
        if (!qrRes.ok) {
          throw new Error(`Could not fetch QR code image: HTTP ${qrRes.status}`);
        }
        const qrBlob = await qrRes.blob();
        form.set("qr_code", qrBlob, "qr-code.jpg");
      }

      const res = await f(`${baseUrl}/rmb/buy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Idempotency-Key": input.idempotencyKey
        },
        body: form
      });

      if (!res.ok) {
        const body = await res.text();
        throw new SogoRmbProviderError(res.status, body);
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
