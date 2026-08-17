import type { ProviderAdapterBase } from "./contract.js";
import type {
  Campaign,
  CampaignObjective,
  CurrencyCode,
  DestinationKind,
  Money,
  OtpOrderStatus,
  OtpProviderHealth,
  OtpProviderTier,
  OtpService,
  PaymentIntent,
  PromotionDestination,
  SmmOrder,
  SmmServiceKind
} from "@fliptrybe/types";

export interface CampaignQuoteRequest {
  objective: CampaignObjective;
  budgetMinor: number;
  currency: CurrencyCode;
  destinationKind: DestinationKind;
}

export interface CampaignQuote {
  estimatedReach: {
    min: number;
    max: number;
  };
  estimatedCpmMinor: number;
  currency: CurrencyCode;
}

export interface AdsProviderAdapter {
  readonly name: string;
  quoteCampaign(request: CampaignQuoteRequest): Promise<CampaignQuote>;
  createCampaign(
    campaign: Campaign
  ): Promise<{ providerReference: string; status: Campaign["status"] }>;
  startCampaign(providerReference: string): Promise<{ status: Campaign["status"] }>;
  pauseCampaign(providerReference: string): Promise<{ status: Campaign["status"] }>;
}

export interface PaymentGatewayAdapter {
  readonly name: string;
  createPaymentIntent(input: {
    amount: Money;
    workspaceId: string;
    customerEmail?: string;
    customerName?: string;
    redirectUrl?: string;
    webhookUrl?: string;
  }): Promise<PaymentIntent>;
  verifyPayment(
    reference: string
  ): Promise<{ status: PaymentIntent["status"]; providerReference: string }>;
}

export interface SmmSupplierAdapter {
  readonly name: string;
  listServices(): Promise<SmmSupplierService[]>;
  quoteService(input: {
    serviceKind: SmmServiceKind;
    quantity: number;
    destination: PromotionDestination;
  }): Promise<SmmSupplierQuote>;
  createOrder(order: SmmOrder): Promise<{ supplierReference: string; status: SmmOrder["status"] }>;
  getBalance(): Promise<SmmSupplierBalance>;
  getOrderStatus(supplierReference: string): Promise<SmmSupplierOrderSnapshot>;
  getOrderStatuses(supplierReferences: string[]): Promise<SmmSupplierOrderSnapshot[]>;
  requestRefill(supplierReference: string): Promise<SmmSupplierRefillResult>;
  requestCancel(supplierReferences: string[]): Promise<SmmSupplierCancelResult[]>;
}

export interface SmmSupplierQuote {
  amount: Money;
  estimatedDeliveryMinutes: number;
  supplierName?: string;
}

export interface SmmSupplierService {
  supplierName: string;
  serviceId: string;
  name: string;
  category?: string;
  type?: string;
  rate: Money;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
}

export interface SmmSupplierBalance {
  supplierName: string;
  amount: Money;
}

export interface SmmSupplierOrderSnapshot {
  supplierReference: string;
  status: SmmOrder["status"];
  rawStatus?: string;
  charge?: Money;
  startCount?: number;
  remains?: number;
}

export interface SmmSupplierRefillResult {
  supplierReference: string;
  refillReference?: string;
  accepted: boolean;
}

export interface SmmSupplierCancelResult {
  supplierReference: string;
  accepted: boolean;
  error?: string;
}

export interface AiGenerationAdapter {
  readonly name: string;
  generateCampaignCopy(input: {
    objective: CampaignObjective;
    destinationKind: DestinationKind;
    audience: string;
  }): Promise<{ headlines: string[]; captions: string[]; hashtags: string[] }>;
}

export interface NotificationProviderAdapter {
  readonly name: string;
  // True only when this adapter has the live configuration it needs (e.g. a
  // channel-specific Termii configuration ID). NotificationService checks this
  // before dispatch so a channel with no configured credentials is marked
  // PENDING rather than silently "succeeding" against nothing.
  isConfigured(): boolean;
  send(input: {
    channel: "EMAIL" | "IN_APP" | "SMS" | "WEBSOCKET" | "WHATSAPP";
    to: string;
    title: string;
    body: string;
  }): Promise<{ id: string; accepted: boolean; providerStatus?: string; raw?: unknown }>;
}

export interface StorageProviderAdapter {
  readonly name: string;
  createUploadUrl(input: {
    key: string;
    contentType: string;
  }): Promise<{ uploadUrl: string; publicUrl: string }>;
}

export interface OtpProviderQuoteRequest {
  serviceCode: string;
  countryCode: string;
  tier: OtpProviderTier;
}

export interface OtpProviderQuote {
  providerName: string;
  tier: OtpProviderTier;
  serviceCode: string;
  countryCode: string;
  supplierCost: Money;
  available: boolean;
  estimatedLatencyMs: number;
  successRateBps: number;
  inventory: number;
}

export interface OtpProviderOrderRequest extends OtpProviderQuoteRequest {
  orderId: string;
  callbackUrl?: string;
}

export interface OtpProviderOrderResult {
  providerName: string;
  providerReference: string;
  status: OtpOrderStatus;
  phoneNumberMasked?: string;
  expiresAt?: string;
}

export interface OtpProviderOrderSnapshot {
  providerName: string;
  providerReference: string;
  status: OtpOrderStatus;
  phoneNumberMasked?: string;
  redactedMessage?: string;
  receivedAt?: string;
}

export interface OtpProviderBalance {
  providerName: string;
  amount: Money;
}

export interface OtpProviderAdapter {
  readonly name: string;
  readonly tier: OtpProviderTier;
  listServices(): Promise<OtpService[]>;
  quoteService(input: OtpProviderQuoteRequest): Promise<OtpProviderQuote>;
  createOrder(input: OtpProviderOrderRequest): Promise<OtpProviderOrderResult>;
  getOrderStatus(providerReference: string): Promise<OtpProviderOrderSnapshot>;
  cancelOrder(providerReference: string): Promise<{ providerReference: string; accepted: boolean }>;
  getBalance(): Promise<OtpProviderBalance>;
  checkHealth(): Promise<OtpProviderHealth>;
}

export interface CloudinaryStorageConfig {
  cloudName?: string | undefined;
  uploadPreset?: string | undefined;
  folder?: string | undefined;
  secureDistribution?: string | undefined;
}

export interface KorapayPaymentGatewayConfig {
  secretKey?: string | undefined;
  publicKey?: string | undefined;
  encryptionKey?: string | undefined;
  baseUrl?: string | undefined;
  defaultRedirectUrl?: string | undefined;
  defaultWebhookUrl?: string | undefined;
  fetcher?: typeof fetch | undefined;
}

export interface PaystackPaymentGatewayConfig {
  secretKey?: string | undefined;
  publicKey?: string | undefined;
  baseUrl?: string | undefined;
  defaultRedirectUrl?: string | undefined;
  fetcher?: typeof fetch | undefined;
}

export interface PayscribePaymentGatewayConfig {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  defaultRedirectUrl?: string | undefined;
  fetcher?: typeof fetch | undefined;
}

interface KorapayInitializeResponse {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    payment_reference?: string;
    checkout_url?: string;
    status?: string;
  };
}

interface KorapayVerifyResponse {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    payment_reference?: string;
    status?: string;
    amount?: string | number;
    currency?: string;
  };
}

interface PaystackInitializeResponse {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
}

interface PaystackVerifyResponse {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };
}

