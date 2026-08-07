"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Webhook } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type EventOutboxStatus = "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";

interface EventOutboxRow {
  id: string;
  workspaceId: string | null;
  name: string;
  entityType: string;
  entityId: string;
  status: EventOutboxStatus;
  attempts: number;
  processedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<EventOutboxStatus, "success" | "warning" | "neutral" | "danger"> = {
  PROCESSED: "success",
  PENDING: "neutral",
  PROCESSING: "neutral",
  FAILED: "danger"
};

const TABS = [
  { id: "all", label: "All" },
  { id: "FAILED", label: "Failed" },
  { id: "PENDING", label: "Pending" }
];

export default function AdminWebhooksPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [tab, setTab] = useState("all");
  const [events, setEvents] = useState<EventOutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async (status?: string) => {
    setError(undefined);
    try {
      const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
      setEvents(await apiRequest<EventOutboxRow[]>(`/admin/webhooks/incoming${query}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load event outbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh("all");
  }, [sessionLoading, session, refresh]);

  function changeTab(next: string) {
    setTab(next);
    setLoading(true);
    void refresh(next);
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Webhooks auth" />;
  }

  return (
    <main className="ft-shell min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Event Outbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading} onClick={() => void refresh(tab)} variant="secondary">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-muted)]">
          Internal domain events dispatched to downstream consumers (notifications, webhooks,
          analytics). Failed entries indicate a consumer didn&apos;t acknowledge the event.
        </p>

        {error && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        )}

        <div className="mt-4">
          <TabBar items={TABS} onChange={changeTab} value={tab} />
        </div>

        <div className="mt-4 grid gap-2">
          {loading ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading events...</Panel>
          ) : events.length === 0 ? (
            <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No events found.</Panel>
          ) : (
            events.map((e) => (
              <Panel className="flex items-center gap-4 p-4" key={e.id}>
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {e.name} · {e.entityType} #{e.entityId.slice(0, 8)}
                  </div>
                  <div className="text-xs text-[var(--ft-text-muted)]">
                    {e.attempts} attempts · {new Date(e.createdAt).toLocaleString()}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[e.status]}>{e.status.toLowerCase()}</Badge>
              </Panel>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
