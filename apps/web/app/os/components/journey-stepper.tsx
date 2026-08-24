import { Check } from "lucide-react";
import { cn } from "@fliptrybe/ui";

export type JourneyStep = "choose" | "quote" | "review" | "complete";

const STEPS: Array<{ id: JourneyStep; label: string }> = [
  { id: "choose", label: "Choose" },
  { id: "quote", label: "Quote" },
  { id: "review", label: "Review" },
  { id: "complete", label: "Complete" }
];

const ORDER: Record<JourneyStep, number> = { choose: 0, quote: 1, review: 2, complete: 3 };

export function JourneyStepper({ current, className }: { current: JourneyStep; className?: string }) {
  const currentIndex = ORDER[current];
  return (
    <div aria-label="Transaction progress" className={cn("grid grid-cols-4 gap-1", className)} role="list">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div className="min-w-0" key={step.id} role="listitem">
            <div className={cn("h-1 rounded-full", done || active ? "bg-[var(--ft-accent)]" : "bg-[var(--ft-border)]")} />
            <div className={cn("mt-2 flex items-center gap-1.5 text-[10px] font-medium", active ? "text-[var(--ft-text-primary)]" : "text-[var(--ft-text-muted)]")}>
              {done ? <Check className="size-3" /> : <span className={cn("grid size-3 place-items-center rounded-full border text-[8px]", active ? "border-[var(--ft-accent)] text-[var(--ft-accent)]" : "border-[var(--ft-border)]")}>{index + 1}</span>}
              <span className="truncate">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
