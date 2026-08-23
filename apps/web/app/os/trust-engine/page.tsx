"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, ShieldCheck, X } from "lucide-react";

import { Badge, Button, EmptyState } from "@fliptrybe/ui";

import { ErrorNotice, Field, LoadingBlock, PageHeader } from "../../campaigns/components";
import {
  loadSubmissionStages,
  loadSubmissions,
  moderateSubmission,
  type AssetClass,
  type SubmissionListItem,
  type SubmissionStagesResponse,
  type SubmissionStatus
} from "./api";

// Staff review queue for the Trust Engine's 7-stage fraud/authenticity pipeline
// (services/trust-engine). Submissions land in REVIEW status when the pipeline's
// verdict is ambiguous; this page lets a staff reviewer approve or reject them,
// which flips AssetSubmission.status to ACCEPTED/REJECTED and records the decision
// on the ModerationQueue row (created here if one doesn't exist yet, since nothing
// else in the codebase currently writes to that table).

const statusFilters: Array<{ label: string; value: SubmissionStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Review", value: "REVIEW" },
  { label: "Pending", value: "PENDING" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" }
];

const assetClassFilters: Array<{ label: string; value: AssetClass | "all" }> = [
  { label: "All", value: "all" },
  { label: "Gift Card", value: "GIFT_CARD" },
  { label: "Airtime PIN", value: "AIRTIME_PIN" },
  { label: "Recharge Voucher", value: "RECHARGE_VOUCHER" },
  { label: "Digital Coupon", value: "DIGITAL_COUPON" }
];

function statusTone(
  status: SubmissionStatus
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "ACCEPTED" || status === "COMPLETED") return "success";
  if (status === "REJECTED" || status === "DISPUTED") return "danger";
  if (status === "REVIEW") return "warning";
  return "info";
}

export default function TrustEnginePage() {
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<SubmissionStatus | "all">("REVIEW");
  const [assetClass, setAssetClass] = useState<AssetClass | "all">("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [stages, setStages] = useState<SubmissionStagesResponse>();
  const [stagesLoading, setStagesLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [deciding, setDeciding] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      setSubmissions(await loadSubmissions({ status, assetClass }));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load the Trust Engine review queue."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Refetch on filter change only; `refresh` is recreated every render.
    void refresh();
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
    setStagesLoading(true);
    loadSubmissionStages(selectedId)
      .then(setStages)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Could not load stage results.")
      )
      .finally(() => setStagesLoading(false));
  }, [selectedId]);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setDeciding(true);
    setError(undefined);
    try {
      const result = await moderateSubmission(id, decision, reason.trim() || undefined);
      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === id
            ? { ...submission, status: result.status, moderation: result.moderation }
            : submission
        )
      );
      setReason("");
      setSelectedId(undefined);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not record that moderation decision."
      );
    } finally {
      setDeciding(false);
    }
  }

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
            <Badge tone="info">Trust</Badge>
            <Badge tone="neutral">Staff review queue</Badge>
          </>
        }
        title="Trust Engine"
      />

      <ErrorNotice message={error} />

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-micro font-mono tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
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
        <div className="flex items-center gap-2">
          <span className="text-micro font-mono tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
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
        <div className="text-micro hidden grid-cols-[1fr_120px_160px_120px_220px] gap-3 border-b border-[var(--ft-border)] px-4 py-3 font-mono font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase sm:grid">
          <div>Submission</div>
          <div>Asset Class</div>
          <div>Verdict</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-[var(--ft-border)]">
          {loading ? (
            <div className="p-4">
              <LoadingBlock label="Loading Trust Engine submissions" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={ShieldCheck} title="Nothing to review">
                No submissions match this filter. Submissions that land in REVIEW status are waiting
                on a staff decision.
              </EmptyState>
            </div>
          ) : (
            submissions.map((submission) => (
              <div
                className="grid gap-3 p-4 sm:grid-cols-[1fr_120px_160px_120px_220px] sm:items-center"
                key={submission.id}
              >
                <div>
                  <div className="font-mono text-sm text-[var(--ft-text-primary)]">
                    {submission.id}
                  </div>
                  <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                    workspace {submission.workspaceId}
                  </div>
                </div>
                <Badge tone="neutral">{submission.assetClass}</Badge>
                <div className="text-sm text-[var(--ft-text-secondary)]">
                  {submission.latestVerdict ?? "-"}
                </div>
                <Badge tone={statusTone(submission.status)}>{submission.status}</Badge>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={deciding || submission.status !== "REVIEW"}
                    onClick={() => void decide(submission.id, "APPROVE")}
                    type="button"
                  >
                    <Check className="size-3.5" />
                    Approve
                  </Button>
                  <Button
                    disabled={deciding || submission.status !== "REVIEW"}
                    onClick={() => void decide(submission.id, "REJECT")}
                    type="button"
                    variant="secondary"
                  >
                    <X className="size-3.5" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => setSelectedId(submission.id)}
                    type="button"
                    variant="secondary"
                  >
                    View Details
                  </Button>
                </div>
              </div>
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
                <div className="text-micro font-mono font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                  Submission detail
                </div>
                <h2 className="mt-2 text-lg font-medium text-[var(--ft-text-primary)]">
                  {selected.id}
                </h2>
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
              <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>

              <Field label="Asset class" value={selected.assetClass} />
              <Field label="Latest verdict" value={selected.latestVerdict ?? "-"} />
              <Field
                label="Verdict reasons"
                value={selected.latestVerdictReasons.join(", ") || "-"}
              />
              {selected.moderation ? (
                <>
                  <Field label="Previous decision" value={selected.moderation.decision ?? "-"} />
                  <Field
                    label="Previous decision reason"
                    value={selected.moderation.decisionReason ?? "-"}
                  />
                </>
              ) : null}

              <div>
                <div className="text-micro font-mono font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                  7-stage pipeline
                </div>
                {stagesLoading ? (
                  <LoadingBlock label="Loading stage results" />
                ) : stages && stages.stages.length > 0 ? (
                  <div className="mt-2 grid gap-2">
                    {stages.stages.map((stage) => (
                      <div
                        className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-sm"
                        key={stage.stageKey}
                      >
                        <span className="text-[var(--ft-text-primary)]">{stage.stageKey}</span>
                        <Badge
                          tone={
                            stage.status === "PASS"
                              ? "success"
                              : stage.status === "FAIL"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {stage.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                    No validation run recorded for this submission yet.
                  </p>
                )}
              </div>

              <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                Decision reason
                <textarea
                  className="min-h-24 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Add a reason for approving or rejecting this submission (optional)"
                  value={reason}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={deciding || selected.status !== "REVIEW"}
                  onClick={() => void decide(selected.id, "APPROVE")}
                  type="button"
                >
                  <Check className="size-4" />
                  Approve
                </Button>
                <Button
                  disabled={deciding || selected.status !== "REVIEW"}
                  onClick={() => void decide(selected.id, "REJECT")}
                  type="button"
                  variant="secondary"
                >
                  <X className="size-4" />
                  Reject
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
