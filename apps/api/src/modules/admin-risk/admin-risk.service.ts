import { Injectable } from "@nestjs/common";

import type { DatabaseClient } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";

@Injectable()
export class AdminRiskService {
  constructor(private readonly prismaService: PrismaService) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  async overview() {
    const [
      campaignReviews,
      campaignHighRisk,
      openReconciliation,
      failedPayments24h,
      suspendedUsers,
      unverifiedKyc,
      recentAudit
    ] = await Promise.all([
      this.db.campaignRiskAssessment.count({ where: { action: "REVIEW" } }),
      this.db.campaignRiskAssessment.count({ where: { action: "REVIEW", score: { gte: 80 } } }),
      this.db.financialReconciliationException.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
      this.db.paymentIntent.count({
        where: {
          status: "FAILED",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),
      this.db.user.count({ where: { status: "SUSPENDED", deletedAt: null } }),
      this.db.kycVerification.count({ where: { status: { in: ["PENDING", "REQUIRES_ACTION"] } } }),
      this.db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          actorUserId: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        campaignReviews,
        campaignHighRisk,
        openReconciliation,
        failedPayments24h,
        suspendedUsers,
        kycPending: unverifiedKyc
      },
      severity:
        campaignHighRisk + openReconciliation > 0
          ? "HIGH"
          : campaignReviews + failedPayments24h + unverifiedKyc > 0
            ? "WATCH"
            : "NORMAL",
      recentAudit
    };
  }

  async campaignReviews(limit = 100) {
    return this.db.campaignRiskAssessment.findMany({
      where: { action: "REVIEW" },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            workspaceId: true,
            budgetMinor: true,
            currency: true,
            riskAction: true,
            riskScore: true
          }
        }
      }
    });
  }
}
