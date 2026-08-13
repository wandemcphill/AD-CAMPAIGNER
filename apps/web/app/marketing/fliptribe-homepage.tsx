"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Clock3 } from "lucide-react";

import { Panel } from "@fliptrybe/ui";

import { type Capability, guestServices, networks, pillars } from "./data";
import { MarketingFooter } from "./footer";
import { HeroComposition } from "./hero-composition";
import { MarketingNavigation } from "./navigation";

function FadeUp({
  children,
  delay = 0,
  reducedMotion
}: {
  children: React.ReactNode;
  delay?: number;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, margin: "-80px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Status chip. "Coming soon" is load-bearing: it is the only thing preventing the
 * page from claiming a disabled financial product is available. See data.ts.
 */
function StatusChip({ status }: { status: Capability["status"] }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.04em] text-[var(--ft-green)] uppercase">
        <Check className="size-3" />
        Live
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
      <Clock3 className="size-3" />
      Coming soon
    </span>
  );
}

function CapabilityCard({ capability }: { capability: Capability }) {
  return (
    <Panel className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent-strong)]">
          <capability.icon className="size-5" />
        </span>
        <StatusChip status={capability.status} />
      </div>
      <div className="mt-4 text-sm font-semibold">{capability.title}</div>
      <p className="mt-1.5 text-xs leading-5 text-[var(--ft-text-secondary)]">
        {capability.description}
      </p>
    </Panel>
  );
}

export function FliptribeHomepage() {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(prefersReducedMotion);

  return (
    <main
      className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]"
      id="top"
      style={{ backgroundImage: "var(--ft-bg-page-gradient)" }}
    >
      <MarketingNavigation />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-32 pb-20 sm:px-6 sm:pt-36">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="text-center lg:text-left">
            <FadeUp reducedMotion={reducedMotion}>
              <h1 className="text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Money moves.
                <br />
                Businesses grow.
              </h1>
            </FadeUp>

            <FadeUp delay={0.1} reducedMotion={reducedMotion}>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--ft-text-secondary)] lg:mx-0 lg:text-lg">
                Hold a balance and get paid. Buy airtime, data and pay your bills in
                seconds. Put your business in front of the right customers — all from
                one account.
              </p>
            </FadeUp>

            <FadeUp delay={0.18} reducedMotion={reducedMotion}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <a
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--ft-accent)] px-6 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--ft-accent-dim)] sm:w-auto"
                  href="/register"
                >
                  Get started free
                  <ArrowRight className="size-4" />
                </a>
                <a
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)] px-6 text-sm font-semibold transition hover:border-[var(--ft-border-emphasis)] sm:w-auto"
                  href="/guest"
                >
                  Pay a bill
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.26} reducedMotion={reducedMotion}>
              <p className="mt-4 text-xs text-[var(--ft-text-muted)]">
                No account needed to buy airtime, data, or pay a bill.
              </p>
            </FadeUp>
          </div>

          <FadeUp delay={0.14} reducedMotion={reducedMotion}>
            <HeroComposition reducedMotion={reducedMotion} />
          </FadeUp>
        </div>
      </section>

      {/* ── Three pillars ────────────────────────────────────────────────── */}
      {pillars.map((pillar, pillarIndex) => (
        <section
          className={
            pillarIndex % 2 === 0
              ? "border-t border-[var(--ft-border)] px-4 py-20 sm:px-6"
              : "border-t border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/40 px-4 py-20 sm:px-6"
          }
          id={pillar.id}
          key={pillar.id}
        >
          <div className="mx-auto max-w-6xl">
            <FadeUp reducedMotion={reducedMotion}>
              <div className="max-w-2xl">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ft-accent)]">
                  {pillar.eyebrow}
                </span>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  {pillar.headline}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)] sm:text-base">
                  {pillar.blurb}
                </p>
              </div>
            </FadeUp>

            {/* Networks strip, Services pillar only */}
            {pillar.id === "services" ? (
              <FadeUp delay={0.06} reducedMotion={reducedMotion}>
                <div className="mt-8 flex flex-wrap gap-2">
                  {networks.map((network) => (
                    <span
                      className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] px-4 py-2 text-sm font-semibold"
                      key={network}
                    >
                      {network}
                    </span>
                  ))}
                </div>
              </FadeUp>
            ) : null}

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pillar.capabilities.map((capability, index) => (
                <FadeUp
                  delay={index * 0.05}
                  key={capability.title}
                  reducedMotion={reducedMotion}
                >
                  <CapabilityCard capability={capability} />
                </FadeUp>
              ))}
            </div>

            <FadeUp delay={0.1} reducedMotion={reducedMotion}>
              <a
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]"
                href={pillar.href}
              >
                {pillar.ctaLabel}
                <ArrowRight className="size-4" />
              </a>
            </FadeUp>
          </div>
        </section>
      ))}

      {/* ── Guest checkout ───────────────────────────────────────────────── */}
      <section className="border-t border-[var(--ft-border)] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <FadeUp reducedMotion={reducedMotion}>
            <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-8 shadow-[var(--shadow-lg)] sm:p-10">
              <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Just need airtime? Skip the sign-up.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--ft-text-secondary)]">
                  Buy airtime and data, pay for electricity, cable, exam PINs and more —
                  pay, get your receipt, and go. No account required.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {guestServices.map((service) => (
                  <div
                    className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-2 py-4 text-center"
                    key={service.label}
                  >
                    <service.icon className="size-5 text-[var(--ft-accent)]" />
                    <span className="text-[11px] font-medium leading-tight">
                      {service.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <a
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--ft-accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--ft-accent-dim)]"
                  href="/guest"
                >
                  Pay without an account
                  <ArrowRight className="size-4" />
                </a>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/40 px-4 py-24 sm:px-6">
        <FadeUp reducedMotion={reducedMotion}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              One account for money, services and growth.
            </h2>
            <p className="mt-3 text-sm text-[var(--ft-text-secondary)] sm:text-base">
              Create your FlipTrybe account in under a minute.
            </p>
            <div className="mt-8">
              <a
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--ft-accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--ft-accent-dim)]"
                href="/register"
              >
                Get started free
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
        </FadeUp>
      </section>

      <MarketingFooter />
    </main>
  );
}
