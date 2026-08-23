"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, CircleDollarSign, RefreshCw, RotateCcw } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type FulfilmentDomain =
  | "GROWTH"
  | "VTU"
  | "TELECOM"
  | "VIRTUAL_NUMBER"
  | "DIGITAL_ACCESS"
  | "GIFT_CARD"
  | "AIRTIME_CASHOUT"
  | "REMITTANCE"
  | "RMB"
  | "GUEST_CHECKOUT"
  | "WALLET_WITHDRAWAL";

type QueueItem = {
  id: string;
  domain: FulfilmentDomain;
  status: string;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  amountMinor: number | null;
  currency: string | null;
  providerName: string | null;
  providerReference: string | null;
  failureReason: string | null;
  title: string;
  customerLabel: string | null;
  canOpenReconciliation: boolean;
  metadata: Record<string, unknown>;
};

type Overview = {
  generatedAt: string;
  windowDays: number;
  totals: { orders: number; open: number; exceptions: number };
  summary: Array<{ domain: FulfilmentDomain; total: number; open: number; exceptions: number; completed: number }>;
  queue: QueueItem[];
};

const DOMAIN_LABEL: Record<FulfilmentDomain, string> = {
  GROWTH: "Growth",
  VTU: "VTU / Bills",
  TELECOM: "Telecom",
  VIRTUAL_NUMBER: "Virtual Numbers",
  DIGITAL_ACCESS: "Digital Access",
  GIFT_CARD: "Gift Cards",
  AIRTIME_CASHOUT: "Airtime Cashout",
  REMITTANCE: "Remittance",
  RMB: "RMB",
  GUEST_CHECKOUT: "Guest Checkout",
  WALLET_WITHDRAWAL: "Wallet Withdrawals"
};

const EXCEPTION_KINDS = [
  "AMBIGUOUS_PROVIDER_RESULT",
  "STATUS_MISMATCH",
  "MISSING_AT_PROVIDER",
  "MISSING_INTERNALLY",
  "AMOUNT_MISMATCH",
  "UNKNOWN"
];

