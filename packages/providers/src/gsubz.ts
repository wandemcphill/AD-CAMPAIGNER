import type { DestinationKind, SmmOrder, SmmServiceKind } from "@fliptrybe/types";
import { CURRENT_INTERFACE_VERSION } from "./contract.js";
import type { SmmSupplierAdapter, SmmSupplierOrderSnapshot, SmmSupplierService } from "./index.js";
import type {
  VtuNetwork,
  VtuPlanOffer,
  VtuProviderAdapter,
  VtuSubmitStatus
} from "./vtu.js";
import { vtuCapabilities } from "./vtu.js";

export interface GsubzVtuConfig {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export interface GsubzSocialConfig {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

type GsubzPlanType = "SME" | "CG" | "GIFTING" | "CORPORATE";

interface GsubzSubCategory {
  displayName?: string;
  name?: string;
}

interface GsubzPlanItem {
  displayName?: string;
  display_name?: string;
  value?: string | number;
  price?: string | number;
  min?: string | number;
  max?: string | number;
  category?: string;
  description?: string;
}

interface GsubzPlansResponse {
  discount?: string;
  plans?: GsubzPlanItem[];
  list?: GsubzPlanItem[];
  error?: string;
}

interface GsubzBalanceResponse {
  balance?: string | number;
  data?: { balance?: string | number };
}

interface GsubzVerifyResponse {
  status?: string;
  description?: string;
  content?: {
    transactionID?: string | number;
    requestID?: string | number;
    status?: string;
    description?: string;
  };
  data?: { status?: string };
}

interface DataCatalogEntry {
  providerPlanId: string;
  network: VtuNetwork;
  planType: GsubzPlanType;
  displayName: string;
  sizeMb: number;
  validityDays: number;
  costMinor: number;
  currency: "NGN";
  serviceId: string;
  planValue: string;
}

interface SocialCatalogEntry {
  serviceId: string;
  displayName: string;
  category?: string;
  description?: string;
  rateMinorPerThousand: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  planValue: string;
}

const dataCatalogCache = new Map<
  string,
  { resolvedAt: number; byProviderPlanId: Map<string, DataCatalogEntry>; plans: VtuPlanOffer[] }
>();
const socialCatalogCache = new Map<
  string,
  { resolvedAt: number; byServiceId: Map<string, SocialCatalogEntry>; services: SmmSupplierService[] }
>();
const catalogTtlMs = 15 * 60 * 1000;

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/\/+$/, "");
}

