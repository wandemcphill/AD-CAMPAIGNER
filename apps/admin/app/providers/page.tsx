"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Network, Plus, RefreshCcw, ShieldCheck, ShieldOff, Tags } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

// Keep in step with HIGH_MARKUP_BPS in PricingRuleService.
const HIGH_MARKUP_BPS = 10_000;

type ProviderStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED";

type ProviderHealth = {
  status: ProviderStatus;
  latencyMs: number;
  successRateBps: number;
  balanceMinor: number | null;
  currency: string | null;
  reason: string | null;
  checkedAt: string;
} | null;

type ProviderRegistryEntry = {
  id: string;
  name: string;
  domain: string;
  tier: string;
  status: ProviderStatus;
  priority: number;
  enabledCountries: string[];
  enabledNetworks: string[];
  enabledProductTypes: string[];
  credentialsRef: string | null;
  updatedAt: string;
  health: ProviderHealth;
};

const DOMAIN_LABEL: Record<string, string> = {
  VIRTUAL_NUMBER: "Virtual Numbers",
  VTU: "VTU (Airtime & Data)",
  GIFT_CARD: "Gift Cards",
  AIRTIME_CASHOUT: "Airtime Cashout",
  CRYPTO: "Crypto",
  RMB: "RMB",
  VIRTUAL_ACCOUNT: "Virtual Accounts",
  VIRTUAL_CARD: "Virtual Cards",
  REMITTANCE: "Remittance",
  TELECOM: "International Telecom"
};

const DOMAINS = Object.keys(DOMAIN_LABEL);

// Provider-side customer enrollments. Holds no identity data by design — only
// the opaque provider customer id and the tier reached.
interface ProviderCustomerRow {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  providerName: string;
  providerCustomerId: string;
  tier: string | null;
  status: string;
  createdAt: string;
}

interface PricingRuleRow {
  id: string;
  domain: string;
  countryCode: string | null;
  network: string | null;
  productType: string | null;
  providerName: string | null;
  markupBps: number;
  active: boolean;
  specificity: number;
}

interface NumberCompatibilityRow {
  id: string;
  serviceKey: string;
  countryCode: string | null;
  providerName: string | null;
  numberType: string | null;
  level: string;
  blocked: boolean;
  evidence: string | null;
  updatedAt: string;
}

const TABS = [
  { id: "registry", label: "Registry" },
  { id: "grants", label: "Capability Grants" },
  { id: "pricing", label: "Pricing Rules" },
  { id: "compatibility", label: "Number Compatibility" },
  { id: "customers", label: "Enrollments" }
];

// Mirrors CAPABILITY_LADDER in ProvidersService. Order is load-bearing: the
// server refuses to raise a rung until every rung before it is met, and clearing
// one clears everything after it.
const CAPABILITY_LADDER = [
  "documented",
  "implemented",
  "sandboxVerified",
  "kybApproved",
  "complianceApproved",
  "productionApproved",
  "enabled"
] as const;

type CapabilityRung = (typeof CAPABILITY_LADDER)[number];

const RUNG_LABEL: Record<CapabilityRung, string> = {
  documented: "Documented",
  implemented: "Adapter built",
  sandboxVerified: "Sandbox verified",
  kybApproved: "KYB approved",
  complianceApproved: "Compliance approved",
  productionApproved: "Production approved",
  enabled: "Live"
};

const RUNG_HINT: Record<CapabilityRung, string> = {
  documented: "Official API docs confirm this capability exists.",
  implemented: "Adapter code for it is merged.",
  sandboxVerified: "A real sandbox call succeeded end to end.",
  kybApproved: "The provider has approved our business account.",
  complianceApproved: "Internal compliance sign-off is on file.",
  productionApproved: "Production credentials issued and tested.",
  enabled: "Routable for real customer money."
};

interface CapabilityGrantRow {
  id: string;
  providerName: string;
  capability: string;
  domain: string;
  ladder: Record<CapabilityRung, boolean>;
  nextRung: CapabilityRung | null;
  routable: boolean;
  hasProviderConfig: boolean;
  providerConfigStatus: ProviderStatus | null;
  priority: number;
  notes: string | null;
  updatedAt: string;
}

