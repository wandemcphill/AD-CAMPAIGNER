import type {
  Campaign,
  CampaignObjective,
  CurrencyCode,
  DestinationKind,
  Money,
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
  createPaymentIntent(input: { amount: Money; workspaceId: string }): Promise<PaymentIntent>;
  verifyPayment(
    reference: string
  ): Promise<{ status: PaymentIntent["status"]; providerReference: string }>;
}

export interface SmmSupplierAdapter {
  readonly name: string;
  quoteService(input: {
    serviceKind: SmmServiceKind;
    quantity: number;
    destination: PromotionDestination;
  }): Promise<SmmSupplierQuote>;
  createOrder(order: SmmOrder): Promise<{ supplierReference: string; status: SmmOrder["status"] }>;
}

export interface SmmSupplierQuote {
  amount: Money;
  estimatedDeliveryMinutes: number;
  supplierName?: string;
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

export interface CloudinaryStorageConfig {
  cloudName?: string | undefined;
  uploadPreset?: string | undefined;
  folder?: string | undefined;
  secureDistribution?: string | undefined;
}

export interface PerfectPanelSmmSupplierConfig {
  name: string;
  apiUrl: string;
  apiKey?: string | undefined;
  currency?: CurrencyCode | undefined;
  serviceMap?: Partial<Record<SmmServiceKind, string>> | undefined;
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

  if (!response.ok) {
    throw new Error(`${config.name} API returned HTTP ${response.status}.`);
  }
  if (typeof data === "object" && data !== null && "error" in data) {
    throw new Error(`${config.name} API error: ${String(data.error)}`);
  }

  return data;
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

export function createMockSmmSupplier(): SmmSupplierAdapter {
  return {
    name: "mock-smm",
    quoteService(input) {
      return Promise.resolve({
        amount: { amountMinor: input.quantity * 25, currency: "NGN" },
        estimatedDeliveryMinutes: input.serviceKind === "LIVE_VIEWERS" ? 10 : 120
      });
    },
    createOrder() {
      return Promise.resolve({ supplierReference: makeId("mock_smm"), status: "QUEUED" });
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

  async function selectService(input: {
    serviceKind: SmmServiceKind;
    quantity: number;
    destination: PromotionDestination;
  }) {
    const configuredServiceId = config.serviceMap?.[input.serviceKind];
    const services = (await postPerfectPanelApi(config, {
      action: "services"
    })) as PerfectPanelService[];

    if (!Array.isArray(services)) {
      throw new Error(`${config.name} did not return a service list.`);
    }

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

  return {
    name: config.name,
    async quoteService(input) {
      const service = await selectService(input);

      return {
        amount: moneyFromRate(service.rate, input.quantity, currency),
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

  return {
    name: `smm-router:${suppliers.map((supplier) => supplier.name).join(",") || "none"}`,
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
    }
  };
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