function tone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (["COMPLETED", "DELIVERED", "PAID", "CONFIRMED", "OTP_VERIFIED"].includes(status)) return "success";
  if (["FAILED", "UNKNOWN", "AMBIGUOUS", "RECONCILIATION_REQUIRED", "DISPUTED"].includes(status)) return "danger";
  if (["PENDING", "QUOTED", "CHARGED", "SUBMITTED", "PROCESSING", "PROVISIONING", "IN_PROGRESS"].includes(status)) return "warning";
  return "neutral";
}

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);
}

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function FulfilmentAdminPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [overview, setOverview] = useState<Overview>();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [domain, setDomain] = useState<FulfilmentDomain | "ALL">("ALL");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextOverview, nextQueue] = await Promise.all([
        apiRequest<Overview>("/admin/command-center/fulfilment?days=7"),
        apiRequest<QueueItem[]>(
          `/admin/command-center/fulfilment/queue?limit=300${domain === "ALL" ? "" : `&domain=${encodeURIComponent(domain)}`}${status === "ALL" ? "" : `&status=${encodeURIComponent(status)}`}`
        )
      ]);
      setOverview(nextOverview);
      setQueue(nextQueue);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load fulfilment operations.");
    } finally {
      setLoading(false);
    }
  }, [domain, status]);

  useEffect(() => {
    if (session?.isPlatformAdmin) void refresh();
  }, [session, refresh]);

  const exceptionQueue = useMemo(() => queue.filter((item) => item.canOpenReconciliation), [queue]);

  async function openReconciliation(item: QueueItem) {
    const reason = window.prompt(`Why does ${item.domain} ${item.id} need reconciliation?`, item.failureReason ?? "Provider result needs investigation.");
    if (reason === null || !reason.trim()) return;

    const providerDomain = item.domain === "VTU" || item.domain === "TELECOM" ? "VTU" : item.domain;
    const kind = window.prompt("Choose reconciliation kind", EXCEPTION_KINDS[0]) ?? EXCEPTION_KINDS[0];
    if (!EXCEPTION_KINDS.includes(kind)) return;

    setBusy(item.id);
    setError(undefined);
    try {
      await apiRequest(`/admin/command-center/fulfilment/${item.domain}/${encodeURIComponent(item.id)}/reconciliation`, {
        method: "POST",
        body: JSON.stringify({
          resourceType: item.domain === "GUEST_CHECKOUT" ? "GuestTransaction" : item.domain === "VIRTUAL_NUMBER" ? "VirtualNumberOrder" : `${item.domain}Order`,
          kind,
          providerName: item.providerName ?? "unknown",
          providerDomain,
          workspaceId: item.workspaceId,
          reason: reason.trim()
        })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open reconciliation.");
    } finally {
      setBusy(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Fulfilment auth" />;
  }

  return (
    <AdminShell active="/fulfilment/" subtitle="Fulfilment operations">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">Unified operations</Badge>
              <Badge tone={exceptionQueue.length > 0 ? "danger" : "success"}>
                {exceptionQueue.length} exceptions in view
              </Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold">Fulfilment Operations</h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--ft-text-muted)]">
              One queue across Growth, telecom, VTU, Virtual Numbers, Digital Access, digital value, remittance and guest fulfilment. Failures and ambiguous provider results can be promoted into the financial reconciliation workflow without mutating the original order.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        {error ? <div className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">{error}</div> : null}

        <SummaryStatStrip
          className="mt-6"
          items={[
            { label: "Resources", value: loading ? "..." : overview?.totals.orders ?? 0 },
            { label: "Open", value: loading ? "..." : overview?.totals.open ?? 0 },
            { label: "Exceptions", value: loading ? "..." : overview?.totals.exceptions ?? 0 },
            { label: "Domains", value: loading ? "..." : overview?.summary.length ?? 0 }
          ]}
        />

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(overview?.summary ?? []).map((row) => (
            <Panel className="p-4" key={row.domain}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-semibold"><Boxes className="size-4 text-[var(--ft-accent)]" />{DOMAIN_LABEL[row.domain]}</div>
                <Badge tone={row.exceptions ? "danger" : row.open ? "warning" : "success"}>{row.open} open</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded border border-[var(--ft-border)] p-2"><div className="text-lg font-semibold">{row.total}</div><div className="text-[var(--ft-text-muted)]">7d</div></div>
                <div className="rounded border border-[var(--ft-border)] p-2"><div className="text-lg font-semibold">{row.completed}</div><div className="text-[var(--ft-text-muted)]">closed</div></div>
                <div className="rounded border border-[var(--ft-border)] p-2"><div className="text-lg font-semibold">{row.exceptions}</div><div className="text-[var(--ft-text-muted)]">exceptions</div></div>
              </div>
            </Panel>
          ))}
        </section>

        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Operations queue</h2>
              <p className="text-sm text-[var(--ft-text-muted)]">Read-through view of the underlying fulfilment records.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm" onChange={(event) => setDomain(event.target.value as FulfilmentDomain | "ALL")} value={domain}>
                <option value="ALL">All domains</option>
                {Object.entries(DOMAIN_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm" onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="ALL">All statuses</option>
                <option value="FAILED">Failed</option>
                <option value="AMBIGUOUS">Ambiguous</option>
                <option value="RECONCILIATION_REQUIRED">Reconciliation required</option>
                <option value="PROCESSING">Processing</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>

          <Panel className="mt-4 overflow-hidden p-0">
            {loading ? (
              <div className="p-8 text-sm text-[var(--ft-text-muted)]">Loading fulfilment queue...</div>
            ) : queue.length === 0 ? (
              <div className="p-8 text-center"><CheckCircle2 className="mx-auto size-6 text-[var(--ft-green)]" /><div className="mt-2 font-semibold">No resources match this queue</div><div className="mt-1 text-sm text-[var(--ft-text-muted)]">The underlying order tables returned no matching operational records.</div></div>
            ) : (
              <div className="divide-y divide-[var(--ft-border)]">
                {queue.map((item) => (
                  <div className="grid gap-4 p-4 lg:grid-cols-[110px_1fr_140px_130px_150px_auto] lg:items-center" key={`${item.domain}-${item.id}`}>
                    <Badge tone="info">{DOMAIN_LABEL[item.domain]}</Badge>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{item.title}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{item.id}</div>
                      {item.failureReason ? <div className="mt-1 flex items-start gap-1 text-xs text-[var(--ft-red)]"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{item.failureReason}</div> : null}
                    </div>
                    <div><Badge tone={tone(item.status)}>{item.status}</Badge><div className="mt-1 text-xs text-[var(--ft-text-muted)]">{when(item.updatedAt)}</div></div>
                    <div className="flex items-center gap-2"><CircleDollarSign className="size-4 text-[var(--ft-text-muted)]" />{money(item.amountMinor, item.currency)}</div>
                    <div className="text-sm"><div>{item.providerName ?? "No provider"}</div><div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{item.providerReference ?? "No reference"}</div></div>
                    <div className="flex justify-end gap-2">
                      {item.canOpenReconciliation ? <Button disabled={busy === item.id} onClick={() => void openReconciliation(item)} variant="secondary"><RotateCcw className="size-4" />Reconcile</Button> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>
      </div>
    </AdminShell>
  );
}
