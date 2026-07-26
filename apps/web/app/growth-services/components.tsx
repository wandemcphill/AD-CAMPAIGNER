import type { ReactNode } from "react";

import { Badge, Panel, ThemeToggle, cn } from "@fliptrybe/ui";

import { SessionPanel } from "../ui/session-panel";
import {
  growthEnabled,
  navItems,
  statusTone,
  type GrowthOrder,
  type GrowthOrderStatus
} from "./data";

export function GrowthServicesShell({ children, active }: { children: ReactNode; active: string }) {
  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[220px] border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-4 md:block">
        <a className="flex h-12 items-center gap-3 px-1" href="/growth-services">
          <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-accent)] font-mono text-xs font-semibold text-[var(--ft-bg-base)]">
            GS
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
              Growth Services
            </div>
            <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              Marketplace
            </div>
          </div>
        </a>

        <nav className="mt-6 grid gap-1">
          {navItems.map((item) => (
            <a
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition",
                active === item.href
                  ? "bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)] before:absolute before:left-0 before:h-6 before:w-0.5 before:rounded-full before:bg-[var(--ft-accent)]"
                  : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
              )}
              href={item.href}
              key={item.href}
            >
              <item.icon className="size-5 stroke-[1.5]" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <Panel className="mt-6 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-[var(--ft-text-primary)]">Storefront</div>
            <Badge tone={growthEnabled ? "success" : "warning"}>
              {growthEnabled ? "Live" : "Setup"}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ft-text-secondary)]">
            <div className="flex justify-between">
              <span>Fulfillment</span>
              <span className="font-medium text-[var(--ft-text-primary)]">Supplier routed</span>
            </div>
            <div className="flex justify-between">
              <span>Tracking</span>
              <span className="font-medium text-[var(--ft-text-primary)]">Live status</span>
            </div>
            <div className="flex justify-between">
              <span>Refunds</span>
              <span className="font-medium text-[var(--ft-text-primary)]">Admin controlled</span>
            </div>
          </div>
        </Panel>
        <SessionPanel />
      </aside>

      <div className="min-h-screen md:pl-[220px]">
        <div className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/95 px-4 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase backdrop-blur md:px-8">
          <span>Growth Services / Client workspace</span>
          <ThemeToggle className="tracking-normal normal-case" />
        </div>
        <section className="px-4 py-5 pb-20 sm:px-6 lg:px-8">{children}</section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-14 grid-cols-3 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] md:hidden">
        {navItems.map((item) => (
          <a
            aria-label={item.label}
            className={cn(
              "grid place-items-center text-[var(--ft-text-muted)]",
              active === item.href ? "text-[var(--ft-accent)]" : ""
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-5 stroke-[1.5]" />
          </a>
        ))}
      </nav>
    </main>
  );
}

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
