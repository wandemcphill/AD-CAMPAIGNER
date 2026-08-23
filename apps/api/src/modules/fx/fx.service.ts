import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { DatabaseClient, Prisma } from "@fliptrybe/database";
import { type FxProvider, type FxRate } from "@fliptrybe/providers";
import { createPayscribeFxProvider } from "@fliptrybe/providers/payscribe-fx";

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
const BOOTSTRAP_RATE_MICROS = 1_450_000_000n;
const DEFAULT_RATE_PAIRS: Array<{ baseCurrency: string; quoteCurrency: string }> = [{ baseCurrency: "USD", quoteCurrency: "NGN" }];
const DEFAULT_SPREAD_BPS = 150;
const MAX_SPREAD_BPS = 2_000;
const DEFAULT_BUFFER_BPS = 100;
const FX_MAX_AGE_HOURS = 72;
const FX_RATE_CACHE_TTL_MINUTES = 5;
const QUOTE_EXPIRY_SECONDS = 60;

function envEnabled(name: string) {
  return ["1", "true", "yes", "on"].includes((process.env[name] ?? "").trim().toLowerCase());
}

function isConfiguredSecret(value: string | undefined): value is string {
  const normalized = value?.trim();
  if (!normalized) return false;
  return !/^(changeme|change-me|placeholder|todo|test|dummy|example|your_|sk_test_x)$/i.test(normalized);
}

function toMicros(rate: number): bigint {
  return BigInt(Math.round(rate * 1_000_000));
}

function fromMicros(micros: bigint): number {
  return Number(micros) / 1_000_000;
}

@Injectable()
export class FxService implements OnModuleInit {
  private readonly logger = new Logger(FxService.name);
  private fxProviders: FxProvider[] = [];
  private cacheRefreshInProgress = false;

  constructor(private readonly prismaService: PrismaService) {
    const liveRefreshEnabled = envEnabled("FX_LIVE_PROVIDER_REFRESH");
    const payscribeApiKey = process.env["PAYSCRIBE_API_KEY"];

    if (liveRefreshEnabled && isConfiguredSecret(payscribeApiKey)) {
      this.fxProviders.push(
        createPayscribeFxProvider({
          apiKey: payscribeApiKey.trim(),
          ...(process.env["PAYSCRIBE_BASE_URL"] ? { baseUrl: process.env["PAYSCRIBE_BASE_URL"] } : {})
        })
      );
    }

    if (!liveRefreshEnabled && process.env.NODE_ENV === "production") {
      this.logger.log("FX live provider refresh is disabled; using manual/bootstrap rates only.");
    }
  }

