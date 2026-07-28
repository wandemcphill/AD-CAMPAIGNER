import { ArrowRight, Command } from "lucide-react";

import { navItems } from "./data";

export function MarketingNavigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-4 pt-4 sm:px-6">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-[12px] border border-white/10 bg-[rgba(11,15,25,0.78)] px-3 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-5">
        <a className="flex items-center gap-3" href="#engine" aria-label="Fliptribe home">
          <span className="grid size-10 place-items-center rounded-[12px] border border-[rgba(0,102,255,0.42)] bg-[linear-gradient(135deg,rgba(0,102,255,0.18),rgba(139,92,246,0.16),rgba(6,182,212,0.14))] text-sm font-black text-white shadow-[0_0_30px_rgba(0,102,255,0.2)]">
            FT
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">Fliptribe</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/44">
              Growth OS
            </span>
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              className="rounded-[12px] px-3 py-2 text-sm font-medium text-white/64 transition hover:bg-white/[0.06] hover:text-white"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </a>
          ))}
        </div>

        <a
          className="group flex h-10 items-center gap-2 rounded-[12px] bg-[var(--flip-primary)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--flip-accent)]"
          href="/campaigns/new"
        >
          <Command className="size-4" />
          <span className="hidden sm:inline">Open engine</span>
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </a>
      </nav>
    </header>
  );
}
