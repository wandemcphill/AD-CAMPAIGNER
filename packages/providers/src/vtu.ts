// VTU provider adapter contract + all adapter implementations.
// Each adapter takes a config struct and optional fetcher (for testability).
// None of them read env vars directly — callers inject credentials.

import {
  CURRENT_INTERFACE_VERSION,
  type ProviderAdapterBase,
  type ProviderCapabilities,
  type ProviderHealthSnapshot
} from './contract.js';

export type VtuNetwork = "MTN" | "GLO" | "AIRTEL" | "NINE_MOBILE";
export type VtuPlanType = "SME" | "CG" | "GIFTING" | "CORPORATE";

export interface VtuPlanOffer {
  providerPlanId: string;
  network: VtuNetwork;
  planType: VtuPlanType;
  displayName: string;
  sizeMb: number;
  validityDays: number;
  costMinor: number;
  currency: string;
}

export type VtuSubmitStatus = "DELIVERED" | "SUBMITTED" | "FAILED" | "AMBIGUOUS";

export interface VtuSubmitResult {
  providerReference: string;
  status: VtuSubmitStatus;
  failureReason?: string;
}

export interface VtuOrderSnapshot {
  providerReference: string;
  status: VtuSubmitStatus;
  failureReason?: string;
  // Present for electricity orders when status = DELIVERED
  token?: string;
  units?: string;
}

export interface VtuProviderBalance {
  providerName: string;
  balanceMinor: number;
  currency: string;
}

export type VtuHealthSnapshot = ProviderHealthSnapshot;

export const VTU_PRODUCT_TYPES = ['AIRTIME', 'DATA', 'CABLE', 'ELECTRICITY'] as const;
export type VtuCapabilityProduct = (typeof VTU_PRODUCT_TYPES)[number];

export function vtuCapabilities(
  idempotency: 'strong' | 'weak',
  productTypes: readonly string[] = VTU_PRODUCT_TYPES
): ProviderCapabilities {
  return {
    domain: 'VTU',
    countries: ['NG'],
    productTypes: [...productTypes],
    networks: ['MTN', 'AIRTEL', 'GLO', '9MOBILE'],
    reliability: { idempotency, ordering: 'none', webhookSignature: 'none' }
  };
}

// Optional methods for bills/cable (Phase 5) — designed now so the pipeline
// shape doesn't need to change when they're implemented.
export interface VtuMeterValidation {
  valid: boolean;
  customerName?: string;
  address?: string;
  minAmountMinor?: number;
}

export interface VtuCablePackageOffer {
  cableProvider: string;
  packageCode: string;
  displayName: string;
  costMinor: number;
  currency: string;
}

export interface VtuBettingCompanyOffer {
  productCode: string;
  displayName: string;
}

export interface VtuEducationPlanOffer {
  productCode: string;
  displayName: string;
  costMinor: number;
  currency: string;
}

/** A single printed recharge PIN — airtime or data EPIN, sealed and handed to the buyer. */
export interface VtuEpin {
  pin: string;
  serialNumber: string;
  batchNo?: string;
}

export interface VtuProviderAdapter extends ProviderAdapterBase {
  readonly domain: "VTU";

  /** Generate a provider-format reference for this order. Called once before submit; persisted. */
  buildReference(order: { id: string; createdAt: Date }): string;

  listDataPlans(network?: VtuNetwork): Promise<VtuPlanOffer[]>;
  getAirtimeDiscountBps(network: VtuNetwork): Promise<number>;
  purchaseAirtime(input: {
    network: VtuNetwork;
    msisdn: string;
    faceValueMinor: number;
    reference: string;
  }): Promise<VtuSubmitResult>;
  purchaseData(input: {
    network: VtuNetwork;
    msisdn: string;
    providerPlanId: string;
    reference: string;
  }): Promise<VtuSubmitResult>;
  getOrderStatus(reference: string): Promise<VtuOrderSnapshot>;
  getBalance(): Promise<VtuProviderBalance>;
  checkHealth(): Promise<VtuHealthSnapshot>;

  // Phase 5 — optional
  validateMeter?(input: {
    disco: string;
    meterNumber: string;
    meterType: "PREPAID" | "POSTPAID";
  }): Promise<VtuMeterValidation>;
  purchaseElectricity?(input: {
    disco: string;
    meterNumber: string;
    meterType: "PREPAID" | "POSTPAID";
    amountMinor: number;
    phoneNumber: string;
    reference: string;
  }): Promise<VtuSubmitResult & { token?: string; units?: string }>;
  verifyCableCustomer?(input: {
    provider: string;
    smartCardNumber: string;
  }): Promise<VtuMeterValidation>;
  listCablePackages?(): Promise<VtuCablePackageOffer[]>;
  purchaseCable?(input: {
    provider: string;
    smartCardNumber: string;
    packageCode: string;
    phoneNumber: string;
    reference: string;
  }): Promise<VtuSubmitResult>;

  verifyBettingCustomer?(input: {
    bettingCompany: string;
    customerId: string;
  }): Promise<VtuMeterValidation>;
  listBettingCompanies?(): Promise<VtuBettingCompanyOffer[]>;
  purchaseBetFunding?(input: {
    bettingCompany: string;
    customerId: string;
    amountMinor: number;
    reference: string;
  }): Promise<VtuSubmitResult>;

  verifyJambProfile?(input: { profileId: string }): Promise<VtuMeterValidation>;
  listEducationPlans?(): Promise<VtuEducationPlanOffer[]>;
  purchaseEducation?(input: {
    examType: string;
    phoneNumber: string;
    profileId?: string;
    reference: string;
  }): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }>;

  // EPIN (printed recharge PIN) — distinct from purchaseAirtime/purchaseData, which credit
  // a phone number directly. EPIN generates a PIN the buyer redeems themselves later
  // (dial *311*PIN# or enter at recharge); no msisdn is involved in the purchase call.
  purchaseAirtimeEpin?(input: {
    network: VtuNetwork;
    /** Face value in minor units. Provider-restricted set — see adapter docs. */
    valueMinor: number;
    quantity: number;
    reference: string;
  }): Promise<VtuSubmitResult & { epins?: VtuEpin[] }>;
  purchaseDataEpin?(input: {
    network: VtuNetwork;
    providerPlanId: string;
    quantity: number;
    reference: string;
  }): Promise<VtuSubmitResult & { epins?: VtuEpin[] }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

/** VTpass requires request_id in format YYYYMMDDHHII (Africa/Lagos time). */
function vtpassRequestId(orderId: string, createdAt: Date): string {
  // Derive YYYYMMDDHHII from createdAt in WAT (UTC+1).
  const wat = new Date(createdAt.getTime() + 60 * 60 * 1000);
  const datePart =
    wat.getUTCFullYear().toString() +
    pad2(wat.getUTCMonth() + 1) +
    pad2(wat.getUTCDate()) +
    pad2(wat.getUTCHours()) +
    pad2(wat.getUTCMinutes());
  // Append enough of the orderId to disambiguate same-minute orders.
  return datePart + orderId.replace(/-/g, "").slice(0, 8);
}

function networkToVtpassServiceId(network: VtuNetwork, kind: "airtime" | "data"): string {
  const base: Record<VtuNetwork, string> = {
    MTN: "mtn",
    GLO: "glo",
    AIRTEL: "airtel",
    NINE_MOBILE: "etisalat"
  };
  return kind === "airtime" ? `${base[network]}-airtime` : `${base[network]}-data`;
}

function mapVtpassStatus(status?: string): VtuSubmitStatus {
  const s = status?.toLowerCase() ?? "";
  if (s === "delivered" || s === "success" || s === "successful") return "DELIVERED";
  if (s === "initiated" || s === "pending" || s === "processing") return "SUBMITTED";
  if (s === "failed") return "FAILED";
  return "AMBIGUOUS";
}

// serviceID strings confirmed against VTpass's live per-DISCO documentation pages
// (vtpass.com/documentation/<disco>-.../, checked 2026-08-07), e.g.
// "Service ID as specified by VTpass. In this case, it is ikeja-electric". Keyed by
// the same 01-12 disco code space ClubKonnect's ElectricCompany param uses (see
// CK_ELECTRIC_COMPANIES below) since that's the disco identifier callers pass through
// this adapter's shared `disco` field.
const VTPASS_ELECTRIC_SERVICE_ID: Record<string, string> = {
  "01": "eko-electric",
  "02": "ikeja-electric",
  "03": "abuja-electric",
  "04": "kano-electric",
  "05": "portharcourt-electric",
  "06": "jos-electric",
  "07": "ibadan-electric",
  "08": "kaduna-electric",
  "09": "enugu-electric",
  "10": "benin-electric",
  "11": "yola-electric",
  "12": "aba-electric"
};

function vtpassElectricServiceId(disco: string): string {
  return VTPASS_ELECTRIC_SERVICE_ID[disco] ?? disco.toLowerCase();
}

// ─── VTpass adapter ───────────────────────────────────────────────────────────
// Use sandbox.vtpass.com for development/CI; vtpass.com for production.
// Auth: api-key header on all requests; public-key on GET, secret-key on POST.

export interface VtpassConfig {
  baseUrl?: string; // default https://sandbox.vtpass.com/api
  apiKey: string;
  publicKey: string;
  secretKey: string;
  fetcher?: typeof fetch;
}

