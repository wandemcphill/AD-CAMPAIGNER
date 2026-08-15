"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ScaleIcon } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type Status = "OPEN" | "INVESTIGATING" | "RESOLVED" | "WONT_FIX";

type ReconciliationException = {
  id: string;
  workspaceId: string | null;
  resourceType: string;
  resourceId: string;
  domain: string;
  providerName: string;
  kind: string;
  status: Status;
  internalStatus: string | null;
  providerStatus: string | null;
  internalAmountMinor: number | null;
  providerAmountMinor: number | null;
  internalCurrency: string | null;
  providerCurrency: string | null;
  providerReference: string | null;
  detail: string | null;
  resolutionNote: string | null;
  createdAt: string;
};

const STATUS_TONE: Record<Status, "danger" | "warning" | "success" | "neutral"> = {
  OPEN: "danger",
  INVESTIGATING: "warning",
  RESOLVED: "success",
  WONT_FIX: "neutral"
};

const FILTERS: Array<{ label: string; value: Status | "" }> = [
  { label: "Needs action", value: "" },
  { label: "Open", value: "OPEN" },
  { label: "Investigating", value: "INVESTIGATING" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Won't fix", value: "WONT_FIX" }
];

function formatSide(amountMinor: number | null, currency: string | null, status: string | null) {
  const parts: string[] = [];
  if (typeof amountMinor === "number") {
    parts.push(
      new Intl.NumberFormat("en-NG", {
        currency: currency ?? "NGN",
        style: "currency"
      }).format(amountMinor / 100)
    );
  }
  if (status) parts.push(status);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function AdminReconciliationPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [filter, setFilter] = useState<Status | "">("");
  const [rows, setRows] = useState<ReconciliationException[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const load = useCallback(async (status: Status | "") => {
    setLoading(true);
    setError(undefined);
    try {
      const query = status ? `?status=${status}` : "";
      const result = await apiRequest<{
        exceptions: ReconciliationException[];
        counts: Record<string, number>;
      }>(`/admin/reconciliation/exceptions${query}`);
      setRows(result.exceptions);
      setCounts(result.counts ?? {});
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load reconciliation exceptions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && session?.isPlatformAdmin) {
      void load(filter);
    }
  }, [sessionLoading, session, filter, load]);

  async function setStatus(row: ReconciliationException, status: Status) {
    const note = window.prompt(
      `Mark ${row.kind} on ${row.resourceType}:${row.resourceId} as ${status.replace("_", " ")}.\n\n` +
        "This records the decision only — it moves no money. Note:"
    );

    if (note === null) return;
    if (note.trim().length < 3) {
      setError("A note of at least 3 characters is required.");
      return;
    }

    setBusyId(row.id);
    setError(undefined);
    setSuccess(undefined);
    try {
      await apiRequest(`/admin/reconciliation/exceptions/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, note: note.trim() })
      });
      setSuccess(`Exception marked ${status.replace("_", " ").toLowerCase()}.`);
      await load(filter);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this exception.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Reconciliation auth" />;
  }

  const openCount = (counts["OPEN"] ?? 0) + (counts["INVESTIGATING"] ?? 0);

  return (
    <AdminShell active="/reconciliation/">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2">
          <ScaleIcon className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Reconciliation</h1>
          {openCount > 0 ? <Badge tone="danger">{openCount} need action</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Money-moving operations whose outcome was ambiguous or disagreed with the provider. Closing
          one records a decision — it does not move money. Use a wallet adjustment or the vertical&apos;s
          own refund path for that.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.value || "default"}
              onClick={() => setFilter(item.value)}
              variant={filter === item.value ? "primary" : "secondary"}
            >
              {item.label}
              {item.value && counts[item.value] ? ` (${counts[item.value]})` : ""}
            </Button>
          ))}
        </div>

        {error ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/40 bg-[var(--ft-red)]/10 p-3 text-sm text-[var(--ft-red)]">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/40 bg-[var(--ft-green)]/10 p-3 text-sm text-[var(--ft-green)]">
            {success}
          </p>
        ) : null}

        <Panel className="mt-4 overflow-hidden p-0">
          {loading ? (
            <p className="p-4 text-sm text-[var(--ft-text-secondary)]">Loading...</p>
          ) : rows.length === 0 ? (
            <div className="flex items-center gap-3 p-6 text-sm text-[var(--ft-text-secondary)]">
              <AlertTriangle className="size-4 stroke-[1.5] text-[var(--ft-green)]" />
              Nothing here — no exceptions match this filter.
            </div>
          ) : (
            rows.map((row) => (
              <div className="border-b border-[var(--ft-border)] p-4 last:border-b-0" key={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.kind.replaceAll("_", " ")}</span>
                      <Badge tone={STATUS_TONE[row.status]}>
                        {row.status.replace("_", " ").toLowerCase()}
                      </Badge>
                      <Badge tone="neutral">{row.providerName}</Badge>
                    </div>
                    <div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">
                      {row.resourceType}:{row.resourceId}
                      {row.providerReference ? ` · ref ${row.providerReference}` : ""}
                    </div>
                    {row.detail ? (
                      <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">{row.detail}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] p-2">
                    <div className="font-mono text-[10px] tracking-[0.08em] text-[var(--ft-text-muted)] uppercase">
                      FlipTrybe believes
                    </div>
                    <div className="mt-1">
                      {formatSide(row.internalAmountMinor, row.internalCurrency, row.internalStatus)}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] p-2">
                    <div className="font-mono text-[10px] tracking-[0.08em] text-[var(--ft-text-muted)] uppercase">
                      Provider reported
                    </div>
                    <div className="mt-1">
                      {formatSide(row.providerAmountMinor, row.providerCurrency, row.providerStatus)}
                    </div>
                  </div>
                </div>

                {row.resolutionNote ? (
                  <p className="mt-2 text-xs text-[var(--ft-text-muted)]">
                    Note: {row.resolutionNote}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status !== "INVESTIGATING" && row.status !== "RESOLVED" ? (
                    <Button
                      disabled={busyId === row.id}
                      onClick={() => void setStatus(row, "INVESTIGATING")}
                      variant="secondary"
                    >
                      Investigate
                    </Button>
                  ) : null}
                  {row.status !== "RESOLVED" ? (
                    <Button disabled={busyId === row.id} onClick={() => void setStatus(row, "RESOLVED")}>
                      Resolve
                    </Button>
                  ) : null}
                  {row.status !== "WONT_FIX" && row.status !== "RESOLVED" ? (
                    <Button
                      disabled={busyId === row.id}
                      onClick={() => void setStatus(row, "WONT_FIX")}
                      variant="secondary"
                    >
                      Won&apos;t fix
                    </Button>
                  ) : null}
                  {row.status === "RESOLVED" ? (
                    <Button
                      disabled={busyId === row.id}
                      onClick={() => void setStatus(row, "INVESTIGATING")}
                      variant="secondary"
                    >
                      Reopen
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
