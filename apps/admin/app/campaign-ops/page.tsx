"use client";

import type { Route } from "next";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  SlidersHorizontal,
  UserCheck
} from "lucide-react";

import { Badge, Button, MobileAdminCard, Panel, SummaryStatStrip, cn } from "@fliptrybe/ui";

import {
  ActionLink,
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  ErrorBanner,
  InlineEmptyState,
  LoadingRows,
  PlatformChips,
  PriorityBadge,
  ProgressBar,
  ReportStatusBadge,
  StatusBadge
} from "./components";
import { campaignOpsEnabled, operationStages } from "./data";
import { useAdminCampaignOpsOverviewData } from "./use-admin-campaign-ops-data";

function campaignDetailHref(campaignId: string): Route {
  return `/campaign-ops/detail?campaignId=${encodeURIComponent(campaignId)}`;
}

const activitySeverityDot = {
  danger: "bg-[var(--ft-red)]",
  info: "bg-[var(--ft-blue)]",
  success: "bg-[var(--ft-green)]",
  warning: "bg-[var(--ft-yellow)]"
} as const;

function isAssigneeUnassigned(assignee: string) {
  return assignee.trim().toLowerCase().includes("unassigned");
}

function needsImmediateAction(campaign: { assignee: string; priority: string; status: string }) {
  return (
    campaign.status === "blocked" ||
    campaign.status === "failed" ||
    campaign.status === "submitted" ||
    campaign.status === "review" ||
    campaign.status === "paused" ||
    campaign.status === "platform_launch" ||
    campaign.status === "reporting" ||
    campaign.priority === "urgent" ||
    isAssigneeUnassigned(campaign.assignee)
  );
}

function isLaunchPreparationStatus(status: string) {
  return (
    status === "approved" ||
    status === "assigned" ||
    status === "creative_review" ||
    status === "platform_launch"
  );
}

