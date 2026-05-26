"use client";

import { BarChart3, Eye, Lightbulb, RefreshCw, TrendingUp } from "lucide-react";

import { Badge, Button, MetricStrip, Panel, PlatformChip } from "@fliptrybe/ui";

import { formatCampaignMoney, formatCompact, metricValue } from "../api";
import {
  CampaignShell,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
  ReportCard,
  SourceBadge,
  StatusBadge,
  destinationPlatform,
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
  const impressions = metricValue(analytics, "impressions");
  const clicks = metricValue(analytics, "clicks");
  const roi = metricValue(analytics, "roi_bps") / 100;

  return (
    <CampaignShell active="/reports">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <a className={secondaryLinkButtonClass} href="/reports">
              <Eye className="size-4 stroke-[1.5]" />
              Report Center
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Performance snapshots</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Performance Snapshots"
      />

      <ErrorNotice message={error} />

      <section className="mt-6">
        <MetricStrip
          items={[
            {
              label: "Impressions",
              value: loading ? "..." : formatCompact(impressions),
              detail: "All campaign channels"
            },
            {
              label: "Clicks",
              value: loading ? "..." : formatCompact(clicks),
              detail: "Tracked interactions"
            },
            {
              label: "ROI",
              value: loading ? "..." : `${roi.toFixed(1)}%`,
              detail: "Basis point signal"
            },
            {
              label: "Campaigns",
              value: loading ? "..." : String(campaigns.length),
              detail: "Current workspace"
            }
          ]}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Delivery trend</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Spend-weighted campaign movement.
              </p>
            </div>
            <TrendingUp className="size-5 stroke-[1.5] text-[var(--ft-green)]" />
          </div>
          {loading ? (
            <div className="mt-5">
              <LoadingBlock label="Loading trend" />
            </div>
          ) : trend.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                copy="Delivery trend points will appear after the team begins publishing campaign updates."
                icon={BarChart3}
                title="No trend data"
              />
            </div>
          ) : (
            <div className="mt-5 flex h-72 items-end gap-3 border-t border-[var(--ft-border)] pt-4">
              {trend.map((point) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={point.day}>
                  <div
                    className="w-full rounded-t-[var(--radius-sm)] bg-[var(--ft-accent)]"
                    style={{
                      height: `${Math.max(18, (point.conversions / maxConversions) * 220)}px`
                    }}
                  />
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
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
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Managed insights</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Signals grouped by campaign once reporting is published.
              </p>
            </div>
            <Lightbulb className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
          </div>
          <div className="mt-5 divide-y divide-[var(--ft-border)] border-y border-[var(--ft-border)]">
            {loading ? (
              <div className="py-4">
                <LoadingBlock label="Loading insights" />
              </div>
            ) : insights.length === 0 ? (
              <div className="py-4">
                <EmptyState
                  copy="Campaign insights will appear after the team has enough delivery data to explain what changed."
                  icon={Lightbulb}
                  title="No insights"
                />
              </div>
            ) : (
              insights.slice(0, 4).map((insight) => (
                <div className="py-3" key={insight.id}>
                  <div className="font-medium text-[var(--ft-text-primary)]">{insight.label}</div>
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Report snapshots</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              Reports are published by the Fliptrybe team at key campaign milestones.
            </p>
          </div>
        </div>
        {loading ? (
          <Panel className="p-4">
            <LoadingBlock label="Loading report snapshots" />
          </Panel>
        ) : campaigns.length === 0 ? (
          <EmptyState
            copy="We publish campaign reports at key milestones - usually halfway through your campaign and at the end. Our team will notify you when your first report is ready."
            icon={BarChart3}
            title="Your reports will appear here."
          />
        ) : (
          <div className="grid gap-4">
            {campaigns.slice(0, 3).map((campaign) => (
              <ReportCard campaign={campaign} key={campaign.id} metrics={analytics?.metrics} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--ft-border)] p-4">
            <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Campaign breakdown</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              Campaign-level report readiness and spend.
            </p>
          </div>
          <div>
            <div className="hidden grid-cols-[minmax(220px,1fr)_140px_140px_120px_120px_120px] gap-3 border-b border-[var(--ft-border)] px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)] xl:grid">
              <div>Campaign</div>
              <div>Status</div>
              <div>Platform</div>
              <div>Objective</div>
              <div>Budget</div>
              <div>Action</div>
            </div>
            {loading ? (
              <div className="p-4">
                <LoadingBlock label="Loading campaign breakdown" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  copy="Campaign-level results will appear once our team publishes report-ready metrics."
                  icon={BarChart3}
                  title="No campaign breakdown"
                />
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div
                  className="grid gap-3 border-b border-[var(--ft-border)] p-4 last:border-b-0 xl:grid-cols-[minmax(220px,1fr)_140px_140px_120px_120px_120px] xl:items-center"
                  key={campaign.id}
                >
                  <div>
                    <div className="font-medium text-[var(--ft-text-primary)]">{campaign.name}</div>
                    <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                      {destinationLabels[campaign.destination.kind]}
                    </div>
                  </div>
                  <StatusBadge status={campaign.status} />
                  <div>
                    <PlatformChip platform={destinationPlatform(campaign.destination.kind)} />
                  </div>
                  <div className="text-sm text-[var(--ft-text-secondary)]">
                    {objectiveLabels[campaign.objective]}
                  </div>
                  <div className="font-mono text-sm text-[var(--ft-text-primary)]">
                    {formatCampaignMoney(campaign.budget)}
                  </div>
                  <a className={`${secondaryLinkButtonClass} h-9 px-3`} href={`/campaigns/${campaign.id}`}>
                    <Eye className="size-4 stroke-[1.5]" />
                    View brief
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
