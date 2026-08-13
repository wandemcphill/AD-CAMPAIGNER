"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { heroEvents } from "./data";

const toneColor: Record<string, string> = {
  accent: "var(--ft-accent)",
  green: "var(--ft-green)",
  purple: "var(--ft-accent-2)"
};

/**
 * The hero's product composition: a wallet card with an event feed that cycles.
 *
 * Everything rendered here is illustrative. It is captioned as an example in the
 * UI so it can never read as a live balance or a real customer transaction.
 */
export function HeroComposition({ reducedMotion }: { reducedMotion: boolean }) {
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setCursor((value) => value + 1);
    }, 2600);

    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  // Three visible rows, newest first, cycling through the illustrative set.
  const visible = Array.from({ length: 3 }, (_, offset) => {
    // Modulo keeps the index in range, so the lookup is always defined; the
    // assertion just drops the `T | undefined` that noUncheckedIndexedAccess adds.
    const event = heroEvents[(cursor + offset) % heroEvents.length]!;
    return { ...event, key: `${cursor + offset}` };
  });

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] opacity-70 blur-2xl [background:radial-gradient(circle_at_30%_20%,var(--ft-accent-glow),transparent_60%),radial-gradient(circle_at_75%_75%,var(--ft-accent-2-glow),transparent_60%)]"
      />

      {/* Wallet card */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-xl)]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ft-text-muted)]">
            <Wallet className="size-3.5 text-[var(--ft-accent)]" />
            Wallet balance
          </span>
          <span className="rounded-full border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.04em] text-[var(--ft-green)] uppercase">
            NGN
          </span>
        </div>

        <div className="mt-3 font-mono text-4xl font-bold tracking-tight tabular-nums">
          ₦1,482,900
        </div>
        <div className="mt-1 text-xs text-[var(--ft-text-secondary)]">
          Available · ₦120,000 held for active campaigns
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {["Send", "Invoice", "Top up"].map((action) => (
            <div
              className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] py-2 text-center text-xs font-medium text-[var(--ft-text-secondary)]"
              key={action}
            >
              {action}
            </div>
          ))}
        </div>
      </div>

      {/* Event feed */}
      <div className="mt-3 space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((event, index) => (
            <motion.div
              animate={{ opacity: index === 0 ? 1 : 0.55 - index * 0.12, y: 0, scale: 1 }}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] px-4 py-3 shadow-[var(--shadow-sm)]"
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              initial={{ opacity: 0, y: reducedMotion ? 0 : -10, scale: reducedMotion ? 1 : 0.98 }}
              key={event.key}
              layout={!reducedMotion}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full"
                style={{ background: "var(--ft-bg-muted)", color: toneColor[event.tone] }}
              >
                <event.icon className="size-4" />
              </span>
              <span className="flex-1 text-sm font-medium">{event.label}</span>
              <span
                className="font-mono text-xs font-semibold tabular-nums"
                style={{ color: toneColor[event.tone] }}
              >
                {event.amount}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[var(--ft-text-muted)]">
        <ArrowUpRight className="size-3" />
        Example activity — illustrative, not live data
      </div>
    </div>
  );
}
