import Link from "next/link";
import { ArrowUpRight, Globe2, ShieldCheck, Sparkles } from "lucide-react";
import { trustSignals } from "./data";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl space-y-10">
        <section className="ft-hero-surface relative overflow-hidden rounded-[30px] p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 size-52 rounded-full bg-[var(--ft-accent-2-glow)] blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
            <div>
              <div className="ft-eyebrow">FlipTrybe Technology</div>
              <div className="mt-4 flex items-center gap-3">
                <img alt="FlipTrybe Technology" className="h-9 w-auto" src="/brand/logo-horizontal-light.svg" />
                <span className="hidden border-l border-[var(--ft-border)] pl-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ft-text-muted)] sm:inline">Intelligent commerce infrastructure</span>
              </div>
              <h2 className="mt-5 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">One platform. Many systems. One connected operating layer.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--ft-text-secondary)]">Money movement, digital services, commerce, advertising and growth infrastructure connected by one account and one system of record.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="inline-flex items-center gap-2 rounded-full bg-[var(--ft-text-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--ft-text-inverse)] shadow-[var(--shadow-md)] transition hover:-translate-y-0.5" href="/register">Enter the platform <ArrowUpRight className="size-4" /></Link>
                <Link className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--ft-accent)]" href="/#platform">Explore the system</Link>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {trustSignals.map((item) => (
                <div className="ft-system-card rounded-2xl p-4" key={item.label}>
                  <div className="flex items-center justify-between gap-3"><item.icon className="size-4 text-[var(--ft-accent)]" /><span className="ft-live-pill"><span className="ft-live-dot" /> platform</span></div>
                  <div className="mt-3 text-xs font-semibold">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_.8fr_.8fr_.8fr]">
          <div><div className="ft-section-label">Platform</div><div className="mt-4 grid gap-2 text-sm text-[var(--ft-text-secondary)]"><Link className="hover:text-[var(--ft-text-primary)]" href="/#platform">The platform</Link><Link className="hover:text-[var(--ft-text-primary)]" href="/#intelligence">Intelligence layer</Link><Link className="hover:text-[var(--ft-text-primary)]" href="/pricing">Pricing</Link><Link className="hover:text-[var(--ft-text-primary)]" href="/register">Enter platform</Link></div></div>
          <div><div className="ft-section-label">Technology</div><div className="mt-4 grid gap-2 text-sm text-[var(--ft-text-secondary)]"><span>Money & wallet</span><span>Services & commerce</span><span>Growth infrastructure</span><span>AI intelligence layer</span></div></div>
          <div><div className="ft-section-label">Company</div><div className="mt-4 grid gap-2 text-sm text-[var(--ft-text-secondary)]"><Link className="hover:text-[var(--ft-text-primary)]" href="/terms">Terms</Link><Link className="hover:text-[var(--ft-text-primary)]" href="/privacy">Privacy</Link><a className="hover:text-[var(--ft-text-primary)]" href="mailto:hello@fliptrybe.xyz">Contact</a></div></div>
          <div><div className="ft-section-label">Signal</div><div className="mt-4 grid gap-3"><div className="flex items-center gap-2 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs"><ShieldCheck className="size-4 text-[var(--ft-green)]" />Trusted infrastructure</div><div className="flex items-center gap-2 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs"><Sparkles className="size-4 text-[var(--ft-accent-2)]" />AI-native platform</div><div className="flex items-center gap-2 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs"><Globe2 className="size-4 text-[var(--ft-accent)]" />Built in Africa. Connected globally.</div></div></div>
        </div>

        <div className="ft-hairline" />
        <div className="flex flex-col gap-3 text-xs text-[var(--ft-text-muted)] sm:flex-row sm:items-center sm:justify-between"><span>© 2026 FlipTrybe Technology. All rights reserved.</span><a className="inline-flex items-center gap-1 font-medium hover:text-[var(--ft-text-primary)]" href="mailto:hello@fliptrybe.xyz">hello@fliptrybe.xyz <ArrowUpRight className="size-3" /></a></div>
      </div>
    </footer>
  );
}
