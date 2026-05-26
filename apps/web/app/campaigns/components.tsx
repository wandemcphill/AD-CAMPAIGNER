"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  Bell,
  CheckCircle2,
  Database,
  Download,
  FileText,
  HelpCircle,
  Menu,
  MessageSquare,
  UploadCloud,
  WalletCards,
  type LucideIcon
} from "lucide-react";

import { Badge, Panel, PlatformChip, StatusBadge as DesignStatusBadge, ThemeToggle, cn } from "@fliptrybe/ui";
import type { Campaign, CampaignStatus, Money } from "@fliptrybe/types";

import { SessionPanel } from "../ui/session-panel";
import { campaignNavItems, destinationLabels, objectiveLabels, type ClientDataSource } from "./data";

export function CampaignShell({ children, active }: { children: ReactNode; active: string }) {
  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[220px] border-r border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-4 md:block">
        <a className="flex h-12 items-center gap-3 px-1" href="/campaigns">
          <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-accent)] font-mono text-xs font-semibold text-[var(--ft-bg-base)]">
            FT
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--ft-text-primary)]">Fliptrybe</div>
            <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
              Client desk
            </div>
          </div>
        </a>

        <div className="mt-6 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
          Campaign desk
        </div>
        <nav className="mt-2 grid gap-1">
          {campaignNavItems.map((item) => (
            <a
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-[var(--radius-sm)] border-l-2 px-3 text-sm font-medium transition",
                active === item.href
                  ? "border-l-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                  : "border-l-transparent text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
              )}
              href={item.href}
              key={item.href}
            >
              <item.icon className="size-5 stroke-[1.5]" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <SessionPanel />
      </aside>

      <div className="min-h-screen md:pl-[220px]">
        <div className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-base)]/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            <Menu className="size-4 md:hidden" />
            Campaigns / Managed ads
          </div>
          <div className="flex items-center gap-2 text-[var(--ft-text-secondary)]">
            <ThemeToggle className="hidden sm:inline-flex" />
            <a
              aria-label="Notifications"
              className={cn(
                "grid size-10 place-items-center rounded-[var(--radius-sm)] transition hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-accent)]",
                active === "/notifications" ? "text-[var(--ft-accent)]" : ""
              )}
              href="/notifications"
            >
              <Bell className="size-5 stroke-[1.5]" />
            </a>
            <HelpCircle className="size-5 stroke-[1.5]" />
          </div>
        </div>
        <section className="px-4 py-5 pb-28 sm:px-6 lg:px-8">{children}</section>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pb-[env(safe-area-inset-bottom)] md:hidden">
        {campaignNavItems.slice(0, 5).map((item) => (
          <a
            aria-label={item.label}
            className={cn(
              "grid place-items-center gap-0.5 py-1 text-[var(--ft-text-muted)]",
              active === item.href ? "text-[var(--ft-accent)]" : ""
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-5 stroke-[1.5]" />
            <span className="max-w-full truncate px-1 text-[10px]">{item.label.split(" ")[0]}</span>
          </a>
        ))}
      </nav>
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

export function SourceBadge({ source }: { source: ClientDataSource }) {
  if (process.env.NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE !== "true") {
    return null;
  }

  return (
    <Badge tone={source === "api" ? "success" : "neutral"}>
      {source === "api" ? "Live workspace" : "Local data path"}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return <DesignStatusBadge status={status} />;
}

export function destinationPlatform(destinationKind: string) {
  if (destinationKind.startsWith("TIKTOK")) return "TikTok";
  if (destinationKind.startsWith("INSTAGRAM")) return "Instagram";
  if (destinationKind.startsWith("FACEBOOK")) return "Facebook";
  if (destinationKind.startsWith("WHATSAPP")) return "WhatsApp";
  if (destinationKind.startsWith("YOUTUBE")) return "YouTube";
  if (destinationKind.startsWith("TELEGRAM")) return "Telegram";

  return "Web";
}

export function campaignProgress(status: string) {
  if (status === "COMPLETED") return 100;
  if (status === "ACTIVE" || status === "RUNNING") return 72;
  if (status === "CREATIVE_IN_PROGRESS") return 58;
  if (status === "QUEUED" || status === "APPROVED" || status === "PLAN_SENT") return 44;
  if (status === "PENDING_REVIEW" || status === "BRIEF_RECEIVED" || status === "IN_REVIEW") return 26;
  if (status === "CHANGES_REQUESTED") return 18;

  return 10;
}

function formatMoneyValue(money?: Money | null) {
  if (!money) return "No amount";

  return new Intl.NumberFormat("en-NG", {
    currency: money.currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(money.amountMinor / 100);
}

function formatDateValue(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function audienceSummary(targetAudience: Campaign["targetAudience"]) {
  if (!targetAudience || Object.keys(targetAudience).length === 0) {
    return "Audience details will be refined during managed review.";
  }

  return Object.entries(targetAudience)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" / ");
}

const timelineSteps = [
  "Brief Received",
  "Under Review",
  "Plan Ready",
  "Campaign Building",
  "Campaign Live",
  "Completed"
];

function timelineIndex(status: string) {
  if (status === "COMPLETED") return 5;
  if (status === "ACTIVE" || status === "RUNNING") return 4;
  if (status === "CREATIVE_IN_PROGRESS" || status === "IN_PRODUCTION") return 3;
  if (status === "APPROVED" || status === "PLAN_SENT" || status === "QUEUED") return 2;
  if (status === "PENDING_REVIEW" || status === "IN_REVIEW" || status === "CHANGES_REQUESTED") return 1;

  return 0;
}

export function StatusTimeline({
  startsAt,
  status,
  updatedAt
}: {
  startsAt?: string | null;
  status: string;
  updatedAt?: string | null;
}) {
  const current = timelineIndex(status);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
      <div className="grid gap-4 md:grid-cols-6 md:gap-2">
        {timelineSteps.map((step, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;

          return (
            <div className="relative grid grid-cols-[20px_1fr] gap-3 md:block md:text-center" key={step}>
              <span
                className={cn(
                  "relative z-10 grid size-5 place-items-center rounded-full border",
                  isCompleted
                    ? "border-[var(--ft-green)] bg-[var(--ft-green)] text-[var(--ft-bg-base)]"
                    : isCurrent
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] shadow-[0_0_0_4px_rgba(232,146,58,0.16)]"
                      : "border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)]"
                )}
              >
                {isCompleted ? <CheckCircle2 className="size-3 stroke-[1.5]" /> : null}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[9px] top-5 h-[calc(100%+1rem)] w-px bg-[var(--ft-border)] last:hidden md:left-1/2 md:top-[10px] md:h-px md:w-full",
                  index >= timelineSteps.length - 1 ? "hidden" : ""
                )}
              />
              <span>
                <span
                  className={cn(
                    "block font-mono text-[11px] font-medium uppercase tracking-[0.04em]",
                    index <= current ? "text-[var(--ft-text-primary)]" : "text-[var(--ft-text-muted)]"
                  )}
                >
                  {step}
                </span>
                <span className="mt-1 block font-mono text-[11px] text-[var(--ft-text-muted)]">
                  {isCurrent ? formatDateValue(updatedAt ?? startsAt) : isCompleted ? "Complete" : "Upcoming"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BriefSummaryPanel({ campaign }: { campaign: Campaign }) {
  const platform = destinationPlatform(campaign.destination.kind);

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--ft-border)] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            <PlatformChip platform={platform} />
          </div>
          <h2 className="mt-3 text-xl font-medium text-[var(--ft-text-primary)]">{campaign.name}</h2>
        </div>
        <FileText className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <Field label="Objective" value={objectiveLabels[campaign.objective]} />
        <Field label="Budget" value={formatMoneyValue(campaign.budget)} />
        <Field label="Destination" value={destinationLabels[campaign.destination.kind]} />
        <Field label="Launch window" value={formatDateValue(campaign.schedule.startsAt)} />
        <div className="sm:col-span-2">
          <Field label="Target audience" value={audienceSummary(campaign.targetAudience)} />
        </div>
      </div>

      <div className="border-t border-[var(--ft-border)] p-5">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
          Brief
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
          {campaign.brief ??
            "The submitted brief is waiting for the managed ads team to turn it into a placement plan."}
        </p>
      </div>
    </Panel>
  );
}

export function AssetGridEmpty({ action }: { action?: ReactNode }) {
  return (
    <div className="grid min-h-60 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-8 text-center">
      <div>
        <UploadCloud className="mx-auto size-8 stroke-[1.5] text-[var(--ft-text-muted)]" />
        <h3 className="mt-4 text-lg font-medium text-[var(--ft-text-secondary)]">No creative assets uploaded.</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--ft-text-muted)]">
          Add images or videos for this campaign when the brief is still editable.
        </p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export function NotesPanel() {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Team notes</h2>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Client-visible updates from the ads desk.</p>
        </div>
        <MessageSquare className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
      </div>
      <div className="mt-5 border-y border-[var(--ft-border)] py-4">
        <EmptyState
          copy="Notes and change requests will appear here once the team starts reviewing this campaign."
          icon={MessageSquare}
          title="No notes yet"
        />
      </div>
    </Panel>
  );
}

export function PaymentSummaryPanel({ campaign }: { campaign: Campaign }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Payment summary</h2>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Budget is held in wallet before launch.</p>
        </div>
        <WalletCards className="size-5 stroke-[1.5] text-[var(--ft-green)]" />
      </div>
      <div className="mt-5 divide-y divide-[var(--ft-border)] border-y border-[var(--ft-border)] text-sm">
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-[var(--ft-text-secondary)]">Campaign budget</span>
          <span className="font-mono text-[var(--ft-text-primary)]">{formatMoneyValue(campaign.budget)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-[var(--ft-text-secondary)]">Invoice status</span>
          <Badge tone={campaign.status === "RUNNING" || campaign.status === "ACTIVE" ? "success" : "warning"}>
            {campaign.status === "RUNNING" || campaign.status === "ACTIVE" ? "Held" : "Invoice due later"}
          </Badge>
        </div>
      </div>
    </Panel>
  );
}

export function ReportCard({
  campaign,
  metrics
}: {
  campaign: Campaign;
  metrics?: Array<{ name: string; value: number }> | undefined;
}) {
  const impressions = metrics?.find((metric) => metric.name === "impressions")?.value ?? 0;
  const clicks = metrics?.find((metric) => metric.name === "clicks")?.value ?? 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const reach = metrics?.find((metric) => metric.name === "reach")?.value ?? impressions;

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--ft-border)] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">{campaign.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            <PlatformChip platform={destinationPlatform(campaign.destination.kind)} />
          </div>
        </div>
        <BarChart3 className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
      </div>
      <div className="grid gap-px bg-[var(--ft-border)] sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Impressions", value: impressions.toLocaleString("en-NG") },
          { label: "Reach", value: reach.toLocaleString("en-NG") },
          { label: "Clicks", value: clicks.toLocaleString("en-NG") },
          { label: "CTR", value: `${ctr.toFixed(2)}%` },
          { label: "Budget", value: formatMoneyValue(campaign.budget) },
          { label: "Updated", value: formatDateValue(campaign.updatedAt) }
        ].map((item) => (
          <div className="bg-[var(--ft-bg-surface)] p-4" key={item.label}>
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
              {item.label}
            </div>
            <div className="mt-2 font-mono text-xl text-[var(--ft-text-primary)]">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 text-sm text-[var(--ft-text-secondary)]">
          <span>{destinationLabels[campaign.destination.kind]}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            {campaign.provider}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-[var(--ft-bg-muted)]">
          <div
            className="h-2 rounded-full bg-[var(--ft-accent)]"
            style={{ width: `${Math.max(8, campaignProgress(campaign.status))}%` }}
          />
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <a className={secondaryLinkButtonClass} href={`/campaigns/${campaign.id}`}>
            View Report
          </a>
          <button
            className={linkButtonClass}
            onClick={() => window.print()}
            type="button"
          >
            <Download className="size-4 stroke-[1.5]" />
            Download PDF
          </button>
        </div>
      </div>
    </Panel>
  );
}

export function ErrorNotice({ message }: { message?: string | undefined }) {
  if (!message) {
    return null;
  }

  const trimmedMessage = message.trim();
  const technicalMessage =
    trimmedMessage.length > 180 ||
    /api|badrequest|exception|failed to fetch|forbidden|http|internal server|json|load failed|networkerror|prisma|stack|status code|trace|unauthorized/i.test(
      trimmedMessage
    );
  const safeMessage = technicalMessage
    ? "We could not complete that request right now. Refresh the page or try again in a moment."
    : trimmedMessage;

  return (
    <div className="mt-4 flex gap-2 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] p-3 text-sm leading-6 text-[var(--ft-yellow)]">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{safeMessage}</span>
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
    <div className="relative grid min-h-56 place-items-center overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-6 text-center">
      <div className="pointer-events-none absolute -top-7 font-mono text-8xl font-semibold text-[var(--ft-border)]/50">
        00
      </div>
      <div className="relative">
        <Icon className="mx-auto size-7 stroke-[1.5] text-[var(--ft-text-muted)]" />
        <div className="mt-3 font-semibold text-[var(--ft-text-primary)]">{title}</div>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--ft-text-secondary)]">{copy}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="skeleton p-5 text-sm text-[var(--ft-text-muted)]">
      {label}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-[var(--ft-text-primary)]">
        {value}
      </div>
    </div>
  );
}

export const linkButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-[var(--ft-accent)] px-5 text-sm font-semibold text-[var(--ft-bg-base)] transition hover:bg-[var(--ft-accent-dim)] hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] focus:outline-none focus:ring-2 focus:ring-[var(--ft-accent)]";

export const secondaryLinkButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-transparent px-5 text-sm font-medium text-[var(--ft-text-primary)] transition hover:border-[var(--ft-text-muted)] hover:bg-[var(--ft-bg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ft-accent)]";
