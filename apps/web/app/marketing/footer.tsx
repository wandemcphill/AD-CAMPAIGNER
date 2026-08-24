import Link from "next/link";

import { trustSignals } from "./data";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img alt="FlipTrybe Technology" className="h-9 w-auto" src="/brand/logo-horizontal-light.svg" />
            <span className="hidden h-5 w-px bg-[var(--ft-border)] sm:block" />
            <span className="hidden font-mono text-[10px] font-semibold tracking-[0.18em] text-[var(--ft-text-muted)] uppercase sm:block">
              Intelligent commerce infrastructure
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {trustSignals.map((item) => (
              <span
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] px-3 py-2 text-xs font-medium text-[var(--ft-text-secondary)]"
                key={item.label}
              >
                <item.icon className="size-4 text-[var(--ft-accent)]" />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-8 border-t border-[var(--ft-border)] pt-7 text-sm md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="font-semibold text-[var(--ft-text-primary)]">FlipTrybe Technology</div>
            <p className="mt-1 max-w-lg leading-6 text-[var(--ft-text-muted)]">
              One intelligent platform for money, digital services, commerce and growth.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-[var(--ft-text-secondary)]">
            <Link className="transition hover:text-[var(--ft-text-primary)]" href="/pricing">Pricing</Link>
            <Link className="transition hover:text-[var(--ft-text-primary)]" href="/terms">Terms of Service</Link>
            <Link className="transition hover:text-[var(--ft-text-primary)]" href="/privacy">Privacy Policy</Link>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--ft-border)] pt-5 text-xs text-[var(--ft-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 FlipTrybe Technology. All rights reserved.</span>
          <span className="font-mono tracking-[0.08em] uppercase">Built for the next economy.</span>
        </div>
      </div>
    </footer>
  );
}
