"use client";

import { ArrowRight, BarChart3, Download, FileText, Sparkles } from "lucide-react";

import {
  Badge,
  CampaignCard,
  ContextualHelpCard,
  EmptyState,
  Panel,
  PermissionDenied,
  ReportCard,
  SummaryStatStrip,
  TimelineEvent,
  ValueSkeleton
} from "@fliptrybe/ui";
import type { Campaign, Money } from "@fliptrybe/types";

import {
  ErrorNotice,
  PageHeader,
  SourceBadge,
  campaignProgress,
  destinationPlatform,
  linkButtonClass,
  secondaryLinkButtonClass
} from "../../campaigns/components";
import { objectiveLabels, type CampaignAnalyticsOverview } from "../../campaigns/data";
import { useCampaignDashboardData } from "../../campaigns/use-campaign-dashboard-data";
import Link from "next/link";

type ReportVariant = "live" | "pending" | "published";

function formatMoney(money?: Money | null) {
  if (!money) {
    return "Budget to be confirmed";
  }

  return new Intl.NumberFormat("en-NG", {
    currency: money.currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(money.amountMinor / 100);
}

function formatCompact(value?: number) {
  if (typeof value !== "number") {
    return "Awaiting data";
  }

  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: value > 100 ? 0 : 1,
    notation: value > 9999 ? "compact" : "standard"
  }).format(value);
}

function metricValue(analytics: CampaignAnalyticsOverview | null, name: string) {
  return analytics?.metrics.find((metric) => metric.name.toLowerCase() === name)?.value;
}

function daysAgo(value?: string | null) {
  if (!value) {
    return "recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));

  if (days === 0) {
    return "today";
  }

  return `${days}d ago`;
}

function reportType(status: Campaign["status"]) {
  if (status === "COMPLETED") {
    return "Final report";
  }

  if (status === "ACTIVE" || status === "RUNNING") {
    return "Progress report";
  }

  return "Report pending";
}

function reportVariant(status: Campaign["status"]): ReportVariant {
  if (status === "COMPLETED") {
    return "published";
  }

  if (status === "ACTIVE" || status === "RUNNING") {
    return "live";
  }

  return "pending";
}

function reportSummary(campaign: Campaign) {
  if (campaign.status === "COMPLETED") {
    return "The final report is ready with delivery context, spend notes, proof links, and the team's recommended next move.";
  }

  if (campaign.status === "ACTIVE" || campaign.status === "RUNNING") {
    return "The campaign is live. A progress snapshot can be published after the team reviews enough performance signal.";
  }

  return "This report is locked until the brief, budget, and campaign setup reach a client-ready reporting milestone.";
}

function reportNextStep(campaign: Campaign) {
  if (campaign.status === "COMPLETED") {
    return "Review the final debrief and decide whether to repeat, scale, or adjust the next campaign.";
  }

  if (campaign.status === "ACTIVE" || campaign.status === "RUNNING") {
    return "The team is watching delivery and will publish a progress note when the snapshot is useful.";
  }

  return "Keep the campaign moving through review, funding, and production before a report is released.";
}

function reportMetrics(analytics: CampaignAnalyticsOverview | null, variant: ReportVariant) {
  if (variant === "pending") {
    return [
      { label: "Readiness", value: "Locked" },
      { label: "Spend", value: "Awaiting data" },
      { label: "Proof", value: "Queued" }
    ];
  }

  const impressions = metricValue(analytics, "impressions");
  const reach = metricValue(analytics, "reach");
  const clicks = metricValue(analytics, "clicks");

  return [
    { label: "Impressions", value: formatCompact(impressions) },
    { label: "Reach", value: formatCompact(reach) },
    { label: "Clicks", value: formatCompact(clicks) }
  ];
}

function reportPeriod(campaign: Campaign) {
  const started = campaign.schedule.startsAt ? new Date(campaign.schedule.startsAt) : null;
  const ended = campaign.schedule.endsAt ? new Date(campaign.schedule.endsAt) : null;

  if (!started || Number.isNaN(started.getTime())) {
    return "Flight dates pending";
  }

  const formatter = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium"
  });

  if (ended && !Number.isNaN(ended.getTime())) {
    return `${formatter.format(started)} - ${formatter.format(ended)}`;
  }

  return formatter.format(started);
}

