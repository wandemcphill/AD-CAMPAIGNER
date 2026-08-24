"use client";

import Link from "next/link";
import { ArrowLeftRight, Banknote, Bitcoin, CreditCard, Gift, Plane, Send, Tv } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@fliptrybe/ui";

const ACTIONS: Array<{ label: string; hint: string; href: string; icon: LucideIcon }> = [
  { label: "Send to Nigeria", hint: "USA · UK · Europe · Canada", href: "/os/financial-products/remittance", icon: Send },
  { label: "Buy RMB & Pay China", hint: "Alipay · WeChat · suppliers", href: "/os/rmb", icon: Banknote },
  { label: "USDT / USDC", hint: "Buy or sell stablecoins", href: "/os/crypto", icon: Bitcoin },
  { label: "Virtual card", hint: "Pay global subscriptions", href: "/os/financial-products/cards", icon: CreditCard },
  { label: "Buy gift cards", hint: "Digital spending", href: "/os/digital-value", icon: Gift },
  { label: "Sell gift cards", hint: "Get paid for eligible cards", href: "/os/digital-value", icon: Gift },
  { label: "Travel", hint: "Flights · safaris · tours", href: "/os/travel", icon: Plane },
  { label: "TikTok growth", hint: "Nigerian viewers & followers", href: "/os/growth/services", icon: Tv },
  { label: "Campaign", hint: "Create & launch", href: "/os/campaigns/new", icon: ArrowLeftRight }
];

export function CustomerActionRail({ pathname }: { pathname: string }) {
  return (
    <div className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] lg:px-6 [&::-webkit-scrollbar]:hidden">
        <div className="mr-1 hidden shrink-0 items-center pr-1 sm:flex"><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-muted)]">Quick actions</span></div>
        {ACTIONS.map((action) => {
          const active = pathname === action.href || pathname.startsWith(`${action.href}/`);
          return <Link className={cn("group flex min-w-max shrink-0 items-center gap-2 rounded-xl border px-3 py-2 transition", active ? "border-[var(--ft-accent)]/35 bg-[var(--ft-accent)]/10" : "border-[var(--ft-border)] bg-[var(--ft-bg-raised)] hover:border-[var(--ft-accent)]/30 hover:bg-[var(--ft-bg-muted)]")} href={action.href} key={`${action.label}-${action.href}`}><span className={cn("grid size-7 place-items-center rounded-lg", active ? "bg-[var(--ft-accent)]/15 text-[var(--ft-accent)]" : "bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)] group-hover:text-[var(--ft-accent)]")}><action.icon className="size-3.5" /></span><span className="text-left"><span className="block text-[11px] font-semibold leading-4 text-[var(--ft-text-primary)]">{action.label}</span><span className="block text-[9px] leading-3 text-[var(--ft-text-muted)]">{action.hint}</span></span></Link>;
        })}
      </div>
    </div>
  );
}