async function vtpassGet(
  config: VtpassConfig,
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const url = new URL(`${config.baseUrl ?? "https://sandbox.vtpass.com/api"}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await f(url.toString(), {
    headers: {
      "api-key": config.apiKey,
      "public-key": config.publicKey
    }
  });
  if (!res.ok) throw new Error(`VTpass GET ${path} returned HTTP ${res.status}`);
  return res.json();
}

async function vtpassPost(
  config: VtpassConfig,
  path: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? "https://sandbox.vtpass.com/api"}${path}`, {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "secret-key": config.secretKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`VTpass POST ${path} returned HTTP ${res.status}`);
  return res.json();
}

export function createVtpassAdapter(config: VtpassConfig): VtuProviderAdapter {
  return {
    name: "vtpass",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities('strong', VTU_PRODUCT_TYPES),

    buildReference(order) {
      return vtpassRequestId(order.id, order.createdAt);
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const results: VtuPlanOffer[] = [];

      for (const net of networks) {
        const serviceId = networkToVtpassServiceId(net, "data");
        try {
          const data = (await vtpassGet(config, "/service-variations", {
            serviceID: serviceId
          })) as { content?: { varations?: Array<{
            variation_code?: string;
            name?: string;
            variation_amount?: string | number;
            fixedPrice?: string;
          }> } };

          for (const v of data?.content?.varations ?? []) {
            const code = v.variation_code ?? "";
            const name = v.name ?? code;
            const cost = Math.round(parseFloat(String(v.variation_amount ?? 0)) * 100);
            // Parse sizeMb and validityDays from the plan name heuristically.
            const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = name.match(/(\d+)\s*MB/i);
            const dayMatch = name.match(/(\d+)\s*day/i);
            const sizeMb = gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch
                ? parseInt(mbMatch[1]!)
                : 0;
            const validityDays = dayMatch ? parseInt(dayMatch[1]!) : 30;

            results.push({
              providerPlanId: code,
              network: net,
              planType: "SME",
              displayName: name,
              sizeMb,
              validityDays,
              costMinor: cost,
              currency: "NGN"
            });
          }
        } catch {
          // Skip networks that error; caller sees partial catalog.
        }
      }

      return results;
    },

    getAirtimeDiscountBps() {
      // VTpass airtime discount is ~3% (300 bps).
      // Actual discount visible only after a transaction; use published rate.
      return Promise.resolve(300);
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const body = {
        request_id: reference,
        serviceID: networkToVtpassServiceId(network, "airtime"),
        amount: (faceValueMinor / 100).toFixed(2),
        phone: msisdn
      };
      const res = (await vtpassPost(config, "/pay", body)) as {
        code?: string;
        content?: { transactions?: { status?: string; product_name?: string } };
        response_description?: string;
      };
      const status = res.content?.transactions?.status;
      const code = res.code ?? "";

      if (code === "000" || mapVtpassStatus(status) === "DELIVERED") {
        return { providerReference: reference, status: "DELIVERED" };
      }
      if (code === "099" || mapVtpassStatus(status) === "SUBMITTED") {
        return { providerReference: reference, status: "SUBMITTED" };
      }
      return {
        providerReference: reference,
        status: "FAILED",
        failureReason: res.response_description ?? status ?? "VTpass payment failed"
      };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const body = {
        request_id: reference,
        serviceID: networkToVtpassServiceId(network, "data"),
        billersCode: msisdn,
        variation_code: providerPlanId,
        phone: msisdn,
        // amount omitted — VTpass derives it from the variation
      };
      const res = (await vtpassPost(config, "/pay", body)) as {
        code?: string;
        content?: { transactions?: { status?: string } };
        response_description?: string;
      };
      const status = res.content?.transactions?.status;
      const code = res.code ?? "";

      if (code === "000" || mapVtpassStatus(status) === "DELIVERED") {
        return { providerReference: reference, status: "DELIVERED" };
      }
      if (code === "099" || mapVtpassStatus(status) === "SUBMITTED") {
        return { providerReference: reference, status: "SUBMITTED" };
      }
      return {
        providerReference: reference,
        status: "FAILED",
        failureReason: res.response_description ?? status ?? "VTpass payment failed"
      };
    },

    async getOrderStatus(reference) {
      const res = (await vtpassPost(config, "/requery", {
        request_id: reference
      })) as {
        code?: string;
        content?: { transactions?: { status?: string } };
        response_description?: string;
      };
      const status = res.content?.transactions?.status;
      return {
        providerReference: reference,
        status: mapVtpassStatus(status),
        ...(res.response_description ? { failureReason: res.response_description } : {})
      };
    },

    async getBalance() {
      // Response wrapper key is "contents" (plural) — confirmed against VTpass docs
      // (vtpass.com/documentation/get-vtpass-wallet-balance/, checked 2026-08-07):
      // { "code":1, "contents":{ "balance":1081.82 } }. Was previously read from
      // "data.balance", which VTpass's /balance response never populates.
      const res = (await vtpassGet(config, "/balance")) as {
        contents?: { balance?: string | number }
      };
      const raw = res?.contents?.balance ?? 0;
      return {
        providerName: "vtpass",
        balanceMinor: Math.round(parseFloat(String(raw)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await vtpassGet(config, "/balance");
        return {
          providerName: "vtpass",
          status: "HEALTHY",
          latencyMs: Date.now() - start
        };
      } catch (err) {
        return {
          providerName: "vtpass",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "VTpass health check failed"
        };
      }
    },

    // Phase 5 — Bills & Cable

    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        // Endpoint confirmed as POST /merchant-verify (not /bills/validate, which
        // doesn't exist in VTpass's API) — see e.g. vtpass.com/documentation/
        // gotv-subscription-api/ and .../ikedc-.../ (checked 2026-08-07): "billersCode
        // (Mandatory) ... serviceID (Mandatory) ... type (Mandatory, prepaid/postpaid)".
        const res = (await vtpassPost(config, "/merchant-verify", {
          serviceID: vtpassElectricServiceId(input.disco),
          billersCode: input.meterNumber,
          type: input.meterType === "PREPAID" ? "prepaid" : "postpaid"
        })) as {
          code?: string;
          content?: {
            customer_name?: string;
            address?: string;
            minimum_amount?: string | number;
          };
          response_description?: string;
        };

        if (res.code === "000") {
          const result: VtuMeterValidation = { valid: true };
          if (res.content?.customer_name) result.customerName = res.content.customer_name;
          if (res.content?.address) result.address = res.content.address;
          if (res.content?.minimum_amount) {
            result.minAmountMinor = Math.round(parseFloat(String(res.content.minimum_amount)) * 100);
          }
          return result;
        }

        return { valid: false };
      } catch {
        return { valid: false };
      }
    },

    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      // /pay body fields confirmed against vtpass.com/documentation/ikedc-.../
      // (checked 2026-08-07): request_id, serviceID, billersCode, variation_code
      // (prepaid/postpaid — NOT "type", which is only used by /merchant-verify),
      // amount, phone. There is no "quantity" field for electricity purchases; the
      // old body sent the meter number as "quantity", which the docs don't document.
      const body = {
        request_id: input.reference,
        serviceID: vtpassElectricServiceId(input.disco),
        billersCode: input.meterNumber,
        variation_code: input.meterType === "PREPAID" ? "prepaid" : "postpaid",
        amount: (input.amountMinor / 100).toFixed(2),
        phone: input.phoneNumber
      };

      try {
        const res = (await vtpassPost(config, "/pay", body)) as {
          code?: string;
          content?: {
            transactions?: {
              status?: string;
              token?: string;
              units?: string;
            };
          };
          response_description?: string;
        };

        const status = res.content?.transactions?.status;
        const code = res.code ?? "";

        if (code === "000" || mapVtpassStatus(status) === "DELIVERED") {
          const result: VtuSubmitResult & { token?: string; units?: string } = {
            providerReference: input.reference,
            status: "DELIVERED" as const
          };
          if (res.content?.transactions?.token) result.token = res.content.transactions.token;
          if (res.content?.transactions?.units) result.units = res.content.transactions.units;
          return result;
        }

        if (code === "099" || mapVtpassStatus(status) === "SUBMITTED") {
          const result: VtuSubmitResult & { token?: string; units?: string } = {
            providerReference: input.reference,
            status: "SUBMITTED" as const
          };
          if (res.content?.transactions?.token) result.token = res.content.transactions.token;
          return result;
        }

        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: res.response_description ?? "Electricity purchase failed"
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Electricity purchase error"
        };
      }
    },

    async purchaseCable(input): Promise<VtuSubmitResult> {
      try {
        // serviceID is lowercase (dstv/gotv/startimes/showmax) — confirmed against
        // vtpass.com/documentation/{dstv,gotv,startimes,showmax}-subscription-api/
        // (checked 2026-08-07), e.g. "https://vtpass.com/api/service-variations?
        // serviceID=gotv". input.provider already carries this lowercase slug (same
        // convention as ClubKonnect's CK_CABLE_PROVIDER_KEY keys) — uppercasing it
        // produced an invalid serviceID.
        const res = (await vtpassPost(config, "/pay", {
          request_id: input.reference,
          serviceID: input.provider.toLowerCase(),
          billersCode: input.smartCardNumber,
          variation_code: input.packageCode,
          phone: input.phoneNumber
        })) as {
          code?: string;
          content?: { transactions?: { status?: string } };
          response_description?: string;
        };

        const status = res.content?.transactions?.status;
        const code = res.code ?? "";

        if (code === "000" || mapVtpassStatus(status) === "DELIVERED") {
          return { providerReference: input.reference, status: "DELIVERED" as const };
        }

        if (code === "099" || mapVtpassStatus(status) === "SUBMITTED") {
          return { providerReference: input.reference, status: "SUBMITTED" as const };
        }

        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: res.response_description ?? "Cable subscription failed"
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Cable subscription error"
        };
      }
    }
  };
}

// ─── ClubKonnect (Nellobyte) adapter ──────────────────────────────────────────
// HTTPS GET only, UserID + APIKey in query string — never log raw URLs.
// Endpoints, param names, and response shapes below are verified against a live
// funded account on 2026-08-05 (https://www.nellobytesystems.com API docs + live
// discovery-endpoint calls). No sandbox exists — this always hits production.

export interface ClubKonnectConfig {
  userId: string;
  apiKey: string;
  baseUrl?: string | undefined; // default https://www.nellobytesystems.com
  callbackUrl?: string | undefined;
  fetcher?: typeof fetch;
}

// Confirmed via /APIAirtimeNetworkV2.asp and /APIDatabundleNetworkV2.asp — NOT the
// generic 01=MTN/02=GLO/03=AIRTEL/04=9MOBILE convention other providers use.
const CK_NETWORK: Record<VtuNetwork, string> = {
  MTN: "01",
  GLO: "02",
  NINE_MOBILE: "03", // listed as "t2mobile" in ClubKonnect's own network table
  AIRTEL: "04"
};

// Data plan discovery groups plans under these exact keys (APIDatabundlePlansV2.asp).
const CK_DATA_NETWORK_KEY: Record<VtuNetwork, string> = {
  MTN: "MTN",
  GLO: "Glo",
  NINE_MOBILE: "m_9mobile",
  AIRTEL: "Airtel"
};

// Fixed disco table from /APIElectricityTypeV2.asp — stable enough to hardcode;
// codes are what ElectricCompany expects, not slugs.
export const CK_ELECTRIC_COMPANIES: Array<{ code: string; name: string }> = [
  { code: "01", name: "Eko Electric (EKEDC)" },
  { code: "02", name: "Ikeja Electric (IKEDC)" },
  { code: "03", name: "Abuja Electric (AEDC)" },
  { code: "04", name: "Kano Electric (KEDC)" },
  { code: "05", name: "Port Harcourt Electric (PHEDC)" },
  { code: "06", name: "Jos Electric (JEDC)" },
  { code: "07", name: "Ibadan Electric (IBEDC)" },
  { code: "08", name: "Kaduna Electric (KAEDC)" },
  { code: "09", name: "Enugu Electric (EEDC)" },
  { code: "10", name: "Benin Electric (BEDC)" },
  { code: "11", name: "Yola Electric (YEDC)" },
  { code: "12", name: "Aba Electric (APLE)" }
];

const CK_CABLE_PROVIDER_KEY: Record<string, string> = {
  dstv: "DStv",
  gotv: "GOtv",
  startimes: "Startimes",
  showmax: "Showmax"
};

// PRODUCT_CODE values verified via /APIBettingTypeV2.asp against the live account on
// 2026-08-06 (ported from vtu.service.ts's former hardcoded BETTING_COMPANIES table).
// Used as the fallback reference table when the live list endpoint above doesn't return
// a usable response.
const CK_BETTING_COMPANIES: VtuBettingCompanyOffer[] = [
  { productCode: "product-nairabet", displayName: "NairaBet" },
  { productCode: "product-bang-bet", displayName: "BangBet" },
  { productCode: "product-bet-way", displayName: "BetWay" },
  { productCode: "product-bet-land", displayName: "BetLand" },
  { productCode: "product-bet-king", displayName: "BetKing" },
  { productCode: "product-1x-bet", displayName: "1xBet" },
  { productCode: "product-naija-bet", displayName: "NaijaBet" },
  { productCode: "prd-sporty-bet", displayName: "Sporty Bet" },
  { productCode: "product-merry-bet", displayName: "MerryBet" }
];

// Verified via /APIWAECPackagesV2.asp (2026-08-06). JAMB exam types come back empty
// from /APIJAMBPackagesV2.asp at this account tier — intentionally omitted.
const CK_EDUCATION_PLANS: VtuEducationPlanOffer[] = [
  { productCode: "waecdirect", displayName: "WAEC Result Checker PIN", costMinor: 535000, currency: "NGN" },
  { productCode: "waec-registraion", displayName: "WAEC Registration PIN", costMinor: 3750000, currency: "NGN" }
];

function ckScrubUrl(url: string): string {
  // Strip APIKey and UserID before the URL reaches any log/trace.
  return url.replace(/([?&])(APIKey|UserID)=[^&]*/gi, "$1$2=***");
}

