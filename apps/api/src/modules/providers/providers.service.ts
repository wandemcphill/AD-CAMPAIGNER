/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import type { ProviderDomain } from "@fliptrybe/providers";
import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";

const VTU_PROVIDERS = ["clubkonnect", "swiftlink", "sirpdata", "topupwizard"];
const VIRTUAL_NUMBER_PROVIDERS = ["smspool", "5sim", "smspva"];

/**
 * The ProviderCapabilityGrant ladder, in the order it must be climbed. Each rung
 * is a claim someone has to stand behind, and `enabled` — the one the router
 * actually checks — sits at the top so it can't be reached without the rest.
 *
 * Order matters: updateCapabilityGrant() reads this array both to reject
 * skipping a step and to cascade a revocation upward.
 */
export const CAPABILITY_LADDER = [
  "documented",
  "implemented",
  "sandboxVerified",
  "kybApproved",
  "complianceApproved",
  "productionApproved",
  "enabled"
] as const;

export type CapabilityRung = (typeof CAPABILITY_LADDER)[number];

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

  // ─── Capability grants ───────────────────────────────────────────────────────
  // ProviderRouterService.select() treats an enabled ProviderCapabilityGrant as a
  // hard allowlist: a ProviderConfig row without one can never be routed, whatever
  // its status. The seed writes every grant with enabled:false on purpose — the
  // ladder is meant to be earned, one deliberate step at a time.
  //
  // Until now nothing in the API or admin app could write this table, so the only
  // way to bring a financial provider live was a manual SQL statement against
  // production. These methods make each rung reachable from the admin app while
  // keeping the ladder's ordering rules enforced server-side.

  async listCapabilityGrants(domain?: ProviderDomain) {
    const grants = await this.db.providerCapabilityGrant.findMany({
      where: domain ? { domain } : {},
      orderBy: [{ domain: "asc" }, { priority: "asc" }, { providerName: "asc" }]
    });

    const configs = await this.db.providerConfig.findMany({
      where: { deletedAt: null, name: { in: grants.map((g) => g.providerName) } }
    });
    const configByName = new Map(configs.map((c) => [c.name, c]));

    return grants.map((grant) => {
      const config = configByName.get(grant.providerName);
      const nextRung = CAPABILITY_LADDER.find((rung) => !grant[rung]);

      return {
        id: grant.id,
        providerName: grant.providerName,
        capability: grant.capability,
        domain: grant.domain,
        ladder: Object.fromEntries(CAPABILITY_LADDER.map((rung) => [rung, grant[rung]])),
        // What an operator has to earn next before this provider can route.
        nextRung: nextRung ?? null,
        routable: grant.enabled && config?.status !== "DISABLED" && config !== undefined,
        // A grant with no matching ProviderConfig row can never route regardless
        // of how far up the ladder it has climbed — surface that rather than
        // letting it look ready.
        hasProviderConfig: config !== undefined,
        providerConfigStatus: config?.status ?? null,
        priority: grant.priority,
        currencies: grant.currencies,
        countries: grant.countries,
        notes: grant.notes,
        updatedAt: grant.updatedAt
      };
    });
  }

  /**
   * Which workspaces are enrolled with which issuer, and at what tier.
   *
   * An enrollment is a hard prerequisite for issuing a card on Payscribe, Sudo
   * and Maplerad, so when a customer reports "I can't create a card" this is the
   * first thing ops needs to see. It is also the only place the provider-side
   * customer id is visible for reconciling against the provider's dashboard.
   *
   * PRIVACY: ProviderCustomer holds no identity data — no DOB, address, ID
   * number or document image. Those go to the provider at enrollment and are
   * dropped. Only the opaque id and tier are stored, so this endpoint cannot
   * leak PII even to an admin.
   */
  async listProviderCustomers(providerName?: string) {
    const customers = await this.db.providerCustomer.findMany({
      where: providerName ? { providerName } : {},
      orderBy: [{ providerName: "asc" }, { createdAt: "desc" }]
    });

    const workspaces = await this.db.workspace.findMany({
      where: { id: { in: customers.map((c) => c.workspaceId) } },
      select: { id: true, name: true }
    });
    const nameByWorkspace = new Map(workspaces.map((w) => [w.id, w.name]));

    return customers.map((customer) => ({
      id: customer.id,
      workspaceId: customer.workspaceId,
      // Null when the workspace has since been deleted — shown rather than
      // hidden so an orphaned enrollment is visible to ops.
      workspaceName: nameByWorkspace.get(customer.workspaceId) ?? null,
      providerName: customer.providerName,
      providerCustomerId: customer.providerCustomerId,
      tier: customer.tier,
      status: customer.status,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    }));
  }

  async updateCapabilityGrant(
    id: string,
    dto: Partial<Record<CapabilityRung, boolean>> & {
      priority?: number;
      notes?: string;
      reason?: string;
    },
    context: Partial<AuthenticatedRequestContext>
  ) {
    if (!context.userId) {
      throw new BadRequestException("An authenticated admin user is required.");
    }

    const grant = await this.db.providerCapabilityGrant.findUnique({ where: { id } });
    if (!grant) {
      throw new NotFoundException(`No ProviderCapabilityGrant row exists with id ${id}.`);
    }

    const next: Record<CapabilityRung, boolean> = Object.fromEntries(
      CAPABILITY_LADDER.map((rung) => [rung, dto[rung] ?? grant[rung]])
    ) as Record<CapabilityRung, boolean>;

    // The two rules below are ordered deliberately. Revocations are applied
    // first, then promotions are validated against the result — so revoking a
    // rung that higher ones stand on is a legal (and cascading) operation
    // rather than something the no-skip rule rejects, while a request that both
    // revokes a rung and promotes above it still fails on the promotion.
    const explicit = CAPABILITY_LADDER.filter((rung) => dto[rung] !== undefined);

    // Rule 1 — clearing a rung clears everything above it. Revoking "sandbox
    // verified" must not leave a provider enabled on the strength of a claim
    // that no longer holds. This only ever reduces access, so it is applied
    // rather than rejected.
    const cascaded: CapabilityRung[] = [];
    for (const rung of explicit.filter((r) => dto[r] === false)) {
      const above = CAPABILITY_LADDER.slice(CAPABILITY_LADDER.indexOf(rung) + 1);
      for (const higher of above) {
        if (!next[higher]) continue;
        next[higher] = false;
        if (!cascaded.includes(higher)) cascaded.push(higher);
      }
    }

    // Rule 2 — no skipping. A rung can only be raised once every rung below it
    // is true, so "enabled" is unreachable without the full ladder beneath it.
    for (const rung of explicit.filter((r) => dto[r] === true)) {
      const missing = CAPABILITY_LADDER.slice(0, CAPABILITY_LADDER.indexOf(rung)).filter(
        (lower) => !next[lower]
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Cannot set "${rung}" for ${grant.providerName}/${grant.capability} while these earlier ` +
            `steps are unmet: ${missing.join(", ")}. The grant ladder must be earned in order.`
        );
      }
    }

    const updated = await this.db.providerCapabilityGrant.update({
      where: { id },
      data: {
        ...next,
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {})
      }
    });

    // Enabling a provider for real money movement is the single most consequential
    // switch in this service — audit it whether or not anything else changed.
    await this.db.auditLog.create({
      data: {
        actorUserId: context.userId,
        action:
          !grant.enabled && updated.enabled
            ? "provider.capability_enabled"
            : grant.enabled && !updated.enabled
              ? "provider.capability_disabled"
              : "provider.capability_updated",
        entityType: "ProviderCapabilityGrant",
        entityId: grant.id,
        metadata: {
          providerName: grant.providerName,
          capability: grant.capability,
          domain: grant.domain,
          previous: Object.fromEntries(CAPABILITY_LADDER.map((r) => [r, grant[r]])),
          next: Object.fromEntries(CAPABILITY_LADDER.map((r) => [r, updated[r]])),
          cascadedOff: cascaded,
          reason: dto.reason ?? null
        }
      }
    });

    return { ...updated, cascadedOff: cascaded };
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
