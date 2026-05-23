import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";

import { Prisma, type DatabaseClient } from "@fliptrybe/database";
import {
  createDigitalAccessAutomationJob,
  createEvent,
  type DigitalAccessAutomationJob,
  type PlatformEvent
} from "@fliptrybe/events";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import {
  assertDigitalAccessStatusTransition,
  assessDigitalAccessAbuse,
  canRequestDigitalAccess,
  getDigitalAccessStartingPrice,
  normalizeDigitalAccessContact
} from "@fliptrybe/service-digital-access";
import { currencies } from "@fliptrybe/types";
import type {
  AuditLog,
  CurrencyCode,
  DigitalAccessCategory,
  DigitalAccessPlan,
  DigitalAccessRefundResult,
  DigitalAccessRequest,
  DigitalAccessRequestStatus,
  DigitalAccessService,
  DigitalAccessWalletCharge,
  LedgerEntry,
  Wallet
} from "@fliptrybe/types";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type {
  CreateDigitalAccessRequestDto,
  DigitalAccessCategoryDto,
  DigitalAccessListQueryDto,
  DigitalAccessPlanDto,
  DigitalAccessRequestQueryDto,
  DigitalAccessServiceDto
} from "./digital-access.dtos";

const catalogCurrency: CurrencyCode = "NGN";
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
const toCurrencyCode = (currency: string): CurrencyCode =>
  currencies.includes(currency as CurrencyCode) ? (currency as CurrencyCode) : catalogCurrency;

type DbClient = DatabaseClient | Prisma.TransactionClient;
type DbDigitalAccessStatus = "PENDING" | "PROCESSING" | "FULFILLED" | "CANCELLED" | "FAILED";
type DbWalletChargeStatus = "CHARGED" | "REFUNDED" | "FAILED";

