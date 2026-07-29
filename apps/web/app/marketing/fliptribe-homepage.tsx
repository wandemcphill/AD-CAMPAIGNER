"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, Orbit, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { trackHomepageEvent } from "./analytics";
import { CampaignPreview } from "./campaign-preview";
import { CommandBar } from "./command-bar";
import { generationSteps } from "./data";
import { MarketingFooter } from "./footer";
import { MarketingNavigation } from "./navigation";
import { ParticleCanvas } from "./particle-canvas";

const defaultPrompt = "I sell shoes in Lagos.";
const motionPreferenceKey = "fliptribe-homepage-reduced-motion";

type ReducedMotionSectionProps = {
  reducedMotion: boolean;
};

type FinalCtaSectionProps = ReducedMotionSectionProps & {
  onGenerate: (prompt: string) => void;
};

function SectionLoading({ label }: { label: string }) {
  return (
    <section className="border-t border-white/10 bg-[#050507] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl rounded-md border border-white/10 bg-white/[0.035] p-6">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-white/38">
          Loading {label}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
          <div className="h-full w-1/3 rounded-full bg-[var(--flip-amber)]" />
        </div>
      </div>
    </section>
  );
}

const CreationMatrix = dynamic<ReducedMotionSectionProps>(
  () => import("./creation-matrix").then((module) => module.CreationMatrix),
  { loading: () => <SectionLoading label="Creation Matrix" /> }
);
const OmnichannelHighway = dynamic<ReducedMotionSectionProps>(
  () => import("./omnichannel-highway").then((module) => module.OmnichannelHighway),
  { loading: () => <SectionLoading label="Omnichannel Highway" /> }
);
const AiOptimization = dynamic<ReducedMotionSectionProps>(
  () => import("./ai-optimization").then((module) => module.AiOptimization),
  { loading: () => <SectionLoading label="AI Optimization" /> }
);
const AgencyOs = dynamic<ReducedMotionSectionProps>(
  () => import("./agency-os").then((module) => module.AgencyOs),
  { loading: () => <SectionLoading label="Agency OS" /> }
);
const Marketplace = dynamic<ReducedMotionSectionProps>(
  () => import("./marketplace").then((module) => module.Marketplace),
  { loading: () => <SectionLoading label="Marketplace" /> }
);
const CreativeEngine = dynamic<ReducedMotionSectionProps>(
  () => import("./creative-engine").then((module) => module.CreativeEngine),
  { loading: () => <SectionLoading label="Creative Engine" /> }
);
const FinalCta = dynamic<FinalCtaSectionProps>(
  () => import("./final-cta").then((module) => module.FinalCta),
  { loading: () => <SectionLoading label="Final CTA" /> }
);

