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
  send(input: {
    channel: "EMAIL" | "IN_APP" | "WEBSOCKET" | "WHATSAPP";
    to: string;
    title: string;
    body: string;
  }): Promise<{ id: string; accepted: boolean }>;
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
            email: input.customerEmail ?? "payments@fliptrybe.test"
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
      const response = (await postPerfectPanelApi(config, {
        action: "add",
        service: String(service.service),
        link: order.destination.url,
        quantity: String(order.quantity)
      })) as { order?: string | number };

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

export function createRoutedSmmSupplier(suppliers: SmmSupplierAdapter[]): SmmSupplierAdapter {
  async function quoteAll(input: Parameters<SmmSupplierAdapter["quoteService"]>[0]) {
    const results = await Promise.allSettled(
      suppliers.map(async (supplier) => ({
        supplier,
        quote: await supplier.quoteService(input)
      }))
    );

    return results
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
      .map((result) => result.value)
      .sort((left, right) => {
        if (left.quote.amount.currency !== right.quote.amount.currency) {
          return left.supplier.name.localeCompare(right.supplier.name);
        }

        return left.quote.amount.amountMinor - right.quote.amount.amountMinor;
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
    send() {
      return Promise.resolve({ id: makeId("ntf"), accepted: true });
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

export * from './router.js';
export * from './vtu.js';
export * from './virtual-numbers.js';
