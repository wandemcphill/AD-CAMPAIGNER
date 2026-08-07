// Telecom Gateway provider adapter contract + implementations.
//
// Unifies global airtime/data purchase behind one interface so the rest of the
// app never knows whether a request is being fulfilled by ClubKonnect (Nigeria)
// or Reloadly (everywhere else). New providers (DTOne, Thunes, BICS, MTN/Airtel
// direct) plug in by implementing TelecomProviderAdapter — no caller changes.

import {
  CURRENT_INTERFACE_VERSION,
  type ProviderAdapterBase,
  type ProviderCapabilities
} from './contract.js';
import {
  createClubKonnectAdapter,
  type ClubKonnectConfig,
  type VtuNetwork,
  type VtuProviderAdapter
} from './vtu.js';

// ─── Unified DTOs ───────────────────────────────────────────────────────────

export interface TelecomOperator {
  /** Opaque, provider-namespaced id (e.g. "clubkonnect:MTN", "reloadly:341"). */
  operatorId: string;
  name: string;
  countryIso: string;
  network?: string;
  currency: string;
  supportsAirtime: boolean;
  supportsData: boolean;
}

export interface TelecomAirtimeProduct {
  operatorId: string;
  minAmountMinor: number;
  maxAmountMinor: number;
  currency: string;
  discountBps?: number;
}

export interface TelecomDataBundle {
  operatorId: string;
  bundleId: string;
  displayName: string;
  sizeMb: number;
  validityDays: number;
  costMinor: number;
  currency: string;
}

export type TelecomTxnStatus = "DELIVERED" | "SUBMITTED" | "FAILED" | "AMBIGUOUS";

export interface TelecomPurchaseResponse {
  providerReference: string;
  status: TelecomTxnStatus;
  failureReason?: string;
}

export interface TelecomTransactionStatus {
  providerReference: string;
  status: TelecomTxnStatus;
  failureReason?: string;
}

export interface TelecomProviderBalance {
  providerName: string;
  balanceMinor: number;
  currency: string;
}

export interface TelecomNumberValidation {
  valid: boolean;
  operatorId?: string;
  operatorName?: string;
}

export function telecomCapabilities(countries: string[]): ProviderCapabilities {
  return {
    domain: 'VTU',
    countries,
    productTypes: ['AIRTIME', 'DATA'],
    reliability: { idempotency: 'weak', ordering: 'none', webhookSignature: 'none' }
  };
}

/**
 * Every telecom provider — ClubKonnect, Reloadly, and any future addition
 * (DTOne, Thunes, BICS, MTN/Airtel direct) — implements this exact shape.
 * Nothing above this layer ever sees a provider-native operator id, plan code,
 * or response payload; adapters own that translation.
 */
export interface TelecomProviderAdapter extends ProviderAdapterBase {
  getOperators(countryIso: string): Promise<TelecomOperator[]>;
  getAirtimeProducts(operatorId: string): Promise<TelecomAirtimeProduct[]>;
  getDataBundles(operatorId: string): Promise<TelecomDataBundle[]>;
  validateNumber(input: { msisdn: string; countryIso: string }): Promise<TelecomNumberValidation>;
  purchaseAirtime(input: {
    operatorId: string;
    msisdn: string;
    amountMinor: number;
    reference: string;
  }): Promise<TelecomPurchaseResponse>;
  purchaseData(input: {
    operatorId: string;
    msisdn: string;
    bundleId: string;
    reference: string;
  }): Promise<TelecomPurchaseResponse>;
  checkTransaction(reference: string): Promise<TelecomTransactionStatus>;
  getBalance(): Promise<TelecomProviderBalance>;
}

// ─── ClubKonnect adapter (Nigeria) ──────────────────────────────────────────
// Thin translation layer over the existing, already-verified ClubKonnect VTU
// adapter — no separate HTTP integration, just operatorId <-> VtuNetwork mapping.

const CK_NETWORKS: VtuNetwork[] = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
const CK_NETWORK_DISPLAY: Record<VtuNetwork, string> = {
  MTN: "MTN",
  GLO: "Glo",
  AIRTEL: "Airtel",
  NINE_MOBILE: "9mobile"
};

function ckOperatorId(network: VtuNetwork): string {
  return `clubkonnect:${network}`;
}

