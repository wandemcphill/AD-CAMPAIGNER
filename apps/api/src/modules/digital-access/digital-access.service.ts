import { BadRequestException, Injectable } from "@nestjs/common";
import { createEvent, type PlatformEvent } from "@fliptrybe/events";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import {
  assertDigitalAccessStatusTransition,
  assessDigitalAccessAbuse,
  canRequestDigitalAccess,
  chargeDigitalAccessWallet,
  defaultDigitalAccessCatalog,
  getDigitalAccessStartingPrice,
  normalizeDigitalAccessContact,
  refundDigitalAccessWallet,
  type DigitalAccessWalletState
} from "@fliptrybe/service-digital-access";
import type {
  AuditLog,
  DigitalAccessCategory,
  DigitalAccessPlan,
  DigitalAccessRequest,
  DigitalAccessRequestStatus,
  DigitalAccessService,
  LedgerEntry,
  Wallet
} from "@fliptrybe/types";

import type {
  CreateDigitalAccessRequestDto,
  DigitalAccessCategoryDto,
  DigitalAccessListQueryDto,
  DigitalAccessPlanDto,
  DigitalAccessRequestQueryDto,
  DigitalAccessServiceDto
} from "./digital-access.dtos";

const workspaceId = "workspace_demo";
const walletId = "wallet_demo";
const demoUserId = "user_demo";
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

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