function parseNumber(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyMinorFromMajor(value: string | number | undefined) {
  return Math.round(parseNumber(value) * 100);
}

function gsubzNetworkSlug(network: VtuNetwork) {
  switch (network) {
    case "MTN":
      return "mtn";
    case "GLO":
      return "glo";
    case "AIRTEL":
      return "airtel";
    case "NINE_MOBILE":
      return "9mobile";
  }
}

function parseDiscountBps(discount?: string) {
  const match = discount?.match(/(\d+(?:\.\d+)?)%/);
  return match ? Math.round(parseFloat(match[1]!) * 100) : 0;
}

function parsePlanType(subCategoryName: string | undefined, displayName: string): GsubzPlanType {
  const text = `${subCategoryName ?? ""} ${displayName}`.toLowerCase();
  if (text.includes("gift")) return "GIFTING";
  if (text.includes("awoof")) return "GIFTING";
  if (text.includes("datashare")) return "CG";
  if (text.includes("corporate")) return "CG";
  if (text.includes("sme")) return "SME";
  return "SME";
}

function parseSizeMb(displayName: string) {
  const gb = displayName.match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (gb) return Math.round(parseFloat(gb[1]!) * 1024);
  const mb = displayName.match(/(\d+(?:\.\d+)?)\s*MB/i);
  if (mb) return Math.round(parseFloat(mb[1]!));
  return 0;
}

function parseValidityDays(displayName: string) {
  const day = displayName.match(/(\d+)\s*day/i);
  if (day) return parseInt(day[1]!, 10);
  return 30;
}

function serviceKeywordsForKind(serviceKind: SmmServiceKind): string[] {
  switch (serviceKind) {
    case "FOLLOWERS":
      return ["follower", "followers"];
    case "LIKES":
      return ["like", "likes"];
    case "VIEWS":
      return ["view", "views"];
    case "COMMENTS":
      return ["comment", "comments"];
    case "SHARES":
      return ["share", "shares"];
    case "LIVE_VIEWERS":
      return ["live", "viewer", "viewers"];
    case "CHANNEL_MEMBERS":
      return ["member", "members", "subscriber", "subscribers"];
    case "ACCOUNT_SALE":
      return ["account", "accounts"];
    case "VPN_SUBSCRIPTION":
      return ["vpn"];
    case "STREAMING_SUBSCRIPTION":
      return ["streaming", "netflix", "subscription"];
  }
}

function destinationKeywords(destination: { kind: DestinationKind }) {
  const text = destination.kind.toLowerCase();
  if (text.includes("tiktok")) return ["tiktok"];
  if (text.includes("instagram")) return ["instagram", "ig"];
  if (text.includes("facebook")) return ["facebook", "fb"];
  if (text.includes("youtube")) return ["youtube", "yt"];
  if (text.includes("telegram")) return ["telegram"];
  if (text.includes("whatsapp")) return ["whatsapp"];
  return [];
}

function matchesService(
  service: {
    name: string;
    category?: string | undefined;
    type?: string | undefined;
    min: number;
    max: number;
  },
  input: { serviceKind: SmmServiceKind; quantity: number; destination: { kind: DestinationKind } }
) {
  const text = `${service.name} ${service.category ?? ""} ${service.type ?? ""}`.toLowerCase();
  const quantityFits =
    input.quantity >= service.min && (service.max === 0 || input.quantity <= service.max);
  const serviceMatches = serviceKeywordsForKind(input.serviceKind).some((keyword) =>
    text.includes(keyword)
  );
  const destinationWords = destinationKeywords(input.destination);
  const destinationMatches =
    destinationWords.length === 0 || destinationWords.some((keyword) => text.includes(keyword));
  return quantityFits && serviceMatches && destinationMatches;
}

async function gsubzRequest(
  config: { apiKey?: string | undefined; baseUrl: string; fetcher?: typeof fetch | undefined },
  path: string,
  options?: { method?: "GET" | "POST"; body?: Record<string, string | number | undefined> }
) {
  const method = options?.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (method === "POST") {
    headers["content-type"] = "application/x-www-form-urlencoded";
  }

  const response = await (config.fetcher ?? fetch)(`${config.baseUrl}${path}`, {
    method,
    headers,
    ...(method === "POST" && options?.body
      ? {
          body: new URLSearchParams(
            Object.entries(options.body).reduce<Record<string, string>>((acc, [key, value]) => {
              if (value !== undefined && value !== null) {
                acc[key] = String(value);
              }
              return acc;
            }, {})
          )
        }
      : {})
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    // Some storefront responses are HTML.
  }

  if (!response.ok) {
    throw new Error(`GSUBZ ${method} ${path} -> HTTP ${response.status}`);
  }

  return parsed;
}

async function loadDataCatalog(config: GsubzVtuConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.gsubz.com/api");
  const cached = dataCatalogCache.get(baseUrl);
  if (cached && Date.now() - cached.resolvedAt < catalogTtlMs) return cached;

  const subCategories = (await gsubzRequest(
    { apiKey: config.apiKey, baseUrl, fetcher: config.fetcher },
    "/sub-category?category=data"
  )) as GsubzSubCategory[];

  const targets: Array<{ network: VtuNetwork; prefix: string }> = [
    { network: "MTN", prefix: "mtn_" },
    { network: "GLO", prefix: "glo_" },
    { network: "AIRTEL", prefix: "airtel_" },
    { network: "NINE_MOBILE", prefix: "9mobile_" }
  ];

  const byProviderPlanId = new Map<string, DataCatalogEntry>();
  const plans: VtuPlanOffer[] = [];

  for (const target of targets) {
    const matchingSubCategories = subCategories.filter((subCategory) =>
      (subCategory.name ?? "").toLowerCase().startsWith(target.prefix)
    );

    for (const subCategory of matchingSubCategories) {
      const response = (await gsubzRequest(
        { apiKey: config.apiKey, baseUrl, fetcher: config.fetcher },
        `/plans?service=${encodeURIComponent(subCategory.name ?? "")}`
      )) as GsubzPlansResponse;

      const items = response.plans ?? response.list ?? [];
      for (const item of items) {
        const planValue = String(item.value ?? "");
        if (!planValue) continue;

        const providerPlanId = `${subCategory.name}:${planValue}`;
        const displayName = String(item.displayName ?? item.display_name ?? planValue);
        const entry: DataCatalogEntry = {
          providerPlanId,
          network: target.network,
          planType: parsePlanType(subCategory.name, displayName),
          displayName: `${subCategory.displayName ?? subCategory.name ?? target.network} ${displayName}`.trim(),
          sizeMb: parseSizeMb(displayName),
          validityDays: parseValidityDays(displayName),
          costMinor: moneyMinorFromMajor(item.price),
          currency: "NGN",
          serviceId: subCategory.name ?? "",
          planValue
        };

        byProviderPlanId.set(providerPlanId, entry);
        plans.push({
          providerPlanId: entry.providerPlanId,
          network: entry.network,
          planType: entry.planType,
          displayName: entry.displayName,
          sizeMb: entry.sizeMb,
          validityDays: entry.validityDays,
          costMinor: entry.costMinor,
          currency: entry.currency
        });
      }
    }
  }

  const result = { resolvedAt: Date.now(), byProviderPlanId, plans };
  dataCatalogCache.set(baseUrl, result);
  return result;
}

async function loadSocialCatalog(config: GsubzSocialConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.gsubz.com/api");
  const cacheKey = baseUrl;
  const cached = socialCatalogCache.get(cacheKey);
  if (cached && Date.now() - cached.resolvedAt < catalogTtlMs) return cached;

  const subCategories = (await gsubzRequest(
    { apiKey: config.apiKey, baseUrl, fetcher: config.fetcher },
    "/sub-category?category=mobile_vtu"
  )) as GsubzSubCategory[];
  const socials = subCategories.find((item) => (item.name ?? "").toLowerCase() === "socials");

  if (!socials) {
    const empty = {
      resolvedAt: Date.now(),
      byServiceId: new Map<string, SocialCatalogEntry>(),
      services: [] as SmmSupplierService[]
    };
    socialCatalogCache.set(cacheKey, empty);
    return empty;
  }

  const response = (await gsubzRequest(
    { apiKey: config.apiKey, baseUrl, fetcher: config.fetcher },
    "/plans?service=socials"
  )) as GsubzPlansResponse;

  const items = response.list ?? response.plans ?? [];
  const byServiceId = new Map<string, SocialCatalogEntry>();
  const services: SmmSupplierService[] = [];

  for (const item of items) {
    const planValue = String(item.value ?? "");
    if (!planValue) continue;

    const displayName = String(item.display_name ?? item.displayName ?? planValue);
    const description = String(item.description ?? "");
    const serviceId = `socials:${planValue}`;
    const entry: SocialCatalogEntry = {
      serviceId,
      displayName,
      category: String(item.category ?? socials.displayName ?? "Socials"),
      description,
      rateMinorPerThousand: moneyMinorFromMajor(item.price),
      min: parseNumber(item.min),
      max: parseNumber(item.max),
      refill: !/refill:\s*no/i.test(`${displayName} ${description}`),
      cancel: /cancel/i.test(`${displayName} ${description}`),
      dripfeed: /dripfeed/i.test(`${displayName} ${description}`),
      planValue
    };

    byServiceId.set(serviceId, entry);
    services.push({
      supplierName: "gsubz",
      serviceId,
      name: displayName,
      ...(entry.category ? { category: entry.category } : {}),
      type: "socials",
      rate: { amountMinor: entry.rateMinorPerThousand, currency: "NGN" },
      min: entry.min,
      max: entry.max,
      refill: entry.refill,
      cancel: entry.cancel,
      dripfeed: entry.dripfeed
    });
  }

  const result = { resolvedAt: Date.now(), byServiceId, services };
  socialCatalogCache.set(cacheKey, result);
  return result;
}

function mapGsubzStatus(status?: string): VtuSubmitStatus {
  const normalized = status?.toLowerCase().trim();
  if (!normalized) return "SUBMITTED";
  if (normalized.includes("success") || normalized.includes("completed")) return "DELIVERED";
  if (normalized.includes("pending") || normalized.includes("processing")) return "SUBMITTED";
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("cancel")) {
    return "FAILED";
  }
  return "AMBIGUOUS";
}

function getGsubzTransactionStatus(response: GsubzVerifyResponse) {
  return response.content?.status ?? response.data?.status ?? response.status;
}

function getGsubzFailureReason(response: GsubzVerifyResponse) {
  return response.content?.description ?? response.description;
}

function mapGsubzSocialStatus(status?: string): SmmOrder["status"] {
  const normalized = status?.toLowerCase().trim();
  if (!normalized) return "PROCESSING";
  if (normalized.includes("success") || normalized.includes("completed")) return "COMPLETED";
  if (normalized.includes("pending") || normalized.includes("processing")) return "PROCESSING";
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("cancel")) {
    return "FAILED";
  }
  return "PROCESSING";
}