interface PayscribeEnvelope {
  status?: boolean;
  description?: string;
  message?: {
    description?: string;
    status?: string;
    details?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
}

export interface PerfectPanelSmmSupplierConfig {
  name: string;
  apiUrl: string;
  apiKey?: string | undefined;
  currency?: CurrencyCode | undefined;
  serviceMap?: Partial<Record<SmmServiceKind, string>> | undefined;
  bulkStatusParam?: "order" | "orders" | undefined;
  cancelMode?: "single-order" | "bulk-orders" | undefined;
  fetcher?: typeof fetch | undefined;
}

export interface OtpHttpProviderConfig {
  apiUrl?: string | undefined;
  apiKey?: string | undefined;
  enabled?: boolean | undefined;
  fetcher?: typeof fetch | undefined;
}

interface PerfectPanelService {
  service: string | number;
  name: string;
  type?: string;
  category?: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  refill?: boolean | undefined;
  cancel?: boolean | undefined;
  dripfeed?: boolean | undefined;
}

interface PerfectPanelQuoteResponse {
  charge?: string | number;
  rate?: string | number;
  currency?: string;
}

interface PerfectPanelBalanceResponse {
  balance?: string | number;
  currency?: string;
}

interface PerfectPanelStatusResponse {
  charge?: string | number;
  start_count?: string | number;
  status?: string;
  remains?: string | number;
  currency?: string;
  error?: string;
}

interface PerfectPanelSuccessResponse {
  success?: string;
  error?: string;
}

interface PerfectPanelBulkCancelResponse {
  order: string | number;
  cancel?: string | number | { error: string };
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeCloudinaryPublicId(key: string, folder?: string) {
  const normalizedKey = key.replace(/^\/+/, "").replace(/\.[a-z0-9]+$/i, "");
  const normalizedFolder = folder?.replace(/^\/+|\/+$/g, "");

  return normalizedFolder ? `${normalizedFolder}/${normalizedKey}` : normalizedKey;
}

function getCloudinaryResourceType(contentType: string) {
  if (contentType.startsWith("video/")) {
    return "video";
  }

  if (contentType.startsWith("image/")) {
    return "image";
  }

  return "auto";
}

function parseNumber(value: string | number) {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getCurrency(value: string | undefined, fallback: CurrencyCode): CurrencyCode {
  const allowedCurrencies = ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"];

  return allowedCurrencies.includes(value ?? "") ? (value as CurrencyCode) : fallback;
}

function moneyFromRate(
  ratePerThousand: string | number,
  quantity: number,
  currency: CurrencyCode
): Money {
  return {
    amountMinor: Math.ceil((parseNumber(ratePerThousand) * quantity * 100) / 1000),
    currency
  };
}

function moneyFromCharge(charge: string | number | undefined, currency: CurrencyCode): Money {
  return {
    amountMinor: Math.ceil(parseNumber(charge ?? 0) * 100),
    currency
  };
}

function moneyToMajorString(amount: Money) {
  return (amount.amountMinor / 100).toFixed(2);
}

function mapKorapayPaymentStatus(status?: string): PaymentIntent["status"] {
  const normalizedStatus = status?.toLowerCase().trim();

  switch (normalizedStatus) {
    case "success":
    case "successful":
    case "completed":
      return "COMPLETED";
    case "processing":
    case "pending":
      return "PENDING";
    case "requires_action":
    case "requires action":
      return "REQUIRES_ACTION";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    default:
      return "FAILED";
  }
}

function getKorapayBaseUrl(config: KorapayPaymentGatewayConfig) {
  return (config.baseUrl ?? "https://api.korapay.com").replace(/\/+$/, "");
}

function getKorapayReference(prefix = "korapay") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getPaystackBaseUrl(config: PaystackPaymentGatewayConfig) {
  return (config.baseUrl ?? "https://api.paystack.co").replace(/\/+$/, "");
}

function getPayscribeBaseUrl(config: PayscribePaymentGatewayConfig) {
  return (config.baseUrl ?? "https://api.payscribe.ng/api/v1").replace(/\/+$/, "");
}

function mapPaystackPaymentStatus(status?: string): PaymentIntent["status"] {
  const normalizedStatus = status?.toLowerCase().trim();

  switch (normalizedStatus) {
    case "success":
    case "successful":
      return "COMPLETED";
    case "abandoned":
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "ongoing":
    case "pending":
    case "processing":
      return "PENDING";
    default:
      return "FAILED";
  }
}

async function callPaystackApi(
  config: PaystackPaymentGatewayConfig,
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  }
) {
  if (!config.secretKey) {
    throw new Error("Paystack requires PAYSTACK_SECRET_KEY.");
  }

  const response = await (config.fetcher ?? fetch)(`${getPaystackBaseUrl(config)}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "content-type": "application/json"
    },
    ...(options?.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
  const data: unknown = await response.json();

  if (typeof data === "object" && data !== null && "status" in data && data.status === false) {
    const message =
      "message" in data && typeof data.message === "string" ? data.message : "Paystack API error.";
    throw new Error(message);
  }
  if (!response.ok) {
    throw new Error(`Paystack API returned HTTP ${response.status}.`);
  }

  return data;
}

async function callPayscribeGatewayApi(
  config: PayscribePaymentGatewayConfig,
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  }
) {
  if (!config.apiKey) {
    throw new Error("Payscribe requires PAYSCRIBE_API_KEY.");
  }

  const response = await (config.fetcher ?? fetch)(`${getPayscribeBaseUrl(config)}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    ...(options?.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
  const data: unknown = await response.json();

  if (typeof data === "object" && data !== null && "status" in data && data.status === false) {
    const envelope = data as PayscribeEnvelope;
    throw new Error(
      envelope.message?.description ?? envelope.description ?? "Payscribe API error."
    );
  }
  if (!response.ok) {
    throw new Error(`Payscribe API returned HTTP ${response.status}.`);
  }

  return data;
}

async function callKorapayApi(
  config: KorapayPaymentGatewayConfig,
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  }
) {
  if (!config.secretKey) {
    throw new Error("Korapay requires KORAPAY_SECRET_KEY.");
  }

  const response = await (config.fetcher ?? fetch)(`${getKorapayBaseUrl(config)}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      authorization: `Bearer ${config.secretKey}`,
      "content-type": "application/json"
    },
    ...(options?.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
  const data: unknown = await response.json();

  if (typeof data === "object" && data !== null && "status" in data && data.status === false) {
    const message =
      "message" in data && typeof data.message === "string" ? data.message : "Korapay API error.";
    throw new Error(message);
  }
  if (!response.ok) {
    throw new Error(`Korapay API returned HTTP ${response.status}.`);
  }

  return data;
}

function normalizeSupplierReference(supplierName: string, supplierReference: string) {
  return supplierReference.startsWith(`${supplierName}:`)
    ? supplierReference.slice(supplierName.length + 1)
    : supplierReference;
}

function mapPerfectPanelStatus(status?: string): SmmOrder["status"] {
  const normalizedStatus = status?.toLowerCase().trim();

  switch (normalizedStatus) {
    case "completed":
      return "COMPLETED";
    case "partial":
      return "PARTIAL";
    case "canceled":
    case "cancelled":
    case "refunded":
      return "CANCELLED";
    case "processing":
    case "in progress":
      return "PROCESSING";
    case "pending":
      return "QUEUED";
    default:
      return "FAILED";
  }
}

function isSuccessResponse(value: unknown): value is PerfectPanelSuccessResponse {
  return typeof value === "object" && value !== null && ("success" in value || "error" in value);
}

function isStatusResponse(value: unknown): value is PerfectPanelStatusResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("status" in value || "charge" in value || "remains" in value || "error" in value)
  );
}

function getServiceKeywordGroups(serviceKind: SmmServiceKind) {
  switch (serviceKind) {
    case "FOLLOWERS":
      return [["follower", "followers"]];
    case "LIKES":
      return [["like", "likes"]];
    case "VIEWS":
      return [["view", "views"]];
    case "COMMENTS":
      return [["comment", "comments"]];
    case "SHARES":
      return [["share", "shares"]];
    case "LIVE_VIEWERS":
      return [["live"], ["viewer", "viewers"]];
    case "CHANNEL_MEMBERS":
      return [["member", "members", "subscriber", "subscribers"]];
    case "ACCOUNT_SALE":
      return [["account", "accounts"]];
    case "VPN_SUBSCRIPTION":
      return [["vpn"]];
    case "STREAMING_SUBSCRIPTION":
      return [["netflix", "streaming", "subscription"]];
  }
}

function getDestinationKeywords(destination: PromotionDestination) {
  const kind = destination.kind.toLowerCase();

  if (kind.includes("tiktok")) {
    return ["tiktok"];
  }
  if (kind.includes("instagram")) {
    return ["instagram", "ig"];
  }
  if (kind.includes("facebook")) {
    return ["facebook", "fb"];
  }
  if (kind.includes("youtube")) {
    return ["youtube", "yt"];
  }
  if (kind.includes("telegram")) {
    return ["telegram"];
  }
  if (kind.includes("whatsapp")) {
    return ["whatsapp"];
  }

  return [];
}

function serviceText(service: PerfectPanelService) {
  return `${service.name} ${service.category ?? ""} ${service.type ?? ""}`.toLowerCase();
}

function matchesService(
  service: PerfectPanelService,
  input: { serviceKind: SmmServiceKind; quantity: number; destination: PromotionDestination }
) {
  const text = serviceText(service);
  const minimum = parseNumber(service.min);
  const maximum = parseNumber(service.max);
  const serviceKeywordGroups = getServiceKeywordGroups(input.serviceKind);
  const destinationKeywords = getDestinationKeywords(input.destination);
  const quantityFits = input.quantity >= minimum && (maximum === 0 || input.quantity <= maximum);
  const serviceMatches = serviceKeywordGroups.every((group) =>
    group.some((keyword) => text.includes(keyword))
  );
  const destinationMatches =
    destinationKeywords.length === 0 ||
    destinationKeywords.some((keyword) => text.includes(keyword));

  return quantityFits && serviceMatches && destinationMatches;
}

function parseSmmServiceMapValue(value?: string) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as Partial<Record<SmmServiceKind, string>>;
  } catch {
    return Object.fromEntries(
      value
        .split(",")
        .map((entry) => entry.trim().split(":"))
        .filter((entry): entry is [SmmServiceKind, string] => entry.length === 2)
        .map(([kind, serviceId]) => [kind, serviceId.trim()])
    ) as Partial<Record<SmmServiceKind, string>>;
  }
}

async function postPerfectPanelApi(
  config: PerfectPanelSmmSupplierConfig,
  params: Record<string, string>
) {
  if (!config.apiKey) {
    throw new Error(`${config.name} requires an API key.`);
  }

  const response = await (config.fetcher ?? fetch)(config.apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      key: config.apiKey,
      ...params
    })
  });
  const data: unknown = await response.json();

  if (typeof data === "object" && data !== null && "error" in data) {
    throw new Error(`${config.name} API error: ${String(data.error)}`);
  }
  if (!response.ok) {
    throw new Error(`${config.name} API returned HTTP ${response.status}.`);
  }

  return data;
}

function normalizePerfectPanelService(
  supplierName: string,
  service: PerfectPanelService,
  currency: CurrencyCode
): SmmSupplierService {
  return {
    supplierName,
    serviceId: String(service.service),
    name: service.name,
    rate: {
      amountMinor: Math.ceil(parseNumber(service.rate) * 100),
      currency
    },
    min: parseNumber(service.min),
    max: parseNumber(service.max),
    refill: service.refill ?? false,
    cancel: service.cancel ?? false,
    dripfeed: service.dripfeed ?? false,
    ...(service.category === undefined ? {} : { category: service.category }),
    ...(service.type === undefined ? {} : { type: service.type })
  };
}

function normalizePerfectPanelStatus(
  supplierName: string,
  supplierReference: string,
  response: PerfectPanelStatusResponse,
  fallbackCurrency: CurrencyCode
): SmmSupplierOrderSnapshot {
  if (response.error) {
    return {
      supplierReference,
      status: "FAILED",
      rawStatus: response.error
    };
  }

  const currency = getCurrency(response.currency, fallbackCurrency);
  const snapshot: SmmSupplierOrderSnapshot = {
    supplierReference: supplierReference.includes(":")
      ? supplierReference
      : `${supplierName}:${supplierReference}`,
    status: mapPerfectPanelStatus(response.status),
    ...(response.status === undefined ? {} : { rawStatus: response.status })
  };

  return {
    ...snapshot,
    ...(response.charge === undefined
      ? {}
      : { charge: moneyFromCharge(response.charge, currency) }),
    ...(response.start_count === undefined
      ? {}
      : { startCount: parseNumber(response.start_count) }),
    ...(response.remains === undefined ? {} : { remains: parseNumber(response.remains) })
  };
}

export function createMockAdsProvider(): AdsProviderAdapter {
  return {
    name: "mock-ads",
    quoteCampaign(request) {
      const budgetFactor = Math.max(1, Math.floor(request.budgetMinor / 1000));

      return Promise.resolve({
        estimatedReach: {
          min: budgetFactor * 18,
          max: budgetFactor * 42
        },
        estimatedCpmMinor: request.destinationKind.includes("LIVE") ? 1500 : 900,
        currency: request.currency
      });
    },
    createCampaign() {
      return Promise.resolve({ providerReference: makeId("mock_ads"), status: "QUEUED" });
    },
    startCampaign() {
      return Promise.resolve({ status: "ACTIVE" });
    },
    pauseCampaign() {
      return Promise.resolve({ status: "PAUSED" });
    }
  };
}

export function createMockPaymentGateway(): PaymentGatewayAdapter {
  return {
    name: "mock-payments",
    createPaymentIntent(input) {
      const now = new Date().toISOString();

      return Promise.resolve({
        id: makeId("pay"),
        workspaceId: input.workspaceId,
        gateway: "MOCK",
        amount: input.amount,
        status: "PENDING",
        providerReference: makeId("mock_payment"),
        createdAt: now,
        updatedAt: now
      });
    },
    verifyPayment(reference) {
      return Promise.resolve({ status: "COMPLETED", providerReference: reference });
    }
  };
}

// Verified against https://developers.korapay.com/docs/checkout-redirect (checked 2026-08-07):
// base URL https://api.korapay.com, POST /merchant/api/v1/charges/initialize, Bearer secret-key
// auth, response contains `reference` and `checkout_url` for redirect. Matches this adapter as-is;
// no changes made.
export function createKorapayPaymentGateway(
  config: KorapayPaymentGatewayConfig
): PaymentGatewayAdapter {
  return {
    name: "korapay",
    async createPaymentIntent(input) {
      const now = new Date().toISOString();
      const reference = getKorapayReference("ft_pay");
      const response = (await callKorapayApi(config, "/merchant/api/v1/charges/initialize", {
        method: "POST",
        body: {
          amount: moneyToMajorString(input.amount),
          currency: input.amount.currency,
          reference,
          customer: {
            name: input.customerName ?? "FlipTrybe Customer",
            email: input.customerEmail ?? "billing@fliptrybe.com"
          },
          redirect_url: input.redirectUrl ?? config.defaultRedirectUrl,
          notification_url: input.webhookUrl ?? config.defaultWebhookUrl,
          metadata: {
            workspaceId: input.workspaceId
          }
        }
      })) as KorapayInitializeResponse;

      const providerReference =
        response.data?.reference ?? response.data?.payment_reference ?? reference;
      const intent: PaymentIntent = {
        id: makeId("pay"),
        workspaceId: input.workspaceId,
        gateway: "KORAPAY",
        amount: input.amount,
        status: response.data?.status ? mapKorapayPaymentStatus(response.data.status) : "PENDING",
        providerReference,
        createdAt: now,
        updatedAt: now,
        metadata: {
          providerReference,
          publicKeyConfigured: Boolean(config.publicKey),
          encryptionKeyConfigured: Boolean(config.encryptionKey)
        }
      };

      return response.data?.checkout_url
        ? { ...intent, checkoutUrl: response.data.checkout_url }
        : intent;
    },
    async verifyPayment(reference) {
      const response = (await callKorapayApi(
        config,
        `/merchant/api/v1/charges/${encodeURIComponent(reference)}`
      )) as KorapayVerifyResponse;

      return {
        status: mapKorapayPaymentStatus(response.data?.status),
        providerReference: response.data?.reference ?? response.data?.payment_reference ?? reference
      };
    }
  };
}

// Verified against https://paystack.com/docs/api/transaction/ (checked 2026-08-07): base URL
// https://api.paystack.co, POST /transaction/initialize + GET /transaction/verify/:reference,
// Bearer secret-key auth, `{status:false, message}` error shape. Matches this adapter as-is;
// no changes made.
export function createPaystackPaymentGateway(
  config: PaystackPaymentGatewayConfig
): PaymentGatewayAdapter {
  return {
    name: "paystack",
    async createPaymentIntent(input) {
      const now = new Date().toISOString();
      const reference = getKorapayReference("ft_ps");
      const response = (await callPaystackApi(config, "/transaction/initialize", {
        method: "POST",
        body: {
          email: input.customerEmail ?? "billing@fliptrybe.com",
          amount: input.amount.amountMinor,
          currency: input.amount.currency,
          reference,
          callback_url: input.redirectUrl ?? config.defaultRedirectUrl,
          metadata: {
            workspaceId: input.workspaceId,
            customerName: input.customerName ?? "FlipTrybe Customer"
          }
        }
      })) as PaystackInitializeResponse;

      const providerReference = response.data?.reference ?? reference;
      const intent: PaymentIntent = {
        id: makeId("pay"),
        workspaceId: input.workspaceId,
        gateway: "PAYSTACK",
        amount: input.amount,
        status: "PENDING",
        providerReference,
        createdAt: now,
        updatedAt: now,
        metadata: {
          providerReference,
          publicKeyConfigured: Boolean(config.publicKey),
          accessCode: response.data?.access_code ?? null
        }
      };

      return response.data?.authorization_url
        ? { ...intent, checkoutUrl: response.data.authorization_url }
        : intent;
    },
    async verifyPayment(reference) {
      const response = (await callPaystackApi(
        config,
        `/transaction/verify/${encodeURIComponent(reference)}`
      )) as PaystackVerifyResponse;

      return {
        status: mapPaystackPaymentStatus(response.data?.status),
        providerReference: response.data?.reference ?? reference
      };
    }
  };
}

function payscribeDetails(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) return {};
  const envelope = payload as PayscribeEnvelope;
  const message = envelope.message;
  if (message?.details && typeof message.details === "object") return message.details;
  if (message?.data && typeof message.data === "object") return message.data;
  if (message && typeof message === "object") return message as Record<string, unknown>;
  return payload as Record<string, unknown>;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function mapPayscribePaymentStatus(status?: string): PaymentIntent["status"] {
  const normalizedStatus = status?.toLowerCase().trim();

  switch (normalizedStatus) {
    case "success":
    case "successful":
    case "completed":
    case "paid":
      return "COMPLETED";
    case "pending":
    case "processing":
    case "partially_paid":
      return "PENDING";
    case "cancelled":
    case "canceled":
    case "expired":
    case "inactive":
      return "CANCELLED";
    case "requires_action":
    case "requires action":
      return "REQUIRES_ACTION";
    default:
      return "FAILED";
  }
}

// Payscribe checkout for USD invoices. The Payscribe invoice API requires a
// provider-side customer_id, which FlipTrybe's public invoice model does not
// carry. Payment Links accept an email/name payer flow and still settle through
// Payscribe, so they fit the existing /public/invoices/:id/pay contract.
export function createPayscribePaymentGateway(
  config: PayscribePaymentGatewayConfig
): PaymentGatewayAdapter {
  return {
    name: "payscribe",
    async createPaymentIntent(input) {
      const now = new Date().toISOString();
      const reference = getKorapayReference("ft_psc");
      const response = await callPayscribeGatewayApi(config, "/links/", {
        method: "POST",
        body: {
          title: `FlipTrybe invoice ${reference.slice(-8)}`,
          description: `Invoice payment for ${input.customerName ?? "FlipTrybe Customer"}`,
          currency: input.amount.currency,
          amount: input.amount.amountMinor,
          ref: reference,
          redirect: input.redirectUrl ?? config.defaultRedirectUrl,
          customer: {
            name: input.customerName ?? "FlipTrybe Customer",
            email: input.customerEmail ?? "billing@fliptrybe.com"
          },
          metadata: {
            workspaceId: input.workspaceId
          }
        }
      });

      const details = payscribeDetails(response);
      const providerReference =
        stringValue(details["ref"]) ||
        stringValue(details["reference"]) ||
        stringValue(details["id"]) ||
        reference;
      const checkoutUrl =
        stringValue(details["url"]) ||
        stringValue(details["link"]) ||
        stringValue(details["payment_url"]) ||
        stringValue(details["checkout_url"]) ||
        stringValue(details["custom_link"]);

      const intent: PaymentIntent = {
        id: makeId("pay"),
        workspaceId: input.workspaceId,
        gateway: "PAYSCRIBE",
        amount: input.amount,
        status: mapPayscribePaymentStatus(stringValue(details["status"], "pending")),
        providerReference,
        createdAt: now,
        updatedAt: now,
        metadata: {
          providerReference,
          payscribeLinkId: stringValue(details["id"]) || null
        }
      };

      return checkoutUrl ? { ...intent, checkoutUrl } : intent;
    },
    async verifyPayment(reference) {
      const response = await callPayscribeGatewayApi(
        config,
        `/requery/?trans_id=${encodeURIComponent(reference)}`
      );
      const details = payscribeDetails(response);
      const status =
        stringValue(details["status"]) ||
        stringValue(details["payment_status"]) ||
        stringValue(details["state"]);

      return {
        status: mapPayscribePaymentStatus(status),
        providerReference:
          stringValue(details["ref"]) ||
          stringValue(details["trans_id"]) ||
          stringValue(details["invoice_id"]) ||
          reference
      };
    }
  };
}

export function createMockSmmSupplier(): SmmSupplierAdapter {
  return {
    name: "mock-smm",
    listServices() {
      return Promise.resolve([
        {
          supplierName: "mock-smm",
          serviceId: "mock_followers",
          name: "Mock Instagram Followers",
          category: "Instagram",
          type: "Default",
          rate: { amountMinor: 2500000, currency: "NGN" },
          min: 10,
          max: 100000,
          refill: true,
          cancel: true,
          dripfeed: false
        }
      ]);
    },
    quoteService(input) {
      return Promise.resolve({
        amount: { amountMinor: input.quantity * 25, currency: "NGN" },
        estimatedDeliveryMinutes: input.serviceKind === "LIVE_VIEWERS" ? 10 : 120
      });
    },
    createOrder() {
      return Promise.resolve({ supplierReference: makeId("mock_smm"), status: "QUEUED" });
    },
    getBalance() {
      return Promise.resolve({
        supplierName: "mock-smm",
        amount: { amountMinor: 100000000, currency: "NGN" }
      });
    },
    getOrderStatus(supplierReference) {
      return Promise.resolve({
        supplierReference,
        status: "PROCESSING",
        rawStatus: "In progress",
        charge: { amountMinor: 25000, currency: "NGN" },
        startCount: 100,
        remains: 50
      });
    },
    getOrderStatuses(supplierReferences) {
      return Promise.resolve(
        supplierReferences.map((supplierReference) => ({
          supplierReference,
          status: "PROCESSING" as const,
          rawStatus: "In progress",
          charge: { amountMinor: 25000, currency: "NGN" as const },
          startCount: 100,
          remains: 50
        }))
      );
    },
    requestRefill(supplierReference) {
      return Promise.resolve({
        supplierReference,
        refillReference: makeId("mock_refill"),
        accepted: true
      });
    },
    requestCancel(supplierReferences) {
      return Promise.resolve(
        supplierReferences.map((supplierReference) => ({
          supplierReference,
          accepted: true
        }))
      );
    }
  };
}

export function parseSmmServiceMap(value?: string): Partial<Record<SmmServiceKind, string>> {
  return parseSmmServiceMapValue(value);
}

// Perfect Panel API convention verified against https://peakerr.com/api (checked 2026-08-07,
// reachable and confirmed live): base URL https://peakerr.com/api/v2, single POST endpoint with
// `key` + `action` in {services, add, status, refill, cancel, balance}, `order`/`orders` for
// status/refill/cancel, response fields order/charge/status/remains/currency — matches this
// adapter's action names and postPerfectPanelApi shape as-is.
// justanotherpanel.com/api and app.sizzlesocial.ng/api/v1 render client-side JS and returned no
// parsable technical spec via fetch; smdpanel.com/api/v2 was not independently reachable either.
// www.smmraja.com/api (and the ?page=api redirect target) also render client-side and could not
// be confirmed to actually be v3 vs. the more common v2 — no public source verifies the configured
// SMMRAJA_API_URL version, so it is left unchanged rather than "fixed" on a guess.
export function createPerfectPanelSmmSupplier(
  config: PerfectPanelSmmSupplierConfig
): SmmSupplierAdapter {
  const currency = config.currency ?? "USD";

  async function fetchServices() {
    const services = (await postPerfectPanelApi(config, {
      action: "services"
    })) as PerfectPanelService[];

    if (!Array.isArray(services)) {
      throw new Error(`${config.name} did not return a service list.`);
    }

    return services;
  }

  async function selectService(input: {
    serviceKind: SmmServiceKind;
    quantity: number;
    destination: PromotionDestination;
  }) {
    const configuredServiceId = config.serviceMap?.[input.serviceKind];
    const services = await fetchServices();

    if (configuredServiceId) {
      const configuredService = services.find(
        (service) => String(service.service) === String(configuredServiceId)
      );

      if (!configuredService) {
        throw new Error(
          `${config.name} service map references missing service ${configuredServiceId}.`
        );
      }

      return configuredService;
    }

    const matchedServices = services.filter((service) => matchesService(service, input));
    const cheapestService = matchedServices.sort(
      (left, right) => parseNumber(left.rate) - parseNumber(right.rate)
    )[0];

    if (!cheapestService) {
      throw new Error(
        `${config.name} has no matching ${input.serviceKind} service for ${input.destination.kind}.`
      );
    }

    return cheapestService;
  }

  async function quoteSelectedService(service: PerfectPanelService, quantity: number) {
    try {
      const response = (await postPerfectPanelApi(config, {
        action: "quote",
        service: String(service.service),
        quantity: String(quantity)
      })) as PerfectPanelQuoteResponse;
      const quoteCurrency = getCurrency(response.currency, currency);

      if (response.charge !== undefined) {
        return moneyFromCharge(response.charge, quoteCurrency);
      }
    } catch {
      // Some Perfect Panel-compatible providers do not expose quote; rate-based math remains valid.
    }

    // Digital account/subscription rates are stored per-1000 units just like engagement
    // services (e.g. a rate of 2,780,000 charges 2,780 for one account at quantity=1).
    return moneyFromRate(service.rate, quantity, currency);
  }

  return {
    name: config.name,
    async listServices() {
      const services = await fetchServices();

      return services.map((service) =>
        normalizePerfectPanelService(config.name, service, currency)
      );
    },
    async quoteService(input) {
      const service = await selectService(input);

      return {
        amount: await quoteSelectedService(service, input.quantity),
        estimatedDeliveryMinutes: input.serviceKind === "LIVE_VIEWERS" ? 10 : 120,
        supplierName: config.name
      };
    },
    async createOrder(order) {
      const service = await selectService({
        serviceKind: order.serviceKind,
        quantity: order.quantity,
        destination: order.destination
      });
      // Digital account services (Sizzle's Instagram-account marketplace, and any future
      // VPN/streaming equivalents) don't take a target link — they deliver credentials to
      // an email via destination_email. Everything else keeps the usual link/quantity add.
      const response = (await postPerfectPanelApi(
        config,
        order.destination.kind === "DELIVERY_CONTACT"
          ? {
              action: "add",
              service: String(service.service),
              quantity: String(order.quantity),
              destination_email: order.destination.contactValue ?? ""
            }
          : {
              action: "add",
              service: String(service.service),
              link: order.destination.url ?? "",
              quantity: String(order.quantity)
            }
      )) as { order?: string | number };

      if (!response.order) {
        throw new Error(`${config.name} did not return an order id.`);
      }

      return {
        supplierReference: `${config.name}:${response.order}`,
        status: "QUEUED"
      };
    },
    async getBalance() {
      const response = (await postPerfectPanelApi(config, {
        action: "balance"
      })) as PerfectPanelBalanceResponse;

      if (response.balance === undefined) {
        throw new Error(`${config.name} did not return a balance.`);
      }

      return {
        supplierName: config.name,
        amount: moneyFromCharge(response.balance, getCurrency(response.currency, currency))
      };
    },
    async getOrderStatus(supplierReference) {
      const orderId = normalizeSupplierReference(config.name, supplierReference);
      const response = (await postPerfectPanelApi(config, {
        action: "status",
        order: orderId
      })) as PerfectPanelStatusResponse;

      return normalizePerfectPanelStatus(config.name, supplierReference, response, currency);
    },
    async getOrderStatuses(supplierReferences) {
      const orderIds = supplierReferences
        .map((supplierReference) => normalizeSupplierReference(config.name, supplierReference))
        .join(",");
      const statusParam = config.bulkStatusParam ?? "orders";
      const response = await postPerfectPanelApi(config, {
        action: "status",
        [statusParam]: orderIds
      });

      if (supplierReferences.length === 1 && isStatusResponse(response)) {
        const [supplierReference] = supplierReferences;

        if (!supplierReference) {
          return [];
        }

        return [normalizePerfectPanelStatus(config.name, supplierReference, response, currency)];
      }

      const keyedResponse = response as Record<string, PerfectPanelStatusResponse>;

      return supplierReferences.map((supplierReference) => {
        const orderId = normalizeSupplierReference(config.name, supplierReference);
        const statusResponse = keyedResponse[orderId] ?? {
          error: "Missing supplier status response."
        };

        return normalizePerfectPanelStatus(
          config.name,
          supplierReference,
          statusResponse,
          currency
        );
      });
    },
    async requestRefill(supplierReference) {
      const orderId = normalizeSupplierReference(config.name, supplierReference);
      const response = (await postPerfectPanelApi(config, {
        action: "refill",
        order: orderId
      })) as { refill?: string | number; success?: string };
      const accepted = response.refill !== undefined || Boolean(response.success);

      return {
        supplierReference,
        ...(response.refill === undefined ? {} : { refillReference: String(response.refill) }),
        accepted
      };
    },
    async requestCancel(supplierReferences) {
      if (config.cancelMode === "single-order") {
        return Promise.all(
          supplierReferences.map(async (supplierReference) => {
            const orderId = normalizeSupplierReference(config.name, supplierReference);
            const response = await postPerfectPanelApi(config, {
              action: "cancel",
              order: orderId
            });
            const successResponse = isSuccessResponse(response) ? response : {};

            return {
              supplierReference,
              accepted: Boolean(successResponse.success),
              ...(successResponse.error === undefined ? {} : { error: successResponse.error })
            };
          })
        );
      }

      const orderIds = supplierReferences
        .map((supplierReference) => normalizeSupplierReference(config.name, supplierReference))
        .join(",");
      const response = (await postPerfectPanelApi(config, {
        action: "cancel",
        orders: orderIds
      })) as PerfectPanelBulkCancelResponse[] | PerfectPanelSuccessResponse;

      if (isSuccessResponse(response)) {
        return supplierReferences.map((supplierReference) => ({
          supplierReference,
          accepted: Boolean(response.success),
          ...(response.error === undefined ? {} : { error: response.error })
        }));
      }

      if (!Array.isArray(response)) {
        throw new Error(`${config.name} did not return cancellation results.`);
      }

      return supplierReferences.map((supplierReference) => {
        const orderId = normalizeSupplierReference(config.name, supplierReference);
        const result = response.find((item) => String(item.order) === String(orderId));
        const cancelResult = result?.cancel;
        const error =
          typeof cancelResult === "object" && cancelResult !== null
            ? cancelResult.error
            : undefined;

        return {
          supplierReference,
          accepted: cancelResult !== undefined && error === undefined,
          ...(error === undefined ? {} : { error })
        };
      });
    }
  };
}

export interface RoutedSmmSupplierOptions {
  /**
   * Exchange rates keyed by currency, expressed as minor units of the
   * comparison currency per one minor unit of that currency. Only used to make
   * quotes comparable — the winning quote's own amount and currency are
   * returned untouched.
   *
   * Without this, quotes in different currencies cannot be ranked by price at
   * all (see the comparator below), so a mixed-currency panel set falls back to
   * a stable, explicitly non-price ordering.
   */
  rates?: Record<string, number>;
  /** Currency the rates convert into. Defaults to the first quote's currency. */
  comparisonCurrency?: string;
}

export function createRoutedSmmSupplier(
  suppliers: SmmSupplierAdapter[],
  options: RoutedSmmSupplierOptions = {}
): SmmSupplierAdapter {
  /**
   * Cheapest-first, across currencies when we can and never pretending
   * otherwise when we can't.
   *
   * This used to compare amountMinor directly and, on a currency mismatch, fall
   * through to supplier.name.localeCompare() — which silently decided the
   * "cheapest" panel alphabetically. That was invisible while every configured
   * panel quoted USD, and became wrong the moment Sizzle (NGN by default) was
   * configured alongside SMDPanel/SMMRaja/JAP/Peakerr (USD by default): ₦ and $
   * amounts were never compared, so routing stopped tracking price entirely.
   *
   * With rates supplied, everything converts to a common currency and the
   * comparison is real. Without them, a mixed set is ordered by name — same as
   * before, but now that is a deliberate "cannot rank these" path rather than
   * something that looks like a price comparison.
   */
  function comparableAmount(quote: SmmSupplierQuote, target: string): number | undefined {
    const { amountMinor, currency } = quote.amount;
    if (currency === target) return amountMinor;

    const rate = options.rates?.[currency];
    if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return undefined;
    return amountMinor * rate;
  }

  async function quoteAll(input: Parameters<SmmSupplierAdapter["quoteService"]>[0]) {
    const results = await Promise.allSettled(
      suppliers.map(async (supplier) => ({
        supplier,
        quote: await supplier.quoteService(input)
      }))
    );

    const fulfilled = results
      .filter(
        (
          result
        ): result is PromiseFulfilledResult<{
          supplier: SmmSupplierAdapter;
          quote: SmmSupplierQuote;
        }> => {
          return result.status === "fulfilled";
        }
      )
      .map((result) => result.value);

    const target =
      options.comparisonCurrency ?? fulfilled[0]?.quote.amount.currency ?? "USD";

    return fulfilled.sort((left, right) => {
      const leftAmount = comparableAmount(left.quote, target);
      const rightAmount = comparableAmount(right.quote, target);

      // A quote we cannot convert sorts last rather than winning by accident.
      if (leftAmount === undefined && rightAmount === undefined) {
        return left.supplier.name.localeCompare(right.supplier.name);
      }
      if (leftAmount === undefined) return 1;
      if (rightAmount === undefined) return -1;

      if (leftAmount !== rightAmount) return leftAmount - rightAmount;
      // Ties broken by name so routing is deterministic across restarts.
      return left.supplier.name.localeCompare(right.supplier.name);
    });
  }

  function findSupplierForReference(supplierReference: string) {
    const [supplierName] = supplierReference.split(":");
    const supplier =
      suppliers.find((item) => item.name === supplierName) ??
      (suppliers.length === 1 ? suppliers[0] : undefined);

    if (!supplier) {
      throw new Error(`No SMM supplier can manage reference ${supplierReference}.`);
    }

    return supplier;
  }

  return {
    name: `smm-router:${suppliers.map((supplier) => supplier.name).join(",") || "none"}`,
    async listServices() {
      const results = await Promise.allSettled(
        suppliers.map((supplier) => supplier.listServices())
      );

      return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    },
    async quoteService(input) {
      const [bestQuote] = await quoteAll(input);

      if (!bestQuote) {
        throw new Error("No SMM supplier could quote this service.");
      }

      return {
        ...bestQuote.quote,
        supplierName: bestQuote.supplier.name
      };
    },
    async createOrder(order) {
      const quotes = await quoteAll({
        serviceKind: order.serviceKind,
        quantity: order.quantity,
        destination: order.destination
      });

      for (const { supplier } of quotes) {
        try {
          return await supplier.createOrder(order);
        } catch {
          // Try the next quoted supplier. The caller only needs the final routing result.
        }
      }

      throw new Error("No SMM supplier could create this order.");
    },
    async getBalance() {
      const results = await Promise.allSettled(suppliers.map((supplier) => supplier.getBalance()));
      const balances = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );
      const [firstBalance] = balances;

      if (!firstBalance) {
        throw new Error("No SMM supplier could return a balance.");
      }

      const hasMixedCurrencies = balances.some(
        (balance) => balance.amount.currency !== firstBalance.amount.currency
      );

      if (hasMixedCurrencies) {
        return firstBalance;
      }

      return {
        supplierName: "smm-router",
        amount: {
          amountMinor: balances.reduce((total, balance) => total + balance.amount.amountMinor, 0),
          currency: firstBalance.amount.currency
        }
      };
    },
    getOrderStatus(supplierReference) {
      return findSupplierForReference(supplierReference).getOrderStatus(supplierReference);
    },
    getOrderStatuses(supplierReferences) {
      return Promise.all(
        supplierReferences.map((supplierReference) =>
          findSupplierForReference(supplierReference).getOrderStatus(supplierReference)
        )
      );
    },
    requestRefill(supplierReference) {
      return findSupplierForReference(supplierReference).requestRefill(supplierReference);
    },
    requestCancel(supplierReferences) {
      return Promise.all(
        supplierReferences.flatMap((supplierReference) =>
          findSupplierForReference(supplierReference).requestCancel([supplierReference])
        )
      ).then((results) => results.flat());
    }
  };
}

function maskPhoneNumber(value: string | number | undefined) {
  const phone = String(value ?? "+15550000000");

  if (phone.length <= 4) {
    return "****";
  }

  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

function mapOtpStatus(status?: string): OtpOrderStatus {
  const normalizedStatus = status?.toLowerCase().trim();

  switch (normalizedStatus) {
    case "received":
    case "sms_received":
    case "success":
    case "finished":
      return "RECEIVED";
    case "completed":
      return "COMPLETED";
    case "expired":
    case "timeout":
      return "EXPIRED";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "failed":
      return "FAILED";
    case "waiting":
    case "pending":
    case "active":
    default:
      return "WAITING";
  }
}

function createMockOtpServices(tier: OtpProviderTier): OtpService[] {
  const timestamp = new Date().toISOString();

  return [
    {
      id: `otp_mock_${tier.toLowerCase()}_whatsapp`,
      code: "whatsapp",
      name: "WhatsApp",
      countryCode: "NG",
      providerTier: tier,
      category: "messaging",
      visible: true,
      requiresAdminApproval: false,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: `otp_mock_${tier.toLowerCase()}_telegram`,
      code: "telegram",
      name: "Telegram",
      countryCode: "NG",
      providerTier: tier,
      category: "messaging",
      visible: true,
      requiresAdminApproval: false,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
}

function disabledOtpHealth(name: string, tier: OtpProviderTier): OtpProviderHealth {
  const timestamp = new Date().toISOString();

  return {
    providerName: name,
    tier,
    status: "DISABLED",
    latencyMs: 0,
    successRateBps: 0,
    reason: "Provider is not configured.",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function ensureOtpProviderConfigured(config: OtpHttpProviderConfig, name: string) {
  if (!config.enabled || !config.apiUrl || !config.apiKey) {
    throw new Error(`${name} OTP provider is disabled or missing credentials.`);
  }
}

async function readJsonResponse(response: Response, providerName: string) {
  const data: unknown = await response.json();

  if (!response.ok) {
    throw new Error(`${providerName} OTP API returned HTTP ${response.status}.`);
  }

  if (typeof data === "object" && data !== null && "error" in data && data.error !== undefined) {
    const errorMessage = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    throw new Error(`${providerName} OTP API error: ${errorMessage}`);
  }

  return data;
}

export function createMockOtpProvider(
  name = "mock-otp",
  tier: OtpProviderTier = "BUDGET"
): OtpProviderAdapter {
  return {
    name,
    tier,
    listServices() {
      return Promise.resolve(createMockOtpServices(tier));
    },
    quoteService(input) {
      return Promise.resolve({
        providerName: name,
        tier,
        serviceCode: input.serviceCode,
        countryCode: input.countryCode,
        supplierCost: {
          amountMinor: tier === "PREMIUM" ? 250 : 45,
          currency: "USD"
        },
        available: true,
        estimatedLatencyMs: tier === "PREMIUM" ? 1_500 : 3_000,
        successRateBps: tier === "PREMIUM" ? 9_800 : 9_100,
        inventory: tier === "PREMIUM" ? 120 : 900
      });
    },
    createOrder() {
      return Promise.resolve({
        providerName: name,
        providerReference: makeId("otp_mock"),
        status: "WAITING",
        phoneNumberMasked: "+234****431",
        expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString()
      });
    },
    getOrderStatus(providerReference) {
      return Promise.resolve({
        providerName: name,
        providerReference,
        status: "WAITING",
        phoneNumberMasked: "+234****431"
      });
    },
    cancelOrder(providerReference) {
      return Promise.resolve({ providerReference, accepted: true });
    },
    getBalance() {
      return Promise.resolve({
        providerName: name,
        amount: { amountMinor: 100000, currency: "USD" }
      });
    },
    checkHealth() {
      const timestamp = new Date().toISOString();

      return Promise.resolve({
        providerName: name,
        tier,
        status: "HEALTHY",
        latencyMs: tier === "PREMIUM" ? 1_500 : 3_000,
        successRateBps: tier === "PREMIUM" ? 9_800 : 9_100,
        balance: { amountMinor: 100000, currency: "USD" },
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  };
}

export function createTextVerifiedOtpProvider(config: OtpHttpProviderConfig): OtpProviderAdapter {
  const name = "textverified";
  const tier: OtpProviderTier = "PREMIUM";

  return {
    name,
    tier,
    async listServices() {
      if (!config.enabled || !config.apiUrl || !config.apiKey) {
        return [];
      }

      const response = await (config.fetcher ?? fetch)(
        `${config.apiUrl.replace(/\/+$/, "")}/services`,
        {
          headers: { authorization: `Bearer ${config.apiKey}` }
        }
      );
      const data = (await readJsonResponse(response, name)) as Array<{
        id?: string;
        name?: string;
        country?: string;
      }>;
      const timestamp = new Date().toISOString();

      return data.map((service) => ({
        id: `textverified_${service.id ?? service.name ?? "service"}`,
        code: service.id ?? service.name?.toLowerCase() ?? "unknown",
        name: service.name ?? service.id ?? "TextVerified service",
        countryCode: service.country ?? "US",
        providerTier: tier,
        category: "identity",
        visible: false,
        requiresAdminApproval: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }));
    },
    async quoteService(input) {
      ensureOtpProviderConfigured(config, name);
      const response = await (config.fetcher ?? fetch)(
        `${config.apiUrl!.replace(/\/+$/, "")}/services/${encodeURIComponent(input.serviceCode)}`,
        { headers: { authorization: `Bearer ${config.apiKey}` } }
      );
      const data = (await readJsonResponse(response, name)) as {
        price?: string | number;
        inventory?: number;
      };

      return {
        providerName: name,
        tier,
        serviceCode: input.serviceCode,
        countryCode: input.countryCode,
        supplierCost: moneyFromCharge(data.price, "USD"),
        available: (data.inventory ?? 1) > 0,
        estimatedLatencyMs: 1_500,
        successRateBps: 9_700,
        inventory: data.inventory ?? 1
      };
    },
    async createOrder(input) {
      ensureOtpProviderConfigured(config, name);
      const response = await (config.fetcher ?? fetch)(
        `${config.apiUrl!.replace(/\/+$/, "")}/verifications`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            service: input.serviceCode,
            country: input.countryCode,
            externalId: input.orderId
          })
        }
      );
      const data = (await readJsonResponse(response, name)) as {
        id?: string | number;
        phone_number?: string | number;
        expires_at?: string;
      };

      return {
        providerName: name,
        providerReference: String(data.id ?? makeId("tv")),
        status: "WAITING",
        phoneNumberMasked: maskPhoneNumber(data.phone_number),
        ...(data.expires_at === undefined ? {} : { expiresAt: data.expires_at })
      };
    },
    async getOrderStatus(providerReference) {
      ensureOtpProviderConfigured(config, name);
      const response = await (config.fetcher ?? fetch)(
        `${config.apiUrl!.replace(/\/+$/, "")}/verifications/${encodeURIComponent(providerReference)}`,
        { headers: { authorization: `Bearer ${config.apiKey}` } }
      );
      const data = (await readJsonResponse(response, name)) as {
        status?: string;
        phone_number?: string | number;
        sms?: string;
        received_at?: string;
      };

      return {
        providerName: name,
        providerReference,
        status: mapOtpStatus(data.status),
        phoneNumberMasked: maskPhoneNumber(data.phone_number),
        ...(data.sms === undefined ? {} : { redactedMessage: data.sms }),
        ...(data.received_at === undefined ? {} : { receivedAt: data.received_at })
      };
    },
    async cancelOrder(providerReference) {
      ensureOtpProviderConfigured(config, name);
      await (config.fetcher ?? fetch)(
        `${config.apiUrl!.replace(/\/+$/, "")}/verifications/${encodeURIComponent(providerReference)}/cancel`,
        { method: "POST", headers: { authorization: `Bearer ${config.apiKey}` } }
      );

      return { providerReference, accepted: true };
    },
    getBalance() {
      return Promise.resolve({ providerName: name, amount: { amountMinor: 0, currency: "USD" } });
    },
    async checkHealth() {
      if (!config.enabled || !config.apiUrl || !config.apiKey) {
        return disabledOtpHealth(name, tier);
      }

      const checkedAt = Date.now();

      try {
        await this.listServices();

        return {
          providerName: name,
          tier,
          status: "HEALTHY",
          latencyMs: Date.now() - checkedAt,
          successRateBps: 9_700,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } catch (error) {
        return {
          providerName: name,
          tier,
          status: "DEGRADED",
          latencyMs: Date.now() - checkedAt,
          successRateBps: 7_500,
          reason: error instanceof Error ? error.message : "TextVerified health check failed.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    }
  };
}

function createQueryOtpProvider(input: {
  name: string;
  tier: OtpProviderTier;
  config: OtpHttpProviderConfig;
  balanceAction: string;
  orderAction: string;
  statusAction: string;
  cancelAction: string;
  keyParam: string;
}): OtpProviderAdapter {
  function buildUrl(params: Record<string, string>) {
    const baseUrl = input.config.apiUrl ?? "https://disabled.invalid";
    const url = new URL(baseUrl);

    url.searchParams.set(input.keyParam, input.config.apiKey ?? "");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  async function call(params: Record<string, string>) {
    ensureOtpProviderConfigured(input.config, input.name);
    const response = await (input.config.fetcher ?? fetch)(buildUrl(params));

    return readJsonResponse(response, input.name);
  }

  return {
    name: input.name,
    tier: input.tier,
    listServices() {
      return Promise.resolve(createMockOtpServices(input.tier));
    },
    quoteService(request) {
      return Promise.resolve({
        providerName: input.name,
        tier: input.tier,
        serviceCode: request.serviceCode,
        countryCode: request.countryCode,
        supplierCost: {
          amountMinor: input.tier === "PREMIUM" ? 200 : 35,
          currency: "USD"
        },
        available: Boolean(input.config.enabled && input.config.apiUrl && input.config.apiKey),
        estimatedLatencyMs: input.tier === "PREMIUM" ? 2_500 : 4_000,
        successRateBps: input.tier === "PREMIUM" ? 9_300 : 8_900,
        inventory: 100
      });
    },
    async createOrder(request) {
      const data = (await call({
        action: input.orderAction,
        service: request.serviceCode,
        country: request.countryCode
      })) as {
        id?: string | number;
        activation?: string | number;
        phone?: string | number;
        number?: string | number;
      };
      const providerReference = String(data.id ?? data.activation ?? makeId(input.name));

      return {
        providerName: input.name,
        providerReference,
        status: "WAITING",
        phoneNumberMasked: maskPhoneNumber(data.phone ?? data.number),
        expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString()
      };
    },
    async getOrderStatus(providerReference) {
      const data = (await call({
        action: input.statusAction,
        id: providerReference
      })) as {
        status?: string;
        sms?: string;
        code?: string;
        phone?: string | number;
        number?: string | number;
      };
      const redactedMessage = data.sms ?? data.code;

      return {
        providerName: input.name,
        providerReference,
        status: mapOtpStatus(data.status ?? (redactedMessage ? "received" : "waiting")),
        phoneNumberMasked: maskPhoneNumber(data.phone ?? data.number),
        ...(redactedMessage === undefined ? {} : { redactedMessage })
      };
    },
    async cancelOrder(providerReference) {
      await call({
        action: input.cancelAction,
        id: providerReference
      });

      return { providerReference, accepted: true };
    },
    async getBalance() {
      const data = (await call({ action: input.balanceAction })) as {
        balance?: string | number;
        Balance?: string | number;
      };

      return {
        providerName: input.name,
        amount: moneyFromCharge(data.balance ?? data.Balance, "USD")
      };
    },
    async checkHealth() {
      if (!input.config.enabled || !input.config.apiUrl || !input.config.apiKey) {
        return disabledOtpHealth(input.name, input.tier);
      }

      const checkedAt = Date.now();

      try {
        const balance = await this.getBalance();

        return {
          providerName: input.name,
          tier: input.tier,
          status: "HEALTHY",
          latencyMs: Date.now() - checkedAt,
          successRateBps: input.tier === "PREMIUM" ? 9_300 : 8_900,
          balance: balance.amount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } catch (error) {
        return {
          providerName: input.name,
          tier: input.tier,
          status: "DEGRADED",
          latencyMs: Date.now() - checkedAt,
          successRateBps: input.tier === "PREMIUM" ? 7_500 : 7_000,
          reason: error instanceof Error ? error.message : `${input.name} health check failed.`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    }
  };
}

export function createFiveSimOtpProvider(config: OtpHttpProviderConfig): OtpProviderAdapter {
  return createQueryOtpProvider({
    name: "5sim",
    tier: "BUDGET",
    config,
    balanceAction: "profile",
    orderAction: "buy",
    statusAction: "check",
    cancelAction: "cancel",
    keyParam: "token"
  });
}

export function createSmsManOtpProvider(config: OtpHttpProviderConfig): OtpProviderAdapter {
  return createQueryOtpProvider({
    name: "sms-man",
    tier: "BUDGET",
    config,
    balanceAction: "get-balance",
    orderAction: "get-number",
    statusAction: "get-sms",
    cancelAction: "set-status",
    keyParam: "token"
  });
}

export function createSmsActivateCompatibleOtpProvider(
  config: OtpHttpProviderConfig
): OtpProviderAdapter {
  return createQueryOtpProvider({
    name: "sms-activate-compatible",
    tier: "BUDGET",
    config,
    balanceAction: "getBalance",
    orderAction: "getNumber",
    statusAction: "getStatus",
    cancelAction: "setStatus",
    keyParam: "api_key"
  });
}

export function createMockAiProvider(): AiGenerationAdapter {
  return {
    name: "mock-ai",
    generateCampaignCopy(input) {
      return Promise.resolve({
        headlines: [`Grow your ${input.destinationKind.toLowerCase().replaceAll("_", " ")} today`],
        captions: [`A focused ${input.objective.toLowerCase()} campaign for ${input.audience}.`],
        hashtags: ["#FlipTrybe", "#Growth", "#CreatorBusiness"]
      });
    }
  };
}

export function createMockNotificationProvider(): NotificationProviderAdapter {
  return {
    name: "mock-notifications",
    isConfigured() {
      return true;
    },
    send() {
      return Promise.resolve({ id: makeId("ntf"), accepted: true, providerStatus: "mock-accepted" });
    }
  };
}

export function createMockStorageProvider(): StorageProviderAdapter {
  return {
    name: "mock-storage",
    createUploadUrl(input) {
      return Promise.resolve({
        uploadUrl: `https://storage.mock/upload/${input.key}`,
        publicUrl: `https://cdn.mock/${input.key}`
      });
    }
  };
}

