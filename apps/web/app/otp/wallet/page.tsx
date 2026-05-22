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
          label="Active debits"
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
          <WalletCards className="size-5 text-zinc-950" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">Funding rails</h2>
          <div className="mt-4 grid gap-3">
            {[
              { icon: CreditCard, label: "Card", detail: "Instant funding" },
              { icon: Banknote, label: "Bank transfer", detail: "Manual reference" }
            ].map((rail) => (
              <div
                className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                key={rail.label}
              >
                <rail.icon className="size-4 text-zinc-700" />
                <div>
                  <div className="text-sm font-semibold text-zinc-950">{rail.label}</div>
                  <div className="text-sm text-zinc-500">{rail.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-lg font-semibold text-zinc-950">Ledger</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {walletLedger.map((entry) => (
              <div
                className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                key={`${entry.label}-${entry.at}`}
              >
                <div>
                  <div className="font-medium text-zinc-950">{entry.label}</div>
                  <div className="text-sm text-zinc-500">
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
                <div className="text-sm font-semibold text-zinc-950">{entry.amount}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </OtpShell>
  );
}
