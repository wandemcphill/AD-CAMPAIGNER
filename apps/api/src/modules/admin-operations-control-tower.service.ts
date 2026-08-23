import { Injectable } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import { AdminCommandCenterService } from "./admin-command-center.service";

@Injectable()
export class AdminOperationsControlTowerService {
  constructor(
    private readonly db: PrismaService,
    private readonly commandCenter: AdminCommandCenterService
  ) {}

  async overview() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      paymentFailures,
      pendingPayments,
      reconciliation,
      providerHealth,
      auditActivity,
      alerts,
      fulfilment
    ] = await Promise.all([
      this.db.paymentIntent.count({
        where: { status: "FAILED", createdAt: { gte: since24h } }
      }),
      this.db.paymentIntent.count({
        where: { status: { in: ["PENDING", "REQUIRES_ACTION"] } }
      }),
      this.db.financialReconciliationException.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.db.providerHealth.findMany({
        where: { status: { in: ["DEGRADED", "DOWN"] } },
        orderBy: { checkedAt: "desc" },
        distinct: ["providerName"],
        take: 20,
        select: {
          providerName: true,
          status: true,
          latencyMs: true,
          reason: true,
          checkedAt: true
        }
      }),
      this.db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, actorUserId: true, action: true, entityType: true, entityId: true, createdAt: true }
      }),
      this.commandCenter.getAlerts(),
      this.commandCenter.getFulfilmentOverview(7)
    ]);

    const reconciliationCounts = Object.fromEntries(
      reconciliation.map((row) => [row.status, row._count._all])
    );

    return {
      generatedAt: new Date().toISOString(),
      money: {
        failedPayments24h: paymentFailures,
        pendingPayments,
        reconciliationOpen: Number(reconciliationCounts.OPEN ?? 0),
        reconciliationInvestigating: Number(reconciliationCounts.INVESTIGATING ?? 0),
        reconciliationResolved: Number(reconciliationCounts.RESOLVED ?? 0)
      },
      fulfilment: fulfilment.totals,
      providers: {
        degraded: providerHealth.filter((row) => row.status === "DEGRADED").length,
        down: providerHealth.filter((row) => row.status === "DOWN").length,
        incidents: providerHealth
      },
      governance: {
        alerts: alerts.totals,
        recentPrivilegedActivity: auditActivity
      }
    };
  }

  async queue() {
    const [alerts, fulfilment, reconciliation, paymentFailures] = await Promise.all([
      this.commandCenter.getAlerts(),
      this.commandCenter.getFulfilmentOverview(7),
      this.db.financialReconciliationException.findMany({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, resourceType: true, resourceId: true, providerName: true, kind: true, status: true, createdAt: true }
      }),
      this.db.paymentIntent.findMany({
        where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, workspaceId: true, gateway: true, providerReference: true, amountMinor: true, currency: true, createdAt: true }
      })
    ]);

    const items = [
      ...alerts.alerts.map((alert) => ({
        id: `alert:${alert.id}`,
        priority: alert.severity,
        type: "GOVERNANCE" as const,
        title: alert.title,
        detail: alert.detail,
        href: alert.href,
        createdAt: alerts.generatedAt
      })),
      ...fulfilment.queue.slice(0, 80).map((item) => ({
        id: `fulfilment:${item.domain}:${item.id}`,
        priority: item.canOpenReconciliation ? ("danger" as const) : ("warning" as const),
        type: "FULFILMENT" as const,
        title: `${item.domain.replaceAll("_", " ")} · ${item.status}`,
        detail: item.failureReason ?? item.title,
        href: "/fulfilment/",
        createdAt: item.updatedAt.toISOString()
      })),
      ...reconciliation.map((row) => ({
        id: `reconciliation:${row.id}`,
        priority: "danger" as const,
        type: "RECONCILIATION" as const,
        title: `${row.kind.replaceAll("_", " ")} · ${row.status}`,
        detail: `${row.resourceType}:${row.resourceId} · ${row.providerName}`,
        href: "/reconciliation/",
        createdAt: row.createdAt.toISOString()
      })),
      ...paymentFailures.map((payment) => ({
        id: `payment:${payment.id}`,
        priority: "danger" as const,
        type: "PAYMENT" as const,
        title: "Failed payment",
        detail: `${payment.gateway} · ${payment.providerReference ?? payment.id}`,
        href: "/finance/payments/",
        createdAt: payment.createdAt.toISOString()
      }))
    ];

    const rank = { danger: 0, warning: 1 } as const;
    items.sort((a, b) => rank[a.priority] - rank[b.priority] || b.createdAt.localeCompare(a.createdAt));

    return {
      generatedAt: new Date().toISOString(),
      totals: { all: items.length, danger: items.filter((item) => item.priority === "danger").length, warning: items.filter((item) => item.priority === "warning").length },
      items: items.slice(0, 250)
    };
  }
}
