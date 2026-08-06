// Crypto-sell provider adapter — deposit-address model. Verified live against
// the real Sogo Partner API on 2026-08-06 (GET /account, GET /crypto/assets).

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  CURRENT_INTERFACE_VERSION,
  type CanonicalEvent,
  type ProviderAdapterBase,
  type ProviderCapabilities,
  type ProviderHealthSnapshot
} from "./contract.js";

export interface CryptoAssetFeeTier {
  minUsd: number;
  maxUsd: number | null;
  feeRate: number;
  feePercent: number;
}

export interface CryptoAsset {
  symbol: string;
  name: string;
  networks: string[];
  defaultNetwork: string;
  minDepositUsd: number;
  feeTiers: CryptoAssetFeeTier[];
}

export interface CryptoDepositAddressResult {
  id: string;
  asset: string;
  network: string;
  address: string;
  maskedAddress: string;
  destinationTag?: string;
  isActive: boolean;
}

export interface CryptoSellProvider extends ProviderAdapterBase {
  listAssets(): Promise<CryptoAsset[]>;
  getEstimatedRate(
    asset: string,
    amount: number
  ): Promise<{ ngnAmountMinor: number; usdNgnRate: number; feeNgnMinor: number }>;
  getOrCreateDepositAddress(input: {
    asset: string;
    network?: string;
    idempotencyKey: string;
  }): Promise<CryptoDepositAddressResult>;
  simulateTestDeposit?(input: {
    testReference: string;
  }): Promise<{ providerReference: string; status: "pending" | "completed"; txHash?: string }>;
}

function cryptoCapabilities(webhookSignature: "hmac_sha256" | "none"): ProviderCapabilities {
  return {
    domain: "CRYPTO",
    countries: [],
    productTypes: ["CRYPTO_SELL"],
    reliability: { idempotency: "strong", ordering: "none", webhookSignature }
  };
}

export interface SogoCryptoConfig {
  apiKey: string;
  sandbox?: boolean;
  baseUrl?: string | undefined;
  /** HMAC-SHA256 webhook secret from the Sogo developer dashboard, for verifying X-Sogo-Signature-256. */
  webhookSecret?: string;
  fetcher?: typeof fetch;
}

interface SogoCryptoAssetResponse {
  symbol: string;
  name: string;
  networks: string[];
  default_network: string;
  min_deposit_usd: number;
  fee_tiers: Array<{
    min_usd: number;
    max_usd: number | null;
    fee_rate: number;
    fee_percent: number;
  }>;
}

interface SogoCryptoRateResponse {
  asset: string;
  crypto_amount: string;
  rate: string;
  usd_ngn_rate: number;
  estimated_ngn: string;
  fee_rate: number;
  fee_percent: number;
  fee_ngn: number | null;
  user_receives_ngn: number | null;
}

interface SogoDepositAddressResponse {
  id: string;
  asset: string;
  network: string;
  address: string;
  masked_address: string;
  destination_tag?: string;
  is_active: boolean;
}

function resolveBaseUrl(config: SogoCryptoConfig): string {
  const configured = config.baseUrl?.replace(/\/+$/, "");
  if (configured) {
    return configured.endsWith("/v1") ? configured : `${configured}/v1`;
  }
  return config.sandbox ? "https://sandbox.sogo.africa/v1" : "https://api.sogo.africa/v1";
}

