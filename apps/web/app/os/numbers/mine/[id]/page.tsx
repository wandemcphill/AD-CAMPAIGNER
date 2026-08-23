"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, MessageSquare, Settings } from "lucide-react";

import { Badge, EmptyState, Panel, PermissionDenied } from "@fliptrybe/ui";

import { ErrorNotice, LoadingBlock } from "../../../../campaigns/components";
import { isForbiddenError } from "../../../../lib/api-client";
import {
  loadMessages,
  loadNumberDetail,
  type VirtualNumber,
  type VirtualNumberMessage
} from "../../api";
import Link from "next/link";

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export default function NumberInboxPage() {
  const params = useParams<{ id: string }>();
  const numberId = params.id;

  const [number, setNumber] = useState<VirtualNumber>();
  const [messages, setMessages] = useState<VirtualNumberMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setError(undefined);
    setForbidden(false);
    try {
      const [detail, msgs] = await Promise.all([
        loadNumberDetail(numberId),
        loadMessages(numberId)
      ]);
      setNumber(detail);
      setMessages(msgs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load this number.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setLoading(false);
    }
  }, [numberId]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view your virtual numbers for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          className="inline-flex items-center gap-1 text-sm text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
          href="/os/numbers/mine"
        >
          <ChevronLeft className="size-4" />
          My Numbers
        </Link>

        <ErrorNotice message={error} />

        {loading ? (
          <Panel className="mt-6 p-6">
            <LoadingBlock label="Loading inbox" />
          </Panel>
        ) : number ? (
          <>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">{number.e164}</h1>
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--ft-text-muted)]">
                  <Badge tone={number.status === "ACTIVE" ? "success" : "neutral"}>
                    {number.status.toLowerCase()}
                  </Badge>
                  {number.countryCode}
                </div>
              </div>
              <Link
                className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--ft-border)] text-[var(--ft-text-muted)] transition hover:text-[var(--ft-text-primary)]"
                href={`/os/numbers/mine/${numberId}/manage`}
              >
                <Settings className="size-4" />
              </Link>
            </div>

            <Panel className="mt-4 p-4">
              <h2 className="mb-3 text-sm font-medium text-[var(--ft-text-muted)]">Inbox</h2>
              {messages.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No messages yet">
                  SMS sent to this number will appear here, usually within a minute.
                </EmptyState>
              ) : (
                <div className="grid gap-2">
                  {messages.map((m) => (
                    <div
                      className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                      key={m.id}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--ft-text-muted)]">
                          {m.senderMasked}
                        </span>
                        <span className="text-xs text-[var(--ft-text-muted)]">
                          {timeAgo(m.receivedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{m.bodyRedacted}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        ) : null}
      </div>
    </div>
  );
}