export function createCloudinaryStorageProvider(
  config: CloudinaryStorageConfig
): StorageProviderAdapter {
  return {
    name: "cloudinary-storage",
    createUploadUrl(input) {
      if (!config.cloudName || !config.uploadPreset) {
        return Promise.reject(
          new Error(
            "Cloudinary storage requires CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET."
          )
        );
      }

      const resourceType = getCloudinaryResourceType(input.contentType);
      const publicId = normalizeCloudinaryPublicId(input.key, config.folder);
      const uploadUrl = new URL(
        `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`
      );
      uploadUrl.searchParams.set("upload_preset", config.uploadPreset);
      uploadUrl.searchParams.set("public_id", publicId);

      const deliveryHost = config.secureDistribution ?? `res.cloudinary.com/${config.cloudName}`;
      const publicUrl = `https://${deliveryHost}/${resourceType}/upload/${publicId}`;

      return Promise.resolve({
        uploadUrl: uploadUrl.toString(),
        publicUrl
      });
    }
  };
}

// ─── Settlement Provider Abstraction ──────────────────────────────────────────

export interface SettlementTransfer {
  id: string;
  source: {
    amount: bigint; // minor units
    currency: string;
  };
  destination: {
    amount: bigint; // minor units
    currency: string;
  };
  beneficiary: {
    name: string | undefined;
    reference: string; // Bank account, email, etc.
  };
  fxRate?: bigint; // Rate used (in micros)
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  providerReference: string;
  providerTimestamp?: Date;
  errorReason?: string;
}

