"use client";

import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  Image,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Badge, Button, MobileAdminCard, OpsTaskChecklist, PlatformChip, cn } from "@fliptrybe/ui";

import {
  addAdminCampaignNote,
  bulkAdminCampaignAction,
  loadAdminCampaignLaunchSpec,
  updateAdminCampaignAssignment,
  updateAdminCampaignStatus,
  type CampaignLaunchSpec
} from "../api";
import {
  AdminCampaignOpsHeader,
  AdminCampaignOpsShell,
  EmptyState,
  ErrorBanner,
  LoadingRows,
  PriorityBadge,
  ProgressBar,
  StatusBadge
} from "../components";
import { campaignOpsStatuses, type CampaignOpsCampaign, type CampaignOpsStatus } from "../data";
import { useAdminCampaignOpsQueueData } from "../use-admin-campaign-ops-data";

type StatusFilter = CampaignOpsStatus | "all";
type ReviewActionMode = "changes" | "reject" | "approve" | null;
type SortDirection = "oldest" | "newest";
type QueueConfirmation = {
  action: "reject";
  confirmLabel: string;
  detail: string;
  severity: "danger" | "warning";
  title: string;
} | null;
const defaultAssigneeFilter = "unassigned-first";

const commonChangeReasons = [
  "Brief needs more detail",
  "Creative assets missing",
  "Budget or schedule needs update",
  "Target audience needs detail"
];

const briefReviewChecks = [
  "Campaign objective is clear enough for setup",
  "Destination URL opens and matches the offer",
  "Budget and flight window are ready for launch",
  "Audience notes can be translated into platform targeting",
  "Creative assets match the requested placements"
];

function labelStatus(statusValue: CampaignOpsStatus | "all") {
  if (statusValue === "all") {
    return "All statuses";
  }

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

  return labels[statusValue];
}

function splitPlatforms(channel: string) {
  return channel
    .split(/[,/&+]+|\band\b/i)
    .map((platform) => platform.trim())
    .filter(Boolean);
}

function PlatformChips({ channel }: { channel: string }) {
  const platforms = splitPlatforms(channel);
  const chips = platforms.length > 0 ? platforms : [channel];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((platform) => (
        <PlatformChip key={platform} platform={platform} />
      ))}
    </div>
  );
}

