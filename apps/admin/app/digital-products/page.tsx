"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, DollarSign, Globe, History, RefreshCcw, RotateCcw, Trash2 } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";

type VirtualNumberStatus =
  | "RESERVED"
  | "PROVISIONING"
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "RELEASED"
  | "FAILED"
  | "SUSPENDED";

type VirtualNumberOrderStatus =
  | "QUOTED"
  | "CHARGED"
  | "PROVISIONING"
  | "FULFILLED"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

interface AdminVirtualNumber {
  id: string;
  e164: string;
  countryCode: string;
  providerName: string;
  status: VirtualNumberStatus;
  expiresAt: string | null;
  messageCount: number;
  createdAt: string;
}

interface AdminVirtualNumberOrder {
  id: string;
  productId: string;
  providerName: string | null;
  status: VirtualNumberOrderStatus;
  amountMinor: number;
  failureReason: string | null;
  createdAt: string;
}

interface ProviderHealthRow {
  providerName: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED";
  latencyMs?: number;
  checkedAt?: string;
}

interface FxRateRow {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateMicros: string;
  bufferBps: number;
  source: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
}

function microsToRate(rateMicros: string) {
  return Number(rateMicros) / 1_000_000;
}

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  ACTIVE: "success",
  FULFILLED: "success",
  EXPIRING: "warning",
  EXPIRED: "danger",
  FAILED: "danger",
  SUSPENDED: "danger",
  RELEASED: "neutral",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  RESERVED: "neutral",
  PROVISIONING: "neutral",
  QUOTED: "neutral",
  CHARGED: "neutral",
  HEALTHY: "success",
  DEGRADED: "warning",
  DOWN: "danger",
  DISABLED: "neutral"
};

