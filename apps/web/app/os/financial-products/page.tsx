"use client";

import Link from "next/link";
import { ArrowRight, Banknote, CreditCard, Globe2, ShieldCheck } from "lucide-react";

import { useFeatureFlags } from "../../lib/feature-flags";

const PRODUCTS = [
  {
    title: "Multi-currency accounts",
    description: "Access supported USD, GBP and EUR account products from one place.",
    href: "/os/financial-products/accounts",
    flag: "virtualAccounts",
    icon: Globe2,
    eyebrow: "HOLD"
  },
  {
    title: "Virtual cards",
    description: "Spend online with supported international card products and manage your subscriptions.",
    href: "/os/financial-products/cards",
    flag: "virtualCards",
    icon: CreditCard,
    eyebrow: "SPEND"
  },
  {
    title: "Send money globally",
    description: "Get a quote, review the recipient and send through supported international corridors.",
    href: "/os/financial-products/remittance",
    flag: "remittance",
    icon: Banknote,
    eyebrow: "MOVE"
  }
] as const;

export default function FinancialProductsIndexPage() {
  const { flags, ready } = useFeatureFlags();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
      <section className="relative overflow-hidden rounded-[30px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6 shadow-[var(--shadow-md)] sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-[var(--ft-accent)]/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--ft-accent)]">Global money</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Move, hold and spend money across borders.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">One place for the international money jobs that matter: hold supported currencies, spend online and send money through available corridors.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider text-[var(--ft-text-muted)]">
            <span className="rounded-full border border-[var(--ft-border)] px-3 py-1.5">USD · GBP · EUR</span>
            <span className="rounded-full border border-[var(--ft-border)] px-3 py-1.5">Global transfers</span>
            <span className="rounded-full border border-[var(--ft-border)] px-3 py-1.5">Virtual cards</span>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {PRODUCTS.map((product) => {
          const enabled = ready && flags[product.flag] === true;
          const Icon = product.icon;
          return (
            <Link key={product.title} href={product.href} className={`group rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/35 hover:shadow-[var(--shadow-md)] ${!enabled && ready ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"><Icon className="size-5" /></span>
                <span className="rounded-full bg-[var(--ft-bg-muted)] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)]">{enabled ? "Available" : ready ? "Unavailable" : "Checking"}</span>
              </div>
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--ft-text-muted)]">{product.eyebrow}</div>
              <h2 className="mt-1 text-base font-semibold">{product.title}</h2>
              <p className="mt-2 min-h-12 text-xs leading-5 text-[var(--ft-text-muted)]">{product.description}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--ft-accent)]">Open <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></div>
            </Link>
          );
        })}
      </section>

      <section className="mt-5 rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[var(--ft-green)]" /><div><h2 className="text-sm font-semibold">A safer flow by design</h2><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">Every money action should make the amount, fees, destination and next step obvious before you commit. Availability is controlled by the product flags and actual account permissions.</p></div></div>
      </section>
    </main>
  );
}
