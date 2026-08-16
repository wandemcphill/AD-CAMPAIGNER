"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, DollarSign, Globe, History, RefreshCcw, RotateCcw, Trash2 } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";
import { FxSettlementOpsTab, SettlementAlertsTab, SettlementBeneficiariesTab } from "./settlement-ops";

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

interface MarginProviderStat {
  provider: string;
  count: number;
  avgMarginBps: number;
  avgVarianceBps: number;
}

interface MarginOrderRow {
  orderId: string;
  provider: string;
  country: string;
  marginBps: number;
  sellNgn: number;
}

interface MarginStats {
  summary: {
    totalOrders: number;
    avgMarginBps: number;
    expectedMarginBps: number;
    belowTargetCount: number;
  };
  providerStats: MarginProviderStat[];
  orders: MarginOrderRow[];
}

interface ReconciliationRecord {
  id: string;
  provider: string;
  status: "RESOLVED" | "PENDING" | "INVESTIGATION";
  providerBalance: number | null;
  declaredCost: number | null;
  discrepancyBps: number | null;
}

interface ReconciliationData {
  summary: {
    total: number;
    byStatus?: Record<string, number>;
    investigationCount: number;
  };
  records: ReconciliationRecord[];
}

interface PurchaseLimitRow {
  id: string;
  workspace: string;
  period: string;
  spentMinor: number;
  limitMinor: number;
  utilizationBps: number;
}

type SettlementStatus =
  | "PENDING"
  | "READY"
  | "SUBMITTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "REQUIRES_REVIEW";

interface SettlementRow {
  id: string;
  partnerId: string;
  sourceAmountMinor: number;
  sourceCurrency: string;
  destinationAmountMinor: number;
  destinationCurrency: string;
  status: SettlementStatus;
  provider: string;
  providerReference?: string;
  errorReason?: string;
  retryCount: number;
  createdAt: string;
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
  DISABLED: "neutral",
  COMPLETED: "success",
  READY: "neutral",
  SUBMITTED: "neutral",
  PROCESSING: "neutral",
  REQUIRES_REVIEW: "warning"
};

