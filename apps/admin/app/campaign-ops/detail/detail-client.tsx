"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitBranch,
  Image,
  MessageSquare,
  Paperclip,
  RefreshCw,
  UserCheck
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  DeltaBadge,
  OperatorNote,
  OpsTaskChecklist,
  Panel,
  ProofItem,
  TimelineEvent,
  cn
} from "@fliptrybe/ui";

import {
  addAdminCampaignPlacement,
  addAdminCampaignMetrics,
  addAdminCampaignNote,
  createAdminCampaignReport,
  updateAdminCampaignStatus
} from "../api";
import {
  ActionLink,
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  EmptyState,
  ErrorBanner,
  FieldRow,
  LoadingRows,
  PriorityBadge,
  ProgressBar,
  PlatformChip,
  StatusBadge
} from "../components";
import { type CampaignOpsReportType, type CampaignOpsStatus } from "../data";
import { useAdminCampaignOpsCampaign } from "../use-admin-campaign-ops-data";

type WorkspaceTab = "brief" | "assets" | "metrics" | "proof" | "activity";
type MetricsDraft = {
  clicks: string;
  conversions: string;
  impressions: string;
  notes: string;
  reach: string;
  spend: string;
};
type PlacementDraft = {
  adAccountId: string;
  adSetId: string;
  adUrl: string;
  campaignExternalId: string;
  clientVisible: boolean;
  launchDate: string;
  notes: string;
  spend: string;
};
type ReportDraft = {
  periodEnd: string;
  periodStart: string;
  reportType: CampaignOpsReportType;
  summary: string;
};

const workspaceTabs: Array<{ id: WorkspaceTab; label: string; icon: typeof FileText }> = [
  { id: "brief", label: "Brief", icon: FileText },
  { id: "assets", label: "Assets", icon: Image },
  { id: "metrics", label: "Metrics", icon: BarChart3 },
  { id: "proof", label: "Proof", icon: Paperclip },
  { id: "activity", label: "Activity", icon: Activity }
];

const transitionOptions: Partial<Record<CampaignOpsStatus, CampaignOpsStatus[]>> = {
  approved: ["creative_review", "blocked", "failed"],
  assigned: ["creative_review", "blocked", "failed"],
  blocked: ["review", "failed"],
  completed: [],
  creative_review: ["platform_launch", "blocked", "failed"],
  failed: [],
  optimization: ["reporting", "blocked", "failed"],
  paused: ["optimization", "reporting", "blocked", "failed"],
  platform_launch: ["optimization", "blocked", "failed"],
  reporting: ["completed", "blocked", "failed"],
  review: ["approved", "blocked", "failed"],
  submitted: ["review", "blocked"]
};

const metricFields: Array<{
  key: keyof Omit<MetricsDraft, "notes">;
  label: string;
  placeholder: string;
}> = [
  { key: "impressions", label: "Impressions", placeholder: "0" },
  { key: "reach", label: "Reach", placeholder: "0" },
  { key: "clicks", label: "Clicks", placeholder: "0" },
  { key: "conversions", label: "Conversions", placeholder: "0" },
  { key: "spend", label: "Spend (NGN)", placeholder: "0" }
];
const placementFields: Array<{
  key: keyof Omit<PlacementDraft, "clientVisible">;
  inputMode?: "decimal" | "numeric" | "text";
  label: string;
  placeholder: string;
  type?: string;
}> = [
  { key: "adAccountId", label: "Ad account", placeholder: "act_..." },
  { key: "campaignExternalId", label: "Campaign ID", placeholder: "External campaign ID" },
  { key: "adSetId", label: "Ad set ID", placeholder: "Ad set / ad group ID" },
  { key: "adUrl", label: "Placement URL", placeholder: "https://..." },
  { key: "launchDate", label: "Launch date", placeholder: "YYYY-MM-DD", type: "date" },
  { inputMode: "decimal", key: "spend", label: "Spend (NGN)", placeholder: "0" },
  { key: "notes", label: "Notes", placeholder: "Launch notes" }
];

function emptyMetricsDraft(): MetricsDraft {
  return {
    clicks: "",
    conversions: "",
    impressions: "",
    notes: "",
    reach: "",
    spend: ""
  };
}

function emptyPlacementDraft(destinationUrl = ""): PlacementDraft {
  return {
    adAccountId: "",
    adSetId: "",
    adUrl: destinationUrl,
    campaignExternalId: "",
    clientVisible: false,
    launchDate: new Date().toISOString().slice(0, 10),
    notes: "",
    spend: "0"
  };
}

function emptyReportDraft(): ReportDraft {
  return {
    periodEnd: "",
    periodStart: "",
    reportType: "weekly_report",
    summary: ""
  };
}

