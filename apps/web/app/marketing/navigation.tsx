import { ArrowRight } from "lucide-react";

import { ThemeToggle } from "@fliptrybe/ui";

import { navItems } from "./data";

export function MarketingNavigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-4 pt-4 sm:px-6">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/90 px-3 shadow-[var(--shadow-md)] backdrop-blur-xl sm:px-5">
        <a aria-label="FlipTrybe home" className="flex items-center gap-2" href="#top">
          <img alt="FlipTrybe" className="h-7 w-auto sm:h-8" src="/brand/logo-horizontal-light.svg" />
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              className="rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <ThemeToggle />
          </span>
          <a
            className="hidden h-10 items-center rounded-[var(--radius-md)] border border-[var(--ft-border)] px-3 text-sm font-medium text-[var(--ft-text-primary)] transition hover:border-[var(--ft-border-strong)] sm:flex"
            href="/login"
          >
            Sign in
          </a>
          <a
            className="group flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--ft-accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--ft-accent-dim)]"
            href="/register"
          >
            <span>Get started</span>
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </a>
        </div>
      </nav>
    </header>
  );
}
