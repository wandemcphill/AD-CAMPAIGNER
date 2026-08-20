/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { createMetric } from "@fliptrybe/analytics";
import { createEvent, type PlatformEvent } from "@fliptrybe/events";
import { createNotification } from "@fliptrybe/notifications";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import {
  createCloudinaryStorageProvider,
  createKorapayPaymentGateway,
  createGsubzSocialSupplier,
  createMockAdsProvider,
  createMockAiProvider,
  createMockPaymentGateway,
  createMockSmmSupplier,
  createMockStorageProvider,
  createPaystackPaymentGateway,
  createRoutedSmmSupplier
} from "@fliptrybe/providers";
import {
  applyGrowthServiceAdminControls,
  assessSmmOrderFraud,
  calculateSmmPrice,
  calculateGrowthDeliveredQuantity,
  createSmmSupplierAudit,
  createSmmServiceHealthMonitor,
  defaultGrowthServicesCatalog,
  defaultSmmPricingRules,
  getGrowthExpectedCompletionAt,
  getGrowthServiceRiskReport,
  mapSmmOrderStatusToGrowthStatus,
  summarizeSmmSupplierHealth,
  type SmmSupplierAuditProvider
} from "@fliptrybe/service-smm";
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
  type PromotionDestination,
  type SmmOrder,
  type SmmServiceKind,
  type SupportTicket,
  type Wallet
} from "@fliptrybe/types";

import type {
  CreateCampaignDto,
  CreateGrowthOrderDto,
  CreateSupportTicketDto,
  QuoteCampaignDto,
  UpdateGrowthOrderDto,
  UpdateGrowthServiceDto
} from "./platform.dtos";
import { AiBrainClient } from "./ai-brain.client";
import { isUniqueConstraintError, normalizeEmail } from "./auth-session.service";
import { PrismaService } from "./prisma.service";
import { NotificationsService } from "./notifications/notifications.service";
import type { AuthenticatedRequestContext } from "./request-context";

