"use client";

import { useState } from "react";
import { BadgeCheck, ShieldAlert, XCircle } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

// Mirrors AdAccount (packages/database/prisma/schema.prisma).
type AdAccount = {
  id: string;
  label: string;
  type: "CONNECTED" | "MANAGED" | "DEDICATED";
  platform: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";
  kycTier: "LIGHT" | "STANDARD" | "ENHANCED";
  kycStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  workspaceId: string;
};

const KYC_TONE: Record<AdAccount["kycStatus"], "danger" | "warning" | "success" | "neutral"> = {
  VERIFIED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  UNVERIFIED: "neutral"
};

export default function AdminAdAccountsPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [accountId, setAccountId] = useState("");
  const [account, setAccount] = useState<AdAccount>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [tier, setTier] = useState<AdAccount["kycTier"]>("STANDARD");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"VERIFIED" | "REJECTED">();
  const [success, setSuccess] = useState<string>();

  async function lookup() {
    const id = accountId.trim();
    if (!id) return;
    setLoading(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      setAccount(await apiRequest<AdAccount>(`/ad-accounts/${encodeURIComponent(id)}`));
    } catch (caught) {
      setAccount(undefined);
      setError(caught instanceof Error ? caught.message : "Could not find this ad account.");
    } finally {
      setLoading(false);
    }
  }

  async function review(kycStatus: "VERIFIED" | "REJECTED") {
    if (!account) return;
    setBusy(kycStatus);
    setError(undefined);
    setSuccess(undefined);
    try {
      const updated = await apiRequest<AdAccount>(`/ad-accounts/${encodeURIComponent(account.id)}/kyc`, {
        method: "PATCH",
        body: JSON.stringify({
          kycStatus,
          kycTier: tier,
          ...(reason.trim() ? { reason: reason.trim() } : {})
        })
      });
      setAccount(updated);
      setSuccess(kycStatus === "VERIFIED" ? "Ad account KYC verified." : "Ad account KYC rejected.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this ad account.");
    } finally {
      setBusy(undefined);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Ad accounts auth" />;
  }

  return (
    <AdminShell active="/ad-accounts/">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Ad account KYC review</h1>
        </div>

        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          There's no cross-workspace listing endpoint for ad accounts — look one up by ID (from
          the campaign or workspace it belongs to), then verify or reject its KYC.
        </p>

        <Panel className="mt-5 flex flex-wrap items-end gap-2 p-4">
          <label className="grid flex-1 gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
            Ad account ID
            <input
              className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
              onChange={(event) => setAccountId(event.target.value)}
              value={accountId}
            />
          </label>
          <Button disabled={!accountId.trim() || loading} onClick={() => void lookup()}>
            {loading ? "Looking up..." : "Look up"}
          </Button>
        </Panel>

        {error ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
            {error}
          </div>
        ) : null}

        {account ? (
          <Panel className="mt-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--ft-text-primary)]">{account.label}</span>
              <Badge tone="neutral">{account.type.toLowerCase()}</Badge>
              <Badge tone={KYC_TONE[account.kycStatus]}>{account.kycStatus.toLowerCase()}</Badge>
            </div>
            <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
              {account.platform} · account status {account.status.toLowerCase()} · workspace{" "}
              {account.workspaceId}
            </div>

            {success ? (
              <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-text-primary)]">
                {success}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
              <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
                KYC tier
                <select
                  className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                  onChange={(event) => setTier(event.target.value as AdAccount["kycTier"])}
                  value={tier}
                >
                  <option value="LIGHT">Light</option>
                  <option value="STANDARD">Standard</option>
                  <option value="ENHANCED">Enhanced</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
                Reason (optional)
                <input
                  className="h-10 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
                  onChange={(event) => setReason(event.target.value)}
                  value={reason}
                />
              </label>
              <Button disabled={busy !== undefined} onClick={() => void review("VERIFIED")}>
                <BadgeCheck className="size-4" />
                {busy === "VERIFIED" ? "Saving..." : "Verify"}
              </Button>
              <Button disabled={busy !== undefined} onClick={() => void review("REJECTED")} variant="danger">
                <XCircle className="size-4" />
                {busy === "REJECTED" ? "Saving..." : "Reject"}
              </Button>
            </div>
          </Panel>
        ) : null}
      </div>
    </AdminShell>
  );
}
