import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

import { trustSignals } from "./data";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <div className="flex items-center gap-3">
              <img alt="FlipTrybe Technology" className="h-9 w-auto" src="/brand/logo-horizontal-light.svg" />
              <span className="hidden border-l border-[var(--ft-border)] pl-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-muted)] sm:inline">Intelligent commerce infrastructure</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-[var(--ft-text-secondary)]">
              Intelligent infrastructure for money movement, digital services, commerce and growth.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {trustSignals.map((item) => (
              <div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4" key={item.label}>
                <item.icon className="size-4 text-[var(--ft-accent)]" />
                <div className="mt-3 text-xs font-semibold">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 border-y border-[var(--ft-border)] py-7 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ft-text-muted)]">Platform</div>
            <div className="mt-3 grid gap-2 text-sm text-[var(--ft-text-secondary)]">
              <Link className="hover:text-[var(--ft-text-primary)]" href="/#platform">The platform</Link>
              <Link className="hover:text-[var(--ft-text-primary)]" href="/#intelligence">Intelligence layer</Link>
              <Link className="hover:text-[var(--ft-text-primary)]" href="/pricing">Pricing</Link>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ft-text-muted)]">Company</div>
            <div className="mt-3 grid gap-2 text-sm text-[var(--ft-text-secondary)]">
              <Link className="hover:text-[var(--ft-text-primary)]" href="/terms">Terms</Link>
              <Link className="hover:text-[var(--ft-text-primary)]" href="/privacy">Privacy</Link>
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-2 lg:text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-text-muted)]">
              <ShieldCheck className="size-3.5 text-[var(--ft-green)]" /> Trusted infrastructure
            </div>
            <p className="mt-3 text-xs text-[var(--ft-text-muted)]">Built in Africa. Connected to the world.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-xs text-[var(--ft-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 FlipTrybe Technology. All rights reserved.</span>
          <a className="inline-flex items-center gap-1 font-medium hover:text-[var(--ft-text-primary)]" href="mailto:hello@fliptrybe.xyz">hello@fliptrybe.xyz <ArrowUpRight className="size-3" /></a>
        </div>
      </div>
    </footer>
  );
}
