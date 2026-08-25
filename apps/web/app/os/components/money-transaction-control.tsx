import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { cn } from "@fliptrybe/ui";

const STEPS = ["Choose", "Quote", "Review", "Complete"] as const;

export function MoneyTransactionControl({
  current = "Choose",
  activityHref = "/os/activity",
  className
}: {
  current?: (typeof STEPS)[number];
  activityHref?: Route;
  className?: string;
}) {
  const currentIndex = STEPS.indexOf(current);

  return (
    <section
      aria-label="Money transaction progress"
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 shadow-[var(--shadow-xs)]",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ft-text-muted)]">
            <ShieldCheck className="size-3.5 text-[var(--ft-green)]" />
            Protected transaction flow
          </div>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            We show the quote before confirmation and keep the result in your activity.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ft-accent)] hover:underline"
          href={activityHref}
        >
          View activity <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {STEPS.map((step, index) => {
          const active = index === currentIndex;
          const complete = index < currentIndex;
          return (
            <div className="min-w-0" key={step}>
              <div
                className={cn(
                  "h-1 rounded-full",
                  active || complete ? "bg-[var(--ft-accent)]" : "bg-[var(--ft-border)]"
                )}
              />
              <div
                className={cn(
                  "mt-1.5 truncate text-[10px] font-semibold",
                  active ? "text-[var(--ft-text-primary)]" : "text-[var(--ft-text-muted)]"
                )}
              >
                {step}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
