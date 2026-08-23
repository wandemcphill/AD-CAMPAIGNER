import { Injectable } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

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
      this.db.campaign.count({
        where: {
          deletedAt: null,
          status: { in: ["ACTIVE", "RUNNING"] }
        }
      }),
      this.db.campaign.count({
        where: {
          deletedAt: null,
          status: { in: ["PENDING_REVIEW", "CHANGES_REQUESTED"] }
        }
      }),
      this.db.paymentIntent.aggregate({
        where: { status: "COMPLETED", createdAt: { gte: last30Days } },
        _sum: { amountMinor: true }
      }),
      this.db.paymentIntent.count({ where: { status: { in: ["PENDING", "REQUIRES_ACTION"] } } }),
      this.db.paymentIntent.count({ where: { status: "FAILED", createdAt: { gte: last24Hours } } }),
      this.db.wallet.count({ where: { status: "ACTIVE" } }),
      this.db.growthOrder.count({
        where: { deletedAt: null, status: { in: ["PENDING", "SUBMITTED", "IN_PROGRESS"] } }
      }),
      this.db.vtuOrder.count({
        where: { status: { in: ["CHARGED", "SUBMITTED", "AMBIGUOUS"] } }
      }),
      this.db.virtualNumberOrder.count({
        where: { status: { in: ["QUOTED", "CHARGED", "PROVISIONING"] } }
      }),
      this.db.campaignRiskAssessment.count({ where: { action: "REVIEW" } }),
      this.db.campaignRiskAssessment.count({ where: { score: { gte: 80 }, action: "REVIEW" } })
    ]);

    return {
      generatedAt: now.toISOString(),
      users: {
        total: users,
        active: activeUsers,
        new24h: newUsers24h,
        suspended: suspendedUsers
      },
      campaigns: {
        active: activeCampaigns,
        pendingReview: pendingCampaigns
      },
      payments: {
        volumeMinor30d: paymentVolume30d._sum.amountMinor ?? 0,
        pending: pendingPayments,
        failed24h: failedPayments24h
      },
      wallets: {
        active: wallets
      },
      fulfilment: {
        growthOpen: openGrowthOrders,
        vtuOpen: openVtuOrders,
        virtualNumbersOpen: openVirtualNumberOrders
      },
      risk: {
        review: reviewRiskCount,
        high: highRiskCount
      }
    };
  }

  async getAlerts() {
    const [
      unapprovedVtu,
      liveCapabilityGaps,
      degradedProviders,
      openReconciliation,
      aggressivePricingRules
    ] = await Promise.all([
      this.db.vtuCanonicalSku.findMany({
        where: { active: true, adminApproved: false },
        select: { id: true, displayName: true, network: true, category: true },
        orderBy: { updatedAt: "desc" },
        take: 25
      }),
      this.db.providerCapabilityGrant.findMany({
        where: { enabled: true },
        select: {
          id: true,
          providerName: true,
          capability: true,
          domain: true,
          documented: true,
          implemented: true,
          sandboxVerified: true,
          kybApproved: true,
          complianceApproved: true,
          productionApproved: true
        },
        orderBy: { updatedAt: "desc" },
        take: 100
      }),
      this.db.providerHealth.findMany({
        where: { status: { in: ["DEGRADED", "DOWN"] } },
        orderBy: { checkedAt: "desc" },
        distinct: ["providerName"],
        take: 50
      }),
      this.db.financialReconciliationException.findMany({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        select: { id: true, resourceType: true, resourceId: true, providerName: true, kind: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      this.db.pricingRule.findMany({
        where: { active: true, markupBps: { gt: 10_000 } },
        select: { id: true, domain: true, markupBps: true, countryCode: true, productType: true, providerName: true },
        orderBy: { markupBps: "desc" },
        take: 25
      })
    ]);

    const alerts = [
      ...unapprovedVtu.map((row) => ({
        id: `vtu:${row.id}`,
        severity: "warning" as const,
        category: "product_approval",
        title: "Active VTU product needs approval",
        detail: `${row.displayName} (${row.network} · ${row.category}) is active but not administratively approved.`,
        entityType: "VtuCanonicalSku",
        entityId: row.id,
        href: "/product-governance/"
      })),
      ...liveCapabilityGaps
        .filter(
          (row) =>
            !row.documented ||
            !row.implemented ||
            !row.sandboxVerified ||
            !row.kybApproved ||
            !row.complianceApproved ||
            !row.productionApproved
        )
        .map((row) => ({
          id: `capability:${row.id}`,
          severity: "danger" as const,
          category: "provider_governance",
          title: "Provider capability is enabled before the full approval ladder",
          detail: `${row.providerName} / ${row.capability} is marked live but has unmet governance prerequisites.`,
          entityType: "ProviderCapabilityGrant",
          entityId: row.id,
          href: "/provider-governance/"
        })),
      ...degradedProviders.map((row) => ({
        id: `provider:${row.providerName}`,
        severity: row.status === "DOWN" ? ("danger" as const) : ("warning" as const),
        category: "provider_health",
        title: `Provider ${row.status.toLowerCase()}`,
        detail: `${row.providerName}${row.reason ? `: ${row.reason}` : " has degraded or failed health."}`,
        entityType: "ProviderHealth",
        entityId: row.providerName,
        href: "/provider-governance/"
      })),
      ...openReconciliation.map((row) => ({
        id: `reconciliation:${row.id}`,
        severity: "danger" as const,
        category: "reconciliation",
        title: `${row.kind.replaceAll("_", " ")} needs attention`,
        detail: `${row.resourceType}:${row.resourceId} disagrees with ${row.providerName}.`,
        entityType: "FinancialReconciliationException",
        entityId: row.id,
        href: "/reconciliation/"
      })),
      ...aggressivePricingRules.map((row) => ({
        id: `pricing:${row.id}`,
        severity: "warning" as const,
        category: "commercial",
        title: "High-markup pricing rule active",
        detail: `${(row.markupBps / 100).toFixed(2)}% markup is active for ${row.domain}${row.countryCode ? ` / ${row.countryCode}` : ""}${row.productType ? ` / ${row.productType}` : ""}.`,
        entityType: "PricingRule",
        entityId: row.id,
        href: "/commercial/"
      }))
    ];

    const severityRank = { danger: 0, warning: 1 } as const;
    alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title));

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        all: alerts.length,
        danger: alerts.filter((alert) => alert.severity === "danger").length,
        warning: alerts.filter((alert) => alert.severity === "warning").length
      },
      alerts: alerts.slice(0, 150)
    };
  }
}
