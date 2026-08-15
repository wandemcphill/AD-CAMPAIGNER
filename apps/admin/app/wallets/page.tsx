"use client";

import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminShell } from "../admin-shell";
import { apiRequest } from "../lib/api-client";
import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";

type Money = { amountMinor: number; currency: string };

type LedgerRow = {
  id: string;
  kind: "CREDIT" | "DEBIT" | "HOLD" | "RELEASE" | "REVERSAL";
  amount: Money;
  description: string;
  reference: string;
  createdAt: string;
};

type WalletView = {
  workspace: { id: string; name: string };
  wallets: Array<{
    id: string;
    currency: string;
    availableBalance: Money;
    recentEntries: LedgerRow[];
  }>;
};

type Direction = "CREDIT" | "DEBIT";

function formatMoney(money: Money) {
  return new Intl.NumberFormat("en-NG", {
    currency: money.currency,
    style: "currency"
  }).format(money.amountMinor / 100);
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminWalletsPage() {
  const { error: sessionError, loading: sessionLoading, session } = useApiSession();
  const [workspaceId, setWorkspaceId] = useState("");
  const [view, setView] = useState<WalletView>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const [direction, setDirection] = useState<Direction>("CREDIT");
  const [amountMajor, setAmountMajor] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function lookup(id = workspaceId) {
    const target = id.trim();
    if (!target) return;
    setLoading(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      setView(await apiRequest<WalletView>(`/admin/wallets/${encodeURIComponent(target)}`));
    } catch (caught) {
      setView(undefined);
      setError(caught instanceof Error ? caught.message : "Could not load this workspace's wallet.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAdjustment() {
    if (!view) return;

    const major = Number(amountMajor);
    if (!Number.isFinite(major) || major <= 0) {
      setError("Enter a positive amount.");
      return;
    }

    const amountMinor = Math.round(major * 100);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setError("Amount resolves to an invalid minor-unit value.");
      return;
    }

    if (reason.trim().length < 3) {
      setError("Give a reason — it is written to the ledger and the audit log.");
      return;
    }

    const verb = direction === "CREDIT" ? "Credit" : "Debit";
    if (
      !window.confirm(
        `${verb} ${formatMoney({ amountMinor, currency: "NGN" })} ` +
          `${direction === "CREDIT" ? "to" : "from"} ${view.workspace.name}?\n\n` +
          "This writes a real ledger entry and cannot be edited — only offset by a further adjustment."
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      await apiRequest(`/admin/wallets/${encodeURIComponent(view.workspace.id)}/adjustments`, {
        method: "POST",
        body: JSON.stringify({
          direction,
          amountMinor,
          reason: reason.trim(),
          // Scopes the retry window to this exact adjustment, so a double-submit
          // or a network retry cannot post the amount twice.
          idempotencyKey: `admin_adj:${view.workspace.id}:${direction}:${amountMinor}:${reason.trim()}`
        })
      });
      setSuccess(`${verb} of ${formatMoney({ amountMinor, currency: "NGN" })} posted.`);
      setAmountMajor("");
      setReason("");
      await lookup(view.workspace.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post this adjustment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionLoading || !session?.isPlatformAdmin) {
    return <AdminAuthState error={sessionError} loading={sessionLoading} title="Wallets auth" />;
  }

  return (
    <AdminShell active="/wallets/">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Wallets</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Look up a workspace wallet and post a correction. Every adjustment is a ledger entry
          attributed to you.
        </p>

        <Panel className="mt-5 grid gap-3 p-4">
          <label className="text-sm font-medium" htmlFor="workspace-id">
            Workspace ID
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-64 flex-1 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 py-2 font-mono text-sm"
              id="workspace-id"
              onChange={(event) => setWorkspaceId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void lookup();
              }}
              placeholder="ws_..."
              value={workspaceId}
            />
            <Button disabled={loading || !workspaceId.trim()} onClick={() => void lookup()}>
              {loading ? "Loading..." : "Look up"}
            </Button>
          </div>
        </Panel>

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

        {view ? (
          <>
            <Panel className="mt-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{view.workspace.name}</div>
                  <div className="font-mono text-xs text-[var(--ft-text-muted)]">
                    {view.workspace.id}
                  </div>
                </div>
              </div>

              {view.wallets.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--ft-text-secondary)]">
                  No wallet exists yet. Posting a credit will create one.
                </p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {view.wallets.map((wallet) => (
                    <div
                      className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] p-3"
                      key={wallet.id}
                    >
                      <div className="flex items-center justify-between">
                        <Badge tone="info">{wallet.currency}</Badge>
                        <span className="font-mono text-lg font-semibold">
                          {formatMoney(wallet.availableBalance)}
                        </span>
                      </div>
                      {wallet.recentEntries.length > 0 ? (
                        <div className="mt-3 grid gap-1">
                          {wallet.recentEntries.slice(0, 8).map((entry) => (
                            <div
                              className="flex items-center justify-between gap-3 border-t border-[var(--ft-border)] pt-1 text-xs"
                              key={entry.id}
                            >
                              <span className="text-[var(--ft-text-secondary)]">
                                {entry.description || entry.kind}
                              </span>
                              <span className="shrink-0 font-mono text-[var(--ft-text-muted)]">
                                {entry.kind} · {formatMoney(entry.amount)} ·{" "}
                                {formatWhen(entry.createdAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="mt-4 grid gap-3 p-4">
              <div className="font-semibold">Post an adjustment</div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setDirection("CREDIT")}
                  variant={direction === "CREDIT" ? "primary" : "secondary"}
                >
                  <ArrowUpCircle className="size-4" />
                  Credit
                </Button>
                <Button
                  onClick={() => setDirection("DEBIT")}
                  variant={direction === "DEBIT" ? "primary" : "secondary"}
                >
                  <ArrowDownCircle className="size-4" />
                  Debit
                </Button>
              </div>

              <label className="text-sm font-medium" htmlFor="adj-amount">
                Amount (major units, e.g. 1500.00)
              </label>
              <input
                className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 py-2 font-mono text-sm"
                id="adj-amount"
                inputMode="decimal"
                onChange={(event) => setAmountMajor(event.target.value)}
                placeholder="0.00"
                value={amountMajor}
              />

              <label className="text-sm font-medium" htmlFor="adj-reason">
                Reason (written to the ledger and audit log)
              </label>
              <input
                className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 py-2 text-sm"
                id="adj-reason"
                onChange={(event) => setReason(event.target.value)}
                placeholder="Goodwill credit for order that failed after charge"
                value={reason}
              />

              <div>
                <Button disabled={submitting} onClick={() => void submitAdjustment()}>
                  {submitting ? "Posting..." : `Post ${direction.toLowerCase()}`}
                </Button>
              </div>

              <p className="text-xs text-[var(--ft-text-muted)]">
                A debit cannot take the wallet below its available balance. Adjustments are never
                edited or deleted — correct one by posting its opposite.
              </p>
            </Panel>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
