/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import type { ProviderDomain } from "@fliptrybe/providers";
import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";

const VTU_PROVIDERS = ["clubkonnect", "vtpass"];
const VIRTUAL_NUMBER_PROVIDERS = ["smspool", "5sim", "smspva"];

function isSecretConfigured(value: string | undefined) {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== "..." && !trimmed.startsWith("replace-"));
}

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  private async latestHealthByName(providers: string[], domain: "VTU" | "VIRTUAL_NUMBER") {
    const rows = await this.db.providerHealth.findMany({
      where: { providerName: { in: providers }, domain },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });

    return providers.map((name) => {
      const row = rows.find((r: any) => r.providerName === name);
      return {
        name,
        status: row?.status ?? "DISABLED",
        latencyMs: row?.latencyMs ?? null,
        successRateBps: row?.successRateBps ?? null,
        lastCheckedAt: row?.checkedAt ?? null,
        reason: row?.reason ?? null
      };
    });
  }

  async overview() {
    const [vtu, virtualNumbers, fxRateCount, korapayConfigured, paystackConfigured] = await Promise.all([
      this.latestHealthByName(VTU_PROVIDERS, "VTU"),
      this.latestHealthByName(VIRTUAL_NUMBER_PROVIDERS, "VIRTUAL_NUMBER"),
      this.db.fxRate.count(),
      Promise.resolve(
        process.env.PAYMENT_PROVIDER === "live" && isSecretConfigured(process.env.KORAPAY_SECRET_KEY)
      ),
      Promise.resolve(
        process.env.PAYMENT_PROVIDER === "live" && isSecretConfigured(process.env.PAYSTACK_SECRET_KEY)
      )
    ]);
    const reloadlyConfigured = Boolean(
      isSecretConfigured(process.env.RELOADLY_CLIENT_ID) ||
        isSecretConfigured(process.env.RELOADLY_API_CLIENT_ID)
    ) && Boolean(
      isSecretConfigured(process.env.RELOADLY_CLIENT_SECRET) ||
        isSecretConfigured(process.env.RELOADLY_API_CLIENT_KEY) ||
        isSecretConfigured(process.env.RELOADLY_API_CLIENT_SECRET)
    );
    const sogoConfigured = Boolean(
      isSecretConfigured(process.env.SOGO_API_KEY) || isSecretConfigured(process.env.SOGO_SECRET_KEY)
    );

    return {
      categories: [
        {
          key: "airtime_data",
          label: "Airtime & Data",
          providers: vtu.map((p) => ({
            ...p,
            services: ["Airtime top-up", "Data bundles"],
            configurationState: p.status === "DISABLED" ? "not_configured" : "configured"
          }))
        },
        {
          key: "virtual_numbers",
          label: "Virtual Numbers (International SMS)",
          providers: virtualNumbers.map((p) => ({
            ...p,
            services: ["SMS-receiving numbers"],
            configurationState: p.status === "DISABLED" ? "not_configured" : "configured"
          }))
        },
        {
          key: "payments",
          label: "Payments",
          providers: [
            {
              name: "korapay",
              status: korapayConfigured ? "HEALTHY" : "DISABLED",
              latencyMs: null,
              successRateBps: null,
              lastCheckedAt: null,
              reason: korapayConfigured ? null : "PAYMENT_PROVIDER is not set to live, or KORAPAY_SECRET_KEY is missing.",
              services: ["Wallet top-up", "Payment intents"],
              configurationState: korapayConfigured ? "configured" : "not_configured"
            },
            {
              name: "paystack",
              status: paystackConfigured ? "HEALTHY" : "DISABLED",
              latencyMs: null,
              successRateBps: null,
              lastCheckedAt: null,
              reason: paystackConfigured ? null : "PAYMENT_PROVIDER is not set to live, or PAYSTACK_SECRET_KEY is missing.",
              services: ["Wallet top-up", "Payment intents"],
              configurationState: paystackConfigured ? "configured" : "not_configured"
            }
          ]
        },
        {
          key: "fx",
          label: "FX",
          providers: [
            {
              name: "admin_managed_rate",
              status: fxRateCount > 0 ? "HEALTHY" : "DEGRADED",
              latencyMs: null,
              successRateBps: null,
              lastCheckedAt: null,
              reason: fxRateCount > 0 ? null : "No FX rate has ever been set — quotes use a bootstrap fallback.",
              services: ["USD/NGN conversion for digital products"],
              configurationState: fxRateCount > 0 ? "configured" : "bootstrap_fallback"
            }
          ]
        },
        {
          key: "global_digital_products",
          label: "Global Digital Products",
          providers: [
            {
              name: "reloadly",
              status: reloadlyConfigured ? "HEALTHY" : "DISABLED",
              latencyMs: null,
              successRateBps: null,
              lastCheckedAt: null,
              reason: reloadlyConfigured ? null : "Reloadly client ID/key are missing.",
              services: ["Gift card purchase"],
              configurationState: reloadlyConfigured ? "configured" : "not_configured"
            },
            {
              name: "SOGO",
              status: sogoConfigured ? "HEALTHY" : "DISABLED",
              latencyMs: null,
              successRateBps: null,
              lastCheckedAt: null,
              reason: sogoConfigured ? null : "SOGO API or secret key is missing.",
              services: ["Gift card sell/cashout"],
              configurationState: sogoConfigured ? "configured" : "not_configured"
            }
          ],
          configurationState: reloadlyConfigured || sogoConfigured ? "configured" : "not_configured"
        },
        {
          key: "virtual_cards",
          label: "Virtual Cards",
          providers: [],
          configurationState: "not_configured",
          note: "No card-issuing provider is connected yet."
        }
      ]
    };
  }

  // ─── Provider registry (generic, all domains) ───────────────────────────────
  // Reads/writes ProviderConfig directly, joined with the latest ProviderHealth
  // row per provider. Generalizes the VTU-only admin routing pattern
  // (apps/admin/app/vtu/page.tsx + AdminVtuController) across every
  // ProviderDomain instead of hand-listing providers per vertical.

  async listRegistry(domain?: ProviderDomain) {
    const configs = await this.db.providerConfig.findMany({
      where: { deletedAt: null, ...(domain ? { domain } : {}) },
      orderBy: [{ domain: "asc" }, { priority: "asc" }]
    });

    if (configs.length === 0) {
      return [];
    }

    const names = configs.map((c) => c.name);
    const healthRows = await this.db.providerHealth.findMany({
      where: { providerName: { in: names } },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });

    return configs.map((config) => {
      const health = healthRows.find((h) => h.providerName === config.name);
      return {
        id: config.id,
        name: config.name,
        domain: config.domain,
        tier: config.tier,
        status: config.status,
        priority: config.priority,
        enabledCountries: config.enabledCountries,
        enabledNetworks: config.enabledNetworks,
        enabledProductTypes: config.enabledProductTypes,
        credentialsRef: config.credentialsRef,
        updatedAt: config.updatedAt,
        health: health
          ? {
              status: health.status,
              latencyMs: health.latencyMs,
              successRateBps: health.successRateBps,
              balanceMinor: health.balanceMinor,
              currency: health.currency,
              reason: health.reason,
              checkedAt: health.checkedAt
            }
          : null
      };
    });
  }

  async updateRegistryEntry(
    id: string,
    dto: { priority?: number; status?: "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED" },
    context: Partial<AuthenticatedRequestContext>
  ) {
    if (!context.userId) {
      throw new BadRequestException("An authenticated admin user is required.");
    }

    const config = await this.db.providerConfig.findFirst({ where: { id, deletedAt: null } });
    if (!config) {
      throw new NotFoundException(`No ProviderConfig row exists with id ${id}.`);
    }

    const updated = await this.db.providerConfig.update({
      where: { id },
      data: {
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {})
      }
    });

    await this.db.auditLog.create({
      data: {
        actorUserId: context.userId,
        action: "provider.registry_update",
        entityType: "ProviderConfig",
        entityId: config.id,
        metadata: {
          domain: config.domain,
          name: config.name,
          previousPriority: config.priority,
          previousStatus: config.status,
          nextPriority: updated.priority,
          nextStatus: updated.status
        }
      }
    });

    return updated;
  }

  // ─── Emergency disable ───────────────────────────────────────────────────────
  // ProviderConfig.status is already the hard gate scoreCandidate()/selectProviders()
  // check (handbook 11 §6's "feature_flag_override" is this column, not a separate
  // mechanism — see the plan's amendment note for Gap 8). This is the admin action
  // that flips it, with an audit trail distinct from the routing decision log.

  async setProviderStatus(
    domain: ProviderDomain,
    name: string,
    status: "HEALTHY" | "DISABLED",
    context: Partial<AuthenticatedRequestContext>,
    reason?: string
  ) {
    if (!context.userId) {
      throw new BadRequestException("An authenticated admin user is required.");
    }

    const config = await this.db.providerConfig.findFirst({
      where: { name, domain, deletedAt: null }
    });
    if (!config) {
      throw new NotFoundException(`No ProviderConfig row exists for ${domain}/${name}.`);
    }

    const previousStatus = config.status;
    const updated = await this.db.providerConfig.update({
      where: { id: config.id },
      data: { status }
    });

    await this.db.auditLog.create({
      data: {
        actorUserId: context.userId,
        action: status === "DISABLED" ? "provider.emergency_disable" : "provider.re_enable",
        entityType: "ProviderConfig",
        entityId: config.id,
        metadata: { domain, name, previousStatus, nextStatus: status, reason: reason ?? null }
      }
    });

    return { name: updated.name, domain: updated.domain, status: updated.status, previousStatus };
  }
}
