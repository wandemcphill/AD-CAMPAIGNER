import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CustomerTransactionJourney } from "./customer-transaction-journey";

export function CustomerJourney({
  eyebrow,
  title,
  description,
  icon: Icon,
  steps: _steps,
  currentStep = 0,
  children,
  className
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  steps: Array<{ label: string; description: string }>;
  currentStep?: number;
  children: ReactNode;
  className?: string;
}) {
  const current = currentStep >= 2 ? "review" : currentStep === 1 ? "quote" : "choose";
  return (
    <section className={className}>
      <div className="mb-4 flex items-start gap-3 rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 shadow-[var(--shadow-sm)]">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"><Icon className="size-5" /></div>
        <div className="min-w-0"><div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">{eyebrow}</div><h1 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{title}</h1><p className="mt-1 text-sm leading-5 text-[var(--ft-text-muted)]">{description}</p></div>
      </div>
      <CustomerTransactionJourney current={current} className="mb-5" />
      {children}
    </section>
  );
}
