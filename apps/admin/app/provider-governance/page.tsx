"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Boxes, CheckCircle2, Clock3, Network, ShieldCheck, Tags } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type GovernanceProvider = {
  id: string;
  name: string;
  domain: string;
  status: string;
  priority: number;
  updatedAt: string;
  health: {
    status: string;
    latencyMs: number | null;
    successRateBps: number | null;
    balanceMinor: number | null;
    currency: string | null;
    reason: string | null;
    checkedAt: string;
  } | null;
  grants: Array<{
    capability: string;
    enabled: boolean;
    nextRung: string | null;
    routable: boolean;
    priority: number;
    domain: string;
  }>;
};

type GovernanceData = {
  generatedAt: string;
  totals: {
    providers: number;
    healthy: number;
    disabled: number;
    degraded: number;
    grants: number;
    liveGrants: number;
    pricingRules: number;
    openReconciliation: number;
  };
  providers: GovernanceProvider[];
  grants: Array<{
    id: string;
    providerName: string;
    capability: string;
    domain: string;
    enabled: boolean;
    nextRung: string | null;
    routable: boolean;
    priority: number;
  }>;
  pricingRules: Array<{
    id: string;
    domain: string;
    countryCode: string | null;
    productType: string | null;
    providerName: string | null;
    markupBps: number;
    active: boolean;
  }>;
};

function tone(value: string): "success" | "warning" | "danger" | "neutral" {
  const normalized = value.toUpperCase();
  if (["HEALTHY", "ENABLED"].includes(normalized)) return "success";
  if (["DEGRADED", "PENDING", "REQUIRES_ACTION"].includes(normalized)) return "warning";
  if (["DOWN", "DISABLED", "FAILED"].includes(normalized)) return "danger";
  return "neutral";
}

function percentBps(value: number | null) {
  if (value === null) return "—";
  return `${(value / 100).toFixed(1)}%`;
}

