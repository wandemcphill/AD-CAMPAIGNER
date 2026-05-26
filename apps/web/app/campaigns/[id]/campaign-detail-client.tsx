"use client";

import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  LinkIcon,
  Play,
  RefreshCw,
  UploadCloud,
  WalletCards,
  type LucideIcon
} from "lucide-react";

import {
  Badge,
  Button,
  FulfillmentStrip,
  Panel,
  PlatformChip,
  ProofItem,
  TimelineEvent,
  campaignStatusMeta
} from "@fliptrybe/ui";
import type { Campaign } from "@fliptrybe/types";

import { formatCampaignMoney, formatCompact, formatDateTime } from "../api";
import {
  CampaignShell,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  SourceBadge,
  StatusBadge,
  linkButtonClass,
  secondaryLinkButtonClass
} from "../components";
import { destinationLabels, objectiveLabels, type CampaignAnalyticsOverview } from "../data";
import { useCampaignDashboardData } from "../use-campaign-dashboard-data";

const processSteps = [
  "Brief Received",
  "Under Review",
  "Campaign Building",
  "Campaign Live",
  "Report Ready"
];

const clientStatusCopy: Record<string, { headline: string; detail: string }> = {
  DRAFT: {
    headline: "Draft - not yet submitted",
    detail: "Finish the brief when you are ready for the Fliptrybe team to review it."
  },
  PENDING_REVIEW: {
    headline: "Brief Received - your team will review within 1 business day",
    detail: "The campaign is on the team desk. Updates will appear in the activity rail."
  },
  CHANGES_REQUESTED: {
    headline: "Changes Requested - see your team's notes below",
    detail: "Reply with the requested details or upload revised creative assets before review continues."
  },
  APPROVED: {
    headline: "Plan Ready - being prepared for launch",
    detail: "Your team has cleared the brief and is preparing the ad setup."
  },
  CREATIVE_IN_PROGRESS: {
    headline: "Campaign Building",
    detail: "Assets are being checked against the placement plan before launch."
  },
  QUEUED: {
    headline: "Plan Ready - setup is waiting on the team",
    detail: "The campaign is approved and waiting for the next operator handoff."
  },
  ACTIVE: {
    headline: "Campaign Live",
    detail: "Spend and results are updated by the team as the campaign runs."
  },
  RUNNING: {
    headline: "Campaign Live",
    detail: "Spend and results are updated by the team as the campaign runs."
  },
  PAUSED: {
    headline: "On Hold - your team will be in touch",
    detail: "The campaign is paused while the next action is confirmed."
  },
  COMPLETED: {
    headline: "Completed - your report is ready",
    detail: "The campaign has wrapped. Review the published results and team notes."
  },
  REJECTED: {
    headline: "Not approved - see reason below",
    detail: "Use the team's feedback to adjust the brief before resubmitting."
  },
  CANCELLED: {
    headline: "Cancelled",
    detail: "Any unspent budget will be released back to your wallet according to the campaign terms."
  },
  FAILED: {
    headline: "Something went wrong - we've flagged it",
    detail: "The team has been alerted and will update the campaign record."
  }
};

type ActivityEvent = {
  detail: string;
  fileChip?: string;
  icon: LucideIcon;
  id: string;
  time?: string | null;
  title: string;
  type: "system" | "admin" | "client";
};

function platformFromDestination(kind: string) {
  if (kind.includes("INSTAGRAM")) return "Instagram";
  if (kind.includes("FACEBOOK")) return "Facebook";
  if (kind.includes("TIKTOK")) return "TikTok";
  return kind.replaceAll("_", " ");
}

function processIndex(status: string) {
  if (status === "COMPLETED") return 4;
  if (status === "ACTIVE" || status === "RUNNING") return 3;
  if (status === "CREATIVE_IN_PROGRESS" || status === "IN_PRODUCTION") return 2;
  if (status === "APPROVED" || status === "PLAN_SENT" || status === "QUEUED") return 2;
  if (status === "PENDING_REVIEW" || status === "IN_REVIEW" || status === "CHANGES_REQUESTED" || status === "REJECTED") return 1;
  return 0;
}