function ReportLoadingState() {
  return (
    <div className="grid gap-4">
      {[0, 1, 2].map((item) => (
        <Panel className="grid gap-4 p-4" key={item}>
          <div className="flex items-start justify-between gap-3">
            <div className="grid flex-1 gap-2">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-64 max-w-full" />
            </div>
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="skeleton h-20 rounded-[var(--radius-sm)]" />
            <div className="skeleton h-20 rounded-[var(--radius-sm)]" />
            <div className="skeleton h-20 rounded-[var(--radius-sm)]" />
          </div>
          <div className="grid gap-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </Panel>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { analytics, campaigns, error, forbidden, loading, source } = useCampaignDashboardData();
  const liveCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE" || campaign.status === "RUNNING"
  );
  const publishedReports = campaigns.filter(
    (campaign) => reportVariant(campaign.status) === "published"
  ).length;
  const liveReports = campaigns.filter(
    (campaign) => reportVariant(campaign.status) === "live"
  ).length;
  const lockedReports = campaigns.filter(
    (campaign) => reportVariant(campaign.status) === "pending"
  ).length;

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view reports for this workspace. Contact your workspace owner
        if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className={`${secondaryLinkButtonClass} w-full sm:w-auto`} href="/os/campaigns">
              Campaign Desk
            </Link>
            <Link className={`${linkButtonClass} w-full sm:w-auto`} href="/os/campaigns/new">
              <Sparkles className="size-4 stroke-[1.5]" />
              Start a Campaign
            </Link>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Campaign reports</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Reports"
      />

      <ErrorNotice message={error} />

      <section className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_40%),linear-gradient(180deg,var(--ft-bg-surface),var(--ft-bg-muted))] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-micro inline-flex items-center gap-2 rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-base)]/60 px-3 py-1 font-mono tracking-[0.18em] text-[var(--ft-text-muted)] uppercase">
              Report library
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-3xl">
              Final reports, live snapshots, and locked debriefs in one view.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              Track what is published, what is still in progress, and what is waiting for operator
              review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{loading ? "Syncing" : `${publishedReports} published`}</Badge>
            <Badge tone="info">
              {loading ? <ValueSkeleton width="w-16" /> : `${liveReports} live`}
            </Badge>
            <Badge tone="neutral">
              {loading ? <ValueSkeleton width="w-16" /> : `${lockedReports} locked`}
            </Badge>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SummaryStatStrip
          items={[
            {
              label: "campaigns tracked",
              value: loading ? <ValueSkeleton width="w-10" /> : campaigns.length
            },
            {
              label: "published reports",
              value: loading ? <ValueSkeleton width="w-10" /> : publishedReports
            },
            {
              label: "live snapshots",
              value: loading ? <ValueSkeleton width="w-10" /> : liveReports
            }
          ]}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          {loading ? <ReportLoadingState /> : null}

          {!loading && campaigns.length === 0 ? (
            <EmptyState
              action={
                <Link className={linkButtonClass} href="/os/campaigns/new">
                  Start a Campaign
                  <ArrowRight className="size-4 stroke-[1.5]" />
                </Link>
              }
              icon={FileText}
              title="Your reports will appear here."
            >
              Reports are published by the Fliptrybe team at key campaign milestones, usually
              halfway through and at the end.
            </EmptyState>
          ) : null}

          {!loading
            ? campaigns.map((campaign) => {
                const variant = reportVariant(campaign.status);
                const platform = destinationPlatform(campaign.destination.kind);

                return (
                  <ReportCard
                    action={
                      <div className="flex flex-col gap-2 border-t border-[var(--ft-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm leading-6 text-[var(--ft-text-secondary)]">
                          <span className="font-medium text-[var(--ft-text-primary)]">
                            {objectiveLabels[campaign.objective]}
                          </span>{" "}
                          - {reportNextStep(campaign)}
                        </span>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Link
                            className={`${secondaryLinkButtonClass} w-full sm:w-auto`}
                            href={`/os/campaigns/${campaign.id}`}
                          >
                            View Campaign
                          </Link>
                          {variant === "pending" ? (
                            <span className="inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--ft-border-strong)] px-4 text-sm font-medium text-[var(--ft-text-muted)]">
                              Report locked
                            </span>
                          ) : (
                            <button
                              className={`${linkButtonClass} w-full sm:w-auto`}
                              onClick={() => window.print()}
                              type="button"
                            >
                              <Download className="size-4 stroke-[1.5]" />
                              Download PDF
                            </button>
                          )}
                        </div>
                      </div>
                    }
                    budget={formatMoney(campaign.budget)}
                    campaign={campaign.name}
                    key={campaign.id}
                    metrics={reportMetrics(analytics, variant)}
                    period={reportPeriod(campaign)}
                    platform={platform}
                    summary={reportSummary(campaign)}
                    title={reportType(campaign.status)}
                    variant={variant}
                  />
                );
              })
            : null}
        </div>

        <div className="grid content-start gap-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                  Report workflow
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                  Reports are prepared by the team, previewed internally, then published to the
                  client.
                </p>
              </div>
              <BarChart3 className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-purple)]" />
            </div>

            <div className="mt-5 grid gap-4">
              <TimelineEvent timestamp="During campaign" title="Performance reviewed" type="system">
                Operators pull metrics from Ads Manager and attach proof screenshots or ad links.
              </TimelineEvent>
              <TimelineEvent
                timestamp="Before client release"
                title="Report written by Fliptrybe"
                type="operator"
              >
                The summary explains what happened, what worked, and what the client should do next.
              </TimelineEvent>
              <TimelineEvent timestamp="When approved" title="Published to client" type="milestone">
                Only published reports appear in the client report center.
              </TimelineEvent>
            </div>
          </Panel>

          <ContextualHelpCard title="What clients should expect">
            This page is a debrief library, not an unfiltered analytics export. Each report should
            connect the campaign objective, manual ad placements, proof assets, spend, and
            plain-English observations from the team.
          </ContextualHelpCard>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                  Report availability
                </h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  Locked reports stay visible so clients know what is coming next.
                </p>
              </div>
              <FileText className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              {[
                { label: "Published final reports", value: publishedReports },
                { label: "Live progress snapshots", value: liveReports },
                { label: "Locked until review", value: lockedReports }
              ].map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2"
                  key={item.label}
                >
                  <span className="text-[var(--ft-text-secondary)]">{item.label}</span>
                  <span className="font-mono font-semibold text-[var(--ft-text-primary)]">
                    {loading ? <ValueSkeleton width="w-10" /> : item.value}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {liveCampaigns.slice(0, 2).map((campaign) => (
            <CampaignCard
              budget={formatMoney(campaign.budget)}
              href={`/os/campaigns/${campaign.id}`}
              key={campaign.id}
              lastUpdated={daysAgo(campaign.updatedAt)}
              name={campaign.name}
              platforms={[destinationPlatform(campaign.destination.kind)]}
              progressLabel={`${campaignProgress(campaign.status)}%`}
              serviceType="Report watchlist"
              status={campaign.status}
            />
          ))}
        </div>
      </section>
    </>
  );
}
