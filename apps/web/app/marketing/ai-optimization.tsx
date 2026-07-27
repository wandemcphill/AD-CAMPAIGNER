"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { channels, optimizationMetrics } from "./data";

type AiOptimizationProps = {
  reducedMotion: boolean;
};

export function AiOptimization({ reducedMotion }: AiOptimizationProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setTick((value) => (value + 1) % 4);
    }, 1400);

    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  return (
    <section className="relative border-t border-white/10 bg-[#050507] px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.26em] text-[var(--flip-indigo)]">
            03 / AI Optimization
          </div>
          <h2 className="mt-4 max-w-xl text-4xl font-black tracking-normal text-white sm:text-5xl">
            Budget shifts before humans notice the pattern.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-white/58">
            The optimization layer watches creative fatigue, channel velocity, message quality, and
            conversion lift, then reallocates spend as a visible operating system.
          </p>
        </div>

        <div className="rounded-md border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {optimizationMetrics.map((metric) => (
              <div className="rounded-md border border-white/10 bg-black/28 p-3" key={metric.label}>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/38">
                  {metric.label}
                </div>
                <motion.div
                  animate={{ y: reducedMotion ? 0 : [4, 0] }}
                  className="mt-3 text-2xl font-black text-white"
                  key={`${metric.label}-${tick}`}
                >
                  {metric.values[tick] ?? metric.values[0]}
                </motion.div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-md border border-white/10 bg-[#060608] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--flip-amber)]">
                  Budget allocator
                </div>
                <div className="mt-2 text-sm text-white/50">Live channel weights</div>
              </div>
              <div className="font-mono text-xs text-[var(--flip-emerald)]">Auto-shifting</div>
            </div>

            <div className="mt-6 space-y-4">
              {channels.map((channel, index) => {
                const base = [45, 26, 18, 34][index] ?? 20;
                const width = reducedMotion ? base : Math.min(82, base + tick * (index + 4));

                return (
                  <div className="grid gap-2" key={channel.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">{channel.label}</span>
                      <span className="font-mono text-white/45">{width}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        animate={{ width: `${width}%` }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: channel.accent }}
                        transition={{ duration: reducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid h-40 grid-cols-12 items-end gap-2">
              {Array.from({ length: 12 }, (_, index) => {
                const height = 24 + ((index * 19 + tick * 13) % 98);

                return (
                  <motion.div
                    animate={{ height }}
                    className="rounded-t-sm bg-[linear-gradient(180deg,var(--flip-emerald),rgba(16,185,129,0.16))]"
                    key={index}
                    transition={{ duration: reducedMotion ? 0 : 0.75 }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
