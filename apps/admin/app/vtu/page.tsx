"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, RefreshCcw, Signal, Smartphone } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";

import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type VtuProductType = "AIRTIME" | "DATA";
type VtuNetwork = "MTN" | "GLO" | "AIRTEL" | "NINE_MOBILE";

type VtuProviderRoute = {
  id: string;
  productType: VtuProductType;
  network: VtuNetwork | null;
  provider: string;
  priority: number;
  active: boolean;
  note: string | null;
  updatedAt: string;
};

const NETWORK_LABEL: Record<VtuNetwork, string> = {
  MTN: "MTN",
  GLO: "Glo",
  AIRTEL: "Airtel",
  NINE_MOBILE: "9mobile"
};

function groupKey(route: VtuProviderRoute) {
  return `${route.productType}:${route.network ?? "ANY"}`;
}

export default function AdminVtuPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [routes, setRoutes] = useState<VtuProviderRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [savingId, setSavingId] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const data = await apiRequest<VtuProviderRoute[]>("/admin/vtu/routes");
      setRoutes(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load VTU routes.");
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
    const byGroup = new Map<string, VtuProviderRoute[]>();
    for (const route of routes) {
      const key = groupKey(route);
      const list = byGroup.get(key) ?? [];
      list.push(route);
      byGroup.set(key, list);
    }
    for (const list of byGroup.values()) {
      list.sort((a, b) => a.priority - b.priority);
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [routes]);

  async function updateRoute(id: string, patch: { priority?: number; enabled?: boolean }) {
    setSavingId(id);
    setError(undefined);
    try {
      const updated = await apiRequest<VtuProviderRoute>(
        `/admin/vtu/routes/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this route.");
    } finally {
      setSavingId(undefined);
    }
  }

  async function swapPriority(a: VtuProviderRoute, b: VtuProviderRoute) {
    setSavingId(a.id);
    setError(undefined);
    try {
      const [updatedA, updatedB] = await Promise.all([
        apiRequest<VtuProviderRoute>(`/admin/vtu/routes/${encodeURIComponent(a.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ priority: b.priority })
        }),
        apiRequest<VtuProviderRoute>(`/admin/vtu/routes/${encodeURIComponent(b.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ priority: a.priority })
        })
      ]);
      setRoutes((prev) =>
        prev.map((r) => (r.id === updatedA.id ? updatedA : r.id === updatedB.id ? updatedB : r))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reorder these routes.");
    } finally {
      setSavingId(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="VTU auth" />;
  }

  return (
    <main className="ft-shell min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">VTU provider routing</h1>
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
          Each row is a provider candidate for a network + product type. Lower priority number
          wins. Swap two rows to reorder, or toggle a provider off without deleting the route.
        </p>

        {error && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading routes...</Panel>
          ) : groups.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
              No VTU provider routes configured yet. Run the seed script to populate defaults.
            </Panel>
          ) : (
            groups.map(([key, groupRoutes]) => {
              const [productType, network] = key.split(":") as [VtuProductType, string];
              return (
                <Panel className="p-4" key={key}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ft-text-primary)]">
                    <Signal className="size-4 text-[var(--ft-accent)]" />
                    {productType === "AIRTIME" ? "Airtime" : "Data"} ·{" "}
                    {network === "ANY" ? "Any network" : NETWORK_LABEL[network as VtuNetwork]}
                  </div>

                  <div className="mt-3 grid gap-2">
                    {groupRoutes.map((route, index) => (
                      <div
                        className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                        key={route.id}
                      >
                        <div className="w-6 text-center text-sm font-mono text-[var(--ft-text-muted)]">
                          {route.priority}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{route.provider}</div>
                          {route.note && (
                            <div className="text-xs text-[var(--ft-text-muted)]">{route.note}</div>
                          )}
                        </div>
                        <Badge tone={route.active ? "success" : "neutral"}>
                          {route.active ? "active" : "disabled"}
                        </Badge>
                        {index < groupRoutes.length - 1 && (
                          <Button
                            disabled={savingId !== undefined}
                            onClick={() => void swapPriority(route, groupRoutes[index + 1]!)}
                            variant="secondary"
                          >
                            <ArrowUpDown className="size-4" />
                            Swap
                          </Button>
                        )}
                        <Button
                          disabled={savingId !== undefined}
                          onClick={() => void updateRoute(route.id, { enabled: !route.active })}
                          variant={route.active ? "secondary" : "primary"}
                        >
                          {route.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </Panel>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
