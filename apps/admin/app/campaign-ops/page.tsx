"use client";

import { ArrowRight, Bell, ListChecks, RefreshCw, SlidersHorizontal } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import {
  ActionLink,
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  ErrorBanner,
  InlineEmptyState,
  LoadingRows,
  PriorityBadge,
  ReportStatusBadge,
  StatusBadge
} from "./components";
import { campaignOpsEnabled, operationStages } from "./data";
import { useAdminCampaignOpsOverviewData } from "./use-admin-campaign-ops-data";

export default function AdminCampaignOpsPage() {
  const { activity, error, loading, metrics, queue, refresh, reports, source } =
    useAdminCampaignOpsOverviewData();

  return (
    <AdminCampaignOpsShell active="/campaign-ops">
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary">
              <Bell className="size-4" />
              Notify ops
            </Button>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button>
              <SlidersHorizontal className="size-4" />
              Controls
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone={campaignOpsEnabled ? "success" : "warning"}>
              {campaignOpsEnabled ? "Campaign ops enabled" : "Feature off"}
            </Badge>
            <Badge tone={source === "api" ? "info" : "neutral"}>/v1 admin API</Badge>
          </>
        }
        title="Campaign operations"
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            value={loading ? "..." : metric.value}
            {...(metric.tone === undefined ? {} : { tone: metric.tone })}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Queue watch</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Intake, review, and launch state for operator-owned campaigns.
              </p>
            </div>
            <ActionLink href="/campaign-ops/queue" variant="ghost">
              <ListChecks className="size-4" />
              Queue
            </ActionLink>
          </div>

          {loading ? (
            <LoadingRows />
          ) : queue.length === 0 ? (
            <InlineEmptyState
              detail="The planned queue endpoint returned no campaign work items."
              title="No queue items"
            />
          ) : (
            <div className="divide-y divide-zinc-200">
              {queue.slice(0, 4).map((campaign) => (
                <div
                  className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"
                  key={campaign.id}
                >
                  <div>
                    <div className="font-medium text-zinc-950">{campaign.name}</div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {campaign.workspaceName} - {campaign.channel} - {campaign.budget}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={campaign.status} />
                    <PriorityBadge priority={campaign.priority} />
                  </div>
                  <ActionLink href={`/campaign-ops/detail?campaignId=${encodeURIComponent(campaign.id)}`}>
                    Open
                  </ActionLink>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Operating path</h2>
            <p className="mt-1 text-sm text-zinc-500">
              The UI is wired for queue review, detail handling, reporting, and activity audit.
            </p>
          </div>
          <div className="mt-5 grid gap-4">
            {operationStages.map((stage) => (
              <div className="grid grid-cols-[32px_1fr] gap-3" key={stage.label}>
                <div className="flex size-8 items-center justify-center rounded-md bg-zinc-100">
                  <stage.icon className="size-4 text-zinc-950" />
                </div>
                <div>
                  <div className="font-medium text-zinc-950">{stage.label}</div>
                  <div className="mt-1 text-sm text-zinc-500">{stage.value}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Reports</h2>
              <p className="mt-1 text-sm text-zinc-500">Latest operator report jobs.</p>
            </div>
            <ActionLink href="/campaign-ops/reports" variant="ghost">
              View all
              <ArrowRight className="size-4" />
            </ActionLink>
          </div>
          {loading ? (
            <LoadingRows count={2} />
          ) : reports.length === 0 ? (
            <InlineEmptyState
              detail="The reports endpoint is ready for generated campaign summaries."
              title="No reports yet"
            />
          ) : (
            <div className="divide-y divide-zinc-200">
              {reports.slice(0, 3).map((report) => (
                <div className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center" key={report.id}>
                  <div>
                    <div className="font-medium text-zinc-950">{report.title}</div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {report.period} - {report.generatedAt}
                    </div>
                  </div>
                  <ReportStatusBadge status={report.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Activity</h2>
              <p className="mt-1 text-sm text-zinc-500">Recent admin and system actions.</p>
            </div>
            <ActionLink href="/campaign-ops/activity" variant="ghost">
              Activity
              <ArrowRight className="size-4" />
            </ActionLink>
          </div>
          {loading ? (
            <LoadingRows count={2} />
          ) : activity.length === 0 ? (
            <InlineEmptyState
              detail="No activity has arrived from the campaign ops activity endpoint."
              title="No activity"
            />
          ) : (
            <div className="divide-y divide-zinc-200">
              {activity.slice(0, 4).map((item) => (
                <div className="p-4" key={item.id}>
                  <div className="font-medium text-zinc-950">
                    {item.actor} {item.action}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {item.target} - {item.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </AdminCampaignOpsShell>
  );
}
