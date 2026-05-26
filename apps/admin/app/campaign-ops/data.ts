import {
  Activity,
  BarChart3,
  ClipboardList,
  FileText,
  Gauge,
  ListChecks,
  Radio,
  ShieldAlert,
  type LucideIcon
} from "lucide-react";

export type CampaignOpsStatus =
  | "queued"
  | "reviewing"
  | "scheduled"
  | "running"
  | "blocked"
  | "completed"
  | "failed";

export type CampaignOpsPriority = "low" | "normal" | "high" | "urgent";
export type CampaignOpsReportStatus = "ready" | "generating" | "failed";
export type CampaignOpsActivitySeverity = "info" | "success" | "warning" | "danger";

export type CampaignOpsMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

export type CampaignOpsCampaign = {
  id: string;
  name: string;
  workspaceName: string;
  ownerName: string;
  channel: string;
  objective: string;
  budget: string;
  status: CampaignOpsStatus;
  priority: CampaignOpsPriority;
  assignee: string;
  submittedAt: string;
  updatedAt: string;
  runWindow: string;
  destinationUrl: string;
  notes: string;
  sla: string;
  risk: string;
  progress: number;
  nextAction: string;
  tags: string[];
};

export type CampaignOpsReport = {
  id: string;
  title: string;
  period: string;
  generatedAt: string;
  status: CampaignOpsReportStatus;
  owner: string;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
};

export type CampaignOpsActivityItem = {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  severity: CampaignOpsActivitySeverity;
  description: string;
};

export type CampaignOpsPageSource = "api";

export const campaignOpsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_CAMPAIGN_OPS_ADMIN !== "false";

export const campaignOpsStatuses: CampaignOpsStatus[] = [
  "queued",
  "reviewing",
  "scheduled",
  "running",
  "blocked",
  "completed",
  "failed"
];

export const campaignOpsPriorities: CampaignOpsPriority[] = ["low", "normal", "high", "urgent"];
export const campaignOpsReportStatuses: CampaignOpsReportStatus[] = [
  "ready",
  "generating",
  "failed"
];
export const campaignOpsActivitySeverities: CampaignOpsActivitySeverity[] = [
  "info",
  "success",
  "warning",
  "danger"
];

export const navItems: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Ops Overview", href: "/campaign-ops", icon: Gauge },
  { label: "Review Queue", href: "/campaign-ops/queue", icon: ListChecks },
  { label: "Reports Queue", href: "/campaign-ops/reports", icon: BarChart3 },
  { label: "Audit Log", href: "/campaign-ops/activity", icon: Activity }
];

export const campaignOpsApiRoutes = [
  "/v1/admin/campaign-ops/overview",
  "/v1/admin/campaign-ops/queue",
  "/v1/admin/campaign-ops/queue/:campaignId",
  "/v1/admin/campaign-ops/reports",
  "/v1/admin/campaign-ops/activity"
];

export const statusTone = {
  queued: "info",
  reviewing: "warning",
  scheduled: "info",
  running: "success",
  blocked: "danger",
  completed: "success",
  failed: "danger"
} as const;

export const priorityTone = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger"
} as const;

export const reportStatusTone = {
  ready: "success",
  generating: "info",
  failed: "danger"
} as const;

export const activitySeverityTone = {
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger"
} as const;

export const operationStages = [
  {
    icon: ClipboardList,
    label: "Brief QA",
    value: "Creative, targeting, budget, and destination readiness checks"
  },
  {
    icon: ShieldAlert,
    label: "Risk gate",
    value: "Policy, fraud, payment, and workspace trust signals"
  },
  {
    icon: Radio,
    label: "Launch control",
    value: "Owner handoff, provider tracking, and live monitoring"
  },
  {
    icon: FileText,
    label: "Client reporting",
    value: "Client-ready summaries, proof links, and publish status"
  }
];

export const emptyCampaignOpsMetrics: CampaignOpsMetric[] = [
  { label: "Needs action", value: "0", detail: "Queued, reviewing, and blocked", tone: "info" },
  { label: "Running", value: "0", detail: "Live campaigns under watch", tone: "success" },
  { label: "Escalations", value: "0", detail: "Blocked or urgent campaigns", tone: "warning" },
  { label: "Operators", value: "0", detail: "Assigned campaign ops users" }
];
