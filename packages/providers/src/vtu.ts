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

/** Stringify a value pulled from an untyped provider response, without risking '[object Object]'. */
function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
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
//
// NECO and NABTEB are deliberately absent too, and must stay absent until a real
// price is read from the provider. purchaseEducation() below accepts both, and
// listEducationPlans() now surfaces whatever the live endpoint returns for them —
// but this is the OFFLINE fallback table, and a guessed cost here would be sold
// as fact and could sell below cost. An unpriced exam type failing closed is the
// correct behaviour; inventing a number is not.
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

        // Read EVERY exam-type key in the response, not just WAEC.
        //
        // This used to pick out res["WAEC"] alone, so any other exam type the
        // endpoint returned — NECO and NABTEB are both mapped by purchaseEducation
        // below — was silently dropped on the floor. That is why NECO could never
        // appear in the catalog no matter how often education_catalog_sync ran:
        // the sync was working, the extraction was discarding the rows.
        const entries = Array.isArray(res) ? res : Object.values(res ?? {}).flat();
        const offers: VtuEducationPlanOffer[] = [];
        for (const entry of entries ?? []) {
          if (!entry?.PRODUCT_CODE) continue;
          const costMinor = Math.round(parseFloat(String(entry.PRODUCT_AMOUNT ?? 0)) * 100);
          // A zero/unparseable price is not a free product — it is a row we
          // cannot price. Skip it rather than seeding a plan that would sell at
          // no cost. (JAMB comes back with no usable rows at this account tier;
          // this is what keeps that from turning into a ₦0 plan.)
          if (!Number.isFinite(costMinor) || costMinor <= 0) continue;
          offers.push({
            productCode: entry.PRODUCT_CODE,
            displayName: entry.PRODUCT_NAME ?? entry.PRODUCT_CODE,
            costMinor,
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
// Status: DISCOVERED (docs verified, no credential provisioned yet)
// Implementation now matches Swiftlink's official API docs (swiftlinkng.com/api).
// Auth: Authorization: Bearer <token> (a token provisioned once via the
// swiftlinkng.com dashboard — the docs also show POST /login, but every other
// endpoint uses a static bearer token, so we treat this like the other
// static-API-key adapters rather than performing a login flow per call).
//
// Verified endpoints:
//   GET  /get/plans                                — data plan catalog
//   POST /purchase/airtime  { amount, phonenumber, subcategory_id, ported?, customer_reference? }
//   POST /purchase/data     { plan_id, phonenumber, subcategory_id, ported?, customer_reference? }
//   GET  /fetch/bouquet?plan=gotv|dstv|startimes    — cable plans
//   GET  /fetch/bouquet?plan={disco title}          — electricity plans
//   GET  /fetch/ringobouquet?serviceID=ELECT        — alt electricity catalog
//   POST /verify/card       { plan, cardno[, type] } — cable card / meter / exam number verify
//   POST /purchase/cable    { plan, phonenumber, amount, cardno, variation_code, customer_reference? }
//   POST /purchase/electricity { plan, phonenumber, amount, cardno, variation_code, serviceID }
//   GET  /requery/{ref}     — order status
//
// Webhook/response status codes: 1 = success, 0 = pending, 4 = failed, 2 = manually reversed.
//
// `subcategory_id` is required on both purchase/airtime and purchase/data, and
// the docs never explain how it maps to network or product — they only show a
// bare example. It is discoverable all the same: /get/plans returns every
// product family as a group carrying its own subcategory_id and a title that
// names the network, for airtime and data alike.
//
//   { subcategory_id: 8,  title: "MTN",      category: "Airtime" }
//   { subcategory_id: 1,  title: "MTN SME",  category: "Data", plan: [...] }
//
// So neither map has to be configured by hand:
//   - data    — listDataPlans encodes "<subcategory_id>:<plan label>" into
//               providerPlanId, because subcategory is per FAMILY (MTN SME 1,
//               MTN BETA 47, MTN HYNET 45) and one network spans several.
//   - airtime — resolved from the same response on first use and cached, since
//               there is exactly one airtime group per network.
//
// config.airtimeSubcategoryId / config.dataSubcategoryId remain as manual
// overrides for when Swiftlink's catalogue disagrees with what an account can
// actually buy. Leave them unset unless you have a reason.
//
// Required env vars: SWIFTLINK_API_KEY. Optional: SWIFTLINK_BASE_URL.

export interface SwiftlinkConfig {
  /** Static bearer token from the dashboard. Takes precedence over email/password. */
  apiKey?: string;
  /** Dashboard login, used only when no apiKey is set. See swiftlinkLogin. */
  email?: string;
  password?: string;
  baseUrl?: string;
  /** Network → subcategory_id override for airtime. Resolved from /get/plans when unset. */
  airtimeSubcategoryId?: Partial<Record<VtuNetwork, string>>;
  /** Network → subcategory_id override for data. Normally carried in providerPlanId instead. */
  dataSubcategoryId?: Partial<Record<VtuNetwork, string>>;
  fetcher?: typeof fetch;
}

interface SwiftlinkPlanGroup {
  subcategory_id?: number | string;
  title?: string;
  category?: string;
  plan?: Array<{ plan?: string; amount?: number | string }>;
}

/**
 * Airtime subcategory ids, cached across adapter instances.
 *
 * VtuService.buildAdapter and the worker's buildAdapter both construct a fresh
 * adapter per call, so an instance-level cache would mean re-pulling the entire
 * catalogue on every airtime purchase — a large response on a money path. These
 * ids are product families that effectively never change, so a process-wide
 * cache with a generous TTL is the right shape.
 *
 * Keyed on base URL rather than credential: subcategory ids are global to
 * Swiftlink's catalogue, not per-account, so two accounts may share an entry —
 * and it keeps API keys out of a long-lived map.
 */
const swiftlinkAirtimeSubcategories = new Map<
  string,
  { resolvedAt: number; map: Partial<Record<VtuNetwork, string>> }
>();
const swiftlinkElectricityServices = new Map<
  string,
  { resolvedAt: number; map: Record<string, { title: string; serviceID: string }> }
>();
const swiftlinkSubcategoryTtlMs = 30 * 60 * 1000;

/**
 * Tokens from POST /login, cached across adapter instances for the same reason
 * the subcategories are. Keyed on base URL + email because unlike a subcategory
 * id a token is per-account; the password is never part of the key.
 *
 * The docs do not state a lifetime, so this does not try to guess one: entries
 * are held briefly and, more importantly, dropped and re-fetched on the first
 * 401. Expiry is discovered rather than assumed.
 */
const swiftlinkTokens = new Map<string, { issuedAt: number; token: string }>();
const swiftlinkTokenTtlMs = 30 * 60 * 1000;

/** Test seam — both caches are process-wide and would otherwise leak between cases. */
export function resetSwiftlinkCaches() {
  swiftlinkAirtimeSubcategories.clear();
  swiftlinkElectricityServices.clear();
  swiftlinkTokens.clear();
}

/**
 * Parses a Swiftlink subcategory map from an env string.
 *
 * Format: "MTN:1,GLO:2,AIRTEL:3,NINE_MOBILE:4"
 *
 * subcategory_id is REQUIRED on /purchase/data and /purchase/airtime, and it is
 * not discoverable through the API — it comes off the Swiftlink dashboard. It
 * was never wired through from configuration, so every purchase failed with
 * "subcategory_id not configured" before the request was even sent.
 */
export function parseSwiftlinkSubcategoryMap(
  raw: string | undefined
): Partial<Record<VtuNetwork, string>> {
  if (!raw?.trim()) return {};
  const out: Partial<Record<VtuNetwork, string>> = {};
  for (const pair of raw.split(",")) {
    const [network, id] = pair.split(":").map((part) => part.trim());
    if (!network || !id) continue;
    out[network.toUpperCase() as VtuNetwork] = id;
  }
  return out;
}

/** Swiftlink group titles carry the network: "MTN SME", "9MOBILE SPECIAL", ... */
function swiftlinkNetworkFromTitle(title: string): VtuNetwork | undefined {
  if (title.startsWith("MTN")) return "MTN";
  if (title.startsWith("AIRTEL")) return "AIRTEL";
  if (title.startsWith("GLO")) return "GLO";
  if (title.startsWith("9MOBILE")) return "NINE_MOBILE";
  return undefined;
}

/**
 * Swiftlink's own family names do not map cleanly onto VtuPlanType, which only
 * has SME | CG | GIFTING | CORPORATE. "[CG]" in a plan label is authoritative;
 * SPECIAL and BETA families are CG-priced. DIRECT/HYNET/AWOOOF are retail-style
 * products with no closer bucket than GIFTING — the real family name is kept in
 * displayName so nothing is lost.
 */
function swiftlinkPlanType(title: string, label: string): VtuPlanType {
  if (/\[CG\]/i.test(label)) return "CG";
  if (/SME/.test(title)) return "SME";
  if (/SPECIAL|BETA/.test(title)) return "CG";
  if (/CORPORATE/.test(title)) return "CORPORATE";
  return "GIFTING";
}

/** "1GB for 30 days" -> 1024. "1GB/1.8GB" takes the main bucket, not the total. */
function parseSwiftlinkSizeMb(label: string): number {
  const tb = label.match(/(\d+(?:\.\d+)?)\s*TB/i);
  if (tb) return Math.round(parseFloat(tb[1]!) * 1024 * 1024);
  const gb = label.match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (gb) return Math.round(parseFloat(gb[1]!) * 1024);
  const mb = label.match(/(\d+(?:\.\d+)?)\s*MB/i);
  if (mb) return Math.round(parseFloat(mb[1]!));
  return 0;
}

/** "for 30 days" / "2 Days plan" / "Daily" / "weekly" / "6 Months" / "365days". */
function parseSwiftlinkValidityDays(label: string): number {
  const months = label.match(/(\d+)\s*Month/i);
  if (months) return parseInt(months[1]!, 10) * 30;
  const days = label.match(/(\d+)\s*day/i);
  if (days) return parseInt(days[1]!, 10);
  if (/daily/i.test(label)) return 1;
  if (/weekly/i.test(label)) return 7;
  if (/yearly/i.test(label)) return 365;
  return 30;
}

function mapSwiftlinkStatus(status: unknown): VtuSubmitStatus {
  const code = typeof status === "string" ? parseInt(status, 10) : status;
  if (code === 1) return "DELIVERED";
  if (code === 0) return "SUBMITTED";
  if (code === 4) return "FAILED";
  if (code === 2) return "FAILED"; // manually reversed — funds already returned, terminal.
  return "AMBIGUOUS";
}

export function createSwiftlinkAdapter(config: SwiftlinkConfig): VtuProviderAdapter {
  const base = (config.baseUrl ?? "https://swiftlinkng.com/api").replace(/\/$/, "");
  const f = config.fetcher ?? fetch;
  const tokenCacheKey = `${base}|${config.email ?? ""}`;

  /**
   * UNVERIFIED CONTRACT — no Swiftlink credential has been exercised against
   * /login, and the docs are not in this repo. Assumed here: form-encoded
   * { email, password } in, a token somewhere in the JSON out. The response is
   * read tolerantly (token / access_token, bare or nested under data) so a
   * plausible variation still works.
   *
   * Only reached when no apiKey is configured, so a wrong guess degrades to
   * "login mode does not work" rather than affecting the static-token path.
   * If Swiftlink rejects it, this function is the single place to correct.
   */
  async function swiftlinkLogin(email: string, password: string): Promise<string> {
    const res = await f(`${base}/login`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({ email, password })
    });

    if (!res.ok) {
      throw new Error(`Swiftlink POST /login → HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      token?: unknown;
      access_token?: unknown;
      data?: { token?: unknown; access_token?: unknown };
    };
    const token =
      asString(body.token) ||
      asString(body.access_token) ||
      asString(body.data?.token) ||
      asString(body.data?.access_token);

    if (!token) {
      throw new Error("Swiftlink /login returned no token");
    }

    return token;
  }

  async function bearerToken(forceRefresh = false): Promise<string> {
    // A static dashboard token wins and never expires as far as we know.
    if (config.apiKey) {
      return config.apiKey;
    }
    if (!config.email || !config.password) {
      throw new Error("Swiftlink needs SWIFTLINK_API_KEY, or SWIFTLINK_EMAIL and SWIFTLINK_PASSWORD");
    }

    const cached = swiftlinkTokens.get(tokenCacheKey);
    if (!forceRefresh && cached && Date.now() - cached.issuedAt < swiftlinkTokenTtlMs) {
      return cached.token;
    }

    const token = await swiftlinkLogin(config.email, config.password);
    swiftlinkTokens.set(tokenCacheKey, { issuedAt: Date.now(), token });

    return token;
  }

  async function authHeaders(forceRefresh = false) {
    return {
      Authorization: `Bearer ${await bearerToken(forceRefresh)}`,
      Accept: "application/json"
    };
  }

  /**
   * Runs a request, and on a 401 discards the cached token and tries once more.
   * That is what lets the unknown token lifetime be harmless — an expired token
   * costs one retry rather than a failed purchase. Retrying a POST is safe here
   * because a 401 means the request was rejected before it did anything, and
   * every purchase carries the caller's customer_reference for idempotency.
   */
  async function withAuthRetry(send: (headers: Record<string, string>) => Promise<Response>) {
    let res = await send(await authHeaders());

    if (res.status === 401 && !config.apiKey) {
      swiftlinkTokens.delete(tokenCacheKey);
      res = await send(await authHeaders(true));
    }

    return res;
  }

  async function swiftGet(path: string): Promise<unknown> {
    const res = await withAuthRetry((headers) => f(`${base}${path}`, { headers }));
    if (!res.ok) throw new Error(`Swiftlink GET ${path} → HTTP ${res.status}`);
    return res.json();
  }

  // Swiftlink's docs specify "Body formdata" for POST requests, not JSON.
  async function swiftPost(path: string, body: Record<string, string>): Promise<unknown> {
    const res = await withAuthRetry((headers) =>
      f(`${base}${path}`, {
        method: "POST",
        headers,
        // Rebuilt per attempt: a URLSearchParams body is a stream that cannot be
        // replayed once the first attempt has consumed it.
        body: new URLSearchParams(body)
      })
    );
    if (!res.ok) throw new Error(`Swiftlink POST ${path} → HTTP ${res.status}`);
    return res.json();
  }

  async function fetchPlanGroups(): Promise<SwiftlinkPlanGroup[]> {
    const res = (await swiftGet("/get/plans")) as { data?: SwiftlinkPlanGroup[] };

    return res.data ?? [];
  }

  /**
   * Airtime groups look like { subcategory_id: 8, title: "MTN", category: "Airtime" }
   * — one per network, no nested plan list. First match wins; a network absent
   * from the catalogue is a network this account cannot sell.
   */
  async function resolveAirtimeSubcategories() {
    const map: Partial<Record<VtuNetwork, string>> = {};

    for (const group of await fetchPlanGroups()) {
      if (String(group.category ?? "").toLowerCase() !== "airtime") continue;

      const network = swiftlinkNetworkFromTitle(asString(group.title).toUpperCase());
      const subcategoryId = asString(group.subcategory_id);

      if (network && subcategoryId && !map[network]) {
        map[network] = subcategoryId;
      }
    }

    return map;
  }

  async function airtimeSubcategoryFor(network: VtuNetwork) {
    // An explicit override always wins — that is the point of configuring one.
    const configured = config.airtimeSubcategoryId?.[network];
    if (configured) {
      return configured;
    }

    const cached = swiftlinkAirtimeSubcategories.get(base);
    if (cached && Date.now() - cached.resolvedAt < swiftlinkSubcategoryTtlMs) {
      return cached.map[network];
    }

    // A failure here propagates rather than resolving to FAILED: a catalogue
    // fetch that times out is transient and worth a retry, whereas marking the
    // order failed would refund a customer over a blip.
    const map = await resolveAirtimeSubcategories();
    swiftlinkAirtimeSubcategories.set(base, { resolvedAt: Date.now(), map });

    return map[network];
  }

  async function resolveElectricityServices() {
    const map: Record<string, { title: string; serviceID: string }> = {};

    for (const group of await fetchPlanGroups()) {
      if (String(group.category ?? "").toLowerCase() !== "electricity") continue;
      const title = asString(group.title);
      const serviceID = asString((group as SwiftlinkPlanGroup & { serviceID?: unknown }).serviceID);
      if (!title) continue;
      map[title.toLowerCase()] = { title, serviceID: serviceID || title };
      if (serviceID) map[serviceID.toLowerCase()] = { title, serviceID };
    }

    return map;
  }

  async function electricityServiceFor(disco: string) {
    const cached = swiftlinkElectricityServices.get(base);
    if (cached && Date.now() - cached.resolvedAt < swiftlinkSubcategoryTtlMs) {
      return cached.map[disco.toLowerCase()] ?? { title: disco, serviceID: disco };
    }

    const map = await resolveElectricityServices();
    swiftlinkElectricityServices.set(base, { resolvedAt: Date.now(), map });

    return map[disco.toLowerCase()] ?? { title: disco, serviceID: disco };
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
      vtuCapabilities("weak", ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "EDUCATION"]),

    buildReference(order) {
      return `SWL${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(network) {
      return Promise.resolve(AIRTIME_DISCOUNT_BPS[network] ?? 300);
    },

    async listDataPlans(_network) {
      // GET /get/plans returns GROUPS, not a flat plan list:
      //   data[] -> { subcategory_id, title, category, plan[] -> { plan, amount } }
      //
      // This previously read a flat array looking for network/plan_id/price, none
      // of which exist at any level. Every row came back network "MTN", an empty
      // plan id and costMinor 0 — the catalog sync would have written free data
      // plans. Parsed against the real response now.
      //
      // providerPlanId encodes "<subcategory_id>:<plan>" because a Swiftlink
      // purchase needs BOTH: subcategory_id identifies the product family
      // (MTN SME = 1, MTN SPECIAL = 2, MTN DIRECT = 25 ...) and plan_id is the
      // plan's own label string ("1GB for 30 days"). Keying subcategory by
      // network alone cannot work — one network spans several families.
      const groups = await fetchPlanGroups();

      const offers: VtuPlanOffer[] = [];

      for (const group of groups) {
        if (String(group.category ?? "").toLowerCase() !== "data") continue;

        const title = asString(group.title).toUpperCase();
        const network = swiftlinkNetworkFromTitle(title);
        if (!network) continue;

        const subcategoryId = asString(group.subcategory_id);
        if (!subcategoryId) continue;

        for (const entry of group.plan ?? []) {
          const label = asString(entry.plan);
          const costMinor = Math.round(parseFloat(asString(entry.amount, "0")) * 100);
          // A zero or unparseable amount is not a free plan — skip rather than
          // publish something that would sell data for nothing.
          if (!label || !Number.isFinite(costMinor) || costMinor <= 0) continue;

          offers.push({
            providerPlanId: `${subcategoryId}:${label}`,
            network,
            planType: swiftlinkPlanType(title, label),
            displayName: `${group.title} ${label}`.trim(),
            sizeMb: parseSwiftlinkSizeMb(label),
            validityDays: parseSwiftlinkValidityDays(label),
            costMinor,
            currency: "NGN"
          });
        }
      }

      return offers;
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const subcategoryId = await airtimeSubcategoryFor(network);
      if (!subcategoryId) {
        return {
          providerReference: reference,
          status: "FAILED",
          failureReason: `Swiftlink does not offer airtime for ${network} on this account`
        };
      }
      const res = (await swiftPost("/purchase/airtime", {
        amount: (faceValueMinor / 100).toFixed(2),
        phonenumber: msisdn,
        subcategory_id: subcategoryId,
        customer_reference: reference
      })) as { status?: number | string; response?: string };
      const status = mapSwiftlinkStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.response ?? "Swiftlink airtime failed" } : {})
      };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      // listDataPlans encodes "<subcategory_id>:<plan label>". Prefer that, since
      // subcategory is per product FAMILY (MTN SME 1, MTN SPECIAL 2, MTN DIRECT
      // 25) and cannot be derived from the network. The configured per-network
      // map remains a fallback for plans that predate the encoding.
      const separator = providerPlanId.indexOf(":");
      const encodedSubcategory = separator > 0 ? providerPlanId.slice(0, separator) : undefined;
      const planLabel = separator > 0 ? providerPlanId.slice(separator + 1) : providerPlanId;
      const subcategoryId = encodedSubcategory ?? config.dataSubcategoryId?.[network];

      if (!subcategoryId) {
        return {
          providerReference: reference,
          status: "FAILED",
          failureReason: `Swiftlink data subcategory_id not resolvable for ${network}`
        };
      }
      const res = (await swiftPost("/purchase/data", {
        plan_id: planLabel,
        phonenumber: msisdn,
        subcategory_id: subcategoryId,
        customer_reference: reference
      })) as { status?: number | string; response?: string };
      const status = mapSwiftlinkStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.response ?? "Swiftlink data failed" } : {})
      };
    },

    async getOrderStatus(reference) {
      const res = (await swiftGet(`/requery/${encodeURIComponent(reference)}`)) as {
        status?: number | string;
        response?: string;
      };
      const status = mapSwiftlinkStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(res.response ? { failureReason: res.response } : {})
      };
    },

    getBalance() {
      // No dedicated balance endpoint is documented for Swiftlink. /get/plans is used
      // as a lightweight authenticated probe for checkHealth; getBalance is unsupported.
      return Promise.resolve({ providerName: "swiftlink", balanceMinor: 0, currency: "NGN" });
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await swiftGet("/get/plans");
        return { providerName: "swiftlink", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "swiftlink",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "Swiftlink health check failed"
        };
      }
    },

    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        const service = await electricityServiceFor(input.disco);
        const res = (await swiftPost("/verify/card", {
          plan: service.serviceID,
          cardno: input.meterNumber,
          type: input.meterType === "PREPAID" ? "Prepaid" : "Postpaid"
        })) as { customer_name?: string; name?: string; address?: string };
        const name = res.customer_name ?? res.name;
        if (!name) return { valid: false };
        return { valid: true, customerName: name, ...(res.address ? { address: res.address } : {}) };
      } catch {
        return { valid: false };
      }
    },

    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      try {
        const service = await electricityServiceFor(input.disco);
        const res = (await swiftPost("/purchase/electricity", {
          plan: service.title,
          phonenumber: input.phoneNumber,
          amount: (input.amountMinor / 100).toFixed(2),
          cardno: input.meterNumber,
          variation_code: input.meterType === "PREPAID" ? "Prepaid" : "Postpaid",
          serviceID: service.serviceID,
          customer_reference: input.reference
        })) as { status?: number | string; response?: string; token?: string; units?: string };
        const status = mapSwiftlinkStatus(res.status);
        return {
          providerReference: input.reference,
          status,
          ...(res.token ? { token: res.token } : {}),
          ...(res.units ? { units: res.units } : {}),
          ...(status === "FAILED" ? { failureReason: res.response ?? "Swiftlink electricity failed" } : {})
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Swiftlink electricity error"
        };
      }
    },

    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      try {
        const res = (await swiftPost("/verify/card", {
          plan: input.provider,
          cardno: input.smartCardNumber
        })) as { customer_name?: string; name?: string };
        const name = res.customer_name ?? res.name;
        if (!name) return { valid: false };
        return { valid: true, customerName: name };
      } catch {
        return { valid: false };
      }
    },

    async listCablePackages(): Promise<VtuCablePackageOffer[]> {
      const providers = ["gotv", "dstv", "startimes"] as const;
      const offers: VtuCablePackageOffer[] = [];
      for (const provider of providers) {
        try {
          const res = (await swiftGet(`/fetch/bouquet?plan=${provider}`)) as
            | { data?: Array<Record<string, unknown>> }
            | Array<Record<string, unknown>>;
          const rows = Array.isArray(res) ? res : (res.data ?? []);
          for (const p of rows) {
            offers.push({
              cableProvider: provider,
              packageCode: asString(p["variation_code"] ?? p["code"]),
              displayName: asString(p["name"] ?? p["package"]),
              costMinor: Math.round(
                parseFloat(asString(p["variation_amount"] ?? p["price"] ?? p["amount"], "0")) * 100
              ),
              currency: "NGN"
            });
          }
        } catch {
          // Skip providers whose bouquet fetch fails.
        }
      }
      return offers;
    },

    async purchaseCable(input): Promise<VtuSubmitResult> {
      try {
        const res = (await swiftPost("/purchase/cable", {
          plan: input.provider,
          phonenumber: input.phoneNumber,
          amount: "0", // Cable amount is derived from variation_code by Swiftlink; caller-priced.
          cardno: input.smartCardNumber,
          variation_code: input.packageCode,
          customer_reference: input.reference
        })) as { status?: number | string; response?: string };
        const status = mapSwiftlinkStatus(res.status);
        return {
          providerReference: input.reference,
          status,
          ...(status === "FAILED" ? { failureReason: res.response ?? "Swiftlink cable failed" } : {})
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Swiftlink cable error"
        };
      }
    },

    verifyJambProfile(input): Promise<VtuMeterValidation> {
      return swiftPost("/verify/card", {
        plan: "JAMB",
        cardno: input.profileId
      })
        .then((res) => {
          const body = res as { customer_name?: string; name?: string; response?: string };
          const name = body.customer_name ?? body.name;
          return {
            valid: true,
            ...(name ? { customerName: name } : {}),
            ...(body.response ? { address: body.response } : {})
          };
        })
        .catch(() => ({ valid: false }));
    },

    listEducationPlans(): Promise<VtuEducationPlanOffer[]> {
      // Swiftlink's /get/plans advertises exam categories but does not include
      // a cost in the documented payload. Do not publish an unpriced plan.
      return Promise.resolve([]);
    },

    async purchaseEducation(input): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }> {
      try {
        const exam = input.examType.toLowerCase();
        const plan = exam === "jamb" || exam === "utme" || exam === "utme_pin" ? "Jamb" : input.examType;
        const variationCode = exam === "jamb" || exam === "utme" || exam === "utme_pin" ? "jamb" : exam;
        const res = (await swiftPost("/purchase/exam", {
          plan,
          phonenumber: input.phoneNumber,
          cardno: input.profileId ?? "",
          variation_code: variationCode,
          customer_reference: input.reference
        })) as {
          status?: number | string;
          response?: string;
          pin?: string;
          serial?: string;
          serialNumber?: string;
          data?: { pin?: string; serial?: string; serialNumber?: string };
        };
        const status = mapSwiftlinkStatus(res.status);
        const pin = res.pin ?? res.data?.pin;
        const serialNumber = res.serialNumber ?? res.serial ?? res.data?.serialNumber ?? res.data?.serial;
        return {
          providerReference: input.reference,
          status,
          ...(pin ? { pin } : {}),
          ...(serialNumber ? { serialNumber } : {}),
          ...(status === "FAILED" ? { failureReason: res.response ?? "Swiftlink exam purchase failed" } : {})
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "Swiftlink exam purchase error"
        };
      }
    }
  };
}

