"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Eye,
  FileText,
  Filter,
  Folder,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
  Workflow
} from "lucide-react";

import {
  Badge,
  Button,
  FulfillmentStrip,
  MetricStrip,
  Panel,
  PermissionDenied,
  PlatformChip,
  StatusBadge,
  SummaryStatStrip,
  ValueSkeleton,
  campaignStatusMeta,
  cn
} from "@fliptrybe/ui";

import {
  fallbackCurrency,
  formatCampaignMoney,
  formatCompact,
  formatDateTime,
  metricValue,
  totalBudgetMinor
} from "../../campaigns/api";
import {
  EmptyState,
  ErrorNotice,
  InlineEmptyNote,
  LoadingBlock,
  PageHeader,
  RecommendedActionsPanel,
  SourceBadge,
  buildRecommendedActions,
  campaignProgress,
  destinationPlatform,
  linkButtonClass,
  secondaryLinkButtonClass
} from "../../campaigns/components";
import { destinationLabels, objectiveLabels } from "../../campaigns/data";
import { useCampaignDashboardData } from "../../campaigns/use-campaign-dashboard-data";
import { useFeatureFlags } from "../../lib/feature-flags";
import { useApiSession } from "../../lib/use-session";
import { SectionTabs, type SectionTab } from "../section-tabs";
import Link from "next/link";

const GROWTH_TABS_BASE: SectionTab[] = [
  { label: "Campaigns", href: "/os/campaigns", icon: Megaphone },
  { label: "Campaign Builder", href: "/os/campaigns/new", icon: Wand2 },
  { label: "Analytics", href: "/os/analytics", icon: BarChart3 },
  { label: "Reports", href: "/os/reports", icon: FileText },
  { label: "Creative Library", href: "/os/library", icon: Folder },
  { label: "AI Personas", href: "/os/personas", icon: Bot },
  { label: "AI Studio", href: "/os/studio", icon: Sparkles },
];

const filterControlClass =
  "h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)] outline-none transition focus:ring-2 focus:ring-[var(--ft-accent)]";

function campaignAccentClass(status: string) {
  if (status === "ACTIVE" || status === "RUNNING") {
    return "border-l-[var(--ft-green)]";
  }
  if (status === "PENDING_REVIEW" || status === "APPROVED" || status === "CHANGES_REQUESTED") {
    return "border-l-[var(--ft-accent)]";
  }
  if (status === "REJECTED" || status === "FAILED" || status === "CANCELLED") {
    return "border-l-[var(--ft-red)]";
  }

  return "border-l-[var(--ft-border-strong)]";
}

function campaignStageLabel(status: string) {
  if (status === "ACTIVE" || status === "RUNNING") return "Live service";
  if (status === "COMPLETED") return "Report ready";
  if (status === "CREATIVE_IN_PROGRESS" || status === "QUEUED" || status === "APPROVED") {
    return "Launch prep";
  }
  if (status === "PENDING_REVIEW" || status === "BRIEF_RECEIVED" || status === "IN_REVIEW") {
    return "Ops review";
  }
  if (status === "CHANGES_REQUESTED") return "Client action";
  if (status === "REJECTED" || status === "FAILED" || status === "CANCELLED") return "Needs review";

  return "Briefing";
}

function campaignNextAction(status: string) {
  if (status === "ACTIVE" || status === "RUNNING") return "Monitor pacing and published team updates.";
  if (status === "COMPLETED") return "Open the report and confirm final outcomes.";
  if (status === "CREATIVE_IN_PROGRESS") return "The team is checking creative and placement fit.";
  if (status === "QUEUED" || status === "APPROVED") return "Launch setup is waiting on final operator handoff.";
  if (status === "PENDING_REVIEW" || status === "BRIEF_RECEIVED" || status === "IN_REVIEW") {
    return "Review is in progress; plan and invoice updates will follow.";
  }
  if (status === "CHANGES_REQUESTED") return "Add the requested details so review can continue.";
  if (status === "REJECTED" || status === "FAILED" || status === "CANCELLED") {
    return "Check the record before funding or relaunching.";
  }

  return "Complete the brief so the managed desk can review it.";
}