async function ckGet(
  config: ClubKonnectConfig,
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? "https://www.nellobytesystems.com";
  const url = new URL(`${base}${path}`);
  url.searchParams.set("UserID", config.userId);
  url.searchParams.set("APIKey", config.apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await f(url.toString());
  if (!res.ok) {
    throw new Error(`ClubKonnect ${ckScrubUrl(path)} returned HTTP ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Business status codes are authoritative — the "status" string alone is NOT enough
// to classify an order. ClubKonnect groups multiple, materially different outcomes
// under the same status string: e.g. statusCode 200 ("Success") and 201 ("Network
// Unresponsive", auto-retried up to 1hr, not yet delivered) and 299 ("Unspecified
// Error") all report status="ORDER_COMPLETED". Classifying on status alone would
// mark network-unresponsive holds as DELIVERED. Verified against ClubKonnect's
// "API Status Codes & Dispute Resolution Guide" (2026-08-06).
function mapCkOutcome(statusCode?: string | number, status?: string): VtuSubmitStatus {
  const code = Number(statusCode);

  if (Number.isFinite(code) && code > 0) {
    if (code === 200) return "DELIVERED";
    if (code === 100 || code === 300) return "SUBMITTED";
    // 201 (network unresponsive, provider auto-retries up to 1hr) also belongs here —
    // not delivered yet, but not a hard failure either; our own poll job re-checks.
    if (code === 201 || code === 199 || code === 399 || code === 299) return "AMBIGUOUS";
    if (code >= 400 && code <= 499) return "FAILED";
    // ORDER_ONHOLD range: 602 explicitly means "credited back for failed txn" — terminal
    // failure. The rest are non-terminal holds ClubKonnect retries automatically.
    if (code === 602) return "FAILED";
    if (code >= 600 && code <= 699) return "SUBMITTED";
    if (code >= 500 && code <= 599) return "FAILED";
  }

  // Fallback when statusCode is absent (older/undocumented responses) — string-only.
  const s = (status ?? "").toUpperCase();
  if (s === "ORDER_RECEIVED" || s === "ORDER_PROCESSED" || s === "ORDER_ONHOLD") return "SUBMITTED";
  if (s === "ORDER_COMPLETED") return "DELIVERED";
  if (s === "ORDER_CANCELLED" || s === "ORDER_ERROR") return "FAILED";
  return "AMBIGUOUS";
}

function ckOutcome(
  res: { status?: string; statuscode?: string | number; remark?: string; orderid?: string | number },
  reference: string
): VtuSubmitResult {
  const status = mapCkOutcome(res.statuscode, res.status);
  if (status === "FAILED") {
    return {
      providerReference: reference,
      status: "FAILED",
      failureReason: res.remark ?? res.status ?? "ClubKonnect request failed"
    };
  }
  return { providerReference: reference, status };
}

export function createClubKonnectAdapter(config: ClubKonnectConfig): VtuProviderAdapter {
  return {
    name: "clubkonnect",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities("weak", ["AIRTIME", "DATA", "ELECTRICITY", "CABLE"]),

    buildReference(order) {
      // CK accepts any alphanumeric RequestID up to 20 chars.
      return `CK${order.id.replace(/-/g, "").slice(0, 18).toUpperCase()}`;
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const res = (await ckGet(config, "/APIDatabundlePlansV2.asp", {})) as {
        MOBILE_NETWORK?: Record<
          string,
          Array<{
            PRODUCT_ID?: string;
            PRODUCT_NAME?: string;
            PRODUCT_AMOUNT?: string | number;
          }>
        >;
      };
      const byNetwork = res.MOBILE_NETWORK ?? {};
      const results: VtuPlanOffer[] = [];

      for (const net of networks) {
        const plans = byNetwork[CK_DATA_NETWORK_KEY[net]] ?? [];

        for (const p of plans) {
          const name = p.PRODUCT_NAME ?? String(p.PRODUCT_ID ?? "");
          const cost = Math.round(parseFloat(String(p.PRODUCT_AMOUNT ?? 0)) * 100);
          const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
          const mbMatch = name.match(/(\d+)\s*MB/i);
          const dayMatch = name.match(/(\d+)\s*day/i);
          const sizeMb = gbMatch
            ? Math.round(parseFloat(gbMatch[1]!) * 1024)
            : mbMatch
              ? parseInt(mbMatch[1]!)
              : 0;
          const validityDays = dayMatch ? parseInt(dayMatch[1]!) : 30;
          const planType: VtuPlanType = /gifting/i.test(name)
            ? "GIFTING"
            : /\bcg\b/i.test(name)
              ? "CG"
              : "SME";

          if (!p.PRODUCT_ID || cost <= 0) continue;

          results.push({
            providerPlanId: String(p.PRODUCT_ID),
            network: net,
            planType,
            displayName: name,
            sizeMb,
            validityDays,
            costMinor: cost,
            currency: "NGN"
          });
        }
      }

      return results;
    },

    getAirtimeDiscountBps(network) {
      // Confirmed discount rates from /APIAirtimeNetworkV2.asp (2026-08-05):
      // MTN 3%, Glo 8%, t2mobile/9mobile 7%, Airtel 3%.
      const bps: Record<VtuNetwork, number> = {
        MTN: 300,
        GLO: 800,
        NINE_MOBILE: 700,
        AIRTEL: 300
      };
      return Promise.resolve(bps[network]);
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const amount = (faceValueMinor / 100).toFixed(2);
      const params: Record<string, string> = {
        MobileNetwork: CK_NETWORK[network],
        Amount: amount,
        MobileNumber: msisdn,
        RequestID: reference,
        ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
      };
      const res = (await ckGet(config, "/APIAirtimeV1.asp", params)) as {
        status?: string;
        statuscode?: string | number;
        remark?: string;
        orderid?: string | number;
      };
      return ckOutcome(res, reference);
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const params: Record<string, string> = {
        MobileNetwork: CK_NETWORK[network],
        DataPlan: providerPlanId,
        MobileNumber: msisdn,
        RequestID: reference,
        ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
      };
      const res = (await ckGet(config, "/APIDatabundleV1.asp", params)) as {
        status?: string;
        statuscode?: string | number;
        remark?: string;
        orderid?: string | number;
      };
      return ckOutcome(res, reference);
    },

    async getOrderStatus(reference) {
      const res = (await ckGet(config, "/APIQueryV1.asp", {
        RequestID: reference
      })) as { status?: string; statuscode?: string | number; remark?: string };

      const outcome = ckOutcome(res, reference);
      return {
        providerReference: reference,
        status: outcome.status,
        ...(outcome.failureReason ? { failureReason: outcome.failureReason } : {})
      };
    },

    async getBalance() {
      const res = (await ckGet(config, "/APIWalletBalanceV1.asp", {})) as {
        balance?: string | number;
      };
      return {
        providerName: "clubkonnect",
        balanceMinor: Math.round(parseFloat(String(res.balance ?? 0)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        // Side-effect-free connectivity probe — this endpoint only requires UserID.
        await ckGet(config, "/APIAirtimeNetworkV2.asp", {});
        return { providerName: "clubkonnect", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "clubkonnect",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "ClubKonnect health check failed"
        };
      }
    },

    // ─── Bills & Cable ──────────────────────────────────────────────────────────

    async validateMeter(input): Promise<VtuMeterValidation> {
      const res = (await ckGet(config, "/APIVerifyElectricityV1.asp", {
        ElectricCompany: input.disco,
        MeterNo: input.meterNumber,
        MeterType: input.meterType === "PREPAID" ? "01" : "02"
      })) as { customer_name?: string };

      const name = res.customer_name ?? "";
      if (!name || name.toUpperCase().includes("INVALID")) {
        return { valid: false };
      }
      return { valid: true, customerName: name };
    },

    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      try {
        const res = (await ckGet(config, "/APIElectricityV1.asp", {
          ElectricCompany: input.disco,
          MeterType: input.meterType === "PREPAID" ? "01" : "02",
          MeterNo: input.meterNumber,
          Amount: (input.amountMinor / 100).toFixed(2),
          PhoneNo: input.phoneNumber,
          RequestID: input.reference,
          ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
        })) as {
          status?: string;
          statuscode?: string | number;
          remark?: string;
          orderid?: string | number;
          metertoken?: string;
        };

        const outcome = ckOutcome(res, input.reference);
        return res.metertoken ? { ...outcome, token: res.metertoken } : outcome;
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Electricity purchase error"
        };
      }
    },

    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      const res = (await ckGet(config, "/APIVerifyCableTVV1.asp", {
        CableTV: input.provider,
        SmartCardNo: input.smartCardNumber
      })) as { customer_name?: string };

      const name = res.customer_name ?? "";
      if (!name || name.toUpperCase().includes("INVALID")) {
        return { valid: false };
      }
      return { valid: true, customerName: name };
    },

    async listCablePackages(): Promise<VtuCablePackageOffer[]> {
      const res = (await ckGet(config, "/APICableTVPackagesV2.asp", {})) as Record<
        string,
        Array<{
          PRODUCT?: Array<{
            PACKAGE_ID?: string;
            PACKAGE_NAME?: string;
            PACKAGE_AMOUNT?: string | number;
          }>;
        }>
      >;
      const offers: VtuCablePackageOffer[] = [];

      for (const [cableProvider, providerKey] of Object.entries(CK_CABLE_PROVIDER_KEY)) {
        const entries = res[providerKey] ?? [];
        for (const entry of entries) {
          for (const pkg of entry.PRODUCT ?? []) {
            if (!pkg.PACKAGE_ID) continue;
            offers.push({
              cableProvider,
              packageCode: pkg.PACKAGE_ID,
              displayName: pkg.PACKAGE_NAME ?? pkg.PACKAGE_ID,
              costMinor: Math.round(parseFloat(String(pkg.PACKAGE_AMOUNT ?? 0)) * 100),
              currency: "NGN"
            });
          }
        }
      }

      return offers;
    },

    async purchaseCable(input): Promise<VtuSubmitResult> {
      try {
        const res = (await ckGet(config, "/APICableTVV1.asp", {
          CableTV: input.provider,
          Package: input.packageCode,
          SmartCardNo: input.smartCardNumber,
          PhoneNo: input.phoneNumber,
          RequestID: input.reference,
          ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
        })) as {
          status?: string;
          statuscode?: string | number;
          remark?: string;
          orderid?: string | number;
        };

        return ckOutcome(res, input.reference);
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Cable subscription error"
        };
      }
    },

    // ─── Betting & Education ─────────────────────────────────────────────────────

    // /APIBettingTypeV2.asp is confirmed against ClubKonnect's live API docs
    // (clubkonnect.com/APIParaGetBettingV1.asp, checked 2026-08-07): "You can fetch the
    // current list of betting companies in JSON using: .../APIBettingTypeV2.asp?UserID=".
    // The exact JSON response shape (PRODUCT_CODE/PRODUCT_NAME field names, top-level
    // array vs. keyed object) is still an inference from the sibling cable/data endpoints'
    // shape, not verified by a live call in this environment — if parsing fails, this
    // falls back to the static reference table below (same codes previously hardcoded
    // in vtu.service.ts).
    async listBettingCompanies(): Promise<VtuBettingCompanyOffer[]> {
      try {
        const res = (await ckGet(config, "/APIBettingTypeV2.asp", {})) as
          | Record<string, Array<{ PRODUCT_CODE?: string; PRODUCT_NAME?: string }>>
          | Array<{ PRODUCT_CODE?: string; PRODUCT_NAME?: string }>;

        const entries = Array.isArray(res) ? res : (res["BETTING"] ?? res["betting"] ?? []);
        const offers: VtuBettingCompanyOffer[] = [];
        for (const entry of entries ?? []) {
          if (!entry.PRODUCT_CODE) continue;
          offers.push({
            productCode: entry.PRODUCT_CODE,
            displayName: entry.PRODUCT_NAME ?? entry.PRODUCT_CODE
          });
        }
        if (offers.length > 0) return offers;
      } catch {
        // fall through to static reference table
      }

      // Static reference table — ClubKonnect PRODUCT_CODE values verified against the
      // live account on 2026-08-06 (see historical comment in vtu.service.ts). Used as
      // a fallback when the live catalog endpoint above is unavailable or unconfirmed.
      return CK_BETTING_COMPANIES;
    },

    async verifyBettingCustomer(input): Promise<VtuMeterValidation> {
      const res = (await ckGet(config, "/APIVerifyBettingV1.asp", {
        BettingCompany: input.bettingCompany,
        CustomerID: input.customerId
      })) as { customer_name?: string };

      const name = res.customer_name ?? "";
      if (!name || name.toUpperCase().includes("INVALID") || name.toUpperCase().includes("ERROR")) {
        return { valid: false };
      }
      return { valid: true, customerName: name };
    },

    async purchaseBetFunding(input): Promise<VtuSubmitResult> {
      try {
        const res = (await ckGet(config, "/APIBettingV1.asp", {
          BettingCompany: input.bettingCompany,
          CustomerID: input.customerId,
          Amount: (input.amountMinor / 100).toFixed(2),
          RequestID: input.reference,
          ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
        })) as {
          status?: string;
          statuscode?: string | number;
          remark?: string;
          orderid?: string | number;
        };

        return ckOutcome(res, input.reference);
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Bet funding error"
        };
      }
    },

    // /APIWAECPackagesV2.asp is confirmed against ClubKonnect's live API docs
    // (clubkonnect.com/APIParaGetWAECV1.asp, checked 2026-08-07): "Use this endpoint to
    // retrieve supported ExamType values in JSON: APIWAECPackagesV2.asp". Same response-shape
    // caveat as listBettingCompanies above — field names are inferred, not verified live.
    // Falls back to the static reference table (JAMB intentionally omitted — see historical
    // comment: JAMB ExamType list comes back empty at this account tier).
    async listEducationPlans(): Promise<VtuEducationPlanOffer[]> {
      try {
        const res = (await ckGet(config, "/APIWAECPackagesV2.asp", {})) as
          | Record<string, Array<{ PRODUCT_CODE?: string; PRODUCT_NAME?: string; PRODUCT_AMOUNT?: string | number }>>
          | Array<{ PRODUCT_CODE?: string; PRODUCT_NAME?: string; PRODUCT_AMOUNT?: string | number }>;

        const entries = Array.isArray(res) ? res : (res["WAEC"] ?? res["waec"] ?? []);
        const offers: VtuEducationPlanOffer[] = [];
        for (const entry of entries ?? []) {
          if (!entry.PRODUCT_CODE) continue;
          offers.push({
            productCode: entry.PRODUCT_CODE,
            displayName: entry.PRODUCT_NAME ?? entry.PRODUCT_CODE,
            costMinor: Math.round(parseFloat(String(entry.PRODUCT_AMOUNT ?? 0)) * 100),
            currency: "NGN"
          });
        }
        if (offers.length > 0) return offers;
      } catch {
        // fall through to static reference table
      }

      return CK_EDUCATION_PLANS;
    },

    async verifyJambProfile(input): Promise<VtuMeterValidation> {
      const res = (await ckGet(config, "/APIVerifyJAMBV1.asp", {
        ExamType: "jamb",
        ProfileID: input.profileId
      })) as { customer_name?: string };

      const name = res.customer_name ?? "";
      if (!name || name.toUpperCase().includes("INVALID") || name.toUpperCase().includes("ERROR")) {
        return { valid: false };
      }
      return { valid: true, customerName: name };
    },

    async purchaseEducation(input): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }> {
      try {
        // WAEC and JAMB share the same request shape (ExamType + PhoneNo) but different
        // endpoints — dispatch on the exam type prefix rather than a separate flag.
        const isJamb = input.examType === "de" || input.examType.startsWith("utme");
        const path = isJamb ? "/APIJAMBV1.asp" : "/APIWAECV1.asp";

        const res = (await ckGet(config, path, {
          ExamType: input.examType,
          PhoneNo: input.phoneNumber,
          RequestID: input.reference,
          ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
        })) as {
          status?: string;
          statuscode?: string | number;
          remark?: string;
          orderid?: string | number;
          carddetails?: string;
        };

        const outcome = ckOutcome(res, input.reference);
        if (!res.carddetails) return outcome;

        // carddetails looks like "Serial No:WRN200343867, pin: 572871474684".
        const serialMatch = res.carddetails.match(/Serial No\s*:\s*([^\s,]+)/i);
        const pinMatch = res.carddetails.match(/pin\s*:\s*([^\s,]+)/i);
        return {
          ...outcome,
          ...(serialMatch ? { serialNumber: serialMatch[1] } : {}),
          ...(pinMatch ? { pin: pinMatch[1] } : {})
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Education purchase error"
        };
      }
    },

    // ─── EPIN (printed airtime / data recharge PINs) ────────────────────────────
    // /APIEPINV1.asp and /APIDatabundleEPINV1.asp — separate product family from the
    // direct-recharge endpoints above. Response is synchronous JSON with a TXN_EPIN /
    // TXN_EPIN_DATABUNDLE array (one entry per unit of `quantity`), each carrying its
    // own `pin` + `sno` (serial number). No msisdn/CallBackURL round-trip is needed —
    // the PIN itself is the deliverable, not a credited phone number.

    async purchaseAirtimeEpin(input): Promise<VtuSubmitResult & { epins?: VtuEpin[] }> {
      const allowedValues = new Set([10_000, 20_000, 50_000]); // ₦100 / ₦200 / ₦500 in kobo
      if (!allowedValues.has(input.valueMinor)) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: "ClubKonnect airtime EPIN value must be ₦100, ₦200, or ₦500."
        };
      }

      try {
        const res = (await ckGet(config, "/APIEPINV1.asp", {
          MobileNetwork: CK_NETWORK[input.network],
          Value: (input.valueMinor / 100).toFixed(0),
          Quantity: String(input.quantity),
          RequestID: input.reference,
          ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
        })) as {
          TXN_EPIN?: Array<{ pin?: string; sno?: string; batchno?: string; transactionid?: string }>;
          status?: string;
          statuscode?: string | number;
          remark?: string;
        };

        const rows = res.TXN_EPIN ?? [];
        if (rows.length === 0) {
          const outcome = ckOutcome(
            {
              ...(res.status !== undefined ? { status: res.status } : {}),
              ...(res.statuscode !== undefined ? { statuscode: res.statuscode } : {}),
              ...(res.remark !== undefined ? { remark: res.remark } : {})
            },
            input.reference
          );
          return outcome.status === "DELIVERED"
            ? { ...outcome, status: "FAILED" as const, failureReason: "No EPINs returned." }
            : outcome;
        }

        const epins: VtuEpin[] = rows
          .filter((r) => r.pin && r.sno)
          .map((r) => ({
            pin: r.pin!,
            serialNumber: r.sno!,
            ...(r.batchno ? { batchNo: r.batchno } : {})
          }));

        if (epins.length === 0) {
          return {
            providerReference: input.reference,
            status: "FAILED" as const,
            failureReason: "ClubKonnect returned EPIN rows without a pin/serial."
          };
        }

        return { providerReference: input.reference, status: "DELIVERED" as const, epins };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Airtime EPIN purchase error"
        };
      }
    },

    async purchaseDataEpin(input): Promise<VtuSubmitResult & { epins?: VtuEpin[] }> {
      try {
        const res = (await ckGet(config, "/APIDatabundleEPINV1.asp", {
          MobileNetwork: CK_NETWORK[input.network],
          DataPlan: input.providerPlanId,
          Quantity: String(input.quantity),
          RequestID: input.reference,
          ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
        })) as {
          TXN_EPIN_DATABUNDLE?: Array<{ pin?: string; sno?: string; batchno?: string; transactionid?: string }>;
          orderid?: string | number;
          status?: string;
          statuscode?: string | number;
          remark?: string;
        };

        const rows = res.TXN_EPIN_DATABUNDLE ?? [];
        if (rows.length === 0) {
          // Databundle EPIN can respond ORDER_RECEIVED (queued) before rows are ready —
          // caller should poll getOrderStatus(reference) in that case, same as other
          // asynchronous ClubKonnect products.
          const outcome = ckOutcome(
            {
              ...(res.status !== undefined ? { status: res.status } : {}),
              ...(res.statuscode !== undefined ? { statuscode: res.statuscode } : {}),
              ...(res.remark !== undefined ? { remark: res.remark } : {})
            },
            input.reference
          );
          return outcome;
        }

        const epins: VtuEpin[] = rows
          .filter((r) => r.pin && r.sno)
          .map((r) => ({
            pin: r.pin!,
            serialNumber: r.sno!,
            ...(r.batchno ? { batchNo: r.batchno } : {})
          }));

        if (epins.length === 0) {
          return {
            providerReference: input.reference,
            status: "FAILED" as const,
            failureReason: "ClubKonnect returned data EPIN rows without a pin/serial."
          };
        }

        return { providerReference: input.reference, status: "DELIVERED" as const, epins };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Data EPIN purchase error"
        };
      }
    }
  };
}

// ─── MobileNig adapter ────────────────────────────────────────────────────────
// REST API with Bearer token. Covers GLO & 9mobile premium tiers.

export interface MobileNigConfig {
  apiKey: string;
  baseUrl?: string; // default https://mobilenig.com/API
  fetcher?: typeof fetch;
}

const MN_NETWORK: Record<VtuNetwork, string> = {
  MTN: "MTN",
  GLO: "Glo",
  AIRTEL: "Airtel",
  NINE_MOBILE: "9mobile"
};

async function mnPost(
  config: MobileNigConfig,
  endpoint: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? "https://mobilenig.com/API";
  const res = await f(`${base}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`MobileNig ${endpoint} returned HTTP ${res.status}`);
  return res.json();
}

function mapMnStatus(status?: string): VtuSubmitStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "success" || s === "successful") return "DELIVERED";
  if (s === "pending" || s === "processing") return "SUBMITTED";
  if (s === "failed") return "FAILED";
  return "AMBIGUOUS";
}

