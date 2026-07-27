"use client";

import { Download, FileClock, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { loadAdminOtpAudit } from "../api";
import { AdminOtpShell, AdminPageHeader, EmptyState } from "../components";
import type { AdminOtpAuditEvent } from "../data";

const eventDot = {
  info: "bg-[var(--ft-blue)]",
  neutral: "bg-[var(--ft-text-muted)]",
  success: "bg-[var(--ft-green)]",
  warning: "bg-[var(--ft-yellow)]"
} as const;

function timeLabel(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(timestamp);
}

export default function AdminOtpAuditPage() {
  const [events, setEvents] = useState<AdminOtpAuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEvents(await loadAdminOtpAudit());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load OTP audit trail.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AdminOtpShell active="/otp/audit">
      <AdminPageHeader
        eyebrow={<Badge tone="success">Immutable event log</Badge>}
        title="Audit"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={events.length === 0} variant="secondary">
              <Download className="size-4" /> Export CSV
            </Button>
            <Button disabled={isLoading} onClick={() => void refresh()}>
              <RefreshCcw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="mt-6 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
          {error}
        </div>
      ) : null}

      <Panel className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--ft-border)] p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--ft-text-primary)]">
            <FileClock className="size-5 text-[var(--ft-text-primary)]" />
            OTP audit trail
          </h2>
        </div>
        <div className="hidden grid-cols-[1fr_0.8fr_0.8fr_auto] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase lg:grid">
          <div>Event</div>
          <div>Actor</div>
          <div>Target</div>
          <div>Time</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {isLoading ? (
            <EmptyState title="Loading audit trail" detail="Fetching live OTP system events." />
          ) : events.length === 0 ? (
            <EmptyState
              title="No OTP audit events"
              detail="Provider control, pricing, and order events will appear here."
            />
          ) : (
            events.map((event) => (
              <div
                className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] lg:grid-cols-[1fr_0.8fr_0.8fr_auto] lg:items-center"
                key={event.id}
              >
                <div className="flex items-center gap-3 font-semibold text-[var(--ft-text-primary)]">
                  <span className={`size-2 rounded-full ${eventDot[event.tone]}`} />
                  {event.event}
                </div>
                <div className="text-sm text-[var(--ft-text-secondary)]">{event.actor}</div>
                <div className="text-sm text-[var(--ft-text-secondary)]">{event.target}</div>
                <Badge tone={event.tone}>{timeLabel(event.at)}</Badge>
              </div>
            ))
          )}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