export interface SettlementTransferRequest {
  idempotencyKey: string; // Must be unique per logical transfer
  sourceAmountMinor: bigint;
  sourceCurrency: string;
  destinationAmountMinor: bigint;
  destinationCurrency: string;
  fxRateMicros: bigint;
  beneficiaryName: string | undefined;
  beneficiaryReference: string; // Bank account, Wise email, payment ID, etc.
  metadata?: Record<string, unknown>;
}

export interface SettlementProvider {
  readonly name: string;

  // Create a transfer/payment
  createTransfer(request: SettlementTransferRequest): Promise<SettlementTransfer>;

  // Get transfer status
  getTransferStatus(providerReference: string): Promise<SettlementTransfer>;

  // Cancel transfer (if supported)
  cancelTransfer?(providerReference: string): Promise<{ cancelled: boolean; reason?: string }>;

  // Health check
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

// ─── FX Provider Abstraction ──────────────────────────────────────────────────

export interface FxRate {
  baseCurrency: string;
  quoteCurrency: string;
  rateMicros: bigint;
  timestamp: Date;
  provider: string;
}

export interface FxRateValidationError {
  field: string;
  message: string;
}

export interface FxProvider {
  readonly name: string;

  // Fetch live rates for one or more currency pairs
  getRate(
    baseCurrency: string,
    quoteCurrency: string
  ): Promise<FxRate>;