function isLiveCampaign(status: string) {
  return status === "ACTIVE" || status === "RUNNING" || status === "LIVE";
}

function isReportReady(status: string) {
  return status === "COMPLETED" || status === "REPORTING";
}

function isReviewOnly(status: string) {
  return status === "PENDING_REVIEW" || status === "BRIEF_RECEIVED" || status === "IN_REVIEW";
}

function briefActionLabel(status: string) {
  if (status === "DRAFT") return "Open draft";
  if (status === "CHANGES_REQUESTED") return "Review request";
  if (status === "PENDING_REVIEW" || status === "BRIEF_RECEIVED" || status === "IN_REVIEW") {
    return "Track review";
  }
  if (status === "APPROVED" || status === "CREATIVE_IN_PROGRESS" || status === "QUEUED" || status === "PLAN_SENT") {
    return "Check launch prep";
  }
  if (isLiveCampaign(status)) return "Monitor live";
  if (isReportReady(status)) return "Review report";

  return "View brief";
}

export default function CampaignsPage() {
  const { aiInsights, analytics, campaigns, error, forbidden, loading, refresh, source, wallet } =
    useCampaignDashboardData();
  const { flags, ready: flagsReady } = useFeatureFlags();
  const { session } = useApiSession();

  const growthTabs: SectionTab[] = [
    ...GROWTH_TABS_BASE,
    ...(flagsReady && flags["workflowAutomation"] === true
      ? [{ label: "Automation", href: "/os/automation", icon: Workflow }]
      : []),
    ...(session?.isPlatformAdmin || session?.permissions?.includes("campaign:approve")
      ? [{ label: "Approvals", href: "/os/approvals", icon: ClipboardCheck }]
      : []),
    ...(flagsReady &&
    flags["trustEngine"] === true &&
    (session?.isPlatformAdmin || session?.permissions?.includes("analytics:read"))
      ? [{ label: "Trust Engine", href: "/os/trust-engine", icon: ShieldCheck }]
      : []),
  ];

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view campaigns for this workspace. Contact your workspace
        owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE" || campaign.status === "RUNNING"
  ).length;
  const pendingReviewCampaigns = campaigns.filter((campaign) => campaign.status === "PENDING_REVIEW").length;
  const completedCampaigns = campaigns.filter((campaign) => campaign.status === "COMPLETED").length;
  const budgetCurrency = fallbackCurrency(campaigns, wallet);
  const spend = formatCampaignMoney({
    amountMinor: totalBudgetMinor(campaigns),
    currency: budgetCurrency
  });
  const impressions = metricValue(analytics, "impressions");
  const avgCpm = formatCampaignMoney({
    amountMinor: impressions > 0 ? Math.round((totalBudgetMinor(campaigns) * 1000) / impressions) : 0,
    currency: budgetCurrency
  });
  const liveViewers = metricValue(analytics, "live_viewers");
  const roiBps = metricValue(analytics, "roi_bps");
  const trend = analytics?.trend ?? [];
  const maxSpend = Math.max(1, ...trend.map((point) => point.spendMinor));
  const primaryInsight = aiInsights?.items[0];
  const recommendedActions = loading ? [] : buildRecommendedActions(campaigns, wallet);
  const platformOptions = Array.from(
    new Set(campaigns.map((campaign) => destinationPlatform(campaign.destination.kind)))
  );
  const visibleCampaigns = campaigns.filter((campaign) => {
    const platform = destinationPlatform(campaign.destination.kind);
    const matchesStatus = statusFilter === "ALL" || campaign.status === statusFilter;
    const matchesPlatform = platformFilter === "ALL" || platform === platformFilter;
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      normalizedQuery.length === 0 ||
      campaign.name.toLowerCase().includes(normalizedQuery) ||
      destinationLabels[campaign.destination.kind].toLowerCase().includes(normalizedQuery) ||
      objectiveLabels[campaign.objective].toLowerCase().includes(normalizedQuery);

    return matchesStatus && matchesPlatform && matchesQuery;
  });

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <Link className={secondaryLinkButtonClass} href="/os/studio">
              <Sparkles className="size-4 stroke-[1.5]" />
              Try Studio
            </Link>
            <Link className={linkButtonClass} href="/os/campaigns/new">
              <Plus className="size-4 stroke-[1.5]" />
              Start a Campaign
            </Link>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Client campaign desk</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Your Campaigns"
      />

      <div className="mt-4">
        <SectionTabs items={growthTabs} />
      </div>

      <ErrorNotice message={error} />

      <section className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--ft-accent)_16%,transparent),transparent_38%),linear-gradient(180deg,var(--ft-bg-surface),var(--ft-bg-muted))] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-base)]/60 px-3 py-1 font-mono text-micro uppercase tracking-[0.18em] text-[var(--ft-text-muted)]">
              Managed campaign desk
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-3xl">
              One view for briefs, launch prep, live spend, and reports.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ft-text-secondary)]">
              Review the state of your active campaigns, filter the queue, and jump straight into the next action without leaving the desk.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Live monitoring</Badge>
            <Badge tone="info">{loading ? "Syncing" : `${activeCampaigns} active`}</Badge>
            <Badge tone="neutral">{loading ? <ValueSkeleton width="w-16" /> : `${pendingReviewCampaigns} in review`}</Badge>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <RecommendedActionsPanel actions={recommendedActions} />
        <SummaryStatStrip
          className="mb-4"
          items={[
            { label: "active campaigns", value: loading ? <ValueSkeleton width="w-10" /> : activeCampaigns },
            { label: "pending reviews", value: loading ? <ValueSkeleton width="w-10" /> : pendingReviewCampaigns },
            { label: "next reports tracked", value: loading ? <ValueSkeleton width="w-10" /> : completedCampaigns },
            { label: "portfolio spend", value: loading ? <ValueSkeleton width="w-24" /> : spend }
          ]}
        />
        <MetricStrip
          items={[
            {
              label: "Impressions",
              value: loading ? <ValueSkeleton width="w-16" /> : formatCompact(impressions),
              detail: "Portfolio-wide, all live campaigns"
            },
            {
              label: "Avg CPM",
              value: loading ? <ValueSkeleton width="w-24" /> : avgCpm,
              detail: "Estimated portfolio cost"
            }
          ]}
        />
      </section>

      <section className="mt-4 flex flex-col gap-3 border-y border-[var(--ft-border)] py-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 font-mono text-micro font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
          <Filter className="size-4 stroke-[1.5]" />
          Filters
        </div>
        <select
          className={filterControlClass}
          onChange={(event) => setStatusFilter(event.target.value)}
          value={statusFilter}
        >
          <option value="ALL">All statuses</option>
          {Array.from(new Set(campaigns.map((campaign) => campaign.status))).map((status) => (
            <option key={status} value={status}>
              {campaignStatusMeta(status).label}
            </option>
          ))}
        </select>
        <select
          className={filterControlClass}
          onChange={(event) => setPlatformFilter(event.target.value)}
          value={platformFilter}
        >
          <option value="ALL">All platforms</option>
          {platformOptions.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)] lg:max-w-sm">
          <Search className="size-4 shrink-0 stroke-[1.5]" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaigns"
            value={query}
          />
        </label>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <div className="min-w-0">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Your active campaigns</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Track live work, submitted briefs, launch holds, and reports in one client view.
              </p>
            </div>
            <Megaphone className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
          </div>
          {loading ? (
            <Panel className="p-4">
              <LoadingBlock label="Loading campaigns" />
            </Panel>
          ) : visibleCampaigns.length === 0 ? (
            <Panel className="p-4">
              <EmptyState
                action={
                  <Link className={secondaryLinkButtonClass} href="/os/campaigns/new">
                    <Plus className="size-4 stroke-[1.5]" />
                    Start a Campaign
                  </Link>
                }
                copy={
                  campaigns.length === 0
                    ? "When you're ready to grow, our team is here to help. Start with a brief and we'll build your campaign strategy."
                    : "No campaigns match the selected filters."
                }
                icon={Megaphone}
                title={campaigns.length === 0 ? "No campaigns yet." : "No campaigns match this filter."}
              />
            </Panel>
          ) : (
            <div className="grid gap-3">
              {visibleCampaigns.map((campaign) => {
                const platform = destinationPlatform(campaign.destination.kind);
                const reviewOnly = isReviewOnly(campaign.status);

                return (
                  <Panel
                    className={cn(
                      "overflow-hidden border-l-4 transition hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-bg-raised)]",
                      campaignAccentClass(campaign.status)
                    )}
                    key={campaign.id}
                  >
                    <div className="grid gap-4 p-4 sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={campaign.status} />
                            <PlatformChip platform={platform} />
                            <Badge tone="neutral">{campaignStageLabel(campaign.status)}</Badge>
                          </div>
                          <Link
                            className="mt-3 block text-lg font-semibold text-[var(--ft-text-primary)] transition hover:text-[var(--ft-accent)]"
                            href={`/os/campaigns/${campaign.id}`}
                          >
                            {campaign.name}
                          </Link>
                          <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                            {objectiveLabels[campaign.objective]} service for{" "}
                            {destinationLabels[campaign.destination.kind]}.
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[280px]">
                          <div className="border-t border-[var(--ft-border)] pt-3 sm:border-t-0 sm:pt-0">
                            <div className="font-mono text-micro font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                              Budget
                            </div>
                            <div className="mt-1 font-mono text-lg text-[var(--ft-text-primary)]">
                              {formatCampaignMoney(campaign.budget)}
                            </div>
                          </div>
                          <div className="border-t border-[var(--ft-border)] pt-3 sm:border-t-0 sm:pt-0">
                            <div className="font-mono text-micro font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                              Launch window
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-sm text-[var(--ft-text-secondary)]">
                              <CalendarDays className="size-4 shrink-0 stroke-[1.5]" />
                              <span>{formatDateTime(campaign.schedule.startsAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 border-t border-[var(--ft-border)] pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-[var(--ft-text-primary)]">
                              Fulfillment path
                            </span>
                            <span className="font-mono text-micro uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                              {campaignProgress(campaign.status)}%
                            </span>
                          </div>
                          <FulfillmentStrip
                            className="mt-3"
                            currentStep={Math.min(4, Math.max(0, Math.round(campaignProgress(campaign.status) / 25)))}
                            steps={["Brief", "Strategy", "Creative", "Live", "Report"]}
                            variant="labeled"
                          />
                          <div className="mt-4 grid gap-3 text-sm text-[var(--ft-text-secondary)] md:grid-cols-3">
                            <div>
                              <div className="font-mono text-micro uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                                Next action
                              </div>
                              <div className="mt-1 leading-5">{campaignNextAction(campaign.status)}</div>
                            </div>
                            <div>
                              <div className="font-mono text-micro uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                                Provider
                              </div>
                              <div className="mt-1 font-medium text-[var(--ft-text-primary)]">
                                {campaign.provider}
                              </div>
                            </div>
                            <div>
                              <div className="font-mono text-micro uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                                Destination
                              </div>
                              <div className="mt-1 font-medium text-[var(--ft-text-primary)]">
                                {destinationLabels[campaign.destination.kind]}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                          <Link
                            aria-disabled={reviewOnly}
                            className={cn(
                              `${secondaryLinkButtonClass} h-9 px-3`,
                              reviewOnly ? "cursor-not-allowed opacity-60" : ""
                            )}
                            href={`/os/campaigns/${campaign.id}`}
                            onClick={(event) => {
                              if (reviewOnly) {
                                event.preventDefault();
                              }
                            }}
                            title={
                              reviewOnly
                                ? "The Fliptrybe team is reviewing this brief. Campaign actions unlock after the plan is ready."
                                : undefined
                            }
                          >
                            <Eye className="size-4 stroke-[1.5]" />
                            {briefActionLabel(campaign.status)}
                          </Link>
                          {isLiveCampaign(campaign.status) || isReportReady(campaign.status) ? (
                            <Link className={`${linkButtonClass} h-9 px-3`} href="/os/reports">
                              <BarChart3 className="size-4 stroke-[1.5]" />
                              View report
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </div>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Managed ads desk</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Review signals the operators will use before launch.
              </p>
            </div>
            <Sparkles className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
          </div>
          {loading ? (
            <div className="mt-5">
              <LoadingBlock label="Loading insights" />
            </div>
          ) : primaryInsight ? (
            <div className="mt-5 border-y border-[var(--ft-border)] py-4">
              <div className="font-medium text-[var(--ft-text-primary)]">{primaryInsight.label}</div>
              <div className="mt-3 divide-y divide-[var(--ft-border)] text-sm text-[var(--ft-text-secondary)]">
                {primaryInsight.reasons.slice(0, 3).map((reason) => (
                  <div className="py-2 first:pt-0 last:pb-0" key={reason}>
                    {reason.replaceAll("_", " ")}
                  </div>
                ))}
              </div>
            </div>
          ) : campaigns.length === 0 ? (
            <InlineEmptyNote label="No desk insights yet — start a campaign to generate them." />
          ) : (
            <div className="mt-5">
              <EmptyState
                copy="Team observations will appear after the campaign desk has enough delivery signal to review."
                icon={Sparkles}
                title="No desk insights yet"
              />
            </div>
          )}
          <Link className={`${secondaryLinkButtonClass} mt-4 w-full`} href="/os/analytics">
            <BarChart3 className="size-4 stroke-[1.5]" />
            View performance snapshots
          </Link>
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Performance pulse</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                {(roiBps / 100).toFixed(1)}% ROI signal / {formatCompact(liveViewers)} live viewers
              </p>
            </div>
            <BarChart3 className="size-5 stroke-[1.5] text-[var(--ft-green)]" />
          </div>
          {trend.length === 0 && campaigns.length === 0 ? (
            <InlineEmptyNote label="No trend data yet — start a campaign to begin tracking." />
          ) : trend.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                copy="Spend and conversion trend points will appear after analytics ingestion."
                icon={BarChart3}
                title="No trend data"
              />
            </div>
          ) : (
            <div className="mt-5 flex h-56 items-end gap-2 border-t border-[var(--ft-border)] pt-4">
              {trend.map((point) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={point.day}>
                  <div
                    className="w-full rounded-t-[var(--radius-sm)] bg-[var(--ft-accent)]"
                    style={{ height: `${Math.max(18, (point.spendMinor / maxSpend) * 180)}px` }}
                  />
                  <div className="font-mono text-micro font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                    {point.day}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Recent launch window</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Latest schedule and provider state.
              </p>
            </div>
            <ArrowRight className="size-5 stroke-[1.5] text-[var(--ft-text-muted)]" />
          </div>
          <div className="mt-5 divide-y divide-[var(--ft-border)] border-y border-[var(--ft-border)]">
            {loading ? (
              <div className="py-4">
                <LoadingBlock label="Loading launch windows" />
              </div>
            ) : campaigns.length === 0 ? (
              <InlineEmptyNote label="No launch windows yet." />
            ) : (
              campaigns.slice(0, 3).map((campaign) => (
                <Link
                  className="grid gap-3 py-3 transition hover:bg-[var(--ft-bg-muted)] sm:grid-cols-[1fr_auto]"
                  href={`/os/campaigns/${campaign.id}`}
                  key={campaign.id}
                >
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">{campaign.name}</div>
                    <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                      Starts {formatDateTime(campaign.schedule.startsAt)}
                    </div>
                  </div>
                  <StatusBadge status={campaign.status} />
                </Link>
              ))
            )}
          </div>
        </Panel>
      </section>
      <Link
        className="fixed bottom-20 right-4 z-40 inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-[var(--ft-accent)] px-4 text-sm font-semibold text-[var(--ft-text-inverse)] shadow-[var(--shadow-lg)] transition hover:bg-[var(--ft-accent-dim)] md:hidden"
        href="/os/campaigns/new"
      >
        <Plus className="size-4 stroke-[1.5]" />
        Start
      </Link>
    </>
  );
}
