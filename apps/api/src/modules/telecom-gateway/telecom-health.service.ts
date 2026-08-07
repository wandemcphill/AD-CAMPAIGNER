import { Injectable, Logger } from "@nestjs/common";
import type { ProviderStatus, TelecomProviderAdapter } from "@fliptrybe/providers";

export interface TelecomProviderHealthSnapshot {
  providerName: string;
  status: ProviderStatus;
  latencyMs: number;
  balanceMinor?: number;
  currency?: string;
  reason?: string;
  checkedAt: Date;
}

const HEALTH_TTL_MS = 60_000;

/**
 * In-memory health cache for telecom providers. Backs the routing engine's
 * fallback decision (Gap: real ProviderHealth persistence + a scheduled sync job
 * would replace this cache 1:1 without touching any caller — see TelecomRoutingService).
 */
@Injectable()
export class TelecomHealthService {
  private readonly logger = new Logger(TelecomHealthService.name);
  private readonly cache = new Map<string, TelecomProviderHealthSnapshot>();

  async check(adapter: TelecomProviderAdapter, force = false): Promise<TelecomProviderHealthSnapshot> {
    const cached = this.cache.get(adapter.name);
    if (!force && cached && Date.now() - cached.checkedAt.getTime() < HEALTH_TTL_MS) {
      return cached;
    }

    try {
      const [health, balance] = await Promise.all([
        adapter.checkHealth(),
        adapter.getBalance().catch(() => undefined)
      ]);

      const snapshot: TelecomProviderHealthSnapshot = {
        providerName: adapter.name,
        status: health.status,
        latencyMs: health.latencyMs,
        checkedAt: new Date(),
        ...(health.reason ? { reason: health.reason } : {}),
        ...(balance ? { balanceMinor: balance.balanceMinor, currency: balance.currency } : {})
      };
      this.cache.set(adapter.name, snapshot);
      return snapshot;
    } catch (err) {
      this.logger.warn(`Health check failed for telecom provider ${adapter.name}: ${String(err)}`);
      const snapshot: TelecomProviderHealthSnapshot = {
        providerName: adapter.name,
        status: "DOWN",
        latencyMs: 0,
        checkedAt: new Date(),
        reason: err instanceof Error ? err.message : "Health check error"
      };
      this.cache.set(adapter.name, snapshot);
      return snapshot;
    }
  }

  async isHealthy(adapter: TelecomProviderAdapter): Promise<boolean> {
    const snapshot = await this.check(adapter);
    return snapshot.status === "HEALTHY" || snapshot.status === "DEGRADED";
  }

  snapshotAll(): TelecomProviderHealthSnapshot[] {
    return Array.from(this.cache.values());
  }
}