export function createMobileNigAdapter(config: MobileNigConfig): VtuProviderAdapter {
  return {
    name: "mobilenig",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities('weak', ['AIRTIME', 'DATA']),

    buildReference(order) {
      return `MN${order.id.replace(/-/g, "").slice(0, 18).toUpperCase()}`;
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const results: VtuPlanOffer[] = [];

      for (const net of networks) {
        try {
          const res = (await mnPost(config, "/data/plans", {
            network: MN_NETWORK[net]
          })) as Array<{
            plan_id?: string | number;
            plan?: string;
            amount?: string | number;
            validity?: string | number;
            plan_type?: string;
            size?: string | number;
          }>;

          for (const p of Array.isArray(res) ? res : []) {
            const name = p.plan ?? String(p.plan_id ?? "");
            const cost = Math.round(parseFloat(String(p.amount ?? 0)) * 100);
            const rawSize = String(p.size ?? name);
            const gbMatch = rawSize.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = rawSize.match(/(\d+)\s*MB/i);
            const sizeMb = gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch
                ? parseInt(mbMatch[1]!)
                : 0;
            const validityDays = parseInt(String(p.validity ?? 30)) || 30;
            const rawType = (p.plan_type ?? "SME").toUpperCase();
            const planType: VtuPlanType =
              rawType === "CG" ? "CG" : rawType === "GIFTING" ? "GIFTING" : "SME";

            results.push({
              providerPlanId: String(p.plan_id ?? ""),
              network: net,
              planType,
              displayName: name,
              sizeMb,
              validityDays,
              costMinor: cost,
              currency: "NGN"
            });
          }
        } catch {
          // Skip.
        }
      }
      return results;
    },

    getAirtimeDiscountBps(network) {
      // Published premium tier: GLO 7.5%, 9mobile 6%, others 2%.
      if (network === "GLO") return Promise.resolve(750);
      if (network === "NINE_MOBILE") return Promise.resolve(600);
      return Promise.resolve(200);
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const res = (await mnPost(config, "/airtime", {
        network: MN_NETWORK[network],
        amount: faceValueMinor / 100,
        phone: msisdn,
        ref: reference
      })) as { status?: string; message?: string };

      const status = mapMnStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "MobileNig airtime failed" } : {})
      };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const res = (await mnPost(config, "/data", {
        network: MN_NETWORK[network],
        plan_id: providerPlanId,
        phone: msisdn,
        ref: reference
      })) as { status?: string; message?: string };

      const status = mapMnStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "MobileNig data failed" } : {})
      };
    },

    async getOrderStatus(reference) {
      const res = (await mnPost(config, "/query", { ref: reference })) as {
        status?: string;
        message?: string;
      };
      return {
        providerReference: reference,
        status: mapMnStatus(res.status),
        ...(res.message ? { failureReason: res.message } : {})
      };
    },

    async getBalance() {
      const res = (await mnPost(config, "/balance", {})) as {
        balance?: string | number;
        wallet?: string | number;
      };
      const raw = res.balance ?? res.wallet ?? 0;
      return {
        providerName: "mobilenig",
        balanceMinor: Math.round(parseFloat(String(raw)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await this.getBalance();
        return { providerName: "mobilenig", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "mobilenig",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "MobileNig health check failed"
        };
      }
    }
  };
}

// ─── CheapDataHub adapter ─────────────────────────────────────────────────────

export interface CheapDataHubConfig {
  apiKey: string;
  baseUrl?: string; // default https://cheapdatahub.com.ng/api
  fetcher?: typeof fetch;
}

const CDH_NETWORK: Record<VtuNetwork, string> = {
  MTN: "mtn",
  GLO: "glo",
  AIRTEL: "airtel",
  NINE_MOBILE: "9mobile"
};

async function cdhPost(
  config: CheapDataHubConfig,
  endpoint: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? "https://cheapdatahub.com.ng/api"}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`CheapDataHub ${endpoint} returned HTTP ${res.status}`);
  return res.json();
}

function mapCdhStatus(status?: string): VtuSubmitStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "successful" || s === "success") return "DELIVERED";
  if (s === "pending" || s === "processing") return "SUBMITTED";
  if (s === "failed") return "FAILED";
  return "AMBIGUOUS";
}

export function createCheapDataHubAdapter(config: CheapDataHubConfig): VtuProviderAdapter {
  return {
    name: "cheapdatahub",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities('weak', ['AIRTIME', 'DATA']),

    buildReference(order) {
      return `CDH${order.id.replace(/-/g, "").slice(0, 17).toUpperCase()}`;
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const results: VtuPlanOffer[] = [];

      for (const net of networks) {
        try {
          const res = (await cdhPost(config, "/dataplans/", {
            network: CDH_NETWORK[net]
          })) as Array<{
            id?: string | number;
            plan?: string;
            amount?: string | number;
            validity?: string | number;
            plan_type?: string;
          }>;

          for (const p of Array.isArray(res) ? res : []) {
            const name = p.plan ?? String(p.id ?? "");
            const cost = Math.round(parseFloat(String(p.amount ?? 0)) * 100);
            const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = name.match(/(\d+)\s*MB/i);
            const sizeMb = gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch
                ? parseInt(mbMatch[1]!)
                : 0;
            const validityDays = parseInt(String(p.validity ?? 30)) || 30;
            const rawType = (p.plan_type ?? "SME").toUpperCase();
            const planType: VtuPlanType =
              rawType === "CG" ? "CG" : rawType === "GIFTING" ? "GIFTING" : "SME";

            results.push({
              providerPlanId: String(p.id ?? ""),
              network: net,
              planType,
              displayName: name,
              sizeMb,
              validityDays,
              costMinor: cost,
              currency: "NGN"
            });
          }
        } catch {
          // Skip.
        }
      }
      return results;
    },

    getAirtimeDiscountBps(network) {
      // Published: MTN 2.5%, GLO 4%, Airtel 1%, 9mobile 2.5%.
      if (network === "GLO") return Promise.resolve(400);
      if (network === "AIRTEL") return Promise.resolve(100);
      return Promise.resolve(250);
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const res = (await cdhPost(config, "/topup/", {
        network: CDH_NETWORK[network],
        amount: faceValueMinor / 100,
        mobile_number: msisdn,
        Ported_number: true,
        airtime_type: "VTU",
        ref: reference
      })) as { Status?: string; message?: string };

      const status = mapCdhStatus(res.Status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "CheapDataHub airtime failed" } : {})
      };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const res = (await cdhPost(config, "/data/", {
        network: CDH_NETWORK[network],
        mobile_number: msisdn,
        plan: providerPlanId,
        Ported_number: true,
        ref: reference
      })) as { Status?: string; message?: string };

      const status = mapCdhStatus(res.Status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "CheapDataHub data failed" } : {})
      };
    },

    async getOrderStatus(reference) {
      const res = (await cdhPost(config, "/query/", { ref: reference })) as {
        Status?: string;
        message?: string;
      };
      return {
        providerReference: reference,
        status: mapCdhStatus(res.Status),
        ...(res.message ? { failureReason: res.message } : {})
      };
    },

    async getBalance() {
      const res = (await cdhPost(config, "/balance/", {})) as {
        balance?: string | number;
        Balance?: string | number;
      };
      const raw = res.balance ?? res.Balance ?? 0;
      return {
        providerName: "cheapdatahub",
        balanceMinor: Math.round(parseFloat(String(raw)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await this.getBalance();
        return { providerName: "cheapdatahub", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "cheapdatahub",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "CheapDataHub health check failed"
        };
      }
    }
  };
}

// ─── eBills Africa adapter ────────────────────────────────────────────────────
// JWT auth — 7-day token, latest-token-only (requesting a new one invalidates old ones).

