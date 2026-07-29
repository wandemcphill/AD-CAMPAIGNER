"use client";

import { Banknote, CreditCard, Plus, WalletCards } from "lucide-react";

import { Badge, Button, MetricCard, Panel, SummaryStatStrip } from "@fliptrybe/ui";

import { EmptyState, OtpShell, PageHeader } from "../components";
import { useOtpDashboard } from "../use-otp-dashboard";

export default function OtpWalletPage() {
  const { data, isLoading } = useOtpDashboard();
  const wallet = data?.wallet;
  const walletLedger = data?.walletLedger ?? [];

  return (
    <OtpShell active="/otp/wallet">
      <PageHeader
        eyebrow={<Badge tone="success">Ledger reconciled</Badge>}
        title="OTP wallet"
        action={
          <Button>
            <Plus className="size-4" /> Add funds
          </Button>
        }
      />

      <section className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_36%),linear-gradient(180deg,var(--ft-bg-surface),var(--ft-bg-muted))] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-base)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ft-text-muted)]">
              OTP wallet
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-3xl">
              Funding, holds, and ledger movement stay visible while orders run.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              This keeps the marketplace feeling like part of the same commerce system rather than a side utility.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SummaryStatStrip
          items={[
            { label: "available", value: wallet?.available ?? "Loading" },
            { label: "held", value: wallet?.held ?? "Loading" },
            { label: "spent today", value: wallet?.spentToday ?? "Loading" }
          ]}
        />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Available"
          value={wallet?.available ?? "Loading"}
          detail="Ready for purchases"
          tone="success"
        />
        <MetricCard
          label="Live debits"
          value={wallet?.held ?? "Loading"}
          detail="Refund-safe OTP orders"
          tone="warning"
        />
        <MetricCard
          label="Spent today"
          value={wallet?.spentToday ?? "Loading"}
          detail="From current API ledger"
          tone="info"
        />
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Panel className="p-4">
          <WalletCards className="size-5 text-[var(--ft-text-primary)]" />
          <h2 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">
            Funding rails
          </h2>
          <div className="mt-4 grid gap-3">
            {[
              { icon: CreditCard, label: "Card", detail: "Instant funding" },
              { icon: Banknote, label: "Bank transfer", detail: "Manual reference" }
            ].map((rail) => (
              <div
                className="flex items-center gap-3 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3"
                key={rail.label}
              >
                <rail.icon className="size-4 text-[var(--ft-text-secondary)]" />
                <div>
                  <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                    {rail.label}
                  </div>
                  <div className="text-sm text-[var(--ft-text-muted)]">{rail.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--ft-border)] p-4">
            <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Ledger</h2>
          </div>
          <div className="hidden grid-cols-[1fr_auto_auto] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase sm:grid">
            <div>Movement</div>
            <div>Status</div>
            <div>Amount</div>
          </div>
          <div className="divide-y divide-[var(--ft-border)]">
            {isLoading ? (
              <EmptyState
                title="Loading wallet ledger"
                detail="Reconciling wallet balance and recent OTP charges."
              />
            ) : walletLedger.length === 0 ? (
              <EmptyState
                title="No OTP wallet movements"
                detail="Purchases, provider holds, and refunds will appear here after the first live order."
              />
            ) : (
              walletLedger.map((entry) => (
                <div
                  className="grid gap-3 p-4 transition hover:bg-[var(--ft-bg-raised)] sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  key={`${entry.label}-${entry.at}`}
                >
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">{entry.label}</div>
                    <div className="text-sm text-[var(--ft-text-muted)]">
                      {entry.rail} at {entry.at}
                    </div>
                  </div>
                  <Badge
                    tone={
                      entry.status === "COMPLETED"
                        ? "success"
                        : entry.status === "WAITING"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {entry.status}
                  </Badge>
                  <div className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
                    {entry.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </OtpShell>
  );
}