  getRates(
    baseCurrency: string,
    quoteCurrencies: string[]
  ): Promise<FxRate[]>;

  // List supported currencies
  getSupportedCurrencies(): Promise<string[]>;

  // Health check
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

export function createMockFxProvider(): FxProvider {
  const rates = new Map([
    ["USD-NGN", 1550000000n], // ₦1,550/USD
    ["USD-GBP", 790000000n],  // £0.79/USD
    ["USD-EUR", 920000000n],  // €0.92/USD
    ["GBP-NGN", 1961013001n], // ₦1,961.013/GBP
    ["EUR-NGN", 1685913043n]  // ₦1,685.913/EUR
  ]);

  return {
    name: "mock-fx",
    getRate(baseCurrency, quoteCurrency): Promise<FxRate> {
      const key = `${baseCurrency}-${quoteCurrency}`;
      const rateMicros = rates.get(key);
      if (!rateMicros) {
        return Promise.reject(new Error(`Unsupported pair: ${key}`));
      }
      return Promise.resolve({
        baseCurrency,
        quoteCurrency,
        rateMicros,
        timestamp: new Date(),
        provider: "mock-fx"
      });
    },
    getRates(baseCurrency, quoteCurrencies): Promise<FxRate[]> {
      return Promise.all(
        quoteCurrencies.map((qc) => this.getRate(baseCurrency, qc))
      );
    },
    getSupportedCurrencies(): Promise<string[]> {
      return Promise.resolve(["USD", "NGN", "GBP", "EUR"]);
    },
    healthCheck(): Promise<{ healthy: boolean; message?: string }> {
      return Promise.resolve({ healthy: true });
    }
  };
}

export function createMockSettlementProvider(): SettlementProvider {
  // In-memory store for simulating provider behavior
  const transfers = new Map<string, SettlementTransfer>();
  const idempotencyCache = new Map<string, SettlementTransfer>();

  return {
    name: "mock-settlement",
    createTransfer(request: SettlementTransferRequest): Promise<SettlementTransfer> {
      // Check idempotency
      if (idempotencyCache.has(request.idempotencyKey)) {
        return Promise.resolve(idempotencyCache.get(request.idempotencyKey)!);
      }

      // Simulate provider reference (would be real ID from provider API)
      const providerReference = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      // Simulate different outcomes based on metadata
      let status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" = "PROCESSING";
      let errorReason: string | undefined;

      const sim = request.metadata?.["simulation"];
      if (typeof sim === "string") {
        if (sim === "success") status = "COMPLETED";
        else if (sim === "failure") {
          status = "FAILED";
          errorReason = "Simulated provider error";
        } else if (sim === "timeout") status = "PROCESSING";
      }

      const transfer: SettlementTransfer = {
        id: providerReference,
        source: {
          amount: request.sourceAmountMinor,
          currency: request.sourceCurrency
        },
        destination: {
          amount: request.destinationAmountMinor,
          currency: request.destinationCurrency
        },
        beneficiary: {
          name: request.beneficiaryName,
          reference: request.beneficiaryReference
        },
        fxRate: request.fxRateMicros,
        status,
        providerReference,
        providerTimestamp: new Date(),
        ...(errorReason ? { errorReason } : {})
      };

      transfers.set(providerReference, transfer);
      idempotencyCache.set(request.idempotencyKey, transfer);

      return Promise.resolve(transfer);
    },

    getTransferStatus(providerReference: string): Promise<SettlementTransfer> {
      const transfer = transfers.get(providerReference);
      if (!transfer) {
        return Promise.reject(new Error(`Transfer not found: ${providerReference}`));
      }

      // Simulate status progression: PROCESSING → COMPLETED
      if (transfer.status === "PROCESSING") {
        const elapsed = Date.now() - (transfer.providerTimestamp?.getTime() ?? 0);
        if (elapsed > 5000) {
          // After 5 seconds, mark as completed (unless it's a failure simulation)
          if (!transfer.errorReason) {
            transfer.status = "COMPLETED";
          }
        }
      }

      return Promise.resolve(transfer);
    },

    healthCheck(): Promise<{ healthy: boolean; message?: string }> {
      return Promise.resolve({ healthy: true });
    }
  };
}

// ─── Fincra FX Provider ─────────────────────────────────────────────────────────

export interface FincraConfig {
  apiKey: string;
  businessId: string;
  baseUrl?: string; // defaults to sandbox
  webhookEncryptionKey?: string;
}

type FincraFetcher = (url: string, init: RequestInit) => Promise<Response>;

interface FincraRateResponse {
  success: boolean;
  message: string;
  data: {
    rates: Array<{
      baseCurrency: string;
      quoteCurrency: string;
      side: string;
      price: number;
    }>;
    pagination: { page: number; perPage: number; totalItems: number; totalPages: number };
  };
}

interface FincraQuoteResponse {
  success: boolean;
  message: string;
  data: {
    sourceCurrency: string;
    destinationCurrency: string;
    sourceAmount: number;
    destinationAmount: number;
    fee: number;
    rate: number;
    amountToCharge: number;
    amountToReceive: number;
    reference: string;
    expireAt: string;
  };
}

interface FincraPayoutResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    reference: string;
    customerReference: string;
    status: string;
  };
}