function buildSocialRequestId(order: SmmOrder) {
  const suffix = order.id.replace(/[^a-z0-9]/gi, "").slice(0, 18).toUpperCase();
  return `GSMS${suffix || Date.now()}`;
}

function mapSocialSnapshot(
  supplierReference: string,
  rawStatus: string,
  status: SmmOrder["status"] = "PROCESSING"
): SmmSupplierOrderSnapshot {
  return {
    supplierReference,
    status,
    rawStatus
  };
}

export function resetGsubzCaches() {
  dataCatalogCache.clear();
  socialCatalogCache.clear();
}

export function createGsubzAdapter(config: GsubzVtuConfig): VtuProviderAdapter {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.gsubz.com/api");
  const fetcher = config.fetcher ?? fetch;

  return {
    name: "gsubz",
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    domain: "VTU" as const,
    getCapabilities: () => vtuCapabilities("strong", ["DATA"]),
    buildReference(order) {
      return `GSZ${order.id.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`;
    },
    async listDataPlans(network) {
      const catalog = await loadDataCatalog({ ...config, baseUrl, fetcher });
      return catalog.plans.filter((plan) => !network || plan.network === network);
    },
    async getAirtimeDiscountBps(network) {
      try {
        const response = (await gsubzRequest(
          { apiKey: config.apiKey, baseUrl, fetcher },
          `/plans?service=${encodeURIComponent(gsubzNetworkSlug(network))}`
        )) as GsubzPlansResponse;
        return parseDiscountBps(response.discount);
      } catch {
        return 0;
      }
    },
    async purchaseAirtime(input) {
      try {
        const response = (await gsubzRequest(
          { apiKey: config.apiKey, baseUrl, fetcher },
          "/pay",
          {
            method: "POST",
            body: {
              api: config.apiKey,
              serviceID: gsubzNetworkSlug(input.network),
              amount: (input.faceValueMinor / 100).toFixed(2),
              phone: input.msisdn,
              requestID: input.reference
            }
          }
        )) as GsubzVerifyResponse;
        return {
          providerReference: input.reference,
          status: mapGsubzStatus(getGsubzTransactionStatus(response))
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED",
          failureReason: err instanceof Error ? err.message : "GSUBZ airtime purchase failed"
        };
      }
    },
    async purchaseData(input) {
      const catalog = await loadDataCatalog({ ...config, baseUrl, fetcher });
      const entry = catalog.byProviderPlanId.get(input.providerPlanId);
      if (!entry) {
        return {
          providerReference: input.reference,
          status: "FAILED",
          failureReason: `Unknown GSUBZ data plan ${input.providerPlanId}`
        };
      }

      try {
        const response = (await gsubzRequest(
          { apiKey: config.apiKey, baseUrl, fetcher },
          "/pay",
          {
            method: "POST",
            body: {
              api: config.apiKey,
              serviceID: entry.serviceId,
              plan: entry.planValue,
              amount: (entry.costMinor / 100).toFixed(2),
              phone: input.msisdn,
              requestID: input.reference
            }
          }
        )) as GsubzVerifyResponse;
        return {
          providerReference: input.reference,
          status: mapGsubzStatus(getGsubzTransactionStatus(response)),
          ...(mapGsubzStatus(getGsubzTransactionStatus(response)) === "FAILED"
            ? { failureReason: getGsubzFailureReason(response) }
            : {})
        };
      } catch (err) {
        return {
          providerReference: input.reference,
          status: "FAILED",
          failureReason: err instanceof Error ? err.message : "GSUBZ data purchase failed"
        };
      }
    },
    async getOrderStatus(reference) {
      try {
        const response = (await gsubzRequest(
          { apiKey: config.apiKey, baseUrl, fetcher },
          "/verify",
          {
            method: "POST",
            body: { requestID: reference }
          }
        )) as GsubzVerifyResponse;
        return {
          providerReference: reference,
          status: mapGsubzStatus(getGsubzTransactionStatus(response)),
          ...(mapGsubzStatus(getGsubzTransactionStatus(response)) === "FAILED"
            ? { failureReason: getGsubzFailureReason(response) }
            : {})
        };
      } catch (err) {
        return {
          providerReference: reference,
          status: "AMBIGUOUS",
          failureReason: err instanceof Error ? err.message : "GSUBZ verification failed"
        };
      }
    },
    async getBalance() {
      try {
        const response = (await gsubzRequest(
          { apiKey: config.apiKey, baseUrl, fetcher },
          "/balance",
          {
            method: "POST",
            body: { api: config.apiKey }
          }
        )) as GsubzBalanceResponse;
        const rawBalance = response.data?.balance ?? response.balance ?? 0;
        return {
          providerName: "gsubz",
          balanceMinor: moneyMinorFromMajor(rawBalance),
          currency: "NGN"
        };
      } catch {
        return { providerName: "gsubz", balanceMinor: 0, currency: "NGN" };
      }
    },
    async checkHealth() {
      const started = Date.now();
      try {
        await gsubzRequest({ apiKey: config.apiKey, baseUrl, fetcher }, "/category");
        return { providerName: "gsubz", status: "HEALTHY", latencyMs: Date.now() - started };
      } catch (err) {
        return {
          providerName: "gsubz",
          status: "DEGRADED",
          latencyMs: Date.now() - started,
          reason: err instanceof Error ? err.message : "GSUBZ health check failed"
        };
      }
    }
  };
}

