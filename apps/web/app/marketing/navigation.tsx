import { ArrowRight, LogIn, Sparkles } from "lucide-react";

import { ThemeToggle } from "@fliptrybe/ui";

import { navItems } from "./data";

export function MarketingNavigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav className="ft-glass mx-auto flex h-[68px] max-w-7xl items-center justify-between rounded-[24px] border border-[var(--ft-border-strong)] px-3 shadow-[var(--shadow-lg)] sm:px-5">
        <a aria-label="FlipTrybe Technology home" className="group flex min-w-0 items-center gap-3" href="#top">
          <img alt="FlipTrybe Technology" className="h-8 w-auto transition group-hover:scale-[1.02] sm:h-9" src="/brand/logo-horizontal-light.svg" />
          <span className="hidden border-l border-[var(--ft-border)] pl-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-muted)] lg:inline-flex">
            Technology
          </span>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <a
              className="rounded-full px-3.5 py-2 text-sm font-medium text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--ft-text-muted)] xl:inline-flex">
            <Sparkles className="size-3 text-[var(--ft-accent)]" /> AI-native
          </span>
          <span className="hidden sm:inline-flex">
            <ThemeToggle />
          </span>
          <a
            className="ft-auth-secondary inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold shadow-[var(--shadow-sm)] transition hover:border-[var(--ft-accent)]/50 hover:bg-[var(--ft-bg-muted)] sm:px-4"
            href="/login"
          >
            <LogIn className="size-3.5" />
            <span>Sign in</span>
          </a>
          <a
            className="ft-marketing-primary group flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-bold shadow-[var(--shadow-md)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] sm:px-4"
            href="/start"
          >
            <span>Start with FlipTrybe</span>
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </a>
        </div>
      </nav>
      <div className="ft-glass mx-auto mt-2 flex max-w-7xl gap-1 overflow-x-auto rounded-2xl border border-[var(--ft-border)] p-1 lg:hidden">
        {navItems.map((item) => (
          <a
            className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
            href={item.href}
            key={item.label}
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}
