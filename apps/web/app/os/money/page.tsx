"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, Building2, CreditCard, FileText, Link2, Receipt, Send, Ticket, Wallet, type LucideIcon } from "lucide-react";
import { Badge, ValueSkeleton, humanizeStatus } from "@fliptrybe/ui";
import { formatCampaignMoney, formatDateTime } from "../../campaigns/api";
import { EmptyState, LoadingBlock } from "../../campaigns/components";
import { useBillingData } from "../../campaigns/use-campaign-dashboard-data";
import { useFeatureFlags } from "../../lib/feature-flags";

type MoneyEntry = { label: string; description: string; href: Route; icon: LucideIcon; flag?: string };
const ENTRIES: MoneyEntry[] = [
  { label: "Wallet", description: "Balance, funding & payouts", href: "/os/wallet", icon: Wallet },
  { label: "USDT & USDC", description: "Buy and sell supported stablecoins", href: "/os/financial-products", icon: CircleDollarSign },
  { label: "Global transfers", description: "Supported international money corridors", href: "/os/financial-products/remittance", icon: Globe2, flag: "remittance" },
  { label: "Invoices", description: "Bill customers and track payments", href: "/os/money/invoices", icon: FileText, flag: "invoicing" },
  { label: "Payment Links", description: "Collect payments with a shareable link", href: "/os/money/payment-links", icon: Link2, flag: "paymentLinks" },
  { label: "Virtual Accounts", description: "Collect payments to dedicated accounts", href: "/os/financial-products/accounts", icon: Building2, flag: "virtualAccounts" },
  { label: "Virtual Cards", description: "Issue and manage spending cards", href: "/os/financial-products/cards", icon: CreditCard, flag: "virtualCards" },
  { label: "Transfers", description: "Send money locally and abroad", href: "/os/financial-products/remittance", icon: Send, flag: "remittance" },
  { label: "Transactions", description: "Every movement on your ledger", href: "/os/wallet?tab=history", icon: Receipt },
  { label: "Payouts", description: "Withdraw to your bank account", href: "/os/wallet?tab=withdraw", icon: Banknote, flag: "walletWithdrawals" },
  { label: "Vouchers", description: "Buy and redeem value vouchers", href: "/os/vouchers", icon: Ticket }
];

function isCredit(amount: string) { return amount.trim().startsWith("+"); }

export default function MoneyOverviewPage() {
  const { activity, loading, wallet } = useBillingData();
  const { flags, ready: flagsReady } = useFeatureFlags();
  const availableBalance = wallet?.availableBalance ?? null;
  const heldBalance = wallet?.heldBalance ?? null;
  const fallbackCurrency = availableBalance?.currency ?? "NGN";
  const visibleEntries = ENTRIES.filter((entry) => !entry.flag || (flagsReady && flags[entry.flag] === true));
  const recentActivity = activity.slice(0, 6);

  return (
    <div className="ft-page-frame px-4 py-6 sm:px-6 lg:px-8">
      <header className="ft-page-hero mb-6">
        <div>
          <div className="ft-eyebrow">Financial operating layer</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Money</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">Balances, accounts, cards, transfers and transaction intelligence in one connected surface.</p>
        </div>
        <div className="ft-live-pill"><span className="ft-live-dot" /> Financial systems</div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="ft-hero-surface relative overflow-hidden rounded-[28px] p-6 sm:p-7">
          <div className="relative z-10 flex items-center justify-between gap-3 text-xs text-[var(--ft-text-muted)]"><span className="font-mono uppercase tracking-[0.16em]">Available balance</span><Wallet className="size-5 text-[var(--ft-accent)]" /></div>
          <div className="relative z-10 mt-4 font-mono text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{loading ? <ValueSkeleton width="w-32" /> : availableBalance ? formatCampaignMoney(availableBalance) : "—"}</div>
          <div className="relative z-10 mt-2 text-xs text-[var(--ft-text-secondary)]">{loading ? "" : `${formatCampaignMoney(heldBalance ?? { amountMinor: 0, currency: fallbackCurrency })} held for active campaigns`}</div>
          <div className="relative z-10 mt-6 flex flex-wrap gap-2">
            <Link className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--ft-text-primary)] px-4 text-sm font-semibold text-[var(--ft-text-inverse)] shadow-[var(--shadow-md)] transition hover:-translate-y-0.5" href="/os/wallet"><ArrowDownLeft className="size-4" /> Deposit</Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] px-4 text-sm font-semibold transition hover:border-[var(--ft-accent)]" href="/os/wallet"><ArrowUpRight className="size-4" /> Withdraw</Link>
          </div>
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[var(--ft-accent-glow)] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-[var(--ft-accent-2-glow)] blur-3xl" />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="ft-eyebrow">Money systems</h2><span className="font-mono text-[10px] text-[var(--ft-text-muted)]">{visibleEntries.length} available</span></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleEntries.map((entry) => (
              <Link className="ft-system-card group flex items-start gap-3 rounded-2xl p-4" href={entry.href} key={entry.href}>
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--ft-border)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"><entry.icon className="size-5" /></div>
                <div className="min-w-0"><div className="text-sm font-semibold group-hover:text-[var(--ft-accent)]">{entry.label}</div><div className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">{entry.description}</div></div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-5 overflow-hidden rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-4"><div><div className="ft-eyebrow">Global money</div><h2 className="mt-1 text-lg font-semibold">One money layer, multiple jobs</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--ft-text-muted)]">Keep the customer's mental model simple: hold, spend, send and exchange. Product availability is always shown before an action begins.</p></div><Globe2 className="size-5 text-[var(--ft-accent-2)]" /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4"><div className="font-mono text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">Hold</div><div className="mt-1 text-sm font-semibold">USD · GBP · EUR</div></div><div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4"><div className="font-mono text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">Digital dollars</div><div className="mt-1 text-sm font-semibold">USDT · USDC</div></div><div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4"><div className="font-mono text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">Move</div><div className="mt-1 text-sm font-semibold">Global → Nigeria</div></div></div>
      </section>

      <section className="ft-data-surface mt-5 rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-3"><div><div className="ft-eyebrow">Ledger activity</div><h2 className="mt-1 text-lg font-semibold">Recent transactions</h2></div><Link className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ft-accent)]" href="/os/wallet">View all <ArrowRight className="size-3" /></Link></div>
        <div className="mt-4">{loading ? <LoadingBlock label="Loading transactions" /> : recentActivity.length === 0 ? <EmptyState copy="Fund your wallet or make a payment to see activity here." title="No transactions yet" /> : <div className="grid gap-1.5">{recentActivity.map((item) => { const credit = isCredit(item.amount); return <div className="ft-ledger-row" key={item.id}><div className={credit ? "grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ft-green)]/10 text-[var(--ft-green)]" : "grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]"}>{credit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{item.label}</div><div className="text-micro mt-1 text-[var(--ft-text-muted)]">{formatDateTime(item.at)}</div></div><div className="text-right"><div className={credit ? "font-mono text-sm text-[var(--ft-green)]" : "font-mono text-sm"}>{item.amount}</div><Badge tone="neutral">{humanizeStatus(item.status)}</Badge></div></div>; })}</div>}</div>
      </section>
    </div>
  );
}
