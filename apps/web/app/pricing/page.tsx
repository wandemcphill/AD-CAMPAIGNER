import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing — FlipTrybe",
  description:
    "What FlipTrybe costs: no subscription, no account fees, and the price you see at checkout is the price you pay."
};

/**
 * Public pricing.
 *
 * Every claim here is checked against the code, not the roadmap:
 *  - "No subscription / no account fee" — there is no subscription, plan or
 *    recurring-billing model anywhere in the API. Nothing to disclose.
 *  - "Free invoicing / payment links" — neither invoices.service.ts nor
 *    payment-links.service.ts applies any fee.
 *  - "No fee to fund your wallet" — the funding-intent path adds none.
 *  - "The price you see is the price you pay" — service prices are computed
 *    server-side and returned before the customer confirms, with the margin
 *    already inside the quoted figure. There is no fee added afterwards.
 *
 * Deliberately NOT stated: the per-domain markup percentages. They are
 * defaults that any active PricingRule row overrides per country / network /
 * product / provider (see providers/pricing-rule.service.ts), so publishing
 * one as a fixed public rate would be inaccurate the moment ops tunes a rule.
 * Quoting only the low ones and omitting the higher ones would also mislead by
 * omission. If margin disclosure is wanted, it needs a deliberate policy
 * decision and a rule that keeps this page in sync — not a hardcoded number.
 */

const FREE_ITEMS = [
  "Creating your FlipTrybe account",
  "Sending invoices and tracking payment",
  "Creating and sharing payment links",
  "Funding your wallet",
  "Paying a bill as a guest, with no account"
];

const PRICING_ROWS: Array<{ detail: string; item: string }> = [
  {
    detail: "Priced per purchase. The exact amount is shown before you confirm.",
    item: "Airtime, data, electricity, cable, exam PINs"
  },
  {
    detail: "Priced per product and denomination, shown before you confirm.",
    item: "Gift cards"
  },
  {
    detail: "Priced per number and duration, shown before you buy.",
    item: "International numbers"
  },
  {
    detail: "You set the campaign budget. Creative and management are quoted up front.",
    item: "Campaigns and growth services"
  },
  {
    detail: "Priced per service by the creator or agency you hire.",
    item: "Marketplace bookings"
  }
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] px-4 py-16 text-[var(--ft-text-primary)] sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Link
          className="text-sm font-medium text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]"
          href="/"
        >
          ← Back to FlipTrybe
        </Link>

        <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-5xl">Pricing</h1>
        <p className="mt-4 text-base leading-7 text-[var(--ft-text-secondary)]">
          No subscription. No monthly account fee. You pay for what you buy, and the
          price you see at checkout is the price you pay.
        </p>

        {/* Free */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">Free with every account</h2>
          <ul className="mt-5 grid gap-3">
            {FREE_ITEMS.map((item) => (
              <li className="flex items-start gap-3 text-sm leading-6" key={item}>
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--ft-green-subtle)] text-[var(--ft-green)]">
                  <Check className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Pay per use */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight">What you pay for</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
            Everything below is priced per transaction. Nothing is added after you
            confirm, and there is no charge for an order that doesn&apos;t get delivered.
          </p>

          <div className="mt-6 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--ft-border)]">
            {PRICING_ROWS.map((row, index) => (
              <div
                className={`flex flex-col gap-1 bg-[var(--ft-bg-raised)] p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${
                  index > 0 ? "border-t border-[var(--ft-border)]" : ""
                }`}
                key={row.item}
              >
                <div className="text-sm font-semibold">{row.item}</div>
                <div className="text-sm text-[var(--ft-text-secondary)] sm:max-w-sm sm:text-right">
                  {row.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Honesty note */}
        <section className="mt-12">
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/50 p-5">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--ft-accent)]" />
            <div className="text-sm leading-6 text-[var(--ft-text-secondary)]">
              <span className="font-semibold text-[var(--ft-text-primary)]">
                Prices vary by product and network.
              </span>{" "}
              We don&apos;t publish a single blanket rate, because what you pay depends
              on the specific product you&apos;re buying. The exact figure is always
              shown before you confirm — and you can check it without an account.
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--ft-accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--ft-accent-dim)]"
            href="/guest"
          >
            Check a price now
            <ArrowRight className="size-4" />
          </Link>
          <Link
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)] px-6 text-sm font-semibold transition hover:border-[var(--ft-border-emphasis)]"
            href="/register"
          >
            Create a free account
          </Link>
        </section>
      </div>
    </main>
  );
}
