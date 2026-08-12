"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Pause,
  RefreshCcw,
  Settings,
  XCircle
} from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";

import { AdminShell } from "../../admin-shell";

import { apiRequest } from "../../lib/api-client";
import { useApiSession } from "../../lib/use-session";
import { AdminAuthState } from "../../ui/admin-auth-state";

const VTU_PROVIDER_STATUSES = [
  "DISCOVERED",
  "CONFIGURED",
  "SANDBOX",
  "VERIFIED",
  "PRODUCTION_READY",
  "ACTIVE",
  "PAUSED",
  "DEGRADED",
  "DISABLED",
  "BLOCKED_PENDING_CREDENTIALS"
] as const;

type VtuProviderStatus = (typeof VTU_PROVIDER_STATUSES)[number];

type ProviderHealth = {
  status: string;
  latencyMs: number;
  successRateBps: number;
  checkedAt: string;
} | null;

type ProviderBalance = {
  balanceMinor: number;
  status: string;
  checkedAt: string;
} | null;

type ProviderConfig = {
  id: string;
  providerName: string;
  displayName: string;
  status: VtuProviderStatus;
  enabledServices: string[];
  priority: number;
  costWeight: number;
  successRateWeight: number;
  latencyWeight: number;
  balanceWeight: number;
  minBalanceMinor: number;
  maxTransactionMinor: number;
  trafficAllocationPct: number;
  maintenanceMode: boolean;
  health: ProviderHealth;
  balance: ProviderBalance;
};

type RoutingMatrixRow = {
  productType: string;
  network: string | null;
  winner: string | null;
  allCandidates: Array<{ providerName: string; score: number; costMinor: number }>;
};

const STATUS_TONE: Record<
  VtuProviderStatus,
  { tone: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  ACTIVE: { tone: "success" },
  PRODUCTION_READY: { tone: "info" },
  VERIFIED: { tone: "info" },
  SANDBOX: { tone: "warning" },
  CONFIGURED: { tone: "neutral" },
  DISCOVERED: { tone: "neutral" },
  PAUSED: { tone: "warning" },
  DEGRADED: { tone: "warning" },
  DISABLED: { tone: "danger" },
  BLOCKED_PENDING_CREDENTIALS: { tone: "danger" }
};

function HealthIcon({ health }: { health: ProviderHealth }) {
  if (!health) return <span className="text-xs" style={{ color: "var(--ft-text-muted)" }}>No data</span>;
  const s = health.status;
  if (s === "HEALTHY") return <CheckCircle size={14} style={{ color: "var(--ft-green)" }} />;
  if (s === "DEGRADED") return <AlertTriangle size={14} style={{ color: "var(--ft-yellow)" }} />;
  return <XCircle size={14} style={{ color: "var(--ft-red)" }} />;
}

function BalanceText({ balance }: { balance: ProviderBalance }) {
  if (!balance) return <span className="text-xs" style={{ color: "var(--ft-text-muted)" }}>—</span>;
  const ngn = (balance.balanceMinor / 100).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  });
  const color =
    balance.status === "HEALTHY"
      ? "var(--ft-green)"
      : balance.status === "LOW_BALANCE"
        ? "var(--ft-yellow)"
        : "var(--ft-red)";
  return <span className="text-xs font-mono" style={{ color }}>{ngn}</span>;
}