const STATUS_TONE: Record<ProviderStatus, "success" | "warning" | "danger" | "neutral"> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  DOWN: "danger",
  DISABLED: "neutral"
};

function formatMoney(minor: number | null, currency: string | null) {
  if (minor === null || !currency) return "—";
  return new Intl.NumberFormat("en-NG", {
    currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(minor / 100);
}

export default function AdminProvidersPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [tab, setTab] = useState("registry");
  const [entries, setEntries] = useState<ProviderRegistryEntry[]>([]);
  const [grants, setGrants] = useState<CapabilityGrantRow[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRuleRow[]>([]);
  const [compatRows, setCompatRows] = useState<NumberCompatibilityRow[]>([]);
  const [providerCustomers, setProviderCustomers] = useState<ProviderCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [savingId, setSavingId] = useState<string>();

  const [ruleDomain, setRuleDomain] = useState(DOMAINS[0]!);
  const [ruleCountry, setRuleCountry] = useState("");
  const [ruleProductType, setRuleProductType] = useState("");
  const [ruleProvider, setRuleProvider] = useState("");
  const [ruleMarkupBps, setRuleMarkupBps] = useState("200");
  const [ruleSubmitting, setRuleSubmitting] = useState(false);

  const [compatServiceKey, setCompatServiceKey] = useState("");
  const [compatCountry, setCompatCountry] = useState("");
  const [compatProvider, setCompatProvider] = useState("");
  const [compatBlocked, setCompatBlocked] = useState(true);
  const [compatEvidence, setCompatEvidence] = useState("");
  const [compatSubmitting, setCompatSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [registryRes, grantsRes, rulesRes, compatRes, customersRes] = await Promise.all([
        apiRequest<ProviderRegistryEntry[]>("/admin/providers/registry"),
        apiRequest<CapabilityGrantRow[]>("/admin/providers/capability-grants"),
        apiRequest<PricingRuleRow[]>("/admin/providers/pricing-rules"),
        apiRequest<NumberCompatibilityRow[]>("/admin/digital-products/compatibility"),
        apiRequest<ProviderCustomerRow[]>("/admin/providers/customers")
      ]);
      setEntries(registryRes);
      setGrants(grantsRes);
      setPricingRules(rulesRes);
      setCompatRows(compatRes);
      setProviderCustomers(customersRes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the provider registry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) {
      void refresh();
    }
  }, [sessionLoading, session, refresh]);

  // Clicking a rung either raises the grant to it or revokes it. The server owns
  // both rules — this only warns first, because "Live" is the switch that lets
  // real customer money reach a provider, and revoking mid-ladder silently drops
  // everything above it.
  async function toggleRung(grant: CapabilityGrantRow, rung: CapabilityRung) {
    const currentlyMet = grant.ladder[rung];
    const label = `${grant.providerName} · ${grant.capability}`;

    if (!currentlyMet && rung === "enabled") {
      const confirmed = window.confirm(
        `Make ${label} live?\n\n` +
          "Real customer money will start routing to this provider immediately."
      );
      if (!confirmed) return;
    }

    if (currentlyMet) {
      const above = CAPABILITY_LADDER.slice(CAPABILITY_LADDER.indexOf(rung) + 1).filter(
        (higher) => grant.ladder[higher]
      );
      if (above.length > 0) {
        const confirmed = window.confirm(
          `Revoke "${RUNG_LABEL[rung]}" for ${label}?\n\n` +
            `This also clears: ${above.map((r) => RUNG_LABEL[r]).join(", ")}.` +
            (grant.ladder.enabled ? "\n\nThe provider stops routing immediately." : "")
        );
        if (!confirmed) return;
      }
    }

    const reason = window.prompt(
      `Why is "${RUNG_LABEL[rung]}" being ${currentlyMet ? "revoked" : "granted"} for ${label}?\n` +
        "Recorded in the audit log."
    );
    if (reason === null) return;

    setSavingId(grant.id);
    setError(undefined);
    try {
      await apiRequest(`/admin/providers/capability-grants/${encodeURIComponent(grant.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          [rung]: !currentlyMet,
          ...(reason.trim() ? { reason: reason.trim() } : {})
        })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this capability grant.");
    } finally {
      setSavingId(undefined);
    }
  }

  async function submitPricingRule() {
    const markupBps = Number(ruleMarkupBps);
    if (!Number.isInteger(markupBps) || markupBps < 0) {
      setError("Enter a whole, non-negative markup in basis points (100 bps = 1%).");
      return;
    }

    // Mirrors the server guard in PricingRuleService. A rule silently reprices
    // every order in its domain, so anything over 100% needs a deliberate yes.
    let confirmHighMarkup = false;
    if (markupBps > HIGH_MARKUP_BPS) {
      confirmHighMarkup = window.confirm(
        `${(markupBps / 100).toFixed(2)}% markup on every ${ruleDomain} order matching this rule.\n\n` +
          "That is unusually high. Apply it?"
      );
      if (!confirmHighMarkup) return;
    }

    setRuleSubmitting(true);
    setError(undefined);
    try {
      await apiRequest("/admin/providers/pricing-rules", {
        method: "POST",
        body: JSON.stringify({
          domain: ruleDomain,
          ...(ruleCountry.trim() ? { countryCode: ruleCountry.trim().toUpperCase() } : {}),
          ...(ruleProductType.trim() ? { productType: ruleProductType.trim().toUpperCase() } : {}),
          ...(ruleProvider.trim() ? { providerName: ruleProvider.trim() } : {}),
          markupBps,
          ...(confirmHighMarkup ? { confirmHighMarkup } : {})
        })
      });
      setRuleCountry("");
      setRuleProductType("");
      setRuleProvider("");
      setRuleMarkupBps("200");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this pricing rule.");
    } finally {
      setRuleSubmitting(false);
    }
  }

  async function toggleRuleActive(rule: PricingRuleRow) {
    setSavingId(rule.id);
    setError(undefined);
    try {
      await apiRequest(`/admin/providers/pricing-rules/${encodeURIComponent(rule.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !rule.active })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this pricing rule.");
    } finally {
      setSavingId(undefined);
    }
  }

  async function submitCompatibility() {
    if (!compatServiceKey.trim()) {
      setError("A service key is required.");
      return;
    }
    setCompatSubmitting(true);
    setError(undefined);
    try {
      await apiRequest("/admin/digital-products/compatibility", {
        method: "POST",
        body: JSON.stringify({
          serviceKey: compatServiceKey.trim(),
          ...(compatCountry.trim() ? { countryCode: compatCountry.trim().toUpperCase() } : {}),
          ...(compatProvider.trim() ? { providerName: compatProvider.trim() } : {}),
          blocked: compatBlocked,
          ...(compatEvidence.trim() ? { evidence: compatEvidence.trim() } : {})
        })
      });
      setCompatServiceKey("");
      setCompatCountry("");
      setCompatProvider("");
      setCompatEvidence("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this compatibility record.");
    } finally {
      setCompatSubmitting(false);
    }
  }

  const groups = useMemo(() => {
    const byDomain = new Map<string, ProviderRegistryEntry[]>();
    for (const entry of entries) {
      const list = byDomain.get(entry.domain) ?? [];
      list.push(entry);
      byDomain.set(entry.domain, list);
    }
    for (const list of byDomain.values()) {
      list.sort((a, b) => a.priority - b.priority);
    }
    return [...byDomain.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  async function updateEntry(id: string, patch: { priority?: number; status?: ProviderStatus }) {
    setSavingId(id);
    setError(undefined);
    try {
      const updated = await apiRequest<{ id: string; priority: number; status: ProviderStatus }>(
        `/admin/providers/registry/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, priority: updated.priority, status: updated.status } : e))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this provider.");
    } finally {
      setSavingId(undefined);
    }
  }

  async function swapPriority(a: ProviderRegistryEntry, b: ProviderRegistryEntry) {
    setSavingId(a.id);
    setError(undefined);
    try {
      const [updatedA, updatedB] = await Promise.all([
        apiRequest<{ id: string; priority: number }>(
          `/admin/providers/registry/${encodeURIComponent(a.id)}`,
          { method: "PATCH", body: JSON.stringify({ priority: b.priority }) }
        ),
        apiRequest<{ id: string; priority: number }>(
          `/admin/providers/registry/${encodeURIComponent(b.id)}`,
          { method: "PATCH", body: JSON.stringify({ priority: a.priority }) }
        )
      ]);
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id === updatedA.id) return { ...e, priority: updatedA.priority };
          if (e.id === updatedB.id) return { ...e, priority: updatedB.priority };
          return e;
        })
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reorder these providers.");
    } finally {
      setSavingId(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Providers auth" />;
  }

  return (
    <AdminShell active="/providers/">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Provider registry</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          Every ProviderConfig row across all domains, joined with its latest health check. Lower
          priority number wins routing within a domain. Swap two rows to reorder, or toggle a
          provider off without deleting it.
        </p>

        {error && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        <div className="mt-4">
          <TabBar items={TABS} onChange={setTab} value={tab} />
        </div>

        {tab === "registry" && (
        <div className="mt-6 grid gap-4">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading providers...</Panel>
          ) : groups.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
              No providers are registered yet. Run the seed script to populate defaults.
            </Panel>
          ) : (
            groups.map(([domain, domainEntries]) => (
              <Panel className="p-4" key={domain}>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ft-text-primary)]">
                  <Network className="size-4 text-[var(--ft-accent)]" />
                  {DOMAIN_LABEL[domain] ?? domain}
                </div>

                <div className="mt-3 grid gap-2">
                  {domainEntries.map((entry, index) => {
                    const disabled = entry.status === "DISABLED";
                    return (
                      <div
                        className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] p-3 ${
                          disabled ? "bg-[var(--ft-bg-muted)] opacity-70" : "bg-[var(--ft-bg-surface)]"
                        }`}
                        key={entry.id}
                      >
                        <div className="w-6 text-center text-sm font-mono text-[var(--ft-text-muted)]">
                          {entry.priority}
                        </div>
                        <div className="min-w-[10rem] flex-1">
                          <div className="text-sm font-medium">{entry.name}</div>
                          <div className="text-xs text-[var(--ft-text-muted)]">
                            {entry.tier} tier
                            {!entry.credentialsRef && !disabled
                              ? " · no credentials reference set"
                              : ""}
                          </div>
                          {disabled && (
                            <div className="text-xs text-[var(--ft-text-muted)]">
                              Not configured — awaiting API credentials.
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-[var(--ft-text-muted)]">
                          {entry.health ? (
                            <>
                              <div>{entry.health.latencyMs} ms · {(entry.health.successRateBps / 100).toFixed(1)}% success</div>
                              {entry.health.balanceMinor !== null && (
                                <div>Balance {formatMoney(entry.health.balanceMinor, entry.health.currency)}</div>
                              )}
                              <div>Checked {new Date(entry.health.checkedAt).toLocaleString()}</div>
                            </>
                          ) : (
                            <div>No health check recorded yet.</div>
                          )}
                        </div>

                        <Badge tone={STATUS_TONE[entry.status]}>{entry.status.toLowerCase()}</Badge>

                        {index < domainEntries.length - 1 && (
                          <Button
                            disabled={savingId !== undefined}
                            onClick={() => void swapPriority(entry, domainEntries[index + 1]!)}
                            variant="secondary"
                          >
                            <ArrowUpDown className="size-4" />
                            Swap
                          </Button>
                        )}
                        <Button
                          disabled={savingId !== undefined}
                          onClick={() =>
                            void updateEntry(entry.id, {
                              status: disabled ? "HEALTHY" : "DISABLED"
                            })
                          }
                          variant={disabled ? "primary" : "secondary"}
                        >
                          {disabled ? "Enable" : "Disable"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            ))
          )}
        </div>
        )}

        {tab === "grants" && (
        <div className="grid gap-3">
          <Panel className="p-5 text-sm text-[var(--ft-text-muted)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ft-text-primary)]">
              <ShieldCheck className="size-4 text-[var(--ft-accent)]" />
              How routing is gated
            </div>
            <p className="mt-2 max-w-[70ch]">
              Accounts, cards and remittance only route to a provider that has reached{" "}
              <span className="font-medium text-[var(--ft-text-primary)]">Live</span> here. A
              provider in the registry without a live grant is skipped entirely, whatever its
              status. Each step has to be earned in order, and revoking one clears every step
              after it.
            </p>
          </Panel>

          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading capability grants...</Panel>
          ) : grants.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
              No capability grants exist yet. Run{" "}
              <code className="font-mono text-xs">pnpm --filter @fliptrybe/database seed:provider-capability-grants</code>{" "}
              to create them.
            </Panel>
          ) : (
            grants.map((grant) => {
              const blockedByConfig = !grant.hasProviderConfig;
              return (
                <Panel className="p-4" key={grant.id}>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <div className="text-sm font-medium">{grant.providerName}</div>
                      <div className="text-xs text-[var(--ft-text-muted)]">
                        {DOMAIN_LABEL[grant.domain] ?? grant.domain} · {grant.capability}
                      </div>
                    </div>

                    {grant.routable ? (
                      <Badge tone="success">routing</Badge>
                    ) : grant.nextRung ? (
                      <Badge tone="warning">next: {RUNG_LABEL[grant.nextRung]}</Badge>
                    ) : (
                      <Badge tone="neutral">not routing</Badge>
                    )}
                  </div>

                  {blockedByConfig && (
                    <div className="mt-2 text-xs text-[var(--ft-text-muted)]">
                      No provider registry entry named{" "}
                      <span className="font-mono">{grant.providerName}</span> — this grant cannot
                      route until one exists, however far it climbs.
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {CAPABILITY_LADDER.map((rung, index) => {
                      const met = grant.ladder[rung];
                      const blocked =
                        !met && CAPABILITY_LADDER.slice(0, index).some((l) => !grant.ladder[l]);
                      return (
                        <button
                          className={`rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors ${
                            met
                              ? "border-[var(--ft-accent)] bg-[var(--ft-bg-surface)]"
                              : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)]"
                          } ${blocked || savingId !== undefined ? "cursor-not-allowed opacity-50" : "hover:border-[var(--ft-accent)]"}`}
                          disabled={blocked || savingId !== undefined}
                          key={rung}
                          onClick={() => void toggleRung(grant, rung)}
                          title={blocked ? "Earn the earlier steps first." : RUNG_HINT[rung]}
                          type="button"
                        >
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <span
                              aria-hidden="true"
                              className={`inline-block size-2 rounded-full ${
                                met ? "bg-[var(--ft-accent)]" : "bg-[var(--ft-border)]"
                              }`}
                            />
                            {RUNG_LABEL[rung]}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {grant.notes && (
                    <div className="mt-3 text-xs text-[var(--ft-text-muted)]">{grant.notes}</div>
                  )}
                </Panel>
              );
            })
          )}
        </div>
        )}

        {tab === "pricing" && (
          <div className="mt-6 grid gap-4">
            <Panel className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="size-4 text-[var(--ft-accent)]" />
                New pricing rule
              </div>
              <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
                Leave a field blank to match any value for that dimension — more populated fields
                win over less specific rules. Overrides the hardcoded default markup when active.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <select
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setRuleDomain(e.target.value)}
                  value={ruleDomain}
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {DOMAIN_LABEL[d] ?? d}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setRuleCountry(e.target.value)}
                  placeholder="Country code (optional)"
                  value={ruleCountry}
                />
                <input
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  list="pricing-product-types"
                  onChange={(e) => setRuleProductType(e.target.value)}
                  placeholder="Product type (optional)"
                  value={ruleProductType}
                />
                {/* Free text, so the codes the services actually look up are not
                    discoverable otherwise. VIRTUAL_CARD reads two: <CCY>_CARD is
                    a bps markup on the funded amount, <CCY>_CARD_ISSUANCE is a
                    FLAT per-card fee in kobo (markupBps reused as the amount —
                    the table has no flat-fee column). */}
                <datalist id="pricing-product-types">
                  <option value="NGN_CARD" />
                  <option value="USD_CARD" />
                  <option value="NGN_CARD_ISSUANCE" />
                  <option value="USD_CARD_ISSUANCE" />
                  <option value="NGN_ACCOUNT" />
                  <option value="BANK_TRANSFER" />
                  <option value="EDUCATION" />
                </datalist>
                <input
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setRuleProvider(e.target.value)}
                  placeholder="Provider name (optional)"
                  value={ruleProvider}
                />
                <input
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setRuleMarkupBps(e.target.value)}
                  placeholder="Markup (bps, e.g. 200 = 2%)"
                  type="number"
                  value={ruleMarkupBps}
                />
                <Button disabled={ruleSubmitting} onClick={() => void submitPricingRule()}>
                  Create rule
                </Button>
              </div>
            </Panel>

            {pricingRules.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
                No pricing rules yet — every vertical is using its hardcoded default markup.
              </Panel>
            ) : (
              pricingRules.map((rule) => (
                <Panel className="flex items-center gap-4 p-4" key={rule.id}>
                  <Tags className="size-4 text-[var(--ft-accent)]" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {DOMAIN_LABEL[rule.domain] ?? rule.domain} · {(rule.markupBps / 100).toFixed(2)}% markup
                    </div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {[rule.countryCode, rule.productType, rule.providerName].filter(Boolean).join(" · ") ||
                        "matches any country/product/provider"}
                    </div>
                  </div>
                  <Badge tone={rule.active ? "success" : "neutral"}>
                    {rule.active ? "active" : "inactive"}
                  </Badge>
                  <Button
                    disabled={savingId !== undefined}
                    onClick={() => void toggleRuleActive(rule)}
                    variant="secondary"
                  >
                    {rule.active ? "Deactivate" : "Activate"}
                  </Button>
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "compatibility" && (
          <div className="mt-6 grid gap-4">
            <Panel className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldOff className="size-4 text-[var(--ft-accent)]" />
                Record compatibility test result
              </div>
              <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
                A blocked provider+country combination is excluded from virtual-number purchase
                routing automatically.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <input
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setCompatServiceKey(e.target.value)}
                  placeholder="Service key (e.g. whatsapp)"
                  value={compatServiceKey}
                />
                <input
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setCompatCountry(e.target.value)}
                  placeholder="Country code"
                  value={compatCountry}
                />
                <input
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setCompatProvider(e.target.value)}
                  placeholder="Provider name"
                  value={compatProvider}
                />
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input
                    checked={compatBlocked}
                    onChange={(e) => setCompatBlocked(e.target.checked)}
                    type="checkbox"
                  />
                  Blocked
                </label>
                <input
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)] sm:col-span-2"
                  onChange={(e) => setCompatEvidence(e.target.value)}
                  placeholder="Evidence / note (optional)"
                  value={compatEvidence}
                />
                <Button disabled={compatSubmitting} onClick={() => void submitCompatibility()}>
                  Save
                </Button>
              </div>
            </Panel>

            {compatRows.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
                No compatibility test results recorded yet.
              </Panel>
            ) : (
              compatRows.map((row) => (
                <Panel className="flex items-center gap-4 p-4" key={row.id}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {row.serviceKey} · {row.countryCode ?? "any country"} · {row.providerName ?? "any provider"}
                    </div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {row.level.toLowerCase().replace(/_/g, " ")}
                      {row.evidence ? ` · ${row.evidence}` : ""} · {new Date(row.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge tone={row.blocked ? "danger" : "success"}>
                    {row.blocked ? "blocked" : "allowed"}
                  </Badge>
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "customers" && (
          <div className="mt-6 grid gap-3">
            <Panel className="p-4 text-xs leading-5 text-[var(--ft-text-secondary)]">
              A card issuer that requires a verified customer (Payscribe, Sudo) will not
              issue until the workspace appears here. This is the first thing to check when a
              customer reports that card creation fails.
              <br />
              No identity data is stored — only the issuer&rsquo;s own customer id and the tier
              reached. Use that id to reconcile against the provider dashboard.
            </Panel>

            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading enrollments...</Panel>
            ) : providerCustomers.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
                No workspace has enrolled with a card issuer yet.
              </Panel>
            ) : (
              providerCustomers.map((row) => (
                <Panel className="flex items-center gap-3 p-4" key={row.id}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {row.workspaceName ?? row.workspaceId}
                      {!row.workspaceName && (
                        <span className="ml-2 text-xs font-normal text-[var(--ft-yellow)]">
                          workspace deleted
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-[var(--ft-text-muted)]">
                      {row.providerName} · {row.providerCustomerId}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-[var(--ft-text-muted)]">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </div>
                  {row.tier && <Badge tone="info">tier {row.tier}</Badge>}
                  <Badge tone={row.status === "ACTIVE" ? "success" : "neutral"}>
                    {row.status.toLowerCase()}
                  </Badge>
                </Panel>
              ))
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
