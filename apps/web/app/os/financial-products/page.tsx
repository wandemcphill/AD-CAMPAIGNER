"use client";

import Link from "next/link";
import { ArrowRight, Banknote, CreditCard, Globe2, WalletCards } from "lucide-react";

import { useFeatureFlags } from "../../lib/feature-flags";

const PRODUCTS = [
  {
    id: "accounts",
    flag: "virtualAccounts",
    eyebrow: "HOLD",
    title: "Multi-currency accounts",
    description: "Manage supported USD, GBP and EUR account products from one place.",
    href: "/os/financial-products/accounts",
    icon: Globe2,
    tone: "var(--ft-purple)"
  },
  {
    id: "cards",
    flag: "virtualCards",
    eyebrow: "SPEND",
    title: "Virtual cards",
    description: "Use supported virtual cards for international online subscriptions and payments.",
    href: "/os/financial-products/cards",
    icon: CreditCard,
    tone: "var(--ft-accent)"
  },
  {
    id: "remittance",
    flag: "remittance",
    eyebrow: "MOVE",
    title: "Send money internationally",
    description: "Explore supported corridors for moving money between international senders and Nigeria.",
    href: "/os/financial-products/remittance",
    icon: Banknote,
    tone: "var(--ft-green)"
  }
];

export default function FinancialProductsIndexPage() {
  const { flags, ready } = useFeatureFlags();
  const available = PRODUCTS.filter((product) => flags[product.flag] === true);

  return (
    <section className="mt-5">
      <div className="overflow-hidden rounded-[28px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-md)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">Your global money layer</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[var(--ft-text-primary)] sm:text-3xl">Hold. Spend. Move.</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">One place for supported foreign-currency accounts, international cards and money movement. Start with the job you need to complete.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ft-text-muted)]"><WalletCards className="size-3.5" /> Protected product area</div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {PRODUCTS.map((product) => {
            const enabled = flags[product.flag] === true;
            return (
              <Link aria-disabled={!enabled} className={`group rounded-[22px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition ${enabled ? "hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/35 hover:shadow-[var(--shadow-md)]" : "cursor-default opacity-55"}`} href={enabled ? product.href : "#"} key={product.id} onClick={(event) => { if (!enabled) event.preventDefault(); }}>
                <div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]" style={{ color: product.tone }}><product.icon className="size-5" /></span><span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${enabled ? "bg-[var(--ft-green)]/10 text-[var(--ft-green)]" : "bg-[var(--ft-yellow)]/10 text-[var(--ft-yellow)]"}`}>{ready ? (enabled ? "Available" : "Not enabled") : "Checking"}</span></div>
                <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ft-text-muted)]">{product.eyebrow}</div>
                <h3 className="mt-1 text-base font-semibold text-[var(--ft-text-primary)]">{product.title}</h3>
                <p className="mt-2 min-h-12 text-xs leading-5 text-[var(--ft-text-muted)]">{product.description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--ft-accent)]">{enabled ? "Open product" : "Unavailable"}{enabled && <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />}</div>
              </Link>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {["Clear availability before action", "Review before money moves", "Track status after confirmation"].map((item, index) => <div className="rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-3 text-xs text-[var(--ft-text-secondary)]" key={item}><span className="mr-2 font-mono text-[9px] text-[var(--ft-accent)]">0{index + 1}</span>{item}</div>)}
        </div>
      </div>
    </section>
  );
}
