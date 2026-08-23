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
}
