import { Check } from "lucide-react";
import { cn } from "@fliptrybe/ui";

export type TransactionJourneyStage = "choose" | "quote" | "review" | "complete";

const STAGES: Array<{ id: TransactionJourneyStage; label: string; description: string }> = [
  { id: "choose", label: "Choose", description: "Select what you need" },
  { id: "quote", label: "Quote", description: "See rate, fee or value" },
  { id: "review", label: "Review", description: "Check the details" },
  { id: "complete", label: "Complete", description: "Track the result" }
];

const ORDER: Record<TransactionJourneyStage, number> = { choose: 0, quote: 1, review: 2, complete: 3 };

export function CustomerTransactionJourney({
  current = "choose",
  className,
  compact = false
}: {
  current?: TransactionJourneyStage;
  className?: string;
  compact?: boolean;
}) {
  const currentIndex = ORDER[current];
  return (
    <div
      aria-label={`Transaction journey. Current stage: ${STAGES[currentIndex]?.label ?? "Choose"}`}
      className={cn("grid grid-cols-4 gap-1.5", className)}
    >
      {STAGES.map((stage, index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div className="min-w-0" key={stage.id}>
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                complete || active ? "bg-[var(--ft-accent)]" : "bg-[var(--ft-border)]"
              )}
            />
            <div
              className={cn(
                "mt-2 flex items-center gap-1.5 text-[10px] font-semibold",
                active ? "text-[var(--ft-text-primary)]" : "text-[var(--ft-text-muted)]"
              )}
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full text-[8px]",
                  complete
                    ? "bg-[var(--ft-green)]/15 text-[var(--ft-green)]"
                    : active
                      ? "border border-[var(--ft-accent)] text-[var(--ft-accent)]"
                      : "border border-[var(--ft-border)] text-[var(--ft-text-muted)]"
                )}
              >
                {complete ? <Check className="size-2.5" /> : index + 1}
              </span>
              <span className="truncate">{stage.label}</span>
            </div>
            {!compact ? (
              <div className="mt-0.5 truncate pl-5 text-[9px] leading-3 text-[var(--ft-text-muted)]">
                {stage.description}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
