"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, X } from "lucide-react";

import { Badge, TimelineEvent } from "@fliptrybe/ui";
import { Button } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, Field, LoadingBlock, PageHeader } from "../../campaigns/components";
import {
  loadSubmissionStages,
  loadSubmissions,
  TRUST_ENGINE_STAGE_ORDER,
  type SubmissionAssetClassFilter,
  type SubmissionListItem,
  type SubmissionStagesResponse,
  type SubmissionStatusFilter
} from "./api";

// NOTE ON SCOPE: this is a read-only staff review surface over the Trust Engine's
// 7-stage asset-validation pipeline (apps/api/src/modules/trust-engine). Unlike
// /os/approvals there is no decide/approve/reject action here — the underlying
// ModerationQueue table exists in the schema but nothing in the API writes to it
// yet, so there is nothing to "act on" from this screen. It shows what the pipeline
// produced (submission status, verdict, per-stage pass/fail) so staff can see the
// pipeline is working before a decision surface gets built on top of it. Gated
// behind the `trustEngine` feature flag server-side; a 403 here just means the
// flag is off, same as every other flagged module in this app.

const statusFilters: Array<{ label: string; value: SubmissionStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "PENDING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Review", value: "REVIEW" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" }
];

const assetClassFilters: Array<{ label: string; value: SubmissionAssetClassFilter }> = [
  { label: "All", value: "all" },
  { label: "Gift Card", value: "GIFT_CARD" },
  { label: "Airtime PIN", value: "AIRTIME_PIN" },
  { label: "Recharge Voucher", value: "RECHARGE_VOUCHER" },
  { label: "Digital Coupon", value: "DIGITAL_COUPON" }
];

function statusTone(status: SubmissionListItem["status"]): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "ACCEPTED" || status === "COMPLETED") return "success";
  if (status === "REJECTED" || status === "DISPUTED") return "danger";
  if (status === "REVIEW") return "warning";
  return "info";
}

function verdictTone(verdict: SubmissionListItem["latestVerdict"]): "neutral" | "success" | "warning" | "danger" {
  if (verdict === "ACCEPT") return "success";
  if (verdict === "REJECT") return "danger";
  if (verdict === "REVIEW") return "warning";
  return "neutral";
}

function stageTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "PASS") return "success";
  if (status === "FAIL") return "danger";
  if (status === "INCONCLUSIVE") return "warning";
  return "neutral";
}

