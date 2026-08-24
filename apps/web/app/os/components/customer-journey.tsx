import { Check, Circle, Loader2, ShieldCheck } from "lucide-react";

import { cn } from "@fliptrybe/ui";

export type JourneyStep = {
  label: string;
  detail?: string;
  state?: "complete" | "current" | "upcoming";
};

export function CustomerJourney({
  eyebrow,
  title,
  description,
  steps,
  trustNote = "Review the final amount and destination before confirming."
}: {
  eyebrow: string;
  title: string;
  description: string;
  steps: JourneyStep[];
  trustNote?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)]/90 p-5 shadow-[var(--shadow-md)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">{eyebrow}</div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--ft-text-secondary)]">{description}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)]"><ShieldCheck className="size-3.5 text-[var(--ft-green)]" /> Protected flow</div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const state = step.state ?? (index === 0 ? "current" : "upcoming");
          return <div className={cn("relative rounded-2xl border p-3", state === "current" ? "border-[var(--ft-accent)]/40 bg-[var(--ft-accent-subtle)]" : state === "complete" ? "border-[var(--ft-green)]/20 bg-[var(--ft-green)]/5" : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)]")} key={step.label}>
            <div className="flex items-center gap-2">
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border", state === "complete" ? "border-[var(--ft-green)]/30 bg-[var(--ft-green)]/10 text-[var(--ft-green)]" : state === "current" ? "border-[var(--ft-accent)]/30 bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]" : "border-[var(--ft-border)] text-[var(--ft-text-muted)]")}>
                {state === "complete" ? <Check className="size-3" /> : state === "current" ? <Loader2 className="size-3 animate-spin" /> : <Circle className="size-2.5" />}
              </span>
              <span className="text-xs font-semibold">{step.label}</span>
            </div>
            {step.detail ? <p className="mt-2 pl-8 text-[10px] leading-4 text-[var(--ft-text-muted)]">{step.detail}</p> : null}
          </div>;
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-[var(--ft-border)] pt-3 text-[10px] text-[var(--ft-text-muted)]"><ShieldCheck className="size-3.5 text-[var(--ft-green)]" />{trustNote}</div>
    </section>
  );
}
