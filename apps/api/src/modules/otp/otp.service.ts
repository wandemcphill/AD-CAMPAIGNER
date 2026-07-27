import { BadRequestException, Injectable } from "@nestjs/common";
import { createEvent, type PlatformEvent } from "@fliptrybe/events";
import {
  createFiveSimOtpProvider,
  createMockOtpProvider,
  createSmsActivateCompatibleOtpProvider,
  createSmsManOtpProvider,
  createTextVerifiedOtpProvider,
  type OtpProviderAdapter,
  type OtpProviderQuote
} from "@fliptrybe/providers";
import {
  assessOtpFraud,
  chargeOtpWallet,
  defaultOtpPricingRules,
  defaultOtpServices,
  refundOtpWallet,
  routeOtpProvider,
  summarizeOtpProviderHealth,
  type OtpPricingRule,
  type OtpWalletState
} from "@fliptrybe/service-otp";
import type {
  LedgerEntry,
  OtpOrder,
  OtpProviderHealth,
  OtpProviderTier,
  OtpRoutingAttempt,
  OtpService,
  Wallet
} from "@fliptrybe/types";

import type {
  CreateOtpOrderDto,
  OtpPricingRuleDto,
  OtpProviderControlDto,
  QuoteOtpOrderDto
} from "./otp.dtos";
import type { AuthenticatedRequestContext } from "../request-context";

const defaultWorkspaceId = "workspace_demo";
const defaultUserId = "user_demo";
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

function isEnabled(value: string | undefined) {
  return value?.toLowerCase() === "true" || value === "1";
}

function getSecret(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "..." || trimmed.startsWith("replace-")) {
    return undefined;
  }

  return trimmed;
}

function csv(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function getUsdToNgnRate() {
  const parsed = Number(process.env.OTP_USD_TO_NGN_RATE);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1600;
}

function assertOptionalNonNegativeInteger(value: number | undefined, message: string) {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new BadRequestException(message);
  }
}

function assertOptionalPositiveNumber(value: number | undefined, message: string) {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new BadRequestException(message);
  }
}

function getPricingRules(): OtpPricingRule[] {
  const usdToNgnRate = getUsdToNgnRate();

  return defaultOtpPricingRules.map((rule) => ({ ...rule, usdToNgnRate }));
}

function normalizeReference(value: string | undefined) {
  return value?.trim() || id("otp_idem");
}

function walletIdFor(workspaceId: string) {
  return `wallet_${workspaceId}`;
}

function scopedContext(context?: Pick<AuthenticatedRequestContext, "workspaceId" | "userId">) {
  return {
    workspaceId: context?.workspaceId ?? defaultWorkspaceId,
    userId: context?.userId ?? defaultUserId
  };
}

