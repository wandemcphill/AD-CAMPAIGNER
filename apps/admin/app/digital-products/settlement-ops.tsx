"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Coins, RefreshCcw, ShieldAlert, XCircle } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { apiRequest } from "../lib/api-client";

// Mirrors SettlementAlert / SettlementBeneficiary (packages/database/prisma/schema.prisma).
// Neither type is exported anywhere reusable — these fields are the admin-relevant subset.

type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

type SettlementAlert = {
  id: string;
  settlementInstructionId: string;
  kind: string;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
};

type KycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

type SettlementBeneficiary = {
  id: string;
  workspaceId: string;
  name: string;
  reference: string;
  country: string | null;
  currency: string | null;
  kycTier: "LIGHT" | "STANDARD" | "ENHANCED";
  kycStatus: KycStatus;
  verifiedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
};

const ALERT_TONE: Record<AlertSeverity, "danger" | "warning" | "info"> = {
  CRITICAL: "danger",
  WARNING: "warning",
  INFO: "info"
};

const KYC_TONE: Record<KycStatus, "danger" | "warning" | "success" | "neutral"> = {
  VERIFIED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  UNVERIFIED: "neutral"
};

export function SettlementAlertsTab({ currentUserId }: { currentUserId: string }) {
  const [alerts, setAlerts] = useState<SettlementAlert[]>([]);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const query = showAcknowledged ? "" : "?acknowledged=false";
      setAlerts(await apiRequest<SettlementAlert[]>(`/admin/settlements/alerts${query}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load settlement alerts.");
    } finally {
      setLoading(false);
    }
  }, [showAcknowledged]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function acknowledge(id: string) {
    setBusyId(id);
    setError(undefined);
    try {
      await apiRequest(`/admin/settlements/alerts/${encodeURIComponent(id)}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ userId: currentUserId })
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not acknowledge this alert.");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-[var(--ft-text-secondary)]">
          <input
            checked={showAcknowledged}
            className="size-4 accent-[var(--ft-accent)]"
            onChange={(event) => setShowAcknowledged(event.target.checked)}
            type="checkbox"
          />
          Show acknowledged
        </label>
        <Button onClick={() => void refresh()} variant="secondary">
          <RefreshCcw className="size-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Panel className="p-4 text-sm text-[var(--ft-red)]">{error}</Panel>
      ) : loading ? (
        <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">Loading alerts...</Panel>
      ) : alerts.length === 0 ? (
        <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
          {showAcknowledged ? "No alerts yet." : "No unacknowledged alerts. Ops queue is clear."}
        </Panel>
      ) : (
        alerts.map((alert) => (
          <Panel className="flex items-start gap-4 p-4" key={alert.id}>
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[var(--ft-text-muted)]" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge tone={ALERT_TONE[alert.severity]}>{alert.severity.toLowerCase()}</Badge>
                <span className="text-xs text-[var(--ft-text-muted)]">{alert.kind}</span>
              </div>
              <div className="mt-1 text-sm font-medium text-[var(--ft-text-primary)]">{alert.message}</div>
              <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                Settlement {alert.settlementInstructionId} · {new Date(alert.createdAt).toLocaleString()}
                {alert.acknowledged && alert.acknowledgedAt
                  ? ` · Acknowledged ${new Date(alert.acknowledgedAt).toLocaleString()}`
                  : ""}
              </div>
            </div>
            {!alert.acknowledged ? (
              <Button disabled={busyId !== undefined} onClick={() => void acknowledge(alert.id)}>
                <BadgeCheck className="size-4" />
                {busyId === alert.id ? "Saving..." : "Acknowledge"}
              </Button>
            ) : (
              <Badge tone="neutral">Acknowledged</Badge>
            )}
          </Panel>
        ))
      )}
    </div>
  );
}

