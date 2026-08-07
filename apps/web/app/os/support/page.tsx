"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import {
  createSupportTicket,
  listSupportTickets,
  replyToSupportTicket,
  type SupportTicket,
  type SupportTicketPriority
} from "./api";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "info"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "neutral"
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("NORMAL");
  const [submitting, setSubmitting] = useState(false);

  const [selectedId, setSelectedId] = useState<string>();
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTickets(await listSupportTickets());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load your support tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitTicket() {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await createSupportTicket({ subject: subject.trim(), body: body.trim(), priority });
      setSubject("");
      setBody("");
      setPriority("NORMAL");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not submit this ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReply(id: string) {
    if (!replyBody.trim()) return;
    setReplying(true);
    setError(undefined);
    try {
      const updated = await replyToSupportTicket(id, replyBody.trim());
      setReplyBody("");
      setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send this reply.");
    } finally {
      setReplying(false);
    }
  }

  const selected = tickets.find((t) => t.id === selectedId);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Support</h1>
        </div>

        <ErrorNotice message={error} />

        {selected ? (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <button
              className="mb-3 text-xs text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
              onClick={() => setSelectedId(undefined)}
              type="button"
            >
              ← Back to tickets
            </button>
            <Panel className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{selected.subject}</h2>
                <Badge tone={STATUS_TONE[selected.status] ?? "neutral"}>{selected.status.toLowerCase()}</Badge>
              </div>
              <div className="mt-4 grid gap-3">
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
                      {r.authorType === "ADMIN" ? "Support team" : "You"}
                    </div>
                    {r.body}
                  </div>
                ))}
              </div>

              {selected.status !== "CLOSED" && (
                <div className="mt-4 flex gap-2">
                  <input
                    className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a reply..."
                    value={replyBody}
                  />
                  <Button disabled={!replyBody.trim() || replying} onClick={() => void submitReply(selected.id)}>
                    <Send className="size-4" />
                  </Button>
                </div>
              )}
            </Panel>
          </motion.div>
        ) : (
          <>
            <Panel className="mt-6 p-5">
              <h2 className="mb-3 font-semibold">New ticket</h2>
              <div className="grid gap-2">
                <input
                  className="h-11 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  value={subject}
                />
                <textarea
                  className="min-h-24 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe your issue..."
                  value={body}
                />
                <select
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
                  value={priority}
                >
                  <option value="LOW">Low priority</option>
                  <option value="NORMAL">Normal priority</option>
                  <option value="HIGH">High priority</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <Button
                  className="justify-center"
                  disabled={!subject.trim() || !body.trim() || submitting}
                  onClick={() => void submitTicket()}
                >
                  {submitting ? "Submitting..." : "Submit ticket"}
                </Button>
              </div>
            </Panel>

            <div className="mt-6">
              <h2 className="mb-3 font-semibold">Your tickets</h2>
              {loading ? (
                <LoadingBlock label="Loading tickets" />
              ) : tickets.length === 0 ? (
                <EmptyState copy="Tickets you submit will show up here." icon={LifeBuoy} title="No tickets yet" />
              ) : (
                <div className="grid gap-2">
                  {tickets.map((t) => (
                    <button
                      className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 text-left transition hover:border-[var(--ft-accent)]/30"
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
                      <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status.toLowerCase()}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
