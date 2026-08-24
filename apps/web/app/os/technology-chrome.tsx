import type { ReactNode } from "react";

export function TechnologyChrome({ children }: { children: ReactNode }) {
  return (
    <div className="ft-technology-frame">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-px bg-gradient-to-r from-transparent via-[var(--ft-accent)] to-transparent opacity-80" />
      <div className="pointer-events-none fixed left-1/2 top-2 z-[55] hidden -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/80 px-3 py-1 font-mono text-[10px] font-semibold tracking-[0.16em] text-[var(--ft-text-muted)] uppercase shadow-[var(--shadow-sm)] backdrop-blur-xl md:flex">
        <span className="size-1.5 rounded-full bg-[var(--ft-green)] shadow-[0_0_12px_var(--ft-green-glow)]" />
        FlipTrybe Technology · Intelligent commerce infrastructure
      </div>
      {children}
    </div>
  );
}
