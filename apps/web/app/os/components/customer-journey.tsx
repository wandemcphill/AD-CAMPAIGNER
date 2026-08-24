import type { LucideIcon } from "lucide-react";
import { cn } from "@fliptrybe/ui";

export type JourneyStep = { label: string; description?: string; icon?: LucideIcon };

export function CustomerJourney({ steps, active = 0, className }: { steps: JourneyStep[]; active?: number; className?: string }) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-4", className)} aria-label="Journey progress">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const complete = index < active;
        const current = index === active;
        return (
          <div className={cn("relative rounded-2xl border p-3 transition", current ? "border-[var(--ft-accent)]/40 bg-[var(--ft-accent)]/8" : complete ? "border-[var(--ft-green)]/25 bg-[var(--ft-green)]/5" : "border-[var(--ft-border)] bg-[var(--ft-bg-raised)]")} key={step.label}>
            <div className="flex items-center gap-2">
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold", current ? "bg-[var(--ft-accent)] text-white" : complete ? "bg-[var(--ft-green)]/15 text-[var(--ft-green)]" : "bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]")}>{Icon ? <Icon className="size-3.5" /> : index + 1}</span>
              <div className="min-w-0"><div className="truncate text-xs font-semibold">{step.label}</div>{step.description ? <div className="mt-0.5 truncate text-[10px] text-[var(--ft-text-muted)]">{step.description}</div> : null}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
