"use client";

import {
  apiRequest,
  formatMoney,
  subscribeToSessionChanges,
  type ApiMoney
} from "../lib/api-client";
import {
  campaignOpsActivitySeverities,
  campaignOpsPriorities,
  campaignOpsReportStatuses,
  campaignOpsStatuses,
  emptyCampaignOpsMetrics,
  type CampaignOpsActivityItem,
  type CampaignOpsActivitySeverity,
  type CampaignOpsCampaign,
  type CampaignOpsMetric,
  type CampaignOpsPageSource,
  type CampaignOpsPriority,
  type CampaignOpsReport,
  type CampaignOpsReportStatus,
  type CampaignOpsStatus
} from "./data";

type CampaignOpsMetricTone = NonNullable<CampaignOpsMetric["tone"]>;

type ApiAssignee = {
  name?: string;
  email?: string;
};

type ApiWorkspace = {
  name?: string;
};

type ApiCampaign = {
  id?: string;
  campaignId?: string;
  name?: string;
  title?: string;
  workspaceName?: string;
  workspace?: ApiWorkspace;
  ownerName?: string;
  owner?: ApiAssignee;
  channel?: string;
  objective?: string;
  budget?: ApiMoney | string | number;
  budgetMinor?: number;
  budgetUtilization?: number;
  guardrails?: string[];
  launchedPlacementCount?: number;
  placementCount?: number;
  publishedReportCount?: number;
  reportCount?: number;
  spend?: ApiMoney | string | number;
  spendMinor?: number;
  status?: string;
  priority?: string;
  assignee?: string | ApiAssignee;
  assignedTo?: string | ApiAssignee;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  startsAt?: string;
  scheduledAt?: string;
  endsAt?: string;
  destinationUrl?: string;
  notes?: string;
  sla?: string;
  risk?: string;
  progress?: number;
  nextAction?: string;
  tags?: string[];
  workflowStage?: string;
};

type ApiReport = {
  id?: string;
  title?: string;
  period?: string;
  generatedAt?: string;
  createdAt?: string;
  status?: string;
  type?: string;
  reportType?: string;
  owner?: string | ApiAssignee;
  summary?: string;
  metrics?: Array<{ label?: string; value?: string | number }>;
};

type ApiActivity = {
  id?: string;
  actor?: string | ApiAssignee;
  action?: string;
  target?: string;
  timestamp?: string;
  createdAt?: string;
  severity?: string;
  description?: string;
};

type ApiMetric = {
  label?: string;
  value?: string | number;
  detail?: string;
  tone?: string;
};

type ApiOverview = {
  totals?: Partial<Record<string, number>>;
  metrics?: ApiMetric[];
  queue?: ApiCampaign[];
  reports?: ApiReport[];
  activity?: ApiActivity[];
  activeOperators?: number;
};

type ApiPage<T> = {
  items?: T[];
  data?: T[];
  nextCursor?: string | null;
};

export type AdminCampaignOpsOverviewState = {
  activity: CampaignOpsActivityItem[];
  error?: string;
  loading: boolean;
  metrics: CampaignOpsMetric[];
  queue: CampaignOpsCampaign[];
  reports: CampaignOpsReport[];
  source: CampaignOpsPageSource;
};

export type AdminCampaignOpsQueueState = {
  error?: string;
  items: CampaignOpsCampaign[];
  loading: boolean;
  nextCursor?: string | null;
  source: CampaignOpsPageSource;
};

export type AdminCampaignOpsCampaignState = {
  campaign: CampaignOpsCampaign | null;
  error?: string;
  loading: boolean;
  source: CampaignOpsPageSource;
};

export type AdminCampaignOpsReportsState = {
  error?: string;
  items: CampaignOpsReport[];
  loading: boolean;
  nextCursor?: string | null;
  source: CampaignOpsPageSource;
};

export type AdminCampaignOpsActivityState = {
  error?: string;
  items: CampaignOpsActivityItem[];
  loading: boolean;
  nextCursor?: string | null;
  source: CampaignOpsPageSource;
};

export const emptyOverviewState: AdminCampaignOpsOverviewState = {
  activity: [],
  loading: false,
  metrics: emptyCampaignOpsMetrics,
  queue: [],
  reports: [],
  source: "api"
};

export const emptyQueueState: AdminCampaignOpsQueueState = {
  items: [],
  loading: false,
  source: "api"
};