function statusCopy(campaign: Campaign) {
  const copy = clientStatusCopy[campaign.status] ?? {
    headline: campaignStatusMeta(campaign.status).label,
    detail: "Your campaign team will update this record as work progresses."
  };

  if (campaign.status === "ACTIVE" || campaign.status === "RUNNING") {
    const start = formatDateOnly(campaign.schedule.startsAt);
    return {
      ...copy,
      headline: `Campaign Live - started ${start}`
    };
  }

  if (campaign.status === "COMPLETED") {
    return {
      ...copy,
      headline: `Campaign ended - ${formatDateOnly(campaign.updatedAt)}`
    };
  }

  return copy;
}

function primaryActionHelper(status: string) {
  if (status === "DRAFT") return "Complete the brief when you are ready for team review.";
  if (status === "CHANGES_REQUESTED") return "The fastest next step is to review the team note and upload or edit the missing detail.";
  if (status === "APPROVED") return "Your plan is approved. Check funding details while the team prepares the launch handoff.";
  if (status === "CREATIVE_IN_PROGRESS" || status === "QUEUED") {
    return "The Fliptrybe team is handling setup. The next visible update will be launch proof or a report milestone.";
  }
  if (status === "ACTIVE" || status === "RUNNING") return "Monitor performance while the team updates spend, proof, and pacing notes.";
  if (status === "COMPLETED") return "Review the final results and keep this record for follow-up planning.";
  if (status === "PENDING_REVIEW") return "Review is underway. You do not need to take action unless the team requests changes.";
  if (status === "REJECTED" || status === "FAILED" || status === "CANCELLED" || status === "PAUSED") {
    return "Check the activity rail before resubmitting, funding, or planning a replacement campaign.";
  }

  return "Use the campaign record to follow the next team update.";
}

function formatDateOnly(value?: string | null) {
  if (!value) return "not scheduled";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium"
  }).format(date);
}

function flightWindow(campaign: Campaign) {
  const start = new Date(campaign.schedule.startsAt);
  const hasStart = !Number.isNaN(start.getTime());
  const fallbackEnd = hasStart ? new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000) : null;
  const explicitEnd = campaign.schedule.endsAt ? new Date(campaign.schedule.endsAt) : null;
  const end = explicitEnd && !Number.isNaN(explicitEnd.getTime()) ? explicitEnd : fallbackEnd;

  if (!hasStart || !end) {
    return {
      endLabel: "Team to confirm",
      progress: processIndex(campaign.status) * 22,
      startLabel: "Not scheduled"
    };
  }

  const now = new Date();
  const duration = Math.max(end.getTime() - start.getTime(), 1);
  const elapsed = now.getTime() - start.getTime();
  const progress =
    campaign.status === "COMPLETED"
      ? 100
      : campaign.status === "DRAFT" || campaign.status === "PENDING_REVIEW"
        ? 8
        : Math.min(100, Math.max(8, Math.round((elapsed / duration) * 100)));

  return {
    endLabel: formatDateOnly(end.toISOString()),
    progress,
    startLabel: formatDateOnly(campaign.schedule.startsAt)
  };
}

function analyticsMetric(analytics: CampaignAnalyticsOverview | null, name: string) {
  return analytics?.metrics.find((metric) => metric.name === name)?.value ?? 0;
}

function analyticsSpendMinor(analytics: CampaignAnalyticsOverview | null) {
  return analytics?.trend.reduce((total, point) => total + point.spendMinor, 0) ?? 0;
}

function campaignMetrics(campaign: Campaign, analytics: CampaignAnalyticsOverview | null) {
  const hasTeamResults = campaign.status === "ACTIVE" || campaign.status === "RUNNING" || campaign.status === "COMPLETED";
  const impressions = hasTeamResults ? analyticsMetric(analytics, "impressions") : 0;
  const clicks = hasTeamResults ? analyticsMetric(analytics, "clicks") : 0;
  const spendMinor = hasTeamResults ? analyticsSpendMinor(analytics) : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

  return [
    {
      detail:
        impressions > 0 ? `as of ${formatDateOnly(campaign.updatedAt)} - updated by team` : "awaiting launch",
      label: "Impressions",
      value: formatCompact(impressions)
    },
    {
      detail: clicks > 0 ? "client-visible result entry" : "awaiting launch",
      label: "Clicks",
      value: formatCompact(clicks)
    },
    {
      detail: "wallet spend entered by team",
      label: "Spend",
      value: formatCampaignMoney({ amountMinor: spendMinor, currency: campaign.budget.currency })
    },
    {
      detail: impressions > 0 ? "clicks divided by impressions" : "awaiting launch",
      label: "CTR",
      value: `${ctr.toFixed(2)}%`
    }
  ];
}

