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
  purchaseBetFunding?(input: {
    bettingCompany: string;
    customerId: string;
    amountMinor: number;
    reference: string;
  }): Promise<VtuSubmitResult>;

  verifyJambProfile?(input: { profileId: string }): Promise<VtuMeterValidation>;
  purchaseEducation?(input: {
    examType: string;
    phoneNumber: string;
    profileId?: string;
    reference: string;
  }): Promise<VtuSubmitResult & { pin?: string; serialNumber?: string }>;
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
      const res = (await vtpassGet(config, "/balance")) as {
        data?: { balance?: string | number }
      };
      const raw = res?.data?.balance ?? 0;
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
        const res = (await vtpassPost(config, "/bills/validate", {
          serviceID: `${input.disco.toUpperCase()}-BILL`,
          billersCode: input.meterNumber
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
      const body = {
        request_id: input.reference,
        serviceID: `${input.disco.toUpperCase()}-BILL`,
        billersCode: input.meterNumber,
        amount: (input.amountMinor / 100).toFixed(2),
        phone: "",
        quantity: input.meterNumber
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
        const res = (await vtpassPost(config, "/pay", {
          request_id: input.reference,
          serviceID: input.provider.toUpperCase(),
          billersCode: input.smartCardNumber,
          variation_code: input.packageCode,
          phone: ""
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
    }
  };
}