interface FincraPayoutStatusResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    amountSent: number;
    amountReceived: number;
    sourceCurrency: string;
    destinationCurrency: string;
    fee: number;
    status: string;
    reference: string;
    createdAt: string;
    updatedAt: string;
  };
}

const FINCRA_SANDBOX_URL = "https://sandboxapi.fincra.com";
export const FINCRA_PRODUCTION_URL = "https://api.fincra.com";

const FINCRA_SUPPORTED_CURRENCIES = [
  "NGN", "USD", "EUR", "GBP", "GHS", "KES", "UGX", "TZS", "ZMW", "XAF", "XOF", "ZAR", "EGP"
];

const FINCRA_PAYMENT_SCHEMES: Record<string, string> = {
  GBP: "fps",
  EUR: "sepa",
  USD: "swift",
  NGN: "",
};

function mapFincraStatus(status: string): "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" {
  switch (status) {
    case "successful": return "COMPLETED";
    case "failed": return "FAILED";
    case "processing": return "PROCESSING";
    default: return "PENDING";
  }
}

async function fincraRequest<T>(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body: object | undefined,
  fetcher: FincraFetcher
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetcher(url, init);
  const json = await res.json() as { success: boolean; message: string };

  if (!res.ok || !json.success) {
    throw new Error(`Fincra ${method} ${path} failed (${res.status}): ${json.message}`);
  }

  return json as T;
}