function creativeFormatLabel(campaign: Campaign) {
  const destination = campaign.destination.kind;

  if (destination.includes("LIVE")) return "Live campaign proof";
  if (destination.includes("REEL") || destination.includes("TIKTOK")) return "9:16 video creative";
  if (destination.includes("FACEBOOK") || destination.includes("INSTAGRAM")) return "Feed and story creative";
  return "Campaign creative";
}

function buildActivityEvents(campaign: Campaign): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      detail: "Your brief is saved with the campaign team.",
      fileChip: "BRIEF",
      icon: FileText,
      id: "brief",
      time: campaign.submittedAt ?? campaign.createdAt,
      title: "Brief sent by you",
      type: "client"
    }
  ];

  if (campaign.status === "CHANGES_REQUESTED") {
    events.push({
      detail: "The team needs a few updates before review can continue.",
      icon: UploadCloud,
      id: "changes",
      time: campaign.updatedAt,
      title: "Updates requested by team",
      type: "admin"
    });
  }

  if (campaign.approvedAt || ["APPROVED", "CREATIVE_IN_PROGRESS", "QUEUED", "ACTIVE", "RUNNING", "COMPLETED"].includes(campaign.status)) {
    events.push({
      detail: "The brief cleared review and moved into launch preparation.",
      icon: CheckCircle2,
      id: "approved",
      time: campaign.approvedAt ?? campaign.updatedAt,
      title: "Brief approved by team",
      type: "admin"
    });
  }

  if (["CREATIVE_IN_PROGRESS", "QUEUED", "ACTIVE", "RUNNING", "COMPLETED"].includes(campaign.status)) {
    events.push({
      detail: "Assets and placement details are being checked before launch.",
      fileChip: creativeFormatLabel(campaign).toUpperCase(),
      icon: UploadCloud,
      id: "creative",
      time: campaign.updatedAt,
      title: "Creative review started",
      type: "client"
    });
  }

  if (campaign.status === "ACTIVE" || campaign.status === "RUNNING" || campaign.status === "COMPLETED") {
    events.push({
      detail: `${formatCampaignMoney(campaign.budget)} is allocated from your wallet for this campaign.`,
      icon: WalletCards,
      id: "budget",
      time: campaign.schedule.startsAt,
      title: "Campaign budget held",
      type: "system"
    });
    events.push({
      detail: "The campaign is running across the selected placement.",
      icon: Play,
      id: "live",
      time: campaign.schedule.startsAt,
      title: "Campaign launched by team",
      type: "admin"
    });
  }

  if (campaign.status === "COMPLETED") {
    events.push({
      detail: "Your campaign manager can publish the final report from the ops workspace.",
      icon: FileText,
      id: "complete",
      time: campaign.updatedAt,
      title: "Campaign wrapped",
      type: "admin"
    });
  }

  if (["REJECTED", "CANCELLED", "FAILED", "PAUSED"].includes(campaign.status)) {
    events.push({
      detail: statusCopy(campaign).detail,
      icon: Clock,
      id: "blocked",
      time: campaign.updatedAt,
      title: statusCopy(campaign).headline,
      type: "admin"
    });
  }

  if (events.length === 1 && campaign.updatedAt !== campaign.createdAt) {
    events.push({
      detail: "Campaign updated by team.",
      icon: Clock,
      id: "updated",
      time: campaign.updatedAt,
      title: "Campaign record updated",
      type: "system"
    });
  }

  return events.reverse();
}

function ProcessTimeline({ campaign }: { campaign: Campaign }) {
  const current = processIndex(campaign.status);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
      <FulfillmentStrip currentStep={current} steps={processSteps} variant="labeled" />
    </div>
  );
}

