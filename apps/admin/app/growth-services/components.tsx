"use client";

import { useEffect, type ReactNode } from "react";

import { Badge, Panel, ThemeToggle, cn } from "@fliptrybe/ui";

import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";
import { SessionPanel } from "../ui/session-panel";
import {
  adminGrowthEnabled,
  navItems,
  statusTone,
  supplierTone,
  type AdminGrowthStatus
} from "./data";

export function AdminGrowthShell({ children, active }: { children: ReactNode; active: string }) {
  const { error, loading, session } = useApiSession();

  useEffect(() => {
    if (!loading && !session) {
      window.location.replace("/login/");
    }
  }, [loading, session]);

  if (loading || !session) {
    return <AdminAuthState error={error} loading={loading} title="Growth auth" />;
  }

  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[220px] border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-4 md:block">
        <a className="flex h-12 items-center gap-3 px-1" href="/growth-services/">
          <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-accent)] font-mono text-xs font-semibold text-[var(--ft-bg-base)]">
            GS
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
              Growth Services
            </div>
            <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              Admin suite
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
            <div className="text-sm font-medium text-[var(--ft-text-primary)]">Feature flag</div>
            <Badge tone={adminGrowthEnabled ? "success" : "warning"}>
              {adminGrowthEnabled ? "Live" : "Off"}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ft-text-secondary)]">
            <div className="flex justify-between">
              <span>Catalog</span>
              <span className="font-medium text-[var(--ft-text-primary)]">Admin managed</span>
            </div>
            <div className="flex justify-between">
              <span>Margin</span>
              <span className="font-medium text-[var(--ft-text-primary)]">Per service</span>
            </div>
            <div className="flex justify-between">
              <span>Routing</span>
              <span className="font-medium text-[var(--ft-text-primary)]">Supplier aware</span>
            </div>
          </div>
        </Panel>
        <SessionPanel />
      </aside>

      <div className="min-h-screen md:pl-[220px]">
        <div className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/95 px-4 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase backdrop-blur md:px-8">
          <span>Admin / Growth Services</span>
          <ThemeToggle className="tracking-normal normal-case" />
        </div>
        <section className="px-4 py-5 pb-20 sm:px-6 lg:px-8">{children}</section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-14 grid-cols-5 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] md:hidden">
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

export function AdminPageHeader({
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

export function AdminErrorNotice({ message }: { message?: string | undefined }) {
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
        ? "Growth admin data could not refresh right now. Showing the last safe local state."
        : message}
    </div>
  );
}

export function AdminEmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Panel className="p-6 text-center">
      <div className="mx-auto max-w-md">
        <div className="font-semibold text-[var(--ft-text-primary)]">{title}</div>
        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-muted)]">{detail}</p>
      </div>
    </Panel>
  );
}

export function AdminGrowthStatusBadge({ status }: { status: AdminGrowthStatus }) {
  return <LocalBadge label={statusLabel[status]} tone={statusTone[status]} />;
}

export function SupplierHealthBadge({
  status
}: {
  status: "healthy" | "degraded" | "down" | "unknown";
}) {
  return <LocalBadge label={status} tone={supplierTone[status]} />;
}

function LocalBadge({
  label,
  tone
}: {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <Badge tone={tone}>
      <span className={cn("mr-1.5 inline-block size-1.5 rounded-full", dotTone[tone])} />
      {label}
    </Badge>
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

const dotTone = {
  neutral: "bg-[var(--ft-text-muted)]",
  success: "bg-[var(--ft-green)]",
  warning: "bg-[var(--ft-yellow)]",
  danger: "bg-[var(--ft-red)]",
  info: "bg-[var(--ft-blue)]"
} as const;