export function createFincraFxProvider(
  config: FincraConfig,
  fetcher: FincraFetcher = globalThis.fetch
): FxProvider {
  const baseUrl = config.baseUrl ?? FINCRA_SANDBOX_URL;

  return {
    name: "fincra",

    async getRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate> {
      const pair = `${baseCurrency}-${quoteCurrency}`;
      const res = await fincraRequest<FincraRateResponse>(
        baseUrl, config.apiKey, "GET",
        `/quotes/treasury-orders/rates?currencyPair=${pair}&side=buy`,
        undefined, fetcher
      );

      const rate = res.data.rates.find(
        (r) => r.baseCurrency === baseCurrency && r.quoteCurrency === quoteCurrency
      );

      if (!rate) {
        throw new Error(`Fincra returned no rate for ${pair}`);
      }

      return {
        baseCurrency,
        quoteCurrency,
        rateMicros: BigInt(Math.round(rate.price * 1_000_000)),
        timestamp: new Date(),
        provider: "fincra",
      };
    },

    async getRates(baseCurrency: string, quoteCurrencies: string[]): Promise<FxRate[]> {
      return Promise.all(
        quoteCurrencies.map((qc) => this.getRate(baseCurrency, qc))
      );
    },

    getSupportedCurrencies(): Promise<string[]> {
      return Promise.resolve(FINCRA_SUPPORTED_CURRENCIES);
    },

    async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
      try {
        await fincraRequest<FincraRateResponse>(
          baseUrl, config.apiKey, "GET",
          "/quotes/treasury-orders/rates?currencyPair=USD-NGN&side=buy",
          undefined, fetcher
        );
        return { healthy: true };
      } catch (err) {
        return { healthy: false, message: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

// ─── Swappr FX Provider ────────────────────────────────────────────────────
// Swappr has no standalone rate-lookup endpoint — POST /v1/payouts/quote is a
// read-only, PII-free advisory quote (no capability/enablement gate beyond a
// valid key) that returns an `fx` block for any funding_currency → currency
// pair. We use that purely to read fx.rate; no payout is ever created here.

type SwapprFetcher = (url: string, init: RequestInit) => Promise<Response>;

interface SwapprConfig {
  secretKey: string;
  baseUrl?: string;
}

interface SwapprQuoteResponse {
  object: string;
  currency: string;
  amount_minor: string;
  fee_minor: string;
  tax_minor: string;
  levy_minor: string;
  total_debit_minor: string;
  fx: {
    funding_currency: string;
    source_debit_minor: string;
    converted_minor: string;
    fee_source_minor: string;
    rate: string;
    as_of: string | null;
    indicative: boolean;
  } | null;
}

interface SwapprErrorResponse {
  error: { type: string; code: string; message: string };
}

const SWAPPR_BASE_URL = "https://api.swappr.me/api/v1";
const SWAPPR_SUPPORTED_CURRENCIES = ["NGN", "GBP", "USD", "EUR", "CAD"];

async function swapprRequest<T>(
  baseUrl: string,
  secretKey: string,
  method: string,
  path: string,
  body: object | undefined,
  fetcher: SwapprFetcher
): Promise<T> {
  const res = await fetcher(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { "Idempotency-Key": `sw_${Math.random().toString(36).slice(2, 12)}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = (await res.json()) as T & Partial<SwapprErrorResponse>;

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Swappr request failed (${res.status})`);
  }

  return json;
}

export function createSwapprFxProvider(
  config: SwapprConfig,
  fetcher: SwapprFetcher = globalThis.fetch
): FxProvider {
  const baseUrl = config.baseUrl ?? SWAPPR_BASE_URL;

  return {
    name: "swappr",

    async getRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate> {
      const quote = await swapprRequest<SwapprQuoteResponse>(
        baseUrl, config.secretKey, "POST", "/payouts/quote",
        {
          currency: quoteCurrency,
          funding_currency: baseCurrency,
          amount_minor: "1000000"
        },
        fetcher
      );

      if (!quote.fx) {
        throw new Error(`Swappr returned no fx block for ${baseCurrency}-${quoteCurrency}`);
      }

      return {
        baseCurrency,
        quoteCurrency,
        rateMicros: BigInt(Math.round(Number(quote.fx.rate) * 1_000_000)),
        timestamp: quote.fx.as_of ? new Date(quote.fx.as_of) : new Date(),
        provider: "swappr",
      };
    },

    async getRates(baseCurrency: string, quoteCurrencies: string[]): Promise<FxRate[]> {
      return Promise.all(
        quoteCurrencies.map((qc) => this.getRate(baseCurrency, qc))
      );
    },

    getSupportedCurrencies(): Promise<string[]> {
      return Promise.resolve(SWAPPR_SUPPORTED_CURRENCIES);
    },

    async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
      try {
        await swapprRequest<SwapprQuoteResponse>(
          baseUrl, config.secretKey, "POST", "/payouts/quote",
          { currency: "NGN", amount_minor: "100000" },
          fetcher
        );
        return { healthy: true };
      } catch (err) {
        return { healthy: false, message: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

// ─── Maplerad FX Provider ──────────────────────────────────────────────────
// Documented + LIVE-VERIFIED against https://api.maplerad.com/v1 with the
// real sandbox secret key (checked 2026-08-11). See docs/providers/maplerad.md
// for the full mapping.
//   - POST /fx/quote {source_currency, target_currency, amount} — the amount
//     is REQUIRED (not optional) and denominated in the source currency's
//     minor unit; live-confirmed response:
//       {"status":true,"message":"Quote generated successfully","data":
//        {"reference":"...","source":{"currency":"USD","amount":10000,...},
//         "target":{"currency":"NGN","amount":6000000,...},"rate":600}}
//   - The quote is a GENUINE LOCK, not merely indicative: POST /fx
//     {quote_reference} live-confirmed a second call reusing an already-used/
//     stale reference failed with {"status":false,"message":"could not find
//     quote"}, while a freshly generated reference executed successfully
//     ({"message":"Exchange successful", data.rate:600 matching the quote}).
//     This adapter does not call POST /fx (executing a real currency
//     conversion is a distinct, money-moving operation outside FxProvider's
//     read-only getRate/getRates/getSupportedCurrencies/healthCheck contract)
//     — getRate() only generates and reads a quote.
//   - Supported currencies for THIS adapter are reported from the FX-specific
//     surface, not the platform-wide GET /currencies list. Live-confirmed
//     surprise: POST /fx/quote accepted an undocumented pair
//     (source_currency:"USD", target_currency:"GHS") and returned a real
//     rate (8.1) — broader than the two-currency NGN/USD enum implied by the
//     reference doc's own field description. getSupportedCurrencies() below
//     returns the full GET /currencies list (18 currencies, live-confirmed:
//     NGN, USD, GHS, KES, TZS, UGX, MWK, MZN, PYUSD, RWF, CDF, ZAR, SLE, LRD,
//     XAF, XOF, USDT, USDC) since the quote endpoint did not reject a
//     currency present in that list, and no narrower FX-specific enum is
//     documented or was found to be enforced.
const MAPLERAD_BASE_URL = "https://api.maplerad.com/v1";

// Live-confirmed 2026-08-11 via GET /currencies against the real sandbox key.
const MAPLERAD_SUPPORTED_CURRENCIES = [
  "NGN", "USD", "GHS", "KES", "TZS", "UGX", "MWK", "MZN", "PYUSD", "RWF",
  "CDF", "ZAR", "SLE", "LRD", "XAF", "XOF", "USDT", "USDC",
];

export interface MapleradFxConfig {
  apiKey: string;
  baseUrl?: string;
}

type MapleradFetcher = (url: string, init: RequestInit) => Promise<Response>;

interface MapleradQuoteResponse {
  status: boolean;
  message: string;
  data: {
    reference: string;
    source: { currency: string; amount: number; human_readable_amount: number };
    target: { currency: string; amount: number; human_readable_amount: number };
    rate: number;
  };
}

async function mapleradFxRequest<T>(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body: object | undefined,
  fetcher: MapleradFetcher
): Promise<T> {
  const res = await fetcher(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = (await res.json()) as T & { status?: boolean; message?: string };

  if (!res.ok || json.status === false) {
    throw new Error(`Maplerad ${method} ${path} failed (${res.status}): ${json.message ?? "unknown error"}`);
  }

  return json;
}

export function createMapleradFxProvider(
  config: MapleradFxConfig,
  fetcher: MapleradFetcher = globalThis.fetch
): FxProvider {
  const baseUrl = config.baseUrl ?? MAPLERAD_BASE_URL;

  return {
    name: "maplerad",

    async getRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate> {
      // A nominal representative amount is required by the endpoint — 10000
      // minor units (e.g. $100.00) mirrors the value used during live
      // verification. The returned `rate` is amount-independent (a per-unit
      // FX rate), confirmed live across two different amounts (10000 and
      // 1000) returning the same rate (600) for USD-NGN.
      const res = await mapleradFxRequest<MapleradQuoteResponse>(
        baseUrl, config.apiKey, "POST", "/fx/quote",
        { source_currency: baseCurrency, target_currency: quoteCurrency, amount: 10000 },
        fetcher
      );

      return {
        baseCurrency,
        quoteCurrency,
        rateMicros: BigInt(Math.round(res.data.rate * 1_000_000)),
        timestamp: new Date(),
        provider: "maplerad",
      };
    },

    async getRates(baseCurrency: string, quoteCurrencies: string[]): Promise<FxRate[]> {
      return Promise.all(
        quoteCurrencies.map((qc) => this.getRate(baseCurrency, qc))
      );
    },

    getSupportedCurrencies(): Promise<string[]> {
      return Promise.resolve(MAPLERAD_SUPPORTED_CURRENCIES);
    },

    async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
      try {
        await mapleradFxRequest<MapleradQuoteResponse>(
          baseUrl, config.apiKey, "POST", "/fx/quote",
          { source_currency: "USD", target_currency: "NGN", amount: 10000 },
          fetcher
        );
        return { healthy: true };
      } catch (err) {
        return { healthy: false, message: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

export function createFincraSettlementProvider(
  config: FincraConfig,
  fetcher: FincraFetcher = globalThis.fetch
): SettlementProvider {
  const baseUrl = config.baseUrl ?? FINCRA_SANDBOX_URL;

  return {
    name: "fincra",

    async createTransfer(request: SettlementTransferRequest): Promise<SettlementTransfer> {
      const isCrossCurrency = request.sourceCurrency !== request.destinationCurrency;

      let quoteReference: string | undefined;

      if (isCrossCurrency) {
        // Step 1: Generate a quote (expires in 30s)
        const quoteRes = await fincraRequest<FincraQuoteResponse>(
          baseUrl, config.apiKey, "POST", "/quotes/generate",
          {
            business: config.businessId,
            sourceCurrency: request.sourceCurrency,
            destinationCurrency: request.destinationCurrency,
            amount: String(request.sourceAmountMinor),
            action: "send",
            transactionType: "disbursement",
            paymentDestination: "bank_account",
            feeBearer: "business",
            ...(FINCRA_PAYMENT_SCHEMES[request.destinationCurrency]
              ? { paymentScheme: FINCRA_PAYMENT_SCHEMES[request.destinationCurrency] }
              : {}),
          },
          fetcher
        );
        quoteReference = quoteRes.data.reference;
      }

      // Step 2: Create payout
      const [firstName = "", ...lastParts] = (request.beneficiaryName ?? "").split(" ");
      const lastName = lastParts.join(" ") || firstName;

      const payoutBody: Record<string, unknown> = {
        business: config.businessId,
        sourceCurrency: request.sourceCurrency,
        destinationCurrency: request.destinationCurrency,
        amount: String(request.sourceAmountMinor),
        description: request.metadata?.["description"] ?? "FlipTrybe settlement",
        paymentDestination: request.metadata?.["paymentDestination"] ?? "bank_account",
        customerReference: request.idempotencyKey,
        beneficiary: {
          firstName,
          lastName,
          accountHolderName: request.beneficiaryName ?? firstName,
          accountNumber: request.beneficiaryReference,
          type: request.metadata?.["beneficiaryType"] ?? "individual",
          country: request.metadata?.["beneficiaryCountry"] ?? "NG",
          ...(request.metadata?.["bankCode"] ? { bankCode: request.metadata["bankCode"] } : {}),
          ...(request.metadata?.["sortCode"] ? { sortCode: request.metadata["sortCode"] } : {}),
          ...(request.metadata?.["bankSwiftCode"] ? { bankSwiftCode: request.metadata["bankSwiftCode"] } : {}),
          ...(request.metadata?.["email"] ? { email: request.metadata["email"] } : {}),
        },
        ...(quoteReference ? { quoteReference } : {}),
        ...(FINCRA_PAYMENT_SCHEMES[request.destinationCurrency]
          ? { paymentScheme: FINCRA_PAYMENT_SCHEMES[request.destinationCurrency] }
          : {}),
      };

      const payoutRes = await fincraRequest<FincraPayoutResponse>(
        baseUrl, config.apiKey, "POST", "/disbursements/payouts",
        payoutBody, fetcher
      );

      return {
        id: String(payoutRes.data.id),
        source: { amount: request.sourceAmountMinor, currency: request.sourceCurrency },
        destination: { amount: request.destinationAmountMinor, currency: request.destinationCurrency },
        beneficiary: { name: request.beneficiaryName, reference: request.beneficiaryReference },
        fxRate: request.fxRateMicros,
        status: mapFincraStatus(payoutRes.data.status),
        providerReference: payoutRes.data.reference,
        providerTimestamp: new Date(),
      };
    },

    async getTransferStatus(providerReference: string): Promise<SettlementTransfer> {
      const res = await fincraRequest<FincraPayoutStatusResponse>(
        baseUrl, config.apiKey, "GET",
        `/disbursements/payouts/reference/${encodeURIComponent(providerReference)}`,
        undefined, fetcher
      );

      const d = res.data;
      return {
        id: String(d.id),
        source: { amount: BigInt(Math.round(d.amountSent)), currency: d.sourceCurrency },
        destination: { amount: BigInt(Math.round(d.amountReceived)), currency: d.destinationCurrency },
        beneficiary: { name: undefined, reference: "" },
        status: mapFincraStatus(d.status),
        providerReference: d.reference,
        providerTimestamp: new Date(d.updatedAt),
        ...(d.status === "failed" ? { errorReason: `Fincra payout failed (ref: ${d.reference})` } : {}),
      };
    },

    async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
      try {
        await fincraRequest<{ success: boolean; message: string }>(
          baseUrl, config.apiKey, "GET",
          "/quotes/treasury-orders/rates?currencyPair=USD-NGN&side=buy",
          undefined, fetcher
        );
        return { healthy: true };
      } catch (err) {
        return { healthy: false, message: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

// `verifyFincraWebhook` lives in ./financial-products.ts and reaches consumers
// through the `export *` at the bottom of this file. A second copy used to be
// declared here; because a local declaration outranks a star re-export, that
// copy is what every importer actually resolved — and it compared digests with
// `===` instead of a constant-time compare. Do not reintroduce it.

// ─── Gift Card Sell Provider ────────────────────────────────────────────────────

export interface GiftCardSellRate {
  brand: string;
  region: string;
  denomination: number;
  currency: string;
  rateMinor: number;
  fee?: number;
  rateTimestamp: Date;
}

export interface GiftCardSellProvider extends ProviderAdapterBase {
  readonly domain: 'GIFT_CARD';

  listSupportedBrands(): Promise<string[]>;
  getRate(brand: string, region: string, denomination: number): Promise<GiftCardSellRate>;
  submitCard(input: {
    reference: string;
    brand: string;
    region: string;
    denomination: number;
    cardInfo: Record<string, string>;
  }): Promise<{
    providerReference: string;
    status: 'SUBMITTED' | 'PROCESSING' | 'AMBIGUOUS';
    failureReason?: string;
  }>;
  getTransactionStatus(reference: string): Promise<{
    status: 'PROCESSING' | 'VERIFIED' | 'APPROVED' | 'PAID' | 'REJECTED' | 'FAILED';
    payout?: number;
    payoutCurrency?: string;
  }>;
}

// ─── Gift Card Purchase Provider ────────────────────────────────────────────────

export interface GiftCardProduct {
  productId: string;
  brand: string;
  region: string;
  country: string;
  denomination: number;
  currency: string;
  retailPrice: number;
  wholesalePrice: number;
  available: boolean;
}

export interface GiftCardPurchaseProvider extends ProviderAdapterBase {
  readonly domain: 'GIFT_CARD';

  getProducts(filters?: { brand?: string; region?: string; country?: string }): Promise<GiftCardProduct[]>;
  getProduct(productId: string): Promise<GiftCardProduct>;
  getPrice(productId: string, quantity?: number): Promise<{ productId: string; price: number; fee?: number }>;
  purchase(input: {
    reference: string;
    productId: string;
    quantity: number;
    recipient?: { email?: string; phone?: string };
  }): Promise<{
    supplierOrderId: string;
    status: 'CREATED' | 'PROCESSING' | 'AMBIGUOUS';
    failureReason?: string;
  }>;
  getOrderStatus(orderId: string): Promise<{
    status: 'PROCESSING' | 'FULFILLED' | 'DELIVERED' | 'FAILED';
    codes?: string[];
    failureReason?: string;
  }>;
}

// ─── Airtime Cashout Provider ──────────────────────────────────────────────────

export interface AirtimeCashoutProvider extends ProviderAdapterBase {
  readonly domain: 'AIRTIME_CASHOUT';

  getSupportedNetworks(): Promise<string[]>;
  requestOtp(phone: string, network: string): Promise<{ sessionId?: string; message: string }>;
  verifyOtp(input: {
    phone: string;
    network: string;
    otp: string;
    sessionId?: string;
  }): Promise<{
    verified: boolean;
    airtimeBalance?: number;
    balanceCurrency?: string;
    sessionId?: string;
  }>;
  getBalance(phone: string, network: string): Promise<{ balanceMinor: number; currency: string }>;
  getQuote(input: {
    phone: string;
    network: string;
    amountMinor: number;
  }): Promise<{
    amountMinor: number;
    feeMinor: number;
    payoutMinor: number;
    currency: string;
  }>;
  initiateCashout(input: {
    reference: string;
    phone: string;
    network: string;
    amountMinor: number;
    sessionId?: string;
    pin?: string;
  }): Promise<{
    providerReference: string;
    status: 'SUBMITTED' | 'PROCESSING' | 'AMBIGUOUS';
    failureReason?: string;
  }>;
  getTransactionStatus(reference: string): Promise<{
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
    payout?: number;
    payoutCurrency?: string;
  }>;
}

// ─── Airtime Purchase Provider ────────────────────────────────────────────────

export interface AirtimePurchaseProvider {
  readonly name: string;

  getNetworks(): Promise<string[]>;
  getDenominations(network: string): Promise<number[]>;
  getPrice(network: string, amountMinor: number): Promise<{ priceMinor: number; fee?: number }>;
  purchase(input: {
    reference: string;
    network: string;
    phone: string;
    amountMinor: number;
  }): Promise<{
    providerOrderId: string;
    status: 'SUBMITTED' | 'PROCESSING' | 'AMBIGUOUS';
    failureReason?: string;
  }>;
  getOrderStatus(orderId: string): Promise<{
    status: 'PROCESSING' | 'DELIVERED' | 'FAILED';
    failureReason?: string;
  }>;
  checkHealth(): Promise<{ status: 'HEALTHY' | 'DEGRADED' | 'DOWN'; latencyMs: number; balance?: number }>;
}

export * from './contract.js';
export * from './router.js';
export * from './vtu.js';
export * from './telecom.js';
export * from './virtual-numbers.js';
export * from './gift-cards.js';
export * from './airtime-cashout.js';
export * from './crypto.js';
export * from './rmb.js';
export * from './financial-products.js';
export * from './notifications.js';