function FlightBar({ campaign }: { campaign: Campaign }) {
  const flight = flightWindow(campaign);

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            Flight
          </div>
          <h2 className="mt-1 text-lg font-medium text-[var(--ft-text-primary)]">Launch window</h2>
        </div>
        <div className="font-mono text-xs text-[var(--ft-text-muted)]">{campaign.schedule.timezone}</div>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 font-mono text-xs text-[var(--ft-text-secondary)]">
          <span>{flight.startLabel}</span>
          <span>{flight.endLabel}</span>
        </div>
        <div className="mt-3 h-2 rounded-sm bg-[var(--ft-bg-muted)]">
          <div className="h-2 rounded-sm bg-[var(--ft-accent)]" style={{ width: `${flight.progress}%` }} />
        </div>
      </div>
    </Panel>
  );
}

function ActivityTimeline({ campaign }: { campaign: Campaign }) {
  const events = buildActivityEvents(campaign);

  return (
    <Panel className="overflow-hidden xl:sticky xl:top-[76px]" id="activity">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
        <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Activity</h2>
        <Badge tone="neutral">{events.length} logged</Badge>
      </div>
      <div className="p-5">
        {events.length === 0 ? (
          <EmptyState
            copy="Your team will log updates here as soon as review starts."
            icon={Clock}
            title="Waiting to begin"
          />
        ) : (
          <div className="grid gap-5">
            {events.map((event) => (
              <TimelineEvent
                key={event.id}
                timestamp={formatDateTime(event.time)}
                title={event.title}
                type={event.type === "admin" ? "operator" : event.fileChip ? "milestone" : "system"}
              >
                <p>{event.detail}</p>
                {event.fileChip ? (
                  <div className="mt-3">
                    <ProofItem
                      detail="Attached to this campaign update"
                      platform={platformFromDestination(campaign.destination.kind)}
                      title={event.fileChip}
                      type="file"
                    />
                  </div>
                ) : null}
              </TimelineEvent>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

export function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const { analytics, campaigns, error, loading, refresh, source } = useCampaignDashboardData();
  const campaign = campaigns.find((item) => item.id === campaignId);

  function renderPrimaryAction(current: Campaign) {
    const status = current.status;

    if (status === "DRAFT") {
      return (
        <a className={linkButtonClass} href="/campaigns/new">
          <FileText className="size-4" />
          Send Brief to Team
        </a>
      );
    }

    if (status === "CHANGES_REQUESTED") {
      return (
        <a className={linkButtonClass} href="#activity">
          <UploadCloud className="size-4" />
          Review Team Notes
        </a>
      );
    }

    if (status === "APPROVED") {
      return (
        <a className={linkButtonClass} href="/billing">
          <WalletCards className="size-4" />
          Check Funding
        </a>
      );
    }

    if (status === "CREATIVE_IN_PROGRESS" || status === "QUEUED") {
      return (
        <Button disabled>
          <Clock className="size-4" />
          Team Preparing Launch
        </Button>
      );
    }

    if (status === "ACTIVE" || status === "RUNNING") {
      return (
        <a className={linkButtonClass} href="/reports">
          <BarChart3 className="size-4" />
          Monitor Results
        </a>
      );
    }

    if (status === "COMPLETED") {
      return (
        <a className={linkButtonClass} href="/reports">
          <BarChart3 className="size-4" />
          Review Results
        </a>
      );
    }

    if (status === "PENDING_REVIEW") {
      return (
        <Button disabled>
          <Clock className="size-4" />
          Team Reviewing Brief
        </Button>
      );
    }

    return (
      <a className={linkButtonClass} href="/campaigns/new">
        <FileText className="size-4" />
        Resubmit Campaign
      </a>
    );
  }

  return (
    <CampaignShell active="/campaigns">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <a className={secondaryLinkButtonClass} href="/campaigns">
              <ArrowLeft className="size-4" />
              Back
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Campaign status</Badge>
            <SourceBadge source={source} />
          </>
        }
        title={campaign?.name ?? "Campaign"}
      />

      <ErrorNotice message={error} />

      {loading ? (
        <section className="mt-6">
          <LoadingBlock label="Loading campaign" />
        </section>
      ) : !campaign ? (
        <section className="mt-6">
          <EmptyState
            action={
              <a className={secondaryLinkButtonClass} href="/campaigns">
                View campaigns
              </a>
            }
            copy="This campaign was not found in the active workspace."
            icon={CalendarClock}
            title="Campaign not found"
          />
        </section>
      ) : (
        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="grid gap-5">
            <Panel className="overflow-hidden">
              <div className="border-b border-[var(--ft-border)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={campaign.status} />
                      <PlatformChip platform={platformFromDestination(campaign.destination.kind)} />
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-[var(--ft-text-primary)]">
                      {statusCopy(campaign).headline}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
                      {statusCopy(campaign).detail}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:min-w-[220px] lg:justify-items-end">
                    {renderPrimaryAction(campaign)}
                    <p className="max-w-xs text-xs leading-5 text-[var(--ft-text-secondary)] lg:text-right">
                      {primaryActionHelper(campaign.status)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-[var(--ft-border)] md:grid-cols-2 xl:grid-cols-4">
                {campaignMetrics(campaign, analytics).map((item) => (
                  <div className="bg-[var(--ft-bg-surface)] p-4" key={item.label}>
                    <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                      {item.label}
                    </div>
                    <div className="mt-2 font-mono text-2xl font-medium text-[var(--ft-text-primary)]">
                      {item.value}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-[var(--ft-text-secondary)]">{item.detail}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <ProcessTimeline campaign={campaign} />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Panel className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                      Creative
                    </div>
                    <h2 className="mt-1 text-lg font-medium text-[var(--ft-text-primary)]">
                      {creativeFormatLabel(campaign)}
                    </h2>
                  </div>
                  <UploadCloud className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                </div>
                <div className="mt-5 aspect-video rounded-[var(--radius-sm)] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-5">
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <div className="mx-auto grid size-10 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
                        <FileText className="size-5 stroke-[1.5] text-[var(--ft-text-muted)]" />
                      </div>
                      <div className="mt-3 font-mono text-xs uppercase tracking-[0.04em] text-[var(--ft-text-secondary)]">
                        {creativeFormatLabel(campaign)}
                      </div>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--ft-text-muted)]">
                        Assets and proof screenshots will appear here once the team attaches them.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  <ProofItem
                    detail="Ops proof will open from the campaign report once uploaded"
                    platform={platformFromDestination(campaign.destination.kind)}
                    title="Live ad proof pending"
                    type="url"
                  />
                </div>
              </Panel>

              <FlightBar campaign={campaign} />
            </div>

            <Panel className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Campaign brief</h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                    Managed setup details your team is working from.
                  </p>
                </div>
                <FileText className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Campaign ID" value={campaign.id} />
                <Field label="Provider reference" value={campaign.providerReference ?? "Team setup not started"} />
                <Field label="Objective" value={objectiveLabels[campaign.objective]} />
                <Field label="Budget" value={formatCampaignMoney(campaign.budget)} />
                <Field label="Destination" value={destinationLabels[campaign.destination.kind]} />
                <Field label="Created" value={formatDateTime(campaign.createdAt)} />
              </div>
              <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--ft-text-primary)]">
                  <LinkIcon className="size-4 text-[var(--ft-text-muted)]" />
                  Destination URL
                </div>
                <div className="mt-2 break-all text-sm text-[var(--ft-text-secondary)]">
                  {campaign.destination.url}
                </div>
              </div>
            </Panel>

            <Panel className="border-dashed p-5">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-accent)]">
                What happens next
              </div>
              <h2 className="mt-2 text-lg font-medium text-[var(--ft-text-primary)]">
                {campaign.status === "ACTIVE" || campaign.status === "RUNNING"
                  ? "The team monitors pacing and prepares the next client update."
                  : campaign.status === "COMPLETED"
                    ? "Your final report remains available for review and download."
                    : "Fliptrybe Ops reviews the brief, confirms assets, then sends the launch plan."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                This is a managed service record. Platform setup, proof screenshots, manual ad links, and report notes
                are added by the team as the campaign moves through delivery.
              </p>
            </Panel>
          </div>

          <ActivityTimeline campaign={campaign} />
        </section>
      )}
    </CampaignShell>
  );
}
