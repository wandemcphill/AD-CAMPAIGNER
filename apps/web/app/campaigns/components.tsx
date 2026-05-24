"use client";

import type { ReactNode } from "react";
import { AlertCircle, Database, type LucideIcon } from "lucide-react";

import { Badge, Panel, cn } from "@fliptrybe/ui";
import type { CampaignStatus } from "@fliptrybe/types";

import { SessionPanel } from "../ui/session-panel";
import { campaignNavItems, campaignStatusTone, type ClientDataSource } from "./data";

export function CampaignShell({ children, active }: { children: ReactNode; active: string }) {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_1fr]">
        <aside className="border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur lg:border-r lg:border-b-0">
          <a className="flex items-center gap-3" href="/campaigns">
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-sm font-semibold text-white">
              FT
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-950">Campaign Desk</div>
              <div className="text-xs text-zinc-500">Client workspace</div>
            </div>
          </a>

          <nav className="mt-6 grid grid-cols-2 gap-1 lg:grid-cols-1">
            {campaignNavItems.map((item) => (
              <a
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active === item.href
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                )}
                href={item.href}
                key={item.href}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <Panel className="mt-6 hidden p-4 lg:block">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-950">Operating mode</div>
              <Badge tone="info">Client</Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-zinc-600">
              <div className="flex justify-between">
                <span>Campaigns</span>
                <span className="font-medium text-zinc-950">Ads</span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="font-medium text-zinc-950">Wallet</span>
              </div>
              <div className="flex justify-between">
                <span>Analytics</span>
                <span className="font-medium text-zinc-950">Live</span>
              </div>
            </div>
          </Panel>
          <SessionPanel />
        </aside>

        <section className="px-4 py-4 sm:px-6 lg:px-8">{children}</section>
      </div>
    </main>
  );
}

export function PageHeader({
  action,
  eyebrow,
  title
}: {
  action?: ReactNode;
  eyebrow: ReactNode;
  title: string;
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

export function SourceBadge({ source }: { source: ClientDataSource }) {
  return (
    <Badge tone={source === "api" ? "success" : "neutral"}>
      {source === "api" ? "API data" : "Demo fallback"}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge tone={campaignStatusTone[status]}>{status.replace("_", " ")}</Badge>;
}

export function ErrorNotice({ message }: { message?: string | undefined }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mt-4 flex gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm leading-6 text-orange-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  action,
  copy,
  icon: Icon = Database,
  title
}: {
  action?: ReactNode;
  copy: string;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-5">
      <Icon className="size-5 text-zinc-500" />
      <div className="mt-3 font-semibold text-zinc-950">{title}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{copy}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return <div className="rounded-md bg-zinc-50 p-5 text-sm text-zinc-500">{label}</div>;
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

export const linkButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-transparent bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-300";

export const secondaryLinkButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-sky-300";
