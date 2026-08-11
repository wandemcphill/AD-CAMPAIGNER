import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { DatabaseClient, Prisma } from "@fliptrybe/database";
import {
  createMockFxProvider,
  createFincraFxProvider,
  type FxProvider
} from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type {
  SetFxRateDto,
  RefreshRatesDto,
  FxQuoteRequestDto,
  FxQuoteResponseDto,
  FxRateCacheStatusDto,
  FxHealthDto
} from "./fx.dtos";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// Bootstrap fallback only — used when no FxRate row has ever been set for this pair.
const BOOTSTRAP_RATE_MICROS = 1_450_000_000n; // ₦1,450/USD

// Launch corridor pairs refreshed by the scheduled cache job and initial
// warm-up — all quoted directly against NGN, since createQuote() only ever
// looks up a cached direct pair (it does not compose crosses through USD).
// A pair the active provider doesn't serve just fails its own fetch and gets
// skipped (see the Promise.allSettled loop below) — this list is provider-
// agnostic on purpose so it keeps working as more providers are added.
const DEFAULT_RATE_PAIRS: Array<{ baseCurrency: string; quoteCurrency: string }> = [
  { baseCurrency: "USD", quoteCurrency: "NGN" },
  { baseCurrency: "GBP", quoteCurrency: "NGN" },
  { baseCurrency: "EUR", quoteCurrency: "NGN" }
];

const DEFAULT_SPREAD_BPS = 150; // 1.5% spread
const DEFAULT_BUFFER_BPS = 100; // 1% buffer
const FX_MAX_AGE_HOURS = 72;
const FX_RATE_CACHE_TTL_MINUTES = 5;
const QUOTE_EXPIRY_SECONDS = 60;

function toMicros(rate: number): bigint {
  return BigInt(Math.round(rate * 1_000_000));
}

function fromMicros(micros: bigint): number {
  return Number(micros) / 1_000_000;
}

@Injectable()
export class FxService implements OnModuleInit {
  private readonly logger = new Logger(FxService.name);
  private fxProvider: FxProvider;
  private cacheRefreshInProgress = false;

  constructor(private readonly prismaService: PrismaService) {
    const fincraApiKey = process.env["FINCRA_API_KEY"];
    const fincraBusinessId = process.env["FINCRA_BUSINESS_ID"];

    if (fincraApiKey && fincraBusinessId) {
      const isProduction = process.env["FINCRA_ENV"] === "production";
      this.fxProvider = createFincraFxProvider({
        apiKey: fincraApiKey,
        businessId: fincraBusinessId,
        ...(isProduction ? { baseUrl: "https://api.fincra.com" } : {}),
      });
    } else {
      this.fxProvider = createMockFxProvider();
    }
  }

