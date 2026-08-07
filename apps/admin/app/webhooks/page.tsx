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

interface ProviderWebhookEventRow {
  id: string;
  provider: string;
  domain: string;
  eventType: string;
  signatureValid: boolean;
  createdAt: string;
}

const STATUS_TONE: Record<EventOutboxStatus, "success" | "warning" | "neutral" | "danger"> = {
  PROCESSED: "success",
  PENDING: "neutral",
  PROCESSING: "neutral",
  FAILED: "danger"
};

const SECTIONS = [
  { id: "outbox", label: "Event Outbox" },
  { id: "provider", label: "Provider Webhooks" }
];

const OUTBOX_TABS = [
  { id: "all", label: "All" },
  { id: "FAILED", label: "Failed" },
  { id: "PENDING", label: "Pending" }
];

export default function AdminWebhooksPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [section, setSection] = useState("outbox");
  const [outboxTab, setOutboxTab] = useState("all");
  const [events, setEvents] = useState<EventOutboxRow[]>([]);
  const [providerEvents, setProviderEvents] = useState<ProviderWebhookEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refreshOutbox = useCallback(async (status?: string) => {
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

  const refreshProviderEvents = useCallback(async () => {
    setError(undefined);
    try {
      setProviderEvents(
        await apiRequest<ProviderWebhookEventRow[]>("/admin/webhooks/incoming/provider-events")
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load provider webhook events.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshActiveSection = useCallback(
    (activeOutboxTab: string) => {
      setLoading(true);
      if (section === "outbox") void refreshOutbox(activeOutboxTab);
      else void refreshProviderEvents();
    },
    [section, refreshOutbox, refreshProviderEvents]
  );

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) refreshActiveSection("all");
  }, [sessionLoading, session, section, refreshActiveSection]);

  function changeOutboxTab(next: string) {
    setOutboxTab(next);
    setLoading(true);
    void refreshOutbox(next);
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
            <h1 className="text-xl font-bold">Webhooks</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading} onClick={() => refreshActiveSection(outboxTab)} variant="secondary">
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
          <TabBar items={SECTIONS} onChange={setSection} value={section} />
        </div>

        {section === "outbox" && (
          <>
            <p className="mt-3 text-sm text-[var(--ft-text-muted)]">
              Internal domain events dispatched to downstream consumers (notifications, webhooks,
              analytics). Failed entries indicate a consumer didn&apos;t acknowledge the event.
            </p>

            <div className="mt-3">
              <TabBar items={OUTBOX_TABS} onChange={changeOutboxTab} value={outboxTab} />
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
          </>
        )}

        {section === "provider" && (
          <>
            <p className="mt-3 text-sm text-[var(--ft-text-muted)]">
              Raw inbound webhook receipts from external providers (Sogo, Reloadly), including
              signature verification outcome — an audit trail independent of whether the payload
              was successfully processed.
            </p>

            <div className="mt-4 grid gap-2">
              {loading ? (
                <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading events...</Panel>
              ) : providerEvents.length === 0 ? (
                <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No provider webhook events yet.</Panel>
              ) : (
                providerEvents.map((e) => (
                  <Panel className="flex items-center gap-4 p-4" key={e.id}>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">
                        {e.provider} · {e.eventType}
                      </div>
                      <div className="text-xs text-[var(--ft-text-muted)]">
                        {new Date(e.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge tone={e.signatureValid ? "success" : "danger"}>
                      {e.signatureValid ? "signature valid" : "signature invalid"}
                    </Badge>
                  </Panel>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