// ─── eBills full adapter (ebill.com.ng — airtime, data, electricity, cable, education) ──
// Status: CONFIGURED (docs verified against ebill.com.ng's official API documentation)
// NOTE: the real host is ebill.com.ng — NOT api.ebills.ng, which was the previous
// (wrong) placeholder base URL. Auth header is `Authorization: Token <token>`
// (not Bearer).
//
// Verified endpoints:
//   GET  /wallet_balance/     — wallet balance
//   POST /query_transaction/  { reference_no }
//   POST /data_topup/         { network, plan_id, mobileno, api_client_reference }
//   POST /airtime_topup/      { network, amount, mobile_number, api_client_reference }
//   POST /verifyelectricity/  { bill_prdt, metertype, meterno, amount }
//   POST /payelectricity/     { bill_prdt, metertype, meterno, amount }
//   POST /verifytv/           { company, iucno }
//   POST /paytv/              { company, iucno, package }
//   POST /waec/ /neco/ /nabteb/ { api_client_reference }  (quantity implicitly 1)
//
// Response envelope uses `"status": "successful"` (note: "successful", not "success").
//
// FOOTGUN, called out explicitly: eBills uses TWO DIFFERENT network-ID numbering
// schemes depending on the endpoint —
//   data_topup:    1=MTN, 2=AIRTEL, 3=GLO, 4=9MOBILE
//   airtime_topup: 2=MTN, 3=GLO,    4=AIRTEL, 5=9MOBILE
// These are intentionally kept as two separate maps below (EB_DATA_NETWORK /
// EB_AIRTIME_NETWORK) rather than one shared map — do not consolidate them.
//
// Required env vars: EBILLS_API_KEY, EBILLS_BASE_URL