export interface EBillsConfig {
  username: string;
  password: string;
  baseUrl?: string; // default https://api.ebillsafrica.com
  fetcher?: typeof fetch;
}

interface EBillsTokenCache {
  token: string;
  expiresAt: number;
}

function createEBillsAdapter(config: EBillsConfig): VtuProviderAdapter {
  let tokenCache: EBillsTokenCache | null = null;
  const f = config.fetcher ?? fetch;
  const base = config.baseUrl ?? "https://api.ebillsafrica.com";

  async function getToken(): Promise<string> {
    const now = Date.now();
    if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

    const res = await f(`${base}/jwt-auth/v1/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: config.username, password: config.password })
    });
    if (!res.ok) throw new Error(`eBills auth returned HTTP ${res.status}`);
    const data = (await res.json()) as { token?: string };
    if (!data.token) throw new Error("eBills: no token in auth response");
    // 7-day expiry per docs; cache for 6d 23h to be safe.
    tokenCache = { token: data.token, expiresAt: now + 6 * 24 * 60 * 60 * 1000 };
    return data.token;
  }

  async function ebPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    const token = await getToken();
    const res = await f(`${base}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`eBills ${endpoint} returned HTTP ${res.status}`);
    return res.json();
  }

  const EB_NETWORK: Record<VtuNetwork, string> = {
    MTN: "MTN",
    GLO: "GLO",
    AIRTEL: "AIRTEL",
    NINE_MOBILE: "9MOBILE"
  };

  function mapEbStatus(status?: string): VtuSubmitStatus {
    const s = (status ?? "").toLowerCase();
    if (s === "success" || s === "successful") return "DELIVERED";
    if (s === "pending" || s === "processing") return "SUBMITTED";
    if (s === "failed") return "FAILED";
    return "AMBIGUOUS";
  }

  return {
    name: "ebills",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities('weak', ['AIRTIME', 'DATA']),

    buildReference(order) {
      return `EB${order.id.replace(/-/g, "").slice(0, 18).toUpperCase()}`;
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const results: VtuPlanOffer[] = [];

      for (const net of networks) {
        try {
          const res = (await ebPost("/data/plans", {
            network: EB_NETWORK[net]
          })) as Array<{
            id?: string | number;
            name?: string;
            amount?: string | number;
            validity?: string | number;
          }>;

          for (const p of Array.isArray(res) ? res : []) {
            const name = p.name ?? String(p.id ?? "");
            const cost = Math.round(parseFloat(String(p.amount ?? 0)) * 100);
            const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = name.match(/(\d+)\s*MB/i);
            const sizeMb = gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch
                ? parseInt(mbMatch[1]!)
                : 0;
            const validityDays = parseInt(String(p.validity ?? 30)) || 30;

            results.push({
              providerPlanId: String(p.id ?? ""),
              network: net,
              planType: "SME",
              displayName: name,
              sizeMb,
              validityDays,
              costMinor: cost,
              currency: "NGN"
            });
          }
        } catch {
          // Skip.
        }
      }
      return results;
    },

    getAirtimeDiscountBps() {
      // Published: 3% airtime flat.
      return Promise.resolve(300);
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const res = (await ebPost("/airtime/topup", {
        network: EB_NETWORK[network],
        amount: faceValueMinor / 100,
        phone: msisdn,
        ref: reference
      })) as { status?: string; message?: string };

      const status = mapEbStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "eBills airtime failed" } : {})
      };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const res = (await ebPost("/data/topup", {
        network: EB_NETWORK[network],
        plan_id: providerPlanId,
        phone: msisdn,
        ref: reference
      })) as { status?: string; message?: string };

      const status = mapEbStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "eBills data failed" } : {})
      };
    },

    async getOrderStatus(reference) {
      const res = (await ebPost("/query", { ref: reference })) as {
        status?: string;
        message?: string;
      };
      return {
        providerReference: reference,
        status: mapEbStatus(res.status),
        ...(res.message ? { failureReason: res.message } : {})
      };
    },

    async getBalance() {
      const res = (await ebPost("/balance", {})) as { balance?: string | number };
      const raw = res.balance ?? 0;
      return {
        providerName: "ebills",
        balanceMinor: Math.round(parseFloat(String(raw)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await this.getBalance();
        return { providerName: "ebills", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "ebills",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "eBills health check failed"
        };
      }
    }
  };
}

export { createEBillsAdapter };

// ─── SMEDATA adapter ──────────────────────────────────────────────────────────

export interface SmeDataConfig {
  apiKey: string;
  baseUrl?: string; // default https://smedata.ng/api
  fetcher?: typeof fetch;
}

async function smedPost(
  config: SmeDataConfig,
  endpoint: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const f = config.fetcher ?? fetch;
  const res = await f(`${config.baseUrl ?? "https://smedata.ng/api"}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`SMEDATA ${endpoint} returned HTTP ${res.status}`);
  return res.json();
}

function mapSmedStatus(status?: string): VtuSubmitStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "successful" || s === "success") return "DELIVERED";
  if (s === "pending" || s === "processing") return "SUBMITTED";
  if (s === "failed") return "FAILED";
  return "AMBIGUOUS";
}

export function createSmeDataAdapter(config: SmeDataConfig): VtuProviderAdapter {
  const SMED_NETWORK: Record<VtuNetwork, string> = {
    MTN: "mtn",
    GLO: "glo",
    AIRTEL: "airtel",
    NINE_MOBILE: "9mobile"
  };

  return {
    name: "smedata",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities('weak', ['AIRTIME', 'DATA']),

    buildReference(order) {
      return `SD${order.id.replace(/-/g, "").slice(0, 18).toUpperCase()}`;
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const results: VtuPlanOffer[] = [];

      for (const net of networks) {
        try {
          const res = (await smedPost(config, "/dataplans/", {
            network: SMED_NETWORK[net]
          })) as Array<{
            id?: string | number;
            plan?: string;
            plan_amount?: string | number;
            month_validate?: string | number;
          }>;

          for (const p of Array.isArray(res) ? res : []) {
            const name = p.plan ?? String(p.id ?? "");
            const cost = Math.round(parseFloat(String(p.plan_amount ?? 0)) * 100);
            const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = name.match(/(\d+)\s*MB/i);
            const sizeMb = gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch
                ? parseInt(mbMatch[1]!)
                : 0;
            const validityDays = parseInt(String(p.month_validate ?? 30)) * 30 || 30;

            results.push({
              providerPlanId: String(p.id ?? ""),
              network: net,
              planType: "SME",
              displayName: name,
              sizeMb,
              validityDays,
              costMinor: cost,
              currency: "NGN"
            });
          }
        } catch {
          // Skip.
        }
      }
      return results;
    },

    getAirtimeDiscountBps() {
      return Promise.resolve(200); // 2% — last resort failover only.
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const res = (await smedPost(config, "/topup/", {
        network: SMED_NETWORK[network],
        amount: faceValueMinor / 100,
        mobile_number: msisdn,
        Ported_number: true,
        airtime_type: "VTU",
        ref: reference
      })) as { Status?: string; message?: string };

      const status = mapSmedStatus(res.Status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "SMEDATA airtime failed" } : {})
      };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const res = (await smedPost(config, "/data/", {
        network: SMED_NETWORK[network],
        mobile_number: msisdn,
        plan: providerPlanId,
        Ported_number: true,
        ref: reference
      })) as { Status?: string; message?: string };

      const status = mapSmedStatus(res.Status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "SMEDATA data failed" } : {})
      };
    },

    async getOrderStatus(reference) {
      const res = (await smedPost(config, "/query/", { ref: reference })) as {
        Status?: string;
        message?: string;
      };
      return {
        providerReference: reference,
        status: mapSmedStatus(res.Status),
        ...(res.message ? { failureReason: res.message } : {})
      };
    },

    async getBalance() {
      const res = (await smedPost(config, "/balance/", {})) as {
        balance?: string | number;
        Balance?: string | number;
      };
      const raw = res.balance ?? res.Balance ?? 0;
      return {
        providerName: "smedata",
        balanceMinor: Math.round(parseFloat(String(raw)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await this.getBalance();
        return { providerName: "smedata", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "smedata",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "SMEDATA health check failed"
        };
      }
    }
  };
}

// ─── Mock adapter (CI / tests) ────────────────────────────────────────────────

export function createMockVtuAdapter(
  name = "mock-vtu",
  deliveredByDefault = true
): VtuProviderAdapter {
  return {
    name,
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities('strong', VTU_PRODUCT_TYPES),

    buildReference(order) {
      return `MOCK${order.id.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    },

    listDataPlans(network) {
      const net: VtuNetwork = network ?? "MTN";
      return Promise.resolve([
        {
          providerPlanId: "mock_1gb_sme",
          network: net,
          planType: "SME",
          displayName: "1GB SME (Mock)",
          sizeMb: 1024,
          validityDays: 30,
          costMinor: 22800,
          currency: "NGN"
        }
      ]);
    },

    getAirtimeDiscountBps() {
      return Promise.resolve(300);
    },

    purchaseAirtime({ reference }) {
      return Promise.resolve({
        providerReference: reference,
        status: deliveredByDefault ? "DELIVERED" : "SUBMITTED"
      });
    },

    purchaseData({ reference }) {
      return Promise.resolve({
        providerReference: reference,
        status: deliveredByDefault ? "DELIVERED" : "SUBMITTED"
      });
    },

    getOrderStatus(reference) {
      return Promise.resolve({
        providerReference: reference,
        status: deliveredByDefault ? ("DELIVERED" as const) : ("SUBMITTED" as const)
      });
    },

    getBalance() {
      return Promise.resolve({
        providerName: name,
        balanceMinor: 500_000_00,
        currency: "NGN"
      });
    },

    checkHealth() {
      return Promise.resolve({
        providerName: name,
        status: "HEALTHY",
        latencyMs: 5
      });
    },

    validateMeter() {
      return Promise.resolve({ valid: true, customerName: "MOCK CUSTOMER" });
    },

    purchaseElectricity({ reference }) {
      return Promise.resolve({
        providerReference: reference,
        status: deliveredByDefault ? "DELIVERED" : "SUBMITTED",
        ...(deliveredByDefault ? { token: "0000-MOCK-TOKEN" } : {})
      });
    },

    verifyCableCustomer() {
      return Promise.resolve({ valid: true, customerName: "MOCK CUSTOMER" });
    },

    listCablePackages() {
      return Promise.resolve([
        {
          cableProvider: "dstv",
          packageCode: "mock-dstv-padi",
          displayName: "DStv Padi (Mock)",
          costMinor: 440000,
          currency: "NGN"
        }
      ]);
    },

    purchaseCable({ reference }) {
      return Promise.resolve({
        providerReference: reference,
        status: deliveredByDefault ? "DELIVERED" : "SUBMITTED"
      });
    },

    verifyBettingCustomer() {
      return Promise.resolve({ valid: true, customerName: "MOCK CUSTOMER" });
    },

    purchaseBetFunding({ reference }) {
      return Promise.resolve({
        providerReference: reference,
        status: deliveredByDefault ? "DELIVERED" : "SUBMITTED"
      });
    },

    verifyJambProfile() {
      return Promise.resolve({ valid: true, customerName: "MOCK CUSTOMER" });
    },

    purchaseEducation({ reference }) {
      return Promise.resolve({
        providerReference: reference,
        status: deliveredByDefault ? "DELIVERED" : "SUBMITTED",
        ...(deliveredByDefault ? { pin: "0000-MOCK-PIN", serialNumber: "MOCK-SERIAL" } : {})
      });
    }
  };
}

// ─── Swiftlink adapter ────────────────────────────────────────────────────────
// Status: BLOCKED_PENDING_CREDENTIALS
// Swiftlink (swiftlinkvtu.com) offers airtime, data, cable, electricity and
// broadband. Their reseller API requires account creation and KYB before API
// credentials are issued. API documentation is not publicly accessible without
// an account — all endpoint shapes below are PLACEHOLDER only and MUST NOT be
// used in production until official API docs are obtained and verified.
//
// Required env vars: SWIFTLINK_API_KEY, SWIFTLINK_BASE_URL
// Researched pricing benchmarks (RESEARCHED_PUBLIC_PRICE, not live):
//   Airtime: MTN 3.8%, Airtel 3.3%, Glo 8%, 9mobile 7%
//   Cable: DStv 1.2%, GOtv 1.2%, StarTimes 2%, Showmax 1%

export interface SwiftlinkConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export function createSwiftlinkAdapter(config: SwiftlinkConfig): VtuProviderAdapter {
  const base = config.baseUrl ?? "https://api.swiftlinkvtu.com/v1";
  const f = config.fetcher ?? fetch;