export function createGsubzSocialSupplier(config: GsubzSocialConfig): SmmSupplierAdapter {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.gsubz.com/api");
  const fetcher = config.fetcher ?? fetch;
  const getOrderStatus = async (supplierReference: string): Promise<SmmSupplierOrderSnapshot> => {
    if (!config.apiKey) {
      return mapSocialSnapshot(supplierReference, "GSUBZ_API_KEY is not configured", "FAILED");
    }

    const requestID = supplierReference.startsWith("gsubz:")
      ? supplierReference.slice("gsubz:".length)
      : supplierReference;
    const response = (await gsubzRequest(
      { apiKey: config.apiKey, baseUrl, fetcher },
      "/verify",
      {
        method: "POST",
        body: { requestID }
      }
    )) as GsubzVerifyResponse;
    const rawStatus = getGsubzTransactionStatus(response) ?? "UNKNOWN";

    return mapSocialSnapshot(supplierReference, rawStatus, mapGsubzSocialStatus(rawStatus));
  };

  return {
    name: "gsubz",
    async listServices() {
      const catalog = await loadSocialCatalog({ ...config, baseUrl, fetcher });
      return catalog.services;
    },
    async quoteService(input) {
      const catalog = await loadSocialCatalog({ ...config, baseUrl, fetcher });
      const entries = [...catalog.byServiceId.values()].filter((entry) =>
        matchesService(
          {
            name: entry.displayName,
            category: entry.category,
            type: "socials",
            min: entry.min,
            max: entry.max
          },
          {
            serviceKind: input.serviceKind,
            quantity: input.quantity,
            destination: input.destination
          }
        )
      );
      const [best] = entries.sort((left, right) => left.rateMinorPerThousand - right.rateMinorPerThousand);
      if (!best) {
        throw new Error("GSUBZ has no matching social service for this request.");
      }

      return {
        amount: {
          amountMinor: Math.ceil((best.rateMinorPerThousand * input.quantity) / 1000),
          currency: "NGN"
        },
        estimatedDeliveryMinutes: /instant|start/i.test(best.displayName) ? 30 : 120,
        supplierName: "gsubz"
      };
    },
    async createOrder(order) {
      if (!config.apiKey) {
        throw new Error("GSUBZ social/growth ordering requires GSUBZ_API_KEY.");
      }

      const catalog = await loadSocialCatalog({ ...config, baseUrl, fetcher });
      const [matched] = [...catalog.byServiceId.values()]
        .filter((entry) =>
          matchesService(
            {
              name: entry.displayName,
              category: entry.category,
              type: "socials",
              min: entry.min,
              max: entry.max
            },
            {
              serviceKind: order.serviceKind,
              quantity: order.quantity,
              destination: order.destination
            }
          )
        )
        .sort((left, right) => left.rateMinorPerThousand - right.rateMinorPerThousand);
      if (!matched) {
        throw new Error("GSUBZ has no matching social service for this order.");
      }

      const destinationValue =
        order.destination.kind === "DELIVERY_CONTACT"
          ? order.destination.contactValue ?? ""
          : order.destination.url ?? "";
      const amountMinor = Math.ceil((matched.rateMinorPerThousand * order.quantity) / 1000);
      const requestID = buildSocialRequestId(order);

      const response = (await gsubzRequest(
        { apiKey: config.apiKey, baseUrl, fetcher },
        "/pay",
        {
          method: "POST",
          body: {
            api: config.apiKey,
            serviceID: "socials",
            plan: matched.planValue,
            amount: (amountMinor / 100).toFixed(2),
            customerID: destinationValue,
            link: destinationValue,
            quantity: order.quantity,
            phone: "00000000000",
            requestID
          }
        }
      )) as GsubzVerifyResponse;

      const status = mapGsubzSocialStatus(getGsubzTransactionStatus(response));
      return {
        supplierReference: `gsubz:${requestID}`,
        status
      };
    },
    async getBalance() {
      if (!config.apiKey) {
        return {
          supplierName: "gsubz",
          amount: {
            amountMinor: 0,
            currency: "NGN"
          }
        };
      }

      const balance = (await gsubzRequest(
        { apiKey: config.apiKey, baseUrl, fetcher },
        "/balance",
        {
          method: "POST",
          body: { api: config.apiKey }
        }
      )) as GsubzBalanceResponse;

      const rawBalance = balance.data?.balance ?? balance.balance ?? 0;
      return {
        supplierName: "gsubz",
        amount: {
          amountMinor: moneyMinorFromMajor(rawBalance),
          currency: "NGN"
        }
      };
    },
    async getOrderStatus(supplierReference) {
      return getOrderStatus(supplierReference);
    },
    async getOrderStatuses(supplierReferences) {
      return Promise.all(supplierReferences.map(getOrderStatus));
    },
    requestRefill(supplierReference) {
      return Promise.resolve({ supplierReference, accepted: false });
    },
    requestCancel(supplierReferences) {
      return Promise.resolve(
        supplierReferences.map((supplierReference) => ({
          supplierReference,
          accepted: false,
          error: "GSUBZ social API does not expose public cancel support."
        }))
      );
    }
  };
}
