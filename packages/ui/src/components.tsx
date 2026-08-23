"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn, focusRingClass } from "./index";

/* ─── Input ─── */
export function Input({
  className,
  label,
  hint,
  error,
  id,
  ...props
}: ComponentPropsWithoutRef<"input"> & { label?: string; hint?: string; error?: string | undefined }) {
  return (
    <div className="grid gap-1.5">
      {label ? (
        <label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input
        className={cn(
          "h-11 rounded-[var(--radius-md)] border bg-[var(--ft-bg-surface)] px-4 text-sm text-[var(--ft-text-primary)] outline-none transition placeholder:text-[var(--ft-text-muted)]",
          error
            ? "border-[var(--ft-red)] focus:border-[var(--ft-red)] focus:ring-2 focus:ring-[var(--ft-red)]/20"
            : "border-[var(--ft-border)] focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]",
          className
        )}
        id={id}
        {...props}
      />
      {hint && !error ? (
        <p className="text-xs text-[var(--ft-text-muted)]">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-[var(--ft-red)]" role="alert">{error}</p>
      ) : null}
    </div>
  );
}

/* ─── Checkbox ─── */
export function Checkbox({
  checked,
  children,
  onChange,
  id,
}: {
  checked?: boolean;
  children: ReactNode;
  onChange?: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 text-sm text-[var(--ft-text-secondary)]" htmlFor={id}>
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-[var(--radius-xs)] border transition",
          checked
            ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]"
            : "border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] group-hover:border-[var(--ft-accent)]"
        )}
      >
        {checked ? (
          <svg className="size-3 text-[var(--ft-text-inverse)]" fill="none" viewBox="0 0 12 12">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        ) : null}
      </span>
      <input
        checked={checked}
        className="sr-only"
        id={id}
        onChange={(e) => onChange?.(e.target.checked)}
        type="checkbox"
      />
      <span>{children}</span>
    </label>
  );
}

/* ─── Divider ─── */
export function Divider({ label }: { label?: string }) {
  if (!label) {
    return <div className="h-px bg-[var(--ft-border)]" />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--ft-border)]" />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--ft-border)]" />
    </div>
  );
}

/* ─── SelectCard (for onboarding selection) ─── */
export function SelectCard({
  active,
  children,
  description,
  icon,
  onClick,
  title,
}: {
  active?: boolean;
  children?: ReactNode;
  description: string;
  icon?: ReactNode;
  onClick?: () => void;
  title: string;
}) {
  return (
    <button
      className={cn(
        "group grid gap-3 rounded-[var(--radius-lg)] border p-5 text-left transition",
        focusRingClass,
        active
          ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] shadow-[0_0_0_3px_var(--ft-accent-glow)]"
          : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-border-emphasis)] hover:bg-[var(--ft-bg-muted)] hover:shadow-[var(--shadow-md)]"
      )}
      onClick={onClick}
      type="button"
    >
      {icon ? (
        <div className={cn(
          "grid size-10 place-items-center rounded-[var(--radius-md)] border",
          active
            ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] text-[var(--ft-text-inverse)]"
            : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] group-hover:text-[var(--ft-accent)]"
        )}>
          {icon}
        </div>
      ) : null}
      <div>
        <div className="text-sm font-semibold text-[var(--ft-text-primary)]">{title}</div>
        <p className="mt-1 text-xs leading-5 text-[var(--ft-text-secondary)]">{description}</p>
      </div>
      {children}
    </button>
  );
}

/* ─── Drawer ─── */
export function Drawer({
  children,
  onClose,
  open,
  title,
  width = "480px",
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
  width?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={-1}
      />
      <aside
        className="absolute right-0 top-0 bottom-0 flex flex-col border-l border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-xl)]"
        style={{ width: `min(${width}, 100vw)` }}
      >
        <header className="flex items-center justify-between border-b border-[var(--ft-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">{title}</h2>
          <button
            className={cn(
              "grid size-8 place-items-center rounded-[var(--radius-sm)] text-[var(--ft-text-muted)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]",
              focusRingClass
            )}
            onClick={onClose}
            type="button"
          >
            <svg className="size-4" fill="none" viewBox="0 0 16 16">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

/* ─── Tab bar ─── */
export function TabBar({
  items,
  active,
  value,
  onChange,
}: {
  items: Array<{ key?: string; id?: string; label: string; count?: number }>;
  active?: string;
  value?: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-1">
      {items.map((item) => {
        const k = item.key ?? item.id ?? item.label;
        const current = active ?? value;
        return (
        <button
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition",
            current === k
              ? "bg-[var(--ft-bg-raised)] text-[var(--ft-text-primary)] shadow-[var(--shadow-xs)]"
              : "text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]"
          )}
          key={k}
          onClick={() => onChange(k)}
          type="button"
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="font-mono text-[10px] text-[var(--ft-text-muted)]">{item.count}</span>
          ) : null}
        </button>
        );
      })}
    </div>
  );
}