interface DbCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface DbServiceRow {
  id: string;
  name: string;
  category: string;
  slug: string;
  description: string;
  startingPriceMinor: number;
  currency: string;
  deliveryEta: string;
  isActive: boolean;
  isFeatured: boolean;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface DbPlanRow {
  id: string;
  serviceId: string;
  planName: string;
  duration: string;
  priceMinor: number;
  currency: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface DbRequestRow {
  id: string;
  workspaceId: string;
  userId: string | null;
  serviceId: string;
  planId: string;
  contactType: string;
  contactValue: string;
  notes: string | null;
  status: DbDigitalAccessStatus;
  assignedTo: string | null;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface DbWalletChargeRow {
  id: string;
  workspaceId: string;
  walletId: string;
  requestId: string;
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
  status: DbWalletChargeStatus;
  debitLedgerEntryId: string | null;
  refundLedgerEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DbLedgerEntryRow {
  id: string;
  walletId: string;
  kind: "CREDIT" | "DEBIT" | "HOLD" | "RELEASE" | "REVERSAL";
  amountMinor: number;
  currency: string;
  reference: string;
  description: string;
  idempotencyKey: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DbWalletRow {
  id: string;
  workspaceId: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

type ServiceWithPlans = DbServiceRow & { plans: DbPlanRow[] };
type RequestWithRelations = DbRequestRow & {
  service: DbServiceRow;
  plan: DbPlanRow;
  walletCharges: DbWalletChargeRow[];
};

interface RequestContext {
  userId?: string;
  workspaceId?: string;
  organizationId?: string;
  idempotencyKey?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

interface TenantScope {
  userId: string;
  workspaceId: string;
  organizationId: string;
  currency: string;
}

function isEnabled(value: string | undefined) {
  return value?.toLowerCase() === "true" || value === "1";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseLimit(value: number | string | undefined) {
  const parsed = Number(value ?? 24);

  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 24;
}

function toDomainStatus(status: DbDigitalAccessStatus): DigitalAccessRequestStatus {
  return status.toLowerCase() as DigitalAccessRequestStatus;
}

function toPrismaStatus(status: DigitalAccessRequestStatus): DbDigitalAccessStatus {
  return status.toUpperCase() as DbDigitalAccessStatus;
}

function toDateString(value: Date) {
  return value.toISOString();
}

@Injectable()
export class DigitalAccessHubService {
  private readonly events: PlatformEvent[] = [];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueProducer?: QueueProducerService
  ) {}

  async listCategories() {
    this.ensureDigitalAccessEnabled();
    const categories = await this.db.digitalAccessCategory.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        services: {
          some: {
            isActive: true,
            deletedAt: null,
            plans: {
              some: {
                isActive: true,
                deletedAt: null,
                currency: catalogCurrency,
                priceMinor: { gt: 0 }
              }
            }
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    return categories.map((category) => this.toCategory(category));
  }

  async listServices(query: DigitalAccessListQueryDto = {}) {
    this.ensureDigitalAccessEnabled();

    return this.paginateServices(query, true);
  }

  async getService(slug: string) {
    this.ensureDigitalAccessEnabled();
    const service = await this.db.digitalAccessService.findFirst({
      where: {
        slug,
        isActive: true,
        deletedAt: null,
        plans: {
          some: {
            isActive: true,
            deletedAt: null,
            currency: catalogCurrency,
            priceMinor: { gt: 0 }
          }
        }
      },
      include: {
        plans: { where: { isActive: true, deletedAt: null }, orderBy: { createdAt: "asc" } }
      }
    });

    if (!service) {
      throw new BadRequestException("Digital Access service is not available.");
    }

    return this.withPlans(service, true);
  }

  async createRequest(input: CreateDigitalAccessRequestDto, context: RequestContext = {}) {
    this.ensureDigitalAccessEnabled();
    const requestedScope = this.requireTenantContext(context);
    const idempotencyKey =
      input.idempotencyKey?.trim() || context.idempotencyKey?.trim() || id("da_idempotency");

    const result = await this.db.$transaction(
      async (tx) => {
        const scope = await this.resolveTenantScope(tx, requestedScope);
        const existing = await tx.digitalAccessRequest.findUnique({
          where: { idempotencyKey },
          include: { service: true, plan: true, walletCharges: true }
        });

        if (existing) {
          if (existing.userId !== scope.userId || existing.workspaceId !== scope.workspaceId) {
            throw new BadRequestException("Idempotency key was already used for another scope.");
          }

          const charge = existing.walletCharges[0];

          return {
            request: this.toRequest(existing, charge?.id),
            ...(charge ? { walletCharge: this.toWalletCharge(charge) } : {}),
            idempotent: true
          };
        }

        const service = await this.resolveService(tx, input);
        const plan = await this.resolvePlan(tx, input.planId);

        if (
          plan.serviceId !== service.id ||
          !canRequestDigitalAccess(this.toService(service), this.toPlan(plan))
        ) {
          throw new BadRequestException("This Digital Access plan is not available for requests.");
        }

        const contactValue = normalizeDigitalAccessContact(input.contactType, input.contactValue);
        const recentRequests = await tx.digitalAccessRequest.findMany({
          where: {
            workspaceId: scope.workspaceId,
            deletedAt: null,
            OR: [{ userId: scope.userId }, { serviceId: service.id }, { contactValue }]
          },
          include: { service: true, plan: true, walletCharges: true },
          orderBy: { createdAt: "desc" },
          take: 50
        });
        const abuseAssessment = assessDigitalAccessAbuse({
          userId: scope.userId,
          serviceId: service.id,
          contactValue,
          requests: recentRequests.map((request) =>
            this.toRequest(request, request.walletCharges[0]?.id)
          )
        });

        if (!abuseAssessment.allowed) {
          throw new BadRequestException({
            message: "Digital Access request needs review before another submission.",
            signals: abuseAssessment.signals,
            reason: abuseAssessment.reason
          });
        }

        const wallet = await this.getOrCreateWallet(tx, scope.workspaceId, plan.currency);
        await this.lockWallet(tx, wallet.id);
        await this.assertWalletCanPay(tx, wallet.id, {
          amountMinor: plan.priceMinor,
          currency: plan.currency
        });

        const metadata = this.cleanMetadata({
          riskScore: abuseAssessment.score,
          signals: abuseAssessment.signals,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          deviceId: context.deviceId
        });
        const request = await tx.digitalAccessRequest.create({
          data: {
            workspaceId: scope.workspaceId,
            userId: scope.userId,
            serviceId: service.id,
            planId: plan.id,
            contactType: input.contactType,
            contactValue,
            ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
            status: "PENDING",
            amountMinor: plan.priceMinor,
            currency: plan.currency,
            idempotencyKey,
            metadata
          },
          include: { service: true, plan: true, walletCharges: true }
        });
        const debit = await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            kind: "DEBIT",
            amountMinor: plan.priceMinor,
            currency: plan.currency,
            reference: `digital_access:${request.id}`,
            description: `Digital Access request: ${service.name} - ${plan.planName}`,
            idempotencyKey: `digital_access:debit:${idempotencyKey}`,
            sourceType: "DigitalAccessRequest",
            sourceId: request.id,
            metadata
          }
        });
        const charge = await tx.digitalAccessWalletCharge.create({
          data: {
            workspaceId: scope.workspaceId,
            walletId: wallet.id,
            requestId: request.id,
            idempotencyKey,
            amountMinor: plan.priceMinor,
            currency: plan.currency,
            status: "CHARGED",
            debitLedgerEntryId: debit.id,
            metadata
          }
        });

        await this.writeAudit(
          tx,
          scope,
          "digital_access.request.created",
          "DigitalAccessRequest",
          request.id,
          {
            serviceId: service.id,
            planId: plan.id,
            riskScore: abuseAssessment.score
          }
        );
        await this.queueSideEffects(tx, scope.workspaceId, "created", request, service, plan);

        const domainRequest = this.toRequest({ ...request, walletCharges: [charge] }, charge.id);
        this.pushEvent(scope.workspaceId, "DigitalAccessRequestCreated", {
          request: this.sanitizeRequest(domainRequest)
        });

        return {
          request: domainRequest,
          walletCharge: this.toWalletCharge(charge),
          abuseAssessment,
          idempotent: false
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!result.idempotent) {
      await this.enqueueAutomationJob(
        createDigitalAccessAutomationJob({
          kind: "request_created",
          workspaceId: result.request.workspaceId,
          requestId: result.request.id,
          ...(result.request.userId ? { userId: result.request.userId } : {}),
          serviceId: result.request.serviceId,
          planId: result.request.planId,
          nextStatus: result.request.status,
          amountMinor: result.request.amount.amountMinor,
          currency: result.request.amount.currency,
          idempotencyKey: `digital_access:request_created:${result.request.id}`
        })
      );
    }

    return result;
  }

  async listRequests(context: AuthenticatedRequestContext) {
    this.ensureDigitalAccessEnabled();
    const scope = await this.resolveTenantScope(this.db, context);
    const requests = await this.db.digitalAccessRequest.findMany({
      where: { userId: scope.userId, workspaceId: scope.workspaceId, deletedAt: null },
      include: { service: true, plan: true, walletCharges: true },
      orderBy: { createdAt: "desc" }
    });

    return requests.map((request) => this.toRequest(request, request.walletCharges[0]?.id));
  }

  async getRequest(requestId: string, context: AuthenticatedRequestContext) {
    this.ensureDigitalAccessEnabled();
    const scope = await this.resolveTenantScope(this.db, context);
    const request = await this.getStoredRequest(requestId, this.db, scope.workspaceId);

    if (request.userId !== scope.userId) {
      throw new BadRequestException("Digital Access request was not found.");
    }

    return this.toRequest(request, request.walletCharges[0]?.id);
  }

  async getWallet(context: AuthenticatedRequestContext) {
    this.ensureDigitalAccessEnabled();
    const scope = await this.resolveTenantScope(this.db, context);
    const wallet = await this.getOrCreateWallet(this.db, scope.workspaceId, scope.currency);
    const entries = await this.db.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "asc" }
    });

    return this.toWallet(wallet, entries);
  }

  async getAdminOverview(context: AuthenticatedRequestContext) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);
    const [
      totals,
      fulfilled,
      activeServices,
      draftServices,
      notifications,
      analytics,
      recentRequests
    ] = await Promise.all([
      this.db.digitalAccessRequest.groupBy({
        by: ["status"],
        where: { workspaceId: scope.workspaceId, deletedAt: null },
        _count: { _all: true }
      }),
      this.db.digitalAccessRequest.findMany({
        where: { workspaceId: scope.workspaceId, status: "FULFILLED", deletedAt: null },
        select: { amountMinor: true, currency: true }
      }),
      this.db.digitalAccessService.count({ where: { isActive: true, deletedAt: null } }),
      this.db.digitalAccessService.count({ where: { isActive: false, deletedAt: null } }),
      this.db.notification.count({
        where: { workspaceId: scope.workspaceId, title: { contains: "Digital Access" } }
      }),
      this.db.analyticsMetric.count({
        where: { workspaceId: scope.workspaceId, name: { startsWith: "digital_access." } }
      }),
      this.db.digitalAccessRequest.findMany({
        where: { workspaceId: scope.workspaceId, deletedAt: null },
        include: { service: true, plan: true, walletCharges: true },
        orderBy: { createdAt: "desc" },
        take: 8
      })
    ]);
    const totalMap = {
      pending: 0,
      processing: 0,
      fulfilled: 0,
      cancelled: 0,
      failed: 0
    } satisfies Record<DigitalAccessRequestStatus, number>;

    totals.forEach((item) => {
      totalMap[toDomainStatus(item.status)] = item._count._all;
    });

    return {
      enabled: this.isDigitalAccessEnabled(),
      adminEnabled: this.isAdminEnabled(),
      totals: totalMap,
      revenue: {
        amountMinor: fulfilled.reduce((sum, request) => sum + request.amountMinor, 0),
        currency: fulfilled[0]?.currency ?? scope.currency
      },
      activeServices,
      draftServices,
      queuedNotifications: notifications,
      queuedAnalytics: analytics,
      topCategories: await this.getTopCategories(scope.workspaceId),
      recentRequests: recentRequests.map((request) =>
        this.sanitizeRequest(this.toRequest(request, request.walletCharges[0]?.id))
      )
    };
  }

  async listAdminCategories(context: AuthenticatedRequestContext) {
    this.ensureAdminEnabled();
    await this.resolveAdminScope(this.db, context);
    const categories = await this.db.digitalAccessCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    return categories.map((category) => this.toCategory(category));
  }

  async createCategory(input: DigitalAccessCategoryDto, context: AuthenticatedRequestContext) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);
    if (!input.name?.trim()) {
      throw new BadRequestException("Category name is required.");
    }

    const category = await this.db.digitalAccessCategory.create({
      data: {
        name: input.name.trim(),
        slug: input.slug?.trim() ? slugify(input.slug) : slugify(input.name),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        sortOrder: input.sortOrder ?? 100,
        isActive: input.isActive ?? true
      }
    });

    await this.writeAudit(
      this.db,
      scope,
      "digital_access.category.created",
      "DigitalAccessCategory",
      category.id,
      {
        slug: category.slug
      }
    );

    return this.toCategory(category);
  }

  async updateCategory(
    categoryId: string,
    input: DigitalAccessCategoryDto,
    context: AuthenticatedRequestContext
  ) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);
    const category = await this.getCategory(categoryId);
    const nextSlug = input.slug?.trim() ? slugify(input.slug) : category.slug;

