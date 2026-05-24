"use client";

import { Download, Filter, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import {
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  EmptyState,
  ErrorBanner,
  InlineEmptyState,
  LoadingRows,
  ReportStatusBadge
} from "../components";
import { campaignOpsReportStatuses, type CampaignOpsReportStatus } from "../data";
import { useAdminCampaignOpsReportsData } from "../use-admin-campaign-ops-data";

type ReportFilter = CampaignOpsReportStatus | "all";

export default function AdminCampaignOpsReportsPage() {
  const { error, items, loading, refresh, source } = useAdminCampaignOpsReportsData();
  const [status, setStatus] = useState<ReportFilter>("all");

  const filteredReports = useMemo(
    () => items.filter((report) => status === "all" || report.status === status),
    [items, status]
  );

  const readyCount = items.filter((report) => report.status === "ready").length;
  const generatingCount = items.filter((report) => report.status === "generating").length;
  const failedCount = items.filter((report) => report.status === "failed").length;

  return (
    <AdminCampaignOpsShell active="/campaign-ops/reports">
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
              <Filter className="size-4" />
              <select
                className="bg-transparent text-zinc-950 outline-none"
                onChange={(event) => setStatus(event.target.value as ReportFilter)}
                value={status}
              >
                <option value="all">All reports</option>
                {campaignOpsReportStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button>
              <Download className="size-4" />
              Export
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Reports endpoint</Badge>
            <Badge tone={source === "api" ? "success" : "neutral"}>/v1 connected</Badge>
          </>
        }
        title="Campaign reports"
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Report jobs" value={loading ? "..." : String(items.length)} detail="Total returned" tone="info" />
        <MetricCard label="Ready" value={loading ? "..." : String(readyCount)} detail="Available to operators" tone="success" />
        <MetricCard label="Generating" value={loading ? "..." : String(generatingCount)} detail="Still processing" tone="warning" />
        <MetricCard label="Failed" value={loading ? "..." : String(failedCount)} detail="Needs retry" tone="warning" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Panel className="overflow-hidden">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-lg font-semibold text-zinc-950">Report queue</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Generated summaries from the planned campaign ops reporting endpoint.
            </p>
          </div>

          {loading ? (
            <LoadingRows count={4} />
          ) : filteredReports.length === 0 ? (
            <div className="p-4">
              <EmptyState
                detail={
                  items.length === 0
                    ? "The reports API returned no generated report jobs."
                    : "No reports match the selected status."
                }
                title="No reports in this view"
              />
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {filteredReports.map((report) => (
                <div className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-start" key={report.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-zinc-950">{report.title}</h3>
                      <ReportStatusBadge status={report.status} />
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {report.period} - {report.generatedAt} - {report.owner}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-600">{report.summary}</p>
                  </div>
                  <Button disabled={report.status !== "ready"} variant="secondary">
                    <Download className="size-4" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-lg font-semibold text-zinc-950">Report metrics</h2>
            <p className="mt-1 text-sm text-zinc-500">First available report metric payload.</p>
          </div>
          {loading ? (
            <LoadingRows count={3} />
          ) : filteredReports[0]?.metrics.length ? (
            <div className="grid gap-3 p-4">
              {filteredReports[0].metrics.map((metric) => (
                <div
                  className="flex min-h-12 items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm"
                  key={metric.label}
                >
                  <span className="text-zinc-500">{metric.label}</span>
                  <span className="font-semibold text-zinc-950">{metric.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <InlineEmptyState
              detail="Report payloads can include custom metric rows when the API is ready."
              title="No report metrics"
            />
          )}
        </Panel>
      </section>
    </AdminCampaignOpsShell>
  );
}
