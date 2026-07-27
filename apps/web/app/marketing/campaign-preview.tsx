"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, Check, CircuitBoard, Play } from "lucide-react";

import { generationSteps, proofSignals } from "./data";

type CampaignPreviewProps = {
  activeStep: number;
  prompt: string;
};

function CampaignSketch({ activeStep }: { activeStep: number }) {
  const progress = Math.min(1, (activeStep + 1) / generationSteps.length);

  return (
    <svg
      aria-hidden="true"
      className="h-full min-h-[260px] w-full"
      role="img"
      viewBox="0 0 520 330"
    >
      <defs>
        <linearGradient id="meshGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FF8A00" stopOpacity="0.92" />
          <stop offset="52%" stopColor="#5E5CE6" stopOpacity="0.74" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.82" />
        </linearGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <rect fill="rgba(255,255,255,0.035)" height="270" rx="22" width="410" x="55" y="30" />
      <path
        d="M91 238 C143 162 193 233 252 132 C307 38 354 151 429 82"
        fill="none"
        stroke="url(#meshGradient)"
        strokeDasharray={`${progress * 520} 520`}
        strokeLinecap="round"
        strokeWidth="5"
      />
      <path
        d="M108 106 L178 70 L260 88 L338 58 L410 112 L382 218 L286 257 L177 230 Z"
        fill="none"
        opacity="0.44"
        stroke="rgba(255,255,255,0.22)"
        strokeDasharray="8 12"
      />
      {generationSteps.map((step, index) => {
        const x = [108, 178, 260, 338, 410][index] ?? 108;
        const y = [106, 70, 88, 58, 112][index] ?? 106;
        const isDone = index <= activeStep;

        return (
          <g key={step.label}>
            <circle
              cx={x}
              cy={y}
              fill={isDone ? step.accent : "rgba(255,255,255,0.09)"}
              filter={isDone ? "url(#softGlow)" : undefined}
              r={isDone ? 22 : 11}
            />
            <circle
              cx={x}
              cy={y}
              fill={isDone ? step.accent : "rgba(255,255,255,0.14)"}
              r={isDone ? 8 : 5}
            />
          </g>
        );
      })}
      <g transform="translate(145 148)">
        <rect fill="#09090d" height="92" rx="16" stroke="rgba(255,255,255,0.14)" width="142" />
        <rect fill="url(#meshGradient)" height="40" rx="10" width="104" x="18" y="16" />
        <rect fill="rgba(255,255,255,0.52)" height="5" rx="2.5" width="86" x="18" y="67" />
        <rect fill="rgba(255,255,255,0.24)" height="5" rx="2.5" width="58" x="18" y="78" />
      </g>
      <g transform="translate(308 164)">
        <rect fill="#09090d" height="78" rx="16" stroke="rgba(255,255,255,0.14)" width="94" />
        <circle cx="47" cy="39" fill="rgba(255,255,255,0.1)" r="23" />
        <path d="M42 28 L60 39 L42 50 Z" fill="#FF8A00" />
      </g>
    </svg>
  );
}

export function CampaignPreview({ activeStep, prompt }: CampaignPreviewProps) {
  return (
    <section
      aria-label="Generated campaign preview"
      className="relative mx-auto mt-8 grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="min-w-0 overflow-hidden rounded-md border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 shadow-[0_40px_140px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--flip-amber)]">
              Sovereign Canvas
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">{prompt}</h2>
          </div>
          <span className="flex items-center gap-2 rounded-md border border-white/10 bg-black/24 px-3 py-2 font-mono text-xs text-white/58">
            <Activity className="size-4 text-[var(--flip-emerald)]" />
            60fps
          </span>
        </div>
        <div className="relative rounded-md border border-white/10 bg-[#060608]">
          <CampaignSketch activeStep={activeStep} />
          <div className="absolute right-4 bottom-4 left-4 grid gap-2 sm:grid-cols-4">
            {proofSignals.map((signal, index) => (
              <motion.div
                animate={{ clipPath: index <= activeStep ? "inset(0% 0% 0% 0%)" : "inset(0% 100% 0% 0%)" }}
                className="rounded-md border border-white/10 bg-black/44 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60"
                initial={false}
                key={signal}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                {signal}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-md border border-white/10 bg-[rgba(255,255,255,0.055)] p-4 backdrop-blur-2xl">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.24em] text-white/48">
          <CircuitBoard className="size-4 text-[var(--flip-indigo)]" />
          Live assembly
        </div>
        <div className="mt-5 space-y-3">
          {generationSteps.map((step, index) => {
            const Icon = step.icon;
            const isDone = index < activeStep;
            const isActive = index === activeStep;

            return (
              <motion.div
                animate={{
                  borderColor: isActive ? step.accent : "rgba(255,255,255,0.1)",
                  x: isActive ? 4 : 0
                }}
                className="rounded-md border bg-black/24 p-3"
                initial={false}
                key={step.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-md"
                      style={{ backgroundColor: `${step.accent}22`, color: step.accent }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <div className="font-semibold text-white">{step.label}</div>
                      <div className="mt-1 text-sm leading-5 text-white/50">{step.detail}</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-white/52">{step.metric}</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    animate={{ width: isDone || isActive ? "100%" : "0%" }}
                    className="h-full rounded-full"
                    initial={false}
                    style={{ backgroundColor: step.accent }}
                    transition={{ duration: isActive ? 1.1 : 0.25 }}
                  />
                </div>
                <AnimatePresence>
                  {isDone ? (
                    <motion.div
                      animate={{ scale: 1 }}
                      className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--flip-emerald)]"
                      initial={{ scale: 0.92 }}
                      key="done"
                    >
                      <Check className="size-3" />
                      Printed
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.08)] px-3 py-2 text-sm text-white/62">
          <Play className="size-4 text-[var(--flip-emerald)]" />
          Campaign packet routes when the final node seals.
        </div>
      </div>
    </section>
  );
}
