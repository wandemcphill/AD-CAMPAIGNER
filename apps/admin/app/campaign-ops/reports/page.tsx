"use client";

import { ChevronDown, Download, Filter, PenSquare, RefreshCw, Send } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { Badge, Button, ReportCard, SummaryStatStrip, cn } from "@fliptrybe/ui";

import {
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  EmptyState,
  ErrorBanner,
  InlineEmptyState,
  LoadingRows,
  ReportStatusBadge
} from "../components";
import {
  campaignOpsReportStatuses,
  type CampaignOpsReport,
  type CampaignOpsReportStatus
} from "../data";
import { publishAdminCampaignReport } from "../api";
import { useAdminCampaignOpsReportsData } from "../use-admin-campaign-ops-data";

type ReportFilter = CampaignOpsReportStatus | "all";

function canPublishReport(report: CampaignOpsReport) {
  return report.status === "ready" && report.metrics.length > 0;
}

function labelReportStatus(status: ReportFilter) {
  const labels: Record<ReportFilter, string> = {
    all: "All report states",
    failed: "Needs retry",
    generating: "Building",
    ready: "Needs publish"
  };

  return labels[status];
}

function PublishReportDialog({
  onCancel,
  onConfirm,
  pending,
  report
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
  report: CampaignOpsReport | null;
}) {
  if (!report) {
    return null;
  }

  return (
    <div
      aria-labelledby="publish-report-title"
      aria-modal="true"
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="border-b border-[var(--ft-border)] p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-accent)]/45 bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]">
              <Send className="size-5 stroke-[1.5]" />
            </div>
            <div>
              <h2
                id="publish-report-title"
                className="text-base font-semibold text-[var(--ft-text-primary)]"
              >
                Publish client-visible report?
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                {report.title} will become visible to the client and should trigger a client
                notification. Review the client summary, metrics, and proof links before publishing.
              </p>
            </div>
          </div>
        </div>
        <div className="border-b border-[var(--ft-border)] p-4">
          <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
            <div className="font-medium text-[var(--ft-text-primary)]">{report.period}</div>
            <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
              {report.summary}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={pending} onClick={onConfirm} type="button">
            {pending ? "Publishing" : "Publish Client Report"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportDraftWorkspace({
  onPublish,
  report
}: {
  onPublish: () => void;
  report: CampaignOpsReport;
}) {
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftSummary, setDraftSummary] = useState(report.summary);
  const [previewOpen, setPreviewOpen] = useState(false);
  const publishReady = canPublishReport(report);
  const hasDraftChanges = draftSummary.trim() !== report.summary.trim();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="flex items-center gap-2 font-medium text-[var(--ft-text-primary)]">
          <ChevronDown className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
          Prepare Client Report
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          This report remains internal until you publish the client-visible version.
        </p>
        <textarea
          className="mt-3 min-h-28 w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] p-3 text-sm leading-6 text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)] focus:ring-2 focus:ring-[var(--ft-accent)]"
          onChange={(event) => {
            setDraftSummary(event.target.value);
            setDraftSaved(false);
          }}
          value={draftSummary}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            className="h-8 px-3 text-xs"
            disabled={!hasDraftChanges && draftSaved}
            onClick={() => setDraftSaved(true)}
            type="button"
            variant="secondary"
          >
            {draftSaved ? "Draft saved" : "Save report draft"}
          </Button>
          <Button
            className="h-8 px-3 text-xs"
            onClick={() => setPreviewOpen((current) => !current)}
            type="button"
            variant="secondary"
          >
            {previewOpen ? "Hide client preview" : "Preview client view"}
          </Button>
          <Button
            className="h-8 px-3 text-xs"
            disabled={!publishReady}
            onClick={onPublish}
            type="button"
          >
            <Send className="size-3.5 stroke-[1.5]" />
            Publish Client Report
          </Button>
        </div>
        <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
          {publishReady
            ? "Ready reports can be published after preview. Draft edits stay internal until the publish confirmation is approved."
            : "Needs Action: complete performance metrics before publishing this client report."}
        </div>
        {previewOpen ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-accent)]/35 bg-[var(--ft-accent-subtle)] p-4">
            <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              Client preview
            </div>
            <h3 className="mt-2 text-base font-medium text-[var(--ft-text-primary)]">
              {report.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
              {draftSummary.trim() || "Client summary pending operator review."}
            </p>
          </div>
        ) : null}
      </div>
      <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)]">
        <div className="border-b border-[var(--ft-border)] px-3 py-2 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
          Performance metrics
        </div>
        {report.metrics.length > 0 ? (
          <div className="divide-y divide-[var(--ft-border)]">
            {report.metrics.map((metric) => (
              <div
                className="flex min-h-10 items-center justify-between gap-3 px-3 py-2 text-sm"
                key={metric.label}
              >
                <span className="truncate text-[var(--ft-text-secondary)]">{metric.label}</span>
                <span className="font-mono text-[var(--ft-text-primary)]">{metric.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <InlineEmptyState
            detail="Needs Action: add performance metrics before publishing."
            title="Metrics pending"
          />
        )}
      </div>
    </div>
  );
}

export default function AdminCampaignOpsReportsPage() {
  const { error, items, loading, refresh, source } = useAdminCampaignOpsReportsData();
  const [status, setStatus] = useState<ReportFilter>("all");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [publishReportId, setPublishReportId] = useState<string | null>(null);
  const [publishingReportId, setPublishingReportId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>();
  const [actionMessage, setActionMessage] = useState<string>();

  const filteredReports = useMemo(
    () => items.filter((report) => status === "all" || report.status === status),
    [items, status]
  );

  const readyCount = items.filter((report) => report.status === "ready").length;
  const generatingCount = items.filter((report) => report.status === "generating").length;
  const failedCount = items.filter((report) => report.status === "failed").length;
  const publishReport = items.find((report) => report.id === publishReportId) ?? null;

  const stats = [
    { detail: "Total client report jobs", label: "Report jobs", value: items.length },
    { detail: "Ready for client publish", label: "Needs publish", value: readyCount },
    { detail: "Metrics or copy still building", label: "Building", value: generatingCount },
    { detail: "Needs operator retry", label: "Needs retry", value: failedCount }
  ];
  const statStripItems = stats.map((item) => ({
    label: item.label,
    value: loading ? "..." : item.value
  }));

  async function confirmPublishReport() {
    if (!publishReport) {
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setPublishingReportId(publishReport.id);
    try {
      await publishAdminCampaignReport(publishReport.id);
      setActionMessage(`Published ${publishReport.title} to the client.`);
      setPublishReportId(null);
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not publish report.");
    } finally {
      setPublishingReportId(null);
    }
  }

  return (
    <AdminCampaignOpsShell active="/campaign-ops/reports">
      <PublishReportDialog
        onCancel={() => setPublishReportId(null)}
        onConfirm={() => void confirmPublishReport()}
        pending={publishingReportId === publishReport?.id}
        report={publishReport}
      />
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <Button>
              <Download className="size-4 stroke-[1.5]" />
              Export reports CSV
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Reports desk</Badge>
            <Badge tone={source === "api" ? "success" : "neutral"}>Publication control</Badge>
            <Badge tone="neutral">{filteredReports.length} shown</Badge>
          </>
        }
        title="Client Reports Queue"
      />

      {error ? <ErrorBanner message={error} /> : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}
      {actionMessage ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-green)]/35 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-green)]">
          {actionMessage}
        </div>
      ) : null}

      <section className="mt-5 flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-10 min-w-56 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)]">
          <Filter className="size-4 stroke-[1.5]" />
          <select
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none"
            onChange={(event) => setStatus(event.target.value as ReportFilter)}
            value={status}
          >
            <option value="all">All report states</option>
            {campaignOpsReportStatuses.map((item) => (
              <option key={item} value={item}>
                {labelReportStatus(item)}
              </option>
            ))}
          </select>
        </label>
        <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
          Metrics complete / last updated / client-visible state
        </div>
      </section>

      <SummaryStatStrip className="mt-5" items={statStripItems} />

      <section className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-transparent">
        {loading ? (
          <LoadingRows count={5} />
        ) : filteredReports.length === 0 ? (
          <div className="p-4">
            <EmptyState
              detail={
                items.length === 0
                  ? "Reports appear once operators prepare metrics and client-ready commentary."
                  : "No reports match the selected status."
              }
              title="No client reports need action"
            />
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 md:hidden">
              {filteredReports.map((report) => {
                const expanded = expandedReportId === report.id;

                return (
                  <div
                    className={cn(
                      expanded ? "rounded-[var(--radius-md)] ring-2 ring-[var(--ft-accent)]/40" : ""
                    )}
                    key={report.id}
                  >
                    <ReportCard
                      action={
                        <div className="grid gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <ReportStatusBadge status={report.status} />
                            <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                              Updated {report.generatedAt}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="h-8 px-2 text-xs"
                              onClick={() =>
                                setExpandedReportId((current) =>
                                  current === report.id ? null : report.id
                                )
                              }
                              type="button"
                              variant="secondary"
                            >
                              <PenSquare className="size-3.5 stroke-[1.5]" />
                              Preview & Edit
                            </Button>
                            <Button
                              className="h-8 px-2 text-xs"
                              disabled={!canPublishReport(report)}
                              onClick={() => setPublishReportId(report.id)}
                              type="button"
                              variant="secondary"
                            >
                              <Send className="size-3.5 stroke-[1.5]" />
                              Publish to Client
                            </Button>
                            <Button
                              className="h-8 px-2 text-xs"
                              disabled={report.status !== "ready"}
                              type="button"
                              variant="ghost"
                            >
                              <Download className="size-3.5 stroke-[1.5]" />
                              Download PDF
                            </Button>
                          </div>
                        </div>
                      }
                      campaign={report.owner}
                      metrics={
                        report.metrics.length > 0
                          ? report.metrics
                          : [{ label: "Metrics", value: "Needs Action" }]
                      }
                      period={report.period}
                      summary={report.summary}
                      title={report.title}
                    />
                    {expanded ? (
                      <div className="mt-4 border-t border-[var(--ft-border)] pt-4">
                        <ReportDraftWorkspace
                          onPublish={() => setPublishReportId(report.id)}
                          report={report}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[280px]" />
                  <col className="w-[150px]" />
                  <col className="w-[150px]" />
                  <col className="w-[150px]" />
                  <col className="w-[170px]" />
                  <col className="w-[250px]" />
                </colgroup>
                <thead className="sticky top-[52px] z-10 bg-[var(--ft-bg-surface)]">
                  <tr className="border-b border-[var(--ft-border)] font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                    <th className="px-4 py-3 font-medium">Campaign</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Metrics complete</th>
                    <th className="px-4 py-3 font-medium">Last updated</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report, index) => {
                    const expanded = expandedReportId === report.id;

                    return (
                      <Fragment key={report.id}>
                        <tr
                          className={cn(
                            "h-14 border-b border-[var(--ft-border)] transition hover:bg-[var(--ft-bg-raised)]",
                            index % 2 === 1 ? "bg-[var(--ft-bg-muted)]/40" : "bg-transparent",
                            expanded ? "bg-[var(--ft-accent-subtle)]" : ""
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="truncate font-medium text-[var(--ft-text-primary)]">
                              {report.title}
                            </div>
                            <div className="mt-1 truncate text-sm text-[var(--ft-text-muted)]">
                              {report.period}
                            </div>
                          </td>
                          <td className="truncate px-4 py-3 text-[var(--ft-text-secondary)]">
                            {report.owner}
                          </td>
                          <td className="px-4 py-3">
                            <ReportStatusBadge status={report.status} />
                          </td>
                          <td className="px-4 py-3 font-mono text-[12px] text-[var(--ft-text-primary)]">
                            {report.metrics.length > 0
                              ? `${report.metrics.length} rows`
                              : "Needs metrics"}
                          </td>
                          <td className="px-4 py-3 text-[var(--ft-text-secondary)]">
                            {report.generatedAt}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                className="h-8 px-2 text-xs"
                                onClick={() =>
                                  setExpandedReportId((current) =>
                                    current === report.id ? null : report.id
                                  )
                                }
                                type="button"
                                variant="secondary"
                              >
                                <PenSquare className="size-3.5 stroke-[1.5]" />
                                Edit summary
                              </Button>
                              <Button
                                className="h-8 px-2 text-xs"
                                disabled={!canPublishReport(report)}
                                onClick={() => setPublishReportId(report.id)}
                                type="button"
                                variant="secondary"
                              >
                                <Send className="size-3.5 stroke-[1.5]" />
                                Publish Client Report
                              </Button>
                              <Button
                                className="h-8 px-2 text-xs"
                                disabled={report.status !== "ready"}
                                type="button"
                                variant="ghost"
                              >
                                <Download className="size-3.5 stroke-[1.5]" />
                                Download PDF
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/55">
                            <td className="px-4 py-4" colSpan={6}>
                              <ReportDraftWorkspace
                                onPublish={() => setPublishReportId(report.id)}
                                report={report}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </AdminCampaignOpsShell>
  );
}
