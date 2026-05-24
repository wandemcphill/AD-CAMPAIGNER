"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Megaphone,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles
} from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import {
  fallbackCurrency,
  formatCampaignMoney,
  formatCompact,
  formatDateTime,
  metricValue,
  startCampaign,
  totalBudgetMinor
} from "./api";
import {
  CampaignShell,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
  SourceBadge,
  StatusBadge,
  linkButtonClass,
  secondaryLinkButtonClass
} from "./components";
import { destinationLabels, objectiveLabels } from "./data";
import { useCampaignDashboardData } from "./use-campaign-dashboard-data";

export default function CampaignsPage() {
  const { aiInsights, analytics, campaigns, error, loading, refresh, source, wallet } =
    useCampaignDashboardData();
  const [actionError, setActionError] = useState<string>();
  const [startingId, setStartingId] = useState<string>();
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "ACTIVE").length;
  const queuedCampaigns = campaigns.filter(
    (campaign) => campaign.status === "QUEUED" || campaign.status === "PENDING_REVIEW"
  ).length;
  const budgetCurrency = fallbackCurrency(campaigns, wallet);
  const spend = formatCampaignMoney({
    amountMinor: totalBudgetMinor(campaigns),
    currency: budgetCurrency
  });
  const liveViewers = metricValue(analytics, "live_viewers");
  const roiBps = metricValue(analytics, "roi_bps");
  const trend = analytics?.trend ?? [];
  const maxSpend = Math.max(1, ...trend.map((point) => point.spendMinor));
  const primaryInsight = aiInsights?.items[0];

  async function handleStart(campaignId: string) {
    setActionError(undefined);
    setStartingId(campaignId);
    try {
      await startCampaign(campaignId);
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not start this campaign.");
    } finally {
      setStartingId(undefined);
    }
  }

  return (
    <CampaignShell active="/campaigns">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Search className="size-4" />
              Search campaigns
            </div>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <a className={linkButtonClass} href="/campaigns/new">
              <Plus className="size-4" />
              New campaign
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Client campaign desk</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Campaign overview"
      />

      <ErrorNotice message={error ?? actionError} />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Campaign spend" value={loading ? "..." : spend} detail="Tracked budget" tone="success" />
        <MetricCard
          label="Live viewers"
          value={loading ? "..." : formatCompact(liveViewers)}
          detail="Realtime boost signal"
          tone="info"
        />
        <MetricCard
          label="Active campaigns"
          value={loading ? "..." : String(activeCampaigns)}
          detail={`${queuedCampaigns} queued or in review`}
          tone="warning"
        />
        <MetricCard
          label="Wallet balance"
          value={loading ? "..." : formatCampaignMoney(wallet?.availableBalance)}
          detail="Available for launches"
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Campaign queue</h2>
              <p className="mt-1 text-sm text-zinc-500">Current workspace launch state.</p>
            </div>
            <Megaphone className="size-5 text-sky-600" />
          </div>
          <div className="divide-y divide-zinc-200">
            {loading ? (
              <div className="p-4">
                <LoadingBlock label="Loading campaigns" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  action={
                    <a className={secondaryLinkButtonClass} href="/campaigns/new">
                      <Plus className="size-4" />
                      Create campaign
                    </a>
                  }
                  copy="Your workspace does not have any campaigns yet."
                  icon={Megaphone}
                  title="No campaigns"
                />
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div
                  className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  key={campaign.id}
                >
                  <div>
                    <a
                      className="font-medium text-zinc-950 hover:text-sky-700"
                      href={`/campaigns/${campaign.id}`}
                    >
                      {campaign.name}
                    </a>
                    <div className="mt-1 text-sm text-zinc-500">
                      {objectiveLabels[campaign.objective]} - {destinationLabels[campaign.destination.kind]}
                    </div>
                  </div>
                  <StatusBadge status={campaign.status} />
                  <div className="flex items-center gap-2 sm:justify-end">
                    <div className="text-sm font-semibold text-zinc-950">
                      {formatCampaignMoney(campaign.budget)}
                    </div>
                    <Button
                      className="px-3"
                      disabled={source !== "api" || campaign.status === "ACTIVE" || startingId === campaign.id}
                      onClick={() => void handleStart(campaign.id)}
                      variant="secondary"
                    >
                      <Play className="size-4" />
                      {startingId === campaign.id ? "Starting" : "Start"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">AI growth desk</h2>
              <p className="mt-1 text-sm text-zinc-500">Campaign-aware recommendations.</p>
            </div>
            <Sparkles className="size-5 text-orange-500" />
          </div>
          {loading ? (
            <div className="mt-5">
              <LoadingBlock label="Loading insights" />
            </div>
          ) : primaryInsight ? (
            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <div className="font-semibold text-zinc-950">{primaryInsight.label}</div>
              <div className="mt-3 grid gap-2 text-sm text-zinc-600">
                {primaryInsight.reasons.slice(0, 3).map((reason) => (
                  <div className="rounded-md bg-white px-3 py-2" key={reason}>
                    {reason.replaceAll("_", " ")}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                copy="Insights will appear once campaign analytics are available."
                icon={Sparkles}
                title="No AI insights"
              />
            </div>
          )}
          <a className={`${secondaryLinkButtonClass} mt-4 w-full`} href="/campaigns/analytics">
            <BarChart3 className="size-4" />
            View analytics
          </a>
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Performance pulse</h2>
              <p className="mt-1 text-sm text-zinc-500">{(roiBps / 100).toFixed(1)}% ROI signal</p>
            </div>
            <BarChart3 className="size-5 text-green-600" />
          </div>
          {trend.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                copy="Spend and conversion trend points will appear after analytics ingestion."
                icon={BarChart3}
                title="No trend data"
              />
            </div>
          ) : (
            <div className="mt-5 flex h-56 items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              {trend.map((point) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={point.day}>
                  <div
                    className="w-full rounded-t-sm bg-zinc-950"
                    style={{ height: `${Math.max(18, (point.spendMinor / maxSpend) * 180)}px` }}
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
              <h2 className="text-lg font-semibold text-zinc-950">Recent launch window</h2>
              <p className="mt-1 text-sm text-zinc-500">Latest schedule and provider state.</p>
            </div>
            <ArrowRight className="size-5 text-zinc-500" />
          </div>
          <div className="mt-5 grid gap-3">
            {campaigns.slice(0, 3).map((campaign) => (
              <a
                className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:bg-white sm:grid-cols-[1fr_auto]"
                href={`/campaigns/${campaign.id}`}
                key={campaign.id}
              >
                <div>
                  <div className="font-medium text-zinc-950">{campaign.name}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    Starts {formatDateTime(campaign.schedule.startsAt)}
                  </div>
                </div>
                <StatusBadge status={campaign.status} />
              </a>
            ))}
          </div>
        </Panel>
      </section>
    </CampaignShell>
  );
}