  async onModuleInit() {
    this.logger.log(`Initialized FX service with provider: ${this.fxProvider.name}`);
    // Trigger initial cache warm-up
    try {
      await this.refreshRateCache({ forceRefresh: true });
    } catch (err) {
      this.logger.warn(`Initial rate cache warm-up failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Scheduled Rate Refresh ────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleRefreshRateCache() {
    if (this.cacheRefreshInProgress) {
      this.logger.debug("Cache refresh already in progress, skipping scheduled run");
      return;
    }

    try {
      await this.refreshRateCache();
    } catch (err) {
      this.logger.error(`Scheduled rate cache refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ─── Rate Cache Management ─────────────────────────────────────────────────

  async refreshRateCache(dto?: RefreshRatesDto): Promise<void> {
    this.cacheRefreshInProgress = true;

    try {
      const forceRefresh = dto?.forceRefresh ?? false;

      // Explicit dto.baseCurrency/quoteCurrencies (manual admin refresh) keeps
      // the single-base-against-many-quotes shape. With no dto, refresh every
      // pair in DEFAULT_RATE_PAIRS, including the direct non-USD crosses.
      const pairs =
        dto?.baseCurrency || dto?.quoteCurrencies
          ? (dto.quoteCurrencies ?? ["NGN", "GBP", "EUR"]).map((qc) => ({
              baseCurrency: dto.baseCurrency ?? "USD",
              quoteCurrency: qc
            }))
          : DEFAULT_RATE_PAIRS;

      this.logger.log(`Refreshing FX rate cache for [${pairs.map((p) => `${p.baseCurrency}/${p.quoteCurrency}`).join(", ")}]`);

      const results = await Promise.allSettled(
        pairs.map(async ({ baseCurrency, quoteCurrency }) => {
          try {
            const rate = await this.fxProvider.getRate(baseCurrency, quoteCurrency);
            await this.validateAndCacheRate(rate, forceRefresh);
            return { success: true, baseCurrency, quoteCurrency };
          } catch (err) {
            this.logger.warn(
              `Failed to fetch ${baseCurrency}/${quoteCurrency}: ${err instanceof Error ? err.message : String(err)}`
            );
            return { success: false, baseCurrency, quoteCurrency, error: err };
          }
        })
      );

      const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
      const failed = results.length - succeeded;

      this.logger.log(`Rate cache refresh: ${succeeded}/${results.length} succeeded, ${failed} failed`);
    } finally {
      this.cacheRefreshInProgress = false;
    }
  }

  private async validateAndCacheRate(rate: { baseCurrency: string; quoteCurrency: string; rateMicros: bigint; timestamp: Date; provider: string }, forceRefresh = false): Promise<void> {
    // Validation checks
    const errors: string[] = [];

    if (!rate.baseCurrency || !rate.quoteCurrency) {
      errors.push("baseCurrency and quoteCurrency are required");
    }

    if (rate.rateMicros <= 0n) {
      errors.push("rateMicros must be positive");
    }

    const ageMs = Date.now() - rate.timestamp.getTime();
    const ageMinutes = Math.round(ageMs / (60 * 1000));
    if (ageMinutes > 60) {
      errors.push(`Provider timestamp is ${ageMinutes} minutes old (> 1 hour)`);
    }

    if (errors.length > 0) {
      this.logger.warn(`Rate validation failed for ${rate.baseCurrency}/${rate.quoteCurrency}: ${errors.join("; ")}`);
      return;
    }

    // Check for rate sanity (< 50% change from current)
    const existing = await this.db.fxRateCache.findUnique({
      where: {
        baseCurrency_quoteCurrency_providerName: {
          baseCurrency: rate.baseCurrency,
          quoteCurrency: rate.quoteCurrency,
          providerName: rate.provider
        }
      }
    });

    if (existing && !forceRefresh) {
      const existingRate = existing.providerRateMicros;
      const changeBps = Math.abs(Number((rate.rateMicros - existingRate) * 10000n / existingRate));

      if (changeBps > 5_000) { // > 50% change
        this.logger.warn(`Rate sanity check failed: ${changeBps / 100}% change for ${rate.baseCurrency}/${rate.quoteCurrency}`);
        return;
      }
    }

    // Cache the rate
    const ageSeconds = Math.round(ageMs / 1000);

    await this.db.fxRateCache.upsert({
      where: {
        baseCurrency_quoteCurrency_providerName: {
          baseCurrency: rate.baseCurrency,
          quoteCurrency: rate.quoteCurrency,
          providerName: rate.provider
        }
      },
      create: {
        baseCurrency: rate.baseCurrency,
        quoteCurrency: rate.quoteCurrency,
        providerName: rate.provider,
        providerRateMicros: rate.rateMicros,
        providerTimestamp: rate.timestamp,
        validationStatus: "VALID",
        age_seconds: ageSeconds
      },
      update: {
        providerRateMicros: rate.rateMicros,
        providerTimestamp: rate.timestamp,
        validationStatus: "VALID",
        age_seconds: ageSeconds,
        lastUpdatedAt: new Date(),
        lastSuccessAt: new Date()
      }
    });

    this.logger.debug(`Cached rate: ${rate.baseCurrency}/${rate.quoteCurrency} = ${fromMicros(rate.rateMicros).toFixed(2)}`);
  }

  private async getCachedRate(baseCurrency: string, quoteCurrency: string): Promise<{ rateMicros: bigint; ageSeconds: number } | null> {
    const cached = await this.db.fxRateCache.findFirst({
      where: {
        baseCurrency,
        quoteCurrency,
        validationStatus: "VALID"
      },
      orderBy: { lastSuccessAt: "desc" }
    });

    if (!cached) {
      return null;
    }

    const ageMs = Date.now() - cached.lastUpdatedAt.getTime();
    const ageSeconds = Math.round(ageMs / 1000);
    const maxAgeCacheSeconds = FX_RATE_CACHE_TTL_MINUTES * 60;

    if (ageSeconds > maxAgeCacheSeconds) {
      return null; // Cache expired
    }

    return { rateMicros: cached.providerRateMicros, ageSeconds };
  }

  // ─── Rate Resolution (Manual Fallback or Cache) ─────────────────────────────

  async getActiveRate(
    baseCurrency = "USD",
    quoteCurrency = "NGN"
  ): Promise<{ rateMicros: bigint; fxRateId: string | null; isBootstrap: boolean; usingFallback: boolean }> {
    // First try cached rate
    const cached = await this.getCachedRate(baseCurrency, quoteCurrency);
    if (cached) {
      return { rateMicros: cached.rateMicros, fxRateId: null, isBootstrap: false, usingFallback: false };
    }

    // Fall back to manual rate
    const active = await this.db.fxRate.findFirst({
      where: { baseCurrency, quoteCurrency, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" }
    });

    if (!active) {
      if (baseCurrency === "USD" && quoteCurrency === "NGN") {
        return { rateMicros: BOOTSTRAP_RATE_MICROS, fxRateId: null, isBootstrap: true, usingFallback: true };
      }

      throw new BadRequestException(
        `No FX rate configured for ${baseCurrency}/${quoteCurrency}. This pair is not in the scheduled rate cache ` +
          `and has no manual admin rate set — refusing to quote off the USD/NGN bootstrap rate for a different pair.`
      );
    }

    const maxAgeHours = FX_MAX_AGE_HOURS;
    const ageHours = (Date.now() - active.effectiveFrom.getTime()) / (60 * 60 * 1000);

    if (ageHours > maxAgeHours) {
      throw new BadRequestException(
        `The active FX rate is ${Math.round(ageHours)}h old, past the ${maxAgeHours}h freshness limit. An admin must refresh it.`
      );
    }

    const bufferedMicros = (active.rateMicros * BigInt(10_000 + active.bufferBps)) / 10_000n;

    return { rateMicros: bufferedMicros, fxRateId: active.id, isBootstrap: false, usingFallback: true };
  }

  // ─── Quote Locking ────────────────────────────────────────────────────────

  async createQuote(ctx: AuthenticatedRequestContext, dto: FxQuoteRequestDto): Promise<FxQuoteResponseDto> {
    const { baseCurrency, quoteCurrency, sourceAmountMinor } = dto;
    const expirySeconds = dto.quoteExpirySeconds ?? QUOTE_EXPIRY_SECONDS;

    if (sourceAmountMinor <= 0) {
      throw new BadRequestException("sourceAmountMinor must be positive");
    }

    const rate = await this.getActiveRate(baseCurrency, quoteCurrency);
    const spreadBps = DEFAULT_SPREAD_BPS;
    const bufferBps = DEFAULT_BUFFER_BPS;

    // Customer rate = provider rate + spread + buffer
    const totalBps = spreadBps + bufferBps;
    const customerRateMicros = (rate.rateMicros * BigInt(10_000 + totalBps)) / 10_000n;

    // Calculate result amount
    const resultAmountMinor = Math.round((sourceAmountMinor * Number(customerRateMicros)) / 1_000_000);

    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    const quote = await this.db.fxQuote.create({
      data: {
        id: uid("fxq"),
        baseCurrency,
        quoteCurrency,
        sourceAmountMinor: BigInt(sourceAmountMinor),
        providerRateMicros: rate.rateMicros,
        customerRateMicros,
        spreadBps,
        bufferBps,
        resultAmountMinor: BigInt(resultAmountMinor),
        status: "ACTIVE",
        expiresAt
      }
    });

    return {
      quoteId: quote.id,
      baseCurrency,
      quoteCurrency,
      sourceAmountMinor,
      providerRateMicros: rate.rateMicros,
      customerRateMicros,
      spreadBps,
      resultAmountMinor,
      expiresAt,
      status: "ACTIVE"
    };
  }

  async useQuote(quoteId: string, transactionId: string): Promise<void> {
    const quote = await this.db.fxQuote.findUnique({ where: { id: quoteId } });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    if (quote.status !== "ACTIVE") {
      throw new BadRequestException(`Quote is ${quote.status}, cannot be used`);
    }

    if (quote.expiresAt < new Date()) {
      throw new BadRequestException("Quote has expired");
    }

    await this.db.fxQuote.update({
      where: { id: quoteId },
      data: { status: "USED", usedAt: new Date(), transactionId }
    });
  }

  // ─── Admin Management ──────────────────────────────────────────────────────

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
        `Rate ₦${dto.rate} is outside the allowed band (₦${min}–₦${max}). Update FX_NGN_MIN/FX_NGN_MAX if intentional.`
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
          `New rate ₦${dto.rate} is a ${(deltaBps / 100).toFixed(1)}% change. Pass confirmLargeChange: true.`
        );
      }
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
      throw new NotFoundException("No FX rate has been set yet");
    }
    return active;
  }