function ageLabel(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return "-";
  const ms = Date.now() - created;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function TrustEngineReviewPage() {
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<SubmissionStatusFilter>("all");
  const [assetClass, setAssetClass] = useState<SubmissionAssetClassFilter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [stages, setStages] = useState<SubmissionStagesResponse>();
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stagesError, setStagesError] = useState<string>();

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      setSubmissions(await loadSubmissions({ status, assetClass }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Trust Engine submissions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, assetClass]);

  const selected = useMemo(
    () => submissions.find((submission) => submission.id === selectedId),
    [submissions, selectedId]
  );

  useEffect(() => {
    if (!selectedId) {
      setStages(undefined);
      return;
    }
    let cancelled = false;
    setStagesLoading(true);
    setStagesError(undefined);
    loadSubmissionStages(selectedId)
      .then((result) => {
        if (!cancelled) setStages(result);
      })
      .catch((caught) => {
        if (!cancelled) {
          setStagesError(
            caught instanceof Error ? caught.message : "Could not load the stage breakdown."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setStagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const orderedStages = useMemo(() => {
    if (!stages) return [];
    const byKey = new Map(stages.stages.map((stage) => [stage.stageKey, stage]));
    return TRUST_ENGINE_STAGE_ORDER.map((key) => ({ key, result: byKey.get(key) }));
  }, [stages]);

  return (
    <>
      <PageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Governance</Badge>
            <Badge tone="neutral">Trust Engine</Badge>
          </>
        }
        title="Asset Review"
      />

      <ErrorNotice message={error} />

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            Status
          </span>
          {statusFilters.map((filter) => (
            <button
              className={`h-8 rounded-[var(--radius-sm)] border px-3 text-xs font-medium transition ${
                status === filter.value
                  ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                  : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)]"
              }`}
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            Asset class
          </span>
          {assetClassFilters.map((filter) => (
            <button
              className={`h-8 rounded-[var(--radius-sm)] border px-3 text-xs font-medium transition ${
                assetClass === filter.value
                  ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                  : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)]"
              }`}
              key={filter.value}
              onClick={() => setAssetClass(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
        <div className="hidden grid-cols-[1fr_140px_140px_100px_80px] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase sm:grid">
          <div>Submission</div>
          <div>Asset Class</div>
          <div>Status</div>
          <div>Verdict</div>
          <div>Age</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {loading ? (
            <div className="p-4">
              <LoadingBlock label="Loading Trust Engine submissions" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-4">
              <EmptyState
                copy="No asset submissions match this filter. Submissions land here once something calls POST /trust-engine/submissions and the worker's validation queue consumer runs the 7-stage pipeline against them."
                icon={ShieldCheck}
                title="Nothing to review"
              />
            </div>
          ) : (
            submissions.map((submission) => (
              <button
                className="grid w-full gap-3 p-4 text-left transition hover:bg-[var(--ft-bg-muted)] sm:grid-cols-[1fr_140px_140px_100px_80px] sm:items-center"
                key={submission.id}
                onClick={() => setSelectedId(submission.id)}
                type="button"
              >
                <div>
                  <div className="font-mono text-sm text-[var(--ft-text-primary)]">{submission.id}</div>
                  <div className="mt-1 text-xs text-[var(--ft-text-muted)]">User {submission.userId}</div>
                </div>
                <Badge tone="neutral">{submission.assetClass}</Badge>
                <Badge tone={statusTone(submission.status)}>{submission.status}</Badge>
                <Badge tone={verdictTone(submission.latestVerdict)}>{submission.latestVerdict ?? "—"}</Badge>
                <div className="text-sm text-[var(--ft-text-secondary)]">{ageLabel(submission.createdAt)}</div>
              </button>
            ))
          )}
        </div>
      </section>

      {selected ? (
        <div
          className="fixed inset-0 z-[70] bg-[var(--ft-bg-base)]/80 backdrop-blur-sm"
          onClick={() => setSelectedId(undefined)}
        >
          <aside
            className="ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--ft-border)] p-5">
              <div>
                <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                  Submission detail
                </div>
                <h2 className="mt-2 font-mono text-base text-[var(--ft-text-primary)]">{selected.id}</h2>
              </div>
              <button
                aria-label="Close submission detail"
                className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] text-[var(--ft-text-secondary)] transition hover:bg-[var(--ft-bg-muted)]"
                onClick={() => setSelectedId(undefined)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
                <Badge tone={verdictTone(selected.latestVerdict)}>
                  {selected.latestVerdict ? `Verdict: ${selected.latestVerdict}` : "No verdict yet"}
                </Badge>
              </div>

              <Field label="Asset class" value={selected.assetClass} />
              <Field label="Submitted by" value={selected.userId} />
              <Field label="Workspace" value={selected.workspaceId} />
              <Field label="Age" value={ageLabel(selected.createdAt)} />

              {selected.latestVerdictReasons.length > 0 ? (
                <div>
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                    Reason codes
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.latestVerdictReasons.map((reason) => (
                      <Badge key={reason} tone="neutral">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                  7-stage pipeline
                </div>
                <div className="mt-3">
                  {stagesLoading ? (
                    <LoadingBlock label="Loading stage results" />
                  ) : stagesError ? (
                    <ErrorNotice message={stagesError} />
                  ) : !stages || stages.stages.length === 0 ? (
                    <p className="text-sm leading-6 text-[var(--ft-text-secondary)]">
                      No validation run has completed for this submission yet. It either just
                      landed as PENDING, or the worker's validation queue consumer has not picked
                      it up (the queue is wired but not yet consumed end-to-end).
                    </p>
                  ) : (
                    <div className="grid gap-4">
                      {orderedStages.map(({ key, result }) => (
                        <TimelineEvent
                          key={key}
                          timestamp={result ? new Date(result.createdAt).toLocaleString() : "Not run"}
                          title={key.replaceAll("_", " ")}
                          type={result?.status === "PASS" ? "milestone" : "system"}
                        >
                          {result ? (
                            <div className="grid gap-1.5">
                              <Badge tone={stageTone(result.status)}>{result.status}</Badge>
                              {result.reasonCodes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {result.reasonCodes.map((reason) => (
                                    <Badge key={reason} tone="neutral">
                                      {reason}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              {result.failureMessage ? (
                                <p className="text-xs text-[var(--ft-red)]">{result.failureMessage}</p>
                              ) : null}
                              <p className="text-xs text-[var(--ft-text-muted)]">
                                {result.durationMs}ms · {result.retryCount} retries
                              </p>
                            </div>
                          ) : (
                            <Badge tone="neutral">Not yet run</Badge>
                          )}
                        </TimelineEvent>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {stages?.validationRun ? (
                <div>
                  <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                    Scores
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-[var(--radius-sm)] bg-[var(--ft-bg-muted)] p-3">
                      <div className="font-mono text-lg text-[var(--ft-text-primary)]">
                        {stages.validationRun.fraudScore}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                        Fraud
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--ft-bg-muted)] p-3">
                      <div className="font-mono text-lg text-[var(--ft-text-primary)]">
                        {stages.validationRun.trustScore}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                        Trust
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--ft-bg-muted)] p-3">
                      <div className="font-mono text-lg text-[var(--ft-text-primary)]">
                        {stages.validationRun.finalScore}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                        Final
                      </div>
                    </div>
                  </div>
                  {stages.validationRun.verdictExplained ? (
                    <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
                      {stages.validationRun.verdictExplained}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