function createWallet(): Wallet {
  const timestamp = now();

  return {
    id: walletId,
    workspaceId,
    availableBalance: { amountMinor: 8500000, currency: "NGN" },
    heldBalance: { amountMinor: 0, currency: "NGN" },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createOpeningCredit(): LedgerEntry {
  const timestamp = now();

  return {
    id: "ledger_da_opening",
    walletId,
    kind: "CREDIT",
    amount: { amountMinor: 8500000, currency: "NGN" },
    reference: "digital_access_opening_balance",
    description: "Digital Access demo wallet funding",
    sourceType: "DigitalAccessHub",
    sourceId: workspaceId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function cloneCatalog() {
  return {
    categories: defaultDigitalAccessCatalog.categories.map((item) => ({ ...item })),
    services: defaultDigitalAccessCatalog.services.map((item) => ({ ...item })),
    plans: defaultDigitalAccessCatalog.plans.map((item) => ({ ...item }))
  };
}

interface RequestContext {
  userId?: string;
  idempotencyKey?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

@Injectable()
export class DigitalAccessHubService {
  private readonly events: PlatformEvent[] = [];
  private readonly auditLogs: AuditLog[] = [];
  private readonly queuedNotifications: Array<Record<string, string | number | boolean>> = [];
  private readonly queuedAnalytics: Array<Record<string, string | number | boolean>> = [];
  private readonly catalog = cloneCatalog();
  private readonly requests: DigitalAccessRequest[] = [];
  private walletState: DigitalAccessWalletState = {
    wallet: createWallet(),
    ledgerEntries: [createOpeningCredit()],
    charges: []
  };

  listCategories() {
    this.ensureDigitalAccessEnabled();
    const activeServiceCategories = new Set(
      this.catalog.services
        .filter((service) => this.isPublicService(service))
        .map((service) => service.category)
    );

    return this.catalog.categories
      .filter((category) => category.isActive && activeServiceCategories.has(category.slug))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  listServices(query: DigitalAccessListQueryDto = {}) {
    this.ensureDigitalAccessEnabled();

    return this.paginateServices(
      this.catalog.services.filter((service) => this.isPublicService(service)),
      query
    );
  }

  getService(slug: string) {
    this.ensureDigitalAccessEnabled();
    const service = this.catalog.services.find(
      (item) => item.slug === slug && this.isPublicService(item)
    );

    if (!service) {
      throw new BadRequestException("Digital Access service is not available.");
    }

    return this.withPlans(service, true);
  }

  createRequest(input: CreateDigitalAccessRequestDto, context: RequestContext = {}) {
    this.ensureDigitalAccessEnabled();
    const userId = this.requireUser(context);
    const idempotencyKey =
      input.idempotencyKey?.trim() || context.idempotencyKey?.trim() || id("da_idempotency");
    const existing = this.requests.find((request) => request.idempotencyKey === idempotencyKey);

    if (existing) {
      return {
        request: existing,
        walletCharge: this.walletState.charges.find((charge) => charge.requestId === existing.id),
        idempotent: true
      };
    }

    const service = this.resolveService(input);
    const plan = this.resolvePlan(input.planId);

    if (!canRequestDigitalAccess(service, plan)) {
      throw new BadRequestException("This Digital Access plan is not available for requests.");
    }

    const contactValue = normalizeDigitalAccessContact(input.contactType, input.contactValue);
    const abuseAssessment = assessDigitalAccessAbuse({
      userId,
      serviceId: service.id,
      contactValue,
      requests: this.requests
    });

    if (!abuseAssessment.allowed) {
      throw new BadRequestException({
        message: "Digital Access request needs review before another submission.",
        signals: abuseAssessment.signals,
        reason: abuseAssessment.reason
      });
    }

    const timestamp = now();
    const request: DigitalAccessRequest = {
      id: id("da_req"),
      workspaceId,
      userId,
      serviceId: service.id,
      planId: plan.id,
      serviceName: service.name,
      planName: plan.planName,
      contactType: input.contactType,
      contactValue,
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      status: "pending",
      amount: plan.price,
      idempotencyKey,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const chargeResult = chargeDigitalAccessWallet(this.walletState, {
      requestId: request.id,
      idempotencyKey,
      workspaceId,
      walletId,
      amount: plan.price
    });
    const storedRequest: DigitalAccessRequest = {
      ...request,
      walletChargeId: chargeResult.charge.id
    };

    this.walletState = chargeResult.state;
    this.requests.unshift(storedRequest);
    this.pushAudit("digital_access.request.created", "DigitalAccessRequest", storedRequest.id, {
      serviceId: service.id,
      planId: plan.id,
      riskScore: abuseAssessment.score
    });
    this.queueSideEffects("created", storedRequest);
    this.pushEvent("DigitalAccessRequestCreated", { request: this.sanitizeRequest(storedRequest) });

    return {
      request: storedRequest,
      walletCharge: chargeResult.charge,
      abuseAssessment,
      idempotent: false
    };
  }

  listRequests(context: { userId?: string }) {
    this.ensureDigitalAccessEnabled();
    const userId = this.requireUser(context);

    return this.requests.filter((request) => request.userId === userId).map((request) => request);
  }

  getRequest(requestId: string, context: { userId?: string }) {
    this.ensureDigitalAccessEnabled();
    const userId = this.requireUser(context);
    const request = this.getStoredRequest(requestId);

    if (request.userId !== userId) {
      throw new BadRequestException("Digital Access request was not found.");
    }

    return request;
  }

  getWallet() {
    return {
      ...this.walletState.wallet,
      availableBalance: calculateAvailableBalance(this.walletState.ledgerEntries),
      updatedAt: now()
    };
  }

  getAdminOverview() {
    this.ensureAdminEnabled();
    const totals = this.requests.reduce(
      (acc, request) => ({
        ...acc,
        [request.status]: acc[request.status] + 1
      }),
      {
        pending: 0,
        processing: 0,
        fulfilled: 0,
        cancelled: 0,
        failed: 0
      } satisfies Record<DigitalAccessRequestStatus, number>
    );
    const fulfilled = this.requests.filter((request) => request.status === "fulfilled");
    const revenueMinor = fulfilled.reduce((sum, request) => sum + request.amount.amountMinor, 0);

    return {
      enabled: this.isDigitalAccessEnabled(),
      adminEnabled: this.isAdminEnabled(),
      totals,
      revenue: { amountMinor: revenueMinor, currency: "NGN" },
      activeServices: this.catalog.services.filter((service) => service.isActive).length,
      draftServices: this.catalog.services.filter((service) => !service.isActive).length,
      queuedNotifications: this.queuedNotifications.length,
      queuedAnalytics: this.queuedAnalytics.length,
      topCategories: this.getTopCategories(),
      recentRequests: this.requests.slice(0, 8).map((request) => this.sanitizeRequest(request))
    };
  }

  listAdminCategories() {
    this.ensureAdminEnabled();

    return [...this.catalog.categories].sort((left, right) => left.sortOrder - right.sortOrder);
  }

  createCategory(input: DigitalAccessCategoryDto) {
    this.ensureAdminEnabled();
    if (!input.name?.trim()) {
      throw new BadRequestException("Category name is required.");
    }

    const timestamp = now();
    const category: DigitalAccessCategory = {
      id: id("dacat"),
      name: input.name.trim(),
      slug: input.slug?.trim() ? slugify(input.slug) : slugify(input.name),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      sortOrder: input.sortOrder ?? 100,
      isActive: input.isActive ?? true,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.ensureUniqueCategorySlug(category.slug);
    this.catalog.categories.push(category);
    this.pushAudit("digital_access.category.created", "DigitalAccessCategory", category.id, {
      slug: category.slug
    });

    return category;
  }

  updateCategory(categoryId: string, input: DigitalAccessCategoryDto) {
    this.ensureAdminEnabled();
    const category = this.getCategory(categoryId);
    const nextSlug = input.slug?.trim() ? slugify(input.slug) : category.slug;

    if (nextSlug !== category.slug) {
      this.ensureUniqueCategorySlug(nextSlug);
    }

    const next: DigitalAccessCategory = {
      ...category,
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      slug: nextSlug,
      ...(input.description === undefined ? {} : { description: input.description.trim() }),
      sortOrder: input.sortOrder ?? category.sortOrder,
      isActive: input.isActive ?? category.isActive,
      updatedAt: now()
    };

    if (next.slug !== category.slug) {
      this.catalog.services
        .filter((service) => service.category === category.slug)
        .forEach((service) => {
          service.category = next.slug;
          service.updatedAt = now();
        });
    }

    this.replaceCategory(next);
    this.pushAudit("digital_access.category.updated", "DigitalAccessCategory", next.id, {
      slug: next.slug
    });

    return next;
  }

  listAdminServices(query: DigitalAccessListQueryDto = {}) {
    this.ensureAdminEnabled();

    return this.paginateServices(this.catalog.services, query, false);
  }

  createService(input: DigitalAccessServiceDto) {
    this.ensureAdminEnabled();
    const categorySlug = input.category?.trim();

    if (!input.name?.trim() || !categorySlug || !input.description?.trim()) {
      throw new BadRequestException("Service name, category, and description are required.");
    }
    this.getCategory(categorySlug);

    const timestamp = now();
    const service: DigitalAccessService = {
      id: id("dasvc"),
      name: input.name.trim(),
      category: categorySlug,
      slug: input.slug?.trim() ? slugify(input.slug) : slugify(input.name),
      description: input.description.trim(),
      startingPrice: { amountMinor: input.startingPriceMinor ?? 0, currency: "NGN" },
      deliveryEta: input.deliveryEta?.trim() ?? "Manual review",
      isActive: input.isActive ?? false,
      isFeatured: input.isFeatured ?? false,
      ...(input.thumbnail?.trim() ? { thumbnail: input.thumbnail.trim() } : {}),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.ensureUniqueServiceSlug(service.slug);
    this.catalog.services.push(service);
    this.pushAudit("digital_access.service.created", "DigitalAccessService", service.id, {
      slug: service.slug
    });

    return this.withPlans(service, false);
  }

  updateService(serviceId: string, input: DigitalAccessServiceDto) {
    this.ensureAdminEnabled();
    const service = this.getServiceById(serviceId);
    const nextSlug = input.slug?.trim() ? slugify(input.slug) : service.slug;

    if (nextSlug !== service.slug) {
      this.ensureUniqueServiceSlug(nextSlug);
    }
    const category = input.category?.trim();

    if (category) {
      this.getCategory(category);
    }

    const next: DigitalAccessService = {
      ...service,
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      category: category || service.category,
      slug: nextSlug,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      startingPrice: {
        amountMinor: input.startingPriceMinor ?? service.startingPrice.amountMinor,
        currency: "NGN"
      },
      deliveryEta: input.deliveryEta?.trim() ?? service.deliveryEta,
      isActive: input.isActive ?? service.isActive,
      isFeatured: input.isFeatured ?? service.isFeatured,
      ...(input.thumbnail?.trim() ? { thumbnail: input.thumbnail.trim() } : {}),
      updatedAt: now()
    };

    this.replaceService(next);
    this.pushAudit("digital_access.service.updated", "DigitalAccessService", next.id, {
      slug: next.slug,
      isActive: next.isActive
    });

    return this.withPlans(next, false);
  }

  listAdminPlans(serviceId?: string) {
    this.ensureAdminEnabled();

    return this.catalog.plans.filter((plan) => !serviceId || plan.serviceId === serviceId);
  }

  createPlan(input: DigitalAccessPlanDto) {
    this.ensureAdminEnabled();
    if (!input.serviceId || !input.planName?.trim() || !input.duration?.trim()) {
      throw new BadRequestException("Plan service, name, and duration are required.");
    }
    this.getServiceById(input.serviceId);

    const timestamp = now();
    const plan: DigitalAccessPlan = {
      id: id("daplan"),
      serviceId: input.serviceId,
      planName: input.planName.trim(),
      duration: input.duration.trim(),
      price: { amountMinor: input.priceMinor ?? 0, currency: "NGN" },
      description: input.description?.trim() ?? "Owner-managed access plan.",
      isActive: input.isActive ?? false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.catalog.plans.push(plan);
    this.refreshServiceStartingPrice(plan.serviceId);
    this.pushAudit("digital_access.plan.created", "DigitalAccessPlan", plan.id, {
      serviceId: plan.serviceId
    });

    return plan;
  }

  updatePlan(planId: string, input: DigitalAccessPlanDto) {
    this.ensureAdminEnabled();
    const plan = this.resolvePlan(planId);
    const next: DigitalAccessPlan = {
      ...plan,
      ...(input.planName?.trim() ? { planName: input.planName.trim() } : {}),
      ...(input.duration?.trim() ? { duration: input.duration.trim() } : {}),
      price: { amountMinor: input.priceMinor ?? plan.price.amountMinor, currency: "NGN" },
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      isActive: input.isActive ?? plan.isActive,
      updatedAt: now()
    };

    this.replacePlan(next);
    this.refreshServiceStartingPrice(next.serviceId);
    this.pushAudit("digital_access.plan.updated", "DigitalAccessPlan", next.id, {
      serviceId: next.serviceId,
      isActive: next.isActive
    });

    return next;
  }

  listAdminRequests(query: DigitalAccessRequestQueryDto = {}) {
    this.ensureAdminEnabled();
    const search = query.q?.trim().toLowerCase();
    const category = query.category?.trim();
    const filtered = this.requests.filter((request) => {
      const service = this.getServiceById(request.serviceId);

      return (
        (!query.status || request.status === query.status) &&
        (!category || service.category === category) &&
        (!search ||
          request.serviceName.toLowerCase().includes(search) ||
          request.planName.toLowerCase().includes(search) ||
          request.contactValue.toLowerCase().includes(search))
      );
    });

    return this.paginateRequests(filtered, query, false);
  }

  updateRequestStatus(requestId: string, status: DigitalAccessRequestStatus) {
    this.ensureAdminEnabled();
    const request = this.getStoredRequest(requestId);

    try {
      assertDigitalAccessStatusTransition(request.status, status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid status.");
    }

    let refund: ReturnType<typeof refundDigitalAccessWallet>["refund"] | undefined;

    if (request.status !== status && (status === "failed" || status === "cancelled")) {
      const refundResult = refundDigitalAccessWallet(this.walletState, { requestId: request.id });
      this.walletState = refundResult.state;
      refund = refundResult.refund;
      this.pushEvent("DigitalAccessRequestRefunded", { requestId: request.id, refund });
    }

    const next: DigitalAccessRequest = { ...request, status, updatedAt: now() };

    this.replaceRequest(next);
    this.pushAudit("digital_access.request.status_updated", "DigitalAccessRequest", next.id, {
      status: next.status
    });
    this.queueSideEffects("status_updated", next);
    this.pushEvent("DigitalAccessRequestUpdated", { requestId: next.id, status: next.status });

    return { request: next, ...(refund === undefined ? {} : { refund }) };
  }

  assignRequest(requestId: string, assignedTo: string | null) {
    this.ensureAdminEnabled();
    const request = this.getStoredRequest(requestId);
    const next: DigitalAccessRequest = {
      ...request,
      assignedTo,
      updatedAt: now()
    };

    this.replaceRequest(next);
    this.pushAudit("digital_access.request.assigned", "DigitalAccessRequest", next.id, {
      assignedTo: assignedTo ?? "unassigned"
    });

    return next;
  }

  getRealtimeSnapshot() {
    return {
      requests: this.requests.slice(0, 20).map((request) => this.sanitizeRequest(request)),
      admin: {
        pending: this.requests.filter((request) => request.status === "pending").length,
        processing: this.requests.filter((request) => request.status === "processing").length,
        fulfilled: this.requests.filter((request) => request.status === "fulfilled").length
      },
      events: this.events.map((event) => ({
        id: event.id,
        name: event.name,
        occurredAt: event.occurredAt,
        tenantId: event.tenantId
      }))
    };
  }

  getAuditLogs() {
    return this.auditLogs;
  }

  private paginateServices(
    services: DigitalAccessService[],
    query: DigitalAccessListQueryDto,
    publicOnly = true
  ) {
    const search = query.q?.trim().toLowerCase();
    const filtered = services
      .filter((service) => !query.category || service.category === query.category)
      .filter(
        (service) =>
          !search ||
          service.name.toLowerCase().includes(search) ||
          service.description.toLowerCase().includes(search)
      )
      .sort((left, right) => Number(right.isFeatured) - Number(left.isFeatured));
    const startIndex = query.cursor
      ? Math.max(0, filtered.findIndex((item) => item.id === query.cursor) + 1)
      : 0;
    const limit = parseLimit(query.limit);
    const items = filtered
      .slice(startIndex, startIndex + limit)
      .map((service) => this.withPlans(service, publicOnly));

    return {
      items,
      nextCursor: filtered[startIndex + limit]?.id ?? null
    };
  }

  private paginateRequests(
    requests: DigitalAccessRequest[],
    query: DigitalAccessRequestQueryDto,
    sanitize = true
  ) {
    const startIndex = query.cursor
      ? Math.max(0, requests.findIndex((item) => item.id === query.cursor) + 1)
      : 0;
    const limit = parseLimit(query.limit);

    return {
      items: requests
        .slice(startIndex, startIndex + limit)
        .map((request) => (sanitize ? this.sanitizeRequest(request) : request)),
      nextCursor: requests[startIndex + limit]?.id ?? null
    };
  }

  private withPlans(service: DigitalAccessService, publicOnly: boolean) {
    const plans = this.catalog.plans.filter(
      (plan) => plan.serviceId === service.id && (!publicOnly || plan.isActive)
    );
    const startingPrice = getDigitalAccessStartingPrice(service, this.catalog.plans);

    return { ...service, startingPrice, plans };
  }

  private isPublicService(service: DigitalAccessService) {
    return (
      service.isActive &&
      this.catalog.plans.some(
        (plan) =>
          plan.serviceId === service.id &&
          plan.isActive &&
          plan.price.currency === "NGN" &&
          plan.price.amountMinor > 0
      )
    );
  }

  private resolveService(input: CreateDigitalAccessRequestDto) {
    const service = this.catalog.services.find(
      (item) =>
        (input.serviceId && item.id === input.serviceId) ||
        (input.serviceSlug && item.slug === input.serviceSlug)
    );

    if (!service) {
      throw new BadRequestException("Digital Access service was not found.");
    }

    return service;
  }

  private resolvePlan(planId: string) {
    const plan = this.catalog.plans.find((item) => item.id === planId);

    if (!plan) {
      throw new BadRequestException("Digital Access plan was not found.");
    }

    return plan;
  }

  private getCategory(idOrSlug: string) {
    const category = this.catalog.categories.find(
      (item) => item.id === idOrSlug || item.slug === idOrSlug
    );

    if (!category) {
      throw new BadRequestException("Digital Access category was not found.");
    }

    return category;
  }

  private getServiceById(serviceId: string) {
    const service = this.catalog.services.find((item) => item.id === serviceId);

    if (!service) {
      throw new BadRequestException("Digital Access service was not found.");
    }

    return service;
  }

  private getStoredRequest(requestId: string) {
    const request = this.requests.find((item) => item.id === requestId);

    if (!request) {
      throw new BadRequestException("Digital Access request was not found.");
    }

    return request;
  }

  private replaceCategory(category: DigitalAccessCategory) {
    this.catalog.categories = this.catalog.categories.map((item) =>
      item.id === category.id ? category : item
    );
  }

  private replaceService(service: DigitalAccessService) {
    this.catalog.services = this.catalog.services.map((item) =>
      item.id === service.id ? service : item
    );
  }

  private replacePlan(plan: DigitalAccessPlan) {
    this.catalog.plans = this.catalog.plans.map((item) => (item.id === plan.id ? plan : item));
  }

  private replaceRequest(request: DigitalAccessRequest) {
    this.requests[this.requests.findIndex((item) => item.id === request.id)] = request;
  }

  private refreshServiceStartingPrice(serviceId: string) {
    const service = this.getServiceById(serviceId);
    this.replaceService({
      ...service,
      startingPrice: getDigitalAccessStartingPrice(service, this.catalog.plans),
      updatedAt: now()
    });
  }

  private ensureUniqueCategorySlug(slug: string) {
    if (this.catalog.categories.some((item) => item.slug === slug)) {
      throw new BadRequestException("Digital Access category slug already exists.");
    }
  }

  private ensureUniqueServiceSlug(slug: string) {
    if (this.catalog.services.some((item) => item.slug === slug)) {
      throw new BadRequestException("Digital Access service slug already exists.");
    }
  }

  private requireUser(context: { userId?: string }) {
    const userId = context.userId?.trim();

    if (!userId) {
      throw new BadRequestException("Digital Access requests require a logged-in user.");
    }

    return userId;
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

  private getTopCategories() {
    return this.catalog.categories.map((category) => ({
      category: category.slug,
      name: category.name,
      requests: this.requests.filter(
        (request) => this.getServiceById(request.serviceId).category === category.slug
      ).length
    }));
  }

  private queueSideEffects(action: string, request: DigitalAccessRequest) {
    this.queuedNotifications.push({
      action,
      requestId: request.id,
      channel: "IN_APP",
      status: request.status
    });
    this.queuedAnalytics.push({
      action,
      workspaceId,
      serviceId: request.serviceId,
      planId: request.planId,
      amountMinor: request.amount.amountMinor
    });
  }

  private pushAudit(
    action: string,
    entityType: string,
    entityId: string,
    metadata: AuditLog["metadata"]
  ) {
    const timestamp = now();
    this.auditLogs.unshift({
      id: id("audit"),
      workspaceId,
      actorUserId: demoUserId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  private pushEvent<TEvent extends PlatformEvent["name"]>(
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
