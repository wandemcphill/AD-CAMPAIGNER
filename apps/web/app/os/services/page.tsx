"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowUpRight,
  Banknote,
  Bitcoin,
  CreditCard,
  Gift,
  GraduationCap,
  Globe,
  Globe2,
  History,
  KeyRound,
  Lightbulb,
  Plane,
  Phone,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Trophy,
  Tv,
  Wifi,
  type LucideIcon
} from "lucide-react";

import { useFeatureFlags } from "../../lib/feature-flags";

type ServiceCard = { label: string; description: string; href: Route; icon: LucideIcon; flag?: string; keywords?: string };
type ServiceCategory = { title: string; items: ServiceCard[] };

const POPULAR_JOBS: ServiceCard[] = [
  { label: "Send money to Nigeria", description: "Explore supported international transfer corridors.", href: "/os/financial-products/remittance", icon: Send, flag: "remittance", keywords: "usa uk europe canada nigeria transfer remit" },
  { label: "Buy a gift card", description: "Choose from supported gift-card products.", href: "/os/digital-value", icon: Gift, flag: "giftCardSell", keywords: "gift voucher buy purchase" },
  { label: "Sell my gift card", description: "Submit an eligible gift card for settlement.", href: "/os/digital-value", icon: Gift, flag: "giftCardSell", keywords: "gift voucher sell cashout" },
  { label: "Buy RMB & pay China", description: "Buy yuan for supported China payment routes.", href: "/os/rmb", icon: Banknote, flag: "rmbBuy", keywords: "rmb yuan china alipay wechat supplier" },
  { label: "Buy or sell USDT / USDC", description: "Open the supported digital-dollar experience.", href: "/os/crypto", icon: Bitcoin, flag: "cryptoSell", keywords: "crypto stablecoin usdt usdc digital dollar" },
  { label: "Get a virtual card", description: "Explore supported cards for international spending.", href: "/os/financial-products/cards", icon: CreditCard, flag: "virtualCards", keywords: "card subscription foreign payment" },
  { label: "Book travel", description: "Discover available flight and travel experiences.", href: "/os/services", keywords: "flight safari tour travel hotel" }
];

const CATEGORIES: ServiceCategory[] = [
  { title: "Connectivity", items: [
    { label: "Airtime", description: "Top up any network instantly", href: "/os/airtime/airtime", icon: Phone, flag: "vtu", keywords: "recharge credit mobile" },
    { label: "Data", description: "Buy data bundles", href: "/os/airtime/data", icon: Wifi, flag: "vtu", keywords: "internet bundle mobile" },
    { label: "International Top-Up", description: "Send airtime abroad", href: "/os/telecom", icon: Globe2, flag: "telecomGateway", keywords: "international recharge" },
    { label: "International Numbers", description: "Get numbers worldwide", href: "/os/numbers", icon: Globe, flag: "virtualNumbers", keywords: "phone number abroad" },
    { label: "My Numbers", description: "Manage your numbers", href: "/os/numbers/mine", icon: Smartphone, flag: "virtualNumbers", keywords: "phone number" }
  ]},
  { title: "Digital Value", items: [
    { label: "Buy Gift Cards", description: "Buy supported gift cards", href: "/os/digital-value", icon: Gift, flag: "giftCardSell", keywords: "gift voucher buy" },
    { label: "Sell Gift Cards", description: "Sell eligible gift cards to FlipTrybe", href: "/os/digital-value", icon: Gift, flag: "giftCardSell", keywords: "gift voucher sell cash" },
    { label: "Digital Access", description: "Premium digital products", href: "/os/digital-access", icon: KeyRound, flag: "digitalAccess", keywords: "subscription premium digital" }
  ]},
  { title: "Bills & Utilities", items: [
    { label: "Electricity", description: "Pay electricity bills", href: "/os/utilities/electricity", icon: Lightbulb, flag: "billsElectricity", keywords: "power electricity bill" },
    { label: "Cable TV", description: "Renew your subscription", href: "/os/utilities/cable", icon: Tv, flag: "billsCable", keywords: "dstv gotv tv" },
    { label: "Education", description: "Pay education fees", href: "/os/utilities/education", icon: GraduationCap, flag: "billsEducation", keywords: "school fees education" },
    { label: "Bet Funding", description: "Fund betting wallets", href: "/os/utilities/betting", icon: Trophy, flag: "billsBetting", keywords: "bet wallet funding" }
  ]},
  { title: "Global Money", items: [
    { label: "USDT & USDC", description: "Buy and sell supported stablecoins", href: "/os/crypto", icon: Bitcoin, flag: "cryptoSell", keywords: "crypto stablecoin buy sell" },
    { label: "Buy RMB & Pay China", description: "Buy yuan for supported China payments", href: "/os/rmb", icon: Banknote, flag: "rmbBuy", keywords: "rmb yuan china alipay wechat" },
    { label: "Virtual Cards", description: "Spend on supported international subscriptions", href: "/os/financial-products/cards", icon: CreditCard, flag: "virtualCards", keywords: "card subscription international" },
    { label: "Global Transfers", description: "Send money through supported corridors", href: "/os/financial-products/remittance", icon: Send, flag: "remittance", keywords: "send money transfer remit" }
  ]},
  { title: "Travel & Discovery", items: [
    { label: "Travel", description: "Discover supported travel experiences", href: "/os/services", icon: Plane, keywords: "flight safari tour hotel travel" }
  ]}
];

