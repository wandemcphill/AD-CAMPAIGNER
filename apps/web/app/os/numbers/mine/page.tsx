"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, MessageSquare, Smartphone } from "lucide-react";

import { Badge, Panel, PermissionDenied } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { isForbiddenError } from "../../../lib/api-client";
import { loadMyNumbers, type VirtualNumber, type VirtualNumberStatus } from "../api";
import Link from "next/link";

const STATUS_TONE: Record<VirtualNumberStatus, "success" | "warning" | "neutral" | "danger"> = {
  RESERVED: "neutral",
  PROVISIONING: "neutral",
  ACTIVE: "success",
  EXPIRING: "warning",
  EXPIRED: "danger",
  RELEASED: "neutral",
  FAILED: "danger",
  SUSPENDED: "danger"
};

function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return "—";
  const date = new Date(expiresAt);
  const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  return `${days}d left`;
}

export default function MyNumbersPage() {
  const [numbers, setNumbers] = useState<VirtualNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setError(undefined);
    setForbidden(false);
    try {
      setNumbers(await loadMyNumbers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load your numbers.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
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
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">My Numbers</h1>
          </div>
          <Link
            className="text-sm font-medium text-[var(--ft-accent)] hover:underline"
            href="/os/numbers"
          >
            Get a number
          </Link>
        </div>

        <ErrorNotice message={error} />

        <div className="mt-6">
          {loading ? (
            <Panel className="p-6">
              <LoadingBlock label="Loading your numbers" />
            </Panel>
          ) : numbers.length === 0 ? (
            <Panel className="p-6">
              <EmptyState
                copy="Numbers you purchase will show up here with their status and SMS inbox."
                icon={Globe}
                title="No numbers yet"
              />
            </Panel>
          ) : (
            <div className="grid gap-2">
              {numbers.map((n) => (
                <Link href={`/os/numbers/mine/${n.id}`} key={n.id}>
                  <Panel className="flex items-center gap-4 p-4 transition hover:border-[var(--ft-accent)]/40">
                    <div className="grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                      <Smartphone className="size-4 text-[var(--ft-accent)]" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{n.e164}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--ft-text-muted)]">
                        <span>{n.countryCode}</span>
                        <span>·</span>
                        <span>{formatExpiry(n.expiresAt)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="size-3" />
                          {n.messageCount}
                        </span>
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[n.status]}>{n.status.toLowerCase()}</Badge>
                  </Panel>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