const TABS = [
  { id: "numbers", label: "Numbers" },
  { id: "orders", label: "Orders" },
  { id: "providers", label: "Providers" },
  { id: "margins", label: "Margins" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "limits", label: "Purchase Limits" },
  { id: "fx", label: "FX Rate" },
  { id: "settlements", label: "Settlements" },
  { id: "settlement-alerts", label: "Settlement Alerts" },
  { id: "beneficiaries", label: "Beneficiaries" },
  { id: "fx-settlement-ops", label: "FX/Settlement Ops" }
];

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function AdminDigitalProductsPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [tab, setTab] = useState("numbers");

  const [numbers, setNumbers] = useState<AdminVirtualNumber[]>([]);
  const [orders, setOrders] = useState<AdminVirtualNumberOrder[]>([]);
  const [providers, setProviders] = useState<ProviderHealthRow[]>([]);
  const [fxCurrent, setFxCurrent] = useState<FxRateRow>();
  const [fxHistory, setFxHistory] = useState<FxRateRow[]>([]);
  const [marginStats, setMarginStats] = useState<MarginStats>();
  const [reconciliationData, setReconciliationData] = useState<ReconciliationData>();
  const [purchaseLimits, setPurchaseLimits] = useState<PurchaseLimitRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const [fxInput, setFxInput] = useState("");
  const [fxNote, setFxNote] = useState("");
  // The spread is the margin taken on every conversion — including NGN→USD card
  // funding and top-ups. setRate carries the existing spread forward when this
  // is blank, so leaving it empty never silently resets the margin.
  const [fxSpreadBps, setFxSpreadBps] = useState("");
  const [fxConfirming, setFxConfirming] = useState(false);
  const [fxSubmitting, setFxSubmitting] = useState(false);

  const [limitInput, setLimitInput] = useState("");
  const [limitSubmitting, setLimitSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [numbersRes, ordersRes, healthRes, historyRes, marginRes, reconRes, limitsRes, settlementsRes] =
        await Promise.all([
          apiRequest<{ numbers: AdminVirtualNumber[] }>("/admin/digital-products/numbers"),
          apiRequest<{ orders: AdminVirtualNumberOrder[] }>("/admin/digital-products/orders"),
          apiRequest<ProviderHealthRow[]>("/admin/digital-products/providers/health"),
          apiRequest<FxRateRow[]>("/admin/digital-products/fx/history"),
          apiRequest<MarginStats>("/admin/digital-products/margin-analytics?days=30"),
          apiRequest<ReconciliationData>("/admin/digital-products/reconciliation?days=30"),
          apiRequest<PurchaseLimitRow[]>("/admin/digital-products/purchase-limits"),
          apiRequest<SettlementRow[]>("/admin/settlements?limit=50")
        ]);
      setNumbers(numbersRes.numbers);
      setOrders(ordersRes.orders);
      setProviders(healthRes);
      setFxHistory(historyRes);
      setFxCurrent(historyRes.find((r) => r.effectiveTo === null));
      setMarginStats(marginRes);
      setReconciliationData(reconRes);
      setPurchaseLimits(limitsRes);
      setSettlements(settlementsRes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Digital Products data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh();
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

  async function retrySettlement(id: string) {
    setBusyId(id);
    setError(undefined);
    try {
      await apiRequest(`/admin/settlements/${encodeURIComponent(id)}/retry`, { method: "POST" });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not retry this settlement.");
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
          ...(fxSpreadBps.trim() ? { spreadBps: Number(fxSpreadBps) } : {}),
          ...(fxNote.trim() ? { note: fxNote.trim() } : {}),
          confirmLargeChange
        })
      });
      setFxInput("");
      setFxNote("");
      setFxSpreadBps("");
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

  async function submitPurchaseLimit() {
    const limitMinor = Number(limitInput) * 100; // Convert NGN to minor units
    if (!Number.isFinite(limitMinor) || limitMinor <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }

    setLimitSubmitting(true);
    setError(undefined);
    try {
      await apiRequest("/admin/digital-products/purchase-limits", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: session?.workspace?.id,
          limitMinor
        })
      });
      setLimitInput("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not set purchase limit.");
    } finally {
      setLimitSubmitting(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Digital products auth" />;
  }

  const failedOrders = orders.filter((o) => o.status === "FAILED");
  const failedSettlements = settlements.filter(
    (s) => s.status === "FAILED" || s.status === "REQUIRES_REVIEW"
  );

  return (
    <AdminShell active="/digital-products/">
      <div className="mx-auto max-w-5xl">
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
            items={TABS.map((t) => {
              if (t.id === "orders") return { ...t, count: failedOrders.length };
              if (t.id === "settlements") return { ...t, count: failedSettlements.length };
              return t;
            })}
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

        {tab === "margins" && (
          <div className="mt-4 grid gap-4">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading margin analytics...</Panel>
            ) : marginStats ? (
              <>
                <Panel className="p-5">
                  <h3 className="mb-4 font-semibold">Margin Summary (Last 30 days)</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-[var(--ft-text-muted)]">Total Orders</div>
                      <div className="text-2xl font-bold">{marginStats.summary.totalOrders}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--ft-text-muted)]">Avg Margin</div>
                      <div className="text-2xl font-bold">{(marginStats.summary.avgMarginBps / 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--ft-text-muted)]">Expected</div>
                      <div className="text-2xl font-bold">{(marginStats.summary.expectedMarginBps / 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--ft-text-muted)]">Below Target</div>
                      <div className="text-2xl font-bold text-[var(--ft-red)]">{marginStats.summary.belowTargetCount}</div>
                    </div>
                  </div>
                </Panel>

                <Panel className="p-5">
                  <h3 className="mb-3 font-semibold">By Provider</h3>
                  <div className="space-y-2">
                    {marginStats.providerStats.map((p) => (
                      <div className="flex items-center justify-between rounded border border-[var(--ft-border)] p-3" key={p.provider}>
                        <div>
                          <div className="text-sm font-semibold">{p.provider}</div>
                          <div className="text-xs text-[var(--ft-text-muted)]">{p.count} orders</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{(p.avgMarginBps / 100).toFixed(1)}%</div>
                          <div className={`text-xs ${p.avgVarianceBps < 0 ? "text-[var(--ft-red)]" : "text-[var(--ft-green)]"}`}>
                            {p.avgVarianceBps < 0 ? "-" : "+"}{Math.abs(p.avgVarianceBps / 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="p-5">
                  <h3 className="mb-3 font-semibold">Recent Orders</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {marginStats.orders.slice(0, 20).map((order) => (
                      <div className="text-xs border-b border-[var(--ft-border)] pb-2" key={order.orderId}>
                        <div className="flex justify-between">
                          <span className="font-mono text-[var(--ft-text-muted)]">{order.orderId.slice(0, 8)}</span>
                          <span className="font-semibold">{(order.marginBps / 100).toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 flex justify-between text-[var(--ft-text-muted)]">
                          <span>{order.provider} · {order.country}</span>
                          <span>{order.sellNgn > 0 ? formatNaira(order.sellNgn) : "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </>
            ) : (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No margin data available.</Panel>
            )}
          </div>
        )}

        {tab === "reconciliation" && (
          <div className="mt-4 grid gap-4">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading reconciliation data...</Panel>
            ) : reconciliationData ? (
              <>
                <Panel className="p-5">
                  <h3 className="mb-4 font-semibold">Reconciliation Summary (Last 30 days)</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-[var(--ft-text-muted)]">Total Records</div>
                      <div className="text-2xl font-bold">{reconciliationData.summary.total}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--ft-text-muted)]">Resolved</div>
                      <div className="text-2xl font-bold text-[var(--ft-green)]">
                        {reconciliationData.summary.byStatus?.RESOLVED || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--ft-text-muted)]">Pending</div>
                      <div className="text-2xl font-bold text-[var(--ft-yellow)]">
                        {reconciliationData.summary.byStatus?.PENDING || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--ft-text-muted)]">Investigation</div>
                      <div className="text-2xl font-bold text-[var(--ft-red)]">
                        {reconciliationData.summary.investigationCount}
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel className="p-5">
                  <h3 className="mb-3 font-semibold">Recent Records</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {reconciliationData.records.map((r) => (
                      <div className="text-xs border-b border-[var(--ft-border)] pb-3" key={r.id}>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{r.provider}</div>
                          <Badge tone={r.status === "INVESTIGATION" ? "danger" : r.status === "PENDING" ? "warning" : "success"}>
                            {r.status.toLowerCase()}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-[var(--ft-text-muted)]">
                          <div>Balance: {r.providerBalance ? (r.providerBalance / 100).toFixed(2) + " USD" : "—"}</div>
                          <div>Declared: {r.declaredCost ? formatNaira(r.declaredCost) : "—"}</div>
                          <div className={r.discrepancyBps ? (Math.abs(r.discrepancyBps) > 500 ? "text-[var(--ft-red)]" : "") : ""}>
                            Variance: {r.discrepancyBps ? (r.discrepancyBps / 100).toFixed(1) + "%" : "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </>
            ) : (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No reconciliation data available.</Panel>
            )}
          </div>
        )}

        {tab === "limits" && (
          <div className="mt-4 grid gap-4">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading purchase limits...</Panel>
            ) : (
              <>
                <Panel className="p-5">
                  <h3 className="mb-4 font-semibold">Set Purchase Limit</h3>
                  <div className="flex gap-2">
                    <input
                      className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                      onChange={(e) => setLimitInput(e.target.value)}
                      placeholder="Amount in NGN (e.g. 500000 for ₦500,000)"
                      type="number"
                      value={limitInput}
                    />
                    <Button disabled={limitSubmitting || !limitInput} onClick={() => void submitPurchaseLimit()}>
                      Set Limit
                    </Button>
                  </div>
                </Panel>

                {purchaseLimits && purchaseLimits.length > 0 ? (
                  <Panel className="p-5">
                    <h3 className="mb-3 font-semibold">Active Limits</h3>
                    <div className="space-y-2">
                      {purchaseLimits.map((limit) => (
                        <div className="flex items-center justify-between rounded border border-[var(--ft-border)] p-3" key={limit.id}>
                          <div>
                            <div className="text-sm font-semibold">{limit.workspace}</div>
                            <div className="text-xs text-[var(--ft-text-muted)]">{limit.period}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{formatNaira(limit.spentMinor)} / {formatNaira(limit.limitMinor)}</div>
                            <div className="mt-1 h-1.5 w-32 rounded-full bg-[var(--ft-bg-surface)]">
                              <div
                                className={`h-full rounded-full ${
                                  limit.utilizationBps > 8000
                                    ? "bg-[var(--ft-red)]"
                                    : limit.utilizationBps > 5000
                                      ? "bg-[var(--ft-yellow)]"
                                      : "bg-[var(--ft-green)]"
                                }`}
                                style={{ width: `${Math.min(100, (limit.utilizationBps / 10000) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                ) : (
                  <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No purchase limits configured.</Panel>
                )}
              </>
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
                  New rate (₦ per USD) · spread in bps is the conversion margin
                  applied to USD card funding and top-ups; leave blank to keep the current one
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
                    className="h-10 w-36 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                    onChange={(e) => setFxSpreadBps(e.target.value)}
                    placeholder="Spread bps"
                    type="number"
                    value={fxSpreadBps}
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

            <FxHealthPanel />
          </div>
        )}

        {tab === "settlements" && (
          <div className="mt-4 grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading settlements...</Panel>
            ) : settlements.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No settlements yet.</Panel>
            ) : (
              settlements.map((s) => (
                <Panel className="flex items-center gap-4 p-4" key={s.id}>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {(s.sourceAmountMinor / 100).toLocaleString()} {s.sourceCurrency} → {" "}
                      {(s.destinationAmountMinor / 100).toLocaleString()} {s.destinationCurrency} · {s.provider}
                    </div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {s.partnerId} · {new Date(s.createdAt).toLocaleString()}
                      {s.retryCount > 0 && ` · ${s.retryCount} retries`}
                    </div>
                    {s.errorReason && (
                      <div className="text-xs text-[var(--ft-red)]">{s.errorReason}</div>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status.toLowerCase()}</Badge>
                  {(s.status === "FAILED" || s.status === "REQUIRES_REVIEW") && (
                    <Button
                      disabled={busyId !== undefined}
                      onClick={() => void retrySettlement(s.id)}
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

        {tab === "settlement-alerts" && session ? (
          <SettlementAlertsTab currentUserId={session.user.id} />
        ) : null}

        {tab === "beneficiaries" && session ? (
          <SettlementBeneficiariesTab currentUserId={session.user.id} />
        ) : null}

        {tab === "fx-settlement-ops" ? <FxSettlementOpsTab /> : null}
      </div>
    </AdminShell>
  );
}

type FxHealth = {
  provider: string;
  healthy: boolean;
  message?: string;
  cacheStatus: {
    pairs: { baseCurrency: string; quoteCurrency: string; isFresh: boolean }[];
    lastRefreshAt: string;
  };
  fallbackStatus: { usingFallback: boolean; reason?: string; manualRateAge: number };
};

function FxHealthPanel() {
  const [health, setHealth] = useState<FxHealth>();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  async function checkHealth() {
    setLoading(true);
    setError(undefined);
    try {
      setHealth(await apiRequest<FxHealth>("/admin/digital-products/fx/health"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check FX provider health.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshCache() {
    setRefreshing(true);
    setError(undefined);
    try {
      await apiRequest("/admin/digital-products/fx/refresh", { method: "POST", body: JSON.stringify({}) });
      await checkHealth();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not refresh the FX rate cache.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Provider health</h2>
        </div>
        <div className="flex gap-2">
          <Button disabled={loading} onClick={() => void checkHealth()} variant="secondary">
            <RefreshCcw className="size-4" />
            Check
          </Button>
          <Button disabled={refreshing} onClick={() => void refreshCache()}>
            {refreshing ? "Refreshing..." : "Refresh cache"}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-[var(--ft-red)]">{error}</p> : null}
      {health ? (
        <div className="mt-3 grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[var(--ft-text-muted)]">Provider:</span>
            <span className="font-medium">{health.provider}</span>
            <Badge tone={health.healthy ? "success" : "danger"}>{health.healthy ? "healthy" : "unhealthy"}</Badge>
          </div>
          {health.fallbackStatus.usingFallback ? (
            <div className="text-xs text-[var(--ft-yellow)]">
              Using fallback rate ({health.fallbackStatus.manualRateAge}m old)
              {health.fallbackStatus.reason ? ` — ${health.fallbackStatus.reason}` : ""}
            </div>
          ) : null}
          {health.message ? <div className="text-xs text-[var(--ft-text-muted)]">{health.message}</div> : null}
          <div className="text-xs text-[var(--ft-text-muted)]">
            Cache last refreshed {new Date(health.cacheStatus.lastRefreshAt).toLocaleString()}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--ft-text-muted)]">Click "Check" to query the live FX provider.</p>
      )}
    </Panel>
  );
}