export default function AdminCampaignOpsPage() {
  const { activity, error, loading, queue, refresh, reports, source } =
    useAdminCampaignOpsOverviewData();

  const attentionCount = queue.filter(needsImmediateAction).length;
  const assignedCampaigns = queue.filter(
    (campaign) =>
      !isAssigneeUnassigned(campaign.assignee) &&
      campaign.status !== "completed" &&
      campaign.status !== "failed"
  );
  const pendingReviews = queue.filter(
    (campaign) => campaign.status === "submitted" || campaign.status === "review"
  );
  const budgetAlerts = queue.filter(
    (campaign) =>
      campaign.budgetUtilization >= 85 ||
      campaign.guardrails.some((guardrail) => /budget|allocation|spend/i.test(guardrail))
  );
  const healthyCampaigns = queue.filter(
    (campaign) =>
      campaign.status === "optimization" ||
      campaign.status === "paused" ||
      campaign.status === "reporting" ||
      campaign.status === "completed"
  );
  const reportingQueue = reports.filter(
    (report) => report.status === "ready" || report.status === "generating"
  );
  const dashboardWidgets = [
    {
      action: "/campaign-ops/queue" as Route,
      detail: "Named owners carrying active operations work",
      icon: UserCheck,
      label: "Assigned Campaigns",
      tone: "info",
      value: assignedCampaigns.length
    },
    {
      action: "/campaign-ops/queue" as Route,
      detail: "Submitted briefs awaiting review decision",
      icon: ListChecks,
      label: "Pending Reviews",
      tone: pendingReviews.length > 0 ? "warning" : "success",
      value: pendingReviews.length
    },
    {
      action: "/campaign-ops/queue" as Route,
      detail: "Spend at or above 85% of allocation",
      icon: AlertTriangle,
      label: "Budget Alerts",
      tone: budgetAlerts.length > 0 ? "danger" : "success",
      value: budgetAlerts.length
    },
    {
      action: "/campaign-ops/queue" as Route,
      detail: "Optimizing, reporting, or completed campaigns",
      icon: CheckCircle2,
      label: "Campaign Health",
      tone: "success",
      value: healthyCampaigns.length
    },
    {
      action: "/campaign-ops/reports" as Route,
      detail: "Daily updates, weekly reports, and final reports",
      icon: BarChart3,
      label: "Reporting Queue",
      tone: reportingQueue.length > 0 ? "warning" : "info",
      value: reportingQueue.length
    }
  ];
  const opsHealth = [
    {
      detail: "Briefs awaiting operator QA",
      label: "Needs Action",
      urgent: queue.some(
        (campaign) => campaign.status === "submitted" || campaign.status === "review"
      ),
      value: queue.filter(
        (campaign) => campaign.status === "submitted" || campaign.status === "review"
      ).length
    },
    {
      detail: "Approved work ready for platform setup",
      label: "Launch Action",
      urgent: queue.some((campaign) => isLaunchPreparationStatus(campaign.status)),
      value: queue.filter((campaign) => isLaunchPreparationStatus(campaign.status)).length
    },
    {
      detail: "Client reports awaiting publish",
      label: "Report Action",
      urgent: reports.some((report) => report.status === "ready"),
      value: reports.filter((report) => report.status === "ready").length
    },
    {
      detail: "Needs owner before approval",
      label: "Unassigned",
      urgent: queue.some((campaign) => isAssigneeUnassigned(campaign.assignee)),
      value: queue.filter((campaign) => isAssigneeUnassigned(campaign.assignee)).length
    },
    {
      detail: "Live campaigns under watch",
      label: "Live Now",
      urgent: false,
      value: queue.filter(
        (campaign) =>
          campaign.status === "optimization" ||
          campaign.status === "paused" ||
          campaign.status === "reporting"
      ).length
    }
  ];
  const opsHealthSummary = opsHealth.map((metric) => ({
    label: metric.label,
    value: loading ? "..." : metric.value
  }));
  const queuePreview = [...queue]
    .sort((left, right) => {
      const leftUnassigned = isAssigneeUnassigned(left.assignee);
      const rightUnassigned = isAssigneeUnassigned(right.assignee);

      if (leftUnassigned !== rightUnassigned) {
        return leftUnassigned ? -1 : 1;
      }

      const leftAction = needsImmediateAction(left);
      const rightAction = needsImmediateAction(right);

      if (leftAction !== rightAction) {
        return leftAction ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 10);
  const activityPreview = activity.slice(0, 20);

  return (
    <AdminCampaignOpsShell active="/campaign-ops">
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <Bell className="size-4 stroke-[1.5]" />
              Send ops alert
            </Button>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <Button>
              <SlidersHorizontal className="size-4 stroke-[1.5]" />
              Ops controls
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone={campaignOpsEnabled ? "success" : "warning"}>
              {campaignOpsEnabled ? "Campaign ops enabled" : "Feature off"}
            </Badge>
            <Badge tone={source === "api" ? "success" : "neutral"}>Live workspace</Badge>
          </>
        }
        title="Campaign Operations Hub"
      />

      {error ? <ErrorBanner message={error} /> : null}

      {attentionCount > 0 ? (
        <section className="mt-5 flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--ft-red)]/40 bg-[var(--ft-red-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-red)]" />
            <div>
              <div className="text-sm font-medium text-[var(--ft-text-primary)]">
                {attentionCount} campaign{attentionCount === 1 ? "" : "s"} need ops action
              </div>
              <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Needs Action, failed, or urgent queue items are waiting on an operator decision.
              </div>
            </div>
          </div>
          <ActionLink href="/campaign-ops/queue" variant="secondary">
            Open action queue
            <ArrowRight className="size-4 stroke-[1.5]" />
          </ActionLink>
        </section>
      ) : null}

      <SummaryStatStrip className="mt-6" items={opsHealthSummary} />

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {dashboardWidgets.map((widget) => (
          <Panel className="p-4" key={widget.label}>
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]">
                <widget.icon className="size-4 stroke-[1.5]" />
              </div>
              <Badge
                tone={
                  widget.tone === "danger"
                    ? "danger"
                    : widget.tone === "warning"
                      ? "warning"
                      : widget.tone === "success"
                        ? "success"
                        : "info"
                }
              >
                {loading ? "..." : widget.value}
              </Badge>
            </div>
            <div className="mt-4 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              {widget.label}
            </div>
            <div className="mt-2 text-sm leading-5 text-[var(--ft-text-secondary)]">
              {widget.detail}
            </div>
            <ActionLink href={widget.action} variant="ghost">
              Open
              <ArrowRight className="size-4 stroke-[1.5]" />
            </ActionLink>
          </Panel>
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--ft-border)] p-4">
            <div className="flex items-center gap-3">
              <ListChecks className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
              <div>
                <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                  Needs action watch
                </h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  {queue.length} open campaign action{queue.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <ActionLink href="/campaign-ops/queue" variant="ghost">
              Open queue
              <ArrowRight className="size-4 stroke-[1.5]" />
            </ActionLink>
          </div>

          {loading ? (
            <LoadingRows count={5} />
          ) : queuePreview.length === 0 ? (
            <InlineEmptyState
              detail="No campaign brief, launch, or report handoff is waiting on operators."
              title="No campaigns need action"
            />
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {queuePreview.map((campaign) => (
                  <MobileAdminCard
                    action={
                      <div className="grid gap-3">
                        <ProgressBar value={campaign.progress} />
                        <ActionLink
                          href={campaignDetailHref(campaign.id)}
                          variant="secondary"
                        >
                          Open work item
                        </ActionLink>
                      </div>
                    }
                    key={campaign.id}
                    meta={[
                      { label: "Client", value: campaign.workspaceName },
                      { label: "Platform", value: <PlatformChips channel={campaign.channel} /> },
                      { label: "Owner", value: campaign.assignee },
                      {
                        label: "Needs action",
                        value: (
                          <span className="line-clamp-2 text-right text-[var(--ft-text-secondary)]">
                            {campaign.nextAction}
                          </span>
                        )
                      },
                      { label: "Progress", value: `${campaign.progress}%` }
                    ]}
                    status={
                      <div className="flex flex-wrap justify-end gap-2">
                        <StatusBadge status={campaign.status} />
                        <PriorityBadge priority={campaign.priority} />
                      </div>
                    }
                    title={campaign.name}
                  />
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[240px]" />
                    <col className="w-[150px]" />
                    <col className="w-[130px]" />
                    <col className="w-[150px]" />
                    <col className="w-[120px]" />
                    <col className="w-[92px]" />
                  </colgroup>
                  <thead className="bg-[var(--ft-bg-surface)]">
                    <tr className="border-b border-[var(--ft-border)] font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                      <th className="px-4 py-3 font-medium">Campaign</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Progress</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queuePreview.map((campaign, index) => (
                      <tr
                        className={cn(
                          "h-14 border-b border-[var(--ft-border)] transition hover:bg-[var(--ft-bg-raised)]",
                          index % 2 === 1 ? "bg-[var(--ft-bg-muted)]/45" : "bg-transparent",
                          campaign.priority === "urgent"
                            ? "border-l-2 border-l-[var(--ft-red)]"
                            : ""
                        )}
                        key={campaign.id}
                      >
                        <td className="px-4 py-3">
                          <div className="truncate font-medium text-[var(--ft-text-primary)]">
                            {campaign.name}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="truncate font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                              {campaign.id}
                            </span>
                            <PriorityBadge priority={campaign.priority} />
                          </div>
                        </td>
                        <td className="truncate px-4 py-3 text-[var(--ft-text-secondary)]">
                          {campaign.workspaceName}
                        </td>
                        <td className="truncate px-4 py-3 text-[var(--ft-text-secondary)]">
                          {campaign.channel}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={campaign.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="grid gap-1">
                            <ProgressBar value={campaign.progress} />
                            <span className="font-mono text-[11px] text-[var(--ft-text-muted)]">
                              {campaign.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ActionLink
                            href={campaignDetailHref(campaign.id)}
                            variant="ghost"
                          >
                            Open
                          </ActionLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ft-border)] p-4">
            <div className="flex items-center gap-3">
              <Activity className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
              <div>
                <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                  Ops activity rail
                </h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  Last {activityPreview.length} events
                </p>
              </div>
            </div>
            <ActionLink href="/campaign-ops/activity" variant="ghost">
              Activity
            </ActionLink>
          </div>

          {loading ? (
            <LoadingRows count={5} />
          ) : activityPreview.length === 0 ? (
            <InlineEmptyState detail="No recent admin or system actions." title="No activity" />
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              {activityPreview.map((item) => (
                <div
                  className="grid min-h-10 grid-cols-[10px_1fr_auto] items-center gap-3 border-b border-[var(--ft-border)] px-4 py-3"
                  key={item.id}
                >
                  <span className={cn("size-2 rounded-full", activitySeverityDot[item.severity])} />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[var(--ft-text-primary)]">
                      <span className="font-medium">{item.actor}</span>{" "}
                      <span className="text-[var(--ft-text-secondary)]">{item.action}</span>
                    </div>
                    <div className="mt-1 truncate text-sm text-[var(--ft-text-muted)]">
                      {item.target}
                    </div>
                  </div>
                  <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                    {item.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ft-border)] p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
              <div>
                <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                  Client report queue
                </h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  {reports.length} report job{reports.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <ActionLink href="/campaign-ops/reports" variant="ghost">
              Open reports
              <ArrowRight className="size-4 stroke-[1.5]" />
            </ActionLink>
          </div>
          {loading ? (
            <LoadingRows count={3} />
          ) : reports.length === 0 ? (
            <InlineEmptyState
              detail="Reports will appear once operators prepare metrics and client-ready commentary."
              title="No client reports need action"
            />
          ) : (
            <div className="divide-y divide-[var(--ft-border)]">
              {reports.slice(0, 4).map((report) => (
                <div
                  className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  key={report.id}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--ft-text-primary)]">
                      {report.title}
                    </div>
                    <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
                      {report.period} / prepared {report.generatedAt}
                    </div>
                  </div>
                  <ReportStatusBadge status={report.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--ft-border)] p-4">
            <h2 className="text-base font-medium text-[var(--ft-text-primary)]">Operating path</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              Brief QA, risk gate, launch control, and client reporting handoff.
            </p>
          </div>
          <div className="grid divide-y divide-[var(--ft-border)] md:grid-cols-2 md:divide-x md:divide-y-0">
            {operationStages.map((stage) => (
              <div className="grid grid-cols-[32px_1fr] gap-3 p-4" key={stage.label}>
                <div className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                  <stage.icon className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                </div>
                <div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{stage.label}</div>
                  <div className="mt-1 text-sm leading-5 text-[var(--ft-text-secondary)]">
                    {stage.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </AdminCampaignOpsShell>
  );
}