export const emptyCampaignState: AdminCampaignOpsCampaignState = {
  campaign: null,
  loading: false,
  source: "api"
};

export const emptyReportsState: AdminCampaignOpsReportsState = {
  items: [],
  loading: false,
  source: "api"
};

export const emptyActivityState: AdminCampaignOpsActivityState = {
  items: [],
  loading: false,
  source: "api"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeChoice<T extends string>(value: unknown, allowed: T[], fallback: T) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.toLowerCase().replaceAll("-", "_");

  return allowed.includes(normalized as T) ? (normalized as T) : fallback;
}

function normalizeStatus(value: unknown): CampaignOpsStatus {
  return normalizeChoice(value, campaignOpsStatuses, "submitted");
}

function normalizePriority(value: unknown): CampaignOpsPriority {
  return normalizeChoice(value, campaignOpsPriorities, "normal");
}

function normalizeReportStatus(value: unknown): CampaignOpsReportStatus {
  return normalizeChoice(value, campaignOpsReportStatuses, "generating");
}

function normalizeReportType(value: unknown): CampaignOpsReport["type"] {
  if (typeof value !== "string") {
    return "weekly_report";
  }

  const normalized = value.toLowerCase().replaceAll("-", "_");

  return normalized === "daily_update" || normalized === "weekly_report" || normalized === "final_report"
    ? normalized
    : "weekly_report";
}

function normalizeSeverity(value: unknown): CampaignOpsActivitySeverity {
  return normalizeChoice(value, campaignOpsActivitySeverities, "info");
}

function normalizeMetricTone(value: unknown): CampaignOpsMetricTone {
  if (value === "success" || value === "warning" || value === "info" || value === "neutral") {
    return value;
  }

  return "neutral";
}

function actorName(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (isRecord(value) && typeof value.name === "string" && value.name.trim().length > 0) {
    return value.name;
  }

  return fallback;
}

function formatBudget(value: ApiCampaign["budget"]) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("en-NG", {
      currency: "NGN",
      maximumFractionDigits: 0,
      style: "currency"
    }).format(value / 100);
  }
  if (isRecord(value) && typeof value.amountMinor === "number" && typeof value.currency === "string") {
    return formatMoney(value);
  }

  return "Needs Action: budget pending";
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Needs Action: not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function buildRunWindow(campaign: ApiCampaign) {
  const start = campaign.startsAt ?? campaign.scheduledAt;
  const end = campaign.endsAt;

  if (!start && !end) {
    return "Needs Action: set flight window";
  }
  if (!end) {
    return formatDateTime(start);
  }

  return `${formatDateTime(start)} to ${formatDateTime(end)}`;
}

function mapCampaign(campaign: ApiCampaign, index = 0): CampaignOpsCampaign {
  const id = stringValue(campaign.id ?? campaign.campaignId, `campaign-${index + 1}`);

  return {
    id,
    name: stringValue(campaign.name ?? campaign.title, "Untitled campaign"),
    workspaceName: stringValue(campaign.workspaceName ?? campaign.workspace?.name, "Workspace"),
    ownerName: actorName(campaign.ownerName ?? campaign.owner, "Campaign owner"),
    channel: stringValue(campaign.channel, "Needs Action: choose channel"),
    objective: stringValue(campaign.objective, "Needs Action: capture campaign objective"),
    budget: formatBudget(campaign.budget),
    budgetMinor: numberValue(campaign.budgetMinor),
    budgetUtilization: Math.min(999, Math.max(0, numberValue(campaign.budgetUtilization))),
    guardrails: Array.isArray(campaign.guardrails)
      ? campaign.guardrails.filter((guardrail) => typeof guardrail === "string")
      : [],
    launchedPlacementCount: numberValue(campaign.launchedPlacementCount),
    placementCount: numberValue(campaign.placementCount),
    publishedReportCount: numberValue(campaign.publishedReportCount),
    reportCount: numberValue(campaign.reportCount),
    spend: formatBudget(campaign.spend),
    spendMinor: numberValue(campaign.spendMinor),
    status: normalizeStatus(campaign.status),
    priority: normalizePriority(campaign.priority),
    assignee: actorName(campaign.assignee ?? campaign.assignedTo, "Unassigned"),
    submittedAt: formatDateTime(campaign.submittedAt ?? campaign.createdAt),
    updatedAt: formatDateTime(campaign.updatedAt),
    runWindow: buildRunWindow(campaign),
    destinationUrl: stringValue(campaign.destinationUrl, "Needs Action: add destination URL"),
    notes: stringValue(campaign.notes, "Needs Action: add operator context before handoff."),
    sla: stringValue(campaign.sla, "Needs Action: set SLA"),
    risk: stringValue(campaign.risk, "Needs Action: risk unscored"),
    progress: Math.min(100, Math.max(0, numberValue(campaign.progress, 0))),
    nextAction: stringValue(campaign.nextAction, "Needs Action: review campaign details"),
    tags: Array.isArray(campaign.tags) ? campaign.tags.filter((tag) => typeof tag === "string") : [],
    workflowStage: stringValue(campaign.workflowStage, "Campaign Submitted")
  };
}

