// VTU provider adapter contract + all adapter implementations.
// Each adapter takes a config struct and optional fetcher (for testability).
// None of them read env vars directly — callers inject credentials.

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
}

export interface VtuProviderBalance {
  providerName: string;
  balanceMinor: number;
  currency: string;
}

export interface VtuHealthSnapshot {
  providerName: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED";
  latencyMs: number;
  reason?: string;
}

// Optional methods for bills/cable (Phase 5) — designed now so the pipeline
// shape doesn't need to change when they're implemented.
export interface VtuMeterValidation {
  valid: boolean;
  customerName?: string;
  address?: string;
  minAmountMinor?: number;
}

export interface VtuProviderAdapter {
  readonly name: string;

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
    reference: string;
  }): Promise<VtuSubmitResult & { token?: string; units?: string }>;
  purchaseCable?(input: {
    provider: string;
    smartCardNumber: string;
    packageCode: string;
    reference: string;
  }): Promise<VtuSubmitResult>;
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
    }
  };
}

// ─── ClubKonnect adapter ──────────────────────────────────────────────────────
// HTTPS GET only. UserID + APIKey in query string — never log raw URLs.
// No sandbox. Test with a small funded account only.

export interface ClubKonnectConfig {
  userId: string;
  apiKey: string;
  baseUrl?: string; // default https://www.clubkonnect.com
  callbackUrl?: string;
  fetcher?: typeof fetch;
}

const CK_NETWORK: Record<VtuNetwork, string> = {
  MTN: "MTN",
  GLO: "GLO",
  AIRTEL: "AIRTEL",
  NINE_MOBILE: "9MOBILE"
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
  const base = config.baseUrl ?? "https://www.clubkonnect.com";
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

function mapCkStatus(status?: string): VtuSubmitStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "successful" || s === "success" || s === "delivered") return "DELIVERED";
  if (s === "processing" || s === "pending") return "SUBMITTED";
  if (s === "failed") return "FAILED";
  return "AMBIGUOUS";
}

export function createClubKonnectAdapter(config: ClubKonnectConfig): VtuProviderAdapter {
  return {
    name: "clubkonnect",

    buildReference(order) {
      // CK accepts any alphanumeric OrderID up to 20 chars.
      return `CK${order.id.replace(/-/g, "").slice(0, 18).toUpperCase()}`;
    },

    async listDataPlans(network) {
      const networks: VtuNetwork[] = network ? [network] : ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
      const results: VtuPlanOffer[] = [];

      for (const net of networks) {
        try {
          const res = (await ckGet(config, "/api/v1/data/plans", {
            NetworkID: CK_NETWORK[net]
          })) as Array<{
            PlanID?: string | number;
            Plan?: string;
            Amount?: string | number;
            Validity?: string;
            PlanType?: string;
          }>;

          for (const p of Array.isArray(res) ? res : []) {
            const name = p.Plan ?? String(p.PlanID ?? "");
            const cost = Math.round(parseFloat(String(p.Amount ?? 0)) * 100);
            const gbMatch = name.match(/(\d+(?:\.\d+)?)\s*GB/i);
            const mbMatch = name.match(/(\d+)\s*MB/i);
            const dayMatch = (p.Validity ?? name).match(/(\d+)/);
            const sizeMb = gbMatch
              ? Math.round(parseFloat(gbMatch[1]!) * 1024)
              : mbMatch
                ? parseInt(mbMatch[1]!)
                : 0;
            const validityDays = dayMatch ? parseInt(dayMatch[1]!) : 30;
            const rawType = (p.PlanType ?? "SME").toUpperCase();
            const planType: VtuPlanType =
              rawType === "CG" ? "CG" : rawType === "GIFTING" ? "GIFTING" : "SME";

            results.push({
              providerPlanId: String(p.PlanID ?? ""),
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
          // Skip network on error.
        }
      }

      return results;
    },

    getAirtimeDiscountBps() {
      // Resolve in blocking test §5.8 — placeholder until funded account confirms rate.
      // Conservative floor from published consumer page; API tier may differ.
      return Promise.resolve(500);
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
      const res = (await ckGet(config, "/api/v1/airtime/request", params)) as {
        Status?: string;
        OrderID?: string | number;
        ErrorMessage?: string;
        Response?: string;
      };

      const status = mapCkStatus(res.Status);
      if (status === "FAILED") {
        return {
          providerReference: reference,
          status: "FAILED",
          failureReason: res.ErrorMessage ?? res.Response ?? "ClubKonnect airtime failed"
        };
      }
      return { providerReference: reference, status };
    },

    async purchaseData({ network, msisdn, providerPlanId, reference }) {
      const params: Record<string, string> = {
        NetworkID: CK_NETWORK[network],
        PlanID: providerPlanId,
        MobileNumber: msisdn,
        RequestID: reference,
        ...(config.callbackUrl ? { CallBackURL: config.callbackUrl } : {})
      };
      const res = (await ckGet(config, "/api/v1/data/request", params)) as {
        Status?: string;
        OrderID?: string | number;
        ErrorMessage?: string;
        Response?: string;
      };

      const status = mapCkStatus(res.Status);
      if (status === "FAILED") {
        return {
          providerReference: reference,
          status: "FAILED",
          failureReason: res.ErrorMessage ?? res.Response ?? "ClubKonnect data failed"
        };
      }
      return { providerReference: reference, status };
    },

    async getOrderStatus(reference) {
      // Query by RequestID.
      const res = (await ckGet(config, "/api/v1/query", {
        RequestID: reference
      })) as { Status?: string; ErrorMessage?: string };

      return {
        providerReference: reference,
        status: mapCkStatus(res.Status),
        ...(res.ErrorMessage ? { failureReason: res.ErrorMessage } : {})
      };
    },

    async getBalance() {
      const res = (await ckGet(config, "/api/v1/balance", {})) as {
        Balance?: string | number;
        WalletBalance?: string | number;
      };
      const raw = res.Balance ?? res.WalletBalance ?? 0;
      return {
        providerName: "clubkonnect",
        balanceMinor: Math.round(parseFloat(String(raw)) * 100),
        currency: "NGN"
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        await this.getBalance();
        return { providerName: "clubkonnect", status: "HEALTHY", latencyMs: Date.now() - start };
      } catch (err) {
        return {
          providerName: "clubkonnect",
          status: "DEGRADED",
          latencyMs: Date.now() - start,
          reason: err instanceof Error ? err.message : "ClubKonnect health check failed"
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
    }
  };
}
