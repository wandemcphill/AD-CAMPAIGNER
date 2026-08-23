"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Search, X } from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type PaymentStatus = "PENDING" | "REQUIRES_ACTION" | "COMPLETED" | "FAILED" | "CANCELLED";

type PaymentRow = {
  id: string;
  workspaceId: string;
  gateway: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  providerReference: string | null;
  customerEmail: string | null;
  customerName: string | null;
  campaignId: string | null;
  completedAt: string | null;
  creditedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workspace: { id: string; name: string };
  campaign: { id: string; name: string } | null;
};

type PaymentDetail = PaymentRow & {
  checkoutUrl: string | null;
  campaignInvoiceId: string | null;
  idempotencyKey: string | null;
  providerPayload: unknown;
  metadata: unknown;
};

type PaymentResult = {
  payments: PaymentRow[];
  counts: Record<string, { count: number; amountMinor: number }>;
  limit: number;
};

const STATUS_TONE: Record<PaymentStatus, "success" | "warning" | "danger" | "neutral"> = {
  COMPLETED: "success",
  PENDING: "warning",
  REQUIRES_ACTION: "warning",
  FAILED: "danger",
  CANCELLED: "neutral"
};

const STATUSES: Array<{ label: string; value: PaymentStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Needs action", value: "REQUIRES_ACTION" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
  { label: "Cancelled", value: "CANCELLED" }
];

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

function when(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminPaymentsPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [result, setResult] = useState<PaymentResult>();
  const [selected, setSelected] = useState<PaymentDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      params.set("limit", "100");
      setResult(await apiRequest<PaymentResult>(`/admin/finance/payments?${params.toString()}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load payment operations.");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    if (!sessionLoading && session?.isPlatformAdmin) void load();
  }, [sessionLoading, session, load]);

  async function openPayment(id: string) {
    setError(undefined);
    try {
      setSelected(await apiRequest<PaymentDetail>(`/admin/finance/payments/${encodeURIComponent(id)}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load payment details.");
    }
  }

  const summary = useMemo(() => {
    const counts = result?.counts ?? {};
    const completed = counts.COMPLETED?.amountMinor ?? 0;
    const backlog = (counts.PENDING?.count ?? 0) + (counts.REQUIRES_ACTION?.count ?? 0);
    const failed = counts.FAILED?.count ?? 0;
    return [
      { label: "completed volume", value: money(completed, "NGN") },
      { label: "needs action", value: String(backlog) },
      { label: "failed", value: String(failed) },
      { label: "visible records", value: String(result?.payments.length ?? 0) }
    ];
  }, [result]);

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Payments auth" />;
  }

  return (
    <AdminShell active="/payments/" subtitle="Financial operations">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-3 border-b border-[var(--ft-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Banknote className="size-5 text-[var(--ft-accent)]" />
              <h1 className="text-xl font-bold">Payments</h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ft-text-secondary)]">
              Search payment intents, inspect provider references, and trace payment state without changing money from this desk.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void load()} variant="secondary">
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </header>

        <Panel className="mt-5 p-4">
          <SummaryStatStrip items={summary} />
        </Panel>

        <Panel className="mt-5 flex flex-col gap-3 p-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ft-text-muted)]" />
            <input
              className="w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] py-2 pl-9 pr-3 text-sm"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void load();
              }}
              placeholder="Payment ID, provider reference, customer email or name"
              value={query}
            />
          </div>
          <select
            className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 py-2 text-sm"
            onChange={(event) => setStatus(event.target.value as PaymentStatus | "")}
            value={status}
          >
            {STATUSES.map((item) => (
              <option key={item.value || "ALL"} value={item.value}>{item.label}</option>
            ))}
          </select>
          <Button disabled={loading} onClick={() => void load()}>
            Search
          </Button>
        </Panel>

        {error ? <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/40 bg-[var(--ft-red)]/10 p-3 text-sm text-[var(--ft-red)]">{error}</div> : null}

        <Panel className="mt-4 overflow-hidden p-0">
          {(result?.payments ?? []).length === 0 ? (
            <div className="p-6 text-sm text-[var(--ft-text-secondary)]">
              {loading ? "Loading payment operations..." : "No payment records matched this view."}
            </div>
          ) : (
            <div className="divide-y divide-[var(--ft-border)]">
              {result?.payments.map((payment) => (
                <button
                  className="grid w-full gap-3 p-4 text-left transition hover:bg-[var(--ft-bg-muted)] xl:grid-cols-[1.2fr_1fr_150px_150px_120px] xl:items-center"
                  key={payment.id}
                  onClick={() => void openPayment(payment.id)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--ft-text-primary)]">
                      {payment.customerName || payment.customerEmail || "Unnamed customer"}
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-[var(--ft-text-muted)]">
                      {payment.id}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[var(--ft-text-primary)]">{payment.workspace.name}</div>
                    <div className="truncate text-xs text-[var(--ft-text-muted)]">{payment.providerReference || "no provider reference"}</div>
                  </div>
                  <div className="font-mono text-sm">{money(payment.amountMinor, payment.currency)}</div>
                  <Badge tone={STATUS_TONE[payment.status]}>{payment.status.replaceAll("_", " ").toLowerCase()}</Badge>
                  <div className="text-xs text-[var(--ft-text-muted)]">{when(payment.createdAt)}</div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {selected ? (
          <div className="fixed inset-0 z-[80] bg-black/60 p-4 sm:p-8" onClick={() => setSelected(undefined)}>
            <Panel className="mx-auto max-h-[calc(100vh-2rem)] max-w-2xl overflow-auto p-5 sm:max-h-[calc(100vh-4rem)]" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Payment detail</h2>
                    <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{selected.id}</div>
                </div>
                <Button onClick={() => setSelected(undefined)} variant="secondary"><X className="size-4" /></Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div><div className="text-xs text-[var(--ft-text-muted)]">Amount</div><div className="mt-1 font-mono font-semibold">{money(selected.amountMinor, selected.currency)}</div></div>
                <div><div className="text-xs text-[var(--ft-text-muted)]">Gateway</div><div className="mt-1">{selected.gateway}</div></div>
                <div><div className="text-xs text-[var(--ft-text-muted)]">Customer</div><div className="mt-1">{selected.customerName || "—"}<div className="text-xs text-[var(--ft-text-muted)]">{selected.customerEmail || "—"}</div></div></div>
                <div><div className="text-xs text-[var(--ft-text-muted)]">Workspace</div><div className="mt-1">{selected.workspace.name}</div><div className="font-mono text-[11px] text-[var(--ft-text-muted)]">{selected.workspaceId}</div></div>
                <div><div className="text-xs text-[var(--ft-text-muted)]">Provider reference</div><div className="mt-1 break-all font-mono text-xs">{selected.providerReference || "—"}</div></div>
                <div><div className="text-xs text-[var(--ft-text-muted)]">Idempotency</div><div className="mt-1 break-all font-mono text-xs">{selected.idempotencyKey || "—"}</div></div>
                <div><div className="text-xs text-[var(--ft-text-muted)]">Completed</div><div className="mt-1">{when(selected.completedAt)}</div></div>
                <div><div className="text-xs text-[var(--ft-text-muted)]">Wallet credited</div><div className="mt-1">{when(selected.creditedAt)}</div></div>
              </div>

              <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">Provider payload</div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-[var(--ft-text-secondary)]">{JSON.stringify(selected.providerPayload, null, 2)}</pre>
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
