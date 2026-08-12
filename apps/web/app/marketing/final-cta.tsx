"use client";

import { motion } from "framer-motion";
import { ArrowUp, Command, Sparkles } from "lucide-react";

import { trackHomepageEvent } from "./analytics";
import { finalCollapseItems } from "./data";

type FinalCtaProps = {
  onGenerate: (prompt: string) => void;
  reducedMotion: boolean;
};

const finalPrompt = "Grow my business.";

export function FinalCta({ onGenerate, reducedMotion }: FinalCtaProps) {
  const launch = () => {
    trackHomepageEvent("final_cta_started", { prompt: finalPrompt });
    onGenerate(finalPrompt);
    window.requestAnimationFrame(() => {
      document.getElementById("engine")?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start"
      });
    });
  };

  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[#050507] px-4 py-20 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,138,0,0.16),transparent_34%),radial-gradient(circle_at_64%_62%,rgba(16,185,129,0.12),transparent_28%)]" />
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="font-mono text-xs uppercase tracking-[0.26em] text-[var(--flip-amber)]">
          07 / Collapse to Command
        </div>
        <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-normal text-white sm:text-5xl">
          Every system returns to one instruction.
        </h2>

        <div className="mx-auto mt-10 grid max-w-4xl gap-2 sm:grid-cols-3">
          {finalCollapseItems.map((item, index) => (
            <motion.div
              animate={
                reducedMotion
                  ? { opacity: 1, x: 0, y: 0 }
                  : {
                      opacity: [0.56, 1, 0.72],
                      x: [0, (index % 3) * -8 + 8, 0],
                      y: [0, Math.floor(index / 3) * -8 + 6, 0]
                    }
              }
              className="rounded-md border border-white/10 bg-white/[0.045] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/52 backdrop-blur-xl"
              key={item}
              transition={{ delay: index * 0.1, duration: 3, repeat: reducedMotion ? 0 : Infinity }}
            >
              {item}
            </motion.div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-md border border-white/12 bg-white/[0.07] p-2 shadow-[0_30px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <span className="flex h-11 items-center gap-2 rounded-md border border-white/10 bg-black/24 px-3 font-mono text-xs uppercase tracking-[0.22em] text-white/50">
              <Command className="size-4 text-[var(--flip-amber)]" />
              Final
            </span>
            <div className="flex h-12 items-center rounded-md bg-black/10 px-3 text-left text-base font-semibold text-white">
              {finalPrompt}
            </div>
            <button
              className="group flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--flip-amber)] px-5 text-sm font-bold text-[#050507] transition hover:bg-white"
              onClick={launch}
              type="button"
            >
              Start growing
              <ArrowUp className="size-4 transition group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>

        {/* "Start growing" replays the hero demo, which leaves the page with no
            way out. These are the actual conversion destinations. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            className="flex h-11 items-center rounded-md bg-white px-5 text-sm font-bold text-[#050507] transition hover:bg-white/85"
            href="/register"
          >
            Create your account
          </a>
          <a
            className="flex h-11 items-center rounded-md border border-white/16 px-5 text-sm font-semibold text-white/76 transition hover:border-white/32 hover:text-white"
            href="/guest"
          >
            Buy airtime, data &amp; bills
          </a>
        </div>

        <p className="mx-auto mt-5 flex max-w-xl items-center justify-center gap-2 text-sm leading-6 text-white/50">
          <Sparkles className="size-4 text-[var(--flip-amber)]" />
          The hero engine receives the final prompt and assembles a new campaign packet.
        </p>
      </div>
    </section>
  );
}