function createWallet(workspaceId: string): Wallet {
  const timestamp = now();

  return {
    id: walletIdFor(workspaceId),
    workspaceId,
    availableBalance: { amountMinor: 5000000, currency: "NGN" },
    heldBalance: { amountMinor: 0, currency: "NGN" },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createOpeningCredit(workspaceId: string): LedgerEntry {
  const timestamp = now();
  const walletId = walletIdFor(workspaceId);

  return {
    id: `ledger_otp_opening_${workspaceId}`,
    walletId,
    kind: "CREDIT",
    amount: { amountMinor: 5000000, currency: "NGN" },
    reference: "otp_opening_balance",
    description: "OTP beta wallet opening balance",
    sourceType: "OtpMarketplace",
    sourceId: workspaceId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createOtpProviders() {
  const providerMode = process.env.OTP_PROVIDER_MODE ?? "mock";
  const premiumEnabled = isEnabled(process.env.ENABLE_PREMIUM_OTP);
  const budgetEnabled = isEnabled(process.env.ENABLE_BUDGET_OTP);

  if (providerMode !== "live" && providerMode !== "sandbox") {
    return [createMockOtpProvider("mock-budget-otp", "BUDGET")];
  }

  const providers: OtpProviderAdapter[] = [];

  if (premiumEnabled) {
    providers.push(
      createTextVerifiedOtpProvider({
        enabled: Boolean(getSecret(process.env.TEXTVERIFIED_API_KEY)),
        apiUrl: process.env.TEXTVERIFIED_API_URL,
        apiKey: getSecret(process.env.TEXTVERIFIED_API_KEY)
      })
    );
  }
  if (budgetEnabled) {
    providers.push(
      createFiveSimOtpProvider({
        enabled: Boolean(getSecret(process.env.FIVESIM_API_KEY)),
        apiUrl: process.env.FIVESIM_API_URL,
        apiKey: getSecret(process.env.FIVESIM_API_KEY)
      }),
      createSmsManOtpProvider({
        enabled: Boolean(getSecret(process.env.SMSMAN_API_KEY)),
        apiUrl: process.env.SMSMAN_API_URL,
        apiKey: getSecret(process.env.SMSMAN_API_KEY)
      })
    );

    if (isEnabled(process.env.SMSACTIVATE_COMPATIBLE_ENABLED)) {
      providers.push(
        createSmsActivateCompatibleOtpProvider({
          enabled: Boolean(
            getSecret(process.env.SMSACTIVATE_API_KEY) && process.env.SMSACTIVATE_API_URL
          ),
          apiUrl: process.env.SMSACTIVATE_API_URL,
          apiKey: getSecret(process.env.SMSACTIVATE_API_KEY)
        })
      );
    }
  }

  return providers.length > 0 ? providers : [createMockOtpProvider("mock-budget-otp", "BUDGET")];
}

@Injectable()
export class OtpMarketplaceService {
  private readonly providers = createOtpProviders();
  private readonly providerControls = new Map<string, OtpProviderControlDto>();
  private readonly events: PlatformEvent[] = [];
  private readonly orders: OtpOrder[] = [];
  private pricingRules = getPricingRules();
  private readonly walletStates = new Map<string, OtpWalletState>();

  listServices() {
    this.ensureOtpEnabled();

    return defaultOtpServices
      .filter((service) => this.isTierEnabled(service.providerTier))
      .filter((service) => service.visible || this.isAdminEnabled())
      .map((service) => ({
        ...service,
        compliance: service.requiresAdminApproval ? "ADMIN_APPROVAL_REQUIRED" : "BETA_ALLOWED"
      }));
  }

  async quote(input: QuoteOtpOrderDto, context?: AuthenticatedRequestContext) {
    this.ensureOtpEnabled();
    const scope = scopedContext(context);
    const service = this.resolveService(input);
    const fraudAssessment = assessOtpFraud({
      service,
      recentOrders: this.listOrders(scope),
      workspaceApproved: this.isWorkspaceApproved(scope.workspaceId),
      attestationAccepted: input.attestationAccepted === true
    });
    const { routing, health } = await this.routeForService(service, input.providerTier);

    return {
      service,
      routing,
      providerHealth: summarizeOtpProviderHealth(health),
      fraudAssessment,
      compliance: {
        betaWorkspaceApproved: this.isWorkspaceApproved(scope.workspaceId),
        attestationRequired: true,
        highRiskRequiresAdminApproval: service.requiresAdminApproval
      }
    };
  }

  async createOrder(
    input: CreateOtpOrderDto,
    request?: { ipAddress?: string; userAgent?: string; deviceId?: string },
    context?: AuthenticatedRequestContext
  ) {
    this.ensureOtpEnabled();
    const scope = scopedContext(context);
    const idempotencyKey = normalizeReference(input.idempotencyKey ?? input.customerReference);
    const existingOrder = this.orders.find(
      (order) => order.workspaceId === scope.workspaceId && order.idempotencyKey === idempotencyKey
    );

    if (existingOrder) {
      return { order: existingOrder, idempotent: true };
    }

    const service = this.resolveService(input);
    const fraudAssessment = assessOtpFraud({
      service,
      recentOrders: this.listOrders(scope),
      workspaceApproved: this.isWorkspaceApproved(scope.workspaceId),
      attestationAccepted: input.attestationAccepted === true,
      ...(request?.deviceId === undefined ? {} : { deviceId: request.deviceId }),
      ...(request?.ipAddress === undefined ? {} : { ipAddress: request.ipAddress })
    });

    if (fraudAssessment.action === "BLOCK") {
      throw new BadRequestException({
        message: "OTP order blocked by compliant beta controls.",
        fraudAssessment
      });
    }
    if (fraudAssessment.action === "REVIEW") {
      throw new BadRequestException({
        message: "OTP order requires admin review before wallet charge.",
        fraudAssessment
      });
    }

    const { routing, health, quotes } = await this.routeForService(service, input.providerTier);
    const timestamp = now();
    const order: OtpOrder = {
      id: id("otp"),
      workspaceId: scope.workspaceId,
      serviceCode: service.code,
      serviceName: service.name,
      countryCode: service.countryCode,
      providerTier: routing.providerTier,
      providerName: routing.providerName,
      status: "CHARGED",
      amount: routing.quote.customerPrice,
      supplierCost: routing.quote.supplierCost,
      idempotencyKey,
      attestationAccepted: true,
      riskScore: fraudAssessment.score,
      expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const chargeResult = chargeOtpWallet(this.getWalletState(scope.workspaceId), {
      otpOrderId: order.id,
      idempotencyKey,
      workspaceId: scope.workspaceId,
      walletId: walletIdFor(scope.workspaceId),
      amount: order.amount,
      providerName: routing.providerName
    });

    this.setWalletState(scope.workspaceId, chargeResult.state);
    this.orders.unshift(order);

    try {
      const allocation = await this.allocateWithFailover(order, quotes, health);
      const readyOrder: OtpOrder = {
        ...order,
        providerName: allocation.providerName,
        providerReference: allocation.providerReference,
        status: allocation.status,
        ...(allocation.phoneNumberMasked === undefined
          ? {}
          : { phoneNumberMasked: allocation.phoneNumberMasked }),
        ...(allocation.expiresAt === undefined ? {} : { expiresAt: allocation.expiresAt }),
        updatedAt: now()
      };

      this.replaceOrder(readyOrder);
      this.pushEvent(scope.workspaceId, "OtpOrderCreated", { order: readyOrder });
      this.pushEvent(scope.workspaceId, "OtpOrderWaiting", { orderId: readyOrder.id });

      return {
        order: readyOrder,
        routing,
        fraudAssessment,
        walletCharge: chargeResult.charge,
        idempotent: false
      };
    } catch (error) {
      const refund = refundOtpWallet(this.getWalletState(scope.workspaceId), {
        otpOrderId: order.id
      });
      const failedOrder: OtpOrder = { ...order, status: "REFUNDED", updatedAt: now() };

      this.setWalletState(scope.workspaceId, refund.state);
      this.replaceOrder(failedOrder);
      this.pushEvent(scope.workspaceId, "OtpOrderRefunded", {
        orderId: failedOrder.id,
        refund: refund.refund
      });

      throw new BadRequestException({
        message: "OTP allocation failed and wallet was automatically refunded.",
        reason: error instanceof Error ? error.message : "Unknown OTP allocation error.",
        refund: refund.refund
      });
    }
  }

  listOrders(context?: Pick<AuthenticatedRequestContext, "workspaceId" | "userId">) {
    this.ensureOtpEnabled();
    const scope = scopedContext(context);

    return this.orders.filter((order) => order.workspaceId === scope.workspaceId);
  }

  async getOrder(orderId: string, context?: AuthenticatedRequestContext) {
    this.ensureOtpEnabled();
    const scope = scopedContext(context);
    const order = this.getStoredOrder(orderId, scope.workspaceId);

    if (!order.providerName || !order.providerReference) {
      return order;
    }

    const provider = this.providers.find((item) => item.name === order.providerName);

    if (!provider) {
      return order;
    }

    const snapshot = await provider.getOrderStatus(order.providerReference);
    const nextOrder: OtpOrder = {
      ...order,
      status: snapshot.status,
      ...(snapshot.phoneNumberMasked === undefined
        ? {}
        : { phoneNumberMasked: snapshot.phoneNumberMasked }),
      ...(snapshot.redactedMessage === undefined
        ? {}
        : {
            message: {
              id: id("otp_msg"),
              otpOrderId: order.id,
              status: "RECEIVED",
              redactedMessage: snapshot.redactedMessage,
              receivedAt: snapshot.receivedAt ?? now(),
              createdAt: now(),
              updatedAt: now()
            }
          }),
      updatedAt: now()
    };

    this.replaceOrder(nextOrder);

    if (nextOrder.status === "RECEIVED") {
      this.pushEvent(scope.workspaceId, "OtpMessageReceived", {
        orderId: nextOrder.id,
        status: nextOrder.status
      });
    }

    return nextOrder;
  }

  async cancelOrder(orderId: string, context?: AuthenticatedRequestContext) {
    this.ensureOtpEnabled();
    const scope = scopedContext(context);
    const order = this.getStoredOrder(orderId, scope.workspaceId);

    if (order.providerName && order.providerReference) {
      const provider = this.providers.find((item) => item.name === order.providerName);
      await provider?.cancelOrder(order.providerReference);
    }

    const refund = refundOtpWallet(this.getWalletState(scope.workspaceId), { otpOrderId: order.id });
    const cancelledOrder: OtpOrder = { ...order, status: "REFUNDED", updatedAt: now() };

    this.setWalletState(scope.workspaceId, refund.state);
    this.replaceOrder(cancelledOrder);
    this.pushEvent(scope.workspaceId, "OtpOrderRefunded", {
      orderId: order.id,
      refund: refund.refund
    });

    return { order: cancelledOrder, refund: refund.refund };
  }

  refundOrder(orderId: string, context?: AuthenticatedRequestContext) {
    this.ensureOtpEnabled();
    const scope = scopedContext(context);
    const order = this.getStoredOrder(orderId, scope.workspaceId);
    const refund = refundOtpWallet(this.getWalletState(scope.workspaceId), { otpOrderId: order.id });
    const refundedOrder: OtpOrder = { ...order, status: "REFUNDED", updatedAt: now() };

    this.setWalletState(scope.workspaceId, refund.state);
    this.replaceOrder(refundedOrder);
    this.pushEvent(scope.workspaceId, "OtpOrderRefunded", {
      orderId: order.id,
      refund: refund.refund
    });

    return { order: refundedOrder, refund: refund.refund };
  }

  getWallet(context?: AuthenticatedRequestContext) {
    return this.getWalletState(scopedContext(context).workspaceId).wallet;
  }

  async getAdminOverview() {
    this.ensureAdminEnabled();
    const health = await this.getProviderHealth();
    const completed = this.orders.filter((order) => order.status === "COMPLETED").length;
    const refunded = this.orders.filter((order) => order.status === "REFUNDED").length;

    return {
      enabled: this.isOtpEnabled(),
      approvedWorkspaceCount: csv(process.env.OTP_BETA_WORKSPACE_IDS).size,
      activeOrders: this.orders.filter((order) =>
        ["CHARGED", "ALLOCATING", "WAITING", "RECEIVED"].includes(order.status)
      ).length,
      completed,
      refunded,
      refundRateBps:
        this.orders.length > 0 ? Math.round((refunded * 10_000) / this.orders.length) : 0,
      providerHealth: summarizeOtpProviderHealth(health),
      providers: health.map((item) => ({
        providerName: item.providerName,
        tier: item.tier,
        status: item.status,
        latencyMs: item.latencyMs,
        successRateBps: item.successRateBps
      }))
    };
  }

  async getAdminProviders() {
    this.ensureAdminEnabled();
    const health = await this.getProviderHealth();

    return this.providers.map((provider) => ({
      name: provider.name,
      tier: provider.tier,
      control: this.providerControls.get(provider.name) ?? { enabled: true },
      health: health.find((item) => item.providerName === provider.name)
    }));
  }

  setProviderControl(providerName: string, input: OtpProviderControlDto) {
    this.ensureAdminEnabled();
    const current = this.providerControls.get(providerName) ?? {};
    const next = { ...current, ...input };

    this.providerControls.set(providerName, next);
    this.pushAdminEvent("otp.provider_control.updated", {
      providerName,
      enabled: next.enabled !== false
    });

    return { providerName, control: next };
  }

  getPricingRules() {
    this.ensureAdminEnabled();
    return this.pricingRules;
  }

  async getAdminRisk() {
    this.ensureAdminEnabled();
    const health = await this.getProviderHealth();
    const highRiskOrders = this.orders.filter((order) => (order.riskScore ?? 0) >= 70);
    const reviewOrders = this.orders.filter((order) => (order.riskScore ?? 0) >= 35);
    const blockedRoutes = health.filter((item) => item.status === "DOWN").length +
      Array.from(this.providerControls.values()).filter((control) => control.enabled === false)
        .length;
    const providerSignals = health
      .filter((item) => item.status === "DEGRADED" || item.status === "DOWN")
      .map((item) => ({
        label: item.status === "DOWN" ? "Provider unavailable" : "Provider degraded",
        entity: item.providerName,
        severity: item.status === "DOWN" ? "High" : "Medium",
        action: item.status === "DOWN" ? "Pause route until healthy" : "Lower routing priority"
      }));
    const orderSignals = reviewOrders.slice(0, 10).map((order) => ({
      label: order.riskScore && order.riskScore >= 70 ? "High-risk OTP order" : "Review OTP order",
      entity: order.id,
      severity: order.riskScore && order.riskScore >= 70 ? "High" : "Medium",
      action: order.status === "REFUNDED" ? "Confirm refund closure" : "Review customer activity"
    }));

    return {
      metrics: {
        flaggedUsers: highRiskOrders.length,
        reviewOrders: reviewOrders.length,
        protectedAmountMinor: reviewOrders.reduce(
          (total, order) => total + order.amount.amountMinor,
          0
        ),
        blockedRoutes
      },
      signals: [...providerSignals, ...orderSignals]
    };
  }

  getAdminAudit() {
    this.ensureAdminEnabled();

    return this.events.map((event) => ({
      id: event.id,
      event: event.name,
      actor: "OTP system",
      target: event.tenantId,
      at: event.occurredAt,
      tone: event.name.includes("Refunded")
        ? "warning"
        : event.name.includes("Created")
          ? "success"
          : "info"
    }));
  }

  setPricingRule(input: OtpPricingRuleDto) {
    this.ensureAdminEnabled();
    assertOptionalNonNegativeInteger(
      input.markupBps,
      "OTP markup basis points must be a non-negative integer."
    );
    assertOptionalNonNegativeInteger(
      input.minimumMarginMinor,
      "OTP minimum margin must be a non-negative minor-unit amount."
    );
    assertOptionalNonNegativeInteger(
      input.platformFeeMinor,
      "OTP platform fee must be a non-negative minor-unit amount."
    );
    assertOptionalPositiveNumber(
      input.usdToNgnRate,
      "OTP USD/NGN exchange rate must be positive."
    );
    const tier = input.tier ?? "BUDGET";
    const existing = this.pricingRules.find((rule) => rule.tier === tier);
    const next: OtpPricingRule = {
      tier,
      markupBps: input.markupBps ?? existing?.markupBps ?? 5500,
      minimumMarginMinor: input.minimumMarginMinor ?? existing?.minimumMarginMinor ?? 15000,
      platformFeeMinor: input.platformFeeMinor ?? existing?.platformFeeMinor ?? 5000,
      customerCurrency: input.customerCurrency ?? existing?.customerCurrency ?? "NGN",
      usdToNgnRate: input.usdToNgnRate ?? existing?.usdToNgnRate ?? getUsdToNgnRate()
    };

    this.pricingRules = [...this.pricingRules.filter((rule) => rule.tier !== tier), next];
    this.pushAdminEvent("otp.pricing_rule.updated", {
      tier: next.tier,
      markupBps: next.markupBps,
      customerCurrency: next.customerCurrency
    });

    return next;
  }

  getRealtimeSnapshot() {
    return {
      orders: this.orders.map((order) => ({
        id: order.id,
        status: order.status,
        serviceName: order.serviceName,
        countryCode: order.countryCode,
        providerTier: order.providerTier,
        updatedAt: order.updatedAt
      })),
      events: this.events
    };
  }

  private async routeForService(service: OtpService, preferredTier?: OtpProviderTier) {
    const providers = this.providers
      .filter((provider) => this.isTierEnabled(provider.tier))
      .filter((provider) => !preferredTier || provider.tier === preferredTier)
      .filter((provider) => this.providerControls.get(provider.name)?.enabled !== false);
    const [health, quoteResults] = await Promise.all([
      this.getProviderHealth(),
      Promise.allSettled(
        providers.map((provider) =>
          provider.quoteService({
            serviceCode: service.code,
            countryCode: service.countryCode,
            tier: service.providerTier
          })
        )
      )
    ]);
    const quotes = quoteResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );

    if (quotes.length === 0) {
      throw new BadRequestException("No OTP provider can quote this request.");
    }

    return {
      routing: routeOtpProvider({
        quotes,
        health,
        preferredTier: preferredTier ?? service.providerTier,
        rules: this.pricingRules
      }),
      health,
      quotes
    };
  }

  private async allocateWithFailover(
    order: OtpOrder,
    quotes: OtpProviderQuote[],
    health: OtpProviderHealth[]
  ) {
    const attempts: OtpRoutingAttempt[] = [];
    const rankedProviderNames = quotes
      .map((quote) => ({
        providerName: quote.providerName,
        score:
          quote.successRateBps -
          Math.round(quote.estimatedLatencyMs / 10) -
          Math.round(quote.supplierCost.amountMinor / 10),
        down: health.find((item) => item.providerName === quote.providerName)?.status === "DOWN"
      }))
      .sort((left, right) => Number(left.down) - Number(right.down) || right.score - left.score);

    for (const ranked of rankedProviderNames) {
      const provider = this.providers.find((item) => item.name === ranked.providerName);

      if (!provider) {
        continue;
      }

      try {
        const allocation = await provider.createOrder({
          orderId: order.id,
          serviceCode: order.serviceCode,
          countryCode: order.countryCode,
          tier: order.providerTier
        });
        attempts.push({
          id: id("otp_route"),
          otpOrderId: order.id,
          providerName: provider.name,
          providerTier: provider.tier,
          score: ranked.score,
          status: "SELECTED",
          createdAt: now(),
          updatedAt: now()
        });

        return allocation;
      } catch (error) {
        attempts.push({
          id: id("otp_route"),
          otpOrderId: order.id,
          providerName: provider.name,
          providerTier: provider.tier,
          score: ranked.score,
          status: "FAILED",
          reason: error instanceof Error ? error.message : "Provider allocation failed.",
          createdAt: now(),
          updatedAt: now()
        });
      }
    }

    throw new Error(`All OTP provider allocation attempts failed after ${attempts.length} tries.`);
  }

  private getStoredOrder(orderId: string, workspaceId: string) {
    const order = this.orders.find(
      (item) => item.id === orderId && item.workspaceId === workspaceId
    );

    if (!order) {
      throw new BadRequestException(`OTP order ${orderId} was not found.`);
    }

    return order;
  }

  private replaceOrder(order: OtpOrder) {
    const index = this.orders.findIndex((item) => item.id === order.id);

    if (index === -1) {
      this.orders.unshift(order);
      return;
    }

    this.orders[index] = order;
  }

  private async getProviderHealth() {
    const results = await Promise.allSettled(
      this.providers.map((provider) => provider.checkHealth())
    );

    return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  }

  private resolveService(input: QuoteOtpOrderDto) {
    const serviceCode = input.serviceCode ?? "whatsapp";
    const countryCode = input.countryCode ?? "NG";
    const tier = input.providerTier ?? "BUDGET";
    const service = defaultOtpServices.find(
      (item) =>
        item.code === serviceCode && item.countryCode === countryCode && item.providerTier === tier
    );

    if (!service) {
      throw new BadRequestException("OTP service is not available for this country and tier.");
    }
    if (!this.isTierEnabled(service.providerTier)) {
      throw new BadRequestException(`${service.providerTier} OTP is disabled.`);
    }

    return service;
  }

  private isOtpEnabled() {
    return isEnabled(process.env.ENABLE_OTP_MODULE);
  }

  private isAdminEnabled() {
    return isEnabled(process.env.ENABLE_OTP_ADMIN);
  }

  private isTierEnabled(tier: OtpProviderTier) {
    return tier === "PREMIUM"
      ? isEnabled(process.env.ENABLE_PREMIUM_OTP)
      : isEnabled(process.env.ENABLE_BUDGET_OTP);
  }

  private getWalletState(workspaceId: string) {
    const existing = this.walletStates.get(workspaceId);

    if (existing) {
      return existing;
    }

    const next: OtpWalletState = {
      wallet: createWallet(workspaceId),
      ledgerEntries: [createOpeningCredit(workspaceId)],
      charges: []
    };

    this.walletStates.set(workspaceId, next);

    return next;
  }

  private setWalletState(workspaceId: string, state: OtpWalletState) {
    this.walletStates.set(workspaceId, state);
  }

  private isWorkspaceApproved(workspaceId: string) {
    return csv(process.env.OTP_BETA_WORKSPACE_IDS).has(workspaceId);
  }

  private ensureOtpEnabled() {
    if (!this.isOtpEnabled()) {
      throw new BadRequestException({
        message: "OTP marketplace is disabled.",
        featureFlag: "ENABLE_OTP_MODULE"
      });
    }
  }

  private ensureAdminEnabled() {
    this.ensureOtpEnabled();

    if (!this.isAdminEnabled()) {
      throw new BadRequestException({
        message: "OTP admin controls are disabled.",
        featureFlag: "ENABLE_OTP_ADMIN"
      });
    }
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

  private pushAdminEvent(name: string, payload: Record<string, unknown>) {
    this.events.unshift(
      createEvent({
        name,
        tenantId: defaultWorkspaceId,
        payload
      } as unknown as Omit<PlatformEvent, "id" | "occurredAt">)
    );
  }
}
