import type { ReactNode } from "react";

import { Badge, cn } from "@fliptrybe/ui";

import { statusTone, type GrowthOrder, type GrowthOrderStatus } from "./data";

export function PageHeader({
  eyebrow,
  title,
  action
}: {
  eyebrow: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--ft-border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
        <h1 className="mt-3 text-2xl font-medium tracking-normal text-[var(--ft-text-primary)] sm:text-3xl">
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}

export function ErrorNotice({ message }: { message?: string | undefined }) {
  if (!message) {
    return null;
  }

  const technicalMessage =
    message.length > 180 ||
    /api|badrequest|exception|failed to fetch|forbidden|http|internal server|json|load failed|networkerror|stack|status code|trace|unauthorized/i.test(
      message
    );

  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] p-3 text-sm text-[var(--ft-yellow)]">
      {technicalMessage
        ? "Growth Services could not refresh right now. Showing the local catalog."
        : message}
    </div>
  );
}

export function GrowthStatusBadge({ status }: { status: GrowthOrderStatus }) {
  return (
    <Badge tone={statusTone[status]}>
      <span className={cn("mr-1.5 inline-block size-1.5 rounded-full", statusDot[status])} />
      {statusLabel[status]}
    </Badge>
  );
}

export function DeliveryMeter({ order }: { order: GrowthOrder }) {
  const percent =
    order.quantityOrdered > 0
      ? Math.round((order.quantityDelivered / order.quantityOrdered) * 100)
      : 0;

  return (
    <div className="grid gap-2">
      <div className="flex justify-between font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        <span>
          {order.quantityDelivered.toLocaleString()} / {order.quantityOrdered.toLocaleString()}
        </span>
        <span>{Math.min(100, Math.max(0, percent))}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--ft-bg-muted)]">
        <div
          className="h-full rounded-full bg-[var(--ft-accent)] transition-all"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

const statusLabel = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
  REFUNDED: "Refunded"
} as const;

const statusDot = {
  PENDING: "bg-[var(--ft-yellow)]",
  SUBMITTED: "bg-[var(--ft-blue)]",
  IN_PROGRESS: "bg-[var(--ft-blue)]",
  COMPLETED: "bg-[var(--ft-green)]",
  FAILED: "bg-[var(--ft-red)]",
  REFUNDED: "bg-[var(--ft-text-muted)]"
} as const;
