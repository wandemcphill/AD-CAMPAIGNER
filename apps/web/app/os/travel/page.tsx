"use client";

import Link from "next/link";
import { ArrowRight, Compass, Hotel, Map, Plane, ShieldCheck, Sparkles } from "lucide-react";

const TRAVEL_OPTIONS = [
  { title: "Flights", description: "Search and compare flight options when booking is enabled for your account.", icon: Plane },
  { title: "Safaris", description: "Discover safari experiences and destination ideas for your next trip.", icon: Compass },
  { title: "Tours & activities", description: "Explore tours, experiences and things to do around the world.", icon: Map },
  { title: "Hotels", description: "Find accommodation options alongside your travel plans.", icon: Hotel }
];

export default function TravelHubPage() {
  return (
    <div className="relative px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-[var(--ft-accent-glow)] blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <header className="overflow-hidden rounded-[30px] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)]/85 p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-accent)]/20 bg-[var(--ft-accent-subtle)] px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]"><Sparkles className="size-3" /> Travel</div>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Plan the trip. Then make it happen.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)] sm:text-base">Flights, hotels, safaris, tours and activities belong in the same customer journey as your money tools. This is the travel command center for that experience.</p>
            </div>
            <div className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4 lg:max-w-xs"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-[var(--ft-green)]" /> Booking availability</div><p className="mt-2 text-xs leading-5 text-[var(--ft-text-muted)]">Travel inventory and booking actions become actionable only when the relevant provider capability is enabled. No placeholder checkout is presented as live.</p></div>
          </div>
        </header>
        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{TRAVEL_OPTIONS.map((option) => <article className="rounded-[22px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5 shadow-[var(--shadow-sm)]" key={option.title}><div className="grid size-11 place-items-center rounded-2xl bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]"><option.icon className="size-5" /></div><h2 className="mt-5 text-sm font-semibold">{option.title}</h2><p className="mt-2 min-h-16 text-xs leading-5 text-[var(--ft-text-muted)]">{option.description}</p><span className="mt-4 inline-flex rounded-full bg-[var(--ft-yellow)]/10 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--ft-yellow)]">Booking layer</span></article>)}</section>
        <section className="mt-7 rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--ft-accent)]">Travel + money</div><h2 className="mt-1 text-xl font-semibold">Fund the journey from the same platform.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-muted)]">Use your existing FlipTrybe money tools for supported international spending while the booking layer is connected.</p></div><Link className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--ft-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90" href="/os/financial-products">Open Global Money <ArrowRight className="size-4" /></Link></div></section>
      </div>
    </div>
  );
}
