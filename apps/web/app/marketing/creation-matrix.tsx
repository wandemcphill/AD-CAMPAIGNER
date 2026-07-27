"use client";

import { motion } from "framer-motion";

import { creationNodes } from "./data";

type CreationMatrixProps = {
  reducedMotion: boolean;
};

export function CreationMatrix({ reducedMotion }: CreationMatrixProps) {
  return (
    <section className="relative border-t border-white/10 bg-[#050507] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.26em] text-[var(--flip-amber)]">
              01 / Creation Matrix
            </div>
            <h2 className="mt-4 max-w-xl text-4xl font-black tracking-normal text-white sm:text-5xl">
              AI assets assemble as one production line.
            </h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-white/58 lg:justify-self-end">
            Fliptribe turns a business prompt into coordinated video, motion, flyers, copy, and
            product visuals without splitting the operator across separate tools.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto pb-4 [scrollbar-width:thin]">
          <div className="relative grid min-w-[980px] grid-cols-5 gap-4">
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute top-24 right-20 left-20 h-24"
              viewBox="0 0 900 96"
            >
              <motion.path
                animate={{ pathLength: reducedMotion ? 1 : [0.2, 1, 0.72, 1] }}
                d="M0 48 C150 10 270 86 420 42 S690 12 900 52"
                fill="none"
                stroke="url(#creationBeam)"
                strokeLinecap="round"
                strokeWidth="3"
                transition={{ duration: 5.2, repeat: reducedMotion ? 0 : Infinity }}
              />
              <defs>
                <linearGradient id="creationBeam" x1="0" x2="1">
                  <stop offset="0%" stopColor="#FF8A00" />
                  <stop offset="52%" stopColor="#5E5CE6" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>

            {creationNodes.map((node, index) => {
              const Icon = node.icon;

              return (
                <motion.article
                  animate={reducedMotion ? { y: 0 } : { y: [0, -8, 0] }}
                  className="relative min-h-[330px] overflow-hidden rounded-md border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
                  key={node.label}
                  transition={{ delay: index * 0.12, duration: 3.8, repeat: Infinity }}
                >
                  <div
                    className="absolute inset-x-8 top-0 h-px"
                    style={{ backgroundColor: node.accent }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="grid size-11 place-items-center rounded-md border border-white/10"
                      style={{ color: node.accent }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-white/40">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-2xl font-bold text-white">{node.label}</h3>
                  <p className="mt-4 text-sm leading-6 text-white/55">{node.copy}</p>
                  <div className="mt-6 rounded-md border border-white/10 bg-black/30 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/38">
                      Output
                    </div>
                    <div className="mt-2 font-semibold text-white">{node.output}</div>
                    <div className="mt-4 grid grid-cols-4 gap-1">
                      {[0, 1, 2, 3].map((bar) => (
                        <motion.span
                          animate={{ height: reducedMotion ? 28 + bar * 7 : [18, 42 + bar * 8, 26] }}
                          className="rounded-sm"
                          key={bar}
                          style={{ backgroundColor: node.accent }}
                          transition={{ delay: bar * 0.16, duration: 2.4, repeat: reducedMotion ? 0 : Infinity }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
