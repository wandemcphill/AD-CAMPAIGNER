"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { trackHomepageEvent } from "./analytics";
import { channels, productPillars, trustSignals, workflowSteps } from "./data";
import { MarketingFooter } from "./footer";
import { MarketingNavigation } from "./navigation";

const defaultPrompt = "I sell shoes in Lagos.";

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
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, margin: "-80px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

export function FliptribeHomepage() {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(prefersReducedMotion);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % workflowSteps.length);
    }, 2200);
    return () => window.clearInterval(interval);
  }, []);

  function handleGenerateClick() {
    trackHomepageEvent("command_generated", { prompt });
  }

  return (
    <main
      className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]"
      id="top"
      style={{ backgroundImage: "var(--ft-bg-page-gradient)" }}
    >
      <MarketingNavigation />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-32 pb-20 sm:px-6 sm:pt-40">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_20%_10%,var(--ft-accent-glow),transparent_38%),radial-gradient(circle_at_82%_18%,var(--ft-accent-2-glow),transparent_36%)]" />

        <div className="mx-auto max-w-4xl text-center">
          <FadeUp reducedMotion={reducedMotion}>
            <Badge tone="info">
              <Sparkles className="mr-1 size-3.5" />
              AI growth operating system
            </Badge>
          </FadeUp>

          <FadeUp delay={0.08} reducedMotion={reducedMotion}>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Turn one business idea into paying customers.
            </h1>
          </FadeUp>

          <FadeUp delay={0.16} reducedMotion={reducedMotion}>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--ft-text-secondary)] sm:text-lg">
              FlipTrybe plans your audience, writes your ad copy, designs your creative, and
              launches across Meta, TikTok, Google, and WhatsApp — from one AI-native command
              center.
            </p>
          </FadeUp>

          <FadeUp delay={0.24} reducedMotion={reducedMotion}>
            <div className="mx-auto mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a href="/register">
                <Button className="h-12 px-6 text-sm" onClick={handleGenerateClick}>
                  Get started free
                  <ArrowRight className="size-4" />
                </Button>
              </a>
              <a
                className="inline-flex h-12 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] px-6 text-sm font-semibold text-[var(--ft-text-primary)] transition hover:border-[var(--ft-border-strong)]"
                href="#how-it-works"
              >
                See how it works
              </a>
            </div>
          </FadeUp>

          <FadeUp delay={0.32} reducedMotion={reducedMotion}>
            <div className="mx-auto mt-10 max-w-xl rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 text-left shadow-[var(--shadow-lg)] sm:p-5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ft-text-muted)]">
                <Sparkles className="size-3.5 text-[var(--ft-accent)]" />
                Describe your business
              </div>
              <input
                className="mt-3 h-11 w-full rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none transition focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]"
                onChange={(event) => setPrompt(event.currentTarget.value)}
                placeholder={defaultPrompt}
                value={prompt}
              />
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {workflowSteps.map((step, index) => (
                  <div
                    className="rounded-[var(--radius-sm)] border px-1.5 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.06em] transition"
                    key={step.label}
                    style={
                      index === activeStep
                        ? {
                            borderColor: "var(--ft-accent)",
                            background: "var(--ft-accent-subtle)",
                            color: "var(--ft-accent-strong)"
                          }
                        : {
                            borderColor: "var(--ft-border)",
                            color: "var(--ft-text-muted)"
                          }
                    }
                  >
                    {step.label}
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[var(--ft-border)] px-4 py-20 sm:px-6" id="how-it-works">
        <div className="mx-auto max-w-6xl">
          <FadeUp reducedMotion={reducedMotion}>
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              From idea to live campaign in five steps
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[var(--ft-text-secondary)]">
              Every campaign moves through the same AI pipeline — audience, copy, creative,
              video, and launch.
            </p>
          </FadeUp>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <FadeUp delay={index * 0.06} key={step.label} reducedMotion={reducedMotion}>
                <Panel className="h-full p-5">
                  <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent-strong)]">
                    <step.icon className="size-5" />
                  </div>
                  <div className="mt-4 text-sm font-semibold">{step.label}</div>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--ft-text-secondary)]">
                    {step.detail}
                  </p>
                  <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ft-accent)]">
                    {step.metric}
                  </div>
                </Panel>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Omnichannel */}
      <section className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <FadeUp reducedMotion={reducedMotion}>
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              One campaign, every channel
            </h2>
          </FadeUp>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {channels.map((channel, index) => (
              <FadeUp delay={index * 0.06} key={channel.label} reducedMotion={reducedMotion}>
                <Panel className="p-5 text-center">
                  <channel.icon className="mx-auto size-6 text-[var(--ft-accent)]" />
                  <div className="mt-3 text-sm font-semibold">{channel.label}</div>
                  <div className="mt-1 text-xs text-[var(--ft-text-secondary)]">
                    {channel.metric}
                  </div>
                </Panel>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Product pillars */}
      <section className="border-t border-[var(--ft-border)] px-4 py-20 sm:px-6" id="products">
        <div className="mx-auto max-w-6xl">
          <FadeUp reducedMotion={reducedMotion}>
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a growing business needs
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[var(--ft-text-secondary)]">
              One workspace for campaigns, commerce, and finance.
            </p>
          </FadeUp>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {productPillars.map((pillar, index) => (
              <FadeUp delay={index * 0.06} key={pillar.title} reducedMotion={reducedMotion}>
                <Panel className="flex h-full flex-col p-6">
                  <div className="grid size-11 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent-2-subtle)] text-[var(--ft-accent-2)]">
                    <pillar.icon className="size-5" />
                  </div>
                  <div className="mt-4 text-lg font-semibold">{pillar.title}</div>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                    {pillar.description}
                  </p>
                  <a
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ft-accent)] transition hover:text-[var(--ft-accent-dim)]"
                    href={pillar.href}
                  >
                    {pillar.cta}
                    <ArrowRight className="size-3.5" />
                  </a>
                </Panel>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/40 px-4 py-16 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-4">
          {trustSignals.map((signal) => (
            <span
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] px-4 py-2.5 text-sm font-medium text-[var(--ft-text-secondary)]"
              key={signal.label}
            >
              <signal.icon className="size-4 text-[var(--ft-accent)]" />
              {signal.label}
            </span>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--ft-border)] px-4 py-24 sm:px-6">
        <FadeUp reducedMotion={reducedMotion}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to grow?</h2>
            <p className="mt-3 text-sm text-[var(--ft-text-secondary)] sm:text-base">
              Create your workspace in under a minute — no credit card required to start.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="/register">
                <Button className="h-12 px-6 text-sm">
                  Get started free
                  <ArrowRight className="size-4" />
                </Button>
              </a>
              <a
                className="inline-flex h-12 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--ft-border)] px-6 text-sm font-semibold text-[var(--ft-text-primary)] transition hover:border-[var(--ft-border-strong)]"
                href="/guest"
              >
                Pay a bill as guest
              </a>
            </div>
          </div>
        </FadeUp>
      </section>

      <MarketingFooter />
    </main>
  );
}
