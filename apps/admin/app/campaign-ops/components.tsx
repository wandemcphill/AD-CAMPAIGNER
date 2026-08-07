"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronRight,
  CircleHelp,
  Inbox,
  Menu,
  Megaphone,
  Settings,
  Users
} from "lucide-react";

import { Badge, Panel, PlatformChip as SharedPlatformChip, ThemeToggle, cn } from "@fliptrybe/ui";

import { useApiSession } from "../lib/use-session";
import { AdminAuthState } from "../ui/admin-auth-state";
import { SessionPanel } from "../ui/session-panel";
import {
  campaignOpsEnabled,
  navItems,
  type CampaignOpsActivitySeverity,
  type CampaignOpsMetric,
  type CampaignOpsPriority,
  type CampaignOpsReportStatus,
  type CampaignOpsStatus
} from "./data";

type PillTone = "neutral" | "success" | "warning" | "danger" | "info" | "purple" | "slate";

const pillToneClasses: Record<PillTone, { bg: string; dot: string; text: string; border: string }> =
  {
    danger: {
      bg: "bg-[var(--ft-red-subtle)]",
      border: "border-[var(--ft-red)]/35",
      dot: "bg-[var(--ft-red)]",
      text: "text-[var(--ft-red)]"
    },
    info: {
      bg: "bg-[var(--ft-blue-subtle)]",
      border: "border-[var(--ft-blue)]/35",
      dot: "bg-[var(--ft-blue)]",
      text: "text-[var(--ft-blue)]"
    },
    neutral: {
      bg: "bg-[var(--ft-bg-muted)]",
      border: "border-[var(--ft-border)]",
      dot: "bg-[var(--ft-text-muted)]",
      text: "text-[var(--ft-text-secondary)]"
    },
    purple: {
      bg: "bg-[var(--ft-purple-subtle)]",
      border: "border-[var(--ft-purple)]/35",
      dot: "bg-[var(--ft-purple)]",
      text: "text-[var(--ft-purple)]"
    },
    slate: {
      bg: "bg-[var(--ft-slate-subtle)]",
      border: "border-[var(--ft-slate)]/35",
      dot: "bg-[var(--ft-slate)]",
      text: "text-[var(--ft-slate)]"
    },
    success: {
      bg: "bg-[var(--ft-green-subtle)]",
      border: "border-[var(--ft-green)]/35",
      dot: "bg-[var(--ft-green)]",
      text: "text-[var(--ft-green)]"
    },
    warning: {
      bg: "bg-[var(--ft-yellow-subtle)]",
      border: "border-[var(--ft-yellow)]/35",
      dot: "bg-[var(--ft-yellow)]",
      text: "text-[var(--ft-yellow)]"
    }
  };

