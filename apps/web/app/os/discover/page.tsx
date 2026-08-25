"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Banknote, Bitcoin, CreditCard, Gift, Globe2, Megaphone, Plane, Search, Send, Sparkles, Tv, Users, type LucideIcon } from "lucide-react";

type DiscoveryJob = {
  eyebrow: string;
  title: string;
  description: string;
  href: Route;
  icon: LucideIcon;
  tags: string;
};

const JOBS: DiscoveryJob[] = [
  { eyebrow: "MOVE MONEY", title: "Send money to Nigeria", description: "Start with supported USA, UK, Europe and Canada corridors.", href: "/os/financial-products/remittance", icon: Send, tags: "USA UK Europe Canada Nigeria" },
  { eyebrow: "CHINA", title: "Pay China", description: "Buy RMB and use supported China payment channels for suppliers and purchases.", href: "/os/rmb", icon: Banknote, tags: "RMB yuan Alipay WeChat China" },
  { eyebrow: "DIGITAL DOLLARS", title: "Buy or sell USDT / USDC", description: "Access supported stablecoin journeys from one clear starting point.", href: "/os/crypto", icon: Bitcoin, tags: "crypto stablecoin USDT USDC buy sell" },
  { eyebrow: "GLOBAL SPEND", title: "Get a virtual card", description: "Use supported virtual-card products for international subscriptions and online spending.", href: "/os/financial-products/cards", icon: CreditCard, tags: "virtual card USD GBP EUR subscriptions" },
  { eyebrow: "DIGITAL VALUE", title: "Buy or sell gift cards", description: "Choose whether you want digital value or a payout for an eligible card.", href: "/os/digital-value", icon: Gift, tags: "gift card voucher buy sell cash" },
  { eyebrow: "TRAVEL", title: "Book a trip", description: "Explore flights, hotels, safaris and tours from the travel hub.", href: "/os/travel", icon: Plane, tags: "flight hotel safari tour holiday" },
  { eyebrow: "AUDIENCE", title: "Grow Nigerian TikTok reach", description: "Find services for followers, views and TikTok LIVE audience growth.", href: "/os/growth/services", icon: Tv, tags: "TikTok followers viewers LIVE Nigeria views" },
  { eyebrow: "MARKETING", title: "Launch a campaign", description: "Create and manage a campaign when you want broader audience reach.", href: "/os/campaigns/new", icon: Megaphone, tags: "campaign advertising promotion" },
  { eyebrow: "CONNECT", title: "Stay connected", description: "Top up airtime, buy data or manage international numbers.", href: "/os/services", icon: Globe2, tags: "airtime data phone number telecom" },
];

const POPULAR: Array<[string, Route]> = [
  ["Send $ to Nigeria", "/os/financial-products/remittance"],
  ["Pay a Chinese supplier", "/os/rmb"],
  ["Buy USDT", "/os/crypto"],
  ["Get a virtual card", "/os/financial-products/cards"],
  ["Sell a gift card", "/os/digital-value"],
  ["Find Nigerian TikTok viewers", "/os/growth/services"],
];

export default function DiscoverPage() {
  return (
    <main className="relative px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-16 right-0 size-96 rounded-full bg-[var(--ft-accent-glow)] blur-3xl opacity-50" />
      <div className="relative mx-auto max-w-[1500px]">
        <header className="overflow-hidden rounded-[30px] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)] p-6 shadow-[var(--shadow-lg)] sm:p-9">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-accent)]/20 bg-[var(--ft-accent-subtle)] px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]"><Sparkles className="size-3" /> FlipTrybe Technology</div>
            <h1 className="mt-5 font-[var(--font-display)] text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">Tell us what you want to do.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)] sm:text-base">Money, China payments, digital dollars, cards, gift cards, travel and audience growth are organised around the job you came to complete.</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-2 text-xs text-[var(--ft-text-secondary)]"><Search className="size-3.5" /> Search the Services hub for more</span>
            {POPULAR.map(([label, href]) => <Link key={href} href={href} className="rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-2 text-xs font-medium transition hover:border-[var(--ft-accent)]/40 hover:text-[var(--ft-accent)]">{label}</Link>)}
          </div>
        </header>

        <section className="mt-9">
          <div className="mb-4 flex items-end justify-between"><div><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--ft-accent)]">Start here</span><h2 className="mt-1 text-xl font-semibold tracking-tight">Popular customer jobs</h2></div><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">{JOBS.length} pathways</span></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {JOBS.map((job, index) => <Link href={job.href} key={job.title} className="group relative overflow-hidden rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5 shadow-[var(--shadow-sm)] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/35 hover:shadow-[var(--shadow-md)]">
              <div className="absolute -right-10 -top-10 size-28 rounded-full bg-[var(--ft-accent-glow)] blur-2xl opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]"><job.icon className="size-5" /></span><span className="font-mono text-[9px] text-[var(--ft-text-muted)]">0{index + 1}</span></div>
              <div className="relative mt-6 font-mono text-[9px] font-semibold tracking-[0.16em] text-[var(--ft-accent)]">{job.eyebrow}</div>
              <h3 className="relative mt-2 text-base font-semibold tracking-tight">{job.title}</h3>
              <p className="relative mt-2 text-xs leading-5 text-[var(--ft-text-muted)]">{job.description}</p>
              <div className="relative mt-5 flex items-center justify-between"><span className="text-[10px] text-[var(--ft-text-muted)]">{job.tags}</span><ArrowRight className="size-4 text-[var(--ft-accent)] transition group-hover:translate-x-1" /></div>
            </Link>)}
          </div>
        </section>

        <section className="mt-9 grid gap-4 lg:grid-cols-3">
          <Link href="/os/services" className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-6 transition hover:border-[var(--ft-accent)]/35"><Users className="size-5 text-[var(--ft-accent)]" /><h3 className="mt-4 font-semibold">Browse everything</h3><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">Open the full service catalogue and search by product, country, currency or outcome.</p></Link>
          <Link href="/os/orders" className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-6 transition hover:border-[var(--ft-accent)]/35"><Globe2 className="size-5 text-[var(--ft-accent)]" /><h3 className="mt-4 font-semibold">Track what you started</h3><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">Return to your activity and follow payments, orders and other customer journeys.</p></Link>
          <Link href="/os" className="rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-6 transition hover:border-[var(--ft-accent)]/35"><Sparkles className="size-5 text-[var(--ft-accent)]" /><h3 className="mt-4 font-semibold">Back to your workspace</h3><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">Return to the customer home and pick up where you left off.</p></Link>
        </section>
      </div>
    </main>
  );
}
