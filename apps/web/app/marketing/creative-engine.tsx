"use client";

import { motion } from "framer-motion";

import { creativePipeline } from "./data";

type CreativeEngineProps = {
  reducedMotion: boolean;
};

export function CreativeEngine({ reducedMotion }: CreativeEngineProps) {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[linear-gradient(180deg,#08080c,#050507)] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <div className="font-mono text-xs uppercase tracking-[0.26em] text-[var(--flip-amber)]">
            06 / Creative Engine
          </div>
          <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-normal text-white sm:text-5xl">
            Prompt to final ad, assembled as one pipeline.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/58">
            The creative engine keeps every intermediate artifact visible so teams can inspect,
            tune, and ship without losing the campaign thread.
          </p>
        </div>

        <div className="relative mt-12 overflow-x-auto pb-4">
          <div className="relative grid min-w-[1080px] grid-cols-6 gap-4">
            <svg aria-hidden="true" className="absolute top-1/2 right-16 left-16 h-16 -translate-y-1/2" viewBox="0 0 960 64">
              <motion.path
                animate={{ pathLength: reducedMotion ? 1 : [0.18, 1] }}
                d="M0 32 C120 8 190 56 300 32 S500 8 620 32 S790 56 960 28"
                fill="none"
                stroke="url(#creativeFlow)"
                strokeLinecap="round"
                strokeWidth="3"
                transition={{ duration: 3.8, repeat: reducedMotion ? 0 : Infinity }}
              />
              <defs>
                <linearGradient id="creativeFlow" x1="0" x2="1">
                  <stop offset="0%" stopColor="#FF8A00" />
                  <stop offset="34%" stopColor="#5E5CE6" />
                  <stop offset="67%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#F9FAFB" />
                </linearGradient>
              </defs>
            </svg>

            {creativePipeline.map((stage, index) => {
              const Icon = stage.icon;

              return (
                <motion.article
                  animate={{ scale: reducedMotion ? 1 : [1, 1.025, 1] }}
                  className="relative min-h-[310px] rounded-md border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl"
                  key={stage.label}
                  transition={{ delay: index * 0.14, duration: 3.2, repeat: reducedMotion ? 0 : Infinity }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="grid size-12 place-items-center rounded-md border border-white/10"
                      style={{ color: stage.accent }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-white/38">0{index + 1}</span>
                  </div>
                  <h3 className="mt-7 text-2xl font-bold text-white">{stage.label}</h3>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-white/55">{stage.text}</p>
                  <div className="mt-8 rounded-md border border-white/10 bg-[#060608] p-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((cell) => (
                        <motion.span
                          animate={{
                            opacity: reducedMotion ? 0.72 : [0.28, 0.86, 0.44],
                            scaleY: reducedMotion ? 1 : [0.7, 1, 0.82]
                          }}
                          className="h-12 rounded-sm"
                          key={cell}
                          style={{
                            backgroundColor: stage.accent,
                            transformOrigin: "bottom"
                          }}
                          transition={{ delay: cell * 0.16, duration: 2.2, repeat: reducedMotion ? 0 : Infinity }}
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