const campaignStatusMeta: Record<CampaignOpsStatus, { label: string; tone: PillTone }> = {
  approved: { label: "Approved", tone: "info" },
  assigned: { label: "Assigned", tone: "info" },
  blocked: { label: "Blocked", tone: "danger" },
  completed: { label: "Completed", tone: "success" },
  creative_review: { label: "Creative Review", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  optimization: { label: "Optimization", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  platform_launch: { label: "Platform Launch", tone: "info" },
  reporting: { label: "Reporting", tone: "warning" },
  review: { label: "Review", tone: "warning" },
  submitted: { label: "Submitted", tone: "info" }
};

const priorityMeta: Record<CampaignOpsPriority, { label: string; tone: PillTone }> = {
  high: { label: "High", tone: "warning" },
  low: { label: "Low", tone: "slate" },
  normal: { label: "Normal", tone: "info" },
  urgent: { label: "Urgent", tone: "danger" }
};

const reportStatusMeta: Record<CampaignOpsReportStatus, { label: string; tone: PillTone }> = {
  failed: { label: "Failed", tone: "danger" },
  generating: { label: "Building", tone: "info" },
  published: { label: "Published", tone: "success" },
  ready: { label: "Needs Publish", tone: "warning" }
};

const activitySeverityMeta: Record<CampaignOpsActivitySeverity, { label: string; tone: PillTone }> =
  {
    danger: { label: "Danger", tone: "danger" },
    info: { label: "Info", tone: "info" },
    success: { label: "Success", tone: "success" },
    warning: { label: "Warning", tone: "warning" }
  };

const mobileNavItems: Array<{ href: Route; icon: typeof Activity; label: string }> = [
  { href: "/campaign-ops", icon: Activity, label: "Overview" },
  { href: "/campaign-ops/queue", icon: Inbox, label: "Queue" },
  { href: "/campaign-ops/reports", icon: BarChart3, label: "Reports" },
  { href: "/campaign-ops/activity", icon: Menu, label: "Activity" }
];

function pillClass(tone: PillTone) {
  const classes = pillToneClasses[tone];

  return `${classes.border} ${classes.bg} ${classes.text}`;
}

function dotClass(tone: PillTone) {
  return pillToneClasses[tone].dot;
}

export function splitPlatforms(channel: string) {
  return channel
    .split(/[,/&+]+|\band\b/i)
    .map((platform) => platform.trim())
    .filter(Boolean);
}

function StatusPill({
  glow = false,
  label,
  tone
}: {
  glow?: boolean;
  label: string;
  tone: PillTone;
}) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] whitespace-nowrap uppercase",
        pillClass(tone)
      )}
    >
      <span
        className={cn(
          "mt-[5px] mr-2 inline-block size-1.5 rounded-full",
          dotClass(tone),
          glow ? "animate-[ft-pulse_1.5s_ease-in-out_infinite]" : ""
        )}
      />
      {label}
    </span>
  );
}

