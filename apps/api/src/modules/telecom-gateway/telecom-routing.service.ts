import { Injectable, Logger } from "@nestjs/common";
import {
  createClubKonnectTelecomAdapter,
  createMockTelecomAdapter,
  createReloadlyTelecomAdapter,
  type TelecomProviderAdapter
} from "@fliptrybe/providers";

import { TelecomHealthService } from "./telecom-health.service";

export interface TelecomRouteOverride {
  provider: string;
  fallback?: string;
}

export interface TelecomRouteDecision {
  provider: string;
  fallback?: string;
}

const KNOWN_PROVIDERS = ["clubkonnect", "reloadly"] as const;

/**
 * Single source of routing truth: country in, provider name out. Nothing else in
 * the codebase is allowed to hardcode "if Nigeria use ClubKonnect" — every caller
 * (catalog, purchase) goes through resolveRoute()/buildAdapter() here.
 *
 * Overrides are in-memory today. They're deliberately shaped so a future
 * DB-backed TelecomProviderRoute table (mirroring VtuProviderRoute) can replace
 * the Maps below without changing resolveRoute()'s signature or any caller.
 */
@Injectable()
export class TelecomRoutingService {
  private readonly logger = new Logger(TelecomRoutingService.name);
  private readonly countryOverrides = new Map<string, TelecomRouteOverride>();
  private readonly operatorOverrides = new Map<string, TelecomRouteOverride>();

  constructor(private readonly health: TelecomHealthService) {}

  setCountryOverride(countryIso: string, override: TelecomRouteOverride) {
    this.countryOverrides.set(countryIso.toUpperCase(), override);
  }

  setOperatorOverride(countryIso: string, network: string, override: TelecomRouteOverride) {
    this.operatorOverrides.set(`${countryIso.toUpperCase()}:${network.toUpperCase()}`, override);
  }

  clearOverrides() {
    this.countryOverrides.clear();
    this.operatorOverrides.clear();
  }

  /**
   * Default rule (unless overridden): Nigeria -> ClubKonnect, everywhere else ->
   * Reloadly. This is the ONLY place that rule is encoded.
   */
  resolveRoute(countryIso: string, network?: string): TelecomRouteDecision {
    const iso = countryIso.toUpperCase();

    if (network) {
      const opOverride = this.operatorOverrides.get(`${iso}:${network.toUpperCase()}`);
      if (opOverride) return opOverride;
    }

    const countryOverride = this.countryOverrides.get(iso);
    if (countryOverride) return countryOverride;

    return iso === "NG"
      ? { provider: "clubkonnect", fallback: "reloadly" }
      : { provider: "reloadly", fallback: "clubkonnect" };
  }

  buildAdapter(providerName: string): TelecomProviderAdapter {
    switch (providerName) {
      case "clubkonnect":
        return createClubKonnectTelecomAdapter({
          userId: process.env["CLUBKONNECT_USER_ID"] ?? "",
          apiKey: process.env["CLUBKONNECT_API_KEY"] ?? "",
          ...(process.env["CLUBKONNECT_BASE_URL"]
            ? { baseUrl: process.env["CLUBKONNECT_BASE_URL"] }
            : {}),
          ...(process.env["CLUBKONNECT_CALLBACK_URL"]
            ? { callbackUrl: process.env["CLUBKONNECT_CALLBACK_URL"] }
            : {})
        });
      case "reloadly":
        return createReloadlyTelecomAdapter({
          clientId: process.env["RELOADLY_CLIENT_ID"] ?? "",
          clientSecret: process.env["RELOADLY_CLIENT_SECRET"] ?? "",
          ...(process.env["RELOADLY_BASE_URL"] ? { baseUrl: process.env["RELOADLY_BASE_URL"] } : {}),
          ...(process.env["RELOADLY_AUTH_URL"] ? { authUrl: process.env["RELOADLY_AUTH_URL"] } : {})
        });
      default:
        return createMockTelecomAdapter(providerName);
    }
  }

  /**
   * Pick the adapter to actually call for this request: primary if healthy,
   * fallback if the primary is DOWN/DISABLED and a fallback is configured.
   * Never silently skips a country with no matching route — callers get an
   * adapter for the primary provider either way, and surface real errors from
   * the actual API call if both are unreachable.
   */
  async selectAdapter(countryIso: string, network?: string): Promise<TelecomProviderAdapter> {
    const { provider, fallback } = this.resolveRoute(countryIso, network);
    const primary = this.buildAdapter(provider);

    if (await this.health.isHealthy(primary)) return primary;

    if (fallback) {
      const fallbackAdapter = this.buildAdapter(fallback);
      if (await this.health.isHealthy(fallbackAdapter)) {
        this.logger.warn(
          `Telecom provider ${provider} unhealthy for ${countryIso}; falling back to ${fallback}.`
        );
        return fallbackAdapter;
      }
    }

    this.logger.warn(
      `No healthy telecom provider for ${countryIso}${network ? `/${network}` : ""}; proceeding with ${provider} anyway.`
    );
    return primary;
  }

  listKnownProviders(): readonly string[] {
    return KNOWN_PROVIDERS;
  }
}