export interface EBillsFullConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

// data_topup/ network IDs.
const EB_DATA_NETWORK: Record<VtuNetwork, string> = {
  MTN: "1",
  AIRTEL: "2",
  GLO: "3",
  NINE_MOBILE: "4"
};

// airtime_topup/ network IDs — deliberately DIFFERENT from EB_DATA_NETWORK above.
const EB_AIRTIME_NETWORK: Record<VtuNetwork, string> = {
  MTN: "2",
  GLO: "3",
  AIRTEL: "4",
  NINE_MOBILE: "5"
};

const EB_TV_COMPANY: Record<string, string> = {
  dstv: "1",
  gotv: "2",
  startimes: "3"
};

export function createEBillsFullAdapter(config: EBillsFullConfig): VtuProviderAdapter {
  const base = (config.baseUrl ?? "https://ebill.com.ng/api").replace(/\/$/, "");
  const f = config.fetcher ?? fetch;
  const headers = {
    Authorization: `Token ${config.apiKey}`,
    "Content-Type": "application/json"
  };

  async function ebPost(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await f(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`eBills POST ${path} → HTTP ${res.status}`);
    return res.json();
  }

  async function ebGet(path: string): Promise<unknown> {
    const res = await f(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`eBills GET ${path} → HTTP ${res.status}`);
    return res.json();
  }

  function mapEbStatus(status?: string): VtuSubmitStatus {
    // eBills reports "successful" — NOT "success" — on the happy path.
    const s = (status ?? "").toLowerCase();
    if (s === "successful" || s === "success" || s === "delivered") return "DELIVERED";
    if (s === "pending" || s === "processing") return "SUBMITTED";
    if (s === "failed" || s === "error") return "FAILED";
    return "AMBIGUOUS";
  }

  return {
    name: "ebills",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () =>
      vtuCapabilities("weak", ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "EDUCATION"]),

    buildReference(order) {
      return `EBL${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(_network) {
      // eBills doesn't publish per-network discount rates in the docs — 0.5% conservative default.
      return Promise.resolve(50);
    },

    listDataPlans(_network) {
      // eBills' docs don't document a data-plan-catalog endpoint (only GET /get-services?service=data,
      // whose response shape isn't shown) — plan IDs must come from VtuProviderSkuMapping.
      return Promise.resolve([]);
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const res = (await ebPost("/airtime_topup/", {
        network: EB_AIRTIME_NETWORK[network],
        amount: String(faceValueMinor / 100),
        mobile_number: msisdn,
        api_client_reference: reference
      })) as { status?: string; message?: string };
      const status = mapEbStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "eBills airtime failed" } : {})
      };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const res = (await ebPost("/data_topup/", {
        network: EB_DATA_NETWORK[network],
        plan_id: providerPlanId,
        mobileno: msisdn,
        api_client_reference: reference
      })) as { status?: string; message?: string };
      const status = mapEbStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: res.message ?? "eBills data failed" } : {})
      };
    },

    async getOrderStatus(reference) {
      const res = (await ebPost("/query_transaction/", { reference_no: reference })) as {
        status?: string;
        message?: string;
      };
      const status = mapEbStatus(res.status);
      return {
        providerReference: reference,
        status,
        ...(res.message ? { failureReason: res.message } : {})
      };
    },

    async getBalance() {
      const res = (await ebGet("/wallet_balance/")) as { balance?: number | string };
      return {
        providerName: "ebills",
        balanceMinor: Math.round(parseFloat(String(res.balance ?? 0)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await ebGet("/wallet_balance/");
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

    // POST /verifyelectricity/ — { bill_prdt, metertype, meterno, amount }
    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        const res = (await ebPost("/verifyelectricity/", {
          bill_prdt: input.disco,
          metertype: input.meterType.toLowerCase(),
          meterno: input.meterNumber,
          amount: "1000" // eBills requires a minimum-1000 amount even for verify-only calls per docs.
        })) as {
          success?: string | boolean;
          message?: string | { Customer_Name?: string; Address?: string; Min_Purchase_Amount?: number };
        };
        const ok = res.success === "true" || res.success === true;
        if (!ok || typeof res.message === "string") return { valid: false };
        const msg = res.message ?? {};
        return {
          valid: true,
          ...(msg.Customer_Name ? { customerName: msg.Customer_Name } : {}),
          ...(msg.Address ? { address: msg.Address } : {}),
          ...(msg.Min_Purchase_Amount ? { minAmountMinor: Math.round(msg.Min_Purchase_Amount * 100) } : {})
        };
      } catch {
        return { valid: false };
      }
    },

    // POST /payelectricity/ — { bill_prdt, metertype, meterno, amount }
    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      try {
        const res = (await ebPost("/payelectricity/", {
          bill_prdt: input.disco,
          metertype: input.meterType.toLowerCase(),
          meterno: input.meterNumber,
          amount: String(input.amountMinor / 100)
        })) as { status?: string; message?: string };
        const status = mapEbStatus(res.status);
        return {
          providerReference: input.reference,
          status,
          ...(status === "FAILED" ? { failureReason: res.message ?? "eBills electricity failed" } : {})
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "eBills electricity error"
        };
      }
    },

    // POST /verifytv/ — { company, iucno }
    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      try {
        const company = EB_TV_COMPANY[input.provider.toLowerCase()];
        if (!company) return { valid: false };
        const res = (await ebPost("/verifytv/", { company, iucno: input.smartCardNumber })) as {
          success?: string | boolean;
          message?: string | { Customer_Name?: string };
        };
        const ok = res.success === "true" || res.success === true;
        if (!ok || typeof res.message === "string") return { valid: false };
        const msg = res.message ?? {};
        return { valid: true, ...(msg.Customer_Name ? { customerName: msg.Customer_Name } : {}) };
      } catch {
        return { valid: false };
      }
    },

    // POST /paytv/ — { company, iucno, package }
    async purchaseCable(input): Promise<VtuSubmitResult> {
      try {
        const company = EB_TV_COMPANY[input.provider.toLowerCase()];
        if (!company) {
          return {
            providerReference: input.reference,
            status: "FAILED" as const,
            failureReason: `Unknown eBills cable provider: ${input.provider}`
          };
        }
        const res = (await ebPost("/paytv/", {
          company,
          iucno: input.smartCardNumber,
          package: input.packageCode
        })) as { status?: string; message?: string };
        const status = mapEbStatus(res.status);
        return {
          providerReference: input.reference,
          status,
          ...(status === "FAILED" ? { failureReason: res.message ?? "eBills cable failed" } : {})
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "eBills cable error"
        };
      }
    },

    // POST /waec/ /neco/ /nabteb/ — { api_client_reference }, quantity implicitly 1.
    async purchaseEducation(input): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }> {
      const examMap: Record<string, string> = { waec: "waec", neco: "neco", nabteb: "nabteb" };
      const path = examMap[input.examType.toLowerCase()];
      if (!path) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: `Unsupported eBills exam type: ${input.examType}`
        };
      }
      try {
        const res = (await ebPost(`/${path}/`, {
          api_client_reference: input.reference
        })) as { status?: string; message?: string; pin?: string; reference_no?: string };
        const status = mapEbStatus(res.status);
        // pin format is "PIN<=>SERIAL" per docs example.
        const [pin, serial] = (res.pin ?? "").split("<=>");
        return {
          providerReference: input.reference,
          status,
          ...(pin ? { pin } : {}),
          ...(serial ? { serialNumber: serial } : {}),
          ...(status === "FAILED" ? { failureReason: res.message ?? "eBills education pin failed" } : {})
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: err instanceof Error ? err.message : "eBills education pin error"
        };
      }
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
// /education is docs-verified (2026-08-15), including its response envelope:
//   { status: "success"|"error", message, data: { pinType, pins: [{ pin, serialNo }],
//     quantity, amount, reference, clientReference, date, type } }
// Note `pins` is an ARRAY and the serial field is `serialNo`, not `serialNumber`.
// Error cases ("Incorrect Service ID") return `data` as [] rather than an object,
// which mapTwStatus handles by falling back to the top-level status.
//
// Published API-tier pricing (topupwizard.com/pricing, retrieved 2026-08-15):
//   WAEC ₦3,450 | NECO ₦1,230 | NABTEB ₦800 | NBAIS ₦920
// Reference figures only — real prices come from POST /pricing via
// listEducationPlans(). Useful as a sanity check on a synced value.
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
            network: network ?? "MTN",
            planType: "SME",
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

    // POST /validateutility — serviceID (DISCO code), meterNum, meterType (01=prepaid, 02=postpaid)
    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        const res = (await twPost("/validateutility", {
          serviceID: input.disco,
          meterNum: input.meterNumber,
          meterType: input.meterType === "PREPAID" ? "01" : "02"
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

    // POST /payelectric — serviceID, amount, meterNum, meterType (01=prepaid, 02=postpaid), clientReference
    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      const res = (await twPost("/payelectric", {
        serviceID: input.disco,
        amount: input.amountMinor / 100,
        meterNum: input.meterNumber,
        meterType: input.meterType === "PREPAID" ? "01" : "02",
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

    // POST /validatecable — serviceID, cableNum (docs field name — NOT iucNum)
    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      try {
        const res = (await twPost("/validatecable", {
          serviceID: input.provider,
          cableNum: input.smartCardNumber
        })) as { status?: string; data?: { customerName?: string } };
        return {
          valid: res.status === "success",
          ...(res.data?.customerName ? { customerName: res.data.customerName } : {})
        };
      } catch { return { valid: false }; }
    },

    // POST /subcable — serviceID (package code), cableNum (docs field name — NOT iucNum), clientReference
    async purchaseCable(input): Promise<VtuSubmitResult> {
      const res = (await twPost("/subcable", {
        serviceID: input.packageCode,
        cableNum: input.smartCardNumber,
        clientReference: input.reference
      })) as { status?: string; message?: string; data?: { status?: string } };
      return {
        providerReference: input.reference,
        status: mapTwStatus(res),
        ...(mapTwStatus(res) === "FAILED" ? { failureReason: res.message } : {})
      };
    },

    async listEducationPlans(): Promise<VtuEducationPlanOffer[]> {
      // Fetch via POST /pricing with education type, once per exam board.
      //
      // This asked for serviceID "WAEC" and nothing else, so NECO, NABTEB and
      // NBAIS could never reach the catalog — even though purchaseEducation
      // below accepts whatever serviceID the catalog yields. Each board is
      // queried separately because the endpoint takes typeSingle: true; a
      // failure on one board must not lose the others, so they are settled
      // independently.
      //
      // Cross-check for whatever comes back: TopupWizard's published pricing
      // page (retrieved 2026-08-15) lists API-tier costs of WAEC ₦3,450,
      // NECO ₦1,230, NABTEB ₦800, NBAIS ₦920. Prices are taken from the live
      // response, not from these figures — they are here so a wildly different
      // synced value is recognisable as wrong.
      const boards = ["WAEC", "NECO", "NABTEB", "NBAIS"];
      const results = await Promise.allSettled(
        boards.map(async (serviceID) => {
          const res = (await twPost("/pricing", {
            serviceID,
            type: "education",
            typeSingle: true
          })) as {
            status?: string;
            data?: Array<{ serviceID?: string; name?: string; price?: number }>;
          };
          if (res.status !== "success") return [];
          return res.data ?? [];
        })
      );

      const offers: VtuEducationPlanOffer[] = [];
      const seen = new Set<string>();
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const p of result.value) {
          const productCode = p.serviceID ?? "";
          if (!productCode || seen.has(productCode)) continue;
          const costMinor = Math.round((p.price ?? 0) * 100);
          // An unpriced row is not a free product — skip rather than publish a
          // plan that would sell at no cost.
          if (!Number.isFinite(costMinor) || costMinor <= 0) continue;
          seen.add(productCode);
          offers.push({
            productCode,
            displayName: p.name ?? productCode,
            costMinor,
            currency: "NGN"
          });
        }
      }
      return offers;
    },

    // POST /education — serviceID, quantity, clientReference. Verified against
    // TopupWizard's published endpoint docs (2026-08-15).
    //
    // serviceID is a provider-specific NUMERIC catalog id (the docs' example
    // sends 100), obtained from POST /pricing with type "education". It is
    // passed through from input.examType, which is the productCode carried on
    // the VtuEducationPlan row that listEducationPlans() populated — so the two
    // agree as long as the catalog is the source of the code, which is why
    // buyEducation refuses to charge without a plan row.
    async purchaseEducation(input): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }> {
      const res = (await twPost("/education", {
        serviceID: input.examType,
        quantity: 1,
        clientReference: input.reference
      })) as {
        status?: string;
        message?: string;
        data?: {
          status?: string;
          pins?: Array<{ pin?: string; serialNo?: string }>;
        };
      };

      // The PIN is nested in data.pins[] as { pin, serialNo }.
      //
      // This read data.pin and data.serialNumber — neither of which the response
      // has — so a SUCCESSFUL purchase returned no PIN and no serial at all. The
      // order still settled DELIVERED, meaning the customer was charged and the
      // exam PIN, which is the entire product, was silently dropped on the floor.
      // Nothing errored, so nothing surfaced it.
      //
      // quantity is always 1 here, so there is exactly one entry to take; the
      // interface carries a single pin/serial pair.
      const first = res.data?.pins?.[0];
      const status = mapTwStatus(res);

      return {
        // Our clientReference, deliberately — getOrderStatus requeries via POST
        // /requerytrx keyed on clientReference, not on TopupWizard's own
        // data.reference.
        providerReference: input.reference,
        status,
        ...(first?.pin ? { pin: first.pin } : {}),
        ...(first?.serialNo ? { serialNumber: first.serialNo } : {}),
        ...(status === "FAILED" ? { failureReason: res.message } : {})
      };
    }
  };
}

// ─── SIRP Data adapter ────────────────────────────────────────────────────────
// Status: CONFIGURED (docs verified against SIRP Data's official Native API docs)
// NOTE: the docs are hosted at sirpdata.com, but the actual API host is
// sirpdata.com.ng — a different domain. Every endpoint URL below uses .com.ng.
// Auth header is `Authentication: Token <token>` (not `Authorization`).
//
// Verified endpoints:
//   GET  /balance
//   POST /airtime                        { networkId, type: "VTU", phone, amount, ref? }
//   GET  /fetch_direct_gifting_bundles?networkId=...
//   POST /data                           { networkId, datatypeId, planId, phone, ref? }
//   GET  /fetch_cable_tv_bouquets?cableType=...
//   POST /verify_cable_tv_customer       { cableType, smartcardNo }
//   POST /cabletv                        { cableType, bouquetId, smartcardNo, amount?, ref? }
//   POST /verify_electricity_meterno     { discoId, meterNo }
//   POST /electricity                    { discoId, meterNo, amount, ref? }
//   POST /educational-pins               { examType, quantity, phone, ref? }
//
// Response envelope: { code, description, time }. HTTP status codes are
// authoritative per SIRP's own docs: 200/201 = success, 400 = missing params,
// 401 = auth failed, 402 = unprocessable, 403 = forbidden, 409 = duplicate,
// 424 = transaction failed, 500+ = AMBIGUOUS ("mark requests outside 2xx/4xx
// clearly defined above as pending"). This adapter surfaces 500+ as AMBIGUOUS
// (never FAILED) so the service layer routes it to the existing
// financial-safety AMBIGUOUS path rather than treating it as a hard failure.
//
// Required env vars: SIRPDATA_API_KEY, SIRPDATA_BASE_URL

export interface SirpDataConfig {
  apiKey: string;
  baseUrl?: string; // default https://sirpdata.com.ng/api
  fetcher?: typeof fetch;
}

const SIRP_NETWORK: Record<VtuNetwork, string> = {
  MTN: "1",
  AIRTEL: "2",
  GLO: "3",
  NINE_MOBILE: "4"
};

const SIRP_TV_TYPE: Record<string, string> = {
  dstv: "DSTV",
  gotv: "GOTV",
  startimes: "STARTIMES"
};

interface SirpEnvelope {
  code?: string | number;
  description?: Record<string, unknown> | string;
  time?: string;
}

function mapSirpOutcome(httpStatus: number, _body: SirpEnvelope): VtuSubmitStatus {
  // HTTP status is authoritative per SIRP's docs, not the `code` field in the body.
  if (httpStatus === 200 || httpStatus === 201) return "DELIVERED";
  if (httpStatus === 424) return "FAILED";
  if (httpStatus >= 400 && httpStatus < 500) return "FAILED";
  if (httpStatus >= 500) return "AMBIGUOUS"; // "possibly delivered or it could still deliver"
  return "AMBIGUOUS";
}

function sirpErrorMessage(body: SirpEnvelope): string | undefined {
  if (typeof body.description === "string") return body.description;
  const desc = body.description as { errorResponse?: string; trueResponse?: string } | undefined;
  return desc?.errorResponse ?? desc?.trueResponse;
}

export function createSirpDataAdapter(config: SirpDataConfig): VtuProviderAdapter {
  const base = (config.baseUrl ?? "https://sirpdata.com.ng/api").replace(/\/$/, "");
  const f = config.fetcher ?? fetch;
  const headers = {
    Authentication: `Token ${config.apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  async function sirpRequest(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<{ httpStatus: number; body: SirpEnvelope }> {
    const res = await f(`${base}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let parsed: SirpEnvelope = {};
    try {
      parsed = (await res.json()) as SirpEnvelope;
    } catch {
      // Non-JSON body (e.g. gateway 5xx) — fall through with empty envelope;
      // the HTTP status alone still drives mapSirpOutcome.
    }
    return { httpStatus: res.status, body: parsed };
  }

  return {
    name: "sirpdata",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () =>
      vtuCapabilities("weak", ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "EDUCATION"]),

    buildReference(order) {
      return `SIRP${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(_network) {
      // Not published in SIRP's docs — conservative default until a live rate is observed.
      return Promise.resolve(200);
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const results: VtuPlanOffer[] = [];
      for (const net of networks) {
        try {
          const { httpStatus, body } = await sirpRequest(
            "GET",
            `/fetch_direct_gifting_bundles?networkId=${SIRP_NETWORK[net]}`
          );
          if (httpStatus !== 200) continue;
          const desc = body.description as
            | { bundles?: Array<{ planName?: string; planId?: string; networkPrice?: string }> }
            | undefined;
          for (const b of desc?.bundles ?? []) {
            if (!b.planId) continue;
            const name = b.planName ?? b.planId;
            const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = name.match(/(\d+)\s*MB/i);
            const dayMatch = name.match(/(\d+)\s*DAYS?/i);
            results.push({
              providerPlanId: b.planId,
              network: net,
              planType: "GIFTING",
              displayName: name,
              sizeMb: gbMatch ? Math.round(parseFloat(gbMatch[1]!) * 1024) : mbMatch ? parseInt(mbMatch[1]!) : 0,
              validityDays: dayMatch ? parseInt(dayMatch[1]!) : 30,
              costMinor: Math.round(parseFloat(String(b.networkPrice ?? 0)) * 100),
              currency: "NGN"
            });
          }
        } catch {
          // Skip networks that error.
        }
      }
      return results;
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const { httpStatus, body } = await sirpRequest("POST", "/airtime", {
        networkId: SIRP_NETWORK[network],
        type: "VTU",
        phone: msisdn,
        amount: (faceValueMinor / 100).toFixed(2),
        ref: reference
      });
      const status = mapSirpOutcome(httpStatus, body);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: sirpErrorMessage(body) ?? "SIRP Data airtime failed" } : {})
      };
    },

    // datatypeId (SME|SME2|DATA-SHARE|CG|DIRECT-GIFTING) is a per-plan attribute that must
    // come from VtuProviderSkuMapping alongside providerPlanId — this adapter defaults to
    // "SME" when the caller doesn't route a specific datatypeId through providerPlanId.
    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const { httpStatus, body } = await sirpRequest("POST", "/data", {
        networkId: SIRP_NETWORK[network],
        datatypeId: "SME",
        planId: providerPlanId,
        phone: msisdn,
        ref: reference
      });
      const status = mapSirpOutcome(httpStatus, body);
      return {
        providerReference: reference,
        status,
        ...(status === "FAILED" ? { failureReason: sirpErrorMessage(body) ?? "SIRP Data data failed" } : {})
      };
    },

    getOrderStatus(_reference) {
      // SIRP's docs don't document a requery/transaction-status endpoint — status must
      // be tracked from the original purchase response (and any webhook, if configured).
      return Promise.resolve({
        providerReference: _reference,
        status: "AMBIGUOUS" as const,
        failureReason: "SIRP Data has no documented order-status endpoint"
      });
    },

    async getBalance() {
      const { httpStatus, body } = await sirpRequest("GET", "/balance");
      if (httpStatus !== 200) {
        return { providerName: "sirpdata", balanceMinor: 0, currency: "NGN" };
      }
      const desc = body.description as { balance?: string } | undefined;
      return {
        providerName: "sirpdata",
        balanceMinor: Math.round(parseFloat(String(desc?.balance ?? 0)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        const { httpStatus } = await sirpRequest("GET", "/balance");
        return {
          providerName: "sirpdata",
          status: httpStatus === 200 ? ("HEALTHY" as const) : ("DEGRADED" as const),
          latencyMs: Date.now() - start
        };
      } catch (err) {
        return {
          providerName: "sirpdata",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "SIRP Data health check failed"
        };
      }
    },

    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        const { httpStatus, body } = await sirpRequest("POST", "/verify_electricity_meterno", {
          discoId: input.disco,
          meterNo: input.meterNumber
        });
        if (httpStatus !== 200) return { valid: false };
        const desc = body.description as { customerName?: string; customerAddress?: string } | undefined;
        return {
          valid: true,
          ...(desc?.customerName ? { customerName: desc.customerName } : {}),
          ...(desc?.customerAddress ? { address: desc.customerAddress } : {})
        };
      } catch {
        return { valid: false };
      }
    },

    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      const { httpStatus, body } = await sirpRequest("POST", "/electricity", {
        discoId: input.disco,
        meterNo: input.meterNumber,
        amount: (input.amountMinor / 100).toFixed(2),
        ref: input.reference
      });
      const status = mapSirpOutcome(httpStatus, body);
      const desc = body.description as { trueResponse?: { Token?: string } } | undefined;
      return {
        providerReference: input.reference,
        status,
        ...(desc?.trueResponse?.Token ? { token: desc.trueResponse.Token } : {}),
        ...(status === "FAILED" ? { failureReason: sirpErrorMessage(body) ?? "SIRP Data electricity failed" } : {})
      };
    },

    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      try {
        const cableType = SIRP_TV_TYPE[input.provider.toLowerCase()];
        if (!cableType) return { valid: false };
        const { httpStatus, body } = await sirpRequest("POST", "/verify_cable_tv_customer", {
          cableType,
          smartcardNo: input.smartCardNumber
        });
        if (httpStatus !== 200) return { valid: false };
        const desc = body.description as { customerName?: string } | undefined;
        return { valid: true, ...(desc?.customerName ? { customerName: desc.customerName } : {}) };
      } catch {
        return { valid: false };
      }
    },

    async listCablePackages(): Promise<VtuCablePackageOffer[]> {
      const offers: VtuCablePackageOffer[] = [];
      for (const [cableProvider, cableType] of Object.entries(SIRP_TV_TYPE)) {
        try {
          const { httpStatus, body } = await sirpRequest("GET", `/fetch_cable_tv_bouquets?cableType=${cableType}`);
          if (httpStatus !== 200) continue;
          const desc = body.description as
            | { bouquets?: Array<{ planName?: string; planId?: string; providerPrice?: string }> }
            | undefined;
          for (const bq of desc?.bouquets ?? []) {
            if (!bq.planId) continue;
            offers.push({
              cableProvider,
              packageCode: bq.planId,
              displayName: bq.planName ?? bq.planId,
              costMinor: Math.round(parseFloat(String(bq.providerPrice ?? 0)) * 100),
              currency: "NGN"
            });
          }
        } catch {
          // Skip providers whose bouquet fetch fails.
        }
      }
      return offers;
    },

    async purchaseCable(input): Promise<VtuSubmitResult> {
      const cableType = SIRP_TV_TYPE[input.provider.toLowerCase()];
      if (!cableType) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: `Unknown SIRP Data cable type: ${input.provider}`
        };
      }
      const { httpStatus, body } = await sirpRequest("POST", "/cabletv", {
        cableType,
        bouquetId: input.packageCode,
        smartcardNo: input.smartCardNumber,
        ref: input.reference
      });
      const status = mapSirpOutcome(httpStatus, body);
      return {
        providerReference: input.reference,
        status,
        ...(status === "FAILED" ? { failureReason: sirpErrorMessage(body) ?? "SIRP Data cable failed" } : {})
      };
    },

    // POST /educational-pins — { examType, quantity, phone, ref? }
    async purchaseEducation(input): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }> {
      const examMap: Record<string, string> = {
        waec: "waec_pin",
        neco: "neco_pin",
        utme: "utme_pin",
        jamb: "utme_pin",
        nabteb: "nabteb_pin"
      };
      const examType = examMap[input.examType.toLowerCase()] ?? input.examType;
      const { httpStatus, body } = await sirpRequest("POST", "/educational-pins", {
        examType,
        quantity: 1,
        phone: input.phoneNumber,
        ref: input.reference
      });
      const status = mapSirpOutcome(httpStatus, body);
      const desc = body.description as { trueResponse?: Record<string, string> } | undefined;
      const firstPin = desc?.trueResponse ? Object.values(desc.trueResponse)[0] : undefined;
      return {
        providerReference: input.reference,
        status,
        ...(firstPin ? { pin: firstPin } : {}),
        ...(status === "FAILED" ? { failureReason: sirpErrorMessage(body) ?? "SIRP Data education pin failed" } : {})
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
    // DATA only. EDUCATION was declared here but no purchaseEducation method is
    // implemented, so the router could select this adapter for an education
    // order and kill it at "Selected provider does not support education
    // purchases" — after the balance check, so no money was lost, but the
    // customer got a hard failure for a product we advertised.
    getCapabilities: () => vtuCapabilities("weak", ["DATA"]),

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
          planType: "SME",
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
    validateMeter(_input): Promise<VtuMeterValidation> {
      // Inlomax does not document a separate meter validation endpoint; validation is implicit
      // in the electricity payment call. Skip to avoid charging on a preflight.
      return Promise.resolve({ valid: true });
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
    verifyCableCustomer(_input): Promise<VtuMeterValidation> {
      return Promise.resolve({ valid: true }); // Inlomax docs don't list a cable verify endpoint
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
            network: network ?? "MTN",
            planType: "SME",
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

// ─── IACafe adapter ───────────────────────────────────────────────────────────
// Status: CONFIGURED (docs verified against IA-Café's official developer docs,
// iacafe.com.ng/docs/*). Base URL: https://iacafe.com.ng/devapi/v1.
// Auth: Authorization: Bearer <api-key>  (an X-API-Key alt header also works per
// the overview page; Bearer is used here for consistency with other adapters).
//
// Verified endpoints:
//   GET  /whoami
//   GET  /wallet
//   POST /airtime                    { request_id, phone, service_id, amount }
//   GET  /variations?product=data&service_id=<net>
//   POST /data                       { request_id, phone, service_id, variation_id }
//   GET  /budget-data/plans?network_id=<1-4>
//   POST /budget-data                { request_id, phone, data_plan, network_id? }
//   POST /verify-customer            { customer_id, service_id, variation_id? }
//   POST /electricity                { request_id, customer_id, service_id, variation_id, amount }
//   GET  /variations?product=cable&service_id=<provider>
//   POST /cable                      { request_id, customer_id, service_id, variation_id }
//   POST /betting                    { request_id, customer_id, service_id, amount, skip_verify? }
//   POST /epins                      { request_id, service_id, value, quantity }
//   GET  /orders/:request_id
//   POST /requery                    { request_id }
//
// Response envelopes are NOT uniform:
//   - Airtime/Data/BudgetData/Cable/Electricity/ePINs purchase: { code: "success", message,
//     data: { status: "completed-api"|"processing-api"|"refunded-api", ... } } on success;
//     { success: false, error: { code, message } } on outright rejection (400/402/409).
//   - Verify-customer: { success: true, code: "success", ..., data: {...} } on success,
//     { success: false, error: {...} } on failure — a different envelope shape entirely.
//   - Betting fund: { success: true, status: "completed"|"processing", message, data } on
//     success (note: top-level `status`, distinct from data.status used elsewhere), or
//     { success: false, error: {...}, order_id, request_id, refunded } on failure.
//
// Status semantics: "completed-api" = DELIVERED. "processing-api" = genuinely uncertain,
// in-flight — mapped to SUBMITTED per this codebase's convention (do not assume failure;
// poll getOrderStatus/requery or wait for a webhook once one exists). "refunded-api" means
// the provider itself already reversed its own wallet — this adapter surfaces that as
// FAILED, but IMPORTANT: vtu.service.ts's reversal logic (see reverseCharge / REVERSAL
// ledger entries around line ~950) does NOT currently know about provider-side
// self-refunds, so a "refunded-api" FAILED result will still trigger our own REVERSAL
// entry on top of IACafe's already-restored wallet. This is a correctness risk for
// double-crediting if IACafe's refund and our reversal both restore the same money on
// our books — the interface has no field to convey "already refunded upstream", so this
// is flagged here rather than invented. Do not enable real traffic on this provider until
// vtu.service.ts's reversal path is checked against this specific behavior.
//
// No documented rate-limit-aware method on VtuProviderAdapter — 60 req/min noted only
// as a comment; no special handling implemented (consistent with other adapters).
//
// Budget Data: modeled as additional data-plan SKUs surfaced through listDataPlans/
// purchaseData (product="budget-data" is just IACafe's cheaper SME/gifting data family —
// not a distinct product type on VtuProviderAdapter). providerPlanId is prefixed
// "budget:<data_plan>" so purchaseData can tell budget-data plans apart from regular
// data plans and route to the correct endpoint.
//
// Required env vars: IACAFE_API_KEY, IACAFE_BASE_URL
//
// LIVE CREDENTIAL WARNING: the IACAFE_API_KEY configured for this integration is a
// LIVE production key (ak_live_...), not a sandbox key. Any call made against it moves
// real money. Do not exercise this adapter against the real API from tests, scripts, or
// ad-hoc debugging — verify against the docs/mocks only until this provider is
// deliberately promoted to ACTIVE in VtuProviderConfig.

export interface IACafeConfig {
  apiKey: string;
  baseUrl?: string; // default https://iacafe.com.ng/devapi/v1
  fetcher?: typeof fetch;
}

const IACAFE_NETWORK: Record<VtuNetwork, string> = {
  MTN: "mtn",
  AIRTEL: "airtel",
  GLO: "glo",
  NINE_MOBILE: "9mobile"
};

const IACAFE_BUDGET_NETWORK_ID: Record<VtuNetwork, number> = {
  MTN: 1,
  GLO: 2,
  NINE_MOBILE: 3,
  AIRTEL: 4
};

// Canonical service_id casing per IACafe's betting platform table — lookups are
// case-insensitive per the docs ("Bet9ja, bet9ja and BET9JA are treated the same"),
// but requests should still send the canonical casing shown here.
const IACAFE_BETTING_PLATFORMS: Record<string, string> = {
  "1xbet": "1xBet",
  bangbet: "BangBet",
  bet9ja: "Bet9ja",
  betking: "BetKing",
  betland: "BetLand",
  betlion: "BetLion",
  betway: "BetWay",
  cloudbet: "CloudBet",
  livescorebet: "LiveScoreBet",
  merrybet: "MerryBet",
  naijabet: "NaijaBet",
  nairabet: "NairaBet",
  supabet: "SupaBet"
};

function iacBettingServiceId(company: string): string | undefined {
  return IACAFE_BETTING_PLATFORMS[company.toLowerCase()];
}

interface IacPurchaseData {
  status?: string;
  token?: string;
  units?: string;
  band?: string;
  pins?: Array<{ pin?: string; serial?: string }>;
}
interface IacPurchaseEnvelope {
  code?: string;
  message?: string;
  data?: IacPurchaseData;
}
interface IacErrorEnvelope {
  success?: false;
  error?: { code?: string; message?: string };
  refunded?: boolean;
}
type IacResponse = IacPurchaseEnvelope & IacErrorEnvelope;

function mapIacDataStatus(s?: string): VtuSubmitStatus {
  if (s === "completed-api") return "DELIVERED";
  if (s === "processing-api") return "SUBMITTED";
  // refunded-api: provider-side failure, IACafe has already restored its own wallet.
  // Surfaced as FAILED — see the double-reversal risk noted in the header comment above.
  if (s === "refunded-api") return "FAILED";
  return "AMBIGUOUS";
}

export function createIACafeAdapter(config: IACafeConfig): VtuProviderAdapter {
  const base = (config.baseUrl ?? "https://iacafe.com.ng/devapi/v1").replace(/\/$/, "");
  const f = config.fetcher ?? fetch;
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  async function iacRequest(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<{ httpStatus: number; body: IacResponse }> {
    const res = await f(`${base}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let parsed: IacResponse = {};
    try {
      parsed = (await res.json()) as IacResponse;
    } catch {
      // Non-JSON body (e.g. gateway error) — HTTP status alone drives outcome below.
    }
    return { httpStatus: res.status, body: parsed };
  }

  function purchaseResult(
    reference: string,
    httpStatus: number,
    body: IacResponse
  ): VtuSubmitResult & { token?: string; units?: string } {
    if (body.success === false) {
      return {
        providerReference: reference,
        status: "FAILED" as const,
        failureReason: body.error?.message ?? `IACafe request failed (HTTP ${httpStatus})`
      };
    }
    const status = mapIacDataStatus(body.data?.status);
    return {
      providerReference: reference,
      status,
      ...(body.data?.token ? { token: body.data.token } : {}),
      ...(body.data?.units ? { units: body.data.units } : {}),
      ...(status === "FAILED"
        ? { failureReason: body.message ?? "IACafe order was refunded (refunded-api)" }
        : {})
    };
  }

  // Shared verify-customer call for betting — used both by the public
  // verifyBettingCustomer method and internally by purchaseBetFunding's mandatory
  // verify-then-fund sequence (pulled out to a plain function since the adapter is
  // returned as an object literal, not a class, so `this` isn't usable inside it).
  async function verifyBetting(customerId: string, serviceId: string): Promise<VtuMeterValidation> {
    try {
      const { httpStatus, body } = await iacRequest("POST", "/verify-customer", {
        customer_id: customerId,
        service_id: serviceId
      });
      if (httpStatus !== 200 || body.success === false) return { valid: false };
      const data = (body as unknown as { data?: { customer_name?: string } }).data;
      return { valid: true, ...(data?.customer_name ? { customerName: data.customer_name } : {}) };
    } catch {
      return { valid: false };
    }
  }

  return {
    name: "iacafe",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () =>
      vtuCapabilities("strong", ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "BETTING"]),

    buildReference(order) {
      // Max 50 chars, must never be reused, per IACafe's request_id contract.
      return `IAC${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },

    getAirtimeDiscountBps(_network) {
      // 2.2% default discount per the airtime docs; not configurable per-network here.
      return Promise.resolve(220);
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const results: VtuPlanOffer[] = [];
      for (const net of networks) {
        try {
          const { httpStatus, body } = await iacRequest(
            "GET",
            `/variations?product=data&service_id=${IACAFE_NETWORK[net]}`
          );
          if (httpStatus !== 200 || body.success === false) continue;
          const plans = (body as unknown as {
            data?: Array<{ variation_id?: string; name?: string; price?: string }>;
          }).data;
          for (const p of plans ?? []) {
            if (!p.variation_id) continue;
            const name = p.name ?? p.variation_id;
            const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = name.match(/(\d+)\s*MB/i);
            const dayMatch = name.match(/(\d+)\s*Days?/i);
            results.push({
              providerPlanId: p.variation_id,
              network: net,
              planType: "SME",
              displayName: name,
              sizeMb: gbMatch ? Math.round(parseFloat(gbMatch[1]!) * 1024) : mbMatch ? parseInt(mbMatch[1]!) : 0,
              validityDays: dayMatch ? parseInt(dayMatch[1]!) : 30,
              costMinor: Math.round(parseFloat(String(p.price ?? 0)) * 100),
              currency: "NGN"
            });
          }
        } catch {
          // Skip networks whose variations lookup errors.
        }
        // Budget Data plans, prefixed so purchaseData can route them to /budget-data.
        try {
          const { httpStatus, body } = await iacRequest(
            "GET",
            `/budget-data/plans?network_id=${IACAFE_BUDGET_NETWORK_ID[net]}`
          );
          if (httpStatus !== 200 || body.success === false) continue;
          const plans = (body as unknown as {
            data?: { plans?: Array<{ data_plan?: number; name?: string; price?: string; validity?: string }> };
          }).data?.plans;
          for (const p of plans ?? []) {
            if (p.data_plan === undefined) continue;
            const name = p.name ?? String(p.data_plan);
            const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = name.match(/(\d+)\s*MB/i);
            const dayMatch = (p.validity ?? "").match(/(\d+)/);
            results.push({
              providerPlanId: `budget:${p.data_plan}`,
              network: net,
              planType: "GIFTING",
              displayName: `${name} (Budget)`,
              sizeMb: gbMatch ? Math.round(parseFloat(gbMatch[1]!) * 1024) : mbMatch ? parseInt(mbMatch[1]!) : 0,
              validityDays: dayMatch ? parseInt(dayMatch[1]!) : 30,
              costMinor: Math.round(parseFloat(String(p.price ?? 0)) * 100),
              currency: "NGN"
            });
          }
        } catch {
          // Skip networks whose budget-data plans lookup errors.
        }
      }
      return results;
    },

    async purchaseAirtime({ network, msisdn, faceValueMinor, reference }) {
      const { httpStatus, body } = await iacRequest("POST", "/airtime", {
        request_id: reference,
        phone: msisdn,
        service_id: IACAFE_NETWORK[network],
        amount: faceValueMinor / 100
      });
      return purchaseResult(reference, httpStatus, body);
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      if (providerPlanId.startsWith("budget:")) {
        const dataPlan = Number(providerPlanId.slice("budget:".length));
        const { httpStatus, body } = await iacRequest("POST", "/budget-data", {
          request_id: reference,
          phone: msisdn,
          data_plan: dataPlan,
          network_id: IACAFE_BUDGET_NETWORK_ID[network]
        });
        return purchaseResult(reference, httpStatus, body);
      }
      const { httpStatus, body } = await iacRequest("POST", "/data", {
        request_id: reference,
        phone: msisdn,
        service_id: IACAFE_NETWORK[network],
        variation_id: providerPlanId
      });
      return purchaseResult(reference, httpStatus, body);
    },

    // GET /orders/:request_id — our `reference` IS IACafe's request_id, so this is a
    // direct lookup (falls back to POST /requery on any non-2xx, per the docs' guidance
    // to requery when a webhook doesn't fire).
    async getOrderStatus(reference) {
      try {
        const { httpStatus, body } = await iacRequest("GET", `/orders/${encodeURIComponent(reference)}`);
        if (httpStatus === 200 && body.success !== false) {
          return {
            providerReference: reference,
            status: mapIacDataStatus((body as unknown as { data?: { status?: string } }).data?.status)
          };
        }
      } catch {
        // Fall through to requery below.
      }
      try {
        const { httpStatus, body } = await iacRequest("POST", "/requery", { request_id: reference });
        if (httpStatus === 200 && body.success !== false) {
          return {
            providerReference: reference,
            status: mapIacDataStatus((body as unknown as { data?: { status?: string } }).data?.status)
          };
        }
        return {
          providerReference: reference,
          status: "AMBIGUOUS" as const,
          failureReason: body.error?.message ?? "IACafe requery returned an unexpected response"
        };
      } catch (err) {
        return {
          providerReference: reference,
          status: "AMBIGUOUS" as const,
          failureReason: err instanceof Error ? err.message : "IACafe requery failed"
        };
      }
    },

    async getBalance() {
      try {
        const { httpStatus, body } = await iacRequest("GET", "/wallet");
        if (httpStatus !== 200 || body.success === false) {
          return { providerName: "iacafe", balanceMinor: 0, currency: "NGN" };
        }
        const data = (body as unknown as { data?: { balance?: number } }).data;
        return {
          providerName: "iacafe",
          balanceMinor: Math.round((data?.balance ?? 0) * 100),
          currency: "NGN"
        };
      } catch {
        return { providerName: "iacafe", balanceMinor: 0, currency: "NGN" };
      }
    },

    async checkHealth() {
      const start = Date.now();
      try {
        const { httpStatus } = await iacRequest("GET", "/whoami");
        return {
          providerName: "iacafe",
          status: httpStatus === 200 ? ("HEALTHY" as const) : ("DEGRADED" as const),
          latencyMs: Date.now() - start
        };
      } catch (err) {
        return {
          providerName: "iacafe",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "IACafe health check failed"
        };
      }
    },

    // Shared /verify-customer endpoint. variation_id = "prepaid"/"postpaid" for
    // electricity only; omitted for cable smartcard verification.
    async validateMeter(input): Promise<VtuMeterValidation> {
      try {
        const { httpStatus, body } = await iacRequest("POST", "/verify-customer", {
          customer_id: input.meterNumber,
          service_id: input.disco,
          variation_id: input.meterType === "PREPAID" ? "prepaid" : "postpaid"
        });
        if (httpStatus !== 200 || body.success === false) return { valid: false };
        const data = (body as unknown as {
          data?: { customer_name?: string; customer_address?: string };
        }).data;
        return {
          valid: true,
          ...(data?.customer_name ? { customerName: data.customer_name } : {}),
          ...(data?.customer_address ? { address: data.customer_address } : {})
        };
      } catch {
        return { valid: false };
      }
    },

    async purchaseElectricity(input): Promise<VtuSubmitResult & { token?: string; units?: string }> {
      const { httpStatus, body } = await iacRequest("POST", "/electricity", {
        request_id: input.reference,
        customer_id: input.meterNumber,
        service_id: input.disco,
        variation_id: input.meterType === "PREPAID" ? "prepaid" : "postpaid",
        amount: input.amountMinor / 100
      });
      return purchaseResult(input.reference, httpStatus, body);
    },

    async verifyCableCustomer(input): Promise<VtuMeterValidation> {
      try {
        const { httpStatus, body } = await iacRequest("POST", "/verify-customer", {
          customer_id: input.smartCardNumber,
          service_id: input.provider.toLowerCase()
        });
        if (httpStatus !== 200 || body.success === false) return { valid: false };
        const data = (body as unknown as { data?: { customer_name?: string } }).data;
        return { valid: true, ...(data?.customer_name ? { customerName: data.customer_name } : {}) };
      } catch {
        return { valid: false };
      }
    },

    async listCablePackages(): Promise<VtuCablePackageOffer[]> {
      const providers = ["dstv", "gotv", "startimes", "showmax"];
      const offers: VtuCablePackageOffer[] = [];
      for (const provider of providers) {
        try {
          const { httpStatus, body } = await iacRequest(
            "GET",
            `/variations?product=cable&service_id=${provider}`
          );
          if (httpStatus !== 200 || body.success === false) continue;
          const plans = (body as unknown as {
            data?: Array<{ variation_id?: string; name?: string; price?: string }>;
          }).data;
          for (const p of plans ?? []) {
            if (!p.variation_id) continue;
            offers.push({
              cableProvider: provider,
              packageCode: p.variation_id,
              displayName: p.name ?? p.variation_id,
              costMinor: Math.round(parseFloat(String(p.price ?? 0)) * 100),
              currency: "NGN"
            });
          }
        } catch {
          // Skip providers whose bouquet lookup errors.
        }
      }
      return offers;
    },

    async purchaseCable(input): Promise<VtuSubmitResult> {
      const { httpStatus, body } = await iacRequest("POST", "/cable", {
        request_id: input.reference,
        customer_id: input.smartCardNumber,
        service_id: input.provider.toLowerCase(),
        variation_id: input.packageCode
      });
      return purchaseResult(input.reference, httpStatus, body);
    },

    // Mandatory verify-then-fund sequence per IACafe's own documented best practice:
    // never call /betting without a prior successful /verify-customer for the account.
    async verifyBettingCustomer(input): Promise<VtuMeterValidation> {
      const serviceId = iacBettingServiceId(input.bettingCompany);
      if (!serviceId) return { valid: false };
      return verifyBetting(input.customerId, serviceId);
    },

    listBettingCompanies(): Promise<VtuBettingCompanyOffer[]> {
      return Promise.resolve(
        Object.values(IACAFE_BETTING_PLATFORMS).map((displayName) => ({
          productCode: displayName,
          displayName
        }))
      );
    },

    async purchaseBetFunding(input): Promise<VtuSubmitResult> {
      const serviceId = iacBettingServiceId(input.bettingCompany);
      if (!serviceId) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: `Unknown IACafe betting platform: ${input.bettingCompany}`
        };
      }
      // Verify first — required per IACafe's docs ("Never go straight to the funding
      // endpoint unless you already verified the customer account"). skip_verify is
      // deliberately never set; this adapter always performs the verify step itself.
      const verified = await verifyBetting(input.customerId, serviceId);
      if (!verified.valid) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: "IACafe betting account verification failed — account not found"
        };
      }
      const { httpStatus, body } = await iacRequest("POST", "/betting", {
        request_id: input.reference,
        customer_id: input.customerId,
        service_id: serviceId,
        amount: input.amountMinor / 100
      });
      if (body.success === false) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: body.error?.message ?? `IACafe betting funding failed (HTTP ${httpStatus})`
        };
      }
      // Betting fund responses carry status at the TOP level ("completed"/"processing"),
      // distinct from the data.status ("completed-api"/etc.) shape used elsewhere.
      const topStatus = (body as unknown as { status?: string }).status;
      const status: VtuSubmitStatus =
        topStatus === "completed" ? "DELIVERED" : topStatus === "processing" ? "SUBMITTED" : "AMBIGUOUS";
      return {
        providerReference: input.reference,
        status,
        ...(status === "AMBIGUOUS" ? { failureReason: body.message ?? "Unexpected IACafe betting response" } : {})
      };
    },

    // POST /epins — up to 200 PINs per request; quantity/value validated upstream.
    async purchaseAirtimeEpin(input): Promise<VtuSubmitResult & { epins?: VtuEpin[] }> {
      const { httpStatus, body } = await iacRequest("POST", "/epins", {
        request_id: input.reference,
        service_id: IACAFE_NETWORK[input.network],
        value: input.valueMinor / 100,
        quantity: input.quantity
      });
      if (body.success === false) {
        return {
          providerReference: input.reference,
          status: "FAILED" as const,
          failureReason: body.error?.message ?? `IACafe ePIN generation failed (HTTP ${httpStatus})`
        };
      }
      const status = mapIacDataStatus(body.data?.status);
      const pins: VtuEpin[] | undefined = body.data?.pins
        ?.filter((p) => p.pin)
        .map((p) => ({ pin: p.pin!, serialNumber: p.serial ?? "" }));
      return {
        providerReference: input.reference,
        status,
        ...(pins && pins.length > 0 ? { epins: pins } : {}),
        ...(status === "FAILED"
          ? { failureReason: body.message ?? "IACafe order was refunded (refunded-api)" }
          : {})
      };
    }
  };
}
