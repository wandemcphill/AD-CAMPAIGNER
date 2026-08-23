import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import type { ProviderDomain } from "@fliptrybe/providers";

const OPEN_FULFILMENT = new Set([
  "PENDING",
  "QUOTED",
  "CHARGED",
  "SUBMITTED",
  "PROCESSING",
  "PROVISIONING",
  "IN_PROGRESS",
  "OTP_REQUIRED",
  "OTP_VERIFIED",
  "BALANCE_CHECKED",
  "CONFIRMED",
  "HOLD",
  "UNKNOWN",
  "AMBIGUOUS",
  "RECONCILIATION_REQUIRED",
  "MANUAL_REVIEW",
  "DISPUTED"
]);

const EXCEPTION_STATUSES = new Set([
  "FAILED",
  "UNKNOWN",
  "AMBIGUOUS",
  "RECONCILIATION_REQUIRED",
  "DISPUTED"
]);

type FulfilmentDomain =
  | "GROWTH"
  | "VTU"
  | "TELECOM"
  | "VIRTUAL_NUMBER"
  | "DIGITAL_ACCESS"
  | "GIFT_CARD"
  | "AIRTIME_CASHOUT"
  | "REMITTANCE"
  | "RMB"
  | "GUEST_CHECKOUT"
  | "WALLET_WITHDRAWAL";

type QueueItem = {
  id: string;
  domain: FulfilmentDomain;
  status: string;
  workspaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  amountMinor: number | null;
  currency: string | null;
  providerName: string | null;
  providerReference: string | null;
  failureReason: string | null;
  title: string;
  customerLabel: string | null;
  canOpenReconciliation: boolean;
  metadata: Record<string, unknown>;
};

function classify(status: string) {
  if (EXCEPTION_STATUSES.has(status)) return "EXCEPTION" as const;
  if (OPEN_FULFILMENT.has(status)) return "OPEN" as const;
  return "CLOSED" as const;
}

