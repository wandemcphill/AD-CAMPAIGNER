"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Network, RefreshCcw } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";

import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

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
  REMITTANCE: "Remittance"
};

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
  const [entries, setEntries] = useState<ProviderRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [savingId, setSavingId] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const data = await apiRequest<ProviderRegistryEntry[]>("/admin/providers/registry");
      setEntries(data);
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
    <main className="ft-shell min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
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
      </div>
    </main>
  );
}