/* ─── KPI card (large, admin-style) ─── */
export function KpiCard({
  icon,
  label,
  value,
  delta,
  deltaTone,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
}) {
  const deltaColors = {
    up: "text-[var(--ft-green)]",
    down: "text-[var(--ft-red)]",
    neutral: "text-[var(--ft-text-muted)]",
  };

  return (
    <div className="group rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5 transition hover:border-[var(--ft-border-emphasis)] hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
          {label}
        </div>
        {icon ? (
          <div className="grid size-8 place-items-center rounded-[var(--radius-sm)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)] group-hover:text-[var(--ft-accent)]">
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-3 font-mono text-3xl font-semibold tracking-tight text-[var(--ft-text-primary)]">
        {value}
      </div>
      {delta ? (
        <div className={cn("mt-2 font-mono text-xs font-medium", deltaColors[deltaTone ?? "neutral"])}>
          {deltaTone === "up" ? "↑" : deltaTone === "down" ? "↓" : "—"} {delta}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Status dot (health indicator) ─── */
export function StatusDot({ status }: { status: "healthy" | "degraded" | "down" }) {
  const colors = {
    healthy: "bg-[var(--ft-green)]",
    degraded: "bg-[var(--ft-yellow)]",
    down: "bg-[var(--ft-red)]",
  };

  return (
    <span className={cn("inline-block size-2 rounded-full", colors[status])} />
  );
}

/* ─── Table (minimal) ─── */
export function Table({
  children,
  className,
  columns,
}: {
  children: ReactNode;
  className?: string;
  columns: string[];
}) {
  return (
    <div className={cn("overflow-x-auto rounded-[var(--radius-md)] border border-[var(--ft-border)]", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
            {columns.map((col) => (
              <th
                className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]"
                key={col}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ft-border)]">{children}</tbody>
      </table>
    </div>
  );
}

/* ─── Alert banner ─── */
export function AlertBanner({
  children,
  className,
  tone = "warning",
  icon,
}: {
  children: ReactNode;
  className?: string;
  tone?: "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
}) {
  const tones = {
    success: "border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] text-[var(--ft-green)]",
    warning: "border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] text-[var(--ft-yellow)]",
    danger: "border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] text-[var(--ft-red)]",
    info: "border-[var(--ft-blue)]/30 bg-[var(--ft-blue-subtle)] text-[var(--ft-blue)]",
  };

  return (
    <div className={cn("flex items-start gap-3 rounded-[var(--radius-md)] border p-4 text-sm leading-6", tones[tone], className)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div>{children}</div>
    </div>
  );
}

/* ─── Progress steps (animated provision) ─── */
export function ProvisionStep({
  done,
  active,
  label,
}: {
  done?: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border transition-all duration-500",
          done
            ? "border-[var(--ft-green)] bg-[var(--ft-green)] text-[var(--ft-text-inverse)]"
            : active
              ? "animate-[ft-pulse_1.5s_ease-out_infinite] border-[var(--ft-accent)] bg-[var(--ft-accent)] text-[var(--ft-text-inverse)]"
              : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]"
        )}
      >
        {done ? (
          <svg className="size-3" fill="none" viewBox="0 0 12 12">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        ) : active ? (
          <span className="size-2 rounded-full bg-[var(--ft-text-inverse)]" />
        ) : null}
      </span>
      <span className={cn(
        "text-sm transition-colors",
        done ? "text-[var(--ft-green)] font-medium" : active ? "text-[var(--ft-text-primary)] font-medium" : "text-[var(--ft-text-muted)]"
      )}>
        {label}
      </span>
    </div>
  );
}

/* ─── Toggle (switch) ─── */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        aria-checked={checked}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
          focusRingClass,
          checked
            ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]"
            : "border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)]"
        )}
        onClick={() => onChange?.(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-1"
          )}
        />
      </button>
      {label ? <span className="text-sm text-[var(--ft-text-secondary)]">{label}</span> : null}
    </label>
  );
}

/* ─── Kanban column ─── */
export function KanbanColumn({
  children,
  count,
  title,
  tone = "neutral",
}: {
  children: ReactNode;
  count: number;
  title: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const dotColors = {
    neutral: "bg-[var(--ft-text-muted)]",
    success: "bg-[var(--ft-green)]",
    warning: "bg-[var(--ft-yellow)]",
    danger: "bg-[var(--ft-red)]",
    info: "bg-[var(--ft-blue)]",
  };

  return (
    <div className="flex min-w-[280px] flex-col rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/50">
      <div className="flex items-center gap-2 border-b border-[var(--ft-border)] px-4 py-3">
        <span className={cn("size-2 rounded-full", dotColors[tone])} />
        <span className="text-sm font-semibold text-[var(--ft-text-primary)]">{title}</span>
        <span className="font-mono text-[11px] text-[var(--ft-text-muted)]">{count}</span>
      </div>
      <div className="flex flex-col gap-2 p-2">{children}</div>
    </div>
  );
}
