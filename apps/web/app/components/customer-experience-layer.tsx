"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CreditCard,
  Gift,
  Globe2,
  Menu,
  Plane,
  Send,
  Sparkles,
  WalletCards,
  X
} from "lucide-react";

const JOBS = [
  { label: "Send money to Nigeria", detail: "USA · UK · Europe · Canada", href: "/os/money", icon: Send },
  { label: "Pay China / buy RMB", detail: "Suppliers · RMB payments", href: "/os/rmb", icon: Globe2 },
  { label: "Buy or sell USDT / USDC", detail: "Digital dollars", href: "/os/crypto", icon: WalletCards },
  { label: "Get a virtual card", detail: "Subscriptions · global spending", href: "/os/financial-products/cards", icon: CreditCard },
  { label: "Buy or sell gift cards", detail: "Digital value", href: "/os/digital-value", icon: Gift },
  { label: "Book flights, hotels & tours", detail: "Travel discovery", href: "/os/travel", icon: Plane },
  { label: "Grow Nigerian TikTok reach", detail: "Followers · views · LIVE", href: "/os/growth", icon: Sparkles }
] as const;

const EXCLUDED = ["/admin", "/api", "/_next"];

export function CustomerExperienceLayer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!pathname || EXCLUDED.some((prefix) => pathname.startsWith(prefix))) return null;

  const compact = pathname === "/" || pathname === "/start";

  return (
    <div className={`fixed z-[60] ${compact ? "bottom-4 right-4" : "inset-x-4 bottom-4 sm:right-5 sm:left-auto sm:w-[420px]"}`}>
      {open ? (
        <div className="ft-cx-panel overflow-hidden rounded-[26px] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)]/96 shadow-[var(--shadow-xl)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--ft-border)] p-4 sm:p-5">
            <div>
              <div className="ft-eyebrow text-[var(--ft-accent)]">FlipTrybe Technology</div>
              <h2 className="mt-1 text-base font-semibold tracking-tight">What are you trying to do?</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--ft-text-secondary)]">Start with the job. We&apos;ll take you to the right part of the platform.</p>
            </div>
            <button aria-label="Close customer jobs" className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] transition hover:border-[var(--ft-border-strong)] hover:text-[var(--ft-text-primary)]" onClick={() => setOpen(false)} type="button">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid max-h-[min(66vh,520px)] gap-1.5 overflow-y-auto p-2 sm:p-3">
            {JOBS.map((job) => (
              <a key={job.label} href={job.href} onClick={() => setOpen(false)} className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition hover:border-[var(--ft-border)] hover:bg-[var(--ft-bg-surface)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)] group-hover:border-[var(--ft-accent)]/25">
                  <job.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{job.label}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-[var(--ft-text-muted)]">{job.detail}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-[var(--ft-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--ft-accent)]" />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" aria-expanded={open} aria-label="Open customer jobs" onClick={() => setOpen(true)} className="ft-cx-launcher group flex items-center gap-2 rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)]/95 px-4 py-2.5 text-xs font-semibold text-[var(--ft-text-primary)] shadow-[var(--shadow-xl)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/45">
          <span className="grid size-7 place-items-center rounded-full bg-[var(--ft-accent)] text-white"><Menu className="size-3.5" /></span>
          <span className="hidden sm:inline">What do you want to do?</span>
          <span className="sm:hidden">Explore FlipTrybe</span>
          <ChevronDown className="size-3.5 text-[var(--ft-text-muted)] transition group-hover:translate-y-0.5" />
        </button>
      )}
    </div>
  );
}
