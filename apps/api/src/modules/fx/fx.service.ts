import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";

import type { DatabaseClient, Prisma } from "@fliptrybe/database";
import {
  createFiveSimRentalAdapter,
  createMockVirtualNumberAdapter,
  createSmsPoolAdapter,
  createSmsPvaAdapter,
  type VirtualNumberProviderAdapter
} from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { SetFxRateDto } from "./fx.dtos";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// Bootstrap fallback only — used when no FxRate row has ever been set for this pair.
// Once an admin sets a real rate, this constant is never consulted again.
const BOOTSTRAP_RATE_MICROS = 1_450_000_000n; // ₦1,450/USD

function toMicros(rate: number): bigint {
  return BigInt(Math.round(rate * 1_000_000));
}

function fromMicros(micros: bigint): number {
  return Number(micros) / 1_000_000;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(private readonly prismaService: PrismaService) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Guardrails ────────────────────────────────────────────────────────────

  private buildVirtualNumberAdapter(providerName: string): VirtualNumberProviderAdapter {
    switch (providerName) {
      case "smspool":
        return createSmsPoolAdapter({
          apiKey: process.env["SMSPOOL_API_KEY"] ?? "",
          ...(process.env["SMSPOOL_BASE_URL"] ? { baseUrl: process.env["SMSPOOL_BASE_URL"] } : {})
        });
      case "5sim":
        return createFiveSimRentalAdapter({
          apiToken: process.env["FIVESIM_API_TOKEN"] ?? "",
          ...(process.env["FIVESIM_BASE_URL"] ? { baseUrl: process.env["FIVESIM_BASE_URL"] } : {})
        });
      case "smspva":
        return createSmsPvaAdapter({
          apiKey: process.env["SMSPVA_API_KEY"] ?? "",
          ...(process.env["SMSPVA_BASE_URL"] ? { baseUrl: process.env["SMSPVA_BASE_URL"] } : {})
        });
      default:
        return createMockVirtualNumberAdapter(providerName);
    }
  }

  private async getCandidateProviders(preferredProviders: string[]): Promise<string[]> {
    if (preferredProviders.length === 0) return [];

    const healthRows = await this.db.providerHealth.findMany({
      where: { providerName: { in: preferredProviders }, domain: "VIRTUAL_NUMBER" },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });
    const latestStatus = new Map(healthRows.map((h) => [h.providerName, h.status]));

    return preferredProviders.filter((name) => {
      const status = latestStatus.get(name);
      return status !== "DOWN" && status !== "DISABLED";
    });
  }

  private async validateSellBelowCostGuardrail(
    newRateMicros: bigint
  ): Promise<Array<{ productName: string; costMinorNgn: number; sellMinorNgn: number; marginBps: number }>> {
    const MARKUP_BPS = 3_500; // 35% margin from virtual-numbers.service.ts
    const MIN_MARGIN_BPS = 1_000; // 10% minimum margin guardrail

    function applyMarkup(costMinorUsd: number): number {
      return Math.ceil(costMinorUsd * (1 + MARKUP_BPS / 10_000));
    }

    function usdMinorToNgnMinor(usdMinor: number, rateMicros: bigint): number {
      return Math.ceil((usdMinor * Number(rateMicros)) / 1_000_000);
    }

    const issues: Array<{ productName: string; costMinorNgn: number; sellMinorNgn: number; marginBps: number }> = [];

    const products = await this.db.virtualNumberProduct.findMany({
      where: { active: true }
    });

    for (const product of products) {
      const candidates = await this.getCandidateProviders(product.preferredProviders);
      if (candidates.length === 0) {
        continue; // Skip if no healthy providers
      }

      for (const providerName of candidates) {
        const adapter = this.buildVirtualNumberAdapter(providerName);

        try {
          const offers = await adapter.searchNumbers({
            country: product.countryCode,
            durationDays: product.durationDays
          });
          const offer = offers[0];
          if (!offer) {
            continue;
          }

          const costMinorNgn = usdMinorToNgnMinor(offer.costMinorUsd, newRateMicros);
          const sellMinorNgn = usdMinorToNgnMinor(applyMarkup(offer.costMinorUsd), newRateMicros);
          const marginMinor = sellMinorNgn - costMinorNgn;
          const marginBps = Math.round((marginMinor / costMinorNgn) * 10_000);

          if (marginBps < MIN_MARGIN_BPS) {
            issues.push({
              productName: product.displayName,
              costMinorNgn,
              sellMinorNgn,
              marginBps
            });
          }

          break; // Successfully checked this product via first healthy provider
        } catch (err) {
          this.logger.warn(
            `Guardrail check failed for ${product.displayName} at ${providerName}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    return issues;
  }

  /**
   * Returns the active rate (rateMicros with bufferBps applied), or the bootstrap
   * fallback with a flag if no row exists yet. Refuses (throws) if the active rate
   * is older than FX_MAX_AGE_HOURS — quotes must never issue on a stale rate.
   */
  async getActiveRate(
    baseCurrency = "USD",
    quoteCurrency = "NGN"
  ): Promise<{ rateMicros: bigint; fxRateId: string | null; isBootstrap: boolean }> {
    const active = await this.db.fxRate.findFirst({
      where: { baseCurrency, quoteCurrency, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" }
    });

    if (!active) {
      return { rateMicros: BOOTSTRAP_RATE_MICROS, fxRateId: null, isBootstrap: true };
    }

    const maxAgeHours = Number(process.env["FX_MAX_AGE_HOURS"] ?? "72");
    const ageHours = (Date.now() - active.effectiveFrom.getTime()) / (60 * 60 * 1000);
    if (ageHours > maxAgeHours) {
      throw new BadRequestException(
        `The active FX rate is ${Math.round(ageHours)}h old, past the ${maxAgeHours}h freshness limit. An admin must refresh it before new orders can be quoted.`
      );
    }

    const bufferedMicros =
      (active.rateMicros * BigInt(10_000 + active.bufferBps)) / 10_000n;

    return { rateMicros: bufferedMicros, fxRateId: active.id, isBootstrap: false };
  }

  async getHistory(baseCurrency = "USD", quoteCurrency = "NGN") {
    return this.db.fxRate.findMany({
      where: { baseCurrency, quoteCurrency },
      orderBy: { effectiveFrom: "desc" },
      take: 20
    });
  }

  async setRate(ctx: AuthenticatedRequestContext, dto: SetFxRateDto) {
    if (!Number.isFinite(dto.rate) || dto.rate <= 0) {
      throw new BadRequestException("rate must be a positive number.");
    }

    const min = Number(process.env["FX_NGN_MIN"] ?? "500");
    const max = Number(process.env["FX_NGN_MAX"] ?? "5000");
    if (dto.rate < min || dto.rate > max) {
      throw new BadRequestException(
        `Rate ₦${dto.rate} is outside the allowed band (₦${min}–₦${max}). Update FX_NGN_MIN/FX_NGN_MAX if this is intentional.`
      );
    }

    const current = await this.db.fxRate.findFirst({
      where: { baseCurrency: "USD", quoteCurrency: "NGN", effectiveTo: null },
      orderBy: { effectiveFrom: "desc" }
    });

    if (current) {
      const currentRate = fromMicros(current.rateMicros);
      const deltaBps = Math.abs((dto.rate - currentRate) / currentRate) * 10_000;
      if (deltaBps > 1_000 && !dto.confirmLargeChange) {
        throw new BadRequestException(
          `New rate ₦${dto.rate} is a ${(deltaBps / 100).toFixed(1)}% change from the active rate ₦${currentRate.toFixed(2)}. Pass confirmLargeChange: true to proceed.`
        );
      }
    }

    // Validate that no active virtual number product would sell below cost with the new rate.
    const guardIssues = await this.validateSellBelowCostGuardrail(toMicros(dto.rate));
    if (guardIssues.length > 0 && !dto.confirmLargeChange) {
      const summary = guardIssues
        .map((iss) => `${iss.productName}: ₦${iss.costMinorNgn} cost → ₦${iss.sellMinorNgn} sell (${iss.marginBps}bps)`)
        .join("; ");
      throw new BadRequestException(
        `Sell-below-cost guardrail triggered: ${summary}. Pass confirmLargeChange: true to override.`
      );
    }

    const now = new Date();
    const newRate = await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      if (current) {
        await tx.fxRate.update({ where: { id: current.id }, data: { effectiveTo: now } });
      }

      const created = await tx.fxRate.create({
        data: {
          id: uid("fx"),
          baseCurrency: "USD",
          quoteCurrency: "NGN",
          rateMicros: toMicros(dto.rate),
          bufferBps: dto.bufferBps ?? 0,
          source: "MANUAL",
          effectiveFrom: now,
          setByUserId: ctx.userId,
          ...(dto.note ? { note: dto.note } : {})
        }
      });

      await tx.auditLog.create({
        data: {
          id: uid("aud"),
          action: "fx_rate.updated",
          actorUserId: ctx.userId,
          entityType: "FxRate",
          entityId: created.id,
          metadata: {
            oldRate: current ? fromMicros(current.rateMicros) : null,
            newRate: dto.rate,
            bufferBps: dto.bufferBps ?? 0
          }
        }
      });

      return created;
    });

    return newRate;
  }

  async getCurrent(baseCurrency = "USD", quoteCurrency = "NGN") {
    const active = await this.db.fxRate.findFirst({
      where: { baseCurrency, quoteCurrency, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" }
    });
    if (!active) {
      throw new NotFoundException("No FX rate has been set yet — using bootstrap fallback.");
    }
    return active;
  }
}