export function SettlementBeneficiariesTab({ currentUserId }: { currentUserId: string }) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<SettlementBeneficiary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [rejectingId, setRejectingId] = useState<string>();
  const [rejectReason, setRejectReason] = useState("");

  async function search() {
    const id = workspaceId.trim();
    if (!id) return;
    setLoading(true);
    setError(undefined);
    try {
      setBeneficiaries(
        await apiRequest<SettlementBeneficiary[]>(
          `/admin/settlements/beneficiaries?workspaceId=${encodeURIComponent(id)}`
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load beneficiaries.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(id: string) {
    setBusyId(id);
    setError(undefined);
    try {
      await apiRequest(`/admin/settlements/beneficiaries/${encodeURIComponent(id)}/verify`, {
        method: "POST",
        body: JSON.stringify({ verifiedByUserId: currentUserId })
      });
      await search();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify this beneficiary.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function reject(id: string) {
    const reason = rejectReason.trim();
    if (!reason) return;
    setBusyId(id);
    setError(undefined);
    try {
      await apiRequest(`/admin/settlements/beneficiaries/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectedByUserId: currentUserId, reason })
      });
      setRejectingId(undefined);
      setRejectReason("");
      await search();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reject this beneficiary.");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <Panel className="flex flex-wrap items-end gap-2 p-3">
        <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
          Workspace ID
          <input
            className="h-9 w-72 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
            onChange={(event) => setWorkspaceId(event.target.value)}
            placeholder="workspace_..."
            value={workspaceId}
          />
        </label>
        <Button disabled={!workspaceId.trim() || loading} onClick={() => void search()}>
          {loading ? "Searching..." : "Search"}
        </Button>
        <p className="w-full text-xs text-[var(--ft-text-muted)]">
          Beneficiaries are looked up per workspace — there's no cross-workspace listing endpoint.
        </p>
      </Panel>

      {error ? <Panel className="p-4 text-sm text-[var(--ft-red)]">{error}</Panel> : null}

      {beneficiaries.length === 0 && !loading ? (
        <Panel className="p-6 text-sm text-[var(--ft-text-muted)]">
          {workspaceId.trim() ? "No beneficiaries found for this workspace." : "Search a workspace to begin."}
        </Panel>
      ) : (
        beneficiaries.map((beneficiary) => (
          <Panel className="p-4" key={beneficiary.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--ft-text-primary)]">{beneficiary.name}</span>
                  <Badge tone={KYC_TONE[beneficiary.kycStatus]}>{beneficiary.kycStatus.toLowerCase()}</Badge>
                  <Badge tone="neutral">{beneficiary.kycTier.toLowerCase()}</Badge>
                </div>
                <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                  {beneficiary.reference} · {beneficiary.country ?? "—"} · {beneficiary.currency ?? "—"}
                </div>
                {beneficiary.rejectedReason ? (
                  <div className="mt-1 flex items-center gap-1 text-xs text-[var(--ft-red)]">
                    <XCircle className="size-3.5" />
                    {beneficiary.rejectedReason}
                  </div>
                ) : null}
              </div>
              {beneficiary.kycStatus === "PENDING" || beneficiary.kycStatus === "UNVERIFIED" ? (
                <div className="flex shrink-0 gap-2">
                  <Button disabled={busyId !== undefined} onClick={() => void verify(beneficiary.id)}>
                    <BadgeCheck className="size-4" />
                    Verify
                  </Button>
                  <Button
                    disabled={busyId !== undefined}
                    onClick={() => setRejectingId(beneficiary.id)}
                    variant="danger"
                  >
                    <AlertTriangle className="size-4" />
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
            {rejectingId === beneficiary.id ? (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                <label className="grid flex-1 gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
                  Rejection reason
                  <input
                    className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm text-[var(--ft-text-primary)]"
                    onChange={(event) => setRejectReason(event.target.value)}
                    value={rejectReason}
                  />
                </label>
                <Button
                  disabled={!rejectReason.trim() || busyId !== undefined}
                  onClick={() => void reject(beneficiary.id)}
                  variant="danger"
                >
                  Confirm reject
                </Button>
                <Button onClick={() => setRejectingId(undefined)} variant="secondary">
                  Cancel
                </Button>
              </div>
            ) : null}
          </Panel>
        ))
      )}
    </div>
  );
}

// Mirrors FxQuoteResponseDto / SettlementInstruction — internal ops surface
// for the v1/fx + v1/settlements subsystem. It has no live client consumer
// (the actual remittance flow in financial-products.service.ts builds its own
// provider adapters instead), and neither controller does workspace-ownership
// checks on the resources it acts on — both are now gated admin:access rather
// than exposed to workspace users. See settlement.controller.ts's note.
type FxQuote = {
  quoteId: string;
  baseCurrency: string;
  quoteCurrency: string;
  sourceAmountMinor: number;
  resultAmountMinor: number;
  spreadBps: number;
  expiresAt: string;
  status: string;
};

type SettlementInstruction = {
  id: string;
  status: string;
  destinationAmountMinor: number;
  providerReference?: string | null;
  errorReason?: string | null;
};

export function FxSettlementOpsTab() {
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("NGN");
  const [sourceAmount, setSourceAmount] = useState("");
  const [quote, setQuote] = useState<FxQuote>();
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string>();

  const [workspaceId, setWorkspaceId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [beneficiaryReference, setBeneficiaryReference] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [instruction, setInstruction] = useState<SettlementInstruction>();

  const [lookupId, setLookupId] = useState("");
  const [actionBusy, setActionBusy] = useState<"poll" | "reconcile">();
  const [actionError, setActionError] = useState<string>();

  async function createQuote() {
    const amountMinor = Math.round(Number(sourceAmount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setQuoteError("Enter a source amount.");
      return;
    }
    setQuoting(true);
    setQuoteError(undefined);
    try {
      const result = await apiRequest<FxQuote>("/v1/fx/quotes", {
        method: "POST",
        body: JSON.stringify({ baseCurrency, quoteCurrency, sourceAmountMinor: amountMinor })
      });
      setQuote(result);
    } catch (caught) {
      setQuoteError(caught instanceof Error ? caught.message : "Could not create this quote.");
    } finally {
      setQuoting(false);
    }
  }

  async function createInstruction() {
    if (!quote || !workspaceId.trim() || !partnerId.trim() || !transactionId.trim() || !beneficiaryReference.trim()) {
      setCreateError("Create a quote first, then fill in every field.");
      return;
    }
    setCreating(true);
    setCreateError(undefined);
    try {
      const result = await apiRequest<SettlementInstruction>("/v1/settlements", {
        method: "POST",
        body: JSON.stringify({
          quoteId: quote.quoteId,
          instruction: {
            workspaceId: workspaceId.trim(),
            partnerId: partnerId.trim(),
            transactionId: transactionId.trim(),
            destinationAmountMinor: quote.resultAmountMinor,
            beneficiaryReference: beneficiaryReference.trim()
          }
        })
      });
      setInstruction(result);
      setLookupId(result.id);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Could not create this settlement instruction.");
    } finally {
      setCreating(false);
    }
  }

  async function runAction(action: "poll" | "reconcile") {
    const id = lookupId.trim();
    if (!id) return;
    setActionBusy(action);
    setActionError(undefined);
    try {
      const result = await apiRequest<SettlementInstruction>(`/v1/settlements/${encodeURIComponent(id)}/${action}`, {
        method: "POST"
      });
      setInstruction(result);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : `Could not ${action} this settlement.`);
    } finally {
      setActionBusy(undefined);
    }
  }

  return (
    <div className="mt-4 grid gap-4">
      <Panel className="p-4">
        <div className="flex items-center gap-2">
          <Coins className="size-5 text-[var(--ft-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">1. Create FX quote</h3>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())}
            placeholder="From (USD)"
            value={baseCurrency}
          />
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            onChange={(event) => setQuoteCurrency(event.target.value.toUpperCase())}
            placeholder="To (NGN)"
            value={quoteCurrency}
          />
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            inputMode="decimal"
            onChange={(event) => setSourceAmount(event.target.value)}
            placeholder="Source amount"
            value={sourceAmount}
          />
          <Button disabled={quoting} onClick={() => void createQuote()}>
            {quoting ? "Quoting..." : "Get quote"}
          </Button>
        </div>
        {quoteError ? <p className="mt-2 text-sm text-[var(--ft-red)]">{quoteError}</p> : null}
        {quote ? (
          <div className="mt-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs">
            <code className="font-mono">{quote.quoteId}</code> — {(quote.sourceAmountMinor / 100).toLocaleString()}{" "}
            {quote.baseCurrency} → {(quote.resultAmountMinor / 100).toLocaleString()} {quote.quoteCurrency} (
            {quote.spreadBps}bps spread, expires {new Date(quote.expiresAt).toLocaleTimeString()})
          </div>
        ) : null}
      </Panel>

      <Panel className="p-4">
        <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">2. Create settlement instruction</h3>
        <p className="mt-1 text-xs text-[var(--ft-text-muted)]">Requires a quote from step 1.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            onChange={(event) => setWorkspaceId(event.target.value)}
            placeholder="Workspace ID"
            value={workspaceId}
          />
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            onChange={(event) => setPartnerId(event.target.value)}
            placeholder="Partner ID"
            value={partnerId}
          />
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            onChange={(event) => setTransactionId(event.target.value)}
            placeholder="Transaction ID"
            value={transactionId}
          />
          <input
            className="h-9 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            onChange={(event) => setBeneficiaryReference(event.target.value)}
            placeholder="Beneficiary reference (account/email)"
            value={beneficiaryReference}
          />
        </div>
        <Button className="mt-3" disabled={!quote || creating} onClick={() => void createInstruction()}>
          {creating ? "Creating..." : "Create instruction"}
        </Button>
        {createError ? <p className="mt-2 text-sm text-[var(--ft-red)]">{createError}</p> : null}
      </Panel>

      <Panel className="p-4">
        <h3 className="text-sm font-semibold text-[var(--ft-text-primary)]">3. Poll or reconcile</h3>
        <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
          For submitting an instruction to the provider, use the Retry action on the Settlements tab —
          it calls the same submit path.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            className="h-9 flex-1 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-sm"
            onChange={(event) => setLookupId(event.target.value)}
            placeholder="Settlement instruction ID"
            value={lookupId}
          />
          <Button disabled={!lookupId.trim() || actionBusy !== undefined} onClick={() => void runAction("poll")} variant="secondary">
            <RefreshCcw className="size-4" />
            {actionBusy === "poll" ? "Polling..." : "Poll status"}
          </Button>
          <Button
            disabled={!lookupId.trim() || actionBusy !== undefined}
            onClick={() => void runAction("reconcile")}
            variant="secondary"
          >
            {actionBusy === "reconcile" ? "Reconciling..." : "Reconcile"}
          </Button>
        </div>
        {actionError ? <p className="mt-2 text-sm text-[var(--ft-red)]">{actionError}</p> : null}
        {instruction ? (
          <div className="mt-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs">
            <code className="font-mono">{instruction.id}</code> — status {instruction.status}
            {instruction.providerReference ? ` · ref ${instruction.providerReference}` : ""}
            {instruction.errorReason ? ` · ${instruction.errorReason}` : ""}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