function parseDateValue(value: string) {
  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareSubmittedAt(
  left: CampaignOpsCampaign,
  right: CampaignOpsCampaign,
  direction: SortDirection
) {
  const leftTimestamp = parseDateValue(left.submittedAt);
  const rightTimestamp = parseDateValue(right.submittedAt);

  if (leftTimestamp === null && rightTimestamp === null) {
    return left.name.localeCompare(right.name);
  }
  if (leftTimestamp === null) {
    return 1;
  }
  if (rightTimestamp === null) {
    return -1;
  }

  return direction === "oldest" ? leftTimestamp - rightTimestamp : rightTimestamp - leftTimestamp;
}

function queueAgeHours(submittedAt: string) {
  const timestamp = parseDateValue(submittedAt);

  if (timestamp === null) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
}

function queueAgeLabel(submittedAt: string) {
  const hours = queueAgeHours(submittedAt);

  if (hours === null) {
    return submittedAt;
  }
  if (hours < 1) {
    return "new";
  }
  if (hours < 24) {
    return `${hours}h waiting`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ${hours % 24}h waiting`;
}

function isOverQueueSla(submittedAt: string) {
  const hours = queueAgeHours(submittedAt);

  return hours !== null && hours >= 24;
}

function isUnassigned(assignee: string) {
  return assignee.trim().toLowerCase() === "unassigned";
}

function hasReadyValue(value: string) {
  return value.trim().length > 0 && !value.toLowerCase().includes("needs action");
}

function isFlaggedCampaign(campaign: CampaignOpsCampaign) {
  return (
    campaign.status === "blocked" || campaign.status === "failed" || campaign.priority === "urgent"
  );
}

function isUrgentCampaign(campaign: CampaignOpsCampaign) {
  return (
    isFlaggedCampaign(campaign) ||
    campaign.priority === "high" ||
    isOverQueueSla(campaign.submittedAt) ||
    isUnassigned(campaign.assignee)
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SignalCard({
  detail,
  icon,
  label,
  tone = "neutral",
  value
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone?: "neutral" | "warning" | "danger";
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] bg-[var(--ft-bg-surface)] p-4",
        tone === "warning" ? "shadow-[inset_2px_0_0_var(--ft-accent)]" : "",
        tone === "danger" ? "shadow-[inset_2px_0_0_var(--ft-red)]" : ""
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
          {label}
        </div>
        <span
          className={cn(
            "text-[var(--ft-text-muted)]",
            tone === "warning" ? "text-[var(--ft-accent)]" : "",
            tone === "danger" ? "text-[var(--ft-red)]" : ""
          )}
        >
          {icon}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 font-mono text-2xl font-medium text-[var(--ft-text-primary)]",
          tone === "warning" ? "text-[var(--ft-accent)]" : "",
          tone === "danger" ? "text-[var(--ft-red)]" : ""
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">{detail}</div>
    </div>
  );
}

function AssignmentChip({ assignee }: { assignee: string }) {
  if (isUnassigned(assignee)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--ft-accent)]/40 bg-[var(--ft-accent-subtle)] px-2 py-1 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-accent)] uppercase">
        <AlertTriangle className="size-3.5 stroke-[1.5]" />
        Unassigned
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 py-1 text-xs text-[var(--ft-text-primary)]">
      <span className="grid size-5 place-items-center rounded-full bg-[var(--ft-bg-raised)] font-mono text-[9px] text-[var(--ft-text-secondary)] uppercase">
        {initials(assignee)}
      </span>
      {assignee}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--ft-border)] py-3 last:border-b-0">
      <dt className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium break-words text-[var(--ft-text-primary)]">{value}</dd>
    </div>
  );
}

function ConfirmationDialog({
  confirmation,
  onCancel,
  onConfirm
}: {
  confirmation: QueueConfirmation;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirmation) {
    return null;
  }

  const danger = confirmation.severity === "danger";

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="queue-confirmation-title"
    >
      <div className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start gap-3 border-b border-[var(--ft-border)] p-4">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border",
              danger
                ? "border-[var(--ft-red)]/45 bg-[var(--ft-red-subtle)] text-[var(--ft-red)]"
                : "border-[var(--ft-accent)]/45 bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
            )}
          >
            <ShieldAlert className="size-5 stroke-[1.5]" />
          </div>
          <div>
            <h2
              id="queue-confirmation-title"
              className="text-base font-semibold text-[var(--ft-text-primary)]"
            >
              {confirmation.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
              {confirmation.detail}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} type="button" variant={danger ? "danger" : "primary"}>
            {confirmation.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCampaignOpsQueuePage() {
  const router = useRouter();
  const { error, items, loading, refresh, source } = useAdminCampaignOpsQueueData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [channel, setChannel] = useState("all");
  const [assignee, setAssignee] = useState(defaultAssigneeFilter);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("oldest");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ReviewActionMode>(null);
  const [confirmation, setConfirmation] = useState<QueueConfirmation>(null);
  const [changeMessage, setChangeMessage] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string>();
  const [actionMessage, setActionMessage] = useState<string>();
  const [actionSaving, setActionSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string>();
  const [launchSpec, setLaunchSpec] = useState<CampaignLaunchSpec>();
  const [launchSpecLoading, setLaunchSpecLoading] = useState(false);
  const [launchSpecError, setLaunchSpecError] = useState<string>();

  const channelOptions = useMemo(
    () => Array.from(new Set(items.map((campaign) => campaign.channel))).sort(),
    [items]
  );
  const assigneeOptions = useMemo(
    () => Array.from(new Set(items.map((campaign) => campaign.assignee))).sort(),
    [items]
  );
  const assigneeWorkloads = useMemo(() => {
    return items.reduce<Record<string, number>>((workloads, campaign) => {
      if (!isUnassigned(campaign.assignee)) {
        workloads[campaign.assignee] = (workloads[campaign.assignee] ?? 0) + 1;
      }

      return workloads;
    }, {});
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedSubmitted = submittedQuery.trim().toLowerCase();

    return items
      .filter((campaign) => {
        const matchesStatus = status === "all" || campaign.status === status;
        const matchesChannel = channel === "all" || campaign.channel === channel;
        const matchesAssignee =
          assignee === defaultAssigneeFilter ||
          assignee === "all" ||
          campaign.assignee === assignee;
        const matchesSubmitted =
          normalizedSubmitted.length === 0 ||
          campaign.submittedAt.toLowerCase().includes(normalizedSubmitted);
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [
            campaign.id,
            campaign.name,
            campaign.workspaceName,
            campaign.ownerName,
            campaign.channel,
            campaign.assignee,
            campaign.objective,
            campaign.nextAction
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);

        return (
          matchesStatus && matchesChannel && matchesAssignee && matchesSubmitted && matchesQuery
        );
      })
      .sort((left, right) => {
        const leftUnassigned = isUnassigned(left.assignee);
        const rightUnassigned = isUnassigned(right.assignee);

        if (leftUnassigned !== rightUnassigned) {
          return leftUnassigned ? -1 : 1;
        }

        return compareSubmittedAt(left, right, sortDirection);
      });
  }, [assignee, channel, items, query, sortDirection, status, submittedQuery]);

  const selectedCampaign =
    filteredItems.find((campaign) => campaign.id === selectedCampaignId) ??
    filteredItems[0] ??
    null;
  const oldestCampaign = useMemo(() => {
    return (
      [...filteredItems].sort((left, right) => compareSubmittedAt(left, right, "oldest"))[0] ?? null
    );
  }, [filteredItems]);
  const queueSignals = useMemo(() => {
    const overSla = items.filter((campaign) => isOverQueueSla(campaign.submittedAt)).length;
    const unassignedCount = items.filter((campaign) => isUnassigned(campaign.assignee)).length;
    const urgentCount = items.filter(isUrgentCampaign).length;

    return { overSla, unassignedCount, urgentCount };
  }, [items]);
  const assignmentOptions = useMemo(() => {
    const assignedOperators = Object.keys(assigneeWorkloads).sort();

    return [
      { label: "Assign to me - personal queue", value: "me" },
      ...assignedOperators.map((operator) => ({
        label: `${operator} - ${assigneeWorkloads[operator]} active`,
        value: operator
      }))
    ];
  }, [assigneeWorkloads]);
  const filtersActive =
    query.trim().length > 0 ||
    status !== "all" ||
    channel !== "all" ||
    assignee !== defaultAssigneeFilter ||
    submittedQuery.trim().length > 0;

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setChannel("all");
    setAssignee(defaultAssigneeFilter);
    setSubmittedQuery("");
  }

  function selectCampaign(campaignId: string) {
    setSelectedCampaignId(campaignId);
    setActionMode(null);
    setConfirmation(null);
    setLaunchSpec(undefined);
    setLaunchSpecError(undefined);
  }

  function openCampaign(campaignId: string) {
    router.push(`/campaign-ops/detail?campaignId=${encodeURIComponent(campaignId)}`);
  }

  function toggleSelected(campaignId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  }

  async function runBulkAction(
    action: "approve" | "reject" | "assign_me",
    reason?: string
  ) {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    setBulkError(undefined);
    try {
      const ids = [...selectedIds];
      if (action === "approve") {
        await bulkAdminCampaignAction(ids, { action: "status", payload: { status: "APPROVED" } });
      } else if (action === "reject") {
        await bulkAdminCampaignAction(ids, {
          action: "status",
          payload: { status: "REJECTED", ...(reason ? { reason } : {}) }
        });
      } else {
        await bulkAdminCampaignAction(ids, { action: "assign", payload: { role: "OPERATOR" } });
      }
      setSelectedIds(new Set());
      await refresh();
    } catch (caught) {
      setBulkError(caught instanceof Error ? caught.message : "Could not apply this action to the selection.");
    } finally {
      setBulkSaving(false);
    }
  }

  async function viewLaunchSpec() {
    if (!selectedCampaign) return;
    setLaunchSpecLoading(true);
    setLaunchSpecError(undefined);
    try {
      setLaunchSpec(await loadAdminCampaignLaunchSpec(selectedCampaign.id));
    } catch (caught) {
      setLaunchSpecError(
        caught instanceof Error ? caught.message : "Could not build a launch spec for this campaign."
      );
    } finally {
      setLaunchSpecLoading(false);
    }
  }

  async function requestChanges() {
    if (!selectedCampaign) {
      return;
    }

    const body = changeMessage.trim();
    if (!body) {
      setActionError("Add a client-visible info request before sending this back.");
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setActionSaving(true);
    try {
      await addAdminCampaignNote(selectedCampaign.id, { body, visibility: "CLIENT_VISIBLE" });
      await updateAdminCampaignStatus(
        selectedCampaign.id,
        "CHANGES_REQUESTED",
        "Client info requested by campaign ops."
      );
      setChangeMessage("");
      setActionMode(null);
      setActionMessage("Client info request sent and logged on the campaign.");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not request client info.");
    } finally {
      setActionSaving(false);
    }
  }

  async function rejectCampaign() {
    if (!selectedCampaign) {
      return;
    }

    const reason = rejectReason.trim();
    if (!reason) {
      setActionError("Add a client-visible decline reason before closing this brief.");
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setActionSaving(true);
    try {
      await addAdminCampaignNote(selectedCampaign.id, {
        body: reason,
        visibility: "CLIENT_VISIBLE"
      });
      await updateAdminCampaignStatus(selectedCampaign.id, "REJECTED", reason);
      setRejectReason("");
      setActionMode(null);
      setConfirmation(null);
      setActionMessage("Campaign brief declined and the client-visible reason was saved.");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not reject campaign.");
    } finally {
      setActionSaving(false);
    }
  }

  async function approveCampaign() {
    if (!selectedCampaign) {
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setActionSaving(true);
    try {
      await updateAdminCampaignStatus(
        selectedCampaign.id,
        "APPROVED",
        "Brief approved for setup by campaign ops."
      );
      await updateAdminCampaignAssignment(selectedCampaign.id, { role: "OPERATOR" });
      setActionMode(null);
      setActionMessage("Campaign approved for setup and assigned to your operator queue.");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not approve campaign.");
    } finally {
      setActionSaving(false);
    }
  }

  async function assignCampaignToMe() {
    if (!selectedCampaign) {
      return;
    }

    setActionError(undefined);
    setActionMessage(undefined);
    setActionSaving(true);
    try {
      await updateAdminCampaignAssignment(selectedCampaign.id, { role: "OPERATOR" });
      setActionMessage("Campaign assigned to your operator queue for setup follow-up.");
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not assign campaign.");
    } finally {
      setActionSaving(false);
    }
  }

  return (
    <AdminCampaignOpsShell active="/campaign-ops/queue">
      <ConfirmationDialog
        confirmation={confirmation}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation?.action === "reject") {
            void rejectCampaign();
          }
        }}
      />
      <AdminCampaignOpsHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Review queue</Badge>
            <Badge tone={source === "api" ? "success" : "neutral"}>Live workspace</Badge>
            <Badge tone="neutral">{filteredItems.length} need action</Badge>
          </>
        }
        title="Needs Action Queue"
      />

      {error ? <ErrorBanner message={error} /> : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}
      {actionMessage ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-green)]/35 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-green)]">
          {actionMessage}
        </div>
      ) : null}

      <section className="mt-5 grid gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 lg:grid-cols-[minmax(220px,1.2fr)_repeat(4,minmax(150px,0.7fr))_auto]">
        <label className="flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)] focus-within:ring-2 focus-within:ring-[var(--ft-accent)]">
          <Search className="size-4 stroke-[1.5]" />
          <input
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search needs-action queue"
            value={query}
          />
        </label>
        <label className="flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)] focus-within:ring-2 focus-within:ring-[var(--ft-accent)]">
          <Filter className="size-4 stroke-[1.5]" />
          <select
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none"
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            value={status}
          >
            <option value="all">All statuses</option>
            {campaignOpsStatuses.map((item) => (
              <option key={item} value={item}>
                {labelStatus(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)] focus-within:ring-2 focus-within:ring-[var(--ft-accent)]">
          <select
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none"
            onChange={(event) => setChannel(event.target.value)}
            value={channel}
          >
            <option value="all">All platforms</option>
            {channelOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)] focus-within:ring-2 focus-within:ring-[var(--ft-accent)]">
          <select
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none"
            onChange={(event) => setAssignee(event.target.value)}
            value={assignee}
          >
            <option value="all">All assignees</option>
            <option value={defaultAssigneeFilter}>Unassigned first</option>
            {assigneeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-secondary)] focus-within:ring-2 focus-within:ring-[var(--ft-accent)]">
          <input
            className="w-full bg-transparent text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)]"
            onChange={(event) => setSubmittedQuery(event.target.value)}
            placeholder="Date submitted"
            value={submittedQuery}
          />
        </label>
        <Button
          className="h-10 px-3 text-xs"
          disabled={!filtersActive}
          onClick={clearFilters}
          type="button"
          variant="ghost"
        >
          <X className="size-3.5 stroke-[1.5]" />
          Clear
        </Button>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          detail={
            oldestCampaign
              ? `Oldest is ${queueAgeLabel(oldestCampaign.submittedAt)}`
              : "No active review wait"
          }
          icon={<Clock3 className="size-4 stroke-[1.5]" />}
          label="Needs action"
          tone={items.length > 0 ? "warning" : "neutral"}
          value={String(items.length)}
        />
        <SignalCard
          detail="Client handoffs waiting over 24h"
          icon={<AlertTriangle className="size-4 stroke-[1.5]" />}
          label="SLA watch"
          tone={queueSignals.overSla > 0 ? "warning" : "neutral"}
          value={String(queueSignals.overSla)}
        />
        <SignalCard
          detail="Assign before approval"
          icon={<UserCheck className="size-4 stroke-[1.5]" />}
          label="Unassigned"
          tone={queueSignals.unassignedCount > 0 ? "warning" : "neutral"}
          value={String(queueSignals.unassignedCount)}
        />
        <SignalCard
          detail="Blocked, urgent, or ownerless"
          icon={<ShieldAlert className="size-4 stroke-[1.5]" />}
          label="Priority risk"
          tone={queueSignals.urgentCount > 0 ? "danger" : "neutral"}
          value={String(queueSignals.urgentCount)}
        />
      </section>

      <section className="mt-5 grid min-h-[720px] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
          <div className="border-b border-[var(--ft-border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-[var(--ft-text-primary)]">
                  Needs action list
                </h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  Unassigned briefs stay first by default. {filteredItems.length} need action
                  {oldestCampaign
                    ? ` - oldest is ${queueAgeLabel(oldestCampaign.submittedAt)}`
                    : ""}
                </p>
              </div>
              <Button
                className="h-8 px-2 text-xs"
                onClick={() =>
                  setSortDirection((current) => (current === "oldest" ? "newest" : "oldest"))
                }
                type="button"
                variant="secondary"
              >
                <ArrowUpDown className="size-3.5 stroke-[1.5]" />
                {sortDirection === "oldest" ? "Oldest" : "Newest"}
              </Button>
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ft-border)] bg-[var(--ft-accent-subtle)] p-3">
              <span className="text-xs font-medium text-[var(--ft-text-primary)]">
                {selectedIds.size} selected
              </span>
              <Button
                className="h-8 px-2 text-xs"
                disabled={bulkSaving}
                onClick={() => void runBulkAction("approve")}
                type="button"
                variant="secondary"
              >
                Approve
              </Button>
              <Button
                className="h-8 px-2 text-xs"
                disabled={bulkSaving}
                onClick={() => void runBulkAction("reject", "Bulk rejected by operator")}
                type="button"
                variant="secondary"
              >
                Reject
              </Button>
              <Button
                className="h-8 px-2 text-xs"
                disabled={bulkSaving}
                onClick={() => void runBulkAction("assign_me")}
                type="button"
                variant="secondary"
              >
                Assign to me
              </Button>
              <button
                className="ml-auto text-xs text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
                onClick={() => setSelectedIds(new Set())}
                type="button"
              >
                Clear
              </button>
              {bulkError ? <div className="w-full text-xs text-[var(--ft-red)]">{bulkError}</div> : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <LoadingRows count={6} />
            ) : filteredItems.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  detail={
                    items.length === 0
                      ? "New submissions that need operator action will appear here."
                      : "No campaign work items match the current filters."
                  }
                  title={
                    items.length === 0 ? "No campaigns need action" : "Nothing matches this view"
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-[var(--ft-border)]">
                {filteredItems.map((campaign) => {
                  const selected = selectedCampaign?.id === campaign.id;
                  const overSla = isOverQueueSla(campaign.submittedAt);
                  const unassigned = isUnassigned(campaign.assignee);
                  const flagged = isFlaggedCampaign(campaign);

                  return (
                    <div key={campaign.id}>
                      <MobileAdminCard
                        action={
                          <Button
                            className="w-full"
                            onClick={() => selectCampaign(campaign.id)}
                            type="button"
                            variant={selected ? "primary" : "secondary"}
                          >
                            {selected ? "Viewing brief" : "Review brief"}
                          </Button>
                        }
                        meta={[
                          { label: "Campaign", value: campaign.name },
                          {
                            label: "Platform",
                            value: <PlatformChips channel={campaign.channel} />
                          },
                          { label: "Age", value: queueAgeLabel(campaign.submittedAt) },
                          {
                            label: "Owner",
                            value: unassigned ? (
                              <AssignmentChip assignee={campaign.assignee} />
                            ) : (
                              campaign.assignee
                            )
                          }
                        ]}
                        status={
                          <div className="flex flex-wrap justify-end gap-2">
                            <StatusBadge status={campaign.status} />
                            <PriorityBadge priority={campaign.priority} />
                          </div>
                        }
                        title={campaign.ownerName}
                      />
                      <div className="hidden items-stretch md:flex">
                        <label
                          className="flex w-10 shrink-0 items-center justify-center border-l-2 border-l-transparent"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            checked={selectedIds.has(campaign.id)}
                            className="size-4 accent-[var(--ft-accent)]"
                            onChange={() => toggleSelected(campaign.id)}
                            type="checkbox"
                          />
                        </label>
                        <button
                          className={cn(
                            "grid w-full gap-3 border-l-2 border-l-transparent px-4 py-4 text-left transition hover:bg-[var(--ft-bg-muted)] focus:bg-[var(--ft-bg-muted)] focus:ring-2 focus:ring-[var(--ft-accent)] focus:outline-none focus:ring-inset",
                            selected ? "border-l-[var(--ft-accent)] bg-[var(--ft-bg-muted)]" : "",
                            !selected && flagged ? "bg-[var(--ft-red-subtle)]/30" : "",
                            !selected && !flagged && (overSla || unassigned)
                              ? "bg-[var(--ft-accent-subtle)]/40"
                              : ""
                          )}
                          onClick={() => selectCampaign(campaign.id)}
                          type="button"
                        >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[var(--ft-text-primary)]">
                              {campaign.ownerName}
                            </div>
                            <div className="mt-1 truncate text-sm text-[var(--ft-text-secondary)]">
                              {campaign.name}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase",
                              overSla ? "text-[var(--ft-accent)]" : ""
                            )}
                          >
                            {queueAgeLabel(campaign.submittedAt)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <PlatformChips channel={campaign.channel} />
                          <PriorityBadge priority={campaign.priority} />
                          {unassigned ? <AssignmentChip assignee={campaign.assignee} /> : null}
                        </div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-[640px] flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]">
          {loading ? (
            <LoadingRows count={8} />
          ) : selectedCampaign === null ? (
            <div className="grid min-h-[640px] place-items-center p-6">
              <EmptyState
                detail={
                  items.length === 0
                    ? "New submissions that need operator action will appear here."
                    : "Adjust the filters to bring campaigns back into the workspace."
                }
                title={items.length === 0 ? "No campaigns need action" : "No work item selected"}
              />
            </div>
          ) : (
            <>
              <header className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedCampaign.status} />
                      <PriorityBadge priority={selectedCampaign.priority} />
                      <PlatformChips channel={selectedCampaign.channel} />
                    </div>
                    <h2 className="mt-4 text-xl leading-7 font-semibold text-[var(--ft-text-primary)]">
                      {selectedCampaign.name}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                      {selectedCampaign.ownerName} / {selectedCampaign.workspaceName}
                    </p>
                  </div>
                  <div className="grid gap-2 lg:min-w-56 lg:justify-items-end">
                    <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                      Submitted {selectedCampaign.submittedAt}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <AssignmentChip assignee={selectedCampaign.assignee} />
                      {isUnassigned(selectedCampaign.assignee) ? (
                        <button
                          className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-accent)] uppercase underline-offset-4 hover:underline"
                          disabled={actionSaving}
                          onClick={() => void assignCampaignToMe()}
                          type="button"
                        >
                          {actionSaving ? "Assigning" : "Assign to me"}
                        </button>
                      ) : null}
                    </div>
                    <Button
                      className="h-8 px-3 text-xs"
                      disabled={launchSpecLoading}
                      onClick={() => void viewLaunchSpec()}
                      type="button"
                      variant="ghost"
                    >
                      {launchSpecLoading ? "Building..." : "Launch spec"}
                    </Button>
                    <Button
                      className="h-8 px-3 text-xs"
                      onClick={() => openCampaign(selectedCampaign.id)}
                      type="button"
                      variant="ghost"
                    >
                      <ExternalLink className="size-3.5 stroke-[1.5]" />
                      Open ops workspace
                    </Button>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="grid gap-5">
                    {launchSpecError ? (
                      <div className="rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-4 text-sm text-[var(--ft-red)]">
                        {launchSpecError}
                      </div>
                    ) : null}

                    {launchSpec ? (
                      <section className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-base font-medium text-[var(--ft-text-primary)]">
                            {launchSpec.platform} launch spec — "{launchSpec.campaign.name}"
                          </h3>
                          <button
                            className="text-xs text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
                            onClick={() => setLaunchSpec(undefined)}
                            type="button"
                          >
                            Close
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
                          There's no live platform integration yet — follow these steps by hand in
                          Ads Manager, then mark this campaign launched once it's live.
                        </p>
                        {launchSpec.warnings.length > 0 ? (
                          <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] p-3 text-xs text-[var(--ft-yellow)]">
                            {launchSpec.warnings.join(" ")}
                          </div>
                        ) : null}
                        <ol className="mt-4 grid gap-2 text-sm text-[var(--ft-text-secondary)]">
                          {launchSpec.copyInstructions.map((step, index) => (
                            <li className="flex gap-3" key={index}>
                              <span className="shrink-0 font-mono text-xs text-[var(--ft-text-muted)]">
                                {index + 1}.
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </section>
                    ) : null}

                    <section className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5">
                      <div className="flex items-center gap-2">
                        <Image className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                        <h3 className="text-base font-medium text-[var(--ft-text-primary)]">
                          Creative QA
                        </h3>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {(splitPlatforms(selectedCampaign.channel).length > 0
                          ? splitPlatforms(selectedCampaign.channel)
                          : [selectedCampaign.channel]
                        ).map((platform) => (
                          <div
                            className="aspect-video rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3"
                            key={platform}
                          >
                            <div className="flex h-full flex-col justify-between">
                              <Image className="size-6 stroke-[1.5] text-[var(--ft-text-muted)]" />
                              <div>
                                <div className="text-sm font-medium text-[var(--ft-text-primary)]">
                                  {platform} creative
                                </div>
                                <div className="mt-1 font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                                  Client asset awaiting QA
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5">
                      <div className="flex items-center gap-2">
                        <FileText className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                        <h3 className="text-base font-medium text-[var(--ft-text-primary)]">
                          Brief and launch copy
                        </h3>
                      </div>
                      <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4 font-mono text-[12px] leading-6 text-[var(--ft-text-secondary)]">
                        <div>Objective: {selectedCampaign.objective}</div>
                        <div>Needs action: {selectedCampaign.nextAction}</div>
                        <div>Operator note: {selectedCampaign.notes}</div>
                      </div>
                    </section>

                    <section className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                        <h3 className="text-base font-medium text-[var(--ft-text-primary)]">
                          Launch readiness checks
                        </h3>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                        Use this before approval. Anything unchecked should become a client info
                        request or an internal handoff note.
                      </p>
                      <div className="mt-4">
                        <OpsTaskChecklist
                          items={briefReviewChecks.map((check) => ({
                            done: check.includes("objective")
                              ? hasReadyValue(selectedCampaign.objective)
                              : check.includes("Destination")
                                ? hasReadyValue(selectedCampaign.destinationUrl)
                                : check.includes("Budget")
                                  ? hasReadyValue(selectedCampaign.budget) &&
                                    hasReadyValue(selectedCampaign.runWindow)
                                  : check.includes("Audience")
                                    ? hasReadyValue(selectedCampaign.notes)
                                    : selectedCampaign.tags.length > 0 ||
                                      selectedCampaign.progress > 0,
                            label: check
                          }))}
                        />
                      </div>
                    </section>
                  </div>

                  <aside className="grid content-start gap-5">
                    <section className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5">
                      <h3 className="text-base font-medium text-[var(--ft-text-primary)]">
                        Targeting and setup
                      </h3>
                      <dl className="mt-2">
                        <DetailRow label="Budget" value={selectedCampaign.budget} />
                        <DetailRow label="Flight" value={selectedCampaign.runWindow} />
                        <DetailRow label="Destination" value={selectedCampaign.destinationUrl} />
                        <DetailRow label="SLA target" value={selectedCampaign.sla} />
                        <DetailRow label="Risk" value={selectedCampaign.risk} />
                        <DetailRow
                          label="Tags"
                          value={
                            selectedCampaign.tags.length > 0
                              ? selectedCampaign.tags.join(", ")
                              : "No tags added"
                          }
                        />
                      </dl>
                    </section>

                    <section className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5">
                      <h3 className="text-base font-medium text-[var(--ft-text-primary)]">
                        Assignment
                      </h3>
                      <div className="mt-4">
                        <AssignmentChip assignee={selectedCampaign.assignee} />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
                        Unassigned campaigns are priority risk. Assign an owner before approval so
                        setup, client follow-up, and launch proof have a clear handoff.
                      </p>
                      <div className="mt-4">
                        <ProgressBar value={selectedCampaign.progress} />
                      </div>
                    </section>

                    <details className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-5">
                      <summary className="cursor-pointer font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                        Internal ops context - hidden from client
                      </summary>
                      <div className="mt-4 rounded-[var(--radius-sm)] border-l-2 border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] p-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
                        Status: {labelStatus(selectedCampaign.status)}
                        <br />
                        Next action: {selectedCampaign.nextAction}
                        <br />
                        Blockers: {selectedCampaign.risk}
                        <br />
                        Internal flags: {selectedCampaign.notes}
                      </div>
                    </details>
                  </aside>
                </div>
              </div>

              <div className="border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
                {actionMode === "changes" ? (
                  <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--ft-text-primary)]">
                      <MessageSquare className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                      Request Client Info
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {commonChangeReasons.map((reason) => (
                        <label
                          className="flex items-center gap-2 text-sm text-[var(--ft-text-secondary)]"
                          key={reason}
                        >
                          <input className="size-4 accent-[var(--ft-accent)]" type="checkbox" />
                          {reason}
                        </label>
                      ))}
                    </div>
                    <label className="mt-3 grid gap-1">
                      <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                        Describe the exact client info request. The client will see this.
                      </span>
                      <textarea
                        className="min-h-24 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] p-3 text-sm text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)] focus:ring-2 focus:ring-[var(--ft-accent)]"
                        onChange={(event) => setChangeMessage(event.target.value)}
                        placeholder="List the missing asset, URL fix, targeting detail, or budget update needed before setup can proceed."
                        value={changeMessage}
                      />
                    </label>
                    <div className="mt-3 flex justify-end">
                      <Button
                        className="h-9"
                        disabled={actionSaving || changeMessage.trim().length === 0}
                        onClick={() => void requestChanges()}
                        type="button"
                      >
                        {actionSaving ? "Sending" : "Send Client Info Request"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {actionMode === "reject" ? (
                  <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/35 bg-[var(--ft-red-subtle)]/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--ft-red)]">
                      <ShieldAlert className="size-4 stroke-[1.5]" />
                      Confirm brief decline
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                      You are about to decline this brief and notify the client. The client can only
                      continue after editing and resubmitting the campaign.
                    </p>
                    <label className="mt-3 grid gap-1">
                      <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                        Why is this brief being declined? The client will see this.
                      </span>
                      <textarea
                        className="min-h-24 rounded-[var(--radius-sm)] border border-[var(--ft-red)]/35 bg-[var(--ft-bg-base)] p-3 text-sm text-[var(--ft-text-primary)] outline-none placeholder:text-[var(--ft-text-muted)] focus:ring-2 focus:ring-[var(--ft-red)]"
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="Give the client a clear reason and the next step, if resubmission is possible."
                        value={rejectReason}
                      />
                    </label>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        className="h-9"
                        onClick={() => setActionMode(null)}
                        type="button"
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                      <Button
                        className="h-9"
                        disabled={actionSaving || rejectReason.trim().length === 0}
                        onClick={() =>
                          setConfirmation({
                            action: "reject",
                            confirmLabel: "Decline and Notify Client",
                            detail:
                              "This declines the brief and sends the visible reason to the client. The client can only continue after editing and resubmitting the campaign.",
                            severity: "danger",
                            title: "Decline this campaign brief?"
                          })
                        }
                        type="button"
                        variant="danger"
                      >
                        {actionSaving ? "Declining" : "Yes, decline and notify client"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {actionMode === "approve" ? (
                  <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--ft-accent)]/40 bg-[var(--ft-accent-subtle)]/50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--ft-text-primary)]">
                      <UserCheck className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                      Approve setup and assign owner
                    </div>
                    <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                      Approve the brief only after ownership is clear. The assigned operator gets
                      this in their setup queue for platform build, launch watch, and proof capture.
                    </p>
                    <label className="mt-3 grid gap-1">
                      <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                        Assign to
                      </span>
                      <select
                        className="h-10 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-base)] px-3 text-sm text-[var(--ft-text-primary)] outline-none focus:ring-2 focus:ring-[var(--ft-accent)] disabled:cursor-not-allowed disabled:opacity-70"
                        disabled
                        value="me"
                      >
                        {assignmentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs leading-5 text-[var(--ft-text-muted)]">
                        MVP approvals assign the campaign to your operator queue for a clear setup
                        handoff.
                      </span>
                    </label>
                    <div className="mt-3 flex justify-end">
                      <Button
                        className="h-9"
                        disabled={actionSaving}
                        onClick={() => void approveCampaign()}
                        type="button"
                      >
                        {actionSaving ? "Approving" : "Approve Setup Handoff"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    className="sm:w-auto"
                    onClick={() =>
                      setActionMode((current) => (current === "changes" ? null : "changes"))
                    }
                    type="button"
                    variant="secondary"
                  >
                    <MessageSquare className="size-4 stroke-[1.5]" />
                    Request Client Info
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="text-[var(--ft-red)] hover:text-[var(--ft-red)]"
                      onClick={() =>
                        setActionMode((current) => (current === "reject" ? null : "reject"))
                      }
                      type="button"
                      variant="ghost"
                    >
                      Decline Brief
                    </Button>
                    <Button
                      onClick={() =>
                        setActionMode((current) => (current === "approve" ? null : "approve"))
                      }
                      type="button"
                    >
                      <UserCheck className="size-4 stroke-[1.5]" />
                      Approve & Assign Setup
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </section>
    </AdminCampaignOpsShell>
  );
}
