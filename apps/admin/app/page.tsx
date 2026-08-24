"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, Boxes, FileSearch, Network, RefreshCcw, ShieldAlert, Users } from "lucide-react";

import { Badge, Button, MetricCard, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { AdminShell } from "./admin-shell";
import { apiRequest } from "./lib/api-client";
import { useApiSession } from "./lib/use-session";
import { AdminAuthState } from "./ui/admin-auth-state";

type CommandOverview = {
  generatedAt: string;
  users: { total: number; active: number; new24h: number; suspended: number };
  campaigns: { active: number; pendingReview: number };
  payments: { volumeMinor30d: number; pending: number; failed24h: number };
  wallets: { active: number };
  fulfilment: { growthOpen: number; vtuOpen: number; virtualNumbersOpen: number };
  risk: { review: number; high: number };
};

type Alert = {
  id: string;
  severity: "danger" | "warning";
  category: string;
  title: string;
  detail: string;
  href: string;
};

type AlertsResponse = {
  generatedAt: string;
  totals: { all: number; danger: number; warning: number };
  alerts: Alert[];
};

const QUICK_LINKS = [
  { label: "Operations Control Tower", href: "/operations-control-tower/", icon: Network },
  { label: "Risk & Security", href: "/risk/", icon: ShieldAlert },
  { label: "Payments", href: "/payments/", icon: Banknote },
  { label: "Fulfilment", href: "/fulfilment/", icon: Boxes },
  { label: "Product Governance", href: "/product-governance/", icon: Boxes },
  { label: "Provider Governance", href: "/provider-governance/", icon: Network },
  { label: "Users", href: "/users/", icon: Users },
  { label: "Audit Trail", href: "/audit/", icon: FileSearch }
];

function money(minor: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(minor / 100);
}

export default function AdminPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [overview, setOverview] = useState<CommandOverview>();
  const [alerts, setAlerts] = useState<AlertsResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextOverview, nextAlerts] = await Promise.all([
        apiRequest<CommandOverview>("/admin/command-center/overview"),
        apiRequest<AlertsResponse>("/admin/command-center/alerts")
      ]);
      setOverview(nextOverview);
      setAlerts(nextAlerts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the admin command center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.isPlatformAdmin) void refresh();
  }, [session, refresh]);

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Admin auth" />;
  }

  const riskCount = (overview?.risk.review ?? 0) + (overview?.risk.high ?? 0);
  const fulfilmentOpen =
    (overview?.fulfilment.growthOpen ?? 0) +
    (overview?.fulfilment.vtuOpen ?? 0) +
    (overview?.fulfilment.virtualNumbersOpen ?? 0);

  return (
    <AdminShell active="/" subtitle="Operations command center">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-[var(--ft-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Live API telemetry</Badge>
              <Badge tone={alerts?.totals.danger ? "danger" : alerts?.totals.warning ? "warning" : "success"}>
                {alerts ? `${alerts.totals.all} governance alerts` : "Loading governance"}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Operations command</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              The authoritative control room for users, campaigns, money movement, fulfilment, providers and governance.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCcw className="size-4" />
            {loading ? "Refreshing" : "Refresh"}
          </Button>
        </header>

        {error ? (
          <div className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">{error}</div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
          <SummaryStatStrip
            items={[
              { label: "users", value: String(overview?.users.total ?? "—") },
              { label: "active campaigns", value: String(overview?.campaigns.active ?? "—") },
              { label: "30d payment volume", value: overview ? money(overview.payments.volumeMinor30d) : "—" },
              { label: "open fulfilment", value: String(fulfilmentOpen) },
              { label: "risk items", value: String(riskCount) },
              { label: "active wallets", value: String(overview?.wallets.active ?? "—") }
            ]}
          />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Users" value={String(overview?.users.total ?? "—")} detail={overview ? `${overview.users.new24h} new in 24h · ${overview.users.suspended} suspended` : "Loading"} />
          <MetricCard label="Campaign review" value={String(overview?.campaigns.pendingReview ?? "—")} detail={`${overview?.campaigns.active ?? 0} active campaigns`} />
          <MetricCard label="Payments" value={String(overview?.payments.pending ?? "—")} detail={`${overview?.payments.failed24h ?? 0} failed in 24h`} />
          <MetricCard label="Risk" value={String(riskCount)} detail={`${overview?.risk.high ?? 0} high-risk reviews`} tone={overview?.risk.high ? "warning" : "success"} />
        </section>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Governance alerts</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Items requiring operator attention across the platform.</p>
              </div>
              <AlertTriangle className="size-5 text-[var(--ft-accent)]" />
            </div>
            <div className="mt-4 divide-y divide-[var(--ft-border)]">
              {(alerts?.alerts ?? []).slice(0, 8).map((alert) => (
                <Link className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] hover:bg-[var(--ft-bg-muted)]" href={alert.href} key={alert.id}>
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="mt-1 text-sm text-[var(--ft-text-muted)]">{alert.detail}</div>
                  </div>
                  <Badge tone={alert.severity === "danger" ? "danger" : "warning"}>{alert.severity}</Badge>
                </Link>
              ))}
              {!alerts?.alerts.length ? <div className="py-6 text-sm text-[var(--ft-text-muted)]">No governance alerts.</div> : null}
            </div>
          </Panel>

          <Panel className="p-4">
            <h2 className="text-lg font-semibold">Fulfilment posture</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-muted)]">Open operational work by the major commercial lanes.</p>
            <div className="mt-5 space-y-3">
              {[
                ["Growth", overview?.fulfilment.growthOpen ?? 0],
                ["VTU / Bills", overview?.fulfilment.vtuOpen ?? 0],
                ["Virtual Numbers", overview?.fulfilment.virtualNumbersOpen ?? 0]
              ].map(([label, count]) => (
                <div className="flex items-center justify-between rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3" key={String(label)}>
                  <span>{label}</span>
                  <Badge tone={Number(count) ? "warning" : "success"}>{String(count)} open</Badge>
                </div>
              ))}
            </div>
            <Link className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--ft-accent)]" href="/fulfilment/">
              Open Fulfilment <ArrowRight className="size-4" />
            </Link>
          </Panel>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Admin workspaces</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
              <Link className="flex items-center justify-between gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 text-sm font-medium transition hover:border-[var(--ft-accent)]" href={href} key={href}>
                <span className="flex items-center gap-2"><Icon className="size-4" />{label}</span>
                <ArrowRight className="size-4" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