function money(minor: number | null, currency: string | null) {
  if (minor === null || !currency) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

export default function ProviderGovernancePage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [data, setData] = useState<GovernanceData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(undefined);
    setLoading(true);
    try {
      setData(await apiRequest<GovernanceData>("/admin/provider-governance/overview"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load provider governance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void load();
  }, [sessionLoading, session, load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.providers ?? [];
    return (data?.providers ?? []).filter((provider) =>
      [provider.name, provider.domain, provider.status, ...provider.grants.map((g) => g.capability)]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [data, query]);

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Provider governance auth" />;
  }

  const totals = data?.totals;

  return (
    <AdminShell active="/provider-governance/" subtitle="Provider & commercial control">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Network className="size-5 text-[var(--ft-accent)]" />
              <h1 className="text-xl font-bold">Provider Governance</h1>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              One operational view of provider health, production capability gates, routing state,
              pricing coverage and reconciliation pressure.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void load()} variant="secondary">
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        ) : null}

        <div className="mt-5">
          <SummaryStatStrip
            items={[
              { label: "Providers", value: totals?.providers ?? 0, icon: Network },
              { label: "Healthy", value: totals?.healthy ?? 0, icon: CheckCircle2 },
              { label: "Live capabilities", value: totals?.liveGrants ?? 0, icon: ShieldCheck },
              { label: "Pricing rules", value: totals?.pricingRules ?? 0, icon: Tags },
              { label: "Open reconciliation", value: totals?.openReconciliation ?? 0, icon: AlertTriangle }
            ]}
          />
        </div>

        <Panel className="mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Routing control board</div>
              <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
                A provider is only genuinely routable when its capability grant is live and its provider configuration is not disabled.
              </p>
            </div>
            <input
              className="min-w-64 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 py-2 text-sm"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search provider, domain, capability..."
              value={query}
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--ft-border)] text-left text-xs text-[var(--ft-text-muted)]">
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Config</th>
                  <th className="px-3 py-2 font-medium">Health</th>
                  <th className="px-3 py-2 font-medium">Capabilities</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Last check</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((provider) => {
                  const live = provider.grants.filter((grant) => grant.routable).length;
                  const waiting = provider.grants.filter((grant) => !grant.routable && grant.nextRung).length;
                  return (
                    <tr className="border-b border-[var(--ft-border)] last:border-b-0" key={provider.id}>
                      <td className="px-3 py-3">
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-xs text-[var(--ft-text-muted)]">{provider.grants.length} capability grants</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{provider.domain}</td>
                      <td className="px-3 py-3"><Badge tone={tone(provider.status)}>{provider.status}</Badge></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {provider.health ? <Badge tone={tone(provider.health.status)}>{provider.health.status}</Badge> : <Badge tone="neutral">NO DATA</Badge>}
                          {provider.health?.successRateBps !== null && provider.health?.successRateBps !== undefined ? <span className="text-xs text-[var(--ft-text-muted)]">{percentBps(provider.health.successRateBps)}</span> : null}
                        </div>
                        {provider.health ? <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{provider.health.latencyMs ?? "—"}ms · {money(provider.health.balanceMinor, provider.health.currency)}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={live > 0 ? "success" : "neutral"}>{live} live</Badge>
                          {waiting > 0 ? <Badge tone="warning">{waiting} waiting</Badge> : null}
                        </div>
                        <div className="mt-1 max-w-sm text-xs text-[var(--ft-text-muted)]">
                          {provider.grants.slice(0, 3).map((grant) => `${grant.capability}${grant.routable ? " · live" : grant.nextRung ? ` · next ${grant.nextRung}` : " · complete"}`).join(" | ") || "No capability grant"}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{provider.priority}</td>
                      <td className="px-3 py-3 text-xs text-[var(--ft-text-muted)]">
                        {provider.health?.checkedAt ? new Date(provider.health.checkedAt).toLocaleString("en-NG") : "Never"}
                      </td>
                    </tr>
                  );
                })}
                {!loading && filtered.length === 0 ? (
                  <tr><td className="px-3 py-8 text-center text-sm text-[var(--ft-text-muted)]" colSpan={7}>No providers match this view.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel className="p-4">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-[var(--ft-accent)]" />Capability gates</div>
            <div className="mt-3 grid gap-2">
              {(data?.grants ?? []).slice(0, 12).map((grant) => (
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] p-3" key={grant.id}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{grant.providerName} · {grant.capability}</div>
                    <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{grant.domain} · priority {grant.priority}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={grant.routable ? "success" : grant.nextRung ? "warning" : "neutral"}>{grant.routable ? "live" : grant.nextRung ? `next: ${grant.nextRung}` : "complete"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-2 font-semibold"><Tags className="size-4 text-[var(--ft-accent)]" />Active pricing coverage</div>
            <div className="mt-3 grid gap-2">
              {(data?.pricingRules ?? []).slice(0, 12).map((rule) => (
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] p-3" key={rule.id}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{rule.domain}{rule.productType ? ` · ${rule.productType}` : ""}</div>
                    <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{rule.providerName ?? "provider-agnostic"}{rule.countryCode ? ` · ${rule.countryCode}` : ""}</div>
                  </div>
                  <Badge tone="info">{(rule.markupBps / 100).toFixed(2)}%</Badge>
                </div>
              ))}
              {(data?.pricingRules?.length ?? 0) === 0 ? <div className="py-6 text-sm text-[var(--ft-text-muted)]">No active pricing rules returned.</div> : null}
            </div>
          </Panel>
        </div>

        <Panel className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-semibold">Operator links</div>
            <p className="mt-1 text-xs text-[var(--ft-text-muted)]">The detailed editors remain the source of truth for mutations.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => (window.location.href = "/providers/")} variant="secondary"><Network className="size-4" />Provider Registry</Button>
            <Button onClick={() => (window.location.href = "/commercial/")} variant="secondary"><Tags className="size-4" />Products & Pricing</Button>
            <Button onClick={() => (window.location.href = "/reconciliation/")} variant="secondary"><Clock3 className="size-4" />Reconciliation</Button>
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
