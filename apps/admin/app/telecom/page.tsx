"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe2, RefreshCcw } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";

import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type TelecomProviderHealth = {
  providerName: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
  checkedAt: string;
  reason?: string;
  balanceMinor?: number;
  currency?: string;
};

const STATUS_TONE: Record<TelecomProviderHealth["status"], "success" | "warning" | "danger"> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  DOWN: "danger"
};

export default function AdminTelecomPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [providers, setProviders] = useState<TelecomProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setProviders(await apiRequest<TelecomProviderHealth[]>("/telecom/providers/health"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load telecom provider health.");
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

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Telecom auth" />;
  }

  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Telecom provider health</h1>
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
          International airtime/data top-up providers behind /os/telecom. Each check is live,
          not cached — it calls out to the provider.
        </p>

        {error ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Checking providers...</Panel>
          ) : providers.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No telecom providers configured.</Panel>
          ) : (
            providers.map((provider) => (
              <Panel className="flex items-center gap-4 p-4" key={provider.providerName}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--ft-text-primary)]">
                      {provider.providerName}
                    </span>
                    <Badge tone={STATUS_TONE[provider.status]}>{provider.status.toLowerCase()}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                    {provider.latencyMs}ms
                    {provider.balanceMinor !== undefined
                      ? ` · ${(provider.balanceMinor / 100).toLocaleString()} ${provider.currency ?? ""}`
                      : ""}
                    {" · checked "}
                    {new Date(provider.checkedAt).toLocaleTimeString()}
                  </div>
                  {provider.reason ? (
                    <div className="mt-1 text-xs text-[var(--ft-red)]">{provider.reason}</div>
                  ) : null}
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