const ORDER_HISTORY: Array<{ label: string; href: Route; flag?: string }> = [
  { label: "Airtime & data", href: "/os/airtime/history", flag: "vtu" },
  { label: "Bills & utilities", href: "/os/utilities/history", flag: "billsElectricity" },
  { label: "Growth services", href: "/os/growth/orders" }
];

export default function ServicesHubPage() {
  const { flags, ready } = useFeatureFlags();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const isEnabled = (flag?: string) => !flag || (ready && flags[flag] === true);
  const matches = (item: ServiceCard) => !normalizedQuery || [item.label, item.description, item.keywords ?? ""].join(" ").toLowerCase().includes(normalizedQuery);

  const visiblePopularJobs = POPULAR_JOBS.filter((item) => isEnabled(item.flag) && matches(item));
  const visibleCategories = useMemo(() => CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => isEnabled(item.flag) && matches(item))
  })).filter((category) => category.items.length > 0), [normalizedQuery, ready, flags]);
  const visibleHistory = ORDER_HISTORY.filter((entry) => isEnabled(entry.flag));
  const resultCount = visibleCategories.reduce((sum, category) => sum + category.items.length, 0);

  return (
    <div className="relative px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -top-12 right-0 size-72 rounded-full bg-[var(--ft-accent-glow)] blur-3xl opacity-60" />
      <div className="relative">
        <header className="overflow-hidden rounded-[28px] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)]/80 p-5 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-accent)]/20 bg-[var(--ft-accent-subtle)] px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]"><Sparkles className="size-3" /> FlipTrybe Technology</div>
              <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Do the thing. We handle the plumbing.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--ft-text-secondary)] sm:text-base">Money, connectivity, digital value, utilities and global services share one operating surface. Start with what you need, not what the product is called.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[[String(resultCount).padStart(2, "0"), "available services"], [String(visiblePopularJobs.length).padStart(2, "0"), "popular jobs"], ["24/7", "platform access"]].map(([value, label]) => <div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/70 px-4 py-3" key={label}><div className="font-mono text-xl font-semibold tracking-[-0.04em]">{value}</div><div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">{label}</div></div>)}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ft-text-muted)]" />
              <input aria-label="Search services" className="h-12 w-full rounded-2xl border border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] pl-10 pr-4 text-sm outline-none transition focus:border-[var(--ft-accent)] focus:shadow-[0_0_0_4px_var(--ft-accent-glow)]" onChange={(event) => setQuery(event.target.value)} placeholder="Try: send money, gift card, RMB, USDT, card, flight…" type="search" value={query} />
            </div>
            {visibleHistory.length > 0 ? <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-micro uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">Recent</span>{visibleHistory.map((entry) => <Link className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--ft-text-secondary)] transition hover:border-[var(--ft-accent)]/40 hover:text-[var(--ft-accent)]" href={entry.href} key={entry.href}><History className="size-3" />{entry.label}</Link>)}</div> : null}
          </div>
        </header>

        {visiblePopularJobs.length > 0 && !normalizedQuery ? <section className="mt-7 overflow-hidden rounded-[26px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-md)] sm:p-6">
          <div className="flex items-end justify-between gap-4"><div><div className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--ft-accent)]">Start here</div><h2 className="mt-1 text-xl font-semibold tracking-tight">Popular jobs</h2><p className="mt-1 text-xs text-[var(--ft-text-muted)]">The fastest routes to the things customers ask FlipTrybe to do.</p></div><Sparkles className="size-5 text-[var(--ft-accent)]" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{visiblePopularJobs.slice(0, 8).map((item) => <Link className="group rounded-[20px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/40 hover:shadow-[var(--shadow-sm)]" href={item.href} key={item.label}><div className="grid size-10 place-items-center rounded-xl bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]"><item.icon className="size-5" /></div><div className="mt-4 text-sm font-semibold">{item.label}</div><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">{item.description}</p><div className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--ft-accent)]">Open <ArrowUpRight className="size-3" /></div></Link>)}</div>
        </section> : null}

        {visibleCategories.length === 0 ? (
          <div className="mt-7 rounded-[24px] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] p-10 text-center"><Search className="mx-auto size-8 text-[var(--ft-text-muted)]" /><div className="mt-4 text-sm font-semibold">No services found</div><p className="mt-1 text-xs text-[var(--ft-text-muted)]">Try a broader search or check back as new services come online.</p></div>
        ) : (
          <div className="mt-8 grid gap-10">
            {visibleCategories.map((category, categoryIndex) => (
              <section key={category.title}>
                <div className="mb-4 flex items-end justify-between gap-3"><div><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--ft-accent)]">0{categoryIndex + 1}</span><h2 className="mt-1 text-lg font-semibold tracking-tight">{category.title}</h2></div><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">{String(category.items.length).padStart(2, "0")} modules</span></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items.map((item, index) => <Link className="group relative overflow-hidden rounded-[22px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5 shadow-[var(--shadow-sm)] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--ft-accent)]/35 hover:shadow-[var(--shadow-md)]" href={item.href} key={item.href}><div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-[var(--ft-accent-glow)] blur-2xl opacity-0 transition group-hover:opacity-100" /><div className="relative flex items-start justify-between gap-3"><div className="grid size-11 place-items-center rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)] transition group-hover:scale-105"><item.icon className="size-5" /></div><span className="font-mono text-[9px] text-[var(--ft-text-muted)]">0{index + 1}</span></div><div className="relative mt-6 text-sm font-semibold tracking-tight">{item.label}</div><div className="relative mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">{item.description}</div><div className="relative mt-5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ft-accent)]">Open service <ArrowUpRight className="size-3.5" /></div></Link>)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