@Injectable()
export class AdminCommandCenterService {
  constructor(private readonly db: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      users,
      activeUsers,
      newUsers24h,
      suspendedUsers,
      activeCampaigns,
      pendingCampaigns,
      paymentVolume30d,
      pendingPayments,
      failedPayments24h,
      wallets,
      openGrowthOrders,
      openVtuOrders,
      openVirtualNumberOrders,
      reviewRiskCount,
      highRiskCount
    ] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null } }),
      this.db.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      this.db.user.count({ where: { deletedAt: null, createdAt: { gte: last24Hours } } }),
      this.db.user.count({ where: { deletedAt: null, status: "SUSPENDED" } }),
      this.db.campaign.count({ where: { deletedAt: null, status: { in: ["ACTIVE", "RUNNING"] } } }),
      this.db.campaign.count({ where: { deletedAt: null, status: { in: ["PENDING_REVIEW", "CHANGES_REQUESTED"] } } }),
      this.db.paymentIntent.aggregate({ where: { status: "COMPLETED", createdAt: { gte: last30Days } }, _sum: { amountMinor: true } }),
      this.db.paymentIntent.count({ where: { status: { in: ["PENDING", "REQUIRES_ACTION"] } } }),
      this.db.paymentIntent.count({ where: { status: "FAILED", createdAt: { gte: last24Hours } } }),
      this.db.wallet.count({ where: { status: "ACTIVE" } }),
      this.db.growthOrder.count({ where: { deletedAt: null, status: { in: ["PENDING", "SUBMITTED", "IN_PROGRESS"] } } }),
      this.db.vtuOrder.count({ where: { status: { in: ["CHARGED", "SUBMITTED", "AMBIGUOUS"] } } }),
      this.db.virtualNumberOrder.count({ where: { status: { in: ["QUOTED", "CHARGED", "PROVISIONING"] } } }),
      this.db.campaignRiskAssessment.count({ where: { action: "REVIEW" } }),
      this.db.campaignRiskAssessment.count({ where: { score: { gte: 80 }, action: "REVIEW" } })
    ]);

    return {
      generatedAt: now.toISOString(),
      users: { total: users, active: activeUsers, new24h: newUsers24h, suspended: suspendedUsers },
      campaigns: { active: activeCampaigns, pendingReview: pendingCampaigns },
      payments: { volumeMinor30d: paymentVolume30d._sum.amountMinor ?? 0, pending: pendingPayments, failed24h: failedPayments24h },
      wallets: { active: wallets },
      fulfilment: { growthOpen: openGrowthOrders, vtuOpen: openVtuOrders, virtualNumbersOpen: openVirtualNumberOrders },
      risk: { review: reviewRiskCount, high: highRiskCount }
    };
  }

  async getAlerts() {
    const [unapprovedVtu, liveCapabilityGaps, degradedProviders, openReconciliation, aggressivePricingRules] = await Promise.all([
      this.db.vtuCanonicalSku.findMany({ where: { active: true, adminApproved: false }, select: { id: true, displayName: true, network: true, category: true }, orderBy: { updatedAt: "desc" }, take: 25 }),
      this.db.providerCapabilityGrant.findMany({ where: { enabled: true }, select: { id: true, providerName: true, capability: true, domain: true, documented: true, implemented: true, sandboxVerified: true, kybApproved: true, complianceApproved: true, productionApproved: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
      this.db.providerHealth.findMany({ where: { status: { in: ["DEGRADED", "DOWN"] } }, orderBy: { checkedAt: "desc" }, distinct: ["providerName"], take: 50 }),
      this.db.financialReconciliationException.findMany({ where: { status: { in: ["OPEN", "INVESTIGATING"] } }, select: { id: true, resourceType: true, resourceId: true, providerName: true, kind: true, status: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.db.pricingRule.findMany({ where: { active: true, markupBps: { gt: 10_000 } }, select: { id: true, domain: true, markupBps: true, countryCode: true, productType: true, providerName: true }, orderBy: { markupBps: "desc" }, take: 25 })
    ]);

    const alerts = [
      ...unapprovedVtu.map((row) => ({ id: `vtu:${row.id}`, severity: "warning" as const, category: "product_approval", title: "Active VTU product needs approval", detail: `${row.displayName} (${row.network} · ${row.category}) is active but not administratively approved.`, entityType: "VtuCanonicalSku", entityId: row.id, href: "/product-governance/" })),
      ...liveCapabilityGaps.filter((row) => !row.documented || !row.implemented || !row.sandboxVerified || !row.kybApproved || !row.complianceApproved || !row.productionApproved).map((row) => ({ id: `capability:${row.id}`, severity: "danger" as const, category: "provider_governance", title: "Provider capability is enabled before the full approval ladder", detail: `${row.providerName} / ${row.capability} is marked live but has unmet governance prerequisites.`, entityType: "ProviderCapabilityGrant", entityId: row.id, href: "/provider-governance/" })),
      ...degradedProviders.map((row) => ({ id: `provider:${row.providerName}`, severity: row.status === "DOWN" ? ("danger" as const) : ("warning" as const), category: "provider_health", title: `Provider ${row.status.toLowerCase()}`, detail: `${row.providerName}${row.reason ? `: ${row.reason}` : " has degraded or failed health."}`, entityType: "ProviderHealth", entityId: row.providerName, href: "/provider-governance/" })),
      ...openReconciliation.map((row) => ({ id: `reconciliation:${row.id}`, severity: "danger" as const, category: "reconciliation", title: `${row.kind.replaceAll("_", " ")} needs attention`, detail: `${row.resourceType}:${row.resourceId} disagrees with ${row.providerName}.`, entityType: "FinancialReconciliationException", entityId: row.id, href: "/reconciliation/" })),
      ...aggressivePricingRules.map((row) => ({ id: `pricing:${row.id}`, severity: "warning" as const, category: "commercial", title: "High-markup pricing rule active", detail: `${(row.markupBps / 100).toFixed(2)}% markup is active for ${row.domain}${row.countryCode ? ` / ${row.countryCode}` : ""}${row.productType ? ` / ${row.productType}` : ""}.`, entityType: "PricingRule", entityId: row.id, href: "/commercial/" }))
    ];

    const severityRank = { danger: 0, warning: 1 } as const;
    alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title));

    return { generatedAt: new Date().toISOString(), totals: { all: alerts.length, danger: alerts.filter((alert) => alert.severity === "danger").length, warning: alerts.filter((alert) => alert.severity === "warning").length }, alerts: alerts.slice(0, 150) };
  }

  async getFulfilmentOverview(days = 7) {
    const since = new Date(Date.now() - Math.max(1, Math.min(days, 90)) * 24 * 60 * 60 * 1000);
    const items = await this.collectFulfilment(since, 200);
    const byDomain = new Map<FulfilmentDomain, QueueItem[]>();
    for (const item of items) byDomain.set(item.domain, [...(byDomain.get(item.domain) ?? []), item]);

    const summary = [...byDomain.entries()].map(([domain, rows]) => ({
      domain,
      total: rows.length,
      open: rows.filter((row) => classify(row.status) === "OPEN").length,
      exceptions: rows.filter((row) => row.canOpenReconciliation).length,
      completed: rows.filter((row) => classify(row.status) === "CLOSED").length
    }));

    return {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      totals: {
        orders: items.length,
        open: items.filter((row) => classify(row.status) === "OPEN").length,
        exceptions: items.filter((row) => row.canOpenReconciliation).length
      },
      summary,
      queue: items.filter((row) => classify(row.status) !== "CLOSED").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 300)
    };
  }

  async listFulfilment(query: { domain?: FulfilmentDomain; status?: string; limit?: number } = {}) {
    const items = await this.collectFulfilment(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 400);
    return items.filter((item) => (!query.domain || item.domain === query.domain)).filter((item) => (!query.status || item.status === query.status)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, Math.min(query.limit ?? 200, 500));
  }

  async openFulfilmentReconciliation(input: { domain: FulfilmentDomain; resourceType: string; resourceId: string; kind: string; providerName: string; providerDomain: ProviderDomain; workspaceId?: string | null; reason: string }, actorUserId: string) {
    if (!input.reason.trim()) throw new BadRequestException("A reconciliation reason is required.");
    const item = (await this.listFulfilment({ domain: input.domain, limit: 500 })).find((candidate) => candidate.id === input.resourceId);
    if (!item) throw new NotFoundException("Fulfilment resource was not found in the operations queue.");

    const exception = await this.db.financialReconciliationException.upsert({
      where: { resourceType_resourceId_kind: { resourceType: input.resourceType, resourceId: input.resourceId, kind: input.kind as never } },
      create: { workspaceId: input.workspaceId ?? item.workspaceId, resourceType: input.resourceType, resourceId: input.resourceId, domain: input.providerDomain, providerName: input.providerName, kind: input.kind as never, status: "OPEN", providerReference: item.providerReference, detail: input.reason.trim(), metadata: { source: "admin_fulfilment", actorUserId } },
      update: { status: "OPEN", providerName: input.providerName, workspaceId: input.workspaceId ?? item.workspaceId, providerReference: item.providerReference, detail: input.reason.trim(), metadata: { source: "admin_fulfilment", actorUserId } }
    });

    await this.db.auditLog.create({ data: { actorUserId, action: "fulfilment.reconciliation_opened", entityType: input.resourceType, entityId: input.resourceId, metadata: { domain: input.domain, providerName: input.providerName, kind: input.kind, reason: input.reason.trim(), exceptionId: exception.id } } });
    return exception;
  }

  private async collectFulfilment(since: Date, take: number): Promise<QueueItem[]> {
    const [growth, vtu, telecom, numbers, digitalAccess, giftCards, cashout, remittance, rmb, guest, withdrawals] = await Promise.all([
      this.db.growthOrder.findMany({ where: { createdAt: { gte: since }, deletedAt: null }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, supplierName: true, supplierReference: true, failureReason: true, serviceName: true, quantityOrdered: true, quantityDelivered: true, createdAt: true, updatedAt: true } }),
      this.db.vtuOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, providerName: true, providerReference: true, failureReason: true, productType: true, network: true, createdAt: true, updatedAt: true } }),
      this.db.telecomOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, providerName: true, providerReference: true, failureReason: true, productType: true, operatorName: true, countryIso: true, createdAt: true, updatedAt: true } }),
      this.db.virtualNumberOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, providerName: true, providerReference: true, failureReason: true, productId: true, createdAt: true, updatedAt: true } }),
      this.db.digitalAccessRequest.findMany({ where: { createdAt: { gte: since }, deletedAt: null }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, notes: true, serviceId: true, planId: true, assignedTo: true, createdAt: true, updatedAt: true } }),
      this.db.giftCardPurchaseTransaction.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, customerPriceNgn: true, supplierName: true, supplierOrderId: true, supplierTransactionId: true, brand: true, region: true, createdAt: true, updatedAt: true } }),
      this.db.airtimeCashoutTransaction.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, customerPayoutNgn: true, providerName: true, providerTransactionId: true, network: true, createdAt: true, updatedAt: true } }),
      this.db.remittanceTransfer.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, sourceAmountMinor: true, sourceCurrency: true, providerName: true, providerReference: true, recipientCountry: true, createdAt: true, updatedAt: true } }),
      this.db.rmbOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, ngnAmountMinor: true, providerName: true, providerReference: true, channel: true, createdAt: true, updatedAt: true } }),
      this.db.guestTransaction.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, email: true, productType: true, amountMinor: true, currency: true, paymentStatus: true, fulfilmentStatus: true, provider: true, providerReference: true, failureReason: true, createdAt: true, updatedAt: true } }),
      this.db.walletWithdrawal.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, providerName: true, providerReference: true, failureReason: true, recipientName: true, createdAt: true, updatedAt: true } })
    ]);

    const item = (domain: FulfilmentDomain, id: string, status: string, workspaceId: string | null, createdAt: Date, updatedAt: Date, amountMinor: number | null, currency: string | null, providerName: string | null, providerReference: string | null, failureReason: string | null, title: string, customerLabel: string | null, metadata: Record<string, unknown>): QueueItem => ({ id, domain, status, workspaceId, createdAt, updatedAt, amountMinor, currency, providerName, providerReference, failureReason, title, customerLabel, canOpenReconciliation: EXCEPTION_STATUSES.has(status), metadata });

    return [
      ...growth.map((row) => item("GROWTH", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.amountMinor, row.currency, row.supplierName, row.supplierReference, row.failureReason, row.serviceName, null, { quantityOrdered: row.quantityOrdered, quantityDelivered: row.quantityDelivered })),
      ...vtu.map((row) => item("VTU", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.amountMinor, row.currency, row.providerName, row.providerReference, row.failureReason, `${row.productType}${row.network ? ` · ${row.network}` : ""}`, null, {})),
      ...telecom.map((row) => item("TELECOM", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.amountMinor, row.currency, row.providerName, row.providerReference, row.failureReason, `${row.countryIso} · ${row.operatorName ?? row.productType}`, null, {})),
      ...numbers.map((row) => item("VIRTUAL_NUMBER", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.amountMinor, row.currency, row.providerName, row.providerReference, row.failureReason, `Virtual number · ${row.productId}`, null, {})),
      ...digitalAccess.map((row) => item("DIGITAL_ACCESS", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.amountMinor, row.currency, null, null, row.notes, `Digital access · ${row.planId}`, row.assignedTo, { serviceId: row.serviceId })),
      ...giftCards.map((row) => item("GIFT_CARD", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.customerPriceNgn, "NGN", row.supplierName, row.supplierTransactionId ?? row.supplierOrderId, null, `${row.brand} · ${row.region}`, null, {})),
      ...cashout.map((row) => item("AIRTIME_CASHOUT", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.customerPayoutNgn, "NGN", row.providerName, row.providerTransactionId, null, `${row.network} cashout`, null, {})),
      ...remittance.map((row) => item("REMITTANCE", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.sourceAmountMinor, row.sourceCurrency, row.providerName, row.providerReference, null, `Remittance · ${row.recipientCountry}`, null, {})),
      ...rmb.map((row) => item("RMB", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.ngnAmountMinor, "NGN", row.providerName, row.providerReference, null, `RMB · ${row.channel}`, null, {})),
      ...guest.map((row) => item("GUEST_CHECKOUT", row.id, row.fulfilmentStatus, null, row.createdAt, row.updatedAt, row.amountMinor, row.currency, row.provider, row.providerReference, row.failureReason, `${row.productType} · ${row.email}`, row.email, { paymentStatus: row.paymentStatus })),
      ...withdrawals.map((row) => item("WALLET_WITHDRAWAL", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, row.amountMinor, row.currency, row.providerName, row.providerReference, row.failureReason, `Withdrawal · ${row.recipientName}`, null, {}))
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}
