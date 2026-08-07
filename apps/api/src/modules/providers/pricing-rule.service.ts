import { Injectable } from "@nestjs/common";
import type { ProviderDomain } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";

export interface PricingRuleFilter {
  countryCode?: string;
  network?: string;
  productType?: string;
  providerName?: string;
}

@Injectable()
export class PricingRuleService {
  constructor(private readonly prismaService: PrismaService) {}

  private get db() {
    return this.prismaService.client;
  }

  // Picks the single most specific active rule matching the given filter — an
  // empty/null column on a rule means "matches anything" for that dimension, so
  // more populated columns == more specific. `specificity` breaks ties when two
  // rules would otherwise match equally (set by whoever manages the rule).
  async resolveMarkupBps(
    domain: ProviderDomain,
    filter: PricingRuleFilter,
    fallbackBps: number
  ): Promise<number> {
    const rules = await this.db.pricingRule.findMany({
      where: {
        domain,
        active: true,
        OR: [
          { countryCode: null },
          ...(filter.countryCode ? [{ countryCode: filter.countryCode }] : [])
        ]
      },
      orderBy: [{ specificity: "desc" }, { updatedAt: "desc" }]
    });

    const match = rules.find((rule) => {
      if (rule.countryCode && rule.countryCode !== filter.countryCode) return false;
      if (rule.network && rule.network !== filter.network) return false;
      if (rule.productType && rule.productType !== filter.productType) return false;
      if (rule.providerName && rule.providerName !== filter.providerName) return false;
      return true;
    });

    return match ? match.markupBps : fallbackBps;
  }

  async list(domain?: ProviderDomain) {
    return this.db.pricingRule.findMany({
      where: domain ? { domain } : {},
      orderBy: [{ domain: "asc" }, { specificity: "desc" }]
    });
  }

  async create(data: {
    domain: ProviderDomain;
    countryCode?: string;
    network?: string;
    productType?: string;
    providerName?: string;
    markupBps: number;
    specificity?: number;
  }) {
    const specificity =
      data.specificity ??
      [data.countryCode, data.network, data.productType, data.providerName].filter(Boolean).length;

    return this.db.pricingRule.create({
      data: { ...data, specificity, active: true }
    });
  }

  async setActive(id: string, active: boolean) {
    return this.db.pricingRule.update({ where: { id }, data: { active } });
  }
}
