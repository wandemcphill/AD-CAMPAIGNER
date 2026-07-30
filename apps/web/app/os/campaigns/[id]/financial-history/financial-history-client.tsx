"use client";

import { ArrowLeft, RefreshCw, ReceiptText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge, Button, Panel, SummaryStatStrip } from "@fliptrybe/ui";
import type { CampaignBudgetSummary, CampaignLedgerEntry } from "@fliptrybe/types";

import { formatCampaignMoney, formatDateTime, loadCampaignFinancialData } from "../../../../campaigns/api";
import {
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
  linkButtonClass,
  secondaryLinkButtonClass
} from "../../../../campaigns/components";

type HistoryState = {
  budgetSummary: CampaignBudgetSummary | null;
  error?: string;
  ledger: CampaignLedgerEntry[];
  loading: boolean;
};

const defaultHistoryState: HistoryState = {
  budgetSummary: null,
  ledger: [],
  loading: true
};

function actionLabel(entry: CampaignLedgerEntry) {
  return entry.description || entry.category || entry.type.replaceAll("_", " ");
}

function operatorLabel(entry: CampaignLedgerEntry) {
  return entry.operator ?? entry.actorUserId ?? "System";
}

function signedAmount(entry: CampaignLedgerEntry) {
  const prefix = entry.direction === "CREDIT" || entry.direction === "RELEASE" ? "+" : "-";

  return `${prefix}${formatCampaignMoney(entry.amount)}`;
}

function amountTone(entry: CampaignLedgerEntry) {
  return entry.direction === "CREDIT" || entry.direction === "RELEASE"
    ? "text-emerald-700"
    : "text-[var(--ft-text-primary)]";
}

export function CampaignFinancialHistoryClient({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<HistoryState>(defaultHistoryState);

  const refresh = useCallback(async () => {
    setState((current) => ({
      budgetSummary: current.budgetSummary,
      ledger: current.ledger,
      loading: true
    }));
    try {
      const data = await loadCampaignFinancialData(campaignId);
      setState({
        budgetSummary: data.budgetSummary,
        ledger: data.ledger,
        loading: false
      });
    } catch {
      setState((current) => ({
        ...current,
        error: "Financial history is unavailable right now.",
        loading: false
      }));
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={state.loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <a className={secondaryLinkButtonClass} href={`/os/campaigns/${campaignId}`}>
              <ArrowLeft className="size-4" />
              Back
            </a>
          </div>
        }
        eyebrow={<Badge tone="info">Campaign ledger</Badge>}
        title="Financial history"
      />

      <ErrorNotice message={state.error} />

      <section className="mt-6 grid gap-5">
        {state.budgetSummary ? (
          <Panel className="overflow-hidden">
            <div className="border-b border-[var(--ft-border)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                    Ledger summary
                  </div>
                  <h2 className="mt-1 text-lg font-medium text-[var(--ft-text-primary)]">
                    Campaign spend transparency
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                    Budget movement, allocation, and remaining balance for this campaign.
                  </p>
                </div>
                <Badge tone="info">Updated {formatDateTime(state.budgetSummary.updatedAt)}</Badge>
              </div>
            </div>
            <div className="p-4">
              <SummaryStatStrip
                items={[
                  { label: "total budget", value: formatCampaignMoney(state.budgetSummary.totalBudget) },
                  { label: "funds used", value: formatCampaignMoney(state.budgetSummary.fundsUsed) },
                  { label: "remaining", value: formatCampaignMoney(state.budgetSummary.remainingBalance) },
                  { label: "pending", value: formatCampaignMoney(state.budgetSummary.pendingSpend) }
                ]}
              />
            </div>
          </Panel>
        ) : null}

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--ft-border)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Ledger entries</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  {state.loading ? "Loading entries..." : `${state.ledger.length} entries`}
                </p>
              </div>
              <ReceiptText className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
            </div>
          </div>

          {state.loading ? (
            <div className="p-5">
              <LoadingBlock label="Loading financial history" />
            </div>
          ) : state.ledger.length === 0 ? (
            <div className="p-5">
              <EmptyState
                action={
                  <a className={linkButtonClass} href={`/os/campaigns/${campaignId}`}>
                    Back to campaign
                  </a>
                }
                copy="No wallet funding, invoice payment, budget allocation, spend, refund, or adjustment has been recorded yet."
                icon={ReceiptText}
                title="No financial entries"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--ft-border)] text-left text-sm">
                <thead className="bg-[var(--ft-bg-muted)]">
                  <tr className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Operator</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
                  {state.ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--ft-text-secondary)]">
                        {formatDateTime(entry.occurredAt)}
                      </td>
                      <td className="min-w-[220px] px-4 py-4 text-[var(--ft-text-primary)]">{actionLabel(entry)}</td>
                      <td className={`whitespace-nowrap px-4 py-4 font-mono ${amountTone(entry)}`}>
                        {signedAmount(entry)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--ft-text-secondary)]">{entry.category}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-[var(--ft-text-secondary)]">
                        {operatorLabel(entry)}
                      </td>
                      <td className="min-w-[240px] px-4 py-4 text-[var(--ft-text-secondary)]">
                        {entry.notes ?? entry.sourceType ?? "Recorded"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}
