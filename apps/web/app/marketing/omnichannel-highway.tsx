"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { trackHomepageEvent } from "./analytics";
import { channels } from "./data";

type OmnichannelHighwayProps = {
  reducedMotion: boolean;
};

export function OmnichannelHighway({ reducedMotion }: OmnichannelHighwayProps) {
  const [activeChannel, setActiveChannel] = useState(channels[0]?.label ?? "Meta");
  const selectChannel = (channel: string) => {
    setActiveChannel(channel);
    trackHomepageEvent("omnichannel_channel_selected", { channel });
  };

  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[linear-gradient(180deg,#050507,#090910)] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <div className="font-mono text-xs uppercase tracking-[0.26em] text-[var(--flip-emerald)]">
            02 / Omnichannel Distribution
          </div>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-normal text-white sm:text-5xl">
            One engine routes every channel with intent.
          </h2>
        </div>

        <div className="relative mx-auto mt-12 min-h-[560px] max-w-5xl rounded-md border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:p-8">
          <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 1000 560">
            <defs>
              <radialGradient id="engineGlow">
                <stop offset="0%" stopColor="#FF8A00" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#FF8A00" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="500" cy="280" fill="url(#engineGlow)" r="190" />
            {channels.map((channel, index) => {
              const points = [
                [205, 145],
                [795, 145],
                [795, 415],
                [205, 415]
              ] as const;
              const [x, y] = points[index] ?? points[0];
              const isActive = channel.label === activeChannel;

              return (
                <motion.path
                  animate={{
                    opacity: isActive ? 1 : 0.24,
                    pathLength: reducedMotion ? 1 : isActive ? [0.15, 1] : 0.7
                  }}
                  d={`M500 280 C500 ${y}, ${x} 280, ${x} ${y}`}
                  fill="none"
                  key={channel.label}
                  stroke={channel.accent}
                  strokeDasharray="8 12"
                  strokeLinecap="round"
                  strokeWidth={isActive ? 4 : 2}
                  transition={{ duration: 1.6, repeat: reducedMotion || !isActive ? 0 : Infinity }}
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 grid place-items-center">
            <motion.div
              animate={reducedMotion ? { scale: 1 } : { scale: [1, 1.035, 1] }}
              className="grid size-44 place-items-center rounded-full border border-[rgba(255,138,0,0.35)] bg-[#050507] text-center shadow-[0_0_90px_rgba(255,138,0,0.25)]"
              transition={{ duration: 2.8, repeat: Infinity }}
            >
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--flip-amber)]">
                  Fliptribe
                </div>
                <div className="mt-2 text-2xl font-black text-white">Engine</div>
              </div>
            </motion.div>
          </div>

          <div className="relative grid min-h-[500px] grid-cols-1 gap-4 sm:grid-cols-2">
            {channels.map((channel, index) => {
              const Icon = channel.icon;
              const isActive = channel.label === activeChannel;
              const position = [
                "sm:self-start sm:justify-self-start",
                "sm:self-start sm:justify-self-end",
                "sm:self-end sm:justify-self-end",
                "sm:self-end sm:justify-self-start"
              ][index] ?? "sm:self-start sm:justify-self-start";

              return (
                <button
                  className={`z-10 w-full max-w-64 rounded-md border p-4 text-left transition ${position} ${
                    isActive
                      ? "border-white/24 bg-white/[0.09] shadow-[0_20px_80px_rgba(0,0,0,0.28)]"
                      : "border-white/10 bg-black/28 hover:border-white/20"
                  }`}
                  key={channel.label}
                  onClick={() => selectChannel(channel.label)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="grid size-11 place-items-center rounded-md border border-white/10"
                      style={{ color: channel.accent }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-white/45">{channel.metric}</span>
                  </div>
                  <div className="mt-5 text-2xl font-bold text-white">{channel.label}</div>
                  <div className="mt-2 text-sm text-white/50">
                    {isActive ? "Particle flow redirected" : "Tap to reroute budget"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
