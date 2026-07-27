import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createMetric } from "@fliptrybe/analytics";
import { createEvent, type PlatformEvent } from "@fliptrybe/events";
import { createNotification } from "@fliptrybe/notifications";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import {
  createCloudinaryStorageProvider,
  createKorapayPaymentGateway,
  createMockAdsProvider,
  createMockAiProvider,
  createMockPaymentGateway,
  createMockSmmSupplier,
  createMockStorageProvider,
  createPerfectPanelSmmSupplier,
  createRoutedSmmSupplier,
  parseSmmServiceMap
} from "@fliptrybe/providers";
import type { PerfectPanelSmmSupplierConfig } from "@fliptrybe/providers";
import {
  applyGrowthServiceAdminControls,
  assessSmmOrderFraud,
  calculateSmmPrice,
  calculateGrowthDeliveredQuantity,
  createSmmSupplierAudit,
  createSmmFulfillmentQueueJob,
  createSmmServiceHealthMonitor,
  defaultGrowthServicesCatalog,
  defaultSmmPricingRules,
  getGrowthExpectedCompletionAt,
  getGrowthServiceRiskReport,
  mapSmmOrderStatusToGrowthStatus,
  summarizeSmmSupplierHealth
} from "@fliptrybe/service-smm";
import type { SmmSupplierAuditProvider } from "@fliptrybe/service-smm";
import {
  currencies,
  type AnalyticsMetric,
  type AuditLog,
  type Campaign,
  type CurrencyCode,
  type DestinationKind,
  type GrowthOrder,
  type GrowthOrderStatus,
  type GrowthServiceCatalogItem,
  type LedgerEntry,
  type NotificationMessage,
  type PaymentIntent,
  type PromotionDestination,
  type SmmOrder,
  type SmmServiceKind,
  type SupportTicket,
  type Wallet
} from "@fliptrybe/types";

import type {
  CreateCampaignDto,
  CreateGrowthOrderDto,
  CreatePaymentIntentDto,
  CreateSmmOrderDto,
  CreateSupportTicketDto,
  QuoteCampaignDto,
  SmmSupplierReferenceDto,
  SmmSupplierReferencesDto,
  UpdateGrowthOrderDto,
  UpdateGrowthServiceDto
} from "./platform.dtos";
import { AiBrainClient } from "./ai-brain.client";
import type { AuthenticatedRequestContext } from "./request-context";

const demoWorkspaceId = "workspace_demo";
const demoUserId = "user_demo";
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const growthActiveStatuses = new Set<GrowthOrderStatus>(["PENDING", "SUBMITTED", "IN_PROGRESS"]);
const isProductionRuntime = () => process.env.NODE_ENV === "production";
const legacyMockProvidersAllowed = () =>
  !isProductionRuntime() || process.env.ALLOW_MOCK_PROVIDERS === "true";

interface GrowthMonitoringEvent {
  id: string;
  workspaceId: string;
  orderId?: string;
  kind:
    | "UNPAID_EXECUTION_ATTEMPT"
    | "SUPPLIER_SUBMISSION_FAILED"
    | "SUPPLIER_SUBMISSION_SKIPPED_DUPLICATE"
    | "FULFILLMENT_DELAY";
  detail: string;
  createdAt: string;
}

function requireWorkspaceContext(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

function walletIdFor(workspaceId: string) {
  return `wallet_${workspaceId}`;
}

function createStorageProvider() {
  if (process.env.STORAGE_PROVIDER === "cloudinary") {
    return createCloudinaryStorageProvider({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
      folder: process.env.CLOUDINARY_FOLDER,
      secureDistribution: process.env.CLOUDINARY_SECURE_DISTRIBUTION
    });
  }

  return createMockStorageProvider();
}

function createPaymentGateway() {
  if (process.env.PAYMENT_PROVIDER === "live" && getSecret(process.env.KORAPAY_SECRET_KEY)) {
    return createKorapayPaymentGateway({
      publicKey: getSecret(process.env.KORAPAY_PUBLIC_KEY),
      secretKey: getSecret(process.env.KORAPAY_SECRET_KEY),
      encryptionKey: getSecret(process.env.KORAPAY_ENCRYPTION_KEY),
      baseUrl: process.env.KORAPAY_BASE_URL,
      defaultRedirectUrl: process.env.KORAPAY_REDIRECT_URL ?? process.env.APP_URL,
      defaultWebhookUrl:
        process.env.KORAPAY_WEBHOOK_URL ??
        `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay`
    });
  }

  return createMockPaymentGateway();
}

function productionProviderName(name: string, productionName: string) {
  return isProductionRuntime() && name.startsWith("mock-") ? productionName : name;
}

function rejectLegacyMockProvider(operation: string): never {
  throw new BadRequestException(
    `${operation} is unavailable on the legacy mock provider in production. Use the managed campaign workflow.`
  );
}

function getCurrency(value: string | undefined, fallback: CurrencyCode): CurrencyCode {
  return currencies.includes(value as CurrencyCode) ? (value as CurrencyCode) : fallback;
}

function getSecret(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "..." || trimmed.startsWith("replace-")) {
    return undefined;
  }

  return trimmed;
}

function getPanelEndpoint(value: string | undefined) {
  return value?.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/iu, "").trim();
}

function getKorapayWebhookSigningSecret() {
  const configuredSecret = getSecret(process.env.KORAPAY_WEBHOOK_SECRET);

  if (configuredSecret && !configuredSecret.startsWith("http")) {
    return configuredSecret;
  }

  return getSecret(process.env.KORAPAY_SECRET_KEY);
}

