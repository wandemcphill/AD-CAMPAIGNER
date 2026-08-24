"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Bitcoin,
  ChevronDown,
  CreditCard,
  Gift,
  Globe2,
  Plane,
  Send,
  Sparkles,
  Users
} from "lucide-react";

const ACTIONS = [
  { label: "Send money", detail: "Global → Nigeria", href: "/os/financial-products/remittance", icon: Send },
  { label: "Buy / sell USDT & USDC", detail: "Digital dollars", href: "/os/crypto", icon: Bitcoin },
  { label: "Buy RMB & pay China", detail: "China payments", href: "/os/rmb", icon: Banknote },
  { label: "Buy a gift card", detail: "Digital value", href: "/os/digital-value", icon: Gift },
  { label: "Sell my gift card", detail: "Get a quote", href: "/os/digital-value", icon: Gift },
  { label: "Get a virtual card", detail: "Global spending", href: "/os/financial-products/cards", icon: CreditCard },
  { label: "Book travel", detail: "Flights · safaris · tours", href: "/os/services", icon: Plane },
  { label: "Grow my TikTok", detail: "Nigerian audience", href: "/os/growth/services", icon: Users }
] as const;

export function CustomerActionDock() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 px-4 sm:bottom-5 sm:px-6 lg:left-auto lg:right-6 lg:w-[430px] lg:px-0">
      <div className="overflow-hidden rounded-[22px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]/95 shadow-[0_20px_60px_rgba(0,0,0,.18)] backdrop-blur-xl">
        <button
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--ft-bg-muted)]"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ft-accent)] text-[var(--ft-text-inverse)] shadow-[0_8px_24px_var(--ft-accent-glow)]"><Sparkles className="size-4" /></span>
            <span className="min-w-0"><span className="block text-xs font-semibold">What do you want to do?</span><span className="block truncate text-[10px] text-[var(--ft-text-muted)]">Jump straight to a FlipTrybe service</span></span>
          </span>
          <ChevronDown className={`size-4 shrink-0 text-[var(--ft-text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open ? (
          <div className="grid grid-cols-1 gap-1 border-t border-[var(--ft-border)] p-2 sm:grid-cols-2">
            {ACTIONS.map(({ label, detail, href, icon: Icon }) => (
              <Link className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-[var(--ft-bg-muted)]" href={href} key={label} onClick={() => setOpen(false)}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] text-[var(--ft-accent)]"><Icon className="size-3.5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold">{label}</span><span className="block truncate text-[9px] text-[var(--ft-text-muted)]">{detail}</span></span>
                <ArrowRight className="size-3.5 shrink-0 text-[var(--ft-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--ft-accent)]" />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
