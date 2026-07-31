import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import type { DatabaseClient, Prisma } from "@fliptrybe/database";

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
  constructor(private readonly prismaService: PrismaService) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
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

    // NOTE: the sell-below-cost guardrail (re-pricing every active SKU against live
    // provider cost before allowing the change) is not implemented — it requires a
    // live searchNumbers() call per active VirtualNumberProduct on every FX update,
    // which is a heavier feature than this pass covers. Flagging explicitly rather
    // than silently skipping it.

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
