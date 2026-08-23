"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CreditCard,
  FileText,
  Link2,
  Receipt,
  Send,
  Ticket,
  Wallet,
  type LucideIcon
} from "lucide-react";

import { Badge, ValueSkeleton, humanizeStatus } from "@fliptrybe/ui";

import { formatCampaignMoney, formatDateTime } from "../../campaigns/api";
import { EmptyState, LoadingBlock } from "../../campaigns/components";
import { useBillingData } from "../../campaigns/use-campaign-dashboard-data";
import { useFeatureFlags } from "../../lib/feature-flags";

type MoneyEntry = {
  label: string;
  description: string;
  href: Route;
  icon: LucideIcon;
  flag?: string;
};

// Entry points into the Money domain. Flag-gated tools only appear when the
// vertical is switched on for this workspace (matches the shell sidebar gating).
const ENTRIES: MoneyEntry[] = [
  { label: "Wallet", description: "Balance, funding & payouts", href: "/os/wallet", icon: Wallet },
  { label: "Invoices", description: "Bill customers and track payments", href: "/os/money/invoices", icon: FileText, flag: "invoicing" },
  { label: "Payment Links", description: "Collect payments with a shareable link", href: "/os/money/payment-links", icon: Link2, flag: "paymentLinks" },
  { label: "Virtual Accounts", description: "Collect payments to dedicated accounts", href: "/os/financial-products/accounts", icon: Building2, flag: "virtualAccounts" },
  { label: "Virtual Cards", description: "Issue and manage spending cards", href: "/os/financial-products/cards", icon: CreditCard, flag: "virtualCards" },
  { label: "Transfers", description: "Send money locally and abroad", href: "/os/financial-products/remittance", icon: Send, flag: "remittance" },
  // Transactions and Payouts don't have routes of their own — they're surfaces of
  // the wallet page, deep-linked via ?tab=. Payouts stays hidden until
  // walletWithdrawals is on, matching the tab's own gating.
  { label: "Transactions", description: "Every movement on your ledger", href: "/os/wallet?tab=history", icon: Receipt },
  { label: "Payouts", description: "Withdraw to your bank account", href: "/os/wallet?tab=withdraw", icon: Banknote, flag: "walletWithdrawals" },
  { label: "Vouchers", description: "Buy and redeem value vouchers", href: "/os/vouchers", icon: Ticket }
];

// A leading "+" means money in, "-" means money out. Colour and icon follow suit.
function isCredit(amount: string) {
  return amount.trim().startsWith("+");
}

export default function MoneyOverviewPage() {
  const { activity, loading, wallet } = useBillingData();
  const { flags, ready: flagsReady } = useFeatureFlags();

  const availableBalance = wallet?.availableBalance ?? null;
  const heldBalance = wallet?.heldBalance ?? null;
  const fallbackCurrency = availableBalance?.currency ?? "NGN";

  const visibleEntries = ENTRIES.filter(
    (entry) => !entry.flag || (flagsReady && flags[entry.flag] === true)
  );
  const recentActivity = activity.slice(0, 6);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Money</h1>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Your balances, accounts, cards and transfers in one place.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Balance overview */}
        <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-gradient-to-br from-[var(--ft-bg-raised)] to-[var(--ft-bg-surface)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-2 text-xs text-[var(--ft-text-muted)]">
            <Wallet className="size-4 text-[var(--ft-accent)]" />
            Available balance
          </div>
          <div className="mt-2 font-mono text-3xl font-bold">
            {loading ? <ValueSkeleton width="w-24" /> : availableBalance ? formatCampaignMoney(availableBalance) : "—"}
          </div>
          <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
            {loading
              ? ""
              : `${formatCampaignMoney(heldBalance ?? { amountMinor: 0, currency: fallbackCurrency })} held for active campaigns`}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--ft-accent)] px-4 text-sm font-medium text-[var(--ft-text-inverse)] transition hover:opacity-90"
              href="/os/wallet"
            >
              <ArrowDownLeft className="size-4" /> Deposit
            </Link>
            <Link
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-4 text-sm font-medium text-[var(--ft-text-secondary)] transition hover:text-[var(--ft-text-primary)]"
              href="/os/wallet"
            >
              <ArrowUpRight className="size-4" /> Withdraw
            </Link>
          </div>
          <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[var(--ft-accent)]/5 blur-3xl" />
        </section>

        {/* Money tools */}
        <section>
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">Tools</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleEntries.map((entry) => (
              <Link
                className="group flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 transition hover:border-[var(--ft-accent)]/30 hover:shadow-[var(--shadow-md)]"
                href={entry.href}
                key={entry.href}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]">
                  <entry.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold group-hover:text-[var(--ft-accent)]">{entry.label}</div>
                  <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">{entry.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Recent transactions */}
      <section className="mt-6 rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent transactions</h2>
          <Link className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ft-accent)]" href="/os/wallet">
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="mt-4">
          {loading ? (
            <LoadingBlock label="Loading transactions" />
          ) : recentActivity.length === 0 ? (
            <EmptyState copy="Fund your wallet or make a payment to see activity here." title="No transactions yet" />
          ) : (
            <div className="grid gap-1.5">
              {recentActivity.map((item) => {
                const credit = isCredit(item.amount);
                return (
                  <div
                    className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                    key={item.id}
                  >
                    <div
                      className={
                        credit
                          ? "grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ft-green)]/10 text-[var(--ft-green)]"
                          : "grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]"
                      }
                    >
                      {credit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.label}</div>
                      <div className="text-[11px] text-[var(--ft-text-muted)]">{formatDateTime(item.at)}</div>
                    </div>
                    <div className="text-right">
                      <div className={credit ? "font-mono text-sm text-[var(--ft-green)]" : "font-mono text-sm"}>{item.amount}</div>
                      <Badge tone="neutral">{humanizeStatus(item.status)}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
