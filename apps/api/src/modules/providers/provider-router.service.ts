import { Injectable } from "@nestjs/common";

import { buildHealthMap, selectProviders } from "@fliptrybe/providers";
import type { ProviderDomain, RouterScope } from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";

/**
 * Generic, domain-agnostic entry point for "which real provider should
 * fulfil this order" — vtu, virtual-numbers, telecom-gateway, digital-value,
 * crypto, rmb, and financial-products all call this instead of hardcoding
 * their own provider-selection logic.
 *
 * The actual scoring/ranking lives in @fliptrybe/providers' router.ts
 * (selectProviders / buildHealthMap) so it stays framework-agnostic and
 * testable without Prisma. This service is just the DB-reading + audit-trail
 * wrapper around it.
 */
@Injectable()
export class ProviderRouterService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async select(
    domain: ProviderDomain,
    scope: RouterScope,
    orderType: string,
    orderId: string
  ): Promise<{ providerName: string } | null> {
    const configs = await this.db.providerConfig.findMany({
      where: { domain, deletedAt: null }
    });

    // Hard capability gate: a provider is only routable for a domain if it
    // holds an explicit, enabled ProviderCapabilityGrant for that domain.
    // ProviderConfig alone is not sufficient — the grant is the earned
    // allowlist (documented -> implemented -> sandboxVerified -> kybApproved
    // -> complianceApproved -> productionApproved -> enabled), never defaulted
    // true. A provider present in ProviderConfig but ungranted is treated the
    // same as "no candidate", not silently routed.
    const grants = await this.db.providerCapabilityGrant.findMany({
      where: { domain, enabled: true, providerName: { in: configs.map((c) => c.name) } }
    });
    const grantedNames = new Set(grants.map((g) => g.providerName));
    const eligibleConfigs = configs.filter((c) => grantedNames.has(c.name));

    const healthRows = await this.db.providerHealth.findMany({
      where: { domain, providerName: { in: eligibleConfigs.map((c) => c.name) } },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });
    const healthMap = buildHealthMap(healthRows);

    const ranked = selectProviders({ domain, scope }, eligibleConfigs, healthMap);
    const winner = ranked.find((candidate) => candidate.available);

    if (!winner) {
      const ungrantedButConfigured = configs.filter((c) => !grantedNames.has(c.name)).map((c) => c.name);
      const reason =
        eligibleConfigs.length === 0 && configs.length > 0
          ? `${configs.length} ProviderConfig row(s) exist for domain ${domain} but none hold an enabled ` +
            `ProviderCapabilityGrant for it (ungranted: ${ungrantedButConfigured.join(", ")}).`
          : `No available ProviderConfig for domain ${domain} (scope: ${JSON.stringify(scope)}).`;
      await this.db.providerRoutingAttempt.create({
        data: {
          domain,
          orderType,
          orderId,
          providerName: "NONE",
          score: 0,
          status: "NO_CANDIDATE",
          reason
        }
      });
      return null;
    }

    await this.db.providerRoutingAttempt.create({
      data: {
        domain,
        orderType,
        orderId,
        providerName: winner.providerName,
        score: winner.score,
        status: "SELECTED",
        reason: null
      }
    });

    return { providerName: winner.providerName };
  }
}