function mapMetric(metric: ApiMetric, index: number): CampaignOpsMetric {
  return {
    label: stringValue(metric.label, `Metric ${index + 1}`),
    value: String(metric.value ?? "0"),
    detail: stringValue(metric.detail, "Campaign ops signal"),
    tone: normalizeMetricTone(metric.tone)
  };
}

function buildMetrics(overview: ApiOverview): CampaignOpsMetric[] {
  if (overview.metrics && overview.metrics.length > 0) {
    return overview.metrics.map(mapMetric);
  }

  const totals = overview.totals ?? {};
  const pendingReviews = numberValue(totals.pendingReviews ?? totals.queued);
  const launchPreparation = numberValue(totals.launchPreparation ?? totals.reviewing);
  const blocked = numberValue(totals.blocked);
  const urgent = numberValue(totals.urgent);

  return [
    {
      label: "Pending reviews",
      value: String(pendingReviews + blocked),
      detail: "Submitted, review, and blocked",
      tone: "info"
    },
    {
      label: "Launch prep",
      value: String(launchPreparation),
      detail: "Approved through platform launch",
      tone: "warning"
    },
    {
      label: "Budget alerts",
      value: String(blocked + urgent),
      detail: "Blocked, urgent, or allocation-sensitive",
      tone: "warning"
    },
    {
      label: "Reporting queue",
      value: String(numberValue(totals.reporting)),
      detail: "Daily, weekly, and final reports"
    }
  ];
}

function mapReport(report: ApiReport, index = 0): CampaignOpsReport {
  return {
    id: stringValue(report.id, `report-${index + 1}`),
    title: stringValue(report.title, "Campaign ops report"),
    period: stringValue(report.period, "Current period"),
    generatedAt: formatDateTime(report.generatedAt ?? report.createdAt),
    status: normalizeReportStatus(report.status),
    type: normalizeReportType(report.type ?? report.reportType),
    owner: actorName(report.owner, "Ops"),
    summary: stringValue(report.summary, "Needs Action: add a client-ready report summary before publishing."),
    metrics: Array.isArray(report.metrics)
      ? report.metrics.map((metric, metricIndex) => ({
          label: stringValue(metric.label, `Metric ${metricIndex + 1}`),
          value: String(metric.value ?? "0")
        }))
      : []
  };
}

function mapActivity(item: ApiActivity, index = 0): CampaignOpsActivityItem {
  return {
    id: stringValue(item.id, `activity-${index + 1}`),
    actor: actorName(item.actor, "System"),
    action: stringValue(item.action, "updated campaign ops"),
    target: stringValue(item.target, "Campaign queue"),
    timestamp: formatDateTime(item.timestamp ?? item.createdAt),
    severity: normalizeSeverity(item.severity),
    description: stringValue(item.description, "Needs Action: add enough context for the ops audit trail.")
  };
}

function unwrapItems<T>(payload: ApiPage<T> | T[]): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.items ?? payload.data ?? [];
}

function nextCursor<T>(payload: ApiPage<T> | T[]) {
  return Array.isArray(payload) ? undefined : payload.nextCursor;
}

export async function loadAdminCampaignOpsOverview() {
  const overview = await apiRequest<ApiOverview>("/admin/campaign-ops/overview");

  return {
    activity: (overview.activity ?? []).map(mapActivity),
    loading: false,
    metrics: buildMetrics(overview),
    queue: (overview.queue ?? []).map(mapCampaign),
    reports: (overview.reports ?? []).map(mapReport),
    source: "api" as const
  };
}

