import { BadRequestException, Injectable } from "@nestjs/common";
import type { ProviderDomain } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";

// A pricing rule silently reprices every sale in its domain, so the input is
// bounded the way admin FX rate changes are (see FxService.setRate): a hard
// ceiling, plus explicit confirmation before anything unusually large lands.
const MAX_MARKUP_BPS = 50_000; // 500% — absurd ceiling, never a legitimate typo
const HIGH_MARKUP_BPS = 10_000; // 100% — plausible but wants a deliberate confirm

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

  async create(
    data: {
      domain: ProviderDomain;
      countryCode?: string;
      network?: string;
      productType?: string;
      providerName?: string;
      markupBps: number;
      specificity?: number;
      confirmHighMarkup?: boolean;
    },
    context?: Partial<AuthenticatedRequestContext>
  ) {
    const { confirmHighMarkup, ...rule } = data;

    this.assertMarkupIsSane(rule.markupBps, confirmHighMarkup);

    const specificity =
      rule.specificity ??
      [rule.countryCode, rule.network, rule.productType, rule.providerName].filter(Boolean).length;

    const created = await this.db.pricingRule.create({
      data: { ...rule, specificity, active: true }
    });

    await this.recordAudit(context, "pricing_rule.created", created.id, {
      domain: created.domain,
      markupBps: created.markupBps,
      countryCode: created.countryCode,
      network: created.network,
      productType: created.productType,
      providerName: created.providerName,
      specificity: created.specificity
    });

    return created;
  }

  async setActive(id: string, active: boolean, context?: Partial<AuthenticatedRequestContext>) {
    const updated = await this.db.pricingRule.update({ where: { id }, data: { active } });

    await this.recordAudit(context, active ? "pricing_rule.activated" : "pricing_rule.deactivated", id, {
      domain: updated.domain,
      markupBps: updated.markupBps
    });

    return updated;
  }

  private assertMarkupIsSane(markupBps: number, confirmHighMarkup?: boolean) {
    if (!Number.isInteger(markupBps)) {
      throw new BadRequestException("markupBps must be a whole number of basis points.");
    }

    if (markupBps < 0) {
      throw new BadRequestException(
        "markupBps cannot be negative — that would sell below provider cost on every order in this domain."
      );
    }

    if (markupBps > MAX_MARKUP_BPS) {
      throw new BadRequestException(
        `markupBps of ${markupBps} exceeds the ${MAX_MARKUP_BPS} ceiling (${MAX_MARKUP_BPS / 100}%).`
      );
    }

    if (markupBps > HIGH_MARKUP_BPS && !confirmHighMarkup) {
      throw new BadRequestException(
        `markupBps of ${markupBps} is over ${HIGH_MARKUP_BPS / 100}%. Re-send with confirmHighMarkup: true if that is intended.`
      );
    }
  }

  // Repricing is a money-affecting action, so it is recorded the way provider
  // registry changes are (see ProvidersService). Never blocks the write.
  private async recordAudit(
    context: Partial<AuthenticatedRequestContext> | undefined,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>
  ) {
    try {
      await this.db.auditLog.create({
        data: {
          ...(context?.workspaceId ? { workspaceId: context.workspaceId } : {}),
          ...(context?.userId ? { actorUserId: context.userId } : {}),
          action,
          entityType: "PricingRule",
          entityId,
          metadata: metadata as never
        }
      });
    } catch {
      // An audit failure must not roll back a completed pricing change.
    }
  }
}
