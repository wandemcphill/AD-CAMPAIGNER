import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { Badge, Panel, cn } from "@fliptrybe/ui";

import { SessionPanel } from "../ui/session-panel";
import {
  activitySeverityTone,
  campaignOpsApiRoutes,
  campaignOpsEnabled,
  navItems,
  priorityTone,
  reportStatusTone,
  statusTone,
  type CampaignOpsActivitySeverity,
  type CampaignOpsPriority,
  type CampaignOpsReportStatus,
  type CampaignOpsStatus
} from "./data";

export function AdminCampaignOpsShell({
  children,
  active
}: {
  children: ReactNode;
  active: string;
}) {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <aside className="border-b border-zinc-200 bg-zinc-950 px-4 py-4 text-white xl:border-r xl:border-b-0">
          <Link className="flex items-center gap-3" href="/campaign-ops">
            <div className="flex size-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-zinc-950">
              CO
            </div>
            <div>
              <div className="text-sm font-semibold">Campaign Ops</div>
              <div className="text-xs text-zinc-400">Admin control room</div>
            </div>
          </Link>

          <nav className="mt-6 grid grid-cols-2 gap-1 xl:grid-cols-1">
            {navItems.map((item) => (
              <Link
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active === item.href
                    ? "bg-white text-zinc-950"
                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                )}
                href={item.href as Route}
                key={item.href}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 hidden rounded-lg border border-white/10 bg-white/5 p-4 xl:block">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">API mode</div>
              <Badge tone={campaignOpsEnabled ? "success" : "warning"}>
                {campaignOpsEnabled ? "Planned" : "Off"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-zinc-300">
              {campaignOpsApiRoutes.slice(0, 4).map((route) => (
                <div
                  className="truncate rounded-md border border-white/10 bg-zinc-900 px-2 py-1"
                  key={route}
                >
                  {route}
                </div>
              ))}
            </div>
          </div>
          <SessionPanel />
        </aside>

        <section className="px-4 py-4 sm:px-6 lg:px-8">{children}</section>
      </div>
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
    <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
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
  href: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const variants = {
    primary: "border-transparent bg-zinc-950 text-white hover:bg-zinc-800",
    secondary: "border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50",
    ghost: "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100"
  };

  return (
    <Link
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-300",
        variants[variant]
      )}
      href={href as Route}
    >
      {children}
    </Link>
  );
}

export function StatusBadge({ status }: { status: CampaignOpsStatus }) {
  return <Badge tone={statusTone[status]}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: CampaignOpsPriority }) {
  return <Badge tone={priorityTone[priority]}>{priority}</Badge>;
}

export function ReportStatusBadge({ status }: { status: CampaignOpsReportStatus }) {
  return <Badge tone={reportStatusTone[status]}>{status}</Badge>;
}

export function ActivitySeverityBadge({ severity }: { severity: CampaignOpsActivitySeverity }) {
  return <Badge tone={activitySeverityTone[severity]}>{severity}</Badge>;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
      {message}
    </div>
  );
}

export function EmptyState({
  title,
  detail
}: {
  title: string;
  detail: string;
}) {
  return (
    <Panel className="p-6 text-center">
      <div className="text-sm font-semibold text-zinc-950">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{detail}</div>
    </Panel>
  );
}

export function InlineEmptyState({
  title,
  detail
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="p-5 text-sm">
      <div className="font-semibold text-zinc-950">{title}</div>
      <div className="mt-1 text-zinc-500">{detail}</div>
    </div>
  );
}

export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-zinc-200">
      {Array.from({ length: count }).map((_, index) => (
        <div className="grid gap-3 p-4" key={index}>
          <div className="h-4 w-2/5 rounded bg-zinc-100" />
          <div className="h-3 w-4/5 rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
      <div
        className="h-full rounded-full bg-zinc-950 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-medium text-zinc-500 uppercase">{label}</div>
      <div className="text-sm font-medium text-zinc-950">{value}</div>
    </div>
  );
}