  // ─── Health & Status ───────────────────────────────────────────────────────

  async getHealth(): Promise<FxHealthDto> {
    const providerHealth = await this.fxProvider.healthCheck();

    const caches = await this.db.fxRateCache.findMany({
      where: { validationStatus: "VALID" }
    });

    const cacheStatus: FxRateCacheStatusDto[] = caches.map((cache) => {
      const ageSeconds = Math.round((Date.now() - cache.lastUpdatedAt.getTime()) / 1000);
      const isFresh = ageSeconds < FX_RATE_CACHE_TTL_MINUTES * 60;

      // Get customer rate (with spread/buffer applied)
      const totalBps = DEFAULT_SPREAD_BPS + DEFAULT_BUFFER_BPS;
      const customerRateMicros = (cache.providerRateMicros * BigInt(10_000 + totalBps)) / 10_000n;

      return {
        baseCurrency: cache.baseCurrency,
        quoteCurrency: cache.quoteCurrency,
        providerName: cache.providerName,
        providerRateMicros: cache.providerRateMicros,
        customerRateMicros,
        ageSeconds,
        validationStatus: cache.validationStatus,
        lastUpdatedAt: cache.lastUpdatedAt,
        isFresh
      };
    });

    const lastManualRate = await this.db.fxRate.findFirst({
      where: { effectiveTo: null },
      orderBy: { effectiveFrom: "desc" }
    });

    const manualRateAgeMinutes = lastManualRate
      ? Math.round((Date.now() - lastManualRate.effectiveFrom.getTime()) / (60 * 1000))
      : -1;

    return {
      provider: this.fxProvider.name,
      healthy: providerHealth.healthy,
      message: providerHealth.message,
      cacheStatus: {
        pairs: cacheStatus,
        lastRefreshAt: new Date()
      },
      fallbackStatus: {
        usingFallback: cacheStatus.length === 0,
        ...(cacheStatus.length === 0 ? { reason: "No valid cached rates; using manual rates" } : {}),
        manualRateAge: manualRateAgeMinutes
      }
    };
  }
}
