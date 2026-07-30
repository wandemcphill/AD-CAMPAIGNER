"use client";

import { CreditCard, Download, Plus, Wallet } from "lucide-react";

import { Button } from "@fliptrybe/ui";
import { Divider } from "@fliptrybe/ui/components";

const TRANSACTIONS = [
  { id: "1", label: "Wallet top-up", amount: "+₦50,000", date: "Jul 29, 2025", type: "credit" },
  { id: "2", label: "Campaign hold — ORD-001847", amount: "-₦5,000", date: "Jul 29, 2025", type: "debit" },
  { id: "3", label: "Wallet top-up", amount: "+₦120,000", date: "Jul 28, 2025", type: "credit" },
  { id: "4", label: "Growth service — Data bundle", amount: "-₦4,500", date: "Jul 28, 2025", type: "debit" },
  { id: "5", label: "Refund — ORD-001851", amount: "+₦2,500", date: "Jul 27, 2025", type: "credit" },
];

export default function WalletSettingsPage() {
  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Wallet</h2>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--ft-accent)]/30 bg-[var(--ft-accent)]/5 p-5">
            <div className="text-xs text-[var(--ft-text-muted)]">Available balance</div>
            <div className="mt-1 text-3xl font-bold text-[var(--ft-accent)]">₦163,000</div>
            <div className="mt-2 flex items-center gap-3 text-xs text-[var(--ft-text-muted)]">
              <span>Hold: ₦5,000</span>
              <span>Total: ₦168,000</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button><Plus className="size-4" /> Add funds</Button>
            <Button variant="secondary"><Download className="size-4" /> Export</Button>
          </div>
        </div>

        <Divider label="recent transactions" />

        <div className="divide-y divide-[var(--ft-border)]">
          {TRANSACTIONS.map((tx) => (
            <div className="flex items-center justify-between py-3" key={tx.id}>
              <div className="flex items-center gap-3">
                <div className="grid size-8 place-items-center rounded-full bg-[var(--ft-bg-muted)]">
                  <CreditCard className="size-4 text-[var(--ft-text-muted)]" />
                </div>
                <div>
                  <div className="text-sm font-medium">{tx.label}</div>
                  <div className="text-xs text-[var(--ft-text-muted)]">{tx.date}</div>
                </div>
              </div>
              <span className={`font-mono text-sm font-medium ${tx.type === "credit" ? "text-[var(--ft-green)]" : "text-[var(--ft-text-primary)]"}`}>
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