function ckNetworkFromOperatorId(operatorId: string): VtuNetwork {
  const network = operatorId.split(":")[1] as VtuNetwork | undefined;
  if (!network || !CK_NETWORKS.includes(network)) {
    throw new Error(`Unknown ClubKonnect operatorId: ${operatorId}`);
  }
  return network;
}

export function createClubKonnectTelecomAdapter(
  config: ClubKonnectConfig,
  underlying: VtuProviderAdapter = createClubKonnectAdapter(config)
): TelecomProviderAdapter {
  return {
    name: "clubkonnect",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => telecomCapabilities(["NG"]),
    checkHealth: () => underlying.checkHealth(),

    getOperators(countryIso) {
      if (countryIso.toUpperCase() !== "NG") return Promise.resolve([]);
      return Promise.resolve(
        CK_NETWORKS.map((network) => ({
          operatorId: ckOperatorId(network),
          name: CK_NETWORK_DISPLAY[network],
          countryIso: "NG",
          network,
          currency: "NGN",
          supportsAirtime: true,
          supportsData: true
        }))
      );
    },

    async getAirtimeProducts(operatorId) {
      const network = ckNetworkFromOperatorId(operatorId);
      const discountBps = await underlying.getAirtimeDiscountBps(network);
      return [
        {
          operatorId,
          minAmountMinor: 5_000, // ₦50
          maxAmountMinor: 50_000_000, // ₦500,000
          currency: "NGN",
          discountBps
        }
      ];
    },

    async getDataBundles(operatorId) {
      const network = ckNetworkFromOperatorId(operatorId);
      const plans = await underlying.listDataPlans(network);
      return plans.map((p) => ({
        operatorId,
        bundleId: p.providerPlanId,
        displayName: p.displayName,
        sizeMb: p.sizeMb,
        validityDays: p.validityDays,
        costMinor: p.costMinor,
        currency: p.currency
      }));
    },

    validateNumber({ msisdn, countryIso }) {
      const valid = countryIso.toUpperCase() === "NG" && /^\+?234\d{10}$/.test(msisdn.replace(/\s/g, ""));
      return Promise.resolve({ valid });
    },

    async purchaseAirtime({ operatorId, msisdn, amountMinor, reference }) {
      const network = ckNetworkFromOperatorId(operatorId);
      const result = await underlying.purchaseAirtime({
        network,
        msisdn,
        faceValueMinor: amountMinor,
        reference
      });
      return result;
    },

    async purchaseData({ operatorId, msisdn, bundleId, reference }) {
      const network = ckNetworkFromOperatorId(operatorId);
      const result = await underlying.purchaseData({
        network,
        msisdn,
        providerPlanId: bundleId,
        reference
      });
      return result;
    },

    async checkTransaction(reference) {
      const status = await underlying.getOrderStatus(reference);
      return status;
    },

    async getBalance() {
      const balance = await underlying.getBalance();
      return { providerName: "clubkonnect", balanceMinor: balance.balanceMinor, currency: balance.currency };
    }
  };
}

// ─── Reloadly adapter (rest of world) ───────────────────────────────────────
// OAuth2 client-credentials against auth.reloadly.com, then the Topups API.
// Sandbox host is topups-sandbox.reloadly.com — set baseUrl/authAudience accordingly
// per environment. Never logs client secret or raw access tokens.

export interface TelecomReloadlyConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string; // default https://topups.reloadly.com
  authUrl?: string; // default https://auth.reloadly.com/oauth/token
  audience?: string; // default https://topups.reloadly.com
  fetcher?: typeof fetch;
}

interface ReloadlyTokenCache {
  token: string;
  expiresAt: number;
}

async function reloadlyGetToken(
  config: TelecomReloadlyConfig,
  cache: { current?: ReloadlyTokenCache }
): Promise<string> {
  if (cache.current && cache.current.expiresAt > Date.now() + 30_000) {
    return cache.current.token;
  }

  const f = config.fetcher ?? fetch;
  const res = await f(config.authUrl ?? "https://auth.reloadly.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      audience: config.audience ?? config.baseUrl ?? "https://topups.reloadly.com"
    })
  });
  if (!res.ok) throw new Error(`Reloadly OAuth token request returned HTTP ${res.status}`);

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Reloadly OAuth response missing access_token");

  cache.current = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000
  };
  return cache.current.token;
}