export function FliptribeHomepage() {
  const prefersReducedMotion = useReducedMotion();
  const [manualReducedMotion, setManualReducedMotion] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [activeStep, setActiveStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const reducedMotion = Boolean(prefersReducedMotion || manualReducedMotion);

  useEffect(() => {
    setManualReducedMotion(window.localStorage.getItem(motionPreferenceKey) === "true");
  }, []);

  const toggleReducedMotion = () => {
    setManualReducedMotion((value) => {
      const nextValue = !value;
      window.localStorage.setItem(motionPreferenceKey, String(nextValue));
      trackHomepageEvent("motion_preference_toggled", { reducedMotion: nextValue });

      return nextValue;
    });
  };

  useEffect(() => {
    if (!isGenerating) {
      return undefined;
    }

    setActiveStep(0);
    // The interval prints each AI artifact in sequence while the canvas converges.
    const interval = window.setInterval(() => {
      setActiveStep((step) => {
        if (step >= generationSteps.length - 1) {
          window.clearInterval(interval);
          setIsGenerating(false);
          return step;
        }

        return step + 1;
      });
    }, reducedMotion ? 120 : 760);

    return () => window.clearInterval(interval);
  }, [isGenerating, reducedMotion]);

  const nodeCopy = useMemo(
    () => [
      "Idea",
      generationSteps[Math.min(activeStep, generationSteps.length - 1)]?.label ?? "Campaign",
      "Customers"
    ],
    [activeStep]
  );

  const generate = (nextPrompt: string) => {
    setPrompt(nextPrompt);
    setPulseKey((key) => key + 1);
    setIsGenerating(true);
  };

  return (
    <main
      className="flip-home ft-shell min-h-screen overflow-hidden bg-[#0B0F19] text-white"
      id="engine"
      style={{
        "--flip-primary": "#0066FF",
        "--flip-accent": "#8B5CF6",
        "--flip-cyan": "#06B6D4",
        "--flip-emerald": "#10B981",
        "--flip-surface": "#111827",
        "--flip-white": "#F9FAFB"
      } as React.CSSProperties}
    >
      <MarketingNavigation />

      <section className="relative isolate flex min-h-[100svh] items-start px-4 pt-24 pb-14 sm:px-6 lg:pt-28 xl:items-center xl:pt-24">
        <ParticleCanvas pulseKey={pulseKey} reducedMotion={reducedMotion} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_20%,rgba(0,102,255,0.18),transparent_26%),radial-gradient(circle_at_78%_30%,rgba(139,92,246,0.14),transparent_28%),linear-gradient(180deg,rgba(11,15,25,0.1),#0B0F19_92%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:64px_64px]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="mx-auto max-w-5xl text-center">
            <motion.div
              animate={{ scaleX: 1 }}
              className="mx-auto h-px w-48 origin-left bg-[linear-gradient(90deg,transparent,var(--flip-primary),var(--flip-accent),transparent)]"
              initial={{ scaleX: reducedMotion ? 1 : 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
              animate={{ y: 0 }}
              className="mt-5 inline-flex items-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.045] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/56 backdrop-blur-xl sm:mt-6 sm:text-xs"
              initial={{ y: reducedMotion ? 0 : 14 }}
              transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <Orbit className="size-4 text-[var(--flip-primary)]" />
              AI growth operating system
            </motion.div>

            <motion.h1
              animate={{ clipPath: "inset(0% 0% 0% 0%)", y: 0 }}
              className="mx-auto mt-5 max-w-5xl text-balance text-4xl font-black tracking-normal text-white sm:text-6xl lg:text-7xl 2xl:text-8xl"
              initial={{
                clipPath: reducedMotion ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
                y: reducedMotion ? 0 : 28
              }}
              transition={{ delay: 0.18, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              Turn one business idea into customers.
            </motion.h1>

            <motion.p
              animate={{ clipPath: "inset(0% 0% 0% 0%)", y: 0 }}
              className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/62 sm:text-lg lg:text-xl lg:leading-8"
              initial={{
                clipPath: reducedMotion ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
                y: reducedMotion ? 0 : 18
              }}
              transition={{ delay: 0.28, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              Fliptribe assembles audience intelligence, creative, distribution, and optimization
              into one living campaign engine.
            </motion.p>

            <CommandBar isGenerating={isGenerating} onGenerate={generate} prompt={prompt} />

            <div className="mx-auto mt-5 grid max-w-2xl grid-cols-3 gap-2">
              {nodeCopy.map((item, index) => (
                <motion.div
                  animate={{ y: index <= Math.min(activeStep, 2) ? 0 : 8 }}
                  className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/48"
                  initial={false}
                  key={`${item}-${index}`}
                >
                  {item}
                </motion.div>
              ))}
            </div>
          </div>

          <CampaignPreview activeStep={activeStep} prompt={prompt} />

          <a
            className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-[12px] border border-white/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.24em] text-white/48 transition hover:border-white/24 hover:text-white"
            href="#phase-one"
          >
            <Sparkles className="size-4 text-[var(--flip-primary)]" />
            Phase engine online
            <ArrowDown className="size-4" />
          </a>
        </div>
      </section>

      <div id="phase-one">
        <CreationMatrix reducedMotion={reducedMotion} />
        <OmnichannelHighway reducedMotion={reducedMotion} />
        <AiOptimization reducedMotion={reducedMotion} />
        <AgencyOs reducedMotion={reducedMotion} />
        <Marketplace reducedMotion={reducedMotion} />
        <CreativeEngine reducedMotion={reducedMotion} />
        <FinalCta onGenerate={generate} reducedMotion={reducedMotion} />
      </div>

      <MarketingFooter
        onToggleReducedMotion={toggleReducedMotion}
        reducedMotion={reducedMotion}
      />
    </main>
  );
}
