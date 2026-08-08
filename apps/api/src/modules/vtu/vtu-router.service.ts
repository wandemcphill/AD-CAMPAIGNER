// VTU multi-provider routing engine.
// Selects the cheapest healthy provider for a given product by scoring all eligible
// candidates across cost, success rate, latency, and balance health.
// NEVER hard-codes provider-to-product assignments — everything flows through
// VtuProviderSkuMapping and VtuProviderConfig rows.

import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import type { DatabaseClient } from "@fliptrybe/database";
import { PrismaService } from "../prisma.service";

export interface RouteCandidate {
  providerName: string;
  providerSku: string;
  costMinor: number;
  score: number; // higher = preferred
  reason: string;
}

export interface RoutingResult {
  winner: RouteCandidate;
  allCandidates: RouteCandidate[];
}

export interface RoutingRequest {
  productType: string;   // AIRTIME | DATA | CABLE | ELECTRICITY | BETTING | EDUCATION | EPIN
  network?: string;
  canonicalSkuId?: string;
  /** Face value for products without a canonical SKU (e.g. airtime top-ups). */
  faceValueMinor?: number;
}

// Stale pricing threshold: reject provider cost data older than this.
const PRICING_STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Low balance threshold: warn but don't block unless below minBalance in VtuProviderConfig.
const LOW_BALANCE_FACTOR = 0.1; // treat balance < 10% of max transaction as LOW

@Injectable()
export class VtuRouterService {
  private readonly logger = new Logger(VtuRouterService.name);

  constructor(private readonly prismaService: PrismaService) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  /**
   * Select the best provider for a given routing request.
   * Returns a ranked list; the winner is always candidates[0].
   * Throws BadRequestException if no eligible provider can be found.
   */
  async route(request: RoutingRequest): Promise<RoutingResult> {
    const candidates = await this.buildCandidates(request);

    if (candidates.length === 0) {
      throw new BadRequestException(
        `No eligible VTU provider found for ${request.productType}` +
          (request.network ? ` on ${request.network}` : "") +
          ". Check provider configurations and SKU mappings."
      );
    }

    // Sort descending by score (highest = best).
    candidates.sort((a, b) => b.score - a.score);

    this.logger.debug(
      `VTU route for ${request.productType}${request.network ? "/" + request.network : ""}: ` +
        candidates.map((c) => `${c.providerName}(score=${c.score})`).join(" > ")
    );

    return { winner: candidates[0]!, allCandidates: candidates };
  }

  /**
   * Like route(), but used for failover: excludes a set of already-tried providers.
   */
  async routeExcluding(
    request: RoutingRequest,
    excludeProviders: string[]
  ): Promise<RouteCandidate | null> {
    const candidates = await this.buildCandidates(request);
    const eligible = candidates
      .filter((c) => !excludeProviders.includes(c.providerName))
      .sort((a, b) => b.score - a.score);
    return eligible[0] ?? null;
  }

  private async buildCandidates(request: RoutingRequest): Promise<RouteCandidate[]> {
    // Load all active provider configs.
    const providerConfigs = await this.db.vtuProviderConfig.findMany({
      where: {
        maintenanceMode: false,
        status: { in: ["ACTIVE", "PRODUCTION_READY", "SANDBOX"] }
      }
    });

    // Filter by service capability and maintenance mode (in-memory guard mirrors the DB where clause).
    const capableConfigs = providerConfigs.filter(
      (cfg) => cfg.enabledServices.includes(request.productType) && !cfg.maintenanceMode
    );

    if (capableConfigs.length === 0) return [];

    const providerNames = capableConfigs.map((c) => c.providerName);

    // Load health snapshots (latest per provider).
    const healthRows = await this.db.providerHealth.findMany({
      where: { providerName: { in: providerNames }, domain: "VTU" },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });
    const healthByProvider = new Map(healthRows.map((h) => [h.providerName, h]));

    // Load balance snapshots.
    const balanceRows = await this.db.vtuProviderBalance.findMany({
      where: { providerName: { in: providerNames } },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });
    const balanceByProvider = new Map(balanceRows.map((b) => [b.providerName, b]));

    // Load SKU mappings (either by canonicalSkuId or by productType+network).
    const mappingWhere = request.canonicalSkuId
      ? { canonicalSkuId: request.canonicalSkuId, adminApproved: true, active: true }
      : undefined;

    const rawMappings = mappingWhere
      ? await this.db.vtuProviderSkuMapping.findMany({ where: mappingWhere })
      : [];
    // In-memory guard: ensure adminApproved and active (mirrors DB where clause for correctness in tests/mocks).
    const skuMappings = mappingWhere
      ? rawMappings.filter((m) => m.adminApproved && m.active)
      : rawMappings;

    const mappingByProvider = new Map(skuMappings.map((m) => [m.providerName, m]));

    const candidates: RouteCandidate[] = [];

    for (const cfg of capableConfigs) {
      const providerName = cfg.providerName;

      // Skip: health is DOWN or DISABLED.
      const health = healthByProvider.get(providerName);
      if (health?.status === "DOWN" || health?.status === "DISABLED") continue;

      // Skip: balance below config minimum.
      const balance = balanceByProvider.get(providerName);
      if (balance && cfg.minBalanceMinor > 0 && balance.balanceMinor < cfg.minBalanceMinor) {
        continue;
      }

      // Determine cost for this product.
      let costMinor: number;
      let providerSku: string;

      if (request.canonicalSkuId) {
        const mapping = mappingByProvider.get(providerName);
        if (!mapping) continue; // No approved mapping for this SKU — skip.

        // Reject stale pricing.
        if (mapping.lastSyncedAt) {
          const age = Date.now() - mapping.lastSyncedAt.getTime();
          if (age > PRICING_STALE_THRESHOLD_MS) continue;
        }

        costMinor = mapping.costMinor;
        providerSku = mapping.providerSku;
      } else if (request.faceValueMinor) {
        costMinor = request.faceValueMinor; // placeholder; caller applies discount after
        providerSku = request.productType.toLowerCase();
      } else {
        // No canonical SKU and no face value — route by capability/health only, cost unknown.
        costMinor = 0;
        providerSku = request.productType.toLowerCase();
      }

      const score = this.computeScore(cfg, health, balance, costMinor);

      candidates.push({
        providerName,
        providerSku,
        costMinor,
        score,
        reason: this.describeScore(cfg, health, balance, costMinor)
      });
    }

    return candidates;
  }

