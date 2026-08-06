// Minimal structural types so the router doesn't depend on generated Prisma types directly.
// The caller passes real Prisma model objects — they satisfy these interfaces structurally.

import type { ProviderDomain, ProviderStatus } from "./contract.js";

export interface ProviderConfigLike {
  name: string;
  domain: ProviderDomain;
  status: ProviderStatus;
  priority: number;
  enabledCountries: string[];
  enabledNetworks: string[];
  enabledProductTypes: string[];
  deletedAt: Date | null;
}

export interface ProviderHealthLike {
  providerName: string;
  status: ProviderStatus;
  checkedAt: Date;
}

export interface RoutingCandidate {
  providerName: string;
  score: number;
  costMinor: number;
  available: boolean;
  reason?: string;
}

export interface RouterScope {
  countryCode?: string;
  network?: string;
  productType: string;
  durationDays?: number;
}

export interface RouterInput {
  domain: ProviderDomain;
  scope: RouterScope;
}

/**
 * Score a single provider against current health.
 * Higher is better. Zero means ineligible.
 *
 * Formula: (1000 - priority) × healthWeight
 *   healthWeight: HEALTHY=1.0  DEGRADED=0.4  DOWN=0  DISABLED=0
 */
function scoreCandidate(
  config: ProviderConfigLike,
  latestHealth: ProviderHealthLike | undefined
): number {
  if (config.status === "DISABLED" || config.status === "DOWN") return 0;

  const effectiveStatus = latestHealth?.status ?? config.status;
  const healthWeight =
    effectiveStatus === "HEALTHY" ? 1.0 : effectiveStatus === "DEGRADED" ? 0.4 : 0;

  if (healthWeight === 0) return 0;

  return Math.round(Math.max(0, 1000 - config.priority) * healthWeight);
}

function configMatchesScope(config: ProviderConfigLike, scope: RouterScope): boolean {
  if (
    scope.countryCode &&
    config.enabledCountries.length > 0 &&
    !config.enabledCountries.includes(scope.countryCode)
  ) {
    return false;
  }
  if (
    scope.network &&
    config.enabledNetworks.length > 0 &&
    !config.enabledNetworks.includes(scope.network)
  ) {
    return false;
  }
  if (
    config.enabledProductTypes.length > 0 &&
    !config.enabledProductTypes.includes(scope.productType)
  ) {
    return false;
  }
  return true;
}

/**
 * Select and rank provider candidates for a given request.
 * Returns the full ranked list — callers walk it on failure.
 * Every candidate is returned (available or not) so the caller can write a
 * ProviderRoutingAttempt row for each with status SELECTED | SKIPPED | FAILED.
 */
export function selectProviders(
  input: RouterInput,
  configs: ProviderConfigLike[],
  healthMap: Map<string, ProviderHealthLike>
): RoutingCandidate[] {
  const domainConfigs = configs.filter(
    (c) => c.domain === input.domain && !c.deletedAt
  );

  const candidates: RoutingCandidate[] = domainConfigs.map((config) => {
    if (!configMatchesScope(config, input.scope)) {
      return {
        providerName: config.name,
        score: 0,
        costMinor: 0,
        available: false,
        reason: "scope_mismatch"
      };
    }

    const score = scoreCandidate(config, healthMap.get(config.name));

    return {
      providerName: config.name,
      score,
      costMinor: 0, // filled in by the vertical service after quoting
      available: score > 0,
      ...(score === 0 ? { reason: "unhealthy_or_disabled" } : {})
    };
  });

  // Stable sort: available first, then score descending
  return candidates.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return b.score - a.score;
  });
}

export interface AffinityResult {
  providerName: string;
  available: boolean;
  reason?: "provider_not_configured" | "provider_disabled" | "provider_unhealthy";
}

/**
 * Route a lifecycle operation (renew, resolve, top-up — anything acting on a resource
 * that was already provisioned) back to the provider that originally fulfilled it.
 *
 * This is deliberately NOT selectProviders(): a new resource may re-rank freely across
 * healthy candidates, but an existing resource's lifecycle must stay pinned to its
 * origin provider. If that provider is unhealthy, the correct move is to hold the
 * operation and flag it for ops review — never silently migrate the resource to a
 * different provider out from under the customer.
 *
 * Callers should treat `available: false` as "hold and flag", not as "try someone
 * else." The one exception (per the handbook) is read-only operations — balance or
 * history reads — which may fall back to last-known-good data instead of blocking;
 * that fallback is the caller's responsibility, not this function's.
 */
export function selectAffinityProvider(
  providerName: string,
  configs: ProviderConfigLike[],
  healthMap: Map<string, ProviderHealthLike>
): AffinityResult {
  const config = configs.find((c) => c.name === providerName && !c.deletedAt);
  if (!config) {
    return { providerName, available: false, reason: "provider_not_configured" };
  }
  if (config.status === "DISABLED") {
    return { providerName, available: false, reason: "provider_disabled" };
  }

  const effectiveStatus = healthMap.get(providerName)?.status ?? config.status;
  if (effectiveStatus === "DOWN") {
    return { providerName, available: false, reason: "provider_unhealthy" };
  }

  return { providerName, available: true };
}

/**
 * Build a Map<providerName, latestHealth> from a flat array of health records.
 * Deduplicates by providerName keeping the most recent checkedAt.
 */
export function buildHealthMap<T extends ProviderHealthLike>(
  records: T[]
): Map<string, T> {
  const map = new Map<string, T>();
  for (const record of records) {
    const existing = map.get(record.providerName);
    if (!existing || record.checkedAt > existing.checkedAt) {
      map.set(record.providerName, record);
    }
  }
  return map;
}