export async function loadAdminCampaignOpsQueue() {
  const payload = await apiRequest<ApiPage<ApiCampaign> | ApiCampaign[]>("/admin/campaign-ops/queue");
  const cursor = nextCursor(payload);
  const state = {
    items: unwrapItems(payload).map(mapCampaign),
    loading: false,
    source: "api" as const
  };

  return cursor === undefined ? state : { ...state, nextCursor: cursor };
}

export async function loadAdminCampaignOpsCampaign(campaignId: string) {
  const campaign = await apiRequest<ApiCampaign>(
    `/admin/campaign-ops/queue/${encodeURIComponent(campaignId)}`
  );

  return {
    campaign: mapCampaign(campaign),
    loading: false,
    source: "api" as const
  };
}

export async function loadAdminCampaignOpsReports() {
  const payload = await apiRequest<ApiPage<ApiReport> | ApiReport[]>("/admin/campaign-ops/reports");
  const cursor = nextCursor(payload);
  const state = {
    items: unwrapItems(payload).map(mapReport),
    loading: false,
    source: "api" as const
  };

  return cursor === undefined ? state : { ...state, nextCursor: cursor };
}

export async function loadAdminCampaignOpsActivity() {
  const payload = await apiRequest<ApiPage<ApiActivity> | ApiActivity[]>(
    "/admin/campaign-ops/activity"
  );
  const cursor = nextCursor(payload);
  const state = {
    items: unwrapItems(payload).map(mapActivity),
    loading: false,
    source: "api" as const
  };

  return cursor === undefined ? state : { ...state, nextCursor: cursor };
}

const adminStatusToApiStatus: Record<CampaignOpsStatus, string> = {
  approved: "APPROVED",
  assigned: "APPROVED",
  blocked: "CHANGES_REQUESTED",
  completed: "COMPLETED",
  creative_review: "CREATIVE_IN_PROGRESS",
  failed: "FAILED",
  optimization: "RUNNING",
  paused: "PAUSED",
  platform_launch: "QUEUED",
  reporting: "RUNNING",
  review: "PENDING_REVIEW",
  submitted: "PENDING_REVIEW"
};
type AdminCampaignStatusMutation =
  | CampaignOpsStatus
  | "APPROVED"
  | "CANCELLED"
  | "CHANGES_REQUESTED"
  | "COMPLETED"
  | "FAILED"
  | "PAUSED"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "RUNNING";

export async function updateAdminCampaignStatus(
  campaignId: string,
  status: AdminCampaignStatusMutation,
  reason?: string
) {
  const apiStatus = adminStatusToApiStatus[status as CampaignOpsStatus] ?? status;

  return apiRequest(`/admin/campaign-ops/campaigns/${encodeURIComponent(campaignId)}/status`, {
    body: JSON.stringify({ reason, status: apiStatus }),
    method: "PATCH"
  });
}

export async function updateAdminCampaignAssignment(
  campaignId: string,
  input: { assignedToUserId?: string; assigneeUserId?: string; role?: string } = {}
) {
  return apiRequest(`/admin/campaign-ops/campaigns/${encodeURIComponent(campaignId)}/assignment`, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export async function addAdminCampaignNote(
  campaignId: string,
  input: { body: string; visibility?: "INTERNAL" | "CLIENT_VISIBLE"; metadata?: Record<string, unknown> }
) {
  return apiRequest(`/admin/campaign-ops/campaigns/${encodeURIComponent(campaignId)}/notes`, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function addAdminCampaignMetrics(
  campaignId: string,
  input: Record<string, string | number | null | undefined>
) {
  return apiRequest(`/admin/campaign-ops/campaigns/${encodeURIComponent(campaignId)}/metrics`, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function addAdminCampaignPlacement(
  campaignId: string,
  input: Record<string, string | number | boolean | null | undefined | Record<string, unknown>>
) {
  return apiRequest(`/admin/campaign-ops/campaigns/${encodeURIComponent(campaignId)}/ad-urls`, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function createAdminCampaignReport(
  campaignId: string,
  input: Record<string, string | number | null | undefined | Record<string, unknown>>
) {
  return apiRequest(`/admin/campaign-ops/campaigns/${encodeURIComponent(campaignId)}/reports`, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function publishAdminCampaignReport(reportId: string) {
  return apiRequest(`/admin/campaign-ops/reports/${encodeURIComponent(reportId)}/publish`, {
    method: "POST"
  });
}

export { subscribeToSessionChanges };
