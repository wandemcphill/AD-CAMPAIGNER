"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, Banknote, Boxes, RefreshCcw, RotateCcw, Scale, ShieldAlert } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type TowerOverview = {
  generatedAt: string;
  money: {
    failedPayments24h: number;
    pendingPayments: number;
    reconciliationOpen: number;
    reconciliationInvestigating: number;
    reconciliationResolved: number;
  };
  fulfilment: { orders: number; open: number; exceptions: number };
  providers: {
    degraded: number;
    down: number;
    incidents: Array<{ providerName: string; status: string; latencyMs: number | null; reason: string | null; checkedAt: string }>;
  };
  governance: {
    alerts: { all: number; danger: number; warning: number };
    recentPrivilegedActivity: Array<{ id: string; actorUserId: string | null; action: string; entityType: string; entityId: string; createdAt: string }>;
  };
};

type QueueItem = {
  id: string;
  priority: "danger" | "warning";
  type: "GOVERNANCE" | "FULFILMENT" | "RECONCILIATION" | "PAYMENT";
  title: string;
  detail: string;
  href: string;
  createdAt: string;
  action?: "RECONCILE";
  domain?: string;
  resourceId?: string;
};

type QueueResponse = {
  generatedAt: string;
  totals: { all: number; danger: number; warning: number };
  items: QueueItem[];
};

const iconFor = {
  GOVERNANCE: ShieldAlert,
  FULFILMENT: Boxes,
  RECONCILIATION: Scale,
  PAYMENT: Banknote
} as const;

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function OperationsControlTowerPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [overview, setOverview] = useState<TowerOverview>();
  const [queue, setQueue] = useState<QueueResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextOverview, nextQueue] = await Promise.all([
        apiRequest<TowerOverview>("/admin/operations-control-tower/overview"),
        apiRequest<QueueResponse>("/admin/operations-control-tower/queue")
      ]);
      setOverview(nextOverview);
      setQueue(nextQueue);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the operations control tower.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.isPlatformAdmin) void refresh();
  }, [session, refresh]);

  async function reconcile(item: QueueItem) {
    if (item.action !== "RECONCILE" || !item.domain || !item.resourceId) return;
    const reason = window.prompt(
      `Why should ${item.domain} ${item.resourceId} be opened for reconciliation?`,
      "Provider result needs investigation."
    );
    if (reason === null || !reason.trim()) return;

    setBusy(item.id);
    setError(undefined);
    try {
      await apiRequest(`/admin/operations-control-tower/fulfilment/${encodeURIComponent(item.domain)}/${encodeURIComponent(item.resourceId)}/reconcile`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open reconciliation.");
    } finally {
      setBusy(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Operations control tower auth" />;
  }

  return (
    <AdminShell active="/operations-control-tower/" subtitle="Operations control tower">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-[var(--ft-accent)]" />
              <h1 className="text-xl font-bold">Operations Control Tower</h1>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-[var(--ft-text-secondary)]">
              One queue for the problems that can affect money, fulfilment, provider availability and platform governance.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCcw className="size-4" />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error ? <Panel className="mt-4 border-[var(--ft-red)]/30 p-4 text-sm text-[var(--ft-red)]">{error}</Panel> : null}

        <div className="mt-5">
          <SummaryStatStrip
            items={[
              { label: "Critical queue", value: String(queue?.totals.danger ?? 0) },
              { label: "Warnings", value: String(queue?.totals.warning ?? 0) },
              { label: "Fulfilment open", value: String(overview?.fulfilment.open ?? 0) },
              { label: "Reconciliation", value: String((overview?.money.reconciliationOpen ?? 0) + (overview?.money.reconciliationInvestigating ?? 0)) },
              { label: "Failed payments · 24h", value: String(overview?.money.failedPayments24h ?? 0) },
              { label: "Providers down", value: String(overview?.providers.down ?? 0) }
            ]}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Panel className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ft-border)] p-4">
              <div>
                <div className="font-semibold">Action queue</div>
                <div className="mt-1 text-xs text-[var(--ft-text-muted)]">Sorted by operational severity, then recency.</div>
              </div>
              <div className="flex gap-2"><Badge tone="danger">{queue?.totals.danger ?? 0} critical</Badge><Badge tone="warning">{queue?.totals.warning ?? 0} warnings</Badge></div>
            </div>
            {(queue?.items.length ?? 0) === 0 ? (
              <div className="p-8 text-sm text-[var(--ft-text-secondary)]"><AlertTriangle className="mr-2 inline size-4" />No actionable operations items are currently open.</div>
            ) : (
              queue?.items.slice(0, 60).map((item) => {
                const Icon = iconFor[item.type];
                return (
                  <div className="flex flex-col gap-3 border-b border-[var(--ft-border)] p-4 last:border-b-0 md:flex-row md:items-start" key={item.id}>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--ft-bg-muted)]"><Icon className="size-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><Badge tone={item.priority}>{item.priority}</Badge><Badge tone="neutral">{item.type}</Badge><span className="font-medium">{item.title}</span></div>
                      <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">{item.detail}</p>
                      <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{when(item.createdAt)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item.action === "RECONCILE" ? (
                        <Button disabled={busy === item.id} onClick={() => void reconcile(item)} variant="secondary">
                          <RotateCcw className="size-4" />
                          {busy === item.id ? "Opening..." : "Reconcile"}
                        </Button>
                      ) : null}
                      <Link className="text-sm font-medium text-[var(--ft-accent)] hover:underline" href={item.href}>Open desk</Link>
                    </div>
                  </div>
                );
              })
            )}
          </Panel>

          <div className="grid gap-4">
            <Panel className="p-4">
              <div className="font-semibold">Provider incidents</div>
              <div className="mt-1 text-xs text-[var(--ft-text-muted)]">Latest degraded/down provider health states.</div>
              <div className="mt-4 grid gap-3">
                {(overview?.providers.incidents ?? []).map((incident) => (
                  <div className="border-t border-[var(--ft-border)] pt-3 first:border-t-0 first:pt-0" key={`${incident.providerName}:${incident.checkedAt}`}>
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{incident.providerName}</span><Badge tone={incident.status === "DOWN" ? "danger" : "warning"}>{incident.status.toLowerCase()}</Badge></div>
                    <div className="mt-1 text-xs text-[var(--ft-text-secondary)]">{incident.reason ?? "No reason supplied"}{incident.latencyMs !== null ? ` · ${incident.latencyMs}ms` : ""}</div>
                  </div>
                ))}
                {(overview?.providers.incidents.length ?? 0) === 0 ? <div className="text-sm text-[var(--ft-text-secondary)]">No provider incidents.</div> : null}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="font-semibold">Latest privileged activity</div>
              <div className="mt-3 grid gap-3">
                {(overview?.governance.recentPrivilegedActivity ?? []).slice(0, 8).map((entry) => (
                  <div className="border-t border-[var(--ft-border)] pt-3 first:border-t-0 first:pt-0" key={entry.id}>
                    <div className="text-sm font-medium">{entry.action}</div>
                    <div className="mt-1 text-xs text-[var(--ft-text-muted)]">{entry.entityType}:{entry.entityId} · {when(entry.createdAt)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