  // Score a provider candidate. Higher = better.
  // Uses configurable weights from VtuProviderConfig.
  private computeScore(
    cfg: { costWeight: number; successRateWeight: number; latencyWeight: number; balanceWeight: number; maxTransactionMinor: number },
    health: { successRateBps: number; latencyMs: number; balanceMinor?: number | null } | undefined,
    balance: { balanceMinor: number; status: string } | undefined,
    costMinor: number
  ): number {
    const { costWeight, successRateWeight, latencyWeight, balanceWeight } = cfg;
    const totalWeight = costWeight + successRateWeight + latencyWeight + balanceWeight;
    if (totalWeight === 0) return 0;

    // Cost score: normalized so lower cost = higher score.
    // Use inverse cost capped at 0-100.  ₦50 base; anything above ₦50k scores near 0.
    const costScore = Math.max(0, 100 - (costMinor / 500_000) * 100);

    // Success rate: 0-100 from bps (10000 bps = 100%).
    const successScore = health ? Math.min(100, (health.successRateBps ?? 10000) / 100) : 80;

    // Latency score: <200ms = 100, >2000ms = 0.
    const latencyScore = health
      ? Math.max(0, 100 - ((health.latencyMs ?? 500) / 2000) * 100)
      : 70;

    // Balance score: HEALTHY = 100, LOW_BALANCE = 40, INSUFFICIENT = 0.
    let balanceScore = 100;
    if (balance) {
      if (balance.status === "LOW_BALANCE") balanceScore = 40;
      else if (balance.status === "INSUFFICIENT" || balance.status === "UNKNOWN") balanceScore = 0;
    }

    const weighted =
      (costScore * costWeight +
        successScore * successRateWeight +
        latencyScore * latencyWeight +
        balanceScore * balanceWeight) /
      totalWeight;

    return Math.round(weighted);
  }

  private describeScore(
    cfg: { providerName?: string },
    health: { successRateBps: number; latencyMs: number } | undefined,
    balance: { balanceMinor: number; status: string } | undefined,
    costMinor: number
  ): string {
    const parts: string[] = [`cost=₦${(costMinor / 100).toFixed(2)}`];
    if (health) {
      parts.push(`successRate=${(health.successRateBps / 100).toFixed(1)}%`);
      parts.push(`latency=${health.latencyMs}ms`);
    }
    if (balance) parts.push(`balance=${balance.status}`);
    return parts.join(" ");
  }

  // Record a routing attempt in the audit trail.
  async recordAttempt(params: {
    orderId: string;
    orderType: string;
    providerName: string;
    score: number;
    status: "SELECTED" | "SKIPPED" | "FAILED" | "FAILOVER";
    reason?: string;
  }) {
    await this.db.providerRoutingAttempt.create({
      data: {
        id: `rattempt_${Math.random().toString(36).slice(2, 12)}`,
        domain: "VTU",
        orderType: params.orderType,
        orderId: params.orderId,
        providerName: params.providerName,
        score: params.score,
        status: params.status,
        reason: params.reason ?? null
      }
    });
  }
}