async function reloadlyRequest(
  config: TelecomReloadlyConfig,
  cache: { current?: ReloadlyTokenCache },
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const token = await reloadlyGetToken(config, cache);
  const res = await f(`${config.baseUrl ?? "https://topups.reloadly.com"}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/com.reloadly.topups-v1+json",
      "content-type": "application/json"
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Reloadly ${method} ${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

interface ReloadlyOperator {
  operatorId?: number;
  name?: string;
  country?: { isoName?: string };
  denominationType?: string;
  senderCurrencyCode?: string;
  localCurrencyCode?: string;
  bundle?: boolean;
  data?: boolean;
  minAmount?: number;
  maxAmount?: number;
  localMinAmount?: number;
  localMaxAmount?: number;
  fixedAmounts?: number[];
  fixedAmountsDescriptions?: Record<string, string>;
}

function toMinor(amount: number | undefined): number {
  return Math.round((amount ?? 0) * 100);
}

function mapReloadlyOperator(op: ReloadlyOperator): TelecomOperator {
  const currency = op.localCurrencyCode ?? op.senderCurrencyCode ?? "USD";
  return {
    operatorId: `reloadly:${op.operatorId ?? ""}`,
    name: op.name ?? "Unknown operator",
    countryIso: (op.country?.isoName ?? "").toUpperCase(),
    currency,
    supportsAirtime: !op.data,
    supportsData: Boolean(op.data || op.bundle)
  };
}

function reloadlyOperatorIdFrom(operatorId: string): string {
  const raw = operatorId.split(":")[1];
  if (!raw) throw new Error(`Unknown Reloadly operatorId: ${operatorId}`);
  return raw;
}

function mapReloadlyTxnStatus(status?: string): TelecomTxnStatus {
  const s = (status ?? "").toUpperCase();
  if (s === "SUCCESSFUL") return "DELIVERED";
  if (s === "PENDING" || s === "PROCESSING") return "SUBMITTED";
  if (s === "FAILED" || s === "REFUNDED") return "FAILED";
  return "AMBIGUOUS";
}

export function createReloadlyTelecomAdapter(config: TelecomReloadlyConfig): TelecomProviderAdapter {
  const tokenCache: { current?: ReloadlyTokenCache } = {};
  const req = (method: "GET" | "POST", path: string, body?: Record<string, unknown>) =>
    reloadlyRequest(config, tokenCache, method, path, body);

  const submitTopup = async (
    operatorId: string,
    msisdn: string,
    amountMinor: number,
    reference: string
  ): Promise<TelecomPurchaseResponse> => {
    const raw = reloadlyOperatorIdFrom(operatorId);
    try {
      const res = (await req("POST", "/topups", {
        operatorId: Number(raw),
        amount: amountMinor / 100,
        useLocalAmount: true,
        customIdentifier: reference,
        recipientPhone: { countryCode: "", number: msisdn }
      })) as { transactionId?: number; status?: string; message?: string };

      if (!res.transactionId) {
        return {
          providerReference: reference,
          status: "FAILED",
          failureReason: res.message ?? "Reloadly topup returned no transactionId"
        };
      }

      return {
        providerReference: String(res.transactionId),
        status: mapReloadlyTxnStatus(res.status ?? "SUCCESSFUL")
      };
    } catch (err) {
      return {
        providerReference: reference,
        status: "FAILED",
        failureReason: err instanceof Error ? err.message : "Reloadly topup error"
      };
    }
  };

  return {
    name: "reloadly",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => telecomCapabilities([]), // no country restriction — Reloadly covers ~150 countries

    async checkHealth() {
      const start = Date.now();
      try {
        await req("GET", "/accounts/balance");
        return { providerName: "reloadly", status: "HEALTHY" as const, latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "reloadly",
          status: "DEGRADED" as const,
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "Reloadly health check failed"
        };
      }
    },

    async getOperators(countryIso) {
      const operators = (await req(
        "GET",
        `/operators/countries/${countryIso.toUpperCase()}`
      )) as ReloadlyOperator[];
      return (Array.isArray(operators) ? operators : []).map(mapReloadlyOperator);
    },

    async getAirtimeProducts(operatorId) {
      const raw = reloadlyOperatorIdFrom(operatorId);
      const op = (await req("GET", `/operators/${raw}`)) as ReloadlyOperator;
      const currency = op.localCurrencyCode ?? op.senderCurrencyCode ?? "USD";
      return [
        {
          operatorId,
          minAmountMinor: toMinor(op.localMinAmount ?? op.minAmount),
          maxAmountMinor: toMinor(op.localMaxAmount ?? op.maxAmount)
        }
      ].map((entry) => ({ ...entry, currency }));
    },

    async getDataBundles(operatorId) {
      const raw = reloadlyOperatorIdFrom(operatorId);
      const op = (await req("GET", `/operators/${raw}`)) as ReloadlyOperator;
      if (!op.data && !op.bundle) return [];

      const currency = op.localCurrencyCode ?? op.senderCurrencyCode ?? "USD";
      const amounts = op.fixedAmounts ?? [];
      const descriptions = op.fixedAmountsDescriptions ?? {};

      return amounts.map((amount) => ({
        operatorId,
        bundleId: String(amount),
        displayName: descriptions[String(amount)] ?? `${amount} ${currency} data bundle`,
        sizeMb: 0, // Reloadly does not expose parsed size — description carries the human-readable value
        validityDays: 30,
        costMinor: toMinor(amount),
        currency
      }));
    },

    async validateNumber({ msisdn, countryIso }) {
      try {
        const digits = msisdn.replace(/[^\d]/g, "");
        const op = (await req(
          "GET",
          `/operators/auto-detect/phone/${digits}/countries/${countryIso.toUpperCase()}`
        )) as ReloadlyOperator;
        if (!op.operatorId) return { valid: false };
        return { valid: true, operatorId: `reloadly:${op.operatorId}`, ...(op.name ? { operatorName: op.name } : {}) };
      } catch {
        return { valid: false };
      }
    },

    async purchaseAirtime({ operatorId, msisdn, amountMinor, reference }) {
      return submitTopup(operatorId, msisdn, amountMinor, reference);
    },

    async purchaseData({ operatorId, msisdn, bundleId, reference }) {
      // Reloadly data bundles are fixed-amount topups — bundleId is the amount (major units).
      const amountMinor = toMinor(Number(bundleId));
      return submitTopup(operatorId, msisdn, amountMinor, reference);
    },

    async checkTransaction(reference) {
      const res = (await req("GET", `/topups/${reference}/status`)) as {
        status?: string;
        message?: string;
      };
      return {
        providerReference: reference,
        status: mapReloadlyTxnStatus(res.status),
        ...(res.message ? { failureReason: res.message } : {})
      };
    },

    async getBalance() {
      const res = (await req("GET", "/accounts/balance")) as {
        balance?: number;
        currencyCode?: string;
      };
      return {
        providerName: "reloadly",
        balanceMinor: toMinor(res.balance),
        currency: res.currencyCode ?? "USD"
      };
    }
  };
}

// ─── Mock adapter (dev / tests / unconfigured environments) ────────────────

export function createMockTelecomAdapter(name = "mock-telecom"): TelecomProviderAdapter {
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => telecomCapabilities([]),
    checkHealth: () =>
      Promise.resolve({ providerName: name, status: "HEALTHY" as const, latencyMs: 5 }),

    getOperators(countryIso) {
      return Promise.resolve([
        {
          operatorId: `${name}:mock-op`,
          name: "Mock Operator",
          countryIso: countryIso.toUpperCase(),
          currency: "USD",
          supportsAirtime: true,
          supportsData: true
        }
      ]);
    },

    getAirtimeProducts(operatorId) {
      return Promise.resolve([
        { operatorId, minAmountMinor: 100, maxAmountMinor: 10_000_000, currency: "USD" }
      ]);
    },

    getDataBundles(operatorId) {
      return Promise.resolve([
        {
          operatorId,
          bundleId: "mock-1gb",
          displayName: "1GB (Mock)",
          sizeMb: 1024,
          validityDays: 30,
          costMinor: 500,
          currency: "USD"
        }
      ]);
    },

    validateNumber() {
      return Promise.resolve({ valid: true, operatorId: `${name}:mock-op`, operatorName: "Mock Operator" });
    },

    purchaseAirtime({ reference }) {
      return Promise.resolve({ providerReference: reference, status: "DELIVERED" as const });
    },

    purchaseData({ reference }) {
      return Promise.resolve({ providerReference: reference, status: "DELIVERED" as const });
    },

    checkTransaction(reference) {
      return Promise.resolve({ providerReference: reference, status: "DELIVERED" as const });
    },

    getBalance() {
      return Promise.resolve({ providerName: name, balanceMinor: 100_000_000, currency: "USD" });
    }
  };
}