const TABS = [
  { id: "numbers", label: "Numbers" },
  { id: "orders", label: "Orders" },
  { id: "providers", label: "Providers" },
  { id: "fx", label: "FX Rate" }
];

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function AdminDigitalProductsPage() {
  const { loading: sessionLoading, session } = useApiSession();
  const [tab, setTab] = useState("numbers");

  const [numbers, setNumbers] = useState<AdminVirtualNumber[]>([]);
  const [orders, setOrders] = useState<AdminVirtualNumberOrder[]>([]);
  const [providers, setProviders] = useState<ProviderHealthRow[]>([]);
  const [fxCurrent, setFxCurrent] = useState<FxRateRow>();
  const [fxHistory, setFxHistory] = useState<FxRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const [fxInput, setFxInput] = useState("");
  const [fxNote, setFxNote] = useState("");
  const [fxConfirming, setFxConfirming] = useState(false);
  const [fxSubmitting, setFxSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [numbersRes, ordersRes, healthRes, historyRes] = await Promise.all([
        apiRequest<{ numbers: AdminVirtualNumber[] }>("/admin/digital-products/numbers"),
        apiRequest<{ orders: AdminVirtualNumberOrder[] }>("/admin/digital-products/orders"),
        apiRequest<ProviderHealthRow[]>("/admin/digital-products/providers/health"),
        apiRequest<FxRateRow[]>("/admin/digital-products/fx/history")
      ]);
      setNumbers(numbersRes.numbers);
      setOrders(ordersRes.orders);
      setProviders(healthRes);
      setFxHistory(historyRes);
      setFxCurrent(historyRes.find((r) => r.effectiveTo === null));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Digital Products data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session) {
      window.location.replace("/login");
      return;
    }
    if (session) void refresh();
  }, [sessionLoading, session, refresh]);

  async function forceRelease(id: string) {
    setBusyId(id);
    setError(undefined);
    try {
      await apiRequest(`/admin/digital-products/numbers/${encodeURIComponent(id)}/release`, {
        method: "POST"
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not release this number.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function retryOrder(id: string) {
    setBusyId(id);
    setError(undefined);
    try {
      await apiRequest(`/admin/digital-products/orders/${encodeURIComponent(id)}/retry`, {
        method: "POST"
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not retry this order.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function submitFxRate(confirmLargeChange = false) {
    const rate = Number(fxInput);
    if (!Number.isFinite(rate) || rate <= 0) {
      setError("Enter a valid positive rate.");
      return;
    }

    setFxSubmitting(true);
    setError(undefined);
    try {
      await apiRequest("/admin/digital-products/fx", {
        method: "POST",
        body: JSON.stringify({
          rate,
          ...(fxNote.trim() ? { note: fxNote.trim() } : {}),
          confirmLargeChange
        })
      });
      setFxInput("");
      setFxNote("");
      setFxConfirming(false);
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not update the FX rate.";
      if (message.toLowerCase().includes("confirmlargechange")) {
        setFxConfirming(true);
      }
      setError(message);
    } finally {
      setFxSubmitting(false);
    }
  }

  if (sessionLoading || !session) {
    return <main className="min-h-screen bg-[var(--ft-bg-base)]" />;
  }

  const failedOrders = orders.filter((o) => o.status === "FAILED");

  return (
    <main className="ft-shell min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Digital Products — Virtual Numbers</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        <div className="mt-4">
          <TabBar
            items={TABS.map((t) =>
              t.id === "orders" ? { ...t, count: failedOrders.length } : t
            )}
            onChange={setTab}
            value={tab}
          />
        </div>

        {tab === "numbers" && (
          <div className="mt-4 grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading numbers...</Panel>
            ) : numbers.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No numbers yet.</Panel>
            ) : (
              numbers.map((n) => (
                <Panel className="flex items-center gap-4 p-4" key={n.id}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{n.e164}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {n.countryCode} · {n.providerName} · {n.messageCount} messages
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[n.status] ?? "neutral"}>{n.status.toLowerCase()}</Badge>
                  {n.status !== "RELEASED" && (
                    <Button
                      disabled={busyId !== undefined}
                      onClick={() => void forceRelease(n.id)}
                      variant="secondary"
                    >
                      <Trash2 className="size-4" />
                      Force release
                    </Button>
                  )}
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="mt-4 grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading orders...</Panel>
            ) : orders.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No orders yet.</Panel>
            ) : (
              orders.map((o) => (
                <Panel className="flex items-center gap-4 p-4" key={o.id}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {formatNaira(o.amountMinor)} · {o.providerName ?? "unassigned"}
                    </div>
                    {o.failureReason && (
                      <div className="text-xs text-[var(--ft-red)]">{o.failureReason}</div>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[o.status] ?? "neutral"}>{o.status.toLowerCase()}</Badge>
                  {o.status === "FAILED" && (
                    <Button
                      disabled={busyId !== undefined}
                      onClick={() => void retryOrder(o.id)}
                    >
                      <RotateCcw className="size-4" />
                      Retry
                    </Button>
                  )}
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "providers" && (
          <div className="mt-4 grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading providers...</Panel>
            ) : (
              providers.map((p) => (
                <Panel className="flex items-center gap-4 p-4" key={p.providerName}>
                  <Activity className="size-4 text-[var(--ft-accent)]" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{p.providerName}</div>
                    {p.latencyMs !== undefined && (
                      <div className="text-xs text-[var(--ft-text-muted)]">{p.latencyMs}ms latency</div>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status.toLowerCase()}</Badge>
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "fx" && (
          <div className="mt-4 grid gap-4">
            <Panel className="p-5">
              <div className="flex items-center gap-2">
                <DollarSign className="size-4 text-[var(--ft-accent)]" />
                <h2 className="font-semibold">Active rate</h2>
              </div>
              {fxCurrent ? (
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    ₦{microsToRate(fxCurrent.rateMicros).toFixed(2)}
                  </span>
                  <span className="text-sm text-[var(--ft-text-muted)]">per USD</span>
                  {fxCurrent.bufferBps > 0 && (
                    <Badge tone="info">+{(fxCurrent.bufferBps / 100).toFixed(1)}% buffer</Badge>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--ft-text-muted)]">
                  No rate has been set yet — orders are using the ₦1,450 bootstrap fallback.
                </p>
              )}
              {fxCurrent?.note && (
                <p className="mt-2 text-xs text-[var(--ft-text-muted)]">{fxCurrent.note}</p>
              )}

              <div className="mt-5 border-t border-[var(--ft-border)] pt-4">
                <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                  New rate (₦ per USD)
                </label>
                <div className="flex gap-2">
                  <input
                    className="h-10 w-40 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                    onChange={(e) => setFxInput(e.target.value)}
                    placeholder="1450.00"
                    type="number"
                    value={fxInput}
                  />
                  <input
                    className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                    onChange={(e) => setFxNote(e.target.value)}
                    placeholder="Note (optional) — e.g. parallel + 3%, 30 Jul"
                    value={fxNote}
                  />
                  <Button disabled={fxSubmitting || !fxInput} onClick={() => void submitFxRate(false)}>
                    Set rate
                  </Button>
                </div>

                {fxConfirming && (
                  <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3">
                    <p className="flex-1 text-xs text-[var(--ft-text-secondary)]">
                      This is a &gt;10% change from the active rate — confirm to proceed anyway.
                    </p>
                    <Button disabled={fxSubmitting} onClick={() => setFxConfirming(false)} variant="secondary">
                      Cancel
                    </Button>
                    <Button disabled={fxSubmitting} onClick={() => void submitFxRate(true)}>
                      Confirm change
                    </Button>
                  </div>
                )}
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="flex items-center gap-2">
                <History className="size-4 text-[var(--ft-accent)]" />
                <h2 className="font-semibold">History</h2>
              </div>
              {fxHistory.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--ft-text-muted)]">No rate changes yet.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {fxHistory.map((r) => (
                    <div
                      className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--ft-border)] p-3 text-sm"
                      key={r.id}
                    >
                      <div>
                        <span className="font-semibold">₦{microsToRate(r.rateMicros).toFixed(2)}</span>
                        {r.note && <span className="ml-2 text-xs text-[var(--ft-text-muted)]">{r.note}</span>}
                      </div>
                      <div className="text-xs text-[var(--ft-text-muted)]">
                        {new Date(r.effectiveFrom).toLocaleString()}
                        {r.effectiveTo === null && (
                          <span className="ml-2 inline-block">
                            <Badge tone="success">active</Badge>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </main>
  );
}