export function AdminCampaignOpsShell({
  children,
  active
}: {
  children: ReactNode;
  active: string;
}) {
  const { error, loading, session } = useApiSession();
  const activeItem = navItems.find((item) => item.href === active);

  useEffect(() => {
    if (!loading && !session) {
      window.location.replace("/login/");
    }
  }, [loading, session]);

  if (loading || !session) {
    return <AdminAuthState error={error} loading={loading} title="Campaign ops auth" />;
  }

  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[220px] border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-4 md:block">
        <Link className="flex h-12 items-center gap-3 px-1" href="/campaign-ops">
          <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-accent)] font-mono text-xs font-semibold text-[var(--ft-bg-base)]">
            CO
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--ft-text-primary)]">Campaign Ops</div>
            <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              Control room
            </div>
          </div>
        </Link>

        <div className="mt-6 px-3 font-mono text-[10px] font-medium tracking-[0.15em] text-[var(--ft-text-muted)] uppercase">
          Ops console
        </div>
        <nav className="mt-2 grid gap-1">
          {navItems.map((item, index) => (
            <Link
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-[var(--radius-sm)] border-l-2 px-3 text-sm font-medium transition",
                active === item.href
                  ? "border-l-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                  : "border-l-transparent text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
              )}
              href={item.href}
              key={item.href}
            >
              <span className="relative">
                <item.icon className="size-5 stroke-[1.5]" />
                {index < 2 ? (
                  <span className="absolute -top-2 -right-2 grid size-[18px] place-items-center rounded-full bg-[var(--ft-accent)] font-mono text-[9px] font-semibold text-[var(--ft-bg-base)]">
                    {index === 0 ? "!" : "Q"}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-6 grid gap-2 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              Admin mode
            </div>
            <Badge tone={campaignOpsEnabled ? "success" : "warning"}>
              {campaignOpsEnabled ? "Live" : "Off"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-secondary)] uppercase">
            <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-2 py-2">
              Review
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-2 py-2">
              Reports
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-2 py-2">
              Audit
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-2 py-2">
              SLA watch
            </div>
          </div>
        </div>
        <SessionPanel />
      </aside>

      <div className="min-h-screen md:pl-[220px]">
        <div className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/95 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
            <span className="hidden sm:inline">Admin</span>
            <ChevronRight className="hidden size-3 stroke-[1.5] sm:inline" />
            <span className="hidden sm:inline">Campaign operations</span>
            {activeItem ? (
              <>
                <ChevronRight className="hidden size-3 stroke-[1.5] sm:inline" />
                <span className="truncate text-[var(--ft-text-secondary)]">{activeItem.label}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <button
              aria-label="Notifications"
              className="relative grid size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] transition hover:text-[var(--ft-text-primary)] focus:ring-2 focus:ring-[var(--ft-accent)] focus:outline-none"
              type="button"
            >
              <Bell className="size-4 stroke-[1.5]" />
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-[var(--ft-accent)]" />
            </button>
            <button
              aria-label="Admin help"
              className="hidden size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] transition hover:text-[var(--ft-text-primary)] focus:ring-2 focus:ring-[var(--ft-accent)] focus:outline-none sm:grid"
              type="button"
            >
              <CircleHelp className="size-4 stroke-[1.5]" />
            </button>
          </div>
        </div>
        <section className="px-4 py-5 pb-28 sm:px-6 lg:px-8">{children}</section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-4 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pb-[env(safe-area-inset-bottom)] md:hidden">
        {mobileNavItems.map((item) => (
          <Link
            aria-label={item.label}
            className={cn(
              "grid place-items-center gap-0.5 py-1 text-[var(--ft-text-muted)]",
              active === item.href ? "text-[var(--ft-accent)]" : ""
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-5 stroke-[1.5]" />
            <span className="text-[10px]">{item.label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}

export function AdminCampaignOpsHeader({
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
        <h1 className="mt-3 text-[1.375rem] leading-7 font-medium tracking-normal text-[var(--ft-text-primary)] sm:text-[1.875rem] sm:leading-9">
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}

export function ActionLink({
  children,
  href,
  variant = "secondary"
}: {
  children: ReactNode;
  href: Route;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const variants = {
    primary:
      "border-transparent bg-[var(--ft-accent)] text-[var(--ft-bg-base)] hover:bg-[var(--ft-accent-dim)] hover:shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    secondary:
      "border-[var(--ft-border-strong)] bg-transparent text-[var(--ft-text-primary)] hover:border-[var(--ft-text-muted)] hover:bg-[var(--ft-bg-muted)]",
    ghost:
      "border-transparent bg-transparent text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
  };

  return (
    <Link
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border px-5 text-sm font-semibold transition focus:ring-2 focus:ring-[var(--ft-accent)] focus:outline-none",
        variants[variant]
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

export function StatusBadge({ status }: { status: CampaignOpsStatus }) {
  const meta = campaignStatusMeta[status];

  return <StatusPill glow={status === "optimization"} label={meta.label} tone={meta.tone} />;
}

export function PriorityBadge({ priority }: { priority: CampaignOpsPriority }) {
  const meta = priorityMeta[priority];

  return <StatusPill label={meta.label} tone={meta.tone} />;
}

export function ReportStatusBadge({ status }: { status: CampaignOpsReportStatus }) {
  const meta = reportStatusMeta[status];

  return <StatusPill label={meta.label} tone={meta.tone} />;
}

export function ActivitySeverityBadge({ severity }: { severity: CampaignOpsActivitySeverity }) {
  const meta = activitySeverityMeta[severity];

  return <StatusPill label={meta.label} tone={meta.tone} />;
}

export function ErrorBanner({ message }: { message: string }) {
  const trimmedMessage = message.trim();
  const technicalMessage =
    trimmedMessage.length > 180 ||
    /api|badrequest|exception|failed to fetch|forbidden|http|internal server|json|load failed|networkerror|prisma|stack|status code|trace|unauthorized/i.test(
      trimmedMessage
    );
  const safeMessage = technicalMessage
    ? "Ops data could not refresh right now. Retry the action or check the campaign record again in a moment."
    : trimmedMessage;

  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] p-3 text-sm text-[var(--ft-yellow)]">
      {safeMessage}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Panel className="p-8 text-center">
      <div className="mx-auto grid size-10 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]">
        <Inbox className="size-5 stroke-[1.5]" />
      </div>
      <div className="mt-4 text-sm font-semibold text-[var(--ft-text-primary)]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--ft-text-secondary)]">
        {detail}
      </div>
    </Panel>
  );
}

export function InlineEmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="p-5 text-sm">
      <div className="font-semibold text-[var(--ft-text-primary)]">{title}</div>
      <div className="mt-1 text-[var(--ft-text-secondary)]">{detail}</div>
    </div>
  );
}

export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-[var(--ft-border)]">
      {Array.from({ length: count }).map((_, index) => (
        <div className="grid gap-3 p-4" key={index}>
          <div className="skeleton h-4 w-2/5" />
          <div className="skeleton h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--ft-bg-muted)]">
      <div
        className="h-full rounded-full bg-[var(--ft-accent)] transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--ft-border)] py-3 last:border-b-0">
      <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {label}
      </div>
      <div className="text-sm font-medium text-[var(--ft-text-primary)]">{value}</div>
    </div>
  );
}

export function PlatformChip({ platform }: { platform: string }) {
  return <SharedPlatformChip platform={platform} />;
}

export function PlatformChips({ channel }: { channel: string }) {
  const platforms = splitPlatforms(channel);
  const chips = platforms.length > 0 ? platforms : [channel];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((platform) => (
        <PlatformChip key={platform} platform={platform} />
      ))}
    </div>
  );
}

export function MetricStrip({
  metrics,
  loading = false
}: {
  loading?: boolean;
  metrics: CampaignOpsMetric[];
}) {
  return (
    <section className="mt-6 grid overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => (
        <div
          className={cn(
            "min-h-28 p-4",
            index > 0 ? "border-t border-[var(--ft-border)] md:border-t-0 md:border-l" : "",
            index === 2 ? "md:border-l-0 xl:border-l" : ""
          )}
          key={metric.label}
        >
          <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
            {metric.label}
          </div>
          <div className="mt-2 font-mono text-2xl font-medium text-[var(--ft-text-primary)]">
            {loading ? "..." : metric.value}
          </div>
          <div className="mt-2 text-sm text-[var(--ft-text-secondary)]">{metric.detail}</div>
        </div>
      ))}
    </section>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "mt-5 grid gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3",
        className
      )}
    >
      {children}
    </section>
  );
}

export function FilterControl({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <label className="flex h-10 min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)] focus-within:ring-2 focus-within:ring-[var(--ft-accent)]">
      {icon}
      {children}
    </label>
  );
}

export function TableFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-transparent",
        className
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  action,
  detail,
  icon,
  title
}: {
  action?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <div className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium text-[var(--ft-text-primary)]">{title}</h2>
          {detail ? <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">{detail}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function IconPanel({
  children,
  icon,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-2">
        <span className="text-[var(--ft-accent)]">{icon}</span>
        <h2 className="text-base font-medium text-[var(--ft-text-primary)]">{title}</h2>
      </div>
      {children}
    </Panel>
  );
}

export function AdminMiniRail() {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--ft-text-secondary)] sm:grid-cols-4">
      {[
        { icon: Users, label: "Clients" },
        { icon: Settings, label: "Settings" },
        { icon: Megaphone, label: "Campaigns" },
        { icon: BarChart3, label: "Reports" }
      ].map((item) => (
        <div
          className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2"
          key={item.label}
        >
          <item.icon className="size-4 stroke-[1.5]" />
          {item.label}
        </div>
      ))}
    </div>
  );
}
