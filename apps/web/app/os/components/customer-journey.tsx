import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check } from "lucide-react";

import { cn } from "@fliptrybe/ui";

type JourneyStep = {
  label: string;
  description: string;
};

type CustomerJourneyProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  steps: JourneyStep[];
  currentStep?: number;
  children: ReactNode;
  className?: string;
};

export function CustomerJourney({
  eyebrow,
  title,
  description,
  icon: Icon,
  steps,
  currentStep = 0,
  children,
  className
}: CustomerJourneyProps) {
  return (
    <section className={cn("mt-6 overflow-hidden rounded-[28px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-md)]", className)}>
      <header className="relative border-b border-[var(--ft-border)] px-5 py-5 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-[var(--ft-accent)]/10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[var(--ft-accent)]/20 bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"><Icon className="size-5" /></div>
          <div><div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">{eyebrow}</div><h1 className="mt-1 text-xl font-semibold tracking-[-0.025em]">{title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ft-text-muted)]">{description}</p></div>
        </div>
        <ol className="relative mt-5 grid gap-2 sm:grid-cols-4">
          {steps.map((step, index) => {
            const done = index < currentStep;
            const active = index === currentStep;
            return <li className={cn("relative rounded-2xl border p-3", active ? "border-[var(--ft-accent)]/35 bg-[var(--ft-accent)]/8" : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)]")} key={step.label}>
              <div className="flex items-center gap-2"><span className={cn("grid size-6 place-items-center rounded-full text-[10px] font-bold", done ? "bg-[var(--ft-green)]/15 text-[var(--ft-green)]" : active ? "bg-[var(--ft-accent)] text-white" : "bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]")}>{done ? <Check className="size-3" /> : index + 1}</span><span className="text-xs font-semibold">{step.label}</span></div>
              <p className="mt-2 text-[10px] leading-4 text-[var(--ft-text-muted)]">{step.description}</p>
            </li>;
          })}
        </ol>
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      <footer className="flex items-center justify-between gap-3 border-t border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/35 px-5 py-3 sm:px-6"><span className="text-[10px] text-[var(--ft-text-muted)]">Review every amount, rate and recipient before confirming.</span><ArrowRight className="size-4 text-[var(--ft-text-muted)]" /></footer>
    </section>
  );
}
