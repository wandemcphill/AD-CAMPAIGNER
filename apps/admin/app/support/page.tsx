"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, RefreshCcw, Send } from "lucide-react";

import { Badge, Button, Panel, ThemeToggle } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface TicketReply {
  id: string;
  authorType: "USER" | "ADMIN";
  body: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  workspaceId: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  replies: TicketReply[];
}

const STATUS_TONE: Record<TicketStatus, "success" | "warning" | "neutral" | "info"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "neutral"
};

const PRIORITY_TONE: Record<TicketPriority, "danger" | "warning" | "neutral"> = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "neutral",
  LOW: "neutral"
};

const TABS = [
  { id: "all", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "IN_PROGRESS", label: "In progress" }
];

export default function AdminSupportPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [tab, setTab] = useState("OPEN");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (status: string) => {
    setError(undefined);
    try {
      const query = status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
      setTickets(await apiRequest<Ticket[]>(`/admin/support/tickets${query}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load support tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session?.isPlatformAdmin) {
      window.location.replace("/login/");
      return;
    }
    if (session?.isPlatformAdmin) void refresh(tab);
  }, [sessionLoading, session, tab, refresh]);

  function changeTab(next: string) {
    setTab(next);
    setLoading(true);
  }

  async function updateStatus(id: string, status: TicketStatus) {
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/admin/support/tickets/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await refresh(tab);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(id: string) {
    if (!replyBody.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/admin/support/tickets/${encodeURIComponent(id)}/replies`, {
        method: "POST",
        body: JSON.stringify({ body: replyBody.trim() })
      });
      setReplyBody("");
      await refresh(tab);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send this reply.");
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Support auth" />;
  }

  const selected = tickets.find((t) => t.id === selectedId);

  return (
    <AdminShell active="/support/">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Support</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={loading} onClick={() => void refresh(tab)} variant="secondary">
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
          <TabBar items={TABS} onChange={changeTab} value={tab} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-2">
            {loading ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading tickets...</Panel>
            ) : tickets.length === 0 ? (
              <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">No tickets found.</Panel>
            ) : (
              tickets.map((t) => (
                <button
                  className={`flex items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition ${
                    selectedId === t.id
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/5"
                      : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]/30"
                  }`}
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  type="button"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">{t.subject}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {new Date(t.createdAt).toLocaleDateString()} · {t.replies.length} replies
                    </div>
                  </div>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority.toLowerCase()}</Badge>
                  <Badge tone={STATUS_TONE[t.status]}>{t.status.toLowerCase()}</Badge>
                </button>
              ))
            )}
          </div>

          <Panel className="p-5">
            {selected ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{selected.subject}</h2>
                  <select
                    className="h-9 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-2 text-xs outline-none focus:border-[var(--ft-accent)]"
                    disabled={busy}
                    onChange={(e) => void updateStatus(selected.id, e.target.value as TicketStatus)}
                    value={selected.status}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div className="mt-4 grid max-h-96 gap-3 overflow-y-auto">
                  <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm">
                    {selected.body}
                  </div>
                  {selected.replies.map((r) => (
                    <div
                      className={`rounded-[var(--radius-md)] border p-3 text-sm ${
                        r.authorType === "ADMIN"
                          ? "border-[var(--ft-accent)]/30 bg-[var(--ft-accent)]/5"
                          : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)]"
                      }`}
                      key={r.id}
                    >
                      <div className="mb-1 text-xs font-semibold text-[var(--ft-text-muted)]">
                        {r.authorType === "ADMIN" ? "Support team (you)" : "Customer"}
                      </div>
                      {r.body}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a reply..."
                    value={replyBody}
                  />
                  <Button disabled={!replyBody.trim() || busy} onClick={() => void submitReply(selected.id)}>
                    <Send className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--ft-text-muted)]">Select a ticket to view the conversation.</p>
            )}
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
