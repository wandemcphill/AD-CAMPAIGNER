"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Webhook } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type Row = { id: string; name?: string; provider?: string; eventType?: string; status?: string; signatureValid?: boolean; attempts?: number; createdAt: string };
type Overview = {
  generatedAt: string;
  totals: { pendingOutbox: number; failedOutbox: number; events24h: number; invalidProviderSignatures24h: number; providerEvents24h: number; activeSubscriptions: number; failedDeliveries24h: number };
  failedEvents: Row[];
  invalidEvents: Row[];
  failedDeliveries: Row[];
};

export default function WebhookOperationsPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [data, setData] = useState<Overview>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await apiRequest<Overview>("/admin/webhook-operations/overview"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load webhook operations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.isPlatformAdmin) void refresh();
  }, [session, refresh]);

  if (sessionLoading || !session?.isPlatformAdmin) return <AdminAuthState error={sessionError} loading={sessionLoading} title="Webhook operations auth" />;

  const t = data?.totals;

  return (
    <AdminShell active="/webhook-operations/" subtitle="Webhook & event operations">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3"><Webhook className="size-5 text-[var(--ft-accent)]" /><div><h1 className="text-xl font-bold">Webhook Operations</h1><p className="text-sm text-[var(--ft-text-secondary)]">Inbound receipts, event outbox pressure and outgoing delivery failures.</p></div></div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary"><RefreshCw className="size-4" />Refresh</Button>
        </div>
        {error ? <p className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">{error}</p> : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Failed outbox", t?.failedOutbox ?? 0, "Internal events"],
            ["Pending outbox", t?.pendingOutbox ?? 0, "Waiting for consumers"],
            ["Failed deliveries", t?.failedDeliveries24h ?? 0, "Outgoing, 24h"],
            ["Invalid signatures", t?.invalidProviderSignatures24h ?? 0, "Provider webhooks, 24h"]
          ].map(([label, value, detail]) => <Panel className="p-4" key={String(label)}><div className="text-xs uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div><div className="mt-1 text-xs text-[var(--ft-text-secondary)]">{detail}</div></Panel>)}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <Panel className="overflow-hidden p-0"><div className="border-b border-[var(--ft-border)] p-4 font-semibold">Failed internal events</div>{data?.failedEvents.length ? data.failedEvents.map((row) => <div className="border-b border-[var(--ft-border)] p-4 last:border-b-0" key={row.id}><div className="font-medium">{row.name ?? "event"}</div><div className="mt-1 text-xs text-[var(--ft-text-muted)]">{row.status} · {row.attempts ?? 0} attempts · {new Date(row.createdAt).toLocaleString()}</div><Link className="mt-2 inline-block text-sm text-[var(--ft-accent)] hover:underline" href="/webhooks/">Open webhook desk</Link></div>) : <div className="p-5 text-sm text-[var(--ft-text-secondary)]">No failed internal events.</div>}</Panel>
          <Panel className="overflow-hidden p-0"><div className="border-b border-[var(--ft-border)] p-4 font-semibold">Invalid provider signatures</div>{data?.invalidEvents.length ? data.invalidEvents.map((row) => <div className="border-b border-[var(--ft-border)] p-4 last:border-b-0" key={row.id}><div className="font-medium">{row.provider ?? "provider"} · {row.eventType ?? "event"}</div><div className="mt-1 text-xs text-[var(--ft-text-muted)]">{new Date(row.createdAt).toLocaleString()}</div><Badge tone="danger">signature invalid</Badge></div>) : <div className="p-5 text-sm text-[var(--ft-text-secondary)]"><AlertTriangle className="mr-2 inline size-4" />No invalid provider signatures.</div>}</Panel>
          <Panel className="overflow-hidden p-0"><div className="border-b border-[var(--ft-border)] p-4 font-semibold">Failed outgoing deliveries</div>{data?.failedDeliveries.length ? data.failedDeliveries.map((row) => <div className="border-b border-[var(--ft-border)] p-4 last:border-b-0" key={row.id}><div className="font-medium">{row.eventType ?? row.name ?? "delivery"}</div><div className="mt-1 text-xs text-[var(--ft-text-muted)]">{row.status} · {new Date(row.createdAt).toLocaleString()}</div><Link className="mt-2 inline-block text-sm text-[var(--ft-accent)] hover:underline" href="/webhooks/">Open webhook desk</Link></div>) : <div className="p-5 text-sm text-[var(--ft-text-secondary)]">No failed outgoing deliveries.</div>}</Panel>
        </div>
      </div>
    </AdminShell>
  );
}