  async onModuleInit() {
    this.logger.log(`Initialized FX service with providers: ${this.fxProviders.map((p) => p.name).join(", ") || "none"}`);
    try {
      await this.refreshRateCache({ forceRefresh: true });
    } catch (err) {
      this.logger.warn(`Initial rate cache warm-up failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async getBestRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate> {
    const attempts = await Promise.allSettled(
      this.fxProviders.map(async (provider) => provider.getRate(baseCurrency, quoteCurrency))
    );
    const rates: FxRate[] = [];
    attempts.forEach((attempt, index) => {
      if (attempt.status === "fulfilled") {
        rates.push(attempt.value);
        return;
      }
      const provider = this.fxProviders[index];
      const reason = attempt.reason instanceof Error ? attempt.reason.message : String(attempt.reason);
      this.logger.warn(`FX provider ${provider?.name ?? "unknown"} failed for ${baseCurrency}/${quoteCurrency}: ${reason}`);
    });
    if (rates.length === 0) throw new Error(`No configured provider returned a rate for ${baseCurrency}/${quoteCurrency}`);
    return rates.reduce((best, candidate) => (candidate.rateMicros > best.rateMicros ? candidate : best));
  }

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleRefreshRateCache() {
    if (this.cacheRefreshInProgress) return;
    try {
      await this.refreshRateCache();
    } catch (err) {
      this.logger.error(`Scheduled FX refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async refreshRateCache(dto?: RefreshRatesDto): Promise<void> {
    this.cacheRefreshInProgress = true;
    try {
      const forceRefresh = dto?.forceRefresh ?? false;
      const pairs =
        dto?.baseCurrency || dto?.quoteCurrencies
          ? (dto.quoteCurrencies ?? ["NGN"]).map((quoteCurrency) => ({ baseCurrency: dto.baseCurrency ?? "USD", quoteCurrency }))
          : DEFAULT_RATE_PAIRS;

      const results = await Promise.allSettled(
        pairs.map(async ({ baseCurrency, quoteCurrency }) => {
          try {
            const cached = await this.validateAndCacheRate(await this.getBestRate(baseCurrency, quoteCurrency), forceRefresh);
            return cached;
          } catch (error) {
            this.logger.warn(`Failed to fetch ${baseCurrency}/${quoteCurrency}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
          }
        })
      );
      const succeeded = results.filter((result) => result.status === "fulfilled" && result.value).length;
      this.logger.log(`Rate cache refresh: ${succeeded}/${results.length} succeeded, ${results.length - succeeded} failed`);
    } finally {
      this.cacheRefreshInProgress = false;
    }
  }

  private async validateAndCacheRate(rate: { baseCurrency: string; quoteCurrency: string; rateMicros: bigint; timestamp: Date; provider: string }, forceRefresh = false): Promise<boolean> {
    if (!rate.baseCurrency || !rate.quoteCurrency || rate.rateMicros <= 0n) return false;
    const ageMs = Date.now() - rate.timestamp.getTime();
    if (Math.round(ageMs / 60_000) > 60) return false;

    const existing = await this.db.fxRateCache.findUnique({
      where: { baseCurrency_quoteCurrency_providerName: { baseCurrency: rate.baseCurrency, quoteCurrency: rate.quoteCurrency, providerName: rate.provider } }
    });
    if (existing && !forceRefresh) {
      const changeBps = Math.abs(Number((rate.rateMicros - existing.providerRateMicros) * 10_000n / existing.providerRateMicros));
      if (changeBps > 5_000) return false;
    }

    const ageSeconds = Math.round(ageMs / 1000);
    await this.db.fxRateCache.upsert({
      where: { baseCurrency_quoteCurrency_providerName: { baseCurrency: rate.baseCurrency, quoteCurrency: rate.quoteCurrency, providerName: rate.provider } },
      create: { baseCurrency: rate.baseCurrency, quoteCurrency: rate.quoteCurrency, providerName: rate.provider, providerRateMicros: rate.rateMicros, providerTimestamp: rate.timestamp, validationStatus: "VALID", age_seconds: ageSeconds },
      update: { providerRateMicros: rate.rateMicros, providerTimestamp: rate.timestamp, validationStatus: "VALID", age_seconds: ageSeconds, lastUpdatedAt: new Date(), lastSuccessAt: new Date() }
    });
    return true;
  }

  private async getCachedRate(baseCurrency: string, quoteCurrency: string) {
    const cached = await this.db.fxRateCache.findFirst({ where: { baseCurrency, quoteCurrency, validationStatus: "VALID" }, orderBy: { lastSuccessAt: "desc" } });
    if (!cached) return null;
    const ageSeconds = Math.round((Date.now() - cached.lastUpdatedAt.getTime()) / 1000);
    return ageSeconds <= FX_RATE_CACHE_TTL_MINUTES * 60 ? { rateMicros: cached.providerRateMicros, ageSeconds } : null;
  }

  private async configuredSpreadBps(baseCurrency: string, quoteCurrency: string) {
    const active = await this.db.fxRate.findFirst({ where: { baseCurrency, quoteCurrency, effectiveTo: null }, orderBy: { effectiveFrom: "desc" }, select: { spreadBps: true } });
    return active?.spreadBps ?? null;
  }

  async getActiveRate(baseCurrency = "USD", quoteCurrency = "NGN") {
    const cached = await this.getCachedRate(baseCurrency, quoteCurrency);
    if (cached) return { rateMicros: cached.rateMicros, fxRateId: null, isBootstrap: false, usingFallback: false, bufferBpsApplied: 0, spreadBps: await this.configuredSpreadBps(baseCurrency, quoteCurrency) };

    const active = await this.db.fxRate.findFirst({ where: { baseCurrency, quoteCurrency, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
    if (!active) {
      if (baseCurrency === "USD" && quoteCurrency === "NGN") return { rateMicros: BOOTSTRAP_RATE_MICROS, fxRateId: null, isBootstrap: true, usingFallback: true, bufferBpsApplied: 0, spreadBps: null };
      throw new BadRequestException(`No FX rate configured for ${baseCurrency}/${quoteCurrency}; refusing to synthesize a cross.`);
    }

    const ageHours = (Date.now() - active.effectiveFrom.getTime()) / 3_600_000;
    if (ageHours > FX_MAX_AGE_HOURS) throw new BadRequestException(`The active FX rate is ${Math.round(ageHours)}h old, past the ${FX_MAX_AGE_HOURS}h freshness limit.`);
    const bufferedMicros = (active.rateMicros * BigInt(10_000 + active.bufferBps)) / 10_000n;
    return { rateMicros: bufferedMicros, fxRateId: active.id, isBootstrap: false, usingFallback: true, bufferBpsApplied: active.bufferBps, spreadBps: active.spreadBps };
  }

  async createQuote(ctx: AuthenticatedRequestContext, dto: FxQuoteRequestDto): Promise<FxQuoteResponseDto> {
    const { baseCurrency, quoteCurrency, sourceAmountMinor } = dto;
    if (sourceAmountMinor <= 0) throw new BadRequestException("sourceAmountMinor must be positive");
    const rate = await this.getActiveRate(baseCurrency, quoteCurrency);
    const spreadBps = rate.spreadBps ?? DEFAULT_SPREAD_BPS;
    const remainingBufferBps = Math.max(0, DEFAULT_BUFFER_BPS - rate.bufferBpsApplied);
    const customerRateMicros = (rate.rateMicros * BigInt(10_000 + spreadBps + remainingBufferBps)) / 10_000n;
    const resultAmountMinor = Math.round((sourceAmountMinor * Number(customerRateMicros)) / 1_000_000);
    const expiresAt = new Date(Date.now() + (dto.quoteExpirySeconds ?? QUOTE_EXPIRY_SECONDS) * 1000);

    const quote = await this.db.fxQuote.create({
      data: {
        id: uid("fxq"),
        workspaceId: ctx.workspaceId ?? null,
        baseCurrency,
        quoteCurrency,
        sourceAmountMinor,
        providerRateMicros: rate.rateMicros,
        customerRateMicros,
        spreadBps,
        bufferBps: remainingBufferBps,
        resultAmountMinor: BigInt(resultAmountMinor),
        status: "ACTIVE",
        expiresAt
      }
    });

    return { quoteId: quote.id, baseCurrency, quoteCurrency, sourceAmountMinor, providerRateMicros: rate.rateMicros, customerRateMicros, spreadBps, resultAmountMinor, expiresAt, status: "ACTIVE", rateProvenance: rate.isBootstrap ? "bootstrap" : rate.usingFallback ? "manual" : "live" };
  }

  async useQuote(quoteId: string, transactionId: string, workspaceId?: string): Promise<void> {
    const quote = await this.db.fxQuote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new NotFoundException(`Quote ${quoteId} not found`);
    if (quote.workspaceId && workspaceId && quote.workspaceId !== workspaceId) throw new NotFoundException(`Quote ${quoteId} not found`);
    if (quote.status !== "ACTIVE") throw new BadRequestException(`Quote is ${quote.status}, cannot be used`);
    if (quote.expiresAt < new Date()) throw new BadRequestException("Quote has expired");
    await this.db.fxQuote.update({ where: { id: quoteId }, data: { status: "USED", usedAt: new Date(), transactionId } });
  }

  async getHistory(baseCurrency = "USD", quoteCurrency = "NGN") {
    return this.db.fxRate.findMany({ where: { baseCurrency, quoteCurrency }, orderBy: { effectiveFrom: "desc" }, take: 20 });
  }

  async setRate(ctx: AuthenticatedRequestContext, dto: SetFxRateDto) {
    if (!Number.isFinite(dto.rate) || dto.rate <= 0) throw new BadRequestException("rate must be a positive number.");
    const min = Number(process.env["FX_NGN_MIN"] ?? "500");
    const max = Number(process.env["FX_NGN_MAX"] ?? "5000");
    if (dto.rate < min || dto.rate > max) throw new BadRequestException(`Rate ₦${dto.rate} is outside the allowed band (₦${min}–₦${max}).`);

    const current = await this.db.fxRate.findFirst({ where: { baseCurrency: "USD", quoteCurrency: "NGN", effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
    if (current) {
      const currentRate = fromMicros(current.rateMicros);
      const deltaBps = Math.abs((dto.rate - currentRate) / currentRate) * 10_000;
      if (deltaBps > 1_000 && !dto.confirmLargeChange) throw new BadRequestException(`New rate ₦${dto.rate} is a ${(deltaBps / 100).toFixed(1)}% change. Pass confirmLargeChange: true.`);
    }

    const spreadBps = dto.spreadBps ?? current?.spreadBps ?? DEFAULT_SPREAD_BPS;
    if (!Number.isInteger(spreadBps) || spreadBps < 0 || spreadBps > MAX_SPREAD_BPS) throw new BadRequestException(`spreadBps must be a whole number between 0 and ${MAX_SPREAD_BPS}.`);

    const now = new Date();
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      if (current) await tx.fxRate.update({ where: { id: current.id }, data: { effectiveTo: now } });
      const created = await tx.fxRate.create({ data: { id: uid("fx"), baseCurrency: "USD", quoteCurrency: "NGN", rateMicros: toMicros(dto.rate), bufferBps: dto.bufferBps ?? 0, spreadBps, source: "MANUAL", effectiveFrom: now, setByUserId: ctx.userId, ...(dto.note ? { note: dto.note } : {}) } });
      await tx.auditLog.create({ data: { id: uid("aud"), action: "fx_rate.updated", actorUserId: ctx.userId, entityType: "FxRate", entityId: created.id, metadata: { oldRate: current ? fromMicros(current.rateMicros) : null, newRate: dto.rate, bufferBps: dto.bufferBps ?? 0, spreadBps } } });
      return created;
    });
  }

  async getCurrent(baseCurrency = "USD", quoteCurrency = "NGN") {
    const active = await this.db.fxRate.findFirst({ where: { baseCurrency, quoteCurrency, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
    if (!active) throw new NotFoundException("No FX rate has been set yet");
    return active;
  }

  async getHealth(): Promise<FxHealthDto> {
    const healthChecks = await Promise.all(this.fxProviders.map(async (provider) => ({ name: provider.name, result: await provider.healthCheck() })));
    const caches = await this.db.fxRateCache.findMany({ where: { validationStatus: "VALID" } });
    const cacheStatus: FxRateCacheStatusDto[] = caches.map((cache) => {
      const ageSeconds = Math.round((Date.now() - cache.lastUpdatedAt.getTime()) / 1000);
      const totalBps = DEFAULT_SPREAD_BPS + DEFAULT_BUFFER_BPS;
      const customerRateMicros = (cache.providerRateMicros * BigInt(10_000 + totalBps)) / 10_000n;
      return { baseCurrency: cache.baseCurrency, quoteCurrency: cache.quoteCurrency, providerName: cache.providerName, providerRateMicros: cache.providerRateMicros, customerRateMicros, ageSeconds, validationStatus: cache.validationStatus, lastUpdatedAt: cache.lastUpdatedAt, isFresh: ageSeconds < FX_RATE_CACHE_TTL_MINUTES * 60 };
    });

    const lastManualRate = await this.db.fxRate.findFirst({ where: { effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
    const manualRateAgeMinutes = lastManualRate ? Math.round((Date.now() - lastManualRate.effectiveFrom.getTime()) / 60_000) : -1;
    const providerHealthy = this.fxProviders.length > 0 && healthChecks.some((health) => health.result.healthy);

    return {
      provider: this.fxProviders.map((provider) => provider.name).join(", ") || "none",
      healthy: providerHealthy,
      message: healthChecks.map((health) => `${health.name}: ${health.result.healthy ? "ok" : (health.result.message ?? "unhealthy")}`).join("; ") || "No live FX provider configured",
      cacheStatus: { pairs: cacheStatus, lastRefreshAt: new Date() },
      fallbackStatus: { usingFallback: cacheStatus.length === 0, ...(cacheStatus.length === 0 ? { reason: "No valid cached rates; using manual/bootstrap rates" } : {}), manualRateAge: manualRateAgeMinutes }
    };
  }
}
