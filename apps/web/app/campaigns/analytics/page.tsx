"use client";

import { BarChart3, Lightbulb, RefreshCw, TrendingUp } from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { formatCampaignMoney, formatCompact, metricValue } from "../api";
import {
  CampaignShell,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
  SourceBadge,
  secondaryLinkButtonClass
} from "../components";
import { destinationLabels, objectiveLabels } from "../data";
import { useCampaignDashboardData } from "../use-campaign-dashboard-data";

export default function CampaignAnalyticsPage() {
  const { aiInsights, analytics, campaigns, error, loading, refresh, source } =
    useCampaignDashboardData();
  const trend = analytics?.trend ?? [];
  const maxConversions = Math.max(1, ...trend.map((point) => point.conversions));
  const insights = aiInsights?.items ?? [];

  return (
    <CampaignShell active="/campaigns/analytics">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <a className={secondaryLinkButtonClass} href="/campaigns/new">
              New campaign
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Analytics</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Campaign analytics"
      />

      <ErrorNotice message={error} />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Impressions"
          value={loading ? "..." : formatCompact(metricValue(analytics, "impressions"))}
          detail="All campaign channels"
          tone="info"
        />
        <MetricCard
          label="Clicks"
          value={loading ? "..." : formatCompact(metricValue(analytics, "clicks"))}
          detail="Tracked interactions"
          tone="success"
        />
        <MetricCard
          label="ROI"
          value={loading ? "..." : `${(metricValue(analytics, "roi_bps") / 100).toFixed(1)}%`}
          detail="Basis point signal"
          tone="success"
        />
        <MetricCard
          label="Campaigns"
          value={loading ? "..." : String(campaigns.length)}
          detail="Current workspace"
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Conversion trend</h2>
              <p className="mt-1 text-sm text-zinc-500">Spend-weighted campaign movement.</p>
            </div>
            <TrendingUp className="size-5 text-green-600" />
          </div>
          {loading ? (
            <div className="mt-5">
              <LoadingBlock label="Loading trend" />
            </div>
          ) : trend.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                copy="Analytics trend points will appear after campaigns begin reporting."
                icon={BarChart3}
                title="No trend data"
              />
            </div>
          ) : (
            <div className="mt-5 flex h-72 items-end gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              {trend.map((point) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={point.day}>
                  <div
                    className="w-full rounded-t-sm bg-sky-600"
                    style={{
                      height: `${Math.max(18, (point.conversions / maxConversions) * 220)}px`
                    }}
                  />
                  <div className="text-xs font-medium text-zinc-500">{point.day}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">AI insights</h2>
              <p className="mt-1 text-sm text-zinc-500">Signals grouped by campaign.</p>
            </div>
            <Lightbulb className="size-5 text-orange-500" />
          </div>
          <div className="mt-5 grid gap-3">
            {loading ? (
              <LoadingBlock label="Loading insights" />
            ) : insights.length === 0 ? (
              <EmptyState
                copy="Campaign insights will appear after the AI ads endpoint returns items."
                icon={Lightbulb}
                title="No insights"
              />
            ) : (
              insights.slice(0, 4).map((insight) => (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3" key={insight.id}>
                  <div className="font-medium text-zinc-950">{insight.label}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(insight.dimensions).slice(0, 3).map(([key, value]) => (
                      <Badge key={key} tone="neutral">
                        {String(value).replaceAll("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <Panel className="overflow-hidden">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-lg font-semibold text-zinc-950">Campaign breakdown</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {campaigns.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  copy="Campaign-level analytics will appear when campaigns exist."
                  icon={BarChart3}
                  title="No campaign breakdown"
                />
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div
                  className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  key={campaign.id}
                >
                  <div>
                    <div className="font-medium text-zinc-950">{campaign.name}</div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {objectiveLabels[campaign.objective]} - {destinationLabels[campaign.destination.kind]}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-zinc-700">
                    {formatCampaignMoney(campaign.budget)}
                  </div>
                  <a className={secondaryLinkButtonClass} href={`/campaigns/${campaign.id}`}>
                    Open
                  </a>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </CampaignShell>
  );
}
