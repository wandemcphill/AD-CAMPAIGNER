"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Megaphone,
  MessageSquare,
  WalletCards,
  type LucideIcon
} from "lucide-react";

import {
  Badge,
  ContextualHelpCard,
  Panel,
  SummaryStatStrip,
  TimelineEvent,
  notificationToneTokens
} from "@fliptrybe/ui";

import {
  CampaignShell,
  EmptyState,
  PageHeader,
  linkButtonClass,
  secondaryLinkButtonClass
} from "../campaigns/components";

type NotificationGroupKey = "action" | "info" | "update";

type NotificationItem = {
  detail: string;
  label: string;
  timestamp: string;
  type?: "milestone" | "operator" | "system";
};

type NotificationGroup = {
  cta: { href: string; label: string };
  description: string;
  empty: { copy: string; status: string; title: string };
  icon: LucideIcon;
  items: NotificationItem[];
  key: NotificationGroupKey;
  routes: string[];
  title: string;
};

const notificationGroups: NotificationGroup[] = [
  {
    cta: { href: "/billing", label: "Review Billing" },
    description:
      "Items that need a client decision before the Fliptrybe team can keep work moving.",
    empty: {
      copy: "Plan approvals, payment requests, and clarification prompts will appear here with the exact campaign and invoice context.",
      status: "Clear",
      title: "No client action needed"
    },
    icon: AlertTriangle,
    items: [],
    key: "action",
    routes: ["Plan approval", "Invoice due", "Budget hold", "Clarification"],
    title: "Action Required"
  },
  {
    cta: { href: "/campaigns", label: "View Campaigns" },
    description: "Operational updates from the managed ads desk after your brief enters review.",
    empty: {
      copy: "Brief review, campaign building, launch, pause, and completion updates will be grouped here by campaign.",
      status: "0 unread",
      title: "No unread team updates"
    },
    icon: Megaphone,
    items: [],
    key: "update",
    routes: ["Brief review", "Build update", "Launch status", "Operator note"],
    title: "Team Updates"
  },
  {
    cta: { href: "/reports", label: "Open Reports" },
    description: "Reports and service notices that do not need an immediate response.",
    empty: {
      copy: "Published midpoint reports, final debriefs, and service notices will stay here until you review them.",
      status: "Quiet",
      title: "No report alerts waiting"
    },
    icon: Info,
    items: [],
    key: "info",
    routes: ["Progress report", "Final report", "Service notice", "Proof ready"],
    title: "For Your Information"
  }
];

const routingNotes = [
  {
    detail:
      "Plan approvals, launch status, pauses, and change requests route into the Team Updates group.",
    icon: Megaphone,
    label: "Campaign updates"
  },
  {
    detail:
      "Wallet funding, invoice payment, and budget hold confirmations remain visible after email delivery.",
    icon: WalletCards,
    label: "Billing notices"
  },
  {
    detail: "Published midpoint and final reports open from here with campaign context preserved.",
    icon: FileText,
    label: "Report alerts"
  },
  {
    detail:
      "Client-visible notes from operators appear as timeline entries, not anonymous system messages.",
    icon: MessageSquare,
    label: "Operator notes"
  }
] as const;

export default function NotificationsPage() {
  return (
    <CampaignShell active="/notifications">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <a className={`${secondaryLinkButtonClass} w-full sm:w-auto`} href="/billing">
              Wallet & Billing
            </a>
            <a className={`${linkButtonClass} w-full sm:w-auto`} href="/campaigns">
              View Campaigns
              <ArrowRight className="size-4 stroke-[1.5]" />
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Client inbox</Badge>
            <Badge tone="neutral">Managed service</Badge>
          </>
        }
        title="Notifications"
      />

      <section className="mt-6">
        <SummaryStatStrip
          items={[
            { label: "open actions", value: "0" },
            { label: "team updates unread", value: "0" },
            { label: "published reports waiting", value: "0" }
          ]}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-[var(--ft-border)] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">All caught up</Badge>
                <Badge tone="neutral">0 unread</Badge>
              </div>
              <h2 className="mt-3 text-lg font-medium text-[var(--ft-text-primary)]">
                Operations inbox
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
                Notifications are grouped by what they mean for the campaign, not by the order they
                arrived. Action items stay separate from team updates and published reports.
              </p>
            </div>
            <Bell className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
          </div>

          <div className="divide-y divide-[var(--ft-border)]">
            {notificationGroups.map((group) => {
              const tone = notificationToneTokens[group.key];

              return (
                <section className="p-4 sm:p-5" key={group.title}>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="flex items-start gap-3">
                      <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                        <group.icon className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-[var(--ft-text-primary)]">
                            {group.title}
                          </h3>
                          <Badge tone={tone.tone}>{tone.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                          {group.description}
                        </p>
                      </div>
                    </div>
                    <a
                      className={`${secondaryLinkButtonClass} w-full sm:w-auto`}
                      href={group.cta.href}
                    >
                      {group.cta.label}
                    </a>
                  </div>

                  <div className="mt-5 grid gap-4">
                    {group.items.length > 0 ? (
                      group.items.map((item) => (
                        <TimelineEvent
                          key={item.label}
                          timestamp={item.timestamp}
                          title={item.label}
                          type={item.type ?? "system"}
                        >
                          {item.detail}
                        </TimelineEvent>
                      ))
                    ) : (
                      <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-[var(--ft-green)]" />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium text-[var(--ft-text-primary)]">
                                {group.empty.title}
                              </div>
                              <Badge tone="neutral">{group.empty.status}</Badge>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                              {group.empty.copy}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {group.routes.map((route) => (
                            <span
                              className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase"
                              key={route}
                            >
                              {route}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </Panel>

        <div className="grid content-start gap-4">
          <EmptyState
            action={
              <a className={linkButtonClass} href="/campaigns/new">
                Start a Campaign
                <ArrowRight className="size-4 stroke-[1.5]" />
              </a>
            }
            copy="When the team reviews your brief, issues an invoice, posts a client update, or publishes a report, the alert will stay grouped here."
            icon={Clock}
            title="No action needed right now."
          />

          <ContextualHelpCard title="How Fliptrybe uses notifications">
            We keep alerts tied to the managed service flow: what needs your response, what the team
            has completed, and what is ready to review. Email and WhatsApp can mirror these updates
            later without changing the client inbox model.
          </ContextualHelpCard>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Routing map</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  Every future alert should land in one of these service lanes.
                </p>
              </div>
              <CheckCircle2 className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-green)]" />
            </div>

            <div className="mt-5 divide-y divide-[var(--ft-border)] border-y border-[var(--ft-border)]">
              {routingNotes.map((item) => (
                <div className="grid grid-cols-[36px_1fr] gap-3 py-4" key={item.label}>
                  <div className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                    <item.icon className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">{item.label}</div>
                    <p className="mt-1 text-sm leading-5 text-[var(--ft-text-secondary)]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </CampaignShell>
  );
}
