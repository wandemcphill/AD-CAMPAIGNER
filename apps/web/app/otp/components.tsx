import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, Panel, ThemeToggle, cn } from "@fliptrybe/ui";

import { navItems, statusTone, type OtpStatus } from "./data";

export function OtpShell({ children, active }: { children: ReactNode; active: string }) {
  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[220px] border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-4 md:block">
        <Link className="flex h-12 items-center gap-3 px-1" href="/otp">
          <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-accent)] font-mono text-xs font-semibold text-[var(--ft-bg-base)]">
            FT
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--ft-text-primary)]">OTP Desk</div>
            <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              Marketplace
            </div>
          </div>
        </Link>

        <nav className="mt-6 grid gap-1">
          {navItems.map((item) => (
            <Link
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
            </Link>
          ))}
        </nav>

        <Panel className="mt-6 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-[var(--ft-text-primary)]">Route health</div>
            <Badge tone="success">Live</Badge>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ft-text-secondary)]">
            <div className="flex justify-between">
              <span>Inventory</span>
              <span className="font-medium text-[var(--ft-text-primary)]">5,430</span>
            </div>
            <div className="flex justify-between">
              <span>Median OTP</span>
              <span className="font-medium text-[var(--ft-text-primary)]">31s</span>
            </div>
            <div className="flex justify-between">
              <span>Refund window</span>
              <span className="font-medium text-[var(--ft-text-primary)]">10m</span>
            </div>
          </div>
        </Panel>
      </aside>

      <div className="min-h-screen md:pl-[220px]">
        <div className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/95 px-4 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase backdrop-blur md:px-8">
          <span>OTP / Marketplace desk</span>
          <ThemeToggle className="normal-case tracking-normal" />
        </div>
        <section className="px-4 py-5 pb-20 sm:px-6 lg:px-8">{children}</section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-14 grid-cols-4 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] md:hidden">
        {navItems.map((item) => (
          <Link
            aria-label={item.label}
            className={cn(
              "grid place-items-center text-[var(--ft-text-muted)]",
              active === item.href ? "text-[var(--ft-accent)]" : ""
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-5 stroke-[1.5]" />
          </Link>
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

export function StatusBadge({ status }: { status: OtpStatus }) {
  return <LocalStatusBadge status={status} tone={statusTone[status]} />;
}

function LocalStatusBadge({
  status,
  tone
}: {
  status: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <Badge tone={tone}>
      <span className={cn("mr-1.5 inline-block size-1.5 rounded-full", statusDot[tone])} />
      {formatStatusLabel(status)}
    </Badge>
  );
}

const statusDot = {
  neutral: "bg-[var(--ft-text-muted)]",
  success: "bg-[var(--ft-green)]",
  warning: "bg-[var(--ft-yellow)]",
  danger: "bg-[var(--ft-red)]",
  info: "bg-[var(--ft-blue)]"
} as const;

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--ft-text-primary)]">{value}</div>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-40 place-items-center p-6 text-center">
      <div>
        <div className="font-semibold text-[var(--ft-text-primary)]">{title}</div>
        <p className="mt-2 max-w-md text-sm text-[var(--ft-text-muted)]">{detail}</p>
      </div>
    </div>
  );
}
