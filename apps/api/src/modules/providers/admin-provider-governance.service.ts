import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { CAPABILITY_LADDER } from "./providers.service";

@Injectable()
export class AdminProviderGovernanceService {
  constructor(private readonly db: PrismaService) {}

  async overview() {
    const [configs, grants, pricingRules, health, reconciliation] = await Promise.all([
      this.db.providerConfig.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, domain: true, status: true, priority: true, updatedAt: true },
        orderBy: [{ domain: "asc" }, { priority: "asc" }, { name: "asc" }]
      }),
      this.db.providerCapabilityGrant.findMany({
        select: {
          id: true,
          providerName: true,
          capability: true,
          domain: true,
          enabled: true,
          priority: true,
          documented: true,
          implemented: true,
          sandboxVerified: true,
          kybApproved: true,
          complianceApproved: true,
          productionApproved: true,
          updatedAt: true
        },
        orderBy: [{ domain: "asc" }, { priority: "asc" }, { providerName: "asc" }]
      }),
      this.db.pricingRule.findMany({
        where: { active: true },
        select: { id: true, domain: true, countryCode: true, productType: true, providerName: true, markupBps: true, active: true },
        orderBy: [{ domain: "asc" }, { markupBps: "desc" }],
        take: 500
      }),
      this.db.providerHealth.findMany({
        orderBy: { checkedAt: "desc" },
        distinct: ["providerName"],
        take: 200
      }),
      this.db.financialReconciliationException.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } })
    ]);

    const healthByProvider = new Map(health.map((row) => [row.providerName, row]));
    const grantSummary = grants.map((grant) => {
      const nextRung = CAPABILITY_LADDER.find((rung) => !grant[rung]);
      return {
        ...grant,
        nextRung: nextRung ?? null,
        complete: nextRung === undefined,
        routable: grant.enabled && configs.some((config) => config.name === grant.providerName && config.status !== "DISABLED")
      };
    });

    const providerSummary = configs.map((config) => {
      const latest = healthByProvider.get(config.name);
      const providerGrants = grantSummary.filter((grant) => grant.providerName === config.name);
      return {
        ...config,
        health: latest
          ? {
              status: latest.status,
              latencyMs: latest.latencyMs,
              successRateBps: latest.successRateBps,
              balanceMinor: latest.balanceMinor,
              currency: latest.currency,
              reason: latest.reason,
              checkedAt: latest.checkedAt
            }
          : null,
        grants: providerGrants
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        providers: configs.length,
        healthy: configs.filter((config) => config.status === "HEALTHY").length,
        disabled: configs.filter((config) => config.status === "DISABLED").length,
        degraded: configs.filter((config) => config.status === "DEGRADED").length,
        grants: grants.length,
        liveGrants: grants.filter((grant) => grant.enabled).length,
        pricingRules: pricingRules.length,
        openReconciliation: reconciliation
      },
      providers: providerSummary,
      grants: grantSummary,
      pricingRules
    };
  }
}
