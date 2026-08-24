"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, LifeBuoy, RefreshCcw, ShieldAlert } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type Ticket = {
  id: string;
  workspaceId: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  replies: Array<{ id: string; authorType: string; body: string; createdAt: string }>;
};

const statusTone: Record<TicketStatus, "success" | "warning" | "neutral" | "info"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "neutral"
};

const priorityTone: Record<TicketPriority, "danger" | "warning" | "neutral"> = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "neutral",
  LOW: "neutral"
};

export default function SupportOperationsPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [overview, setOverview] = useState<{ totals: { open: number; inProgress: number; resolved: number; closed: number; urgentOpen: number }; oldestOpen: { id: string; subject: string; priority: TicketPriority; status: TicketStatus; createdAt: string } | null }>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextTickets, nextOverview] = await Promise.all([
        apiRequest<Ticket[]>("/admin/support/tickets?status=OPEN"),
        apiRequest<typeof overview>("/admin/support/overview")
      ]);
      setTickets(nextTickets);
      setOverview(nextOverview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the support queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.isPlatformAdmin) void refresh();
  }, [session, refresh]);

  const urgent = useMemo(() => tickets.filter((ticket) => ticket.priority === "URGENT").length, [tickets]);
  const high = useMemo(() => tickets.filter((ticket) => ticket.priority === "HIGH").length, [tickets]);
  const unanswered = useMemo(
    () => tickets.filter((ticket) => !ticket.replies.some((reply) => reply.authorType === "ADMIN")).length,
    [tickets]
  );
  const oldest = tickets.reduce<Ticket | undefined>((current, ticket) => {
    if (!current) return ticket;
    return new Date(ticket.createdAt) < new Date(current.createdAt) ? ticket : current;
  }, undefined);

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Support operations auth" />;
  }

  return (
    <AdminShell active="/support/" subtitle="Support operations">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LifeBuoy className="size-5 text-[var(--ft-accent)]" />
              <h1 className="text-xl font-bold">Support Operations</h1>
              <Badge tone={urgent > 0 ? "danger" : "success"}>{urgent > 0 ? "attention" : "clear"}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-[var(--ft-text-secondary)]">
              Prioritise customer issues, expose unanswered work, and jump directly into the existing support workspace.
            </p>
          </div>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
        </div>

        {error ? <p className="mt-4 rounded-md border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">{error}</p> : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Open queue", overview?.totals.open ?? tickets.length, "Customer issues needing action"],
            ["Urgent", urgent, "Highest-priority tickets"],
            ["In progress", overview?.totals.inProgress ?? 0, "Already being handled"],
            ["High priority", high, "Escalation candidates"],
            ["Unanswered", unanswered, "No support-team reply yet"]
          ].map(([label, value, detail]) => (
            <Panel className="p-4" key={String(label)}>
              <div className="text-xs uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
              <div className="mt-1 text-xs text-[var(--ft-text-secondary)]">{detail}</div>
            </Panel>
          ))}
        </div>

        {overview?.oldestOpen || oldest ? (
          <Panel className="mt-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 size-4 text-[var(--ft-yellow)]" />
              <div>
                <div className="text-sm font-semibold">Oldest open issue</div>
                <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">{(overview?.oldestOpen ?? oldest)!.subject}</div>
                <div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{(overview?.oldestOpen ?? oldest)!.id} · {new Date((overview?.oldestOpen ?? oldest)!.createdAt).toLocaleString()}</div>
              </div>
            </div>
            <Link href={`/support/?ticket=${encodeURIComponent(oldest.id)}`} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ft-accent)]">
              Open support desk <ArrowRight className="size-4" />
            </Link>
          </Panel>
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--ft-border)] p-4">
              <div>
                <h2 className="font-semibold">Priority queue</h2>
                <p className="mt-1 text-xs text-[var(--ft-text-muted)]">Live open tickets from the support module.</p>
              </div>
              <Badge tone="neutral">{tickets.length}</Badge>
            </div>
            {tickets.slice().sort((a, b) => {
              const rank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as Record<TicketPriority, number>;
              return rank[a.priority] - rank[b.priority] || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }).slice(0, 12).map((ticket) => (
              <div className="grid gap-3 border-b border-[var(--ft-border)] p-4 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center" key={ticket.id}>
                <div>
                  <div className="font-medium">{ticket.subject}</div>
                  <div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{ticket.workspaceId} · {ticket.replies.length} replies</div>
                </div>
                <Badge tone={priorityTone[ticket.priority]}>{ticket.priority.toLowerCase()}</Badge>
                <Badge tone={statusTone[ticket.status]}>{ticket.status.toLowerCase()}</Badge>
              </div>
            ))}
            {!loading && tickets.length === 0 ? <div className="p-6 text-sm text-[var(--ft-text-secondary)]">No open support tickets.</div> : null}
          </Panel>

          <Panel className="p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 text-[var(--ft-accent)]" />
              <div>
                <h2 className="font-semibold">Operator workflow</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                  Use the existing support desk for conversation, status changes and replies. This command layer is intentionally read-heavy so it cannot accidentally mutate a ticket while triaging the queue.
                </p>
              </div>
            </div>
            <Link href="/support/" className="mt-5 inline-flex items-center gap-2 rounded-md border border-[var(--ft-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--ft-bg-muted)]">
              Open full support desk <ArrowRight className="size-4" />
            </Link>
          </Panel>
        </section>
      </div>
    </AdminShell>
  );
}