  async function swiftGet(path: string): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Swiftlink GET ${path} → HTTP ${res.status}`);
    return res.json();
  }

  async function swiftPost(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Swiftlink POST ${path} → HTTP ${res.status}`);
    return res.json();
  }

  // Researched discount bps per network (RESEARCHED_PUBLIC_PRICE — not verified via live API).
  const AIRTIME_DISCOUNT_BPS: Record<string, number> = {
    MTN: 380,
    AIRTEL: 330,
    GLO: 800,
    NINE_MOBILE: 700
  };

  return {
    name: "swiftlink",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () =>
      vtuCapabilities("weak", ["AIRTIME", "DATA", "CABLE", "ELECTRICITY"]),

    buildReference(order) {
      return `SWL${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(network) {
      return Promise.resolve(AIRTIME_DISCOUNT_BPS[network] ?? 300);
    },

    async listDataPlans(_network) {
      // PLACEHOLDER — endpoint path unverified. Replace once official docs obtained.
      const res = (await swiftGet("/data-plans")) as { data?: Array<{
        id?: string; network?: string; size?: string; validity?: string; price?: number;
      }> };
      return (res.data ?? []).map((p) => ({
        providerPlanId: String(p.id ?? ""),
        network: (p.network?.toUpperCase() ?? "MTN") as VtuNetwork,
        planType: "SME" as VtuPlanType,
        displayName: `${p.network} ${p.size} ${p.validity}`,
        sizeMb: 0,
        validityDays: 30,
        costMinor: Math.round((p.price ?? 0) * 100),
        currency: "NGN"
      }));
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      // PLACEHOLDER — endpoint path and body schema unverified.
      const res = (await swiftPost("/airtime", {
        network: network.toLowerCase(),
        phone: msisdn,
        amount: faceValueMinor / 100,
        request_id: reference
      })) as { status?: string; message?: string };
      const s = (res.status ?? "").toLowerCase();
      if (s === "success" || s === "delivered") return { providerReference: reference, status: "DELIVERED" };
      if (s === "pending" || s === "processing") return { providerReference: reference, status: "SUBMITTED" };
      return { providerReference: reference, status: "FAILED", failureReason: res.message ?? "Swiftlink airtime failed" };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      // PLACEHOLDER — endpoint path and body schema unverified.
      const res = (await swiftPost("/data", {
        network: network.toLowerCase(),
        phone: msisdn,
        plan_id: providerPlanId,
        request_id: reference
      })) as { status?: string; message?: string };
      const s = (res.status ?? "").toLowerCase();
      if (s === "success" || s === "delivered") return { providerReference: reference, status: "DELIVERED" };
      if (s === "pending" || s === "processing") return { providerReference: reference, status: "SUBMITTED" };
      return { providerReference: reference, status: "FAILED", failureReason: res.message ?? "Swiftlink data failed" };
    },

    async getOrderStatus(reference) {
      // PLACEHOLDER — endpoint path unverified.
      const res = (await swiftGet(`/status?request_id=${reference}`)) as { status?: string };
      const s = (res.status ?? "").toLowerCase();
      if (s === "success" || s === "delivered") return { providerReference: reference, status: "DELIVERED" };
      if (s === "pending" || s === "processing") return { providerReference: reference, status: "SUBMITTED" };
      return { providerReference: reference, status: "FAILED" };
    },

    async getBalance() {
      // PLACEHOLDER — endpoint path unverified.
      const res = (await swiftGet("/balance")) as { balance?: number };
      return {
        providerName: "swiftlink",
        balanceMinor: Math.round((res.balance ?? 0) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await swiftGet("/balance");
        return { providerName: "swiftlink", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "swiftlink",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "Swiftlink health check failed"
        };
      }
    }
  };
}

// ─── eBills full adapter (electricity + betting extension) ────────────────────
// Status: BLOCKED_PENDING_CREDENTIALS (electricity/betting endpoints)
// The existing eBillsAdapter in this file handles airtime and data only.
// This extended version adds electricity and betting — both from the same
// eBills (ebills.ng) account. Endpoint shapes below are PLACEHOLDER until
// confirmed via the eBills developer portal.
//
// Researched pricing benchmarks (RESEARCHED_PUBLIC_PRICE):
//   Electricity: 1.5% service charge
//   Betting wallet funding: 0.20% charge
//
// Required env vars: EBILLS_API_KEY, EBILLS_BASE_URL (reuse existing eBills creds)

export interface EBillsFullConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export function createEBillsFullAdapter(config: EBillsFullConfig): VtuProviderAdapter {
  const base = config.baseUrl ?? "https://api.ebills.ng/v1";
  const f = config.fetcher ?? fetch;

  async function ebPost(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`eBills POST ${path} → HTTP ${res.status}`);
    return res.json();
  }

  async function ebGet(path: string): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });
    if (!res.ok) throw new Error(`eBills GET ${path} → HTTP ${res.status}`);
    return res.json();
  }

  function mapEbStatus(status?: string): VtuSubmitStatus {
    const s = (status ?? "").toLowerCase();
    if (s === "success" || s === "successful" || s === "delivered") return "DELIVERED";
    if (s === "pending" || s === "processing") return "SUBMITTED";
    return "FAILED";
  }

  return {
    name: "ebills",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () =>
      vtuCapabilities("weak", ["AIRTIME", "DATA", "ELECTRICITY", "BETTING"]),

    buildReference(order) {
      return `EBL${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(_network) {
      // eBills ePIN: MTN 0.5%, Glo/Airtel 1%, 9mobile 4% (researched benchmark).
      return Promise.resolve(50);
    },

    async listDataPlans(_network) {
      // PLACEHOLDER — eBills data plan endpoint unverified.
      return [];
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      // PLACEHOLDER — eBills airtime endpoint unverified.
      const res = (await ebPost("/airtime", {
        network: network.toLowerCase(),
        phone: msisdn,
        amount: faceValueMinor / 100,
        reference
      })) as { status?: string; message?: string };
      return {
        providerReference: reference,
        status: mapEbStatus(res.status),
        ...(mapEbStatus(res.status) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      // PLACEHOLDER.
      const res = (await ebPost("/data", {
        network: network.toLowerCase(),
        phone: msisdn,
        plan: providerPlanId,
        reference
      })) as { status?: string; message?: string };
      return {
        providerReference: reference,
        status: mapEbStatus(res.status),
        ...(mapEbStatus(res.status) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    async getOrderStatus(reference) {
      const res = (await ebGet(`/transaction/${reference}`)) as { status?: string };
      return { providerReference: reference, status: mapEbStatus(res.status) };
    },

    async getBalance() {
      const res = (await ebGet("/balance")) as { balance?: number };
      return {
        providerName: "ebills",
        balanceMinor: Math.round((res.balance ?? 0) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await ebGet("/balance");
        return { providerName: "ebills", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "ebills",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "eBills health check failed"
        };
      }
    },

    // Electricity — PLACEHOLDER endpoints, sourced from eBills developer portal once available.
    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        const res = (await ebPost("/electricity/validate", {
          disco: input.disco,
          meter_number: input.meterNumber,
          meter_type: input.meterType
        })) as { valid?: boolean; customer_name?: string; address?: string };
        return {
          valid: res.valid ?? false,
          ...(res.customer_name ? { customerName: res.customer_name } : {}),
          ...(res.address ? { address: res.address } : {})
        };
      } catch {
        return { valid: false };
      }
    },

    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      const res = (await ebPost("/electricity/purchase", {
        disco: input.disco,
        meter_number: input.meterNumber,
        meter_type: input.meterType,
        amount: input.amountMinor / 100,
        phone: input.phoneNumber,
        reference: input.reference
      })) as { status?: string; token?: string; units?: string; message?: string };
      return {
        providerReference: input.reference,
        status: mapEbStatus(res.status),
        ...(res.token ? { token: res.token } : {}),
        ...(res.units ? { units: res.units } : {}),
        ...(mapEbStatus(res.status) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // Betting wallet funding — PLACEHOLDER.
    async verifyBettingCustomer(input): Promise<VtuMeterValidation> {
      try {
        const res = (await ebPost("/betting/verify", {
          bookmaker: input.bettingCompany,
          customer_id: input.customerId
        })) as { valid?: boolean; name?: string };
        return { valid: res.valid ?? false, ...(res.name ? { customerName: res.name } : {}) };
      } catch {
        return { valid: false };
      }
    },

    async purchaseBetFunding(input): Promise<VtuSubmitResult> {
      const res = (await ebPost("/betting/fund", {
        bookmaker: input.bettingCompany,
        customer_id: input.customerId,
        amount: input.amountMinor / 100,
        reference: input.reference
      })) as { status?: string; message?: string };
      return {
        providerReference: input.reference,
        status: mapEbStatus(res.status),
        ...(mapEbStatus(res.status) === "FAILED" ? { failureReason: res.message } : {})
      };
    }
  };
}

// ─── TopupWizard adapter ──────────────────────────────────────────────────────
// Status: CONFIGURED (public API docs verified at topupwizard.com/apidocs)
// Base URL: https://topupwizard.com/api/
// Auth: Authorization-Token: YOUR_TOKEN   (non-standard header — NOT "Authorization: Bearer")
// Supports: Airtime, Data, Electricity, Cable, Education (WAEC/NECO/NABTEB/JAMB)
//
// Key endpoints (verified from public docs):
//   GET  /balance          — wallet balance
//   POST /airtime          — buy airtime: serviceID, amount, mobileNumber, clientReference
//   POST /data             — buy data:    serviceID, mobileNumber, clientReference
//   POST /payelectric      — buy electricity: serviceID, amount, meterNum, meterType, clientReference
//   POST /validateutility  — validate meter: serviceID, meterNum, meterType
//   POST /subcable         — cable sub:  serviceID, iucNum, clientReference
//   POST /validatecable    — validate IUC: serviceID, iucNum
//   POST /education        — buy exam PIN: serviceID, quantity, clientReference
//   POST /requerytrx       — requery: clientReference
//   POST /pricing          — product pricing: serviceID, type, dataType
//
// Researched pricing benchmarks (RESEARCHED_PUBLIC_PRICE):
//   WAEC ₦3,450 | NECO ₦1,230 | NABTEB ₦800
//
// Required env vars: TOPUPWIZARD_API_KEY, TOPUPWIZARD_BASE_URL

export interface TopupWizardConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export function createTopupWizardAdapter(config: TopupWizardConfig): VtuProviderAdapter {
  // Base path confirmed from topupwizard.com/apidocs (checked via research, 2026-08-08).
  const base = (config.baseUrl ?? "https://topupwizard.com/api").replace(/\/$/, "");
  const f = config.fetcher ?? fetch;

  // TopupWizard uses a non-standard auth header name — verified from their docs.
  const headers = {
    "Authorization-Token": config.apiKey,
    "Content-Type": "application/json"
  };

  async function twPost(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`TopupWizard POST ${path} → HTTP ${res.status}`);
    return res.json();
  }

  async function twGet(path: string): Promise<unknown> {
    const res = await f(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`TopupWizard GET ${path} → HTTP ${res.status}`);
    return res.json();
  }

  // TopupWizard response: { "status": "success"|"error"|"pending", "message": "...", "data": {...} }
  function mapTwStatus(res: { status?: string; data?: { status?: string } }): VtuSubmitStatus {
    const s = (res.data?.status ?? res.status ?? "").toLowerCase();
    if (s === "success" || s === "successful" || s === "completed") return "DELIVERED";
    if (s === "pending" || s === "processing") return "SUBMITTED";
    return "FAILED";
  }

  return {
    name: "topupwizard",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () =>
      vtuCapabilities("strong", ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "EDUCATION"]),

    buildReference(order) {
      // TopupWizard uses "clientReference" as idempotency key on all mutating calls.
      return `TWZ${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(_network) {
      // TopupWizard pricing exposed via POST /pricing — use researched 3% as default;
      // actual discount fetched dynamically if needed.
      return Promise.resolve(300);
    },

    async listDataPlans(network) {
      try {
        const networkMap: Record<string, string> = {
          MTN: "MTN", GLO: "GLO", AIRTEL: "AIRTEL", NINE_MOBILE: "9MOBILE"
        };
        const res = (await twPost("/pricing", {
          serviceID: networkMap[network ?? "MTN"],
          type: "data",
          dataType: "sme",
          typeSingle: false
        })) as {
          status?: string;
          data?: Array<{
            serviceID?: string;
            plan?: string;
            size?: string;
            validity?: string;
            price?: number | string;
          }>;
        };
        if (res.status !== "success") return [];
        return (res.data ?? []).map((p) => {
          const gbMatch = (p.size ?? "").match(/(\d+(?:\.\d+)?)\s*GB/i);
          const mbMatch = (p.size ?? "").match(/(\d+)\s*MB/i);
          const dayMatch = (p.validity ?? "").match(/(\d+)/);
          return {
            providerPlanId: p.serviceID ?? p.plan ?? "",
            network: (network ?? "MTN") as VtuNetwork,
            planType: "SME" as VtuPlanType,
            displayName: `${network} ${p.size} ${p.validity}`,
            sizeMb: gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch ? parseInt(mbMatch[1]!) : 0,
            validityDays: dayMatch ? parseInt(dayMatch[1]!) : 30,
            costMinor: Math.round(parseFloat(String(p.price ?? 0)) * 100),
            currency: "NGN"
          };
        });
      } catch { return []; }
    },

    // POST /airtime — serviceID, amount, mobileNumber, clientReference
    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const serviceMap: Record<string, string> = {
        MTN: "MTN", GLO: "GLO", AIRTEL: "AIRTEL", NINE_MOBILE: "9MOBILE"
      };
      const res = (await twPost("/airtime", {
        serviceID: serviceMap[network] ?? network,
        amount: faceValueMinor / 100,
        mobileNumber: msisdn,
        clientReference: reference,
        bypassMobileValidator: false
      })) as { status?: string; message?: string; data?: { status?: string } };
      return {
        providerReference: reference,
        status: mapTwStatus(res),
        ...(mapTwStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /data — serviceID (the data bundle code), mobileNumber, clientReference
    async purchaseData({ msisdn, providerPlanId, reference }) {
      const res = (await twPost("/data", {
        serviceID: providerPlanId,
        mobileNumber: msisdn,
        clientReference: reference
      })) as { status?: string; message?: string; data?: { status?: string } };
      return {
        providerReference: reference,
        status: mapTwStatus(res),
        ...(mapTwStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /requerytrx — clientReference
    async getOrderStatus(reference) {
      const res = (await twPost("/requerytrx", { clientReference: reference })) as {
        status?: string;
        data?: { status?: string };
      };
      return { providerReference: reference, status: mapTwStatus(res) };
    },

    // GET /balance
    async getBalance() {
      const res = (await twGet("/balance")) as {
        status?: string;
        data?: { balance?: number | string };
      };
      return {
        providerName: "topupwizard",
        balanceMinor: Math.round(parseFloat(String(res.data?.balance ?? 0)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await twGet("/balance");
        return { providerName: "topupwizard", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "topupwizard",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "TopupWizard health check failed"
        };
      }
    },

    // POST /validateutility — serviceID (DISCO code), meterNum, meterType (prepaid/postpaid)
    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        const res = (await twPost("/validateutility", {
          serviceID: input.disco,
          meterNum: input.meterNumber,
          meterType: input.meterType.toLowerCase()
        })) as {
          status?: string;
          data?: { customerName?: string; address?: string; minAmount?: number };
        };
        if (res.status !== "success") return { valid: false };
        return {
          valid: true,
          ...(res.data?.customerName ? { customerName: res.data.customerName } : {}),
          ...(res.data?.address ? { address: res.data.address } : {}),
          ...(res.data?.minAmount ? { minAmountMinor: Math.round(res.data.minAmount * 100) } : {})
        };
      } catch { return { valid: false }; }
    },

    // POST /payelectric — serviceID, amount, meterNum, meterType, clientReference
    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      const res = (await twPost("/payelectric", {
        serviceID: input.disco,
        amount: input.amountMinor / 100,
        meterNum: input.meterNumber,
        meterType: input.meterType.toLowerCase(),
        clientReference: input.reference
      })) as {
        status?: string;
        message?: string;
        data?: { status?: string; token?: string; units?: string };
      };
      return {
        providerReference: input.reference,
        status: mapTwStatus(res),
        ...(res.data?.token ? { token: res.data.token } : {}),
        ...(res.data?.units ? { units: res.data.units } : {}),
        ...(mapTwStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /validatecable — serviceID, iucNum
    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      try {
        const res = (await twPost("/validatecable", {
          serviceID: input.provider,
          iucNum: input.smartCardNumber
        })) as { status?: string; data?: { customerName?: string } };
        return {
          valid: res.status === "success",
          ...(res.data?.customerName ? { customerName: res.data.customerName } : {})
        };
      } catch { return { valid: false }; }
    },

    // POST /subcable — serviceID (package code), iucNum, clientReference
    async purchaseCable(input): Promise<VtuSubmitResult> {
      const res = (await twPost("/subcable", {
        serviceID: input.packageCode,
        iucNum: input.smartCardNumber,
        clientReference: input.reference
      })) as { status?: string; message?: string; data?: { status?: string } };
      return {
        providerReference: input.reference,
        status: mapTwStatus(res),
        ...(mapTwStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    async listEducationPlans(): Promise<VtuEducationPlanOffer[]> {
      // Fetch via POST /pricing with education type.
      try {
        const res = (await twPost("/pricing", {
          serviceID: "WAEC",
          type: "education",
          typeSingle: true
        })) as {
          status?: string;
          data?: Array<{ serviceID?: string; name?: string; price?: number }>;
        };
        if (res.status !== "success") return [];
        return (res.data ?? []).map((p) => ({
          productCode: p.serviceID ?? "",
          displayName: p.name ?? p.serviceID ?? "",
          costMinor: Math.round((p.price ?? 0) * 100),
          currency: "NGN"
        }));
      } catch { return []; }
    },

    // POST /education — serviceID, quantity, clientReference
    async purchaseEducation(input): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }> {
      const examServiceMap: Record<string, string> = {
        waecdirect: "WAEC",
        "waec-registraion": "WAEC-REG",
        neco: "NECO",
        nabteb: "NABTEB",
        de: "JAMB-DE",
        "utme-mock": "JAMB-MOCK",
        "utme-no-mock": "JAMB-UTME"
      };
      const res = (await twPost("/education", {
        serviceID: examServiceMap[input.examType] ?? input.examType.toUpperCase(),
        quantity: 1,
        clientReference: input.reference
      })) as {
        status?: string;
        message?: string;
        data?: { status?: string; pin?: string; serialNumber?: string };
      };
      return {
        providerReference: input.reference,
        status: mapTwStatus(res),
        ...(res.data?.pin ? { pin: res.data.pin } : {}),
        ...(res.data?.serialNumber ? { serialNumber: res.data.serialNumber } : {}),
        ...(mapTwStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    }
  };
}

// ─── iSquareData adapter ──────────────────────────────────────────────────────
// Status: BLOCKED_PENDING_CREDENTIALS
// iSquareData is a data reseller — supports data and education PINs.
// API documentation not publicly accessible without an account.
//
// Required env vars: ISQUAREDATA_API_KEY, ISQUAREDATA_BASE_URL

export interface ISquareDataConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export function createISquareDataAdapter(config: ISquareDataConfig): VtuProviderAdapter {
  const base = config.baseUrl ?? "https://api.isquaredata.com/v1";
  const f = config.fetcher ?? fetch;

  async function isqPost(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`iSquareData POST ${path} → HTTP ${res.status}`);
    return res.json();
  }

  async function isqGet(path: string): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });
    if (!res.ok) throw new Error(`iSquareData GET ${path} → HTTP ${res.status}`);
    return res.json();
  }

  function mapIsqStatus(status?: string): VtuSubmitStatus {
    const s = (status ?? "").toLowerCase();
    if (s === "success" || s === "delivered") return "DELIVERED";
    if (s === "pending" || s === "processing") return "SUBMITTED";
    return "FAILED";
  }

  return {
    name: "isquaredata",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities("weak", ["DATA", "EDUCATION"]),

    buildReference(order) {
      return `ISQ${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(_network) { return Promise.resolve(0); },

    async listDataPlans(_network) {
      try {
        const res = (await isqGet("/data-plans")) as { plans?: Array<{
          id?: string; network?: string; size_mb?: number; validity_days?: number; price?: number; name?: string;
        }> };
        return (res.plans ?? []).map((p) => ({
          providerPlanId: String(p.id ?? ""),
          network: (p.network?.toUpperCase() ?? "MTN") as VtuNetwork,
          planType: "SME" as VtuPlanType,
          displayName: p.name ?? `${p.network} ${p.size_mb}MB`,
          sizeMb: p.size_mb ?? 0,
          validityDays: p.validity_days ?? 30,
          costMinor: Math.round((p.price ?? 0) * 100),
          currency: "NGN"
        }));
      } catch { return []; }
    },

    purchaseAirtime({ reference }) {
      return Promise.resolve({ providerReference: reference, status: "FAILED" as const, failureReason: "iSquareData does not support direct airtime" });
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const res = (await isqPost("/buy-data", {
        network: network.toLowerCase(),
        phone: msisdn,
        plan_id: providerPlanId,
        reference
      })) as { status?: string; message?: string };
      return {
        providerReference: reference,
        status: mapIsqStatus(res.status),
        ...(mapIsqStatus(res.status) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    async getOrderStatus(reference) {
      const res = (await isqGet(`/order/${reference}`)) as { status?: string };
      return { providerReference: reference, status: mapIsqStatus(res.status) };
    },

    async getBalance() {
      const res = (await isqGet("/wallet/balance")) as { balance?: number };
      return { providerName: "isquaredata", balanceMinor: Math.round((res.balance ?? 0) * 100), currency: "NGN" };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await isqGet("/wallet/balance");
        return { providerName: "isquaredata", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return { providerName: "isquaredata", status: "DEGRADED", latencyMs: Date.now() - start, reason: err instanceof Error ? err.message : "iSquareData health check failed" };
      }
    }
  };
}

// ─── Inlomax adapter ──────────────────────────────────────────────────────────
// Status: CONFIGURED (public API docs verified at inlomax.com/docs/)
// Base URL: https://inlomax.com/api
// Auth: Authorization: Token YOUR_API_KEY   (Django REST Token scheme, not Bearer)
// Supports: Airtime, Data, Electricity, Cable, Education, Airtime/Data Pins, Bulk SMS
// Reference field: "request-id" on all mutating calls (idempotency key)
// Requery: POST /api/transaction with { reference: "..." }
//
// Required env vars: INLOMAX_API_KEY, INLOMAX_BASE_URL

export interface InlomaxConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export function createInlomaxAdapter(config: InlomaxConfig): VtuProviderAdapter {
  // Docs verified at inlomax.com/docs/ — base is https://inlomax.com/api
  const base = config.baseUrl ?? "https://inlomax.com/api";
  const f = config.fetcher ?? fetch;

  const headers = {
    Authorization: `Token ${config.apiKey}`,
    "Content-Type": "application/json"
  };

  async function inlPost(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Inlomax POST ${path} → HTTP ${res.status}`);
    return res.json();
  }

  async function inlGet(path: string): Promise<unknown> {
    const res = await f(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`Inlomax GET ${path} → HTTP ${res.status}`);
    return res.json();
  }

  // Inlomax response: { "status": "success"|"error", "message": "...", "data": { ... } }
  function mapInlStatus(res: { status?: string }): VtuSubmitStatus {
    const s = (res.status ?? "").toLowerCase();
    if (s === "success" || s === "successful") return "DELIVERED";
    if (s === "pending" || s === "processing") return "SUBMITTED";
    return "FAILED";
  }

  return {
    name: "inlomax",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () =>
      vtuCapabilities("strong", ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "EDUCATION"]),

    buildReference(order) {
      // Inlomax uses "request-id" for idempotency — must be unique per order.
      return `INL${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(_network) {
      // Inlomax airtime is billed at face value; profit comes from data reselling.
      return Promise.resolve(0);
    },

    async listDataPlans(_network) {
      try {
        // GET /api/services returns service/plan catalog. serviceID format: e.g. "MTN-DATA-SME-1000"
        const res = (await inlGet("/services")) as {
          status?: string;
          data?: Array<{
            serviceID?: string;
            network?: string;
            plan_type?: string;
            size?: string;
            validity?: string;
            price?: number | string;
            description?: string;
          }>;
        };
        if (res.status !== "success") return [];
        return (res.data ?? [])
          .filter((p) => p.serviceID?.toLowerCase().includes("data"))
          .map((p) => {
            const gbMatch = (p.size ?? "").match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = (p.size ?? "").match(/(\d+)\s*MB/i);
            const dayMatch = (p.validity ?? "").match(/(\d+)/);
            const sizeMb = gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch
                ? parseInt(mbMatch[1]!)
                : 0;
            return {
              providerPlanId: p.serviceID ?? "",
              network: (p.network?.toUpperCase().replace("9MOBILE", "NINE_MOBILE") ?? "MTN") as VtuNetwork,
              planType: (p.plan_type?.toUpperCase() ?? "SME") as VtuPlanType,
              displayName: p.description ?? `${p.network} ${p.size}`,
              sizeMb,
              validityDays: dayMatch ? parseInt(dayMatch[1]!) : 30,
              costMinor: Math.round(parseFloat(String(p.price ?? 0)) * 100),
              currency: "NGN"
            };
          });
      } catch { return []; }
    },

    // POST /api/airtime — params: serviceID, amount, mobileNumber, request-id
    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const networkMap: Record<string, string> = {
        MTN: "MTN-AIRTIME", GLO: "GLO-AIRTIME", AIRTEL: "AIRTEL-AIRTIME", NINE_MOBILE: "9MOBILE-AIRTIME"
      };
      const res = (await inlPost("/airtime", {
        serviceID: networkMap[network] ?? `${network}-AIRTIME`,
        amount: faceValueMinor / 100,
        mobileNumber: msisdn,
        "request-id": reference
      })) as { status?: string; message?: string };
      return {
        providerReference: reference,
        status: mapInlStatus(res),
        ...(mapInlStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /api/data — params: serviceID, mobileNumber, request-id
    async purchaseData({ msisdn, providerPlanId, reference }) {
      const res = (await inlPost("/data", {
        serviceID: providerPlanId,
        mobileNumber: msisdn,
        "request-id": reference
      })) as { status?: string; message?: string };
      return {
        providerReference: reference,
        status: mapInlStatus(res),
        ...(mapInlStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /api/transaction — params: reference
    async getOrderStatus(reference) {
      const res = (await inlPost("/transaction", { reference })) as {
        status?: string;
        data?: { status?: string };
      };
      const innerStatus = res.data?.status ?? res.status ?? "";
      return { providerReference: reference, status: mapInlStatus({ status: innerStatus }) };
    },

    // GET /api/balance
    async getBalance() {
      const res = (await inlGet("/balance")) as {
        status?: string;
        data?: { balance?: number | string };
      };
      return {
        providerName: "inlomax",
        balanceMinor: Math.round(parseFloat(String(res.data?.balance ?? 0)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await inlGet("/balance");
        return { providerName: "inlomax", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "inlomax",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "Inlomax health check failed"
        };
      }
    },

    // POST /api/payelectric — params: serviceID (DISCO code), meterNum, meterType (1=prepaid,2=postpaid), amount, request-id
    async validateMeter(input): Promise<VtuMeterValidation> {
      // Inlomax does not document a separate meter validation endpoint; validation is implicit
      // in the electricity payment call. Skip to avoid charging on a preflight.
      return { valid: true };
    },

    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      const res = (await inlPost("/payelectric", {
        serviceID: input.disco,
        meterNum: input.meterNumber,
        meterType: input.meterType === "PREPAID" ? "1" : "2",
        amount: input.amountMinor / 100,
        "request-id": input.reference
      })) as {
        status?: string;
        message?: string;
        data?: { token?: string; units?: string };
      };
      return {
        providerReference: input.reference,
        status: mapInlStatus(res),
        ...(res.data?.token ? { token: res.data.token } : {}),
        ...(res.data?.units ? { units: res.data.units } : {}),
        ...(mapInlStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /api/subcable — params: serviceID, iucNum, request-id
    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      return { valid: true }; // Inlomax docs don't list a cable verify endpoint
    },

    async purchaseCable(input): Promise<VtuSubmitResult> {
      const res = (await inlPost("/subcable", {
        serviceID: input.packageCode,
        iucNum: input.smartCardNumber,
        "request-id": input.reference
      })) as { status?: string; message?: string };
      return {
        providerReference: input.reference,
        status: mapInlStatus(res),
        ...(mapInlStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /api/education — params: serviceID (e.g. "WAEC-PIN"), quantity, request-id
    async purchaseEducation(input): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }> {
      const examServiceMap: Record<string, string> = {
        waecdirect: "WAEC-PIN",
        "waec-registraion": "WAEC-REG-PIN",
        neco: "NECO-PIN",
        nabteb: "NABTEB-PIN",
        de: "JAMB-DE-PIN",
        "utme-mock": "JAMB-UTME-MOCK",
        "utme-no-mock": "JAMB-UTME"
      };
      const res = (await inlPost("/education", {
        serviceID: examServiceMap[input.examType] ?? input.examType.toUpperCase(),
        quantity: "1",
        "request-id": input.reference
      })) as {
        status?: string;
        message?: string;
        data?: { pin?: string; serial?: string };
      };
      return {
        providerReference: input.reference,
        status: mapInlStatus(res),
        ...(res.data?.pin ? { pin: res.data.pin } : {}),
        ...(res.data?.serial ? { serialNumber: res.data.serial } : {}),
        ...(mapInlStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    }
  };
}

// ─── VTUGate adapter ─────────────────────────────────────────────────────────
// Status: CONFIGURED (public API docs verified at vtugate.com/docs, 2026-08-08)
// Base URL: https://api.vtugate.com
// Auth: Authorization: Bearer YOUR_API_KEY
// Content-Type: application/x-www-form-urlencoded   (NOT JSON — confirmed from docs)
// Sandbox: same production URL; use a Test API Key from the VTUGate dashboard.
//   Failure simulation: append "1111" to phone/meter/smartcard to trigger failure.
// Rate limit: 60 req/min per API key
//
// Operating mode: API-Key Mode (flat transaction fees, not commission):
//   Airtime ₦0.50 | Data ₦10 | Cable ₦10 | Electricity ₦2 | Education ₦10 | Broadband ₦10
//
// Key endpoints (all POST):
//   /api/v1/accountdetails    — wallet balance + account info
//   /api/v1/buy-airtime       — network, phone, amount, reference
//   /api/v1/fetch-data-plans  — network (MTN/Airtel/Glo/9mobile), plan_type (SME/CG/etc.)
//   /api/v1/buy-data          — network, phone, plan_id, reference
//   /api/v1/verify-electricity — disco, meter_number, meter_type (prepaid/postpaid)
//   /api/v1/buy-electricity   — disco, meter_number, meter_type, amount, phone, reference
//   /api/v1/verify-cable      — provider (dstv/gotv/startimes), smartcard_number
//   /api/v1/buy-cable         — provider, smartcard_number, package_code, phone, reference
//   /api/v1/get-education-price — exam_type (waec/neco/nabteb/jamb)
//   /api/v1/buy-education     — exam_type, quantity, reference
//   /api/v1/transaction-status — reference
//
// Required env vars: VTUGATE_API_KEY, VTUGATE_BASE_URL

export interface VTUGateConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export function createVTUGateAdapter(config: VTUGateConfig): VtuProviderAdapter {
  // Base URL confirmed from vtugate.com/docs (checked 2026-08-08).
  const base = (config.baseUrl ?? "https://api.vtugate.com").replace(/\/$/, "");
  const f = config.fetcher ?? fetch;

  // VTUGate requires application/x-www-form-urlencoded — confirmed from public docs.
  async function vtgPost(path: string, body: Record<string, string | number | boolean>): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(
        Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)]))
      ).toString()
    });
    if (!res.ok) throw new Error(`VTUGate POST ${path} → HTTP ${res.status}`);
    return res.json();
  }

  // VTUGate response: { "status": true|false, "message": "...", "data": { ... } }
  function mapVtgStatus(res: { status?: boolean | string; data?: { status?: string } }): VtuSubmitStatus {
    const inner = res.data?.status ?? "";
    const top = res.status;
    if (top === true || inner === "success" || inner === "delivered") return "DELIVERED";
    if (inner === "pending" || inner === "processing") return "SUBMITTED";
    if (top === false || inner === "failed") return "FAILED";
    return "AMBIGUOUS";
  }

  return {
    name: "vtugate",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () =>
      vtuCapabilities("strong", ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "EDUCATION"]),

    buildReference(order) {
      return `VTG${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(_network) {
      // VTUGate API-Key mode charges a flat ₦0.50 per airtime transaction, not a %.
      // For routing cost-comparison, return 0 (cost = face value + ₦0.50 fixed fee).
      return Promise.resolve(0);
    },

    // POST /api/v1/fetch-data-plans — network, plan_type
    async listDataPlans(network) {
      try {
        const res = (await vtgPost("/api/v1/fetch-data-plans", {
          network: network ?? "MTN",
          plan_type: "SME"
        })) as {
          status?: boolean;
          data?: Array<{
            plan_id?: string;
            plan_name?: string;
            size?: string;
            validity?: string;
            price?: number | string;
          }>;
        };
        if (!res.status) return [];
        return (res.data ?? []).map((p) => {
          const gbMatch = (p.size ?? "").match(/(\d+(?:\.\d+)?)\s*GB/i);
          const mbMatch = (p.size ?? "").match(/(\d+)\s*MB/i);
          const dayMatch = (p.validity ?? "").match(/(\d+)/);
          return {
            providerPlanId: String(p.plan_id ?? ""),
            network: (network ?? "MTN") as VtuNetwork,
            planType: "SME" as VtuPlanType,
            displayName: p.plan_name ?? `${network} ${p.size}`,
            sizeMb: gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch ? parseInt(mbMatch[1]!) : 0,
            validityDays: dayMatch ? parseInt(dayMatch[1]!) : 30,
            costMinor: Math.round(parseFloat(String(p.price ?? 0)) * 100),
            currency: "NGN"
          };
        });
      } catch { return []; }
    },

    // POST /api/v1/buy-airtime — network, phone, amount, reference
    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const res = (await vtgPost("/api/v1/buy-airtime", {
        network,
        phone: msisdn,
        amount: faceValueMinor / 100,
        reference
      })) as { status?: boolean; message?: string; data?: { status?: string } };
      return {
        providerReference: reference,
        status: mapVtgStatus(res),
        ...(mapVtgStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /api/v1/buy-data — network, phone, plan_id, reference
    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const res = (await vtgPost("/api/v1/buy-data", {
        network,
        phone: msisdn,
        plan_id: providerPlanId,
        reference
      })) as { status?: boolean; message?: string; data?: { status?: string } };
      return {
        providerReference: reference,
        status: mapVtgStatus(res),
        ...(mapVtgStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /api/v1/transaction-status — reference
    async getOrderStatus(reference) {
      const res = (await vtgPost("/api/v1/transaction-status", { reference })) as {
        status?: boolean;
        data?: { status?: string };
      };
      return { providerReference: reference, status: mapVtgStatus(res) };
    },

    // POST /api/v1/accountdetails
    async getBalance() {
      const res = (await vtgPost("/api/v1/accountdetails", {})) as {
        status?: boolean;
        data?: { balance?: number | string };
      };
      return {
        providerName: "vtugate",
        balanceMinor: Math.round(parseFloat(String(res.data?.balance ?? 0)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await vtgPost("/api/v1/accountdetails", {});
        return { providerName: "vtugate", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "vtugate",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "VTUGate health check failed"
        };
      }
    },

    // POST /api/v1/verify-electricity — disco, meter_number, meter_type (prepaid/postpaid)
    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        const res = (await vtgPost("/api/v1/verify-electricity", {
          disco: input.disco,
          meter_number: input.meterNumber,
          meter_type: input.meterType.toLowerCase()
        })) as {
          status?: boolean;
          data?: { customer_name?: string; address?: string; minimum_amount?: number };
        };
        if (!res.status) return { valid: false };
        return {
          valid: true,
          ...(res.data?.customer_name ? { customerName: res.data.customer_name } : {}),
          ...(res.data?.address ? { address: res.data.address } : {}),
          ...(res.data?.minimum_amount ? { minAmountMinor: Math.round(res.data.minimum_amount * 100) } : {})
        };
      } catch { return { valid: false }; }
    },

    // POST /api/v1/buy-electricity — disco, meter_number, meter_type, amount, phone, reference
    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      const res = (await vtgPost("/api/v1/buy-electricity", {
        disco: input.disco,
        meter_number: input.meterNumber,
        meter_type: input.meterType.toLowerCase(),
        amount: input.amountMinor / 100,
        phone: input.phoneNumber,
        reference: input.reference
      })) as {
        status?: boolean;
        message?: string;
        data?: { status?: string; token?: string; units?: string };
      };
      return {
        providerReference: input.reference,
        status: mapVtgStatus(res),
        ...(res.data?.token ? { token: res.data.token } : {}),
        ...(res.data?.units ? { units: res.data.units } : {}),
        ...(mapVtgStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /api/v1/verify-cable — provider, smartcard_number
    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      try {
        const res = (await vtgPost("/api/v1/verify-cable", {
          provider: input.provider.toLowerCase(),
          smartcard_number: input.smartCardNumber
        })) as { status?: boolean; data?: { customer_name?: string } };
        return {
          valid: res.status === true,
          ...(res.data?.customer_name ? { customerName: res.data.customer_name } : {})
        };
      } catch { return { valid: false }; }
    },

    // POST /api/v1/buy-cable — provider, smartcard_number, package_code, phone, reference
    async purchaseCable(input): Promise<VtuSubmitResult> {
      const res = (await vtgPost("/api/v1/buy-cable", {
        provider: input.provider.toLowerCase(),
        smartcard_number: input.smartCardNumber,
        package_code: input.packageCode,
        phone: input.phoneNumber,
        reference: input.reference
      })) as { status?: boolean; message?: string; data?: { status?: string } };
      return {
        providerReference: input.reference,
        status: mapVtgStatus(res),
        ...(mapVtgStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    // POST /api/v1/get-education-price — exam_type
    async listEducationPlans(): Promise<VtuEducationPlanOffer[]> {
      try {
        const examTypes = ["waec", "neco", "nabteb", "jamb"];
        const results: VtuEducationPlanOffer[] = [];
        for (const examType of examTypes) {
          const res = (await vtgPost("/api/v1/get-education-price", { exam_type: examType })) as {
            status?: boolean;
            data?: { price?: number; name?: string };
          };
          if (res.status && res.data) {
            results.push({
              productCode: examType,
              displayName: res.data.name ?? examType.toUpperCase(),
              costMinor: Math.round((res.data.price ?? 0) * 100),
              currency: "NGN"
            });
          }
        }
        return results;
      } catch { return []; }
    },

    // POST /api/v1/buy-education — exam_type, quantity, reference
    async purchaseEducation(input): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }> {
      const examMap: Record<string, string> = {
        waecdirect: "waec", "waec-registraion": "waec", neco: "neco",
        nabteb: "nabteb", de: "jamb", "utme-mock": "jamb", "utme-no-mock": "jamb"
      };
      const res = (await vtgPost("/api/v1/buy-education", {
        exam_type: examMap[input.examType] ?? input.examType.toLowerCase(),
        quantity: 1,
        reference: input.reference
      })) as {
        status?: boolean;
        message?: string;
        data?: { status?: string; pin?: string; serial_number?: string };
      };
      return {
        providerReference: input.reference,
        status: mapVtgStatus(res),
        ...(res.data?.pin ? { pin: res.data.pin } : {}),
        ...(res.data?.serial_number ? { serialNumber: res.data.serial_number } : {}),
        ...(mapVtgStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    }
  };
}
