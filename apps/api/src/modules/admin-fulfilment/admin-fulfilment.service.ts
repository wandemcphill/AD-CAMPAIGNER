import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
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

function moneyFields(row: { amountMinor?: number | null; currency?: string | null }) {
  return {
    amountMinor: row.amountMinor ?? null,
    currency: row.currency ?? null
  };
}

function classify(status: string) {
  if (EXCEPTION_STATUSES.has(status)) return "EXCEPTION" as const;
  if (OPEN_FULFILMENT.has(status)) return "OPEN" as const;
  return "CLOSED" as const;
}

@Injectable()
export class AdminFulfilmentService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async overview(days = 7) {
    const since = new Date(Date.now() - Math.max(1, Math.min(days, 90)) * 24 * 60 * 60 * 1000);
    const [items, reconciliations] = await Promise.all([
      this.collectAll(since, 200),
      this.db.financialReconciliationException.findMany({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          resourceType: true,
          resourceId: true,
          domain: true,
          providerName: true,
          kind: true,
          status: true,
          detail: true,
          createdAt: true,
          workspaceId: true
        }
      })
    ]);

    const byDomain = new Map<FulfilmentDomain, QueueItem[]>();
    for (const item of items) {
      const list = byDomain.get(item.domain) ?? [];
      list.push(item);
      byDomain.set(item.domain, list);
    }

    const summary = [...byDomain.entries()].map(([domain, domainItems]) => {
      const open = domainItems.filter((item) => classify(item.status) === "OPEN").length;
      const exceptions = domainItems.filter((item) => item.canOpenReconciliation).length;
      const completed = domainItems.filter((item) => classify(item.status) === "CLOSED").length;
      return { domain, total: domainItems.length, open, exceptions, completed };
    });

    return {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      totals: {
        orders: items.length,
        open: items.filter((item) => classify(item.status) === "OPEN").length,
        exceptions: items.filter((item) => item.canOpenReconciliation).length,
        reconciliationOpen: reconciliations.length
      },
      summary,
      queue: items
        .filter((item) => classify(item.status) !== "CLOSED")
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 200),
      recentExceptions: reconciliations
    };
  }

  async listQueue(query: { domain?: FulfilmentDomain; status?: string; limit?: number } = {}) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const items = await this.collectAll(since, Math.max(50, Math.min(query.limit ?? 500, 1000)));
    return items
      .filter((item) => (!query.domain || item.domain === query.domain))
      .filter((item) => (!query.status || item.status === query.status))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, Math.min(query.limit ?? 200, 500));
  }

  async openReconciliation(
    resourceType: string,
    resourceId: string,
    kind: string,
    providerName: string,
    domain: ProviderDomain,
    workspaceId: string | null,
    reason: string,
    actorUserId: string
  ) {
    if (!reason.trim()) throw new BadRequestException("A reconciliation reason is required.");
    const item = (await this.listQueue({ limit: 1000 })).find(
      (candidate) => candidate.id === resourceId && candidate.domain === this.normalizeDomain(domain)
    );
    if (!item) throw new NotFoundException("Fulfilment resource was not found in the operations queue.");

    const exception = await this.db.financialReconciliationException.upsert({
      where: {
        resourceType_resourceId_kind: {
          resourceType,
          resourceId,
          kind: kind as never
        }
      },
      create: {
        workspaceId,
        resourceType,
        resourceId,
        domain,
        providerName,
        kind: kind as never,
        status: "OPEN",
        providerReference: item.providerReference,
        detail: reason.trim(),
        metadata: { source: "admin_fulfilment", actorUserId }
      },
      update: {
        status: "OPEN",
        providerName,
        workspaceId,
        providerReference: item.providerReference,
        detail: reason.trim(),
        metadata: { source: "admin_fulfilment", actorUserId }
      }
    });

    await this.db.auditLog.create({
      data: {
        actorUserId,
        action: "fulfilment.reconciliation_opened",
        entityType: resourceType,
        entityId: resourceId,
        metadata: { domain, providerName, kind, reason: reason.trim(), exceptionId: exception.id }
      }
    });

    return exception;
  }

  private normalizeDomain(domain: string): FulfilmentDomain {
    return domain as FulfilmentDomain;
  }

  private async collectAll(since: Date, take: number): Promise<QueueItem[]> {
    const [
      growth,
      vtu,
      telecom,
      numbers,
      digitalAccess,
      giftCards,
      cashout,
      remittance,
      rmb,
      guest,
      withdrawals
    ] = await Promise.all([
      this.db.growthOrder.findMany({ where: { createdAt: { gte: since }, deletedAt: null }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, supplierName: true, supplierReference: true, failureReason: true, serviceName: true, quantityOrdered: true, quantityDelivered: true, createdAt: true, updatedAt: true } }),
      this.db.vtuOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, providerName: true, providerReference: true, failureReason: true, productType: true, network: true, createdAt: true, updatedAt: true } }),
      this.db.telecomOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, providerName: true, providerReference: true, failureReason: true, productType: true, operatorName: true, countryIso: true, createdAt: true, updatedAt: true } }),
      this.db.virtualNumberOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, providerName: true, providerReference: true, failureReason: true, productId: true, createdAt: true, updatedAt: true } }),
      this.db.digitalAccessRequest.findMany({ where: { createdAt: { gte: since }, deletedAt: null }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, notes: true, serviceId: true, planId: true, assignedTo: true, createdAt: true, updatedAt: true } }),
      this.db.giftCardPurchaseTransaction.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, customerPriceNgn: true, supplierName: true, supplierOrderId: true, supplierTransactionId: true, createdAt: true, updatedAt: true } }),
      this.db.airtimeCashoutTransaction.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, customerPayoutNgn: true, providerName: true, providerTransactionId: true, createdAt: true, updatedAt: true } }),
      this.db.remittanceTransfer.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, sourceAmountMinor: true, sourceCurrency: true, providerName: true, providerReference: true, createdAt: true, updatedAt: true } }),
      this.db.rmbOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, ngnAmountMinor: true, providerName: true, providerReference: true, channel: true, createdAt: true, updatedAt: true } }),
      this.db.guestTransaction.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, email: true, productType: true, amountMinor: true, currency: true, paymentStatus: true, fulfilmentStatus: true, provider: true, providerReference: true, failureReason: true, createdAt: true, updatedAt: true } }),
      this.db.walletWithdrawal.findMany({ where: { createdAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take, select: { id: true, workspaceId: true, status: true, amountMinor: true, currency: true, providerName: true, providerReference: true, failureReason: true, recipientName: true, createdAt: true, updatedAt: true } })
    ]);

    return [
      ...growth.map((row) => this.item("GROWTH", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, moneyFields(row), row.supplierName, row.supplierReference, row.failureReason, row.serviceName, null, { quantityOrdered: row.quantityOrdered, quantityDelivered: row.quantityDelivered })),
      ...vtu.map((row) => this.item("VTU", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, moneyFields(row), row.providerName, row.providerReference, row.failureReason, `${row.productType}${row.network ? ` · ${row.network}` : ""}`, null, {})),
      ...telecom.map((row) => this.item("TELECOM", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, moneyFields(row), row.providerName, row.providerReference, row.failureReason, `${row.countryIso} · ${row.operatorName ?? row.productType}`, null, {})),
      ...numbers.map((row) => this.item("VIRTUAL_NUMBER", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, moneyFields(row), row.providerName, row.providerReference, row.failureReason, `Virtual number product ${row.productId}`, null, {})),
      ...digitalAccess.map((row) => this.item("DIGITAL_ACCESS", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, moneyFields(row), null, null, row.notes, `Digital access plan ${row.planId}`, row.assignedTo, { serviceId: row.serviceId })),
      ...giftCards.map((row) => this.item("GIFT_CARD", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, { amountMinor: row.customerPriceNgn, currency: "NGN" }, row.supplierName, row.supplierTransactionId ?? row.supplierOrderId, null, `${row.brand} · ${row.region}`, null, {})),
      ...cashout.map((row) => this.item("AIRTIME_CASHOUT", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, { amountMinor: row.customerPayoutNgn, currency: "NGN" }, row.providerName, row.providerTransactionId, null, `${row.network} cashout`, null, {})),
      ...remittance.map((row) => this.item("REMITTANCE", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, { amountMinor: row.sourceAmountMinor, currency: row.sourceCurrency }, row.providerName, row.providerReference, null, `Remittance to ${row.recipientCountry}`, null, {})),
      ...rmb.map((row) => this.item("RMB", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, { amountMinor: row.ngnAmountMinor, currency: "NGN" }, row.providerName, row.providerReference, null, `RMB · ${row.channel}`, null, {})),
      ...guest.map((row) => this.item("GUEST_CHECKOUT", row.id, row.fulfilmentStatus, null, row.createdAt, row.updatedAt, { amountMinor: row.amountMinor, currency: row.currency }, row.provider, row.providerReference, row.failureReason, `${row.productType} · ${row.email}`, row.email, { paymentStatus: row.paymentStatus })),
      ...withdrawals.map((row) => this.item("WALLET_WITHDRAWAL", row.id, row.status, row.workspaceId, row.createdAt, row.updatedAt, moneyFields(row), row.providerName, row.providerReference, row.failureReason, `Withdrawal · ${row.recipientName}`, null, {}))
    ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  private item(
    domain: FulfilmentDomain,
    id: string,
    status: string,
    workspaceId: string | null,
    createdAt: Date,
    updatedAt: Date,
    money: { amountMinor: number | null; currency: string | null },
    providerName: string | null,
    providerReference: string | null,
    failureReason: string | null,
    title: string,
    customerLabel: string | null,
    metadata: Record<string, unknown>
  ): QueueItem {
    return {
      id,
      domain,
      status,
      workspaceId,
      createdAt,
      updatedAt,
      amountMinor: money.amountMinor,
      currency: money.currency,
      providerName,
      providerReference,
      failureReason,
      title,
      customerLabel,
      canOpenReconciliation: EXCEPTION_STATUSES.has(status),
      metadata
    };
  }
}
