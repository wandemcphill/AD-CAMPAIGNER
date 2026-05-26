import { Banknote, CreditCard, Plus, WalletCards } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { OtpShell, PageHeader } from "../components";
import { walletLedger } from "../data";

export default function OtpWalletPage() {
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

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Available"
          value="NGN 248,900"
          detail="Ready for purchases"
          tone="success"
        />
        <MetricCard
          label="Live debits"
          value="NGN 1,300"
          detail="Refund-safe OTP orders"
          tone="warning"
        />
        <MetricCard
          label="Spent today"
          value="NGN 18,460"
          detail="54 completed orders"
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
            {walletLedger.map((entry) => (
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
            ))}
          </div>
        </Panel>
      </div>
    </OtpShell>
  );
}
