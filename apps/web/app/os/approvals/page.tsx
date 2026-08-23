"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, RefreshCw, ShieldAlert, X } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, Field, LoadingBlock, PageHeader } from "../../campaigns/components";
import {
  decideApproval,
  loadApprovals,
  type ApprovalQueueStatusFilter,
  type ApprovalQueueTypeFilter,
  type ApprovalRequestRecord
} from "./api";

// NOTE ON SCOPE: this queue only ever shows what's actually in the ApprovalRequest
// table — currently Digital Access refunds/reversals. Campaign launch approvals
// (admin/campaign-ops/campaigns/:id/status) and ad-account KYC approvals
// (ad-accounts/:id/kyc) are separate ad-hoc endpoints that don't go through
// ApprovalsService yet, so they will NOT appear here. That unification is a
// deliberately deferred follow-up — see approvals.controller.ts.

const statusFilters: Array<{ label: string; value: ApprovalQueueStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Flagged", value: "flagged" }
];

const typeFilters: Array<{ label: string; value: ApprovalQueueTypeFilter }> = [
  { label: "All", value: "all" },
  { label: "Ads", value: "ads" },
  { label: "KYC", value: "kyc" },
  { label: "SMM", value: "smm" }
];

function timeInQueue(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return "-";
  const ms = Date.now() - created;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function statusTone(status: ApprovalRequestRecord["status"]): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "APPROVED" || status === "EXECUTED") return "success";
  if (status === "REJECTED" || status === "EXECUTION_FAILED") return "danger";
  return "warning";
}

function payloadBudget(payload: Record<string, unknown>) {
  const amountMinor = payload["amountMinor"];
  const currency = payload["currency"];
  if (typeof amountMinor === "number" && typeof currency === "string") {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amountMinor / 100);
  }
  return "-";
}

export default function ApprovalsQueuePage() {
  const [requests, setRequests] = useState<ApprovalRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<ApprovalQueueStatusFilter>("pending");
  const [type, setType] = useState<ApprovalQueueTypeFilter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      setRequests(await loadApprovals({ status, type }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the approvals queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Refetch on filter change only; `refresh` is recreated every render.
    void refresh();
  }, [status, type]);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId),
    [requests, selectedId]
  );

  async function decide(id: string, approve: boolean) {
    setDeciding(true);
    setError(undefined);
    try {
      const updated = await decideApproval(id, approve, note.trim() || undefined);
      setRequests((current) => current.map((request) => (request.id === id ? updated : request)));
      setNote("");
      setSelectedId(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record that decision.");
    } finally {
      setDeciding(false);
    }
  }

  return (
    <>
      <PageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Governance</Badge>
            <Badge tone="neutral">Approvals queue</Badge>
          </>
        }
        title="Approvals"
      />

      <ErrorNotice message={error} />

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-micro uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            Status
          </span>
          {statusFilters.map((filter) => (
            <button
              className={`h-8 rounded-[var(--radius-sm)] border px-3 text-xs font-medium transition ${
                status === filter.value
                  ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                  : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)]"
              }`}
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-micro uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            Type
          </span>
          {typeFilters.map((filter) => (
            <button
              className={`h-8 rounded-[var(--radius-sm)] border px-3 text-xs font-medium transition ${
                type === filter.value
                  ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                  : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)]"
              }`}
              key={filter.value}
              onClick={() => setType(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
        <div className="hidden grid-cols-[1fr_140px_120px_100px_180px] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-micro font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase sm:grid">
          <div>Client / Reason</div>
          <div>Campaign Type</div>
          <div>Budget</div>
          <div>Time in Queue</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {loading ? (
            <div className="p-4">
              <LoadingBlock label="Loading approvals queue" />
            </div>
          ) : requests.length === 0 ? (
            <div className="p-4">
              <EmptyState
                copy="Only requests routed through the dual-approval engine (currently Digital Access refunds/reversals) show up here. Campaign and KYC approvals still use their own review screens."
                icon={ClipboardCheck}
                title="Nothing in the queue"
              />
            </div>
          ) : (
            requests.map((request) => (
              <div
                className="grid gap-3 p-4 sm:grid-cols-[1fr_140px_120px_100px_180px] sm:items-center"
                key={request.id}
              >
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{request.action}</div>
                  <div className="mt-1 text-sm text-[var(--ft-text-muted)]">{request.reason}</div>
                </div>
                <Badge tone="neutral">{request.entityType}</Badge>
                <div className="font-mono text-sm text-[var(--ft-text-primary)]">
                  {payloadBudget(request.payload)}
                </div>
                <div className="flex items-center gap-1 text-sm text-[var(--ft-text-secondary)]">
                  {status === "flagged" ? <ShieldAlert className="size-3.5 text-[var(--ft-yellow)]" /> : null}
                  {timeInQueue(request.createdAt)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={deciding || request.status !== "PENDING"}
                    onClick={() => void decide(request.id, true)}
                    type="button"
                  >
                    <Check className="size-3.5" />
                    Approve
                  </Button>
                  <Button
                    disabled={deciding || request.status !== "PENDING"}
                    onClick={() => void decide(request.id, false)}
                    type="button"
                    variant="secondary"
                  >
                    <X className="size-3.5" />
                    Reject
                  </Button>
                  <Button onClick={() => setSelectedId(request.id)} type="button" variant="secondary">
                    View Details
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {selected ? (
        <div
          className="fixed inset-0 z-[70] bg-[var(--ft-bg-base)]/80 backdrop-blur-sm"
          onClick={() => setSelectedId(undefined)}
        >
          <aside
            className="ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--ft-border)] p-5">
              <div>
                <div className="font-mono text-micro font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                  Approval detail
                </div>
                <h2 className="mt-2 text-lg font-medium text-[var(--ft-text-primary)]">{selected.action}</h2>
              </div>
              <button
                aria-label="Close approval detail"
                className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)]"
                onClick={() => setSelectedId(undefined)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>

              <Field label="Reason (Campaign Creative / Notes)" value={selected.reason} />
              <Field label="Target / Entity" value={`${selected.entityType} · ${selected.entityId}`} />
              <Field label="Budget" value={payloadBudget(selected.payload)} />
              <Field label="Requested by" value={selected.requestedByUserId} />
              <Field label="Time in queue" value={timeInQueue(selected.createdAt)} />

              <div>
                <div className="font-mono text-micro font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                  Risk score
                </div>
                <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                  Not modeled by the backend yet — the ApprovalRequest engine does not compute a
                  risk score today. Showing raw payload instead.
                </p>
                <pre className="mt-2 max-h-40 overflow-auto rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs text-[var(--ft-text-secondary)]">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>

              <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                Notes
                <textarea
                  className="min-h-24 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a decision note (optional)"
                  value={note}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={deciding || selected.status !== "PENDING"}
                  onClick={() => void decide(selected.id, true)}
                  type="button"
                >
                  <Check className="size-4" />
                  Approve
                </Button>
                <Button
                  disabled={deciding || selected.status !== "PENDING"}
                  onClick={() => void decide(selected.id, false)}
                  type="button"
                  variant="secondary"
                >
                  <X className="size-4" />
                  Reject
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
