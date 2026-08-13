import Link from "next/link";

import { trustSignals } from "./data";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <img alt="FlipTrybe" className="h-6 w-auto" src="/brand/logo-horizontal-light.svg" />
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

        <div className="border-t border-[var(--ft-border)] pt-6">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--ft-text-secondary)]">
            <Link className="transition hover:text-[var(--ft-text-primary)]" href="/terms">
              Terms of Service
            </Link>
            <div className="h-4 w-px bg-[var(--ft-border)]" />
            <Link className="transition hover:text-[var(--ft-text-primary)]" href="/privacy">
              Privacy Policy
            </Link>
          </div>
        </div>

        <div className="border-t border-[var(--ft-border)] pt-6 text-center text-xs text-[var(--ft-text-muted)]">
          © 2026 FlipTrybe. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