type DbClient = Record<string, any>;
type GrowthServiceOverrideRow = {
  serviceCode: string;
  enabled: boolean | null;
  marginBps: number | null;
  preferredSupplier: string | null;
  maximumQuantity: number | null;
  expectedCompletion: string | null;
  adminNote: string | null;
};

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : now();
const getCurrencyLocal = (value: string | undefined): CurrencyCode =>
  currencies.includes(value as CurrencyCode) ? (value as CurrencyCode) : "NGN";
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
  const preferredGateway = process.env.PAYMENT_GATEWAY?.toLowerCase();
  const paystackSecret = getSecret(process.env.PAYSTACK_SECRET_KEY);
  const korapaySecret = getSecret(process.env.KORAPAY_SECRET_KEY);

  if (process.env.PAYMENT_PROVIDER === "live" && preferredGateway === "paystack" && paystackSecret) {
    return createPaystackPaymentGateway({
      publicKey: getSecret(process.env.PAYSTACK_PUBLIC_KEY),
      secretKey: paystackSecret,
      baseUrl: process.env.PAYSTACK_BASE_URL,
      defaultRedirectUrl: process.env.PAYSTACK_REDIRECT_URL ?? process.env.APP_URL
    });
  }

  if (process.env.PAYMENT_PROVIDER === "live" && korapaySecret) {
    return createKorapayPaymentGateway({
      publicKey: getSecret(process.env.KORAPAY_PUBLIC_KEY),
      secretKey: korapaySecret,
      encryptionKey: getSecret(process.env.KORAPAY_ENCRYPTION_KEY),
      baseUrl: process.env.KORAPAY_BASE_URL,
      defaultRedirectUrl: process.env.KORAPAY_REDIRECT_URL ?? process.env.APP_URL,
      defaultWebhookUrl:
        process.env.KORAPAY_WEBHOOK_URL ??
        `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay`
    });
  }

  if (process.env.PAYMENT_PROVIDER === "live" && paystackSecret) {
    return createPaystackPaymentGateway({
      publicKey: getSecret(process.env.PAYSTACK_PUBLIC_KEY),
      secretKey: paystackSecret,
      baseUrl: process.env.PAYSTACK_BASE_URL,
      defaultRedirectUrl: process.env.PAYSTACK_REDIRECT_URL ?? process.env.APP_URL
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

function getSecret(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "..." || trimmed.startsWith("replace-")) {
    return undefined;
  }

  return trimmed;
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

const ALL_SMM_CATEGORIES: SmmServiceKind[] = [
  "FOLLOWERS",
  "LIKES",
  "VIEWS",
  "COMMENTS",
  "SHARES",
  "LIVE_VIEWERS",
  "CHANNEL_MEMBERS",
  "ACCOUNT_SALE",
  "VPN_SUBSCRIPTION",
  "STREAMING_SUBSCRIPTION"
];

function createSmmSupplierBundle() {
  const gsubzApiKey = process.env.GSUBZ_API_KEY?.trim();
  const gsubzSocialSupplier = createGsubzSocialSupplier({
    ...(gsubzApiKey ? { apiKey: gsubzApiKey } : {}),
    ...(process.env.GSUBZ_BASE_URL ? { baseUrl: process.env.GSUBZ_BASE_URL } : {})
  });

  const gsubzAudit: SmmSupplierAuditProvider = {
    name: gsubzSocialSupplier.name,
    configured: Boolean(gsubzApiKey),
    mode: gsubzApiKey ? "gsubz-api" : "catalog",
    apiHost: process.env.GSUBZ_BASE_URL ?? "https://api.gsubz.com/api",
    supportedCategories: [...ALL_SMM_CATEGORIES],
    pricingModel: "per-1000-rate-card",
    routingRole: gsubzApiKey ? "primary" : "disabled",
    serviceMapCoverage: [...ALL_SMM_CATEGORIES]
  };

  if (gsubzApiKey) {
    return {
      providerAudit: [gsubzAudit],
      supplier: createRoutedSmmSupplier([gsubzSocialSupplier]),
      suppliers: [gsubzSocialSupplier]
    };
  }

  // Without a GSUBZ key there is no live rate card, so nothing can quote. Dev and test
  // fall back to the mock supplier and Growth pricing still resolves; production stays
  // unquotable rather than inventing prices, matching every other legacy mock provider.
  if (!legacyMockProvidersAllowed()) {
    return {
      providerAudit: [gsubzAudit],
      supplier: createRoutedSmmSupplier([]),
      suppliers: []
    };
  }

  const mockSupplier = createMockSmmSupplier();
  const mockAudit: SmmSupplierAuditProvider = {
    name: mockSupplier.name,
    configured: true,
    mode: "mock",
    supportedCategories: [...ALL_SMM_CATEGORIES],
    pricingModel: "per-1000-rate-card",
    routingRole: "primary",
    serviceMapCoverage: [...ALL_SMM_CATEGORIES]
  };

  return {
    providerAudit: [gsubzAudit, mockAudit],
    supplier: createRoutedSmmSupplier([mockSupplier]),
    suppliers: [mockSupplier]
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
  private readonly smmHealthMonitor = createSmmServiceHealthMonitor(this.smmSupplierBundle.suppliers);
  private readonly storageProvider = createStorageProvider();
  private readonly events: PlatformEvent[] = [];
  private readonly campaigns: Campaign[] = [];
  private readonly auditLogs: AuditLog[] = [];
  private readonly smmOrders: SmmOrder[] = [];
  private readonly growthServices: GrowthServiceCatalogItem[] =
    defaultGrowthServicesCatalog.map(cloneGrowthService);
  private readonly growthMonitoringEvents: GrowthMonitoringEvent[] = [];
  private readonly supportTickets: SupportTicket[] = [];
  private readonly notifications: NotificationMessage[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  private get db(): DbClient {
    return this.prisma.client as unknown as DbClient;
  }

  /**
   * Records the signed-in user's date of birth. This is what unlocks the 18+
   * age gate (see AgeGuard): the value is validated as a real past date and
   * rejected if it implies an age under 18, so an under-age user cannot self-set
   * a passing DOB. Returns the stored ISO date (no other user fields).
   */
  async updateMyDateOfBirth(context: AuthenticatedRequestContext, rawDateOfBirth: string) {
    const userId = context.userId;
    if (!userId) {
      throw new BadRequestException("You must be signed in to update your profile.");
    }

    const parsed = new Date(rawDateOfBirth);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("A valid date of birth is required.");
    }
    if (parsed.getTime() > Date.now()) {
      throw new BadRequestException("Date of birth cannot be in the future.");
    }

    const eighteenthBirthday = new Date(
      parsed.getFullYear() + 18,
      parsed.getMonth(),
      parsed.getDate()
    );
    if (eighteenthBirthday.getTime() > Date.now()) {
      throw new BadRequestException("You must be at least 18 years old.");
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { dateOfBirth: parsed },
      select: { dateOfBirth: true }
    });

    return { dateOfBirth: updated.dateOfBirth?.toISOString().slice(0, 10) ?? null };
  }

  /**
   * Sets the signed-in user's recovery email. Accounts created before this
   * existed have `email: null`, which makes requestPasswordReset a silent no-op
   * — so for those users this endpoint is the only thing standing between a
   * forgotten password and a support ticket.
   *
   * Audited, unlike date of birth: changing the recovery address changes who can
   * take the account over, so it belongs in the trail next to suspensions.
   */
  async setMyEmail(context: AuthenticatedRequestContext, rawEmail: string) {
    const userId = context.userId;
    if (!userId) {
      throw new BadRequestException("You must be signed in to update your profile.");
    }

    const email = normalizeEmail(rawEmail);
    const existing = await this.db.user.findFirst({
      where: { email, NOT: { id: userId } },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictException("That email address is already linked to another account.");
    }

    const previous = await this.db.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    let updated: { email: string | null };
    try {
      updated = await this.db.user.update({
        where: { id: userId },
        data: {
          email,
          // Setting an address does not prove the customer owns it. Reset mail is
          // still delivered there — that is the point — but nothing downstream may
          // treat this as a verified address until a confirmation flow exists.
          emailVerifiedAt: null
        },
        select: { email: true }
      });
    } catch (error) {
      // Lost the race against a concurrent signup claiming the same address.
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("That email address is already linked to another account.");
      }

      throw error;
    }

    await this.db.auditLog.create({
      data: {
        ...(context.workspaceId ? { workspaceId: context.workspaceId } : {}),
        actorUserId: userId,
        action: "user.email_changed",
        entityType: "User",
        entityId: userId,
        metadata: { hadPreviousEmail: Boolean(previous?.email) }
      }
    });

    return { email: updated.email };
  }

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

  async getWorkspace(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const workspace = await this.db.workspace.findFirst({
      where: { id: scope.workspaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        defaultCurrency: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!workspace) {
      throw new NotFoundException("Workspace was not found.");
    }

    return workspace;
  }

  // Only `name` is editable. `defaultCurrency` is deliberately NOT settable
  // here: wallets, ledger entries and every minor-unit amount already recorded
  // are denominated in it, so changing it after the fact would silently
  // reinterpret existing balances. It needs its own migration path, not a
  // settings input.
  async updateWorkspace(input: { name?: string }, context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const existing = await this.db.workspace.findFirst({
      where: { id: scope.workspaceId, deletedAt: null },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundException("Workspace was not found.");
    }

    const name = input.name?.trim();

    if (name !== undefined) {
      if (name.length < 2 || name.length > 80) {
        throw new BadRequestException("Workspace name must be between 2 and 80 characters.");
      }
    }

    return this.db.workspace.update({
      where: { id: existing.id },
      data: { ...(name === undefined ? {} : { name }) },
      select: {
        id: true,
        name: true,
        defaultCurrency: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async listOrganizations(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const workspace = await this.db.workspace.findFirst({
      where: { id: scope.workspaceId, deletedAt: null },
      include: { organization: true }
    });

    if (!workspace) {
      throw new NotFoundException("Workspace was not found.");
    }

    const workspaces = await this.db.workspace.findMany({
      where: { organizationId: workspace.organizationId, deletedAt: null }
    });

    return [
      {
        id: workspace.organization.id,
        name: workspace.organization.name,
        slug: workspace.organization.slug,
        region: workspace.organization.region,
        workspaces: workspaces.map((item: any) => ({ id: item.id, name: item.name }))
      }
    ];
  }

  async listTeamMembers(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const workspace = await this.db.workspace.findFirst({
      where: { id: scope.workspaceId, deletedAt: null }
    });

    if (!workspace) {
      throw new NotFoundException("Workspace was not found.");
    }

    const members = await this.db.teamMember.findMany({
      where: { organizationId: workspace.organizationId, deletedAt: null },
      include: { user: true }
    });

    return members.map((member: any) => ({
      id: member.id,
      name: member.user.displayName ?? member.user.name,
      role: member.role,
      permissions: member.permissions
    }));
  }

  async inviteTeamMember(
    input: { username: string; role: string },
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireWorkspaceContext(context);
    const username = input.username?.trim();

    if (!username) {
      throw new BadRequestException("A username is required.");
    }

    const validRoles = ["ADMIN", "MANAGER", "MARKETER", "FINANCE", "SUPPORT", "VIEWER"];
    if (!validRoles.includes(input.role)) {
      throw new BadRequestException("A valid role is required.");
    }

    const workspace = await this.db.workspace.findFirst({
      where: { id: scope.workspaceId, deletedAt: null }
    });
    if (!workspace) {
      throw new NotFoundException("Workspace was not found.");
    }

    const invitee = await this.db.user.findFirst({
      where: { username, deletedAt: null, status: "ACTIVE" }
    });
    if (!invitee) {
      throw new NotFoundException("No active user was found with that username.");
    }

    const existing = await this.db.teamMember.findFirst({
      where: { userId: invitee.id, organizationId: workspace.organizationId, deletedAt: null }
    });
    if (existing) {
      throw new ConflictException("That user is already a member of this workspace.");
    }

    const member = await this.db.teamMember.create({
      data: {
        userId: invitee.id,
        organizationId: workspace.organizationId,
        role: input.role,
        invitedByUserId: scope.userId
      },
      include: { user: true }
    });

    await this.notificationsService.send({
      workspaceId: scope.workspaceId,
      userId: invitee.id,
      channels: ["IN_APP"],
      content: {
        title: "You were added to a workspace",
        body: `You've been added to ${workspace.name} as ${input.role.toLowerCase()}.`
      },
      entityType: "TeamMember",
      entityId: member.id,
      idempotencyKey: `team_invite:${member.id}`
    });

    return {
      id: member.id,
      name: member.user.displayName ?? member.user.name,
      role: member.role,
      permissions: member.permissions
    };
  }

  async updateTeamMemberRole(
    memberId: string,
    role: string,
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireWorkspaceContext(context);
    const validRoles = ["ADMIN", "MANAGER", "MARKETER", "FINANCE", "SUPPORT", "VIEWER"];
    if (!validRoles.includes(role)) {
      throw new BadRequestException("A valid role is required.");
    }

    const workspace = await this.db.workspace.findFirst({
      where: { id: scope.workspaceId, deletedAt: null }
    });
    if (!workspace) {
      throw new NotFoundException("Workspace was not found.");
    }

    const member = await this.db.teamMember.findFirst({
      where: { id: memberId, organizationId: workspace.organizationId, deletedAt: null }
    });
    if (!member) {
      throw new NotFoundException("Team member was not found.");
    }
    if (member.role === "OWNER") {
      throw new ForbiddenException("The workspace owner's role cannot be changed here.");
    }

    return this.db.teamMember.update({
      where: { id: member.id },
      data: { role }
    });
  }

  async removeTeamMember(memberId: string, context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const workspace = await this.db.workspace.findFirst({
      where: { id: scope.workspaceId, deletedAt: null }
    });
    if (!workspace) {
      throw new NotFoundException("Workspace was not found.");
    }

    const member = await this.db.teamMember.findFirst({
      where: { id: memberId, organizationId: workspace.organizationId, deletedAt: null }
    });
    if (!member) {
      throw new NotFoundException("Team member was not found.");
    }
    if (member.role === "OWNER") {
      throw new ForbiddenException("The workspace owner cannot be removed.");
    }

    await this.db.teamMember.update({
      where: { id: member.id },
      data: { deletedAt: new Date() }
    });

    return { ok: true };
  }

  async listTeamProjects(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const campaigns = await this.db.campaign.findMany({
      where: { workspaceId: scope.workspaceId, deletedAt: null },
      include: {
        assignments: {
          where: { status: "ACTIVE", deletedAt: null },
          include: { assignee: true }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 20
    });

    return campaigns
      .filter((campaign: any) => campaign.assignments.length > 0)
      .map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        members: campaign.assignments.map((assignment: any) => ({
          id: assignment.id,
          name: assignment.assignee.displayName ?? assignment.assignee.name,
          role: assignment.role,
          dueAt: assignment.dueAt,
          completedAt: assignment.completedAt
        }))
      }));
  }

  async listTeamApprovals(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);
    const campaigns = await this.db.campaign.findMany({
      where: {
        workspaceId: scope.workspaceId,
        deletedAt: null,
        status: { in: ["PENDING_REVIEW", "CHANGES_REQUESTED"] }
      },
      orderBy: { updatedAt: "desc" },
      take: 20
    });

    return campaigns.map((campaign: any) => ({
      id: campaign.id,
      title: campaign.name,
      status: campaign.status,
      updatedAt: campaign.updatedAt
    }));
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

    if (!legacyMockProvidersAllowed()) {
      return [];
    }

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

  // createSmmOrder / quoteSmmOrder were removed together with the /smm/quote
  // and /smm/orders routes — they placed real supplier orders through
  // this.smmOrders (an in-memory array), with no ledger entry and no
  // persisted row. GrowthOrder is the only real order-placement path;
  // see createGrowthOrder below and
  // migration 20260807070000_drop_dead_smm_order_table.

  listSmmServices() {
    const labels = {
      FOLLOWERS: { label: "Followers", delivery: "2-24 hours" },
      LIKES: { label: "Likes", delivery: "10-120 minutes" },
      VIEWS: { label: "Views", delivery: "10-120 minutes" },
      COMMENTS: { label: "Comments", delivery: "Manual review" },
      SHARES: { label: "Shares", delivery: "1-6 hours" },
      LIVE_VIEWERS: { label: "Live viewers", delivery: "Realtime" },
      CHANNEL_MEMBERS: { label: "Channel members", delivery: "2-48 hours" },
      ACCOUNT_SALE: { label: "Account sale", delivery: "Within 1 hour" },
      VPN_SUBSCRIPTION: { label: "VPN subscription", delivery: "Within 30 minutes" },
      STREAMING_SUBSCRIPTION: { label: "Streaming subscription", delivery: "Within 30 minutes" }
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

  // getSmmOrderStatuses / requestSmmRefill / requestSmmCancel were removed
  // together — see the note above createGrowthOrder-adjacent listSmmServices.

  private listBaseGrowthServices(options?: { includeDisabled?: boolean }) {
    return this.growthServices
      .filter((service) => options?.includeDisabled || service.enabled)
      .map(cloneGrowthService);
  }

  async listGrowthServices(options?: { includeDisabled?: boolean }) {
    const services = this.listBaseGrowthServices({ includeDisabled: true });
    const withOverrides = await this.applyGrowthServiceOverrides(services);

    return withOverrides
      .filter((service) => options?.includeDisabled || service.enabled)
      .map(cloneGrowthService);
  }

  async listAdminGrowthServices(context: AuthenticatedRequestContext | undefined) {
    requireWorkspaceContext(context);

    return this.listGrowthServices({ includeDisabled: true });
  }

  async listGrowthCatalog() {
    const services = await this.listGrowthServices();
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
    const service = await this.requireGrowthService(input.serviceCode);

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
    const isDeliveryContact = service.destinationKind === "DELIVERY_CONTACT";
    const deliveryContact = input.deliveryContact?.trim();

    if (isDeliveryContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryContact ?? "")) {
      throw new BadRequestException(
        "A valid delivery email is required to fulfill this product."
      );
    }

    const destinationUrl = isDeliveryContact
      ? undefined
      : input.destinationUrl?.trim() || getDefaultGrowthDestinationUrl(service);
    const idempotencyKey = input.idempotencyKey?.trim() || id("growth_idempotency");
    const existingRow = await this.db.growthOrder.findUnique({ where: { idempotencyKey } });

    if (existingRow) {
      if (existingRow.workspaceId !== scope.workspaceId) {
        throw new BadRequestException("Idempotency key was already used for another scope.");
      }

      const existingOrder = this.toGrowthOrder(existingRow);
      this.recordGrowthMonitoringEvent({
        workspaceId: scope.workspaceId,
        orderId: existingOrder.id,
        kind: "SUPPLIER_SUBMISSION_SKIPPED_DUPLICATE",
        detail: "Growth order idempotency key reused; returning existing order without supplier execution."
      });

      return {
        order: existingOrder,
        reviewRequired: existingOrder.status === "PENDING" && !existingOrder.supplierReference,
        idempotent: true
      };
    }

    const activeDuplicateRow = await this.db.growthOrder.findFirst({
      where: {
        workspaceId: scope.workspaceId,
        serviceCode: service.code,
        ...(isDeliveryContact
          ? { deliveryContact: { equals: deliveryContact, mode: "insensitive" } }
          : { destinationUrl: { equals: destinationUrl, mode: "insensitive" } }),
        quantityOrdered: quantity,
        status: { in: Array.from(growthActiveStatuses) },
        deletedAt: null
      }
    });

    if (activeDuplicateRow) {
      this.recordGrowthMonitoringEvent({
        workspaceId: scope.workspaceId,
        orderId: activeDuplicateRow.id,
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
      destination: isDeliveryContact
        ? {
            kind: service.destinationKind,
            contactType: "email",
            contactValue: deliveryContact!
          }
        : {
            kind: service.destinationKind,
            url: destinationUrl!
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
    const wallet = await this.getOrCreateGrowthWallet(
      this.db,
      scope.workspaceId,
      pricedQuote.customerPrice.currency
    );
    const expectedCompletionAt = getGrowthExpectedCompletionAt({
      estimatedDeliveryMinutes: pricedQuote.estimatedDeliveryMinutes,
      now: timestamp
    });

    let orderRow: any;

    try {
      orderRow = await this.db.$transaction(async (tx: DbClient) => {
        await this.lockGrowthWallet(tx, wallet.id);
        const reservation = await this.reserveGrowthFundsDb(tx, scope, {
          walletId: wallet.id,
          orderId,
          amountMinor: pricedQuote.customerPrice.amountMinor,
          currency: pricedQuote.customerPrice.currency,
          idempotencyKey
        });

        return tx.growthOrder.create({
          data: {
            id: orderId,
            workspaceId: scope.workspaceId,
            walletId: wallet.id,
            serviceCode: service.code,
            serviceName: service.name,
            platform: service.platform,
            serviceKind: service.serviceKind,
            destinationKind: service.destinationKind,
            destinationUrl,
            ...(deliveryContact ? { deliveryContact } : {}),
            quantityOrdered: quantity,
            quantityDelivered: 0,
            status: "PENDING",
            amountMinor: pricedQuote.customerPrice.amountMinor,
            currency: pricedQuote.customerPrice.currency,
            supplierCostMinor: pricedQuote.supplierCost.amountMinor,
            supplierCostCurrency: pricedQuote.supplierCost.currency,
            grossMarginMinor: pricedQuote.grossMargin.amountMinor,
            expectedCompletionAt: new Date(expectedCompletionAt),
            idempotencyKey,
            paymentStatus: "FUNDS_RESERVED",
            reservationLedgerEntryId: reservation.id,
            refundEligibility: "NONE",
            refundReviewStatus: "NOT_REQUIRED",
            createdByUserId: scope.userId,
            ...(pricedQuote.supplierName ? { supplierName: pricedQuote.supplierName } : {})
          }
        });
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        this.recordGrowthMonitoringEvent({
          workspaceId: scope.workspaceId,
          orderId,
          kind: "UNPAID_EXECUTION_ATTEMPT",
          detail: "Growth supplier execution blocked because wallet funds were unavailable."
        });
        this.recordAuditLog({
          workspaceId: scope.workspaceId,
          actorUserId: scope.userId,
          action: "growth.payment_blocked",
          entityType: "GrowthOrder",
          entityId: orderId,
          metadata: { amountMinor: pricedQuote.customerPrice.amountMinor }
        });
      }

      throw error;
    }

    if (
      fraudAssessment.action === "REVIEW" ||
      service.supplierRouting.strategy === "MANUAL_REVIEW"
    ) {
      const reviewRow = await this.db.growthOrder.update({
        where: { id: orderRow.id },
        data: {
          paymentStatus: "MANUAL_REVIEW",
          refundEligibility: "MANUAL_REVIEW",
          refundReviewStatus: "PENDING"
        }
      });
      const reviewOrder = this.toGrowthOrder(reviewRow);
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

      const updatedRow = await this.db.$transaction(async (tx: DbClient) => {
        await this.lockGrowthWallet(tx, orderRow.walletId);
        const finance = await this.applyGrowthFinancialTransitionDb(tx, scope, orderRow, status);

        return tx.growthOrder.update({
          where: { id: orderRow.id },
          data: {
            status,
            ...finance,
            quantityDelivered: calculateGrowthDeliveredQuantity({
              quantityOrdered: quantity,
              status
            }),
            supplierReference: result.supplierReference,
            submittedAt: new Date(timestamp),
            ...(status === "COMPLETED" ? { completedAt: new Date() } : {})
          }
        });
      });

      this.smmOrders.unshift(submittedSmmOrder);
      this.pushEvent(
        createEvent({
          name: "SMMOrderCreated",
          tenantId: scope.workspaceId,
          payload: { order: submittedSmmOrder }
        })
      );

      return {
        order: this.toGrowthOrder(updatedRow),
        fraudAssessment,
        pricing: pricedQuote,
        reviewRequired: false
      };
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : "Supplier submission failed unexpectedly.";

      const failedRow = await this.db.$transaction(async (tx: DbClient) => {
        await this.lockGrowthWallet(tx, orderRow.walletId);
        const finance = await this.applyGrowthFinancialTransitionDb(tx, scope, orderRow, "FAILED");

        return tx.growthOrder.update({
          where: { id: orderRow.id },
          data: { status: "FAILED", failureReason, ...finance }
        });
      });

      this.recordGrowthMonitoringEvent({
        workspaceId: scope.workspaceId,
        orderId: failedRow.id,
        kind: "SUPPLIER_SUBMISSION_FAILED",
        detail: failureReason
      });

      return {
        order: this.toGrowthOrder(failedRow),
        fraudAssessment,
        pricing: pricedQuote,
        reviewRequired: false
      };
    }
  }

  async listGrowthOrders(context: AuthenticatedRequestContext | undefined): Promise<GrowthOrder[]> {
    const scope = requireWorkspaceContext(context);

    await this.refreshGrowthOrders(scope);

    const rows = await this.db.growthOrder.findMany({
      where: { workspaceId: scope.workspaceId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row: any) => this.toGrowthOrder(row));
  }

  async getGrowthOrder(
    context: AuthenticatedRequestContext | undefined,
    orderId: string
  ): Promise<GrowthOrder> {
    const scope = requireWorkspaceContext(context);

    await this.refreshGrowthOrders(scope);

    const row = await this.db.growthOrder.findFirst({
      where: { id: orderId, workspaceId: scope.workspaceId, deletedAt: null }
    });

    if (!row) {
      throw new NotFoundException("Growth order was not found.");
    }

    return this.toGrowthOrder(row);
  }

  async getGrowthOverview(context: AuthenticatedRequestContext | undefined) {
    const scope = requireWorkspaceContext(context);
    const orders = await this.listGrowthOrders(scope);
    const services = await this.listGrowthServices({ includeDisabled: true });
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
      activeServices: services.filter((service) => service.enabled).length,
      disabledServices: services.filter((service) => !service.enabled).length,
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

  async getGrowthRiskReport() {
    const services = await this.listGrowthServices({ includeDisabled: true });

    return {
      generatedAt: now(),
      disclaimer:
        "Risk levels are operational guidance for Growth Services controls, not legal advice.",
      services: getGrowthServiceRiskReport(services)
    };
  }

  async updateGrowthService(
    context: AuthenticatedRequestContext | undefined,
    serviceCode: string,
    input: UpdateGrowthServiceDto
  ) {
    const scope = requireWorkspaceContext(context);
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
    await this.db.growthServiceOverride.upsert({
      where: { serviceCode },
      create: {
        id: id("gso"),
        serviceCode,
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.marginBps === undefined ? {} : { marginBps: Math.round(input.marginBps) }),
        ...(input.preferredSupplier === undefined
          ? {}
          : { preferredSupplier: input.preferredSupplier || null }),
        ...(input.maximumQuantity === undefined
          ? {}
          : { maximumQuantity: Math.round(input.maximumQuantity) }),
        ...(input.expectedCompletion === undefined
          ? {}
          : { expectedCompletion: input.expectedCompletion }),
        ...(input.adminNote === undefined ? {} : { adminNote: input.adminNote }),
        ...(scope.userId ? { updatedByUserId: scope.userId } : {})
      },
      update: {
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.marginBps === undefined ? {} : { marginBps: Math.round(input.marginBps) }),
        ...(input.preferredSupplier === undefined
          ? {}
          : { preferredSupplier: input.preferredSupplier || null }),
        ...(input.maximumQuantity === undefined
          ? {}
          : { maximumQuantity: Math.round(input.maximumQuantity) }),
        ...(input.expectedCompletion === undefined
          ? {}
          : { expectedCompletion: input.expectedCompletion }),
        ...(input.adminNote === undefined ? {} : { adminNote: input.adminNote }),
        ...(scope.userId ? { updatedByUserId: scope.userId } : {})
      }
    });

    return this.requireGrowthService(serviceCode, { includeDisabled: true });
  }

  async updateGrowthOrder(
    context: AuthenticatedRequestContext | undefined,
    orderId: string,
    input: UpdateGrowthOrderDto
  ): Promise<GrowthOrder> {
    const scope = requireWorkspaceContext(context);
    const nextStatus = normalizeGrowthOrderStatus(input.status);

    const updated = await this.db.$transaction(async (tx: DbClient) => {
      const current = await tx.growthOrder.findFirst({
        where: { id: orderId, workspaceId: scope.workspaceId, deletedAt: null }
      });

      if (!current) {
        throw new NotFoundException("Growth order was not found.");
      }

      if (nextStatus !== undefined) {
        this.assertGrowthStatusTransition(this.toGrowthOrder(current), nextStatus);
      }

      await this.lockGrowthWallet(tx, current.walletId);
      const finance =
        nextStatus === undefined
          ? {}
          : await this.applyGrowthFinancialTransitionDb(tx, scope, current, nextStatus);

      return tx.growthOrder.update({
        where: { id: current.id },
        data: {
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
          ...((nextStatus === "COMPLETED" || nextStatus === "REFUNDED") && !current.completedAt
            ? { completedAt: new Date() }
            : {})
        }
      });
    });

    const growthOrder = this.toGrowthOrder(updated);

    if (nextStatus) {
      this.recordAuditLog({
        workspaceId: scope.workspaceId,
        actorUserId: scope.userId,
        action: `growth.status_${nextStatus.toLowerCase()}`,
        entityType: "GrowthOrder",
        entityId: growthOrder.id,
        metadata: {
          status: nextStatus,
          paymentStatus: growthOrder.paymentStatus ?? null,
          amountMinor: growthOrder.amount.amountMinor
        }
      });
    }

    return growthOrder;
  }

  async getWallet(context?: AuthenticatedRequestContext): Promise<Wallet> {
    const scope = requireWorkspaceContext(context);
    const wallet = await this.getOrCreateGrowthWallet(this.db, scope.workspaceId, "NGN");
    const entries = await this.db.ledgerEntry.findMany({ where: { walletId: wallet.id } });
    const mappedEntries: LedgerEntry[] = entries.map((entry: any) => this.mapDbLedgerEntry(entry));
    const heldMinor = mappedEntries
      .filter((entry) => entry.kind === "HOLD")
      .reduce((total, hold) => {
        const released = mappedEntries.some(
          (entry) =>
            (entry.kind === "RELEASE" || entry.kind === "DEBIT") &&
            entry.sourceId === hold.sourceId &&
            entry.sourceId !== undefined
        );
        return released ? total : total + hold.amount.amountMinor;
      }, 0);

    return {
      id: wallet.id,
      workspaceId: wallet.workspaceId,
      availableBalance: calculateAvailableBalance(mappedEntries),
      heldBalance: { amountMinor: heldMinor, currency: getCurrencyLocal(wallet.currency) },
      createdAt: iso(wallet.createdAt),
      updatedAt: iso(wallet.updatedAt)
    };
  }

  private async getOrCreateGrowthWallet(tx: DbClient, workspaceId: string, currency: string) {
    return tx.wallet.upsert({
      where: { workspaceId_currency: { workspaceId, currency } },
      update: {},
      create: { workspaceId, currency }
    });
  }

  private async lockGrowthWallet(tx: DbClient, walletId: string) {
    if (tx.$queryRaw) {
      await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${walletId} FOR UPDATE`;
    }
  }

  private async assertGrowthWalletCanPay(
    tx: DbClient,
    walletId: string,
    amountMinor: number,
    currency: string
  ) {
    const entries = await tx.ledgerEntry.findMany({ where: { walletId } });
    const balance = calculateAvailableBalance(entries.map((entry: any) => this.mapDbLedgerEntry(entry)));

    if (balance.currency !== currency || balance.amountMinor < amountMinor) {
      throw new BadRequestException(
        "Growth order requires a paid invoice or enough wallet balance to reserve funds."
      );
    }
  }

  private async createGrowthLedgerEntry(tx: DbClient, data: Record<string, any>) {
    if (data.idempotencyKey) {
      return tx.ledgerEntry.upsert({
        where: { idempotencyKey: data.idempotencyKey },
        update: {},
        create: data
      });
    }

    return tx.ledgerEntry.create({ data });
  }

  private mapDbLedgerEntry(entry: any): LedgerEntry {
    return {
      id: entry.id,
      walletId: entry.walletId,
      kind: entry.kind,
      amount: { amountMinor: entry.amountMinor, currency: getCurrencyLocal(entry.currency) },
      reference: entry.reference,
      description: entry.description,
      ...(entry.idempotencyKey ? { idempotencyKey: entry.idempotencyKey } : {}),
      ...(entry.sourceType ? { sourceType: entry.sourceType } : {}),
      ...(entry.sourceId ? { sourceId: entry.sourceId } : {}),
      metadata: entry.metadata ?? {},
      createdAt: iso(entry.createdAt),
      updatedAt: iso(entry.updatedAt)
    };
  }

  private toGrowthOrder(row: any): GrowthOrder {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      serviceCode: row.serviceCode,
      serviceName: row.serviceName,
      platform: row.platform,
      serviceKind: row.serviceKind,
      destinationKind: row.destinationKind,
      destinationUrl: row.destinationUrl,
      ...(row.deliveryContact ? { deliveryContact: row.deliveryContact } : {}),
      quantityOrdered: row.quantityOrdered,
      quantityDelivered: row.quantityDelivered,
      status: row.status,
      amount: { amountMinor: row.amountMinor, currency: getCurrencyLocal(row.currency) },
      supplierCost: {
        amountMinor: row.supplierCostMinor,
        currency: getCurrencyLocal(row.supplierCostCurrency)
      },
      grossMargin: { amountMinor: row.grossMarginMinor, currency: getCurrencyLocal(row.currency) },
      expectedCompletionAt: iso(row.expectedCompletionAt),
      idempotencyKey: row.idempotencyKey,
      paymentStatus: row.paymentStatus,
      ...(row.reservationLedgerEntryId ? { reservationLedgerEntryId: row.reservationLedgerEntryId } : {}),
      ...(row.captureLedgerEntryId ? { captureLedgerEntryId: row.captureLedgerEntryId } : {}),
      ...(row.releaseLedgerEntryId ? { releaseLedgerEntryId: row.releaseLedgerEntryId } : {}),
      ...(row.refundLedgerEntryId ? { refundLedgerEntryId: row.refundLedgerEntryId } : {}),
      refundEligibility: row.refundEligibility,
      refundReviewStatus: row.refundReviewStatus,
      ...(row.submittedAt ? { submittedAt: iso(row.submittedAt) } : {}),
      ...(row.completedAt ? { completedAt: iso(row.completedAt) } : {}),
      ...(row.supplierName ? { supplierName: row.supplierName } : {}),
      ...(row.supplierReference ? { supplierReference: row.supplierReference } : {}),
      ...(row.failureReason ? { failureReason: row.failureReason } : {}),
      ...(row.adminNote ? { adminNote: row.adminNote } : {}),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    };
  }

  async getAnalyticsOverview(context?: AuthenticatedRequestContext) {
    const scope = requireWorkspaceContext(context);

    if (legacyMockProvidersAllowed()) {
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

    const rows = await this.db.analyticsMetric.findMany({
      where: { workspaceId: scope.workspaceId },
      orderBy: { recordedAt: "desc" },
      take: 50
    });
    const metrics: AnalyticsMetric[] = rows.map((row: any) => ({
      workspaceId: row.workspaceId,
      ...(row.campaignId ? { campaignId: row.campaignId } : {}),
      name: row.name,
      value: row.value,
      dimensions: row.dimensions ?? {},
      recordedAt: iso(row.recordedAt)
    }));

    return { metrics, trend: [] };
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

  async search(query = "", context?: AuthenticatedRequestContext) {
    const trimmed = query.trim();

    if (!trimmed) {
      return { query, results: [] };
    }

    const scope = requireWorkspaceContext(context);
    const [campaigns, members, growthOrders, vouchers] = await Promise.all([
      this.db.campaign.findMany({
        where: {
          workspaceId: scope.workspaceId,
          deletedAt: null,
          name: { contains: trimmed, mode: "insensitive" }
        },
        select: { id: true, name: true, status: true },
        take: 8
      }),
      this.db.teamMember.findMany({
        where: {
          deletedAt: null,
          user: { name: { contains: trimmed, mode: "insensitive" } }
        },
        select: { id: true, user: { select: { name: true, displayName: true } } },
        take: 8
      }),
      this.db.growthOrder.findMany({
        where: {
          workspaceId: scope.workspaceId,
          deletedAt: null,
          serviceName: { contains: trimmed, mode: "insensitive" }
        },
        select: { id: true, serviceName: true, status: true },
        take: 8
      }),
      this.db.voucher.findMany({
        where: {
          workspaceId: scope.workspaceId,
          deletedAt: null,
          serialNumber: { contains: trimmed, mode: "insensitive" }
        },
        select: { id: true, serialNumber: true, status: true },
        take: 8
      })
    ]);

    return {
      query,
      results: [
        ...campaigns.map((c: { id: string; name: string; status: string }) => ({
          type: "campaign" as const,
          id: c.id,
          title: c.name,
          meta: c.status
        })),
        ...members.map(
          (m: { id: string; user: { name: string; displayName: string | null } }) => ({
            type: "team" as const,
            id: m.id,
            title: m.user.displayName ?? m.user.name,
            meta: "Team member"
          })
        ),
        ...growthOrders.map((g: { id: string; serviceName: string; status: string }) => ({
          type: "growth_order" as const,
          id: g.id,
          title: g.serviceName,
          meta: g.status
        })),
        ...vouchers.map((v: { id: string; serialNumber: string; status: string }) => ({
          type: "voucher" as const,
          id: v.id,
          title: v.serialNumber,
          meta: v.status
        }))
      ]
    };
  }

  // ─── Admin: users ─────────────────────────────────────────────────────────

  async adminSearchUsers(query: {
    q?: string;
    status?: "ACTIVE" | "SUSPENDED";
    limit?: number;
  }) {
    const term = (query.q ?? "").trim();
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);

    const users = await this.db.user.findMany({
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(term
          ? {
              OR: [
                { username: { contains: term, mode: "insensitive" } },
                { name: { contains: term, mode: "insensitive" } },
                { email: { contains: term, mode: "insensitive" } },
                { id: term }
              ]
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        status: true,
        isPlatformAdmin: true,
        createdAt: true
      }
    });

    return { users, limit };
  }

  async adminGetUser(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        email: true,
        phone: true,
        status: true,
        isPlatformAdmin: true,
        emailVerifiedAt: true,
        totpEnabledAt: true,
        createdAt: true,
        deletedAt: true,
        memberships: {
          select: {
            role: true,
            workspace: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    return user;
  }

  /**
   * Suspend or reactivate an account. Suspension is already enforced everywhere
   * that matters — login rejects a non-ACTIVE user and session resolution
   * filters on `status: ACTIVE`, so existing sessions stop working too.
   *
   * Restricted to ACTIVE/SUSPENDED on purpose: UserStatus also has DELETED,
   * but that is account deletion rather than a moderation action and is not
   * something this endpoint should perform.
   */
  async adminSetUserStatus(
    userId: string,
    status: "ACTIVE" | "SUSPENDED",
    reason: string,
    context?: Partial<AuthenticatedRequestContext>
  ) {
    if (status !== "ACTIVE" && status !== "SUSPENDED") {
      throw new BadRequestException("status must be ACTIVE or SUSPENDED.");
    }

    const trimmedReason = (reason ?? "").trim();
    if (trimmedReason.length < 3) {
      throw new BadRequestException("A reason is required when changing an account's status.");
    }

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, isPlatformAdmin: true, username: true }
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    // Two lockout guards: an operator cannot suspend themselves, and cannot
    // suspend another platform admin. Admin status is granted by the
    // PLATFORM_ADMIN_USERNAMES env var, so an admin locked out this way could
    // not be restored from inside the product.
    if (status === "SUSPENDED") {
      if (context?.userId && context.userId === userId) {
        throw new BadRequestException("You cannot suspend your own account.");
      }
      if (user.isPlatformAdmin) {
        throw new BadRequestException(
          "Platform admins cannot be suspended here — revoke the account from PLATFORM_ADMIN_USERNAMES first."
        );
      }
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, username: true, status: true }
    });

    await this.db.auditLog.create({
      data: {
        ...(context?.workspaceId ? { workspaceId: context.workspaceId } : {}),
        ...(context?.userId ? { actorUserId: context.userId } : {}),
        action: status === "SUSPENDED" ? "user.suspended" : "user.reactivated",
        entityType: "User",
        entityId: userId,
        metadata: {
          reason: trimmedReason,
          previousStatus: user.status,
          username: user.username
        }
      }
    });

    return updated;
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

  /**
   * Reads durable AuditLog rows first, falling back to (and merging with) the
   * process-local list. Before this read the console only ever showed in-memory
   * entries, so audit rows written straight to the database — provider changes,
   * pricing rules, wallet adjustments, digital access — were invisible.
   */
  async listAuditLogsFromStore(
    context?: AuthenticatedRequestContext,
    limit = 100
  ): Promise<AuditLog[]> {
    const scope = requireWorkspaceContext(context);

    const rows = this.db.auditLog
      ? await this.db.auditLog.findMany({
          where: { workspaceId: scope.workspaceId },
          orderBy: { createdAt: "desc" },
          take: Math.min(Math.max(limit, 1), 500)
        })
      : [];

    const persisted: AuditLog[] = rows.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      ...(row.actorUserId ? { actorUserId: row.actorUserId } : {}),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata ?? {},
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt ?? row.createdAt)
    }));

    const seen = new Set(persisted.map((entry) => `${entry.action}:${entry.entityId}`));
    const memoryOnly = this.listAuditLogs(context).filter(
      (entry) => !seen.has(`${entry.action}:${entry.entityId}`)
    );

    return [...persisted, ...memoryOnly];
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

    // The in-memory list above is process-local: it is lost on restart and not
    // shared between API instances. Growth captures, releases and refunds are
    // recorded through here, so without a durable row a money movement would
    // have no audit trail. Fire-and-forget — an audit write must never fail the
    // transaction that triggered it.
    void this.db.auditLog
      ?.create({
        data: {
          workspaceId: input.workspaceId,
          ...(input.actorUserId === undefined ? {} : { actorUserId: input.actorUserId }),
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          metadata: (input.metadata ?? {}) as never
        }
      })
      ?.catch(() => undefined);
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

  private async reserveGrowthFundsDb(
    tx: DbClient,
    scope: AuthenticatedRequestContext,
    input: { walletId: string; orderId: string; amountMinor: number; currency: string; idempotencyKey: string }
  ) {
    await this.assertGrowthWalletCanPay(tx, input.walletId, input.amountMinor, input.currency);

    const reservation = await this.createGrowthLedgerEntry(tx, {
      walletId: input.walletId,
      kind: "HOLD",
      amountMinor: input.amountMinor,
      currency: input.currency,
      reference: `growth_hold:${input.orderId}`,
      description: "Growth Services funds reserved before supplier execution",
      idempotencyKey: `growth:${input.idempotencyKey}:reserve`,
      sourceType: "GrowthOrder",
      sourceId: input.orderId
    });

    this.recordAuditLog({
      workspaceId: scope.workspaceId,
      actorUserId: scope.userId,
      action: "growth.funds_reserved",
      entityType: "GrowthOrder",
      entityId: input.orderId,
      metadata: { amountMinor: input.amountMinor, ledgerEntryId: reservation.id }
    });

    return reservation;
  }

  private async releaseGrowthFundsDb(
    tx: DbClient,
    scope: AuthenticatedRequestContext,
    order: any,
    reason: string
  ) {
    const release = await this.createGrowthLedgerEntry(tx, {
      walletId: order.walletId,
      kind: "RELEASE",
      amountMinor: order.amountMinor,
      currency: order.currency,
      reference: `growth_release:${order.id}`,
      description: `Growth Services funds released: ${reason}`,
      idempotencyKey: `growth:${order.idempotencyKey}:release`,
      sourceType: "GrowthOrder",
      sourceId: order.id
    });

    this.recordAuditLog({
      workspaceId: scope.workspaceId,
      action: "growth.funds_released",
      entityType: "GrowthOrder",
      entityId: order.id,
      metadata: { amountMinor: order.amountMinor, ledgerEntryId: release.id, reason }
    });

    return release;
  }

  private async captureGrowthFundsDb(
    tx: DbClient,
    scope: AuthenticatedRequestContext,
    order: any
  ) {
    const release = await this.createGrowthLedgerEntry(tx, {
      walletId: order.walletId,
      kind: "RELEASE",
      amountMinor: order.amountMinor,
      currency: order.currency,
      reference: `growth_capture_release:${order.id}`,
      description: "Growth Services hold released for capture",
      idempotencyKey: `growth:${order.idempotencyKey}:capture_release`,
      sourceType: "GrowthOrder",
      sourceId: order.id
    });
    const capture = await this.createGrowthLedgerEntry(tx, {
      walletId: order.walletId,
      kind: "DEBIT",
      amountMinor: order.amountMinor,
      currency: order.currency,
      reference: `growth_capture:${order.id}`,
      description: "Growth Services supplier fulfillment captured",
      idempotencyKey: `growth:${order.idempotencyKey}:capture`,
      sourceType: "GrowthOrder",
      sourceId: order.id
    });

    this.recordAuditLog({
      workspaceId: scope.workspaceId,
      action: "growth.funds_captured",
      entityType: "GrowthOrder",
      entityId: order.id,
      metadata: {
        amountMinor: order.amountMinor,
        releaseLedgerEntryId: release.id,
        captureLedgerEntryId: capture.id
      }
    });

    return { release, capture };
  }

  private async refundGrowthOrderDb(
    tx: DbClient,
    scope: AuthenticatedRequestContext,
    order: any,
    reason: string
  ) {
    if (order.paymentStatus !== "FUNDS_CAPTURED") {
      return this.releaseGrowthFundsDb(tx, scope, order, reason);
    }

    const refund = await this.createGrowthLedgerEntry(tx, {
      walletId: order.walletId,
      kind: "REVERSAL",
      amountMinor: order.amountMinor,
      currency: order.currency,
      reference: `growth_refund:${order.id}`,
      description: `Growth Services refund: ${reason}`,
      idempotencyKey: `growth:${order.idempotencyKey}:refund`,
      sourceType: "GrowthOrder",
      sourceId: order.id
    });

    this.recordAuditLog({
      workspaceId: scope.workspaceId,
      action: "growth.refund_recorded",
      entityType: "GrowthOrder",
      entityId: order.id,
      metadata: { amountMinor: order.amountMinor, ledgerEntryId: refund.id, reason }
    });

    return refund;
  }

  private async applyGrowthFinancialTransitionDb(
    tx: DbClient,
    scope: AuthenticatedRequestContext,
    order: any,
    status: GrowthOrderStatus
  ) {
    if (status === "COMPLETED") {
      const { release, capture } = await this.captureGrowthFundsDb(tx, scope, order);

      return {
        paymentStatus: "FUNDS_CAPTURED" as const,
        refundEligibility: "NONE" as const,
        refundReviewStatus: "NOT_REQUIRED" as const,
        releaseLedgerEntryId: release.id,
        captureLedgerEntryId: capture.id
      };
    }

    if (status === "FAILED") {
      const release = await this.releaseGrowthFundsDb(tx, scope, order, "supplier_failure");

      return {
        paymentStatus: "FUNDS_RELEASED" as const,
        refundEligibility: "AUTOMATIC" as const,
        refundReviewStatus: "NOT_REQUIRED" as const,
        releaseLedgerEntryId: release.id
      };
    }

    if (status === "REFUNDED") {
      const wasCaptured = order.paymentStatus === "FUNDS_CAPTURED";
      const refund = await this.refundGrowthOrderDb(tx, scope, order, "manual_or_supplier_refund");

      return {
        paymentStatus: "REFUNDED" as const,
        refundEligibility: "AUTOMATIC" as const,
        refundReviewStatus: "APPROVED" as const,
        ...(wasCaptured ? { refundLedgerEntryId: refund.id } : { releaseLedgerEntryId: refund.id })
      };
    }

    return {};
  }

  private async requireGrowthService(
    serviceCode?: string,
    options?: { includeDisabled?: boolean }
  ) {
    const services = await this.listGrowthServices({ includeDisabled: options?.includeDisabled ?? true });
    const service =
      services.find((item) => item.code === serviceCode) ?? services[0];

    if (!service) {
      throw new NotFoundException("Growth Services catalog is empty.");
    }

    return service;
  }

  private async applyGrowthServiceOverrides(services: GrowthServiceCatalogItem[]) {
    const overrides = await this.db.growthServiceOverride.findMany({
      where: { serviceCode: { in: services.map((service) => service.code) } }
    });
    const overrideByCode = new Map(
      (overrides as GrowthServiceOverrideRow[]).map((override) => [override.serviceCode, override])
    );

    return services.map((service) => {
      const override = overrideByCode.get(service.code);

      if (!override) {
        return cloneGrowthService(service);
      }

      const input = {
        ...(override.enabled === null ? {} : { enabled: override.enabled }),
        ...(override.marginBps === null ? {} : { marginBps: override.marginBps }),
        preferredSupplier: override.preferredSupplier ?? "",
        ...(override.maximumQuantity === null ? {} : { maximumQuantity: override.maximumQuantity }),
        ...(override.expectedCompletion === null
          ? {}
          : { expectedCompletion: override.expectedCompletion }),
        ...(override.adminNote === null ? {} : { adminNote: override.adminNote })
      };

      return applyGrowthServiceAdminControls(service, input);
    });
  }

  private async refreshGrowthOrders(context: AuthenticatedRequestContext) {
    const orderRows = await this.db.growthOrder.findMany({
      where: {
        workspaceId: context.workspaceId,
        deletedAt: null,
        supplierReference: { not: null },
        status: { notIn: ["COMPLETED", "FAILED", "REFUNDED"] }
      }
    });
    const timestampMs = Date.now();

    for (const order of orderRows) {
      if (new Date(order.expectedCompletionAt).getTime() < timestampMs) {
        this.recordGrowthMonitoringEvent({
          workspaceId: context.workspaceId,
          orderId: order.id,
          kind: "FULFILLMENT_DELAY",
          detail: "Growth supplier order is past the expected completion timestamp."
        });
      }
    }

    const supplierReferences = orderRows
      .map((order: any) => order.supplierReference)
      .filter((reference: string | null): reference is string => Boolean(reference));

    if (supplierReferences.length === 0) {
      return;
    }

    try {
      const snapshots = await this.smmSupplier.getOrderStatuses(supplierReferences);

      for (const snapshot of snapshots) {
        const current = orderRows.find(
          (order: any) => order.supplierReference === snapshot.supplierReference
        );

        if (!current) {
          continue;
        }

        const status = mapSmmOrderStatusToGrowthStatus(snapshot.status);

        await this.db.$transaction(async (tx: DbClient) => {
          await this.lockGrowthWallet(tx, current.walletId);
          const finance = await this.applyGrowthFinancialTransitionDb(tx, context, current, status);

          return tx.growthOrder.update({
            where: { id: current.id },
            data: {
              status,
              ...finance,
              quantityDelivered: calculateGrowthDeliveredQuantity({
                quantityOrdered: current.quantityOrdered,
                status,
                ...(snapshot.remains === undefined ? {} : { remains: snapshot.remains })
              }),
              ...(status === "COMPLETED" && !current.completedAt ? { completedAt: new Date() } : {})
            }
          });
        });

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
      for (const order of orderRows) {
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
