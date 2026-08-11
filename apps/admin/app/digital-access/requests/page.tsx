"use client";

import { useState } from "react";
import { Filter, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";

import {
  approveAdminDigitalAccessRefund,
  assignAdminDigitalAccessRequest,
  rejectAdminDigitalAccessRefund,
  updateAdminDigitalAccessRequestStatus
} from "../api";
import { AdminDigitalAccessShell, AdminErrorNotice, AdminPageHeader, RequestStatus } from "../components";
import { nextAllowedAccessStatuses, type AdminAccessRequest, type AdminAccessStatus } from "../data";
import { useAdminDigitalAccessData } from "../use-admin-digital-access-data";

function RequestRow({
  onChanged,
  request
}: {
  onChanged: () => Promise<void>;
  request: AdminAccessRequest;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AdminAccessStatus | "">("");
  const [assignedTo, setAssignedTo] = useState(request.assignedTo === "Unassigned" ? "" : request.assignedTo);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const allowedStatuses = nextAllowedAccessStatuses(request.status);

  async function submitStatus() {
    if (!status) return;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await updateAdminDigitalAccessRequestStatus(request.id, status);
      if (result.pending) {
        // failed/cancelled move real money back out — a second admin has to
        // decide it via the "Resolve refund" action before anything changes.
        setNotice(
          `This transition triggers a refund and needs a second admin's approval. Approval ID: ${result.approvalRequestId}`
        );
      } else {
        setStatus("");
        await onChanged();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update status.");
    } finally {
      setPending(false);
    }
  }

  async function submitAssign() {
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await assignAdminDigitalAccessRequest(request.id, assignedTo.trim() || null);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the assignee.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)]">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.8fr_auto] lg:items-center">
        <div>
          <div className="font-medium text-[var(--ft-text-primary)]">
            {request.id} - {request.service}
          </div>
          <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
            {request.plan} - {request.amount} - {request.age}
          </div>
        </div>
        <div className="text-sm text-[var(--ft-text-secondary)]">
          <div className="font-medium text-[var(--ft-text-primary)]">{request.customer}</div>
          <div className="mt-1 text-[var(--ft-text-muted)]">{request.contact}</div>
        </div>
        <div className="text-sm font-medium text-[var(--ft-text-secondary)]">{request.assignedTo}</div>
        <div className="flex items-center gap-2">
          <RequestStatus request={request} />
          <Button onClick={() => setOpen((current) => !current)} variant="secondary">
            {open ? "Cancel" : "Update"}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="grid gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
              Status
              <select
                className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm text-[var(--ft-text-primary)]"
                disabled={pending || allowedStatuses.length === 0}
                onChange={(event) => setStatus(event.target.value as AdminAccessStatus)}
                value={status}
              >
                <option value="">
                  {allowedStatuses.length === 0 ? "No further transitions" : "Choose a status"}
                </option>
                {allowedStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
              Assigned to
              <input
                className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm text-[var(--ft-text-primary)]"
                disabled={pending}
                onChange={(event) => setAssignedTo(event.target.value)}
                placeholder="Team member name"
                value={assignedTo}
              />
            </label>
            <div className="flex items-end gap-2">
              <Button disabled={pending || !status} onClick={() => void submitStatus()} type="button">
                Save status
              </Button>
              <Button disabled={pending} onClick={() => void submitAssign()} type="button" variant="secondary">
                Save assignee
              </Button>
            </div>
          </div>
          {notice ? (
            <div className="rounded-md border border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] p-3 text-sm text-[var(--ft-yellow)]">
              {notice}
            </div>
          ) : null}
          {error ? <AdminErrorNotice message={error} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ResolveRefundPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [approvalId, setApprovalId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"approve" | "reject">();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  async function resolve(approve: boolean) {
    const id = approvalId.trim();
    if (!id) return;

    setPending(approve ? "approve" : "reject");
    setError(undefined);
    setSuccess(undefined);
    try {
      if (approve) {
        await approveAdminDigitalAccessRefund(id, note.trim() || undefined);
      } else {
        await rejectAdminDigitalAccessRefund(id, note.trim() || undefined);
      }
      setSuccess(approve ? "Refund approved." : "Refund rejected.");
      setApprovalId("");
      setNote("");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resolve this approval.");
    } finally {
      setPending(undefined);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="secondary">
        <ShieldCheck className="size-4" />
        Resolve refund approval
      </Button>
    );
  }

  return (
    <div className="mt-4 grid gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
      <p className="text-xs leading-5 text-[var(--ft-text-muted)]">
        A refund-triggering status change (moving a request to failed or cancelled) needs a{" "}
        <strong>second</strong> admin's decision — it can't be the same person who made the status
        change. Paste the approval ID shown when that change was submitted.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
          onChange={(event) => setApprovalId(event.target.value)}
          placeholder="Approval request ID"
          value={approvalId}
        />
        <input
          className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          value={note}
        />
        <Button
          disabled={!approvalId.trim() || pending !== undefined}
          onClick={() => void resolve(true)}
          type="button"
        >
          {pending === "approve" ? "Approving..." : "Approve"}
        </Button>
        <Button
          disabled={!approvalId.trim() || pending !== undefined}
          onClick={() => void resolve(false)}
          type="button"
          variant="danger"
        >
          {pending === "reject" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
      {success ? (
        <div className="rounded-md border border-[var(--ft-green)]/40 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-green)]">
          {success}
        </div>
      ) : null}
      {error ? <AdminErrorNotice message={error} /> : null}
    </div>
  );
}

export default function AdminDigitalAccessRequestsPage() {
  const { error, loading, refresh, requests, source } = useAdminDigitalAccessData();

  return (
    <AdminDigitalAccessShell active="/digital-access/requests/">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search contact, service, request
            </div>
            <Button variant="secondary">
              <Filter className="size-4" />
              Filters
            </Button>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="warning">Pending queue</Badge>
            {process.env.NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE === "true" ? (
              <Badge tone={source === "api" ? "success" : "info"}>
                {source === "api" ? "API data" : "No API data"}
              </Badge>
            ) : null}
          </>
        }
        title="Request management"
      />

      <AdminErrorNotice message={error} />

      <ResolveRefundPanel onChanged={refresh} />

      <section className="mt-6 overflow-hidden rounded-lg border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
        <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_auto] gap-3 border-b border-[var(--ft-border)] p-4 text-xs font-medium text-[var(--ft-text-muted)] uppercase max-lg:hidden">
          <div>Request</div>
          <div>Contact</div>
          <div>Owner</div>
          <div>Status</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {loading ? (
            <QueueMessage label="Loading requests" />
          ) : requests.length === 0 ? (
            <QueueMessage label="No requests yet" />
          ) : (
            requests.map((request) => <RequestRow key={request.id} onChanged={refresh} request={request} />)
          )}
        </div>
      </section>
    </AdminDigitalAccessShell>
  );
}

function QueueMessage({ label }: { label: string }) {
  return <div className="p-4 text-sm text-[var(--ft-text-muted)]">{label}</div>;
}