export default function AdminVtuProvidersPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [matrix, setMatrix] = useState<RoutingMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [savingId, setSavingId] = useState<string>();
  const [expandedId, setExpandedId] = useState<string>();
  const [activeTab, setActiveTab] = useState<"providers" | "matrix">("providers");

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const [cfgs, mat] = await Promise.all([
        apiRequest<ProviderConfig[]>("/admin/vtu/providers"),
        apiRequest<RoutingMatrixRow[]>("/admin/vtu/providers/routing-matrix").catch(() => [] as RoutingMatrixRow[])
      ]);
      setProviders(cfgs);
      setMatrix(mat);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load provider configs.");
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

  async function patchProvider(providerName: string, patch: Record<string, unknown>) {
    setSavingId(providerName);
    setError(undefined);
    try {
      const updated = await apiRequest<ProviderConfig>(
        `/admin/vtu/providers/${encodeURIComponent(providerName)}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      setProviders((prev) =>
        prev.map((p) => (p.providerName === providerName ? { ...p, ...updated } : p))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update provider.");
    } finally {
      setSavingId(undefined);
    }
  }

  if (sessionLoading || loading) {
    return (
      <div
        style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <p className="text-sm" style={{ color: "var(--ft-text-muted)" }}>
          Loading provider configs…
        </p>
      </div>
    );
  }

  if (sessionError || (!sessionLoading && !session?.isPlatformAdmin)) {
    return <AdminAuthState loading={false} />;
  }

  return (
    <AdminShell active="/vtu/providers/">
      {/* Header */}
      <header
        style={{ borderBottom: "1px solid var(--ft-border)" }}
        className="px-6 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Activity size={18} style={{ color: "var(--ft-accent)" }} />
          <h1 className="font-semibold text-sm">VTU Provider Control Center</h1>
          <span className="text-xs" style={{ color: "var(--ft-text-muted)" }}>
            /{" "}
            <a href="/vtu" className="hover:underline">
              Routes
            </a>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void refresh()} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div
            style={{
              background: "var(--ft-red-subtle)",
              border: "1px solid var(--ft-red)",
              borderRadius: "var(--radius-md)",
              color: "var(--ft-red)"
            }}
            className="px-4 py-3 text-sm"
          >
            {error}
          </div>
        )}

        {/* Tab switcher */}
        <div style={{ borderBottom: "1px solid var(--ft-border)" }} className="flex gap-2">
          {(["providers", "matrix"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium capitalize -mb-px transition-colors"
              style={{
                borderBottom: `2px solid ${activeTab === tab ? "var(--ft-accent)" : "transparent"}`,
                color: activeTab === tab ? "var(--ft-accent)" : "var(--ft-text-muted)"
              }}
            >
              {tab === "providers" ? "Providers" : "Routing Matrix"}
            </button>
          ))}
        </div>

        {/* ── Providers tab ────────────────────────────────────────────── */}
        {activeTab === "providers" && (
          <div className="space-y-3">
            {providers.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: "var(--ft-text-muted)" }}>
                No provider configs found. Run the VTU seed to bootstrap them.
              </p>
            ) : (
              providers.map((p) => {
                const toneCfg = STATUS_TONE[p.status] ?? { tone: "neutral" as const };
                const isExpanded = expandedId === p.providerName;
                const isSaving = savingId === p.providerName;

                return (
                  <Panel key={p.providerName} className="p-0 overflow-hidden">
                    {/* Summary row */}
                    <div
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors"
                      style={{ background: isExpanded ? "var(--ft-bg-muted)" : undefined }}
                      onClick={() =>
                        setExpandedId(isExpanded ? undefined : p.providerName)
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{p.displayName}</span>
                          <Badge tone={toneCfg.tone}>{p.status}</Badge>
                          {p.maintenanceMode && <Badge tone="warning">Maintenance</Badge>}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--ft-text-muted)" }}>
                          {p.providerName} · Priority {p.priority} · Services:{" "}
                          {p.enabledServices.join(", ") || "none"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 text-xs">
                        <HealthIcon health={p.health} />
                        {p.health && (
                          <span style={{ color: "var(--ft-text-muted)" }}>{p.health.latencyMs}ms</span>
                        )}
                      </div>

                      {p.health && (
                        <span className="text-xs hidden sm:block" style={{ color: "var(--ft-text-muted)" }}>
                          {((p.health.successRateBps ?? 0) / 100).toFixed(1)}% ok
                        </span>
                      )}

                      <div className="hidden md:block">
                        <BalanceText balance={p.balance} />
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          disabled={isSaving}
                          title={p.maintenanceMode ? "Exit maintenance" : "Enter maintenance"}
                          onClick={() => void patchProvider(p.providerName, { maintenanceMode: !p.maintenanceMode })}
                        >
                          <Pause size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={isSaving}
                          onClick={() => setExpandedId(isExpanded ? undefined : p.providerName)}
                        >
                          <Settings size={13} />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div
                        style={{ borderTop: "1px solid var(--ft-border)", background: "var(--ft-bg-subtle)" }}
                        className="px-5 py-4 space-y-4"
                      >
                        {/* Status picker */}
                        <div>
                          <p className="text-xs font-medium mb-2" style={{ color: "var(--ft-text-muted)" }}>
                            Status
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {VTU_PROVIDER_STATUSES.map((s) => (
                              <button
                                key={s}
                                disabled={isSaving || p.status === s}
                                onClick={() =>
                                  void patchProvider(p.providerName, { status: s })
                                }
                                className="text-xs px-2 py-1 rounded transition-colors"
                                style={{
                                  border: `1px solid ${p.status === s ? "var(--ft-accent)" : "var(--ft-border)"}`,
                                  background: p.status === s ? "var(--ft-accent)" : undefined,
                                  color: p.status === s ? "#fff" : "var(--ft-text-secondary)",
                                  opacity: isSaving ? 0.5 : 1
                                }}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Routing weights */}
                        <div>
                          <p className="text-xs font-medium mb-2" style={{ color: "var(--ft-text-muted)" }}>
                            Routing Weights (cost·success·latency·balance)
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {(
                              [
                                ["Cost", "costWeight"],
                                ["Success", "successRateWeight"],
                                ["Latency", "latencyWeight"],
                                ["Balance", "balanceWeight"]
                              ] as [string, keyof ProviderConfig][]
                            ).map(([label, field]) => (
                              <div key={field}>
                                <label
                                  className="text-xs block mb-1"
                                  style={{ color: "var(--ft-text-muted)" }}
                                >
                                  {label}
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  defaultValue={p[field] as number}
                                  onBlur={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val !== (p[field] as number)) {
                                      void patchProvider(p.providerName, { [field]: val });
                                    }
                                  }}
                                  className="w-full text-xs px-2 py-1.5 rounded"
                                  style={{
                                    border: "1px solid var(--ft-border)",
                                    background: "var(--ft-bg-primary)",
                                    color: "var(--ft-text-primary)"
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Balance threshold + traffic allocation */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              className="text-xs block mb-1"
                              style={{ color: "var(--ft-text-muted)" }}
                            >
                              Min Balance Threshold (kobo)
                            </label>
                            <input
                              type="number"
                              min={0}
                              defaultValue={p.minBalanceMinor}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== p.minBalanceMinor) {
                                  void patchProvider(p.providerName, { minBalanceMinor: val });
                                }
                              }}
                              className="w-full text-xs px-2 py-1.5 rounded"
                              style={{
                                border: "1px solid var(--ft-border)",
                                background: "var(--ft-bg-primary)",
                                color: "var(--ft-text-primary)"
                              }}
                            />
                          </div>
                          <div>
                            <label
                              className="text-xs block mb-1"
                              style={{ color: "var(--ft-text-muted)" }}
                            >
                              Traffic Allocation (%)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              defaultValue={p.trafficAllocationPct}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val !== p.trafficAllocationPct) {
                                  void patchProvider(p.providerName, { trafficAllocationPct: val });
                                }
                              }}
                              className="w-full text-xs px-2 py-1.5 rounded"
                              style={{
                                border: "1px solid var(--ft-border)",
                                background: "var(--ft-bg-primary)",
                                color: "var(--ft-text-primary)"
                              }}
                            />
                          </div>
                        </div>

                        {/* Balance snapshot */}
                        {p.balance && (
                          <p className="text-xs" style={{ color: "var(--ft-text-muted)" }}>
                            Balance last checked:{" "}
                            <span className="font-mono">
                              {new Date(p.balance.checkedAt).toLocaleString()}
                            </span>{" "}
                            · <span className="font-medium">{p.balance.status}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </Panel>
                );
              })
            )}
          </div>
        )}

        {/* ── Routing Matrix tab ───────────────────────────────────────── */}
        {activeTab === "matrix" && (
          <Panel className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ft-border)" }}>
                  {["Product", "Network", "Winner", "All Candidates (score · cost)"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-medium"
                      style={{ color: "var(--ft-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center"
                      style={{ color: "var(--ft-text-muted)" }}
                    >
                      No routing data. Ensure at least one provider is ACTIVE or PRODUCTION_READY.
                    </td>
                  </tr>
                ) : (
                  matrix.map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: "1px solid var(--ft-border)" }}
                    >
                      <td className="px-4 py-2 font-medium">{row.productType}</td>
                      <td className="px-4 py-2" style={{ color: "var(--ft-text-muted)" }}>
                        {row.network ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {row.winner ? (
                          <Badge tone="success">{row.winner}</Badge>
                        ) : (
                          <Badge tone="danger">No route</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2" style={{ color: "var(--ft-text-muted)" }}>
                        {row.allCandidates.length === 0
                          ? "—"
                          : row.allCandidates
                              .map(
                                (c) =>
                                  `${c.providerName} (${c.score}${
                                    c.costMinor
                                      ? " · ₦" + (c.costMinor / 100).toFixed(2)
                                      : ""
                                  })`
                              )
                              .join(", ")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </AdminShell>
  );
}
