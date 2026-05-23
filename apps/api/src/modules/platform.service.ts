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
  assessSmmOrderFraud,
  calculateSmmPrice,
  createSmmFulfillmentQueueJob,
  createSmmServiceHealthMonitor,
  defaultSmmPricingRules,
  summarizeSmmSupplierHealth
} from "@fliptrybe/service-smm";
import {
  currencies,
  type AnalyticsMetric,
  type AuditLog,
  type Campaign,
  type CurrencyCode,
  type DestinationKind,
  type LedgerEntry,
  type NotificationMessage,
  type PaymentIntent,
  type PromotionDestination,
  type SmmOrder,
  type SupportTicket,
  type Wallet
} from "@fliptrybe/types";

import type {
  CreateCampaignDto,
  CreatePaymentIntentDto,
  CreateSmmOrderDto,
  CreateSupportTicketDto,
  QuoteCampaignDto,
  SmmSupplierReferenceDto,
  SmmSupplierReferencesDto
} from "./platform.dtos";
import { AiBrainClient } from "./ai-brain.client";
import type { AuthenticatedRequestContext } from "./request-context";

const demoWorkspaceId = "workspace_demo";
const demoUserId = "user_demo";
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

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

function createSmmSupplierBundle() {
  if (process.env.SMM_PROVIDER !== "live") {
    const supplier = createMockSmmSupplier();

    return { supplier, suppliers: [supplier] };
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

  return {
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
  private readonly smmOrders: SmmOrder[] = [];
  private readonly supportTickets: SupportTicket[] = [];
  private readonly notifications: NotificationMessage[] = [];

  getHealth() {
    return {
      status: "ok",
      service: "fliptrybe-api",
      checkedAt: now(),
      providers: {
        ads: this.adsProvider.name,
        ai: this.aiProvider.name,
        payments: this.paymentGateway.name,
        smm: this.smmSupplier.name,
        storage: this.storageProvider.name
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
    return this.adsProvider.quoteCampaign({
      objective: input.objective ?? "ENGAGEMENT",
      budgetMinor: input.budgetMinor ?? 250000,
      currency: input.currency ?? "NGN",
      destinationKind: input.destinationKind ?? "INSTAGRAM_REEL"
    });
  }

  async createCampaign(context: AuthenticatedRequestContext | undefined, input: CreateCampaignDto) {
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

    return campaigns.length > 0 ? campaigns : [this.seedCampaign(scope)];
  }

  async startCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string) {
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
    const campaign = this.listCampaigns(scope)[0] ?? this.seedCampaign(scope, "cmp_live_demo");

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
      heldBalance: { amountMinor: 175000, currency: "NGN" },
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

    return [
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