    return this.db.$transaction(async (tx) => {
      if (nextSlug !== category.slug) {
        await tx.digitalAccessService.updateMany({
          where: { category: category.slug },
          data: { category: nextSlug }
        });
      }

      const updated = await tx.digitalAccessCategory.update({
        where: { id: category.id },
        data: {
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          slug: nextSlug,
          ...(input.description === undefined ? {} : { description: input.description.trim() }),
          sortOrder: input.sortOrder ?? category.sortOrder,
          isActive: input.isActive ?? category.isActive
        }
      });

      await this.writeAudit(
        tx,
        scope,
        "digital_access.category.updated",
        "DigitalAccessCategory",
        updated.id,
        {
          slug: updated.slug
        }
      );

      return this.toCategory(updated);
    });
  }

  async listAdminServices(
    query: DigitalAccessListQueryDto = {},
    context: AuthenticatedRequestContext
  ) {
    this.ensureAdminEnabled();
    await this.resolveAdminScope(this.db, context);

    return this.paginateServices(query, false);
  }

  async createService(input: DigitalAccessServiceDto, context: AuthenticatedRequestContext) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);
    const categorySlug = input.category?.trim();

    if (!input.name?.trim() || !categorySlug || !input.description?.trim()) {
      throw new BadRequestException("Service name, category, and description are required.");
    }
    await this.getCategory(categorySlug);

    const service = await this.db.digitalAccessService.create({
      data: {
        name: input.name.trim(),
        category: categorySlug,
        slug: input.slug?.trim() ? slugify(input.slug) : slugify(input.name),
        description: input.description.trim(),
        startingPriceMinor: input.startingPriceMinor ?? 0,
        currency: catalogCurrency,
        deliveryEta: input.deliveryEta?.trim() ?? "Manual review",
        isActive: input.isActive ?? false,
        isFeatured: input.isFeatured ?? false,
        ...(input.thumbnail?.trim() ? { thumbnail: input.thumbnail.trim() } : {})
      },
      include: { plans: true }
    });

    await this.writeAudit(
      this.db,
      scope,
      "digital_access.service.created",
      "DigitalAccessService",
      service.id,
      {
        slug: service.slug
      }
    );

    return this.withPlans(service, false);
  }

  async updateService(
    serviceId: string,
    input: DigitalAccessServiceDto,
    context: AuthenticatedRequestContext
  ) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);
    const service = await this.getServiceById(serviceId);
    const category = input.category?.trim();

    if (category) {
      await this.getCategory(category);
    }

    const updated = await this.db.digitalAccessService.update({
      where: { id: service.id },
      data: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(category ? { category } : {}),
        ...(input.slug?.trim() ? { slug: slugify(input.slug) } : {}),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        startingPriceMinor: input.startingPriceMinor ?? service.startingPriceMinor,
        deliveryEta: input.deliveryEta?.trim() ?? service.deliveryEta,
        isActive: input.isActive ?? service.isActive,
        isFeatured: input.isFeatured ?? service.isFeatured,
        ...(input.thumbnail?.trim() ? { thumbnail: input.thumbnail.trim() } : {})
      },
      include: { plans: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } }
    });

    await this.writeAudit(
      this.db,
      scope,
      "digital_access.service.updated",
      "DigitalAccessService",
      updated.id,
      {
        slug: updated.slug,
        isActive: updated.isActive
      }
    );

    return this.withPlans(updated, false);
  }

  async listAdminPlans(context: AuthenticatedRequestContext, serviceId?: string) {
    this.ensureAdminEnabled();
    await this.resolveAdminScope(this.db, context);
    const plans = await this.db.digitalAccessPlan.findMany({
      where: { deletedAt: null, ...(serviceId ? { serviceId } : {}) },
      orderBy: { createdAt: "asc" }
    });

    return plans.map((plan) => this.toPlan(plan));
  }

  async createPlan(input: DigitalAccessPlanDto, context: AuthenticatedRequestContext) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);
    if (!input.serviceId || !input.planName?.trim() || !input.duration?.trim()) {
      throw new BadRequestException("Plan service, name, and duration are required.");
    }
    await this.getServiceById(input.serviceId);

    const plan = await this.db.digitalAccessPlan.create({
      data: {
        serviceId: input.serviceId,
        planName: input.planName.trim(),
        duration: input.duration.trim(),
        priceMinor: input.priceMinor ?? 0,
        currency: catalogCurrency,
        description: input.description?.trim() ?? "Owner-managed access plan.",
        isActive: input.isActive ?? false
      }
    });

    await this.refreshServiceStartingPrice(this.db, plan.serviceId);
    await this.writeAudit(
      this.db,
      scope,
      "digital_access.plan.created",
      "DigitalAccessPlan",
      plan.id,
      {
        serviceId: plan.serviceId
      }
    );

    return this.toPlan(plan);
  }

  async updatePlan(
    planId: string,
    input: DigitalAccessPlanDto,
    context: AuthenticatedRequestContext
  ) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);
    const plan = await this.getPlanById(planId);
    const updated = await this.db.digitalAccessPlan.update({
      where: { id: plan.id },
      data: {
        ...(input.planName?.trim() ? { planName: input.planName.trim() } : {}),
        ...(input.duration?.trim() ? { duration: input.duration.trim() } : {}),
        priceMinor: input.priceMinor ?? plan.priceMinor,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        isActive: input.isActive ?? plan.isActive
      }
    });

    await this.refreshServiceStartingPrice(this.db, updated.serviceId);
    await this.writeAudit(
      this.db,
      scope,
      "digital_access.plan.updated",
      "DigitalAccessPlan",
      updated.id,
      {
        serviceId: updated.serviceId,
        isActive: updated.isActive
      }
    );

    return this.toPlan(updated);
  }

  async listAdminRequests(
    query: DigitalAccessRequestQueryDto = {},
    context: AuthenticatedRequestContext
  ) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);

    return this.paginateRequests(query, scope.workspaceId, false);
  }

  async updateRequestStatus(
    requestId: string,
    status: DigitalAccessRequestStatus,
    context: AuthenticatedRequestContext
  ) {
    this.ensureAdminEnabled();
    const requestedScope = this.requireTenantContext(context);

    const outcome = await this.db.$transaction(
      async (tx) => {
        const scope = await this.resolveAdminScope(tx, requestedScope);
        const request = await this.getStoredRequest(requestId, tx, scope.workspaceId);
        const currentStatus = toDomainStatus(request.status);

        try {
          assertDigitalAccessStatusTransition(currentStatus, status);
        } catch (error) {
          throw new BadRequestException(error instanceof Error ? error.message : "Invalid status.");
        }

        let refund: DigitalAccessRefundResult | undefined;

        if (currentStatus !== status && (status === "failed" || status === "cancelled")) {
          refund = await this.refundRequest(tx, request);
          this.pushEvent(scope.workspaceId, "DigitalAccessRequestRefunded", {
            requestId: request.id,
            refund
          });
        }

        const updated = await tx.digitalAccessRequest.update({
          where: { id: request.id },
          data: { status: toPrismaStatus(status) },
          include: { service: true, plan: true, walletCharges: true }
        });

        await this.writeAudit(
          tx,
          scope,
          "digital_access.request.status_updated",
          "DigitalAccessRequest",
          updated.id,
          {
            status
          }
        );
        await this.queueSideEffects(
          tx,
          scope.workspaceId,
          "status_updated",
          updated,
          updated.service,
          updated.plan
        );
        this.pushEvent(scope.workspaceId, "DigitalAccessRequestUpdated", {
          requestId: updated.id,
          status
        });

        const domainRequest = this.toRequest(updated, updated.walletCharges[0]?.id);

        return {
          response: {
            request: domainRequest,
            ...(refund === undefined ? {} : { refund })
          },
          automation: {
            previousStatus: currentStatus,
            nextStatus: status,
            request: domainRequest,
            ...(refund === undefined ? {} : { refund })
          }
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (outcome.automation.previousStatus !== outcome.automation.nextStatus) {
      await this.enqueueAutomationJob(
        createDigitalAccessAutomationJob({
          kind: "status_changed",
          workspaceId: outcome.automation.request.workspaceId,
          requestId: outcome.automation.request.id,
          ...(outcome.automation.request.userId
            ? { userId: outcome.automation.request.userId }
            : {}),
          actorUserId: requestedScope.userId,
          serviceId: outcome.automation.request.serviceId,
          planId: outcome.automation.request.planId,
          previousStatus: outcome.automation.previousStatus,
          nextStatus: outcome.automation.nextStatus,
          amountMinor: outcome.automation.request.amount.amountMinor,
          currency: outcome.automation.request.amount.currency
        })
      );
    }

    if (outcome.automation.refund) {
      await this.enqueueAutomationJob(
        createDigitalAccessAutomationJob({
          kind: "refund_completed",
          workspaceId: outcome.automation.request.workspaceId,
          requestId: outcome.automation.request.id,
          ...(outcome.automation.request.userId
            ? { userId: outcome.automation.request.userId }
            : {}),
          actorUserId: requestedScope.userId,
          serviceId: outcome.automation.request.serviceId,
          planId: outcome.automation.request.planId,
          nextStatus: outcome.automation.request.status,
          amountMinor: outcome.automation.refund.amount.amountMinor,
          currency: outcome.automation.refund.amount.currency,
          idempotencyKey: `digital_access:refund_completed:${outcome.automation.refund.ledgerEntryId ?? outcome.automation.request.id}`
        })
      );
    }

    return outcome.response;
  }

  async assignRequest(
    requestId: string,
    assignedTo: string | null,
    context: AuthenticatedRequestContext
  ) {
    this.ensureAdminEnabled();
    const scope = await this.resolveAdminScope(this.db, context);
    const request = await this.getStoredRequest(requestId, this.db, scope.workspaceId);
    const updated = await this.db.digitalAccessRequest.update({
      where: { id: request.id },
      data: { assignedTo },
      include: { service: true, plan: true, walletCharges: true }
    });

    await this.writeAudit(
      this.db,
      scope,
      "digital_access.request.assigned",
      "DigitalAccessRequest",
      updated.id,
      {
        assignedTo: assignedTo ?? "unassigned"
      }
    );

    return this.toRequest(updated, updated.walletCharges[0]?.id);
  }

  async getRealtimeSnapshot(workspaceId?: string) {
    if (!workspaceId) {
      return {
        requests: [],
        admin: { pending: 0, processing: 0, fulfilled: 0 },
        events: []
      };
    }

    const [requests, pending, processing, fulfilled] = await Promise.all([
      this.db.digitalAccessRequest.findMany({
        where: { workspaceId, deletedAt: null },
        include: { service: true, plan: true, walletCharges: true },
        orderBy: { createdAt: "desc" },
        take: 20
      }),
      this.db.digitalAccessRequest.count({
        where: { workspaceId, status: "PENDING", deletedAt: null }
      }),
      this.db.digitalAccessRequest.count({
        where: { workspaceId, status: "PROCESSING", deletedAt: null }
      }),
      this.db.digitalAccessRequest.count({
        where: { workspaceId, status: "FULFILLED", deletedAt: null }
      })
    ]);

    return {
      requests: requests.map((request) =>
        this.sanitizeRequest(this.toRequest(request, request.walletCharges[0]?.id))
      ),
      admin: { pending, processing, fulfilled },
      events: this.events
        .filter((event) => event.tenantId === workspaceId)
        .map((event) => ({
          id: event.id,
          name: event.name,
          occurredAt: event.occurredAt,
          tenantId: event.tenantId
        }))
    };
  }

  async getAuditLogs(context: AuthenticatedRequestContext) {
    const scope = await this.resolveAdminScope(this.db, context);
    const logs = await this.db.auditLog.findMany({
      where: { workspaceId: scope.workspaceId, action: { startsWith: "digital_access." } },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return logs.map(
      (log): AuditLog => ({
        id: log.id,
        ...(log.workspaceId === null ? {} : { workspaceId: log.workspaceId }),
        ...(log.actorUserId === null ? {} : { actorUserId: log.actorUserId }),
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: this.toRecord(log.metadata),
        createdAt: toDateString(log.createdAt),
        updatedAt: toDateString(log.updatedAt)
      })
    );
  }

  private get db() {
    return this.prismaService.client;
  }

  private async paginateServices(query: DigitalAccessListQueryDto, publicOnly: boolean) {
    const search = query.q?.trim();
    const limit = parseLimit(query.limit);
    const services = await this.db.digitalAccessService.findMany({
      where: {
        deletedAt: null,
        ...(query.category ? { category: query.category } : {}),
        ...(publicOnly
          ? {
              isActive: true,
              plans: {
                some: {
                  isActive: true,
                  deletedAt: null,
                  currency: catalogCurrency,
                  priceMinor: { gt: 0 }
                }
              }
            }
          : {}),
        ...(search
          ? {
              OR: [{ name: { contains: search } }, { description: { contains: search } }]
            }
          : {})
      },
      include: {
        plans: {
          where: publicOnly ? { isActive: true, deletedAt: null } : { deletedAt: null },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1
    });
    const items = services.slice(0, limit);

    return {
      items: items.map((service) => this.withPlans(service, publicOnly)),
      nextCursor: services.length > limit ? (services[limit]?.id ?? null) : null
    };
  }

  private async paginateRequests(
    query: DigitalAccessRequestQueryDto,
    workspaceId: string,
    sanitize = true
  ) {
    const search = query.q?.trim();
    const limit = parseLimit(query.limit);
    const requests = await this.db.digitalAccessRequest.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(query.status ? { status: toPrismaStatus(query.status) } : {}),
        ...(query.category ? { service: { category: query.category } } : {}),
        ...(search
          ? {
              OR: [
                { service: { name: { contains: search } } },
                { plan: { planName: { contains: search } } },
                { contactValue: { contains: search } }
              ]
            }
          : {})
      },
      include: { service: true, plan: true, walletCharges: true },
      orderBy: { createdAt: "desc" },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: limit + 1
    });
    const items = requests.slice(0, limit).map((request) => {
      const mapped = this.toRequest(request, request.walletCharges[0]?.id);

      return sanitize ? this.sanitizeRequest(mapped) : mapped;
    });

    return {
      items,
      nextCursor: requests.length > limit ? (requests[limit]?.id ?? null) : null
    };
  }

  private withPlans(service: ServiceWithPlans, publicOnly: boolean) {
    const plans = service.plans.map((plan) => this.toPlan(plan));
    const domainService = this.toService(service);
    const activePlans = publicOnly ? plans.filter((plan) => plan.isActive) : plans;

    return {
      ...domainService,
      startingPrice: getDigitalAccessStartingPrice(domainService, activePlans),
      plans: activePlans
    };
  }

  private async resolveService(tx: DbClient, input: CreateDigitalAccessRequestDto) {
    const service = await tx.digitalAccessService.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(input.serviceId ? [{ id: input.serviceId }] : []),
          ...(input.serviceSlug ? [{ slug: input.serviceSlug }] : [])
        ]
      }
    });

    if (!service) {
      throw new BadRequestException("Digital Access service was not found.");
    }

    return service;
  }

  private async resolvePlan(tx: DbClient, planId: string) {
    const plan = await tx.digitalAccessPlan.findFirst({ where: { id: planId, deletedAt: null } });

    if (!plan) {
      throw new BadRequestException("Digital Access plan was not found.");
    }

    return plan;
  }

  private async getCategory(idOrSlug: string) {
    const category = await this.db.digitalAccessCategory.findFirst({
      where: { deletedAt: null, OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
    });

    if (!category) {
      throw new BadRequestException("Digital Access category was not found.");
    }

    return category;
  }

  private async getServiceById(serviceId: string) {
    const service = await this.db.digitalAccessService.findFirst({
      where: { id: serviceId, deletedAt: null }
    });

    if (!service) {
      throw new BadRequestException("Digital Access service was not found.");
    }

    return service;
  }

  private async getPlanById(planId: string) {
    const plan = await this.db.digitalAccessPlan.findFirst({
      where: { id: planId, deletedAt: null }
    });

    if (!plan) {
      throw new BadRequestException("Digital Access plan was not found.");
    }

    return plan;
  }

  private async getStoredRequest(requestId: string, db: DbClient = this.db, workspaceId?: string) {
    const request = await db.digitalAccessRequest.findFirst({
      where: { id: requestId, ...(workspaceId ? { workspaceId } : {}), deletedAt: null },
      include: { service: true, plan: true, walletCharges: true }
    });

    if (!request) {
      throw new BadRequestException("Digital Access request was not found.");
    }

    return request;
  }

  private async resolveTenantScope(
    tx: DbClient,
    context: AuthenticatedRequestContext | RequestContext
  ): Promise<TenantScope> {
    const requested = this.requireTenantContext(context);
    const workspace = await tx.workspace.findFirst({
      where: {
        id: requested.workspaceId,
        deletedAt: null,
        organization: { deletedAt: null }
      },
      include: {
        organization: {
          select: {
            id: true,
            members: {
              where: { userId: requested.userId, deletedAt: null },
              select: { role: true, permissions: true },
              take: 1
            }
          }
        }
      }
    });

    if (!workspace || workspace.organization.members.length === 0) {
      throw new ForbiddenException("User is not a member of the active workspace.");
    }

    if (requested.organizationId && requested.organizationId !== workspace.organization.id) {
      throw new ForbiddenException("Workspace does not belong to the requested organization.");
    }

    return {
      userId: requested.userId,
      workspaceId: workspace.id,
      organizationId: workspace.organization.id,
      currency: workspace.defaultCurrency
    };
  }

  private async resolveAdminScope(
    tx: DbClient,
    context: AuthenticatedRequestContext | RequestContext
  ) {
    const requested = this.requireTenantContext(context);
    const workspace = await tx.workspace.findFirst({
      where: {
        id: requested.workspaceId,
        deletedAt: null,
        organization: { deletedAt: null }
      },
      include: {
        organization: {
          select: {
            id: true,
            members: {
              where: { userId: requested.userId, deletedAt: null },
              select: { role: true, permissions: true },
              take: 1
            }
          }
        }
      }
    });
    const membership = workspace?.organization.members[0];

    if (!workspace || !membership) {
      throw new ForbiddenException("User is not a member of the active workspace.");
    }

    if (requested.organizationId && requested.organizationId !== workspace.organization.id) {
      throw new ForbiddenException("Workspace does not belong to the requested organization.");
    }

    if (!this.canManageDigitalAccess(membership)) {
      throw new ForbiddenException("User cannot manage Digital Access for this workspace.");
    }

    return {
      userId: requested.userId,
      workspaceId: workspace.id,
      organizationId: workspace.organization.id,
      currency: workspace.defaultCurrency
    };
  }

  private async getOrCreateWallet(
    tx: DbClient,
    workspaceId: string,
    currency: string
  ): Promise<DbWalletRow> {
    return tx.wallet.upsert({
      where: { workspaceId_currency: { workspaceId, currency } },
      update: {},
      create: { workspaceId, currency }
    });
  }

  private async lockWallet(tx: DbClient, walletId: string) {
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${walletId} FOR UPDATE`;
  }

  private async assertWalletCanPay(
    tx: DbClient,
    walletId: string,
    amount: { amountMinor: number; currency: string }
  ) {
    const entries = await tx.ledgerEntry.findMany({
      where: { walletId },
      orderBy: { createdAt: "asc" }
    });
    const balance = calculateAvailableBalance(entries.map((entry) => this.toLedgerEntry(entry)));

    if (balance.currency !== amount.currency) {
      throw new BadRequestException(
        `Wallet currency ${balance.currency} cannot pay ${amount.currency}.`
      );
    }
    if (balance.amountMinor < amount.amountMinor) {
      throw new BadRequestException("Insufficient wallet balance for Digital Access request.");
    }
  }

  private async refundRequest(tx: Prisma.TransactionClient, request: RequestWithRelations) {
    const charge = request.walletCharges[0];

    if (!charge) {
      throw new BadRequestException("Digital Access wallet charge was not found.");
    }
    if (charge.status === "REFUNDED" && charge.refundLedgerEntryId) {
      return this.toRefund(charge.refundLedgerEntryId, charge);
    }

    await this.lockWallet(tx, charge.walletId);
    const refundLedger = await tx.ledgerEntry.upsert({
      where: { idempotencyKey: `digital_access:refund:${charge.id}` },
      update: {},
      create: {
        walletId: charge.walletId,
        kind: "REVERSAL",
        amountMinor: charge.amountMinor,
        currency: charge.currency,
        reference: `digital_access_refund:${request.id}`,
        description: `Digital Access refund: ${request.service.name} - ${request.plan.planName}`,
        idempotencyKey: `digital_access:refund:${charge.id}`,
        sourceType: "DigitalAccessRequest",
        sourceId: request.id,
        metadata: { requestId: request.id, chargeId: charge.id }
      }
    });
    const updatedCharge = await tx.digitalAccessWalletCharge.update({
      where: { id: charge.id },
      data: {
        status: "REFUNDED",
        refundLedgerEntryId: refundLedger.id
      }
    });

    return this.toRefund(refundLedger.id, updatedCharge);
  }

  private async refreshServiceStartingPrice(tx: DbClient, serviceId: string) {
    const plans = await tx.digitalAccessPlan.findMany({
      where: {
        serviceId,
        isActive: true,
        deletedAt: null,
        currency: catalogCurrency,
        priceMinor: { gt: 0 }
      }
    });
    const startingPriceMinor =
      plans.length === 0 ? 0 : Math.min(...plans.map((plan) => plan.priceMinor));

    await tx.digitalAccessService.update({
      where: { id: serviceId },
      data: { startingPriceMinor, currency: catalogCurrency }
    });
  }

  private async queueSideEffects(
    tx: DbClient,
    workspaceId: string,
    action: string,
    request: DbRequestRow,
    service: DbServiceRow,
    plan: DbPlanRow
  ) {
    await tx.notification.create({
      data: {
        workspaceId,
        channel: "IN_APP",
        title: `Digital Access ${action.replace("_", " ")}`,
        body: `${service.name} / ${plan.planName} request is ${toDomainStatus(request.status)}.`
      }
    });
    await tx.analyticsMetric.create({
      data: {
        workspaceId,
        name: `digital_access.${action}`,
        value: 1,
        dimensions: {
          serviceId: request.serviceId,
          planId: request.planId,
          status: toDomainStatus(request.status),
          amountMinor: request.amountMinor
        }
      }
    });
  }

  private async writeAudit(
    tx: DbClient,
    scope: Pick<TenantScope, "workspaceId" | "userId">,
    action: string,
    entityType: string,
    entityId: string,
    metadata: AuditLog["metadata"]
  ) {
    await tx.auditLog.create({
      data: {
        workspaceId: scope.workspaceId,
        actorUserId: scope.userId,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }

  private async getTopCategories(workspaceId: string) {
    const categories = await this.db.digitalAccessCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: "asc" }
    });
    const counts = await this.db.digitalAccessRequest.groupBy({
      by: ["serviceId"],
      where: { workspaceId, deletedAt: null },
      _count: { _all: true }
    });
    const serviceIds = counts.map((item) => item.serviceId);
    const services = await this.db.digitalAccessService.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, category: true }
    });

    return categories.map((category) => ({
      category: category.slug,
      name: category.name,
      requests: counts
        .filter(
          (count) =>
            services.find((service) => service.id === count.serviceId)?.category === category.slug
        )
        .reduce((sum, count) => sum + count._count._all, 0)
    }));
  }

  private toCategory(category: DbCategoryRow): DigitalAccessCategory {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      ...(category.description === null ? {} : { description: category.description }),
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: toDateString(category.createdAt),
      updatedAt: toDateString(category.updatedAt),
      ...(category.deletedAt === null ? {} : { deletedAt: toDateString(category.deletedAt) })
    };
  }

  private toService(service: DbServiceRow): DigitalAccessService {
    return {
      id: service.id,
      name: service.name,
      category: service.category,
      slug: service.slug,
      description: service.description,
      startingPrice: {
        amountMinor: service.startingPriceMinor,
        currency: toCurrencyCode(service.currency)
      },
      deliveryEta: service.deliveryEta,
      isActive: service.isActive,
      isFeatured: service.isFeatured,
      ...(service.thumbnail === null ? {} : { thumbnail: service.thumbnail }),
      createdAt: toDateString(service.createdAt),
      updatedAt: toDateString(service.updatedAt),
      ...(service.deletedAt === null ? {} : { deletedAt: toDateString(service.deletedAt) })
    };
  }

  private toPlan(plan: DbPlanRow): DigitalAccessPlan {
    return {
      id: plan.id,
      serviceId: plan.serviceId,
      planName: plan.planName,
      duration: plan.duration,
      price: { amountMinor: plan.priceMinor, currency: toCurrencyCode(plan.currency) },
      description: plan.description,
      isActive: plan.isActive,
      createdAt: toDateString(plan.createdAt),
      updatedAt: toDateString(plan.updatedAt),
      ...(plan.deletedAt === null ? {} : { deletedAt: toDateString(plan.deletedAt) })
    };
  }

  private toRequest(request: RequestWithRelations, walletChargeId?: string): DigitalAccessRequest {
    return {
      id: request.id,
      workspaceId: request.workspaceId,
      ...(request.userId === null ? {} : { userId: request.userId }),
      serviceId: request.serviceId,
      planId: request.planId,
      serviceName: request.service.name,
      planName: request.plan.planName,
      contactType: request.contactType === "email" ? "email" : "whatsapp",
      contactValue: request.contactValue,
      ...(request.notes === null ? {} : { notes: request.notes }),
      status: toDomainStatus(request.status),
      ...(request.assignedTo === null ? {} : { assignedTo: request.assignedTo }),
      amount: { amountMinor: request.amountMinor, currency: toCurrencyCode(request.currency) },
      idempotencyKey: request.idempotencyKey,
      ...(walletChargeId === undefined ? {} : { walletChargeId }),
      createdAt: toDateString(request.createdAt),
      updatedAt: toDateString(request.updatedAt),
      ...(request.deletedAt === null ? {} : { deletedAt: toDateString(request.deletedAt) })
    };
  }

  private toWalletCharge(charge: DbWalletChargeRow): DigitalAccessWalletCharge {
    return {
      id: charge.id,
      workspaceId: charge.workspaceId,
      walletId: charge.walletId,
      requestId: charge.requestId,
      idempotencyKey: charge.idempotencyKey,
      amount: { amountMinor: charge.amountMinor, currency: toCurrencyCode(charge.currency) },
      status: charge.status,
      ...(charge.debitLedgerEntryId === null
        ? {}
        : { debitLedgerEntryId: charge.debitLedgerEntryId }),
      ...(charge.refundLedgerEntryId === null
        ? {}
        : { refundLedgerEntryId: charge.refundLedgerEntryId }),
      createdAt: toDateString(charge.createdAt),
      updatedAt: toDateString(charge.updatedAt)
    };
  }

  private toRefund(ledgerEntryId: string, charge: DbWalletChargeRow): DigitalAccessRefundResult {
    return {
      requestId: charge.requestId,
      ledgerEntryId,
      amount: { amountMinor: charge.amountMinor, currency: toCurrencyCode(charge.currency) },
      status: "REFUNDED"
    };
  }

  private toWallet(wallet: DbWalletRow, entries: DbLedgerEntryRow[]): Wallet {
    return {
      id: wallet.id,
      workspaceId: wallet.workspaceId,
      availableBalance: calculateAvailableBalance(
        entries.map((entry) => this.toLedgerEntry(entry))
      ),
      heldBalance: { amountMinor: 0, currency: toCurrencyCode(wallet.currency) },
      createdAt: toDateString(wallet.createdAt),
      updatedAt: toDateString(wallet.updatedAt)
    };
  }

  private toLedgerEntry(entry: DbLedgerEntryRow): LedgerEntry {
    return {
      id: entry.id,
      walletId: entry.walletId,
      kind: entry.kind,
      amount: { amountMinor: entry.amountMinor, currency: toCurrencyCode(entry.currency) },
      reference: entry.reference,
      description: entry.description,
      ...(entry.idempotencyKey === null ? {} : { idempotencyKey: entry.idempotencyKey }),
      ...(entry.sourceType === null ? {} : { sourceType: entry.sourceType }),
      ...(entry.sourceId === null ? {} : { sourceId: entry.sourceId }),
      metadata: {},
      createdAt: toDateString(entry.createdAt),
      updatedAt: toDateString(entry.updatedAt)
    };
  }

  private sanitizeRequest(request: DigitalAccessRequest): DigitalAccessRequest {
    return {
      ...request,
      contactValue:
        request.contactType === "email"
          ? request.contactValue.replace(/(^.).*(@.*$)/, "$1***$2")
          : request.contactValue.replace(/(\+\d{3})\d+(\d{2})$/, "$1***$2")
    };
  }

  private cleanMetadata(metadata: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== undefined)
    ) as Prisma.InputJsonObject;
  }

  private toRecord(value: Prisma.JsonValue): Record<string, string | number | boolean> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1])
      )
    );
  }

  private requireTenantContext(context: {
    userId?: string;
    workspaceId?: string;
    organizationId?: string;
  }) {
    const userId = context.userId?.trim();
    const workspaceId = context.workspaceId?.trim();
    const organizationId = context.organizationId?.trim();

    if (!userId || !workspaceId) {
      throw new BadRequestException(
        "Digital Access requires a logged-in user and active workspace."
      );
    }

    return {
      userId,
      workspaceId,
      ...(organizationId ? { organizationId } : {})
    };
  }

  private canManageDigitalAccess(member: { role: string; permissions: string[] }) {
    return (
      member.role === "OWNER" ||
      member.role === "ADMIN" ||
      member.permissions.includes("admin:access") ||
      member.permissions.includes("digital_access:manage")
    );
  }

  private pushEvent<TEvent extends PlatformEvent["name"]>(
    workspaceId: string,
    name: TEvent,
    payload: Extract<PlatformEvent, { name: TEvent }>["payload"]
  ) {
    this.events.unshift(
      createEvent({
        name,
        tenantId: workspaceId,
        payload
      } as unknown as Omit<Extract<PlatformEvent, { name: TEvent }>, "id" | "occurredAt">)
    );
  }

  private async enqueueAutomationJob(job: DigitalAccessAutomationJob) {
    await this.queueProducer?.enqueueDigitalAccessAutomation(job);
  }

  private isDigitalAccessEnabled() {
    return isEnabled(process.env.ENABLE_DIGITAL_ACCESS);
  }

  private isAdminEnabled() {
    return isEnabled(process.env.ENABLE_DIGITAL_ACCESS_ADMIN);
  }

  private ensureDigitalAccessEnabled() {
    if (!this.isDigitalAccessEnabled()) {
      throw new BadRequestException({
        message: "Digital Access Hub is disabled.",
        featureFlag: "ENABLE_DIGITAL_ACCESS"
      });
    }
  }

  private ensureAdminEnabled() {
    this.ensureDigitalAccessEnabled();

    if (!this.isAdminEnabled()) {
      throw new BadRequestException({
        message: "Digital Access admin controls are disabled.",
        featureFlag: "ENABLE_DIGITAL_ACCESS_ADMIN"
      });
    }
  }
}