function numericDraftValue(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function labelStatus(status: CampaignOpsStatus) {
  const labels: Record<CampaignOpsStatus, string> = {
    approved: "Approved",
    assigned: "Assigned",
    blocked: "Blocked",
    completed: "Completed",
    creative_review: "Creative Review",
    failed: "Failed",
    optimization: "Optimization",
    paused: "Paused",
    platform_launch: "Platform Launch",
    reporting: "Reporting",
    review: "Review",
    submitted: "Submitted"
  };

  return labels[status];
}

function labelReportType(type: CampaignOpsReportType) {
  const labels: Record<CampaignOpsReportType, string> = {
    daily_update: "Daily Update",
    final_report: "Final Report",
    weekly_report: "Weekly Report"
  };

  return labels[type];
}

function hasReadyValue(value: string) {
  return value.trim().length > 0 && !value.toLowerCase().includes("needs action");
}

function StatusTransitionDialog({
  campaignName,
  fromStatus,
  onCancel,
  onConfirm,
  open,
  pending,
  toStatus
}: {
  campaignName: string;
  fromStatus: CampaignOpsStatus;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  pending: boolean;
  toStatus: CampaignOpsStatus | "";
}) {
  if (!open || !toStatus) {
    return null;
  }

  const destructive = toStatus === "completed" || toStatus === "blocked" || toStatus === "failed";

  return (
    <div
      aria-labelledby="status-transition-title"
      aria-modal="true"
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start gap-3 border-b border-[var(--ft-border)] p-4">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border",
              destructive
                ? "border-[var(--ft-red)]/45 bg-[var(--ft-red-subtle)] text-[var(--ft-red)]"
                : "border-[var(--ft-accent)]/45 bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
            )}
          >
            <AlertTriangle className="size-5 stroke-[1.5]" />
          </div>
          <div>
            <h2
              id="status-transition-title"
              className="text-base font-semibold text-[var(--ft-text-primary)]"
            >
              Confirm ops status change
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
              Move {campaignName} from {labelStatus(fromStatus)} to {labelStatus(toStatus)}. This
              action is recorded in the activity trail and should match the latest client-visible
              update.
            </p>
          </div>
        </div>
        <div className="border-b border-[var(--ft-border)] p-4">
          <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
            {destructive
              ? "Completed, blocked, and failed transitions can materially change client expectations. Confirm only after report notes, proof, or follow-up actions are ready."
              : "This moves the campaign through the manual marketing operations workflow."}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={onConfirm}
            type="button"
            variant={destructive ? "danger" : "primary"}
          >
            {pending ? "Updating" : "Update Campaign Status"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminCampaignOpsDetailClient() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") ?? "";
  const hasCampaignId = campaignId.trim().length > 0;
  const { campaign, error, loading, refresh } = useAdminCampaignOpsCampaign(campaignId);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("brief");
  const [selectedTransition, setSelectedTransition] = useState<CampaignOpsStatus | "">("");
  const [transitionConfirmOpen, setTransitionConfirmOpen] = useState(false);
  const [clientUpdateText, setClientUpdateText] = useState("");
  const [clientTimelineUpdates, setClientTimelineUpdates] = useState<
    Array<{ id: string; text: string; timestamp: string }>
  >([]);
  const [internalNoteText, setInternalNoteText] = useState("");
  const [metricsDraft, setMetricsDraft] = useState<MetricsDraft>(() => emptyMetricsDraft());
  const [actionError, setActionError] = useState<string>();
  const [actionMessage, setActionMessage] = useState<string>();
  const [transitionSaving, setTransitionSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [clientUpdateSaving, setClientUpdateSaving] = useState(false);
  const [metricsSaving, setMetricsSaving] = useState(false);
  const [placementDrafts, setPlacementDrafts] = useState<Record<string, PlacementDraft>>({});
  const [placementSaving, setPlacementSaving] = useState(false);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(() => emptyReportDraft());
  const [reportSaving, setReportSaving] = useState(false);

  useEffect(() => {
    if (!campaign) {
      setSelectedTransition("");
      return;
    }

    setSelectedTransition(transitionOptions[campaign.status]?.[0] ?? "");
    setTransitionConfirmOpen(false);
  }, [campaign]);

  const platforms = useMemo(() => {
    if (!campaign) {
      return [];
    }

    return campaign.channel
      .split(/[,/&]+/)
      .map((platform) => platform.trim())
      .filter(Boolean);
  }, [campaign]);
  const placementPlatforms = useMemo(
    () => (platforms.length > 0 ? platforms : campaign ? [campaign.channel] : []),
    [campaign, platforms]
  );

  const destinationHref =
    campaign?.destinationUrl.startsWith("http") === true ? campaign.destinationUrl : undefined;
  const workflowOrder: CampaignOpsStatus[] = [
    "submitted",
    "review",
    "approved",
    "assigned",
    "creative_review",
    "platform_launch",
    "optimization",
    "paused",
    "reporting",
    "completed"
  ];
  const currentStatusIndex = campaign
    ? campaign.status === "paused"
      ? workflowOrder.indexOf("optimization")
      : Math.min(8, Math.max(0, workflowOrder.indexOf(campaign.status)))
    : 0;
  const canCreateReport =
    campaign !== null &&
    (campaign.launchedPlacementCount > 0 ||
      campaign.status === "optimization" ||
      campaign.status === "reporting" ||
      campaign.status === "completed");
  const transitionGuardMessage =
    campaign && selectedTransition === "optimization" && campaign.launchedPlacementCount === 0
      ? "Record a launched placement before optimization."
      : campaign && selectedTransition === "completed" && campaign.publishedReportCount === 0
        ? "Publish a client report before completion."
        : undefined;
  const opsChecklistItems = campaign
    ? [
        {
          done: hasReadyValue(campaign.objective),
          label: "Objective translated into a manual launch plan"
        },
        {
          done: hasReadyValue(campaign.destinationUrl),
          label: "Destination URL checked before launch"
        },
        {
          done: hasReadyValue(campaign.budget) && hasReadyValue(campaign.runWindow),
          label: "Budget and flight window ready for platform setup"
        },
        {
          done: campaign.assignee.toLowerCase() !== "unassigned",
          label: "Campaign has a named ops owner"
        },
        {
          done: campaign.launchedPlacementCount > 0,
          label: "Platform launch placement recorded"
        },
        {
          done: campaign.publishedReportCount > 0 || campaign.status !== "completed",
          label: "Client report published before completion"
        },
        {
          done: campaign.budgetUtilization <= 100,
          label: "Spend stays within campaign allocation"
        },
        {
          done: campaign.progress >= 50,
          label: "Launch proof and reporting path prepared"
        }
      ]
    : [];

  useEffect(() => {
    if (!campaign) {
      setPlacementDrafts({});
      return;
    }

    setPlacementDrafts((current) => {
      const next: Record<string, PlacementDraft> = {};
      for (const platform of placementPlatforms) {
        next[platform] = current[platform] ?? emptyPlacementDraft(campaign.destinationUrl);
      }

      return next;
    });
  }, [campaign?.destinationUrl, campaign?.id, placementPlatforms]);

  async function confirmStatusTransition() {
    if (!campaign || !selectedTransition) {
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setTransitionSaving(true);
    try {
      await updateAdminCampaignStatus(
        campaign.id,
        selectedTransition,
        `Ops status moved to ${labelStatus(selectedTransition)} from admin campaign ops.`
      );
      setActionMessage(`Campaign status moved to ${labelStatus(selectedTransition)}.`);
      setTransitionConfirmOpen(false);
      await refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Could not update campaign status."
      );
    } finally {
      setTransitionSaving(false);
    }
  }

  async function postInternalNote() {
    if (!campaign) {
      return;
    }

    const body = internalNoteText.trim();
    if (!body) {
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setNoteSaving(true);
    try {
      await addAdminCampaignNote(campaign.id, { body, visibility: "INTERNAL" });
      setInternalNoteText("");
      setActionMessage("Internal note saved to the campaign activity trail.");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not save internal note.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function postClientUpdate() {
    if (!campaign) {
      return;
    }

    const text = clientUpdateText.trim();

    if (!text) {
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setClientUpdateSaving(true);
    try {
      await addAdminCampaignNote(campaign.id, { body: text, visibility: "CLIENT_VISIBLE" });
      setClientTimelineUpdates((updates) => [
        {
          id: `${Date.now()}`,
          text,
          timestamp: new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
            timeStyle: "short"
          }).format(new Date())
        },
        ...updates
      ]);
      setClientUpdateText("");
      setActionMessage("Client-visible timeline update posted.");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not post client update.");
    } finally {
      setClientUpdateSaving(false);
    }
  }

  async function saveMetrics() {
    if (!campaign) {
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setMetricsSaving(true);
    try {
      const spendMinor = Math.round(numericDraftValue(metricsDraft.spend) * 100);
      await addAdminCampaignMetrics(campaign.id, {
        amountMinor: spendMinor,
        clicks: numericDraftValue(metricsDraft.clicks),
        conversions: numericDraftValue(metricsDraft.conversions),
        impressions: numericDraftValue(metricsDraft.impressions),
        metricName: "manual_performance",
        notes: metricsDraft.notes.trim() || undefined,
        reach: numericDraftValue(metricsDraft.reach),
        spendMinor,
        value: numericDraftValue(metricsDraft.impressions)
      });
      setMetricsDraft(emptyMetricsDraft());
      setActionMessage("Performance metrics saved for client reporting.");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not save campaign metrics.");
    } finally {
      setMetricsSaving(false);
    }
  }

  async function createReportDraft() {
    if (!campaign) {
      return;
    }
    if (!canCreateReport) {
      setActionError("Reports cannot be created before launch.");
      return;
    }

    const summary = reportDraft.summary.trim();
    if (!summary) {
      setActionError("Add a report summary before creating a report draft.");
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setReportSaving(true);
    try {
      const spendMinor = Math.round(numericDraftValue(metricsDraft.spend) * 100);
      await createAdminCampaignReport(campaign.id, {
        clicks: numericDraftValue(metricsDraft.clicks),
        conversions: numericDraftValue(metricsDraft.conversions),
        impressions: numericDraftValue(metricsDraft.impressions),
        metrics: {
          notes: metricsDraft.notes.trim() || undefined,
          reportType: reportDraft.reportType
        },
        periodEnd: reportDraft.periodEnd || undefined,
        periodStart: reportDraft.periodStart || undefined,
        reportType: reportDraft.reportType,
        spendMinor,
        summary
      });
      setReportDraft(emptyReportDraft());
      setActionMessage(`${labelReportType(reportDraft.reportType)} draft created for reporting queue.`);
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not create report draft.");
    } finally {
      setReportSaving(false);
    }
  }

  function updatePlacementDraft<K extends keyof PlacementDraft>(
    platform: string,
    key: K,
    value: PlacementDraft[K]
  ) {
    setPlacementDrafts((current) => ({
      ...current,
      [platform]: {
        ...(current[platform] ?? emptyPlacementDraft(campaign?.destinationUrl)),
        [key]: value
      }
    }));
  }

  async function savePlacements() {
    if (!campaign) {
      return;
    }

    const drafts = placementPlatforms
      .map((platform) => ({
        platform,
        draft: placementDrafts[platform] ?? emptyPlacementDraft(campaign.destinationUrl)
      }))
      .filter(({ draft }) =>
        [
          draft.adAccountId,
          draft.adSetId,
          draft.adUrl,
          draft.campaignExternalId,
          draft.launchDate,
          draft.notes,
          draft.spend
        ].some(
          (value) => value.trim().length > 0
        )
      );

    if (drafts.length === 0) {
      setActionError("Add at least one placement URL or external ID before saving.");
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setPlacementSaving(true);
    try {
      await Promise.all(
        drafts.map(({ draft, platform }) =>
          addAdminCampaignPlacement(campaign.id, {
            adAccountId: draft.adAccountId.trim(),
            adSetId: draft.adSetId.trim() || undefined,
            channel: platform,
            destinationUrl: draft.adUrl.trim() || campaign.destinationUrl,
            externalPlacementId: draft.campaignExternalId.trim() || undefined,
            launchDate: draft.launchDate,
            metadata: {
              adAccountId: draft.adAccountId.trim() || undefined,
              adSetId: draft.adSetId.trim() || undefined,
              clientVisible: draft.clientVisible,
              notes: draft.notes.trim(),
              platform,
              spend: draft.spend.trim()
            },
            notes: draft.notes.trim(),
            placementUrl: draft.adUrl.trim() || campaign.destinationUrl,
            provider: platform.toUpperCase(),
            spendMinor: Math.round(numericDraftValue(draft.spend) * 100)
          })
        )
      );
      setActionMessage("Placement links saved to the campaign activity trail.");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not save ad placement.");
    } finally {
      setPlacementSaving(false);
    }
  }

  return (
    <AdminCampaignOpsShell active="/campaign-ops/queue">
      {campaign ? (
        <StatusTransitionDialog
          campaignName={campaign.name}
          fromStatus={campaign.status}
          onCancel={() => setTransitionConfirmOpen(false)}
          onConfirm={() => void confirmStatusTransition()}
          open={transitionConfirmOpen}
          pending={transitionSaving}
          toStatus={selectedTransition}
        />
      ) : null}
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionLink
              href="/campaign-ops/queue"
              variant={hasCampaignId ? "secondary" : "primary"}
            >
              <ArrowLeft className="size-4 stroke-[1.5]" />
              Back to queue
            </ActionLink>
            {hasCampaignId ? (
              <>
                <Button variant="ghost">
                  <UserCheck className="size-4 stroke-[1.5]" />
                  Open client view
                </Button>
                <Button variant="secondary">
                  <BarChart3 className="size-4 stroke-[1.5]" />
                  Preview client report
                </Button>
                <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
                  <RefreshCw className="size-4 stroke-[1.5]" />
                  Refresh
                </Button>
              </>
            ) : null}
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Campaign workspace</Badge>
            {campaign ? <Badge tone="neutral">{campaign.ownerName}</Badge> : null}
          </>
        }
        title={hasCampaignId ? (campaign?.name ?? "Campaign detail") : "Open a campaign workspace"}
      />

      {hasCampaignId && error ? <ErrorBanner message={error} /> : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}
      {actionMessage ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-green)]/35 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-green)]">
          {actionMessage}
        </div>
      ) : null}

      {!hasCampaignId ? (
        <div className="mt-6 grid gap-4">
          <EmptyState
            detail="Open a campaign from the review queue so the workspace can load the brief, checklist, proof, metrics, and client timeline."
            title="Choose a campaign from the queue"
          />
        </div>
      ) : loading ? (
        <Panel className="mt-6 overflow-hidden">
          <LoadingRows count={5} />
        </Panel>
      ) : campaign === null ? (
        <div className="mt-6">
          <EmptyState
            detail="This campaign workspace could not be opened. Return to the queue and choose the item again, or refresh if it was just updated."
            title="Campaign detail unavailable"
          />
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status} />
              <PriorityBadge priority={campaign.priority} />
              {platforms.length > 0 ? (
                platforms.map((platform) => <PlatformChip key={platform} platform={platform} />)
              ) : (
                <PlatformChip platform={campaign.channel} />
              )}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-9">
              {[
                { detail: campaign.submittedAt, label: "Submitted" },
                { detail: campaign.updatedAt, label: "Review" },
                { detail: campaign.updatedAt, label: "Approved" },
                { detail: campaign.assignee, label: "Assigned" },
                { detail: campaign.workflowStage, label: "Creative" },
                { detail: `${campaign.launchedPlacementCount} launched`, label: "Launch" },
                {
                  detail: `${campaign.budgetUtilization}% allocation`,
                  label: "Optimize"
                },
                {
                  detail: `${campaign.reportCount} report${campaign.reportCount === 1 ? "" : "s"}`,
                  label: "Reporting"
                },
                {
                  detail: campaign.progress === 100 ? "Closed" : "Open",
                  label: "Complete"
                }
              ].map((step, index) => {
                const active = index === currentStatusIndex;
                const complete = index < currentStatusIndex;

                return (
                  <div className="relative grid gap-2" key={step.label}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-5 rounded-full border",
                          complete
                            ? "border-[var(--ft-green)] bg-[var(--ft-green)]"
                            : active
                              ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] shadow-[0_0_0_4px_rgba(232,146,58,0.15)]"
                              : "border-[var(--ft-border-strong)] bg-transparent"
                        )}
                      />
                      {index < 8 ? (
                        <span className="hidden h-px flex-1 bg-[var(--ft-border)] md:block" />
                      ) : null}
                    </div>
                    <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-secondary)] uppercase">
                      {step.label}
                    </div>
                    <div className="text-sm text-[var(--ft-text-muted)]">{step.detail}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Panel className="overflow-hidden">
              <div className="flex overflow-x-auto border-b border-[var(--ft-border)]">
                {workspaceTabs.map((tab) => (
                  <button
                    className={cn(
                      "flex h-12 items-center gap-2 border-b-2 px-4 text-sm font-medium transition focus:ring-2 focus:ring-[var(--ft-accent)] focus:outline-none",
                      activeTab === tab.id
                        ? "border-[var(--ft-accent)] text-[var(--ft-text-primary)]"
                        : "border-transparent text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
                    )}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                  >
                    <tab.icon className="size-4 stroke-[1.5]" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === "brief" ? (
                  <div className="grid gap-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                          Client brief and launch intent
                        </h2>
                        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                          {campaign.workspaceName} / {campaign.ownerName}
                        </p>
                      </div>
                      <Button className="h-9" variant="secondary">
                        Request Client Info
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <FieldRow label="Objective" value={campaign.objective} />
                      <FieldRow label="Budget" value={campaign.budget} />
                      <FieldRow label="Flight window" value={campaign.runWindow} />
                      <FieldRow label="Destination" value={campaign.destinationUrl} />
                      <FieldRow label="Submitted" value={campaign.submittedAt} />
                      <FieldRow label="Updated" value={campaign.updatedAt} />
                    </div>
                    <div className="border-t border-[var(--ft-border)] pt-4">
                      <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                        Ops notes
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                        {campaign.notes}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-[var(--ft-border)] pt-4">
                      {campaign.tags.length === 0 ? (
                        <Badge tone="neutral">No ops tags</Badge>
                      ) : (
                        campaign.tags.map((tag) => (
                          <Badge key={tag} tone="info">
                            {tag}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                {activeTab === "assets" ? (
                  <div className="grid gap-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                          Creative QA
                        </h2>
                        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                          Client uploads, placement requirements, and destination checks.
                        </p>
                      </div>
                      <Button className="h-9" variant="secondary">
                        <Paperclip className="size-4 stroke-[1.5]" />
                        Attach proof
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {platforms.length > 0 ? (
                        platforms.map((platform) => (
                          <ProofItem
                            detail="Client asset awaiting QA before manual platform build"
                            key={platform}
                            platform={platform}
                            title={`${platform} creative QA`}
                            type="file"
                          />
                        ))
                      ) : (
                        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-8 text-center text-sm text-[var(--ft-text-secondary)]">
                          Needs Action: no creative assets attached.
                        </div>
                      )}
                    </div>
                    <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3">
                      <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                        Destination URL
                      </div>
                      {destinationHref ? (
                        <a
                          className="mt-2 inline-flex items-center gap-2 text-sm break-all text-[var(--ft-accent)]"
                          href={destinationHref}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {campaign.destinationUrl}
                          <ExternalLink className="size-4 stroke-[1.5]" />
                        </a>
                      ) : (
                        <div className="mt-2 text-sm break-all text-[var(--ft-text-secondary)]">
                          {campaign.destinationUrl}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {activeTab === "metrics" ? (
                  <div className="grid gap-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                          Performance metrics
                        </h2>
                        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                          Manual numbers from Ads Manager for the client report.
                        </p>
                      </div>
                      <DeltaBadge
                        direction={
                          campaign.progress >= 75
                            ? "up"
                            : campaign.progress > 0
                              ? "neutral"
                              : "down"
                        }
                        value={`${campaign.progress}% fulfilled`}
                      />
                    </div>
                    <ProgressBar value={campaign.progress} />
                    <div className="grid gap-3 md:grid-cols-2">
                      {metricFields.map((field) => (
                        <label className="grid gap-1" key={field.key}>
                          <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                            {field.label}
                          </span>
                          <input
                            className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 font-mono text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                            inputMode="numeric"
                            onChange={(event) =>
                              setMetricsDraft((current) => ({
                                ...current,
                                [field.key]: event.target.value
                              }))
                            }
                            placeholder={field.placeholder}
                            value={metricsDraft[field.key]}
                          />
                        </label>
                      ))}
                    </div>
                    <label className="grid gap-1">
                      <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                        Client report notes
                      </span>
                      <textarea
                        className="min-h-24 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                        onChange={(event) =>
                          setMetricsDraft((current) => ({ ...current, notes: event.target.value }))
                        }
                        value={metricsDraft.notes}
                      />
                    </label>
                    <div>
                      <Button
                        disabled={metricsSaving}
                        onClick={() => void saveMetrics()}
                        type="button"
                      >
                        <BarChart3 className="size-4 stroke-[1.5]" />
                        {metricsSaving ? "Saving metrics" : "Save performance metrics"}
                      </Button>
                    </div>
                    <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-base font-medium text-[var(--ft-text-primary)]">
                            Reporting
                          </h3>
                          <div className="mt-1 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                            Daily / weekly / final
                          </div>
                        </div>
                        <Badge tone={canCreateReport ? "success" : "warning"}>
                          {canCreateReport ? "Launch verified" : "Launch required"}
                        </Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="grid gap-1">
                          <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                            Report type
                          </span>
                          <select
                            className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                            onChange={(event) =>
                              setReportDraft((current) => ({
                                ...current,
                                reportType: event.target.value as CampaignOpsReportType
                              }))
                            }
                            value={reportDraft.reportType}
                          >
                            {(["daily_update", "weekly_report", "final_report"] as const).map(
                              (type) => (
                                <option key={type} value={type}>
                                  {labelReportType(type)}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                        <label className="grid gap-1">
                          <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                            Period start
                          </span>
                          <input
                            className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 font-mono text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                            onChange={(event) =>
                              setReportDraft((current) => ({
                                ...current,
                                periodStart: event.target.value
                              }))
                            }
                            type="date"
                            value={reportDraft.periodStart}
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                            Period end
                          </span>
                          <input
                            className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 font-mono text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                            onChange={(event) =>
                              setReportDraft((current) => ({
                                ...current,
                                periodEnd: event.target.value
                              }))
                            }
                            type="date"
                            value={reportDraft.periodEnd}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1">
                        <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                          Report summary
                        </span>
                        <textarea
                          className="min-h-24 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] p-3 text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                          onChange={(event) =>
                            setReportDraft((current) => ({
                              ...current,
                              summary: event.target.value
                            }))
                          }
                          value={reportDraft.summary}
                        />
                      </label>
                      <div>
                        <Button
                          disabled={
                            reportSaving || !canCreateReport || reportDraft.summary.trim().length === 0
                          }
                          onClick={() => void createReportDraft()}
                          type="button"
                          variant="secondary"
                        >
                          <FileText className="size-4 stroke-[1.5]" />
                          {reportSaving ? "Creating report" : "Create report draft"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "proof" ? (
                  <div className="grid gap-5">
                    <div>
                      <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                        Placement proof
                      </h2>
                      <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                        Upload screenshots or paste ad links. Mark only approved proof as
                        client-visible for reports.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {(platforms.length > 0 ? platforms : [campaign.channel]).map((platform) => {
                        const draft =
                          placementDrafts[platform] ?? emptyPlacementDraft(campaign.destinationUrl);
                        const proofUrl = draft.adUrl.trim() || destinationHref;

                        return (
                          <div className="grid gap-2" key={platform}>
                            <ProofItem
                              detail={
                                draft.clientVisible
                                  ? "Client-visible proof selected for reports"
                                  : "Internal proof pending client visibility"
                              }
                              platform={platform}
                              title={`${platform} launch proof`}
                              type={proofUrl ? "url" : "image"}
                              {...(proofUrl ? { url: proofUrl } : {})}
                            />
                            <label className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-2 text-sm text-[var(--ft-text-secondary)]">
                              Client-visible
                              <input
                                checked={draft.clientVisible}
                                className="size-4 accent-[var(--ft-accent)]"
                                onChange={(event) =>
                                  updatePlacementDraft(
                                    platform,
                                    "clientVisible",
                                    event.target.checked
                                  )
                                }
                                type="checkbox"
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-8 text-center">
                      <Paperclip className="mx-auto size-7 stroke-[1.5] text-[var(--ft-text-muted)]" />
                      <div className="mt-3 text-sm font-medium text-[var(--ft-text-secondary)]">
                        Needs Action: attach launch proof before publishing the client report.
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "activity" ? (
                  <div className="grid gap-4">
                    {[
                      {
                        detail: "The client brief entered the managed ads review queue.",
                        timestamp: campaign.submittedAt,
                        title: `${campaign.ownerName} submitted client brief`,
                        type: "system" as const
                      },
                      {
                        detail: `Ops status is now ${labelStatus(campaign.status)}.`,
                        timestamp: campaign.updatedAt,
                        title: `${campaign.assignee} updated campaign status`,
                        type: "operator" as const
                      },
                      {
                        detail: campaign.nextAction,
                        timestamp: campaign.sla,
                        title: "Next action",
                        type: "milestone" as const
                      }
                    ].map((item) => (
                      <TimelineEvent
                        key={`${item.title}-${item.timestamp}`}
                        timestamp={item.timestamp}
                        title={item.title}
                        type={item.type}
                      >
                        {item.detail}
                      </TimelineEvent>
                    ))}
                  </div>
                ) : null}
              </div>
            </Panel>

            <aside className="grid gap-4 xl:sticky xl:top-[76px] xl:self-start">
              <Panel className="p-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                  <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                    Ops status
                  </h2>
                </div>
                <div className="mt-4">
                  <StatusBadge status={campaign.status} />
                </div>
                <label className="mt-4 grid gap-1">
                  <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                    Set next status
                  </span>
                  <select
                    className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                    onChange={(event) =>
                      setSelectedTransition(event.target.value as CampaignOpsStatus | "")
                    }
                    value={selectedTransition}
                  >
                    {transitionOptions[campaign.status]?.length ? (
                      transitionOptions[campaign.status]?.map((status) => (
                        <option key={status} value={status}>
                          {labelStatus(status)}
                        </option>
                      ))
                    ) : (
                      <option value="">No transition available</option>
                    )}
                  </select>
                </label>
                <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-accent)]/30 bg-[var(--ft-accent-subtle)] p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 stroke-[1.7] text-[var(--ft-accent)]" />
                    <div>
                      <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-primary)] uppercase">
                        Client impact check
                      </div>
                      <p className="mt-1 text-sm leading-5 text-[var(--ft-text-secondary)]">
                        Review the downstream client impact before changing this status. Completed,
                        blocked, or failed transitions should only happen after the next
                        client-visible update, proof, or report note is ready.
                      </p>
                    </div>
                  </div>
                </div>
                {transitionGuardMessage ? (
                  <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/35 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-red)]">
                    {transitionGuardMessage}
                  </div>
                ) : null}
                <Button
                  className="mt-4 w-full"
                  disabled={!selectedTransition || Boolean(transitionGuardMessage)}
                  onClick={() => setTransitionConfirmOpen(true)}
                  type="button"
                >
                  Review Status Change
                </Button>
              </Panel>

              <Panel className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                  <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                    Launch checklist
                  </h2>
                </div>
                <p className="mt-2 text-sm leading-5 text-[var(--ft-text-secondary)]">
                  Complete these before moving the campaign to launch or report-ready states.
                </p>
                <div className="mt-4">
                  <OpsTaskChecklist items={opsChecklistItems} />
                </div>
              </Panel>

              <Panel className="p-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                  <h2 className="text-base font-medium text-[var(--ft-text-primary)]">Ops owner</h2>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] font-mono text-[11px] text-[var(--ft-text-primary)] uppercase">
                      {campaign.assignee.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--ft-text-primary)]">
                        {campaign.assignee}
                      </div>
                      <div className="mt-1 text-sm text-[var(--ft-text-muted)]">{campaign.sla}</div>
                    </div>
                  </div>
                  <Button className="h-8 px-3 text-xs" type="button" variant="ghost">
                    Reassign owner
                  </Button>
                </div>
              </Panel>

              <Panel className="p-4">
                <div className="flex items-center gap-2">
                  <ExternalLink className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                  <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                    Placement links
                  </h2>
                </div>
                <div className="mt-4 grid gap-4">
                  {placementPlatforms.map((platform) => (
                    <div
                      className="grid gap-2 border-t border-[var(--ft-border)] pt-4"
                      key={platform}
                    >
                      <PlatformChip platform={platform} />
                      {placementFields.map((field) => (
                        <label className="grid gap-1" key={field.key}>
                          <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                            {field.label}
                          </span>
                          <input
                            className="h-9 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 font-mono text-[12px] text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)]"
                            inputMode={field.inputMode}
                            onChange={(event) =>
                              updatePlacementDraft(platform, field.key, event.target.value)
                            }
                            placeholder={field.placeholder}
                            type={field.type ?? "text"}
                            value={
                              placementDrafts[platform]?.[field.key] ??
                              emptyPlacementDraft(campaign.destinationUrl)[field.key]
                            }
                          />
                        </label>
                      ))}
                      <label className="mt-1 flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-sm text-[var(--ft-text-secondary)]">
                        Client-visible placement proof
                        <input
                          checked={placementDrafts[platform]?.clientVisible ?? false}
                          className="size-4 accent-[var(--ft-accent)]"
                          onChange={(event) =>
                            updatePlacementDraft(platform, "clientVisible", event.target.checked)
                          }
                          type="checkbox"
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <Button
                  className="mt-4 w-full"
                  disabled={placementSaving}
                  onClick={() => void savePlacements()}
                  type="button"
                  variant="secondary"
                >
                  {placementSaving ? "Saving placement links" : "Save placement links"}
                </Button>
              </Panel>

              <Panel className="p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                  <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                    Internal ops notes
                  </h2>
                </div>
                <div className="mt-4">
                  <OperatorNote author="Internal ops" timestamp={campaign.updatedAt}>
                    {campaign.notes}
                  </OperatorNote>
                </div>
                <textarea
                  className="mt-3 min-h-24 w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)] focus:ring-2 focus:ring-[var(--ft-accent)]"
                  onChange={(event) => setInternalNoteText(event.target.value)}
                  placeholder="Add internal ops note"
                  value={internalNoteText}
                />
                <Button
                  className="mt-3 w-full"
                  disabled={noteSaving || internalNoteText.trim().length === 0}
                  onClick={() => void postInternalNote()}
                  type="button"
                  variant="secondary"
                >
                  {noteSaving ? "Saving note" : "Save internal ops note"}
                </Button>
              </Panel>

              <Panel className="p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                  <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                    Client-visible timeline
                  </h2>
                </div>
                <p className="mt-2 text-sm leading-5 text-[var(--ft-text-secondary)]">
                  Post a clear human update that appears on the client's campaign timeline.
                </p>
                <label className="mt-4 grid gap-1">
                  <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                    Post client-visible update
                  </span>
                  <textarea
                    className="min-h-24 w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)] focus:ring-2 focus:ring-[var(--ft-accent)]"
                    onChange={(event) => setClientUpdateText(event.target.value)}
                    placeholder="Your campaign assets have passed review. The Fliptrybe team is preparing launch setup and will share proof once the campaign is live."
                    value={clientUpdateText}
                  />
                </label>
                <Button
                  className="mt-3 w-full"
                  disabled={clientUpdateSaving || clientUpdateText.trim().length === 0}
                  onClick={() => void postClientUpdate()}
                  type="button"
                >
                  {clientUpdateSaving ? "Posting update" : "Post Client-Visible Update"}
                </Button>
                <div className="mt-4 grid gap-4">
                  {clientTimelineUpdates.length === 0 ? (
                    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm text-[var(--ft-text-muted)]">
                      No client-visible updates posted in this session.
                    </div>
                  ) : (
                    clientTimelineUpdates.map((update) => (
                      <TimelineEvent
                        key={update.id}
                        timestamp={`Prepared ${update.timestamp}`}
                        title="Client-visible update"
                        type="operator"
                      >
                        {update.text}
                      </TimelineEvent>
                    ))
                  )}
                </div>
              </Panel>
            </aside>
          </section>
        </>
      )}
    </AdminCampaignOpsShell>
  );
}