function verifyKorapaySignature(input: { body: unknown; signature?: string | undefined }) {
  const signingSecret = getKorapayWebhookSigningSecret();

  if (!signingSecret) {
    return process.env.NODE_ENV !== "production";
  }
  if (!input.signature) {
    return false;
  }

  const eventBody =
    typeof input.body === "object" && input.body !== null
      ? (input.body as Record<string, unknown>)
      : {};
  const signedPayload = JSON.stringify(eventBody.data ?? {});
  const expectedSignature = createHmac("sha256", signingSecret).update(signedPayload).digest("hex");
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(input.signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getApiHost(apiUrl: string) {
  try {
    return new URL(apiUrl).hostname;
  } catch {
    return apiUrl;
  }
}

function getServiceMapCoverage(serviceMap?: Partial<Record<SmmServiceKind, string>>) {
  return Object.keys(serviceMap ?? {}) as SmmServiceKind[];
}

function getAllSmmServiceKinds() {
  return defaultSmmPricingRules.map((rule) => rule.serviceKind);
}

function getGrowthPricingRules(service: GrowthServiceCatalogItem) {
  const baseRule = defaultSmmPricingRules.find((rule) => rule.serviceKind === service.serviceKind);

  return [
    {
      serviceKind: service.serviceKind,
      markupBps: service.marginBps,
      rushMarkupBps: 0,
      minimumMarginMinor: baseRule?.minimumMarginMinor ?? 100,
      platformFeeMinor: baseRule?.platformFeeMinor ?? 25
    }
  ];
}

function getDefaultGrowthDestinationUrl(service: GrowthServiceCatalogItem) {
  switch (service.platform) {
    case "TIKTOK":
      return "https://www.tiktok.com/@fliptrybe";
    case "INSTAGRAM":
      return "https://www.instagram.com/fliptrybe";
    case "YOUTUBE":
      return "https://www.youtube.com/@fliptrybe";
    case "TELEGRAM":
      return "https://t.me/fliptrybe";
    case "WEBSITE":
    default:
      return "https://fliptrybe.example";
  }
}

function cloneGrowthService(service: GrowthServiceCatalogItem): GrowthServiceCatalogItem {
  return {
    ...service,
    baseRate: { ...service.baseRate },
    supplierRouting: {
      ...service.supplierRouting,
      fallbackSuppliers: [...service.supplierRouting.fallbackSuppliers]
    },
    risk: {
      ...service.risk,
      mitigations: [...service.risk.mitigations]
    }
  };
}

function normalizeGrowthOrderStatus(status?: string) {
  const allowed: GrowthOrderStatus[] = [
    "PENDING",
    "SUBMITTED",
    "IN_PROGRESS",
    "COMPLETED",
    "FAILED",
    "REFUNDED"
  ];

  return allowed.includes(status as GrowthOrderStatus) ? (status as GrowthOrderStatus) : undefined;
}

function createSmmSupplierBundle() {
  if (process.env.SMM_PROVIDER !== "live") {
    const supplier = createMockSmmSupplier();
    const providerAudit: SmmSupplierAuditProvider[] = [
      {
        name: supplier.name,
        mode: "mock",
        configured: true,
        supportedCategories: getAllSmmServiceKinds(),
        pricingModel: "per-1000-rate-card",
        routingRole: "primary",
        serviceMapCoverage: []
      }
    ];

    return { providerAudit, supplier, suppliers: [supplier] };
  }

  const supplierConfigs = [
    {
      name: "smdpanel",
      apiUrl:
        getPanelEndpoint(process.env.SMDPANEL_ENDPOINT) ??
        process.env.SMDPANEL_API_URL ??
        "https://smdpanel.com/api/v2",
      apiKey: getSecret(process.env.SMDPANEL_API_KEY),
      currency: getCurrency(process.env.SMDPANEL_CURRENCY, "USD"),
      serviceMap: parseSmmServiceMap(process.env.SMDPANEL_SERVICE_MAP)
    },
    {
      name: "smmraja",
      apiUrl: process.env.SMMRAJA_API_URL ?? "https://www.smmraja.com/api/v3",
      apiKey: getSecret(process.env.SMMRAJA_API_KEY),
      currency: getCurrency(process.env.SMMRAJA_CURRENCY, "USD"),
      serviceMap: parseSmmServiceMap(process.env.SMMRAJA_SERVICE_MAP),
      bulkStatusParam: "order",
      cancelMode: "single-order"
    },
    {
      name: "justanotherpanel",
      apiUrl: process.env.JAP_API_URL ?? "https://justanotherpanel.com/api/v2",
      apiKey: getSecret(process.env.JAP_API_KEY),
      currency: getCurrency(process.env.JAP_CURRENCY, "USD"),
      serviceMap: parseSmmServiceMap(process.env.JAP_SERVICE_MAP)
    },
    {
      name: "peakerr",
      apiUrl: process.env.PEAKERR_API_URL ?? "https://peakerr.com/api/v2",
      apiKey: getSecret(process.env.PEAKERR_API_KEY),
      currency: getCurrency(process.env.PEAKERR_CURRENCY, "USD"),
      serviceMap: parseSmmServiceMap(process.env.PEAKERR_SERVICE_MAP)
    }
  ] satisfies PerfectPanelSmmSupplierConfig[];

  const suppliers = supplierConfigs
    .filter((config) => Boolean(config.apiKey))
    .map((config) => createPerfectPanelSmmSupplier(config));
  const firstConfiguredSupplier = supplierConfigs.find((config) => Boolean(config.apiKey))?.name;
  const providerAudit: SmmSupplierAuditProvider[] = supplierConfigs.map((config) => ({
    name: config.name,
    mode: "perfect-panel",
    configured: Boolean(config.apiKey),
    apiHost: getApiHost(config.apiUrl),
    supportedCategories: getAllSmmServiceKinds(),
    pricingModel: "per-1000-rate-card",
    routingRole: !config.apiKey
      ? "disabled"
      : config.name === firstConfiguredSupplier
        ? "primary"
        : "fallback",
    serviceMapCoverage: getServiceMapCoverage(config.serviceMap)
  }));

  return {
    providerAudit,
    supplier: createRoutedSmmSupplier(suppliers),
    suppliers
  };
}

@Injectable()
export class PlatformService {
  private readonly adsProvider = createMockAdsProvider();
  private readonly aiProvider = createMockAiProvider();
  private readonly aiBrain = AiBrainClient.fromEnv();
  private readonly paymentGateway = createPaymentGateway();
  private readonly smmSupplierBundle = createSmmSupplierBundle();
  private readonly smmSupplier = this.smmSupplierBundle.supplier;
  private readonly smmHealthMonitor = createSmmServiceHealthMonitor(
    this.smmSupplierBundle.suppliers.length > 0
      ? this.smmSupplierBundle.suppliers
      : [this.smmSupplier]
  );
  private readonly storageProvider = createStorageProvider();
  private readonly events: PlatformEvent[] = [];
  private readonly campaigns: Campaign[] = [];
  private readonly paymentIntents: PaymentIntent[] = [];
  private readonly ledgerEntries: LedgerEntry[] = [];
  private readonly auditLogs: AuditLog[] = [];
  private readonly smmOrders: SmmOrder[] = [];
  private readonly growthServices: GrowthServiceCatalogItem[] =
    defaultGrowthServicesCatalog.map(cloneGrowthService);
  private readonly growthOrders: GrowthOrder[] = [];
  private readonly growthMonitoringEvents: GrowthMonitoringEvent[] = [];
  private readonly supportTickets: SupportTicket[] = [];
  private readonly notifications: NotificationMessage[] = [];

  getHealth() {
    return {
      status: "ok",
      service: "fliptrybe-api",
      checkedAt: now(),
      providers: {
        ads: legacyMockProvidersAllowed() ? this.adsProvider.name : "managed-ads",
        ai: legacyMockProvidersAllowed()
          ? this.aiProvider.name
          : process.env.AI_PROVIDER === "anthropic" || process.env.AI_PROVIDER === "claude"
            ? "anthropic"
            : "not-configured",
        payments: productionProviderName(this.paymentGateway.name, "not-configured"),
        smm: this.smmSupplier.name,
        storage: productionProviderName(this.storageProvider.name, "not-configured")
      },
      operations: {
        smmSuppliers: this.smmSupplierBundle.suppliers.map((supplier) => supplier.name),
        smmPricingRules: defaultSmmPricingRules.length
      }
    };
  }

  getSession() {
    return {
      user: {
        id: demoUserId,
        name: "Demo Operator",
        email: "operator@fliptrybe.test"
      },
      workspace: {
        id: demoWorkspaceId,
        name: "FlipTrybe Growth HQ",
        defaultCurrency: "NGN"
      },
      role: "OWNER"
    };
  }

  listOrganizations() {
    return [
      {
        id: "org_demo",
        name: "FlipTrybe",
        slug: "fliptrybe",
        region: "global",
        workspaces: [{ id: demoWorkspaceId, name: "FlipTrybe Growth HQ" }]
      }
    ];
  }

  listTeamMembers() {
    return [
      { id: "member_owner", name: "Demo Operator", role: "OWNER", permissions: ["admin:access"] },
      {
        id: "member_finance",
        name: "Finance Ops",
        role: "FINANCE",
        permissions: ["payment:manage"]
      },
      {
        id: "member_support",
        name: "Support Lead",
        role: "SUPPORT",
        permissions: ["support:manage"]
      }
    ];
  }

  async quoteCampaign(input: QuoteCampaignDto) {
    if (!legacyMockProvidersAllowed()) {
      rejectLegacyMockProvider("Campaign quoting");
    }

    return this.adsProvider.quoteCampaign({
      objective: input.objective ?? "ENGAGEMENT",
      budgetMinor: input.budgetMinor ?? 250000,
      currency: input.currency ?? "NGN",
      destinationKind: input.destinationKind ?? "INSTAGRAM_REEL"
    });
  }

  async createCampaign(context: AuthenticatedRequestContext | undefined, input: CreateCampaignDto) {
    if (!legacyMockProvidersAllowed()) {
      rejectLegacyMockProvider("Campaign creation");
    }

    const scope = requireWorkspaceContext(context);
    const destination: PromotionDestination = {
      kind: input.destinationKind ?? "INSTAGRAM_REEL",
      url: input.destinationUrl ?? "https://instagram.com/fliptrybe"
    };
    const timestamp = now();
    const campaign: Campaign = {
      id: id("cmp"),
      workspaceId: scope.workspaceId,
      creatorUserId: scope.userId,
      name: input.name ?? "Creator growth sprint",
      objective: input.objective ?? "ENGAGEMENT",
      status: "PENDING_REVIEW",
      budget: {
        amountMinor: input.budgetMinor ?? 250000,
        currency: input.currency ?? "NGN"
      },
      destination,
      schedule: {
        startsAt: timestamp,
        timezone: "Africa/Lagos"
      },
      provider: "MOCK",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const providerResult = await this.adsProvider.createCampaign(campaign);
    const readyCampaign: Campaign = {
      ...campaign,
      status: providerResult.status,
      providerReference: providerResult.providerReference
    };

    this.campaigns.unshift(readyCampaign);
    this.pushEvent(
      createEvent({
        name: "CampaignCreated",
        tenantId: scope.workspaceId,
        payload: { campaign: readyCampaign }
      })
    );

    return readyCampaign;
  }

  listCampaigns(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const campaigns = this.campaigns.filter(
      (campaign) => campaign.workspaceId === scope.workspaceId
    );

    return campaigns.length > 0 || !legacyMockProvidersAllowed() ? campaigns : [this.seedCampaign(scope)];
  }

  async startCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    if (!legacyMockProvidersAllowed()) {
      rejectLegacyMockProvider("Campaign starting");
    }

    const scope = requireWorkspaceContext(context);
    const campaign =
      this.campaigns.find(
        (item) => item.id === campaignId && item.workspaceId === scope.workspaceId
      ) ?? (campaignId === "cmp_demo" ? this.seedCampaign(scope, campaignId) : undefined);

    if (!campaign) {
      throw new NotFoundException("Campaign not found in the active workspace.");
    }

    const result = await this.adsProvider.startCampaign(
      campaign.providerReference ?? id("mock_ads")
    );
    const updated: Campaign = { ...campaign, status: result.status, updatedAt: now() };
    const existingIndex = this.campaigns.findIndex(
      (item) => item.id === updated.id && item.workspaceId === scope.workspaceId
    );

    if (existingIndex >= 0) {
      this.campaigns[existingIndex] = updated;
    }

    this.pushEvent(
      createEvent({
        name: "CampaignStarted",
        tenantId: scope.workspaceId,
        payload: { campaignId: updated.id }
      })
    );

    return updated;
  }

  listDestinations() {
    return [
      "TIKTOK_PROFILE",
      "TIKTOK_LIVE",
      "TIKTOK_BOX_GAME",
      "TIKTOK_SHOP",
      "INSTAGRAM_PROFILE",
      "INSTAGRAM_REEL",
      "INSTAGRAM_LIVE",
      "FACEBOOK_PAGE",
      "FACEBOOK_LIVE",
      "WHATSAPP_CHANNEL",
      "WHATSAPP_GROUP",
      "TELEGRAM_CHANNEL",
      "TELEGRAM_GROUP",
      "YOUTUBE_CHANNEL",
      "WEBSITE",
      "APP",
      "ECOMMERCE_STORE",
      "FLIPTRYBE_STORE"
    ] satisfies DestinationKind[];
  }

  listLivePromotions(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const campaign = this.listCampaigns(scope)[0];

    if (!campaign) {
      return [];
    }

    return [
      {
        id: `live_${scope.workspaceId}`,
        campaignId: campaign.id,
        destinationKind: "TIKTOK_LIVE",
        expectedStartAt: now(),
        realtimeBoostEnabled: true,
        currentViewers: 1240,
        viewerGrowthPct: 32
      }
    ];
  }

  async createSmmOrder(context: AuthenticatedRequestContext | undefined, input: CreateSmmOrderDto) {
    const scope = requireWorkspaceContext(context);
    const { fraudAssessment, order, pricedQuote, queueJob } = await this.prepareSmmOrder(
      scope,
      input
    );

    if (fraudAssessment.action === "BLOCK") {
      throw new BadRequestException({
        message: "SMM order blocked by fraud controls.",
        fraudAssessment
      });
    }

    const result = await this.smmSupplier.createOrder(order);
    const readyOrder = {
      ...order,
      supplierReference: result.supplierReference,
      status: result.status
    };

    this.smmOrders.unshift(readyOrder);
    this.pushEvent(
      createEvent({
        name: "SMMOrderCreated",
        tenantId: scope.workspaceId,
        payload: { order: readyOrder }
      })
    );

    return {
      ...readyOrder,
      pricing: pricedQuote,
      fraudAssessment,
      queueJob
    };
  }

  async quoteSmmOrder(context: AuthenticatedRequestContext | undefined, input: CreateSmmOrderDto) {
    const scope = requireWorkspaceContext(context);
    const { fraudAssessment, order, pricedQuote, queueJob } = await this.prepareSmmOrder(
      scope,
      input
    );

    return {
      order,
      pricing: pricedQuote,
      fraudAssessment,
      queueJob
    };
  }

  listSmmServices() {
    const labels = {
      FOLLOWERS: { label: "Followers", delivery: "2-24 hours" },
      LIKES: { label: "Likes", delivery: "10-120 minutes" },
      VIEWS: { label: "Views", delivery: "10-120 minutes" },
      COMMENTS: { label: "Comments", delivery: "Manual review" },
      SHARES: { label: "Shares", delivery: "1-6 hours" },
      LIVE_VIEWERS: { label: "Live viewers", delivery: "Realtime" },
      CHANNEL_MEMBERS: { label: "Channel members", delivery: "2-48 hours" }
    } as const;

    return defaultSmmPricingRules.map((rule) => ({
      kind: rule.serviceKind,
      label: labels[rule.serviceKind].label,
      startsAtMinor: rule.minimumMarginMinor + rule.platformFeeMinor,
      markupBps: rule.markupBps,
      rushMarkupBps: rule.rushMarkupBps,
      delivery: labels[rule.serviceKind].delivery
    }));
  }

  listSmmSupplierServices() {
    return this.smmSupplier.listServices();
  }

  getSmmSupplierBalance() {
    return this.smmSupplier.getBalance();
  }

  async getSmmSupplierHealth() {
    const suppliers = await this.smmHealthMonitor.checkAll();

    return {
      status: summarizeSmmSupplierHealth(suppliers),
      suppliers
    };
  }

  getSmmOrderStatuses(
    context: AuthenticatedRequestContext | undefined,
    input: SmmSupplierReferencesDto
  ) {
    const scope = requireWorkspaceContext(context);
    const supplierReferences =
      input.supplierReferences?.filter(Boolean) ??
      this.smmOrders
        .filter((order) => order.workspaceId === scope.workspaceId)
        .map((order) => order.supplierReference)
        .filter((reference): reference is string => Boolean(reference));
    this.assertSmmReferencesBelongToWorkspace(scope, supplierReferences);

    if (supplierReferences.length === 0) {
      throw new BadRequestException("At least one SMM supplier reference is required.");
    }

    return this.smmSupplier.getOrderStatuses(supplierReferences);
  }

  requestSmmRefill(
    context: AuthenticatedRequestContext | undefined,
    input: SmmSupplierReferenceDto
  ) {
    const scope = requireWorkspaceContext(context);
    if (!input.supplierReference) {
      throw new BadRequestException("SMM supplier reference is required.");
    }
    this.assertSmmReferencesBelongToWorkspace(scope, [input.supplierReference]);

    return this.smmSupplier.requestRefill(input.supplierReference);
  }

  requestSmmCancel(
    context: AuthenticatedRequestContext | undefined,
    input: SmmSupplierReferencesDto
  ) {
    const scope = requireWorkspaceContext(context);
    const supplierReferences = input.supplierReferences?.filter(Boolean) ?? [];

    if (supplierReferences.length === 0) {
      throw new BadRequestException("At least one SMM supplier reference is required.");
    }
    this.assertSmmReferencesBelongToWorkspace(scope, supplierReferences);

    return this.smmSupplier.requestCancel(supplierReferences);
  }

  listGrowthServices(options?: { includeDisabled?: boolean }) {
    return this.growthServices
      .filter((service) => options?.includeDisabled || service.enabled)
      .map(cloneGrowthService);
  }

  listAdminGrowthServices(context: AuthenticatedRequestContext | undefined) {
    requireWorkspaceContext(context);

    return this.listGrowthServices({ includeDisabled: true });
  }

  listGrowthCatalog() {
    const services = this.listGrowthServices();
    const categories = Array.from(
      new Map(
        services.map((service) => [
          service.category,
          {
            label: service.category,
            platform: service.platform,
            serviceCount: services.filter((item) => item.category === service.category).length
          }
        ])
      ).values()
    );

    return { categories, services };
  }

  async createGrowthOrder(
    context: AuthenticatedRequestContext | undefined,
    input: CreateGrowthOrderDto
  ) {
    const scope = requireWorkspaceContext(context);
    const service = this.requireGrowthService(input.serviceCode);

    if (!service.enabled) {
      throw new BadRequestException("Growth service is currently disabled.");
    }

    const quantity = Math.round(input.quantity ?? service.minimumQuantity);

    if (quantity < service.minimumQuantity || quantity > service.maximumQuantity) {
      throw new BadRequestException(
        `Quantity must be between ${service.minimumQuantity} and ${service.maximumQuantity}.`
      );
    }

    const timestamp = now();
    const destinationUrl = input.destinationUrl?.trim() || getDefaultGrowthDestinationUrl(service);
    const idempotencyKey = input.idempotencyKey?.trim() || id("growth_idempotency");
    const existingIdempotentOrder = this.findGrowthOrderByIdempotencyKey(
      scope.workspaceId,
      idempotencyKey
    );

    if (existingIdempotentOrder) {
      this.recordGrowthMonitoringEvent({
        workspaceId: scope.workspaceId,
        orderId: existingIdempotentOrder.id,
        kind: "SUPPLIER_SUBMISSION_SKIPPED_DUPLICATE",
        detail: "Growth order idempotency key reused; returning existing order without supplier execution."
      });

      return {
        order: existingIdempotentOrder,
        reviewRequired:
          existingIdempotentOrder.status === "PENDING" && !existingIdempotentOrder.supplierReference,
        idempotent: true
      };
    }

    const activeDuplicate = this.findActiveGrowthDuplicate({
      workspaceId: scope.workspaceId,
      serviceCode: service.code,
      destinationUrl,
      quantity
    });

    if (activeDuplicate) {
      this.recordGrowthMonitoringEvent({
        workspaceId: scope.workspaceId,
        orderId: activeDuplicate.id,
        kind: "SUPPLIER_SUBMISSION_SKIPPED_DUPLICATE",
        detail: "Growth supplier execution blocked because an equivalent active order already exists."
      });
      throw new BadRequestException(
        "An active Growth order already exists for this service, destination, and quantity."
      );
    }

    const smmOrder: SmmOrder = {
      id: id("smm"),
      workspaceId: scope.workspaceId,
      serviceKind: service.serviceKind,
      destination: {
        kind: service.destinationKind,
        url: destinationUrl
      },
      quantity,
      status: "QUEUED",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const quote = await this.smmSupplier.quoteService({
      serviceKind: service.serviceKind,
      quantity,
      destination: smmOrder.destination
    });
    const pricedQuote = calculateSmmPrice({
      quote,
      serviceKind: service.serviceKind,
      rules: getGrowthPricingRules(service)
    });
    const fraudAssessment = assessSmmOrderFraud({
      order: smmOrder,
      quote,
      recentOrders: this.smmOrders.filter(
        (recentOrder) => recentOrder.workspaceId === scope.workspaceId
      )
    });

    if (fraudAssessment.action === "BLOCK") {
      throw new BadRequestException({
        message: "Growth order blocked by fraud controls.",
        fraudAssessment
      });
    }

    const orderId = id("growth");
    const reservation = this.reserveGrowthFunds({
      context: scope,
      orderId,
      amount: pricedQuote.customerPrice,
      idempotencyKey
    });
    const baseGrowthOrder: GrowthOrder = {
      id: orderId,
      workspaceId: scope.workspaceId,
      serviceCode: service.code,
      serviceName: service.name,
      platform: service.platform,
      serviceKind: service.serviceKind,
      destinationKind: service.destinationKind,
      destinationUrl,
      quantityOrdered: quantity,
      quantityDelivered: 0,
      status: "PENDING",
      amount: pricedQuote.customerPrice,
      supplierCost: pricedQuote.supplierCost,
      grossMargin: pricedQuote.grossMargin,
      expectedCompletionAt: getGrowthExpectedCompletionAt({
        estimatedDeliveryMinutes: pricedQuote.estimatedDeliveryMinutes,
        now: timestamp
      }),
      idempotencyKey,
      paymentStatus: "FUNDS_RESERVED",
      reservationLedgerEntryId: reservation.id,
      refundEligibility: "NONE",
      refundReviewStatus: "NOT_REQUIRED",
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(pricedQuote.supplierName === undefined ? {} : { supplierName: pricedQuote.supplierName })
    };
    this.growthOrders.unshift(baseGrowthOrder);

    if (
      fraudAssessment.action === "REVIEW" ||
      service.supplierRouting.strategy === "MANUAL_REVIEW"
    ) {
      const reviewOrder: GrowthOrder = {
        ...baseGrowthOrder,
        paymentStatus: "MANUAL_REVIEW",
        refundEligibility: "MANUAL_REVIEW",
        refundReviewStatus: "PENDING",
        updatedAt: now()
      };
      this.growthOrders[0] = reviewOrder;
      this.recordAuditLog({
        workspaceId: scope.workspaceId,
        actorUserId: scope.userId,
        action: "growth.manual_review_required",
        entityType: "GrowthOrder",
        entityId: reviewOrder.id,
        metadata: {
          fraudAction: fraudAssessment.action,
          serviceCode: service.code,
          amountMinor: reviewOrder.amount.amountMinor
        }
      });

      return {
        order: reviewOrder,
        fraudAssessment,
        pricing: pricedQuote,
        reviewRequired: true
      };
    }

    try {
      const result = await this.smmSupplier.createOrder(smmOrder);
      const submittedSmmOrder: SmmOrder = {
        ...smmOrder,
        supplierReference: result.supplierReference,
        status: result.status,
        updatedAt: now()
      };
      const status = mapSmmOrderStatusToGrowthStatus(result.status);
      const finance = this.applyGrowthFinancialTransition(baseGrowthOrder, status);
      const growthOrder: GrowthOrder = {
        ...baseGrowthOrder,
        status,
        ...finance,
        quantityDelivered: calculateGrowthDeliveredQuantity({
          quantityOrdered: quantity,
          status
        }),
        supplierReference: result.supplierReference,
        submittedAt: timestamp,
        updatedAt: submittedSmmOrder.updatedAt,
        ...(status === "COMPLETED" ? { completedAt: submittedSmmOrder.updatedAt } : {})
      };

      this.smmOrders.unshift(submittedSmmOrder);
      const growthOrderIndex = this.growthOrders.findIndex((order) => order.id === baseGrowthOrder.id);
      if (growthOrderIndex >= 0) {
        this.growthOrders[growthOrderIndex] = growthOrder;
      } else {
        this.growthOrders.unshift(growthOrder);
      }
      this.pushEvent(
        createEvent({
          name: "SMMOrderCreated",
          tenantId: scope.workspaceId,
          payload: { order: submittedSmmOrder }
        })
      );

      return {
        order: growthOrder,
        fraudAssessment,
        pricing: pricedQuote,
        reviewRequired: false
      };
    } catch (error) {
      const failedOrder: GrowthOrder = {
        ...baseGrowthOrder,
        status: "FAILED",
        failureReason:
          error instanceof Error ? error.message : "Supplier submission failed unexpectedly.",
        ...this.applyGrowthFinancialTransition(baseGrowthOrder, "FAILED"),
        updatedAt: now()
      };

      const growthOrderIndex = this.growthOrders.findIndex((order) => order.id === baseGrowthOrder.id);
      if (growthOrderIndex >= 0) {
        this.growthOrders[growthOrderIndex] = failedOrder;
      } else {
        this.growthOrders.unshift(failedOrder);
      }
      this.recordGrowthMonitoringEvent({
        workspaceId: scope.workspaceId,
        orderId: failedOrder.id,
        kind: "SUPPLIER_SUBMISSION_FAILED",
        detail: failedOrder.failureReason ?? "Supplier submission failed unexpectedly."
      });

      return {
        order: failedOrder,
        fraudAssessment,
        pricing: pricedQuote,
        reviewRequired: false
      };
    }
  }

  async listGrowthOrders(context: AuthenticatedRequestContext | undefined) {
    const scope = requireWorkspaceContext(context);

    await this.refreshGrowthOrders(scope);

    return this.growthOrders.filter((order) => order.workspaceId === scope.workspaceId);
  }

  async getGrowthOrder(context: AuthenticatedRequestContext | undefined, orderId: string) {
    const scope = requireWorkspaceContext(context);

    await this.refreshGrowthOrders(scope);

    const order = this.growthOrders.find(
      (item) => item.id === orderId && item.workspaceId === scope.workspaceId
    );

    if (!order) {
      throw new NotFoundException("Growth order was not found.");
    }

    return order;
  }

  async getGrowthOverview(context: AuthenticatedRequestContext | undefined) {
    const scope = requireWorkspaceContext(context);
    const orders = await this.listGrowthOrders(scope);
    const totals = orders.reduce(
      (summary, order) => ({
        ...summary,
        [order.status]: summary[order.status] + 1
      }),
      {
        PENDING: 0,
        SUBMITTED: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        FAILED: 0,
        REFUNDED: 0
      } satisfies Record<GrowthOrderStatus, number>
    );

    return {
      totals,
      activeServices: this.growthServices.filter((service) => service.enabled).length,
      disabledServices: this.growthServices.filter((service) => !service.enabled).length,
      revenue: {
        amountMinor: orders
          .filter((order) => order.status === "COMPLETED")
          .reduce((total, order) => total + order.amount.amountMinor, 0),
        currency: "NGN" as const
      },
      monitoring: this.getGrowthMonitoringSummary(scope.workspaceId, orders),
      recentOrders: orders.slice(0, 8)
    };
  }

  async getGrowthSupplierAudit(context: AuthenticatedRequestContext | undefined) {
    requireWorkspaceContext(context);
    const health = await this.getSmmSupplierHealth();

    return createSmmSupplierAudit({
      providers: this.smmSupplierBundle.providerAudit,
      reliability: health.suppliers
    });
  }

  getGrowthRiskReport() {
    return {
      generatedAt: now(),
      disclaimer:
        "Risk levels are operational guidance for Growth Services controls, not legal advice.",
      services: getGrowthServiceRiskReport(this.growthServices)
    };
  }

  updateGrowthService(
    context: AuthenticatedRequestContext | undefined,
    serviceCode: string,
    input: UpdateGrowthServiceDto
  ) {
    requireWorkspaceContext(context);
    const index = this.growthServices.findIndex((service) => service.code === serviceCode);

    if (index < 0) {
      throw new NotFoundException("Growth service was not found.");
    }

    const current = this.growthServices[index];

    if (!current) {
      throw new NotFoundException("Growth service was not found.");
    }

    const updated = applyGrowthServiceAdminControls(current, input);
    this.growthServices[index] = updated;

    return cloneGrowthService(updated);
  }

  updateGrowthOrder(
    context: AuthenticatedRequestContext | undefined,
    orderId: string,
    input: UpdateGrowthOrderDto
  ) {
    const scope = requireWorkspaceContext(context);
    const index = this.growthOrders.findIndex(
      (order) => order.id === orderId && order.workspaceId === scope.workspaceId
    );

    if (index < 0) {
      throw new NotFoundException("Growth order was not found.");
    }

    const current = this.growthOrders[index];

    if (!current) {
      throw new NotFoundException("Growth order was not found.");
    }

    const timestamp = now();
    const nextStatus = normalizeGrowthOrderStatus(input.status);
    if (nextStatus !== undefined) {
      this.assertGrowthStatusTransition(current, nextStatus);
    }
    const finance = nextStatus === undefined ? {} : this.applyGrowthFinancialTransition(current, nextStatus);
    const updated: GrowthOrder = {
      ...current,
      ...(nextStatus === undefined ? {} : { status: nextStatus }),
      ...finance,
      ...(typeof input.quantityDelivered === "number"
        ? {
            quantityDelivered: Math.max(
              0,
              Math.min(Math.round(input.quantityDelivered), current.quantityOrdered)
            )
          }
        : {}),
      ...(input.supplierName === undefined ? {} : { supplierName: input.supplierName }),
      ...(input.supplierReference === undefined
        ? {}
        : { supplierReference: input.supplierReference }),
      ...(input.adminNote === undefined ? {} : { adminNote: input.adminNote }),
      ...(input.failureReason === undefined ? {} : { failureReason: input.failureReason }),
      updatedAt: timestamp,
      ...((nextStatus === "COMPLETED" || nextStatus === "REFUNDED") && !current.completedAt
        ? { completedAt: timestamp }
        : {})
    };

    this.growthOrders[index] = updated;
    if (nextStatus) {
      this.recordAuditLog({
        workspaceId: scope.workspaceId,
        actorUserId: scope.userId,
        action: `growth.status_${nextStatus.toLowerCase()}`,
        entityType: "GrowthOrder",
        entityId: updated.id,
        metadata: {
          status: nextStatus,
          paymentStatus: updated.paymentStatus ?? null,
          amountMinor: updated.amount.amountMinor
        }
      });
    }

    return updated;
  }

  async createPaymentIntent(
    context: AuthenticatedRequestContext | undefined,
    input: CreatePaymentIntentDto
  ) {
    const scope = requireWorkspaceContext(context);
    const intent = await this.paymentGateway.createPaymentIntent({
      amount: { amountMinor: input.amountMinor ?? 500000, currency: input.currency ?? "NGN" },
      workspaceId: scope.workspaceId,
      ...(input.customerEmail === undefined ? {} : { customerEmail: input.customerEmail }),
      ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
      ...(input.redirectUrl === undefined ? {} : { redirectUrl: input.redirectUrl }),
      ...(input.webhookUrl === undefined ? {} : { webhookUrl: input.webhookUrl })
    });

    this.paymentIntents.unshift(intent);

    if (intent.status === "COMPLETED") {
      this.pushEvent(
        createEvent({
          name: "PaymentCompleted",
          tenantId: scope.workspaceId,
          payload: { payment: intent, wallet: this.getWallet(scope) }
        })
      );
    }

    return intent;
  }

  async verifyPayment(context: AuthenticatedRequestContext | undefined, reference: string) {
    const scope = requireWorkspaceContext(context);
    const result = await this.paymentGateway.verifyPayment(reference);
    const intent = this.paymentIntents.find(
      (paymentIntent) => paymentIntent.providerReference === reference
    );

    if (intent && intent.workspaceId !== scope.workspaceId) {
      throw new BadRequestException("Payment reference does not belong to the active workspace.");
    }

    const updatedIntent: PaymentIntent = {
      ...(intent ?? {
        id: id("pay"),
        workspaceId: scope.workspaceId,
        gateway: this.paymentGateway.name === "korapay" ? "KORAPAY" : "MOCK",
        amount: { amountMinor: 0, currency: "NGN" },
        createdAt: now()
      }),
      status: result.status,
      providerReference: result.providerReference,
      updatedAt: now()
    };
    const existingIndex = this.paymentIntents.findIndex(
      (paymentIntent) => paymentIntent.id === updatedIntent.id
    );

    if (existingIndex >= 0) {
      this.paymentIntents[existingIndex] = updatedIntent;
    }

    if (result.status === "COMPLETED") {
      this.pushEvent(
        createEvent({
          name: "PaymentCompleted",
          tenantId: scope.workspaceId,
          payload: { payment: updatedIntent, wallet: this.getWallet(scope) }
        })
      );
    }

    return updatedIntent;
  }

  handleKorapayWebhook(body: unknown, signature?: string) {
    if (!verifyKorapaySignature({ body, signature })) {
      throw new BadRequestException("Invalid Korapay webhook signature.");
    }

    const eventBody =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const data =
      typeof eventBody.data === "object" && eventBody.data !== null
        ? (eventBody.data as Record<string, unknown>)
        : {};
    const reference =
      typeof data.reference === "string"
        ? data.reference
        : typeof data.payment_reference === "string"
          ? data.payment_reference
          : undefined;
    const status = typeof data.status === "string" ? data.status : undefined;

    if (!reference) {
      throw new BadRequestException("Korapay webhook is missing a payment reference.");
    }

    return {
      accepted: true,
      reference,
      status
    };
  }

  getWallet(context?: AuthenticatedRequestContext): Wallet {
    const scope = requireWorkspaceContext(context);
    const timestamp = now();
    const walletId = walletIdFor(scope.workspaceId);
    const workspaceLedgerEntries = this.ledgerEntries.filter(
      (entry) => entry.walletId === walletId
    );

    if (workspaceLedgerEntries.length === 0) {
      const openingEntry = {
        id: id("ledger"),
        walletId,
        kind: "CREDIT",
        amount: { amountMinor: 1250000, currency: "NGN" },
        reference: "opening_balance",
        description: "Demo wallet funding",
        createdAt: timestamp,
        updatedAt: timestamp
      } satisfies LedgerEntry;

      this.ledgerEntries.push(openingEntry);
      workspaceLedgerEntries.push(openingEntry);
    }

    return {
      id: walletId,
      workspaceId: scope.workspaceId,
      availableBalance: calculateAvailableBalance(workspaceLedgerEntries),
      heldBalance: this.calculateHeldBalance(walletId),
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  getAnalyticsOverview(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const metrics: AnalyticsMetric[] = [
      createMetric({
        workspaceId: scope.workspaceId,
        name: "impressions",
        value: 428500,
        dimensions: { channel: "all" }
      }),
      createMetric({
        workspaceId: scope.workspaceId,
        name: "clicks",
        value: 18420,
        dimensions: { channel: "all" }
      }),
      createMetric({
        workspaceId: scope.workspaceId,
        name: "roi_bps",
        value: 1860,
        dimensions: { channel: "all" }
      }),
      createMetric({
        workspaceId: scope.workspaceId,
        name: "live_viewers",
        value: 1240,
        dimensions: { channel: "tiktok" }
      })
    ];

    return {
      metrics,
      trend: [
        { day: "Mon", spendMinor: 82000, conversions: 42 },
        { day: "Tue", spendMinor: 94000, conversions: 57 },
        { day: "Wed", spendMinor: 118000, conversions: 71 },
        { day: "Thu", spendMinor: 126000, conversions: 84 }
      ]
    };
  }

  async getAiAdsInsights(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const campaigns = this.listCampaigns(scope);
    const insights = await this.aiBrain.getAdsInsights({
      account_id: scope.workspaceId,
      campaign_ids: campaigns.map((campaign) => campaign.id),
      metrics: ["roi", "conversions", "budget_efficiency"],
      filters: { product: "ads_campaigner" },
      metadata: {
        workspace_id: scope.workspaceId,
        campaign_count: campaigns.length
      }
    });

    if (insights) {
      return insights;
    }

    return {
      summary: {
        mode: "local_fallback",
        account_id: scope.workspaceId,
        campaign_count: campaigns.length,
        ai_brain_enabled: this.aiBrain.enabled
      },
      items: campaigns.map((campaign) => ({
        id: campaign.id,
        label: campaign.name,
        metrics: {
          budget_minor: campaign.budget.amountMinor,
          status: campaign.status
        },
        dimensions: {
          objective: campaign.objective,
          provider: campaign.provider,
          destination_kind: campaign.destination.kind
        },
        reasons: ["local_campaign_snapshot"]
      })),
      trace_id: null
    };
  }

  listNotifications(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const notifications = this.notifications.filter(
      (notification) => notification.workspaceId === scope.workspaceId
    );

    if (notifications.length === 0) {
      if (!legacyMockProvidersAllowed()) {
        return notifications;
      }

      const notification = createNotification({
        workspaceId: scope.workspaceId,
        channel: "IN_APP",
        title: "Phase 1 foundation ready",
        body: "Mock providers, queues, analytics, and admin surfaces are wired for validation."
      });

      this.notifications.push(notification);
      notifications.push(notification);
    }

    return notifications;
  }

  async createAiSuggestion() {
    if (!legacyMockProvidersAllowed()) {
      rejectLegacyMockProvider("AI copy suggestions");
    }

    return this.aiProvider.generateCampaignCopy({
      objective: "ENGAGEMENT",
      destinationKind: "TIKTOK_LIVE",
      audience: "creator-led commerce buyers"
    });
  }

  async createUploadUrl(context: AuthenticatedRequestContext | undefined) {
    const scope = requireWorkspaceContext(context);

    return this.storageProvider.createUploadUrl({
      key: `${scope.workspaceId}/campaign-assets/${id("asset")}.png`,
      contentType: "image/png"
    });
  }

  createSupportTicket(
    context: AuthenticatedRequestContext | undefined,
    input: CreateSupportTicketDto
  ) {
    const scope = requireWorkspaceContext(context);
    const timestamp = now();
    const ticket: SupportTicket = {
      id: id("ticket"),
      workspaceId: scope.workspaceId,
      requesterUserId: scope.userId,
      subject: input.subject ?? "Campaign review question",
      priority: input.priority ?? "NORMAL",
      status: "OPEN",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.supportTickets.unshift(ticket);

    return ticket;
  }

  listSupportTickets(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);

    return this.supportTickets.filter((ticket) => ticket.workspaceId === scope.workspaceId);
  }

  search(query = "") {
    if (!legacyMockProvidersAllowed()) {
      return { query, results: [] };
    }

    return {
      query,
      results: [
        { type: "campaign", id: "cmp_demo", title: "TikTok LIVE launch boost" },
        { type: "destination", id: "dest_demo", title: "Instagram Reels promotion" },
        { type: "support", id: "ticket_demo", title: "Payment verification" }
      ].filter(
        (item) => item.title.toLowerCase().includes(query.toLowerCase()) || query.length === 0
      )
    };
  }

  getAdminOverview() {
    if (!legacyMockProvidersAllowed()) {
      return {
        users: 0,
        activeCampaigns: 0,
        pendingModeration: 0,
        paymentVolumeMinor: 0,
        fraudSignals: 0,
        smmSupplierCount: this.smmSupplierBundle.suppliers.length,
        queueHealth: {
          campaign: "managed-ads",
          smm: "healthy",
          notifications: "healthy",
          analytics: "managed-ads"
        }
      };
    }

    return {
      users: 18420,
      activeCampaigns: 312,
      pendingModeration: 18,
      paymentVolumeMinor: 482500000,
      fraudSignals: 7,
      smmSupplierCount: this.smmSupplierBundle.suppliers.length,
      queueHealth: {
        campaign: "healthy",
        smm: "healthy",
        notifications: "healthy",
        analytics: "healthy"
      }
    };
  }

  listAuditLogs(context?: AuthenticatedRequestContext): AuditLog[] {
    const scope = requireWorkspaceContext(context);
    const timestamp = now();
    const logs = this.auditLogs.filter((log) => log.workspaceId === scope.workspaceId);

    if (!legacyMockProvidersAllowed()) {
      return logs;
    }

    return [
      ...logs,
      {
        id: `audit_${scope.workspaceId}`,
        workspaceId: scope.workspaceId,
        actorUserId: scope.userId,
        action: "campaign.created",
        entityType: "Campaign",
        entityId: "cmp_demo",
        metadata: { provider: "MOCK", status: "QUEUED" },
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];
  }

  getEvents() {
    return this.events;
  }

  private pushEvent(event: PlatformEvent) {
    this.events.unshift(event);
    void this.aiBrain.trackPlatformEvent(event);
  }

  private recordAuditLog(input: {
    workspaceId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, string | number | boolean | null>;
  }) {
    const timestamp = now();
    this.auditLogs.unshift({
      id: id("audit"),
      workspaceId: input.workspaceId,
      ...(input.actorUserId === undefined ? {} : { actorUserId: input.actorUserId }),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  private recordGrowthMonitoringEvent(input: Omit<GrowthMonitoringEvent, "id" | "createdAt">) {
    if (
      input.kind === "FULFILLMENT_DELAY" &&
      input.orderId &&
      this.growthMonitoringEvents.some(
        (event) =>
          event.workspaceId === input.workspaceId &&
          event.orderId === input.orderId &&
          event.kind === input.kind
      )
    ) {
      return;
    }

    this.growthMonitoringEvents.unshift({
      id: id("growth_monitor"),
      createdAt: now(),
      ...input
    });
  }

  private getGrowthMonitoringSummary(workspaceId: string, orders: GrowthOrder[]) {
    const events = this.growthMonitoringEvents.filter((event) => event.workspaceId === workspaceId);
    const delayedActiveOrders = orders.filter(
      (order) =>
        growthActiveStatuses.has(order.status) &&
        new Date(order.expectedCompletionAt).getTime() < Date.now()
    );

    return {
      unpaidExecutionAttempts: events.filter((event) => event.kind === "UNPAID_EXECUTION_ATTEMPT")
        .length,
      failedSupplierOrders: events.filter((event) => event.kind === "SUPPLIER_SUBMISSION_FAILED")
        .length,
      duplicateSupplierSubmissionsPrevented: events.filter(
        (event) => event.kind === "SUPPLIER_SUBMISSION_SKIPPED_DUPLICATE"
      ).length,
      fulfillmentDelays:
        events.filter((event) => event.kind === "FULFILLMENT_DELAY").length +
        delayedActiveOrders.length,
      recentEvents: events.slice(0, 8)
    };
  }

  private findGrowthOrderByIdempotencyKey(workspaceId: string, idempotencyKey: string) {
    return this.growthOrders.find(
      (order) => order.workspaceId === workspaceId && order.idempotencyKey === idempotencyKey
    );
  }

  private findActiveGrowthDuplicate(input: {
    workspaceId: string;
    serviceCode: string;
    destinationUrl: string;
    quantity: number;
  }) {
    const destinationUrl = input.destinationUrl.toLowerCase();

    return this.growthOrders.find(
      (order) =>
        order.workspaceId === input.workspaceId &&
        order.serviceCode === input.serviceCode &&
        order.destinationUrl.toLowerCase() === destinationUrl &&
        order.quantityOrdered === input.quantity &&
        growthActiveStatuses.has(order.status)
    );
  }

  private growthLedgerKey(order: Pick<GrowthOrder, "id" | "idempotencyKey">) {
    return order.idempotencyKey ?? order.id;
  }

  private assertGrowthStatusTransition(current: GrowthOrder, nextStatus: GrowthOrderStatus) {
    if (current.status === nextStatus) {
      return;
    }

    if (current.status === "COMPLETED" && nextStatus !== "REFUNDED") {
      throw new BadRequestException("Completed Growth orders can only transition to refunded.");
    }

    if (current.status === "REFUNDED") {
      throw new BadRequestException("Refunded Growth orders cannot be moved to another status.");
    }

    if (current.status === "FAILED" && nextStatus !== "REFUNDED") {
      throw new BadRequestException("Failed Growth orders can only transition to refunded.");
    }
  }

  private hasLedgerEntry(idempotencyKey: string) {
    return this.ledgerEntries.some((entry) => entry.idempotencyKey === idempotencyKey);
  }

  private pushLedgerEntry(entry: Omit<LedgerEntry, "id" | "createdAt" | "updatedAt">) {
    const existing = entry.idempotencyKey
      ? this.ledgerEntries.find((item) => item.idempotencyKey === entry.idempotencyKey)
      : undefined;

    if (existing) {
      return existing;
    }

    const timestamp = now();
    const ledgerEntry: LedgerEntry = {
      id: id("ledger"),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...entry
    };

    this.ledgerEntries.push(ledgerEntry);

    return ledgerEntry;
  }

  private calculateHeldBalance(walletId: string): Wallet["heldBalance"] {
    const activeHoldMinor = this.ledgerEntries
      .filter((entry) => entry.walletId === walletId && entry.kind === "HOLD")
      .reduce((total, hold) => {
        const sourceId = hold.sourceId ?? hold.metadata?.sourceId;
        const hasReleaseOrCapture = this.ledgerEntries.some(
          (entry) =>
            entry.walletId === walletId &&
            (entry.kind === "RELEASE" || entry.kind === "DEBIT") &&
            (entry.sourceId ?? entry.metadata?.sourceId) === sourceId &&
            entry.reference.includes("growth_")
        );

        return hasReleaseOrCapture ? total : total + hold.amount.amountMinor;
      }, 0);

    return { amountMinor: activeHoldMinor, currency: "NGN" };
  }

  private reserveGrowthFunds(input: {
    context: AuthenticatedRequestContext;
    orderId: string;
    amount: Wallet["availableBalance"];
    idempotencyKey: string;
  }) {
    if (input.amount.amountMinor <= 0) {
      throw new BadRequestException("Growth order amount must be greater than zero.");
    }

    const wallet = this.getWallet(input.context);

    if (wallet.availableBalance.currency !== input.amount.currency) {
      throw new BadRequestException("Growth order currency must match wallet currency.");
    }

    if (wallet.availableBalance.amountMinor < input.amount.amountMinor) {
      this.recordGrowthMonitoringEvent({
        workspaceId: input.context.workspaceId,
        orderId: input.orderId,
        kind: "UNPAID_EXECUTION_ATTEMPT",
        detail: "Growth supplier execution blocked because wallet funds were unavailable."
      });
      this.recordAuditLog({
        workspaceId: input.context.workspaceId,
        actorUserId: input.context.userId,
        action: "growth.payment_blocked",
        entityType: "GrowthOrder",
        entityId: input.orderId,
        metadata: {
          amountMinor: input.amount.amountMinor,
          availableMinor: wallet.availableBalance.amountMinor
        }
      });

      throw new BadRequestException(
        "Growth order requires a paid invoice or enough wallet balance to reserve funds."
      );
    }

    const reservation = this.pushLedgerEntry({
      walletId: wallet.id,
      kind: "HOLD",
      amount: input.amount,
      reference: `growth_hold:${input.orderId}`,
      description: "Growth Services funds reserved before supplier execution",
      idempotencyKey: `growth:${input.idempotencyKey}:reserve`,
      sourceType: "GrowthOrder",
      sourceId: input.orderId,
      metadata: {
        orderId: input.orderId,
        sourceId: input.orderId,
        idempotencyKey: input.idempotencyKey
      }
    });

    this.recordAuditLog({
      workspaceId: input.context.workspaceId,
      actorUserId: input.context.userId,
      action: "growth.funds_reserved",
      entityType: "GrowthOrder",
      entityId: input.orderId,
      metadata: {
        amountMinor: input.amount.amountMinor,
        ledgerEntryId: reservation.id
      }
    });

    return reservation;
  }

  private releaseGrowthFunds(order: GrowthOrder, reason: string) {
    const ledgerKey = this.growthLedgerKey(order);

    if (this.hasLedgerEntry(`growth:${ledgerKey}:capture`)) {
      return undefined;
    }

    const release = this.pushLedgerEntry({
      walletId: walletIdFor(order.workspaceId),
      kind: "RELEASE",
      amount: order.amount,
      reference: `growth_release:${order.id}`,
      description: `Growth Services funds released: ${reason}`,
      idempotencyKey: `growth:${ledgerKey}:release`,
      sourceType: "GrowthOrder",
      sourceId: order.id,
      metadata: {
        orderId: order.id,
        sourceId: order.id,
        reason
      }
    });

    this.recordAuditLog({
      workspaceId: order.workspaceId,
      action: "growth.funds_released",
      entityType: "GrowthOrder",
      entityId: order.id,
      metadata: {
        amountMinor: order.amount.amountMinor,
        ledgerEntryId: release.id,
        reason
      }
    });

    return release;
  }

  private captureGrowthFunds(order: GrowthOrder) {
    const ledgerKey = this.growthLedgerKey(order);

    if (this.hasLedgerEntry(`growth:${ledgerKey}:capture`)) {
      return undefined;
    }

    const release = this.pushLedgerEntry({
      walletId: walletIdFor(order.workspaceId),
      kind: "RELEASE",
      amount: order.amount,
      reference: `growth_capture_release:${order.id}`,
      description: "Growth Services hold released for capture",
      idempotencyKey: `growth:${ledgerKey}:capture_release`,
      sourceType: "GrowthOrder",
      sourceId: order.id,
      metadata: {
        orderId: order.id,
        sourceId: order.id
      }
    });
    const capture = this.pushLedgerEntry({
      walletId: walletIdFor(order.workspaceId),
      kind: "DEBIT",
      amount: order.amount,
      reference: `growth_capture:${order.id}`,
      description: "Growth Services supplier fulfillment captured",
      idempotencyKey: `growth:${ledgerKey}:capture`,
      sourceType: "GrowthOrder",
      sourceId: order.id,
      metadata: {
        orderId: order.id,
        sourceId: order.id,
        supplierReference: order.supplierReference ?? null
      }
    });

    this.recordAuditLog({
      workspaceId: order.workspaceId,
      action: "growth.funds_captured",
      entityType: "GrowthOrder",
      entityId: order.id,
      metadata: {
        amountMinor: order.amount.amountMinor,
        releaseLedgerEntryId: release.id,
        captureLedgerEntryId: capture.id
      }
    });

    return { release, capture };
  }

  private refundGrowthOrder(order: GrowthOrder, reason: string) {
    const ledgerKey = this.growthLedgerKey(order);

    if (this.hasLedgerEntry(`growth:${ledgerKey}:refund`)) {
      return undefined;
    }

    if (!this.hasLedgerEntry(`growth:${ledgerKey}:capture`)) {
      return this.releaseGrowthFunds(order, reason);
    }

    const refund = this.pushLedgerEntry({
      walletId: walletIdFor(order.workspaceId),
      kind: "REVERSAL",
      amount: order.amount,
      reference: `growth_refund:${order.id}`,
      description: `Growth Services refund: ${reason}`,
      idempotencyKey: `growth:${ledgerKey}:refund`,
      sourceType: "GrowthOrder",
      sourceId: order.id,
      metadata: {
        orderId: order.id,
        sourceId: order.id,
        reason
      }
    });

    this.recordAuditLog({
      workspaceId: order.workspaceId,
      action: "growth.refund_recorded",
      entityType: "GrowthOrder",
      entityId: order.id,
      metadata: {
        amountMinor: order.amount.amountMinor,
        ledgerEntryId: refund.id,
        reason
      }
    });

    return refund;
  }

  private applyGrowthFinancialTransition(order: GrowthOrder, status: GrowthOrderStatus) {
    if (status === "COMPLETED") {
      const capture = this.captureGrowthFunds(order);

      return {
        paymentStatus: "FUNDS_CAPTURED" as const,
        refundEligibility: "NONE" as const,
        refundReviewStatus: "NOT_REQUIRED" as const,
        ...(capture?.release === undefined ? {} : { releaseLedgerEntryId: capture.release.id }),
        ...(capture?.capture === undefined ? {} : { captureLedgerEntryId: capture.capture.id })
      };
    }

    if (status === "FAILED") {
      const release = this.releaseGrowthFunds(order, "supplier_failure");

      return {
        paymentStatus: "FUNDS_RELEASED" as const,
        refundEligibility: "AUTOMATIC" as const,
        refundReviewStatus: "NOT_REQUIRED" as const,
        ...(release === undefined ? {} : { releaseLedgerEntryId: release.id })
      };
    }

    if (status === "REFUNDED") {
      const refund = this.refundGrowthOrder(order, "manual_or_supplier_refund");

      return {
        paymentStatus: "REFUNDED" as const,
        refundEligibility: "AUTOMATIC" as const,
        refundReviewStatus: "APPROVED" as const,
        ...(refund === undefined
          ? {}
          : refund.kind === "REVERSAL"
            ? { refundLedgerEntryId: refund.id }
            : { releaseLedgerEntryId: refund.id })
      };
    }

    return {};
  }

  private assertSmmReferencesBelongToWorkspace(
    context: AuthenticatedRequestContext,
    supplierReferences: string[]
  ) {
    const blockedReferences = supplierReferences.filter((reference) =>
      this.smmOrders.some(
        (order) =>
          order.supplierReference === reference && order.workspaceId !== context.workspaceId
      )
    );

    if (blockedReferences.length > 0) {
      throw new BadRequestException(
        "One or more SMM supplier references do not belong to the active workspace."
      );
    }
  }

  private requireGrowthService(serviceCode?: string) {
    const service =
      this.growthServices.find((item) => item.code === serviceCode) ?? this.growthServices[0];

    if (!service) {
      throw new NotFoundException("Growth Services catalog is empty.");
    }

    return service;
  }

  private async refreshGrowthOrders(context: AuthenticatedRequestContext) {
    const orders = this.growthOrders.filter(
      (order) =>
        order.workspaceId === context.workspaceId &&
        order.supplierReference &&
        order.status !== "COMPLETED" &&
        order.status !== "FAILED" &&
        order.status !== "REFUNDED"
    );
    const timestampMs = Date.now();

    for (const order of orders) {
      if (new Date(order.expectedCompletionAt).getTime() < timestampMs) {
        this.recordGrowthMonitoringEvent({
          workspaceId: context.workspaceId,
          orderId: order.id,
          kind: "FULFILLMENT_DELAY",
          detail: "Growth supplier order is past the expected completion timestamp."
        });
      }
    }

    const supplierReferences = orders
      .map((order) => order.supplierReference)
      .filter((reference): reference is string => Boolean(reference));

    if (supplierReferences.length === 0) {
      return;
    }

    try {
      const snapshots = await this.smmSupplier.getOrderStatuses(supplierReferences);
      const timestamp = now();

      for (const snapshot of snapshots) {
        const index = this.growthOrders.findIndex(
          (order) =>
            order.workspaceId === context.workspaceId &&
            order.supplierReference === snapshot.supplierReference
        );

        if (index < 0) {
          continue;
        }

        const current = this.growthOrders[index];

        if (!current) {
          continue;
        }

        const status = mapSmmOrderStatusToGrowthStatus(snapshot.status);
        const finance = this.applyGrowthFinancialTransition(current, status);
        this.growthOrders[index] = {
          ...current,
          status,
          ...finance,
          quantityDelivered: calculateGrowthDeliveredQuantity({
            quantityOrdered: current.quantityOrdered,
            status,
            ...(snapshot.remains === undefined ? {} : { remains: snapshot.remains })
          }),
          updatedAt: timestamp,
          ...(status === "COMPLETED" && !current.completedAt ? { completedAt: timestamp } : {})
        };

        if (status === "FAILED") {
          this.recordGrowthMonitoringEvent({
            workspaceId: context.workspaceId,
            orderId: current.id,
            kind: "SUPPLIER_SUBMISSION_FAILED",
            detail: "Growth supplier reported the order as failed during status refresh."
          });
        }
      }
    } catch {
      for (const order of orders) {
        this.recordGrowthMonitoringEvent({
          workspaceId: context.workspaceId,
          orderId: order.id,
          kind: "FULFILLMENT_DELAY",
          detail: "Growth supplier status refresh failed; order retained its last known state."
        });
      }
      // Status refresh is best-effort; order pages should keep their last known lifecycle state.
    }
  }

  private async prepareSmmOrder(context: AuthenticatedRequestContext, input: CreateSmmOrderDto) {
    const timestamp = now();
    const order: SmmOrder = {
      id: id("smm"),
      workspaceId: context.workspaceId,
      serviceKind: input.serviceKind ?? "FOLLOWERS",
      destination: {
        kind: input.destinationKind ?? "INSTAGRAM_PROFILE",
        url: input.destinationUrl ?? "https://instagram.com/fliptrybe"
      },
      quantity: input.quantity ?? 1000,
      status: "QUEUED",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const quote = await this.smmSupplier.quoteService({
      serviceKind: order.serviceKind,
      quantity: order.quantity,
      destination: order.destination
    });
    const pricedQuote = calculateSmmPrice({
      quote,
      serviceKind: order.serviceKind
    });
    const fraudAssessment = assessSmmOrderFraud({
      order,
      quote,
      recentOrders: this.smmOrders.filter(
        (recentOrder) => recentOrder.workspaceId === context.workspaceId
      )
    });
    const queueJob = createSmmFulfillmentQueueJob({
      order,
      pricedQuote,
      fraudAssessment,
      enqueuedAt: timestamp
    });

    return {
      order,
      quote,
      pricedQuote,
      fraudAssessment,
      queueJob
    };
  }

  private seedCampaign(
    context: Pick<AuthenticatedRequestContext, "workspaceId" | "userId">,
    campaignId = "cmp_demo"
  ): Campaign {
    const timestamp = now();

    return {
      id: campaignId,
      workspaceId: context.workspaceId,
      creatorUserId: context.userId,
      name: "TikTok LIVE launch boost",
      objective: "LIVE_VIEWERS",
      status: "ACTIVE",
      budget: { amountMinor: 350000, currency: "NGN" },
      destination: {
        kind: "TIKTOK_LIVE",
        url: "https://tiktok.com/@fliptrybe/live"
      },
      schedule: {
        startsAt: timestamp,
        timezone: "Africa/Lagos"
      },
      provider: "MOCK",
      providerReference: "mock_ads_demo",
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }
}