export function createSogoCryptoAdapter(config: SogoCryptoConfig): CryptoSellProvider {
  const baseUrl = resolveBaseUrl(config);
  const f = config.fetcher ?? fetch;

  async function sogoGet(path: string): Promise<unknown> {
    const res = await f(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sogo ${path} returned HTTP ${res.status}: ${body}`);
    }
    return res.json();
  }

  return {
    name: "sogo",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "CRYPTO" as const,
    getCapabilities: () => cryptoCapabilities(config.webhookSecret ? "hmac_sha256" : "none"),

    verifyWebhookSignature(rawPayload, headers) {
      if (!config.webhookSecret) return false;
      const signatureHeader = headers["x-sogo-signature-256"] ?? headers["X-Sogo-Signature-256"];
      if (!signatureHeader) return false;

      const body = typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload);
      const expected = `sha256=${createHmac("sha256", config.webhookSecret).update(body).digest("hex")}`;
      const expectedBuf = Buffer.from(expected);
      const receivedBuf = Buffer.from(signatureHeader);
      if (expectedBuf.length !== receivedBuf.length) return false;
      return timingSafeEqual(expectedBuf, receivedBuf);
    },

    normalizeWebhook(rawPayload): CanonicalEvent {
      const payload = rawPayload as {
        id: string;
        event: string;
        created_at: string;
        data: { id: string; reference: string } & Record<string, unknown>;
      };
      return {
        eventType: payload.event,
        provider: "sogo",
        domain: "CRYPTO",
        providerEventId: payload.id,
        resourceId: payload.data.reference,
        occurredAt: payload.created_at,
        payload: payload.data
      };
    },

    async listAssets() {
      const body = (await sogoGet("/crypto/assets")) as { data: SogoCryptoAssetResponse[] };
      return body.data.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        networks: a.networks,
        defaultNetwork: a.default_network,
        minDepositUsd: a.min_deposit_usd,
        feeTiers: a.fee_tiers.map((t) => ({
          minUsd: t.min_usd,
          maxUsd: t.max_usd,
          feeRate: t.fee_rate,
          feePercent: t.fee_percent
        }))
      }));
    },

    async getEstimatedRate(asset, amount) {
      const body = (await sogoGet(
        `/crypto/assets/${encodeURIComponent(asset)}/rate?amount=${amount}`
      )) as { data: SogoCryptoRateResponse };
      const ngn = parseFloat(body.data.estimated_ngn);
      const fee = body.data.fee_ngn ?? 0;
      return {
        ngnAmountMinor: Math.round(ngn * 100),
        usdNgnRate: body.data.usd_ngn_rate,
        feeNgnMinor: Math.round(fee * 100)
      };
    },

    async getOrCreateDepositAddress(input) {
      const res = await f(`${baseUrl}/crypto/deposit-address`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "Idempotency-Key": input.idempotencyKey
        },
        body: JSON.stringify({ asset: input.asset, ...(input.network ? { network: input.network } : {}) })
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Sogo deposit-address returned HTTP ${res.status}: ${body}`);
      }

      const body = (await res.json()) as { data: SogoDepositAddressResponse };
      return {
        id: body.data.id,
        asset: body.data.asset,
        network: body.data.network,
        address: body.data.address,
        maskedAddress: body.data.masked_address,
        ...(body.data.destination_tag ? { destinationTag: body.data.destination_tag } : {}),
        isActive: body.data.is_active
      };
    },

    async simulateTestDeposit(input) {
      if (!config.sandbox) {
        throw new Error("simulateTestDeposit is sandbox-only.");
      }

      const res = await f(`${baseUrl}/crypto/test-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ test_reference: input.testReference })
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Sogo test-deposit returned HTTP ${res.status}: ${body}`);
      }

      const body = (await res.json()) as {
        data: { reference: string; status: string; tx_hash?: string | null };
      };
      return {
        providerReference: body.data.reference,
        status: body.data.status === "completed" ? "completed" : "pending",
        ...(body.data.tx_hash ? { txHash: body.data.tx_hash } : {})
      };
    },

    async checkHealth(): Promise<ProviderHealthSnapshot> {
      const start = Date.now();
      try {
        await sogoGet("/crypto/assets");
        return { providerName: "sogo", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "sogo",
          status: "DOWN",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "Sogo crypto health check failed"
        };
      }
    }
  };
}

export function createMockCryptoSellProvider(name = "mock-crypto"): CryptoSellProvider {
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "CRYPTO" as const,
    getCapabilities: () => cryptoCapabilities("none"),

    listAssets() {
      return Promise.resolve([
        {
          symbol: "btc",
          name: "Bitcoin",
          networks: ["bitcoin"],
          defaultNetwork: "bitcoin",
          minDepositUsd: 5,
          feeTiers: [{ minUsd: 0, maxUsd: null, feeRate: 0.019, feePercent: 1.9 }]
        }
      ]);
    },

    getEstimatedRate() {
      return Promise.resolve({ ngnAmountMinor: 150_000_00, usdNgnRate: 1500, feeNgnMinor: 2_850_00 });
    },

    getOrCreateDepositAddress(input) {
      return Promise.resolve({
        id: "mock-addr",
        asset: input.asset,
        network: input.network ?? "bitcoin",
        address: "MOCK-ADDRESS-DO-NOT-SEND-FUNDS",
        maskedAddress: "MOCK***FUNDS",
        isActive: true
      });
    },

    simulateTestDeposit(input) {
      return Promise.resolve({
        providerReference: `mock_${input.testReference}`,
        status: "completed",
        txHash: "0xmocktxhash"
      });
    },

    checkHealth() {
      return Promise.resolve({ providerName: name, status: "HEALTHY", latencyMs: 5 });
    }
  };
}
