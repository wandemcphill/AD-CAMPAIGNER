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
import type { Route } from "next";

export type CampaignOpsStatus =
  | "submitted"
  | "review"
  | "approved"
  | "assigned"
  | "creative_review"
  | "platform_launch"
  | "optimization"
  | "paused"
  | "reporting"
  | "blocked"
  | "completed"
  | "failed";

export type CampaignOpsPriority = "low" | "normal" | "high" | "urgent";
export type CampaignOpsReportStatus = "ready" | "generating" | "published" | "failed";
export type CampaignOpsReportType = "daily_update" | "weekly_report" | "final_report";
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
  budgetMinor: number;
  budgetUtilization: number;
  guardrails: string[];
  launchedPlacementCount: number;
  placementCount: number;
  publishedReportCount: number;
  reportCount: number;
  spend: string;
  spendMinor: number;
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
  workflowStage: string;
};

export type CampaignOpsReport = {
  id: string;
  title: string;
  period: string;
  generatedAt: string;
  status: CampaignOpsReportStatus;
  type: CampaignOpsReportType;
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
  "submitted",
  "review",
  "approved",
  "assigned",
  "creative_review",
  "platform_launch",
  "optimization",
  "paused",
  "reporting",
  "blocked",
  "completed",
  "failed"
];

export const campaignOpsPriorities: CampaignOpsPriority[] = ["low", "normal", "high", "urgent"];
export const campaignOpsReportStatuses: CampaignOpsReportStatus[] = [
  "ready",
  "generating",
  "published",
  "failed"
];
export const campaignOpsReportTypes: CampaignOpsReportType[] = [
  "daily_update",
  "weekly_report",
  "final_report"
];
export const campaignOpsActivitySeverities: CampaignOpsActivitySeverity[] = [
  "info",
  "success",
  "warning",
  "danger"
];

export const navItems: Array<{ label: string; href: Route; icon: LucideIcon }> = [
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
  approved: "info",
  assigned: "info",
  blocked: "danger",
  completed: "success",
  creative_review: "warning",
  failed: "danger",
  optimization: "success",
  paused: "warning",
  platform_launch: "info",
  reporting: "warning",
  review: "warning",
  submitted: "info"
} as const;

export const priorityTone = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger"
} as const;

export const reportStatusTone = {
  failed: "danger",
  generating: "info",
  published: "success",
  ready: "warning"
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
    label: "Submitted to Review",
    value: "Brief, budget, destination, and audience readiness checks"
  },
  {
    icon: ShieldAlert,
    label: "Approved to Assigned",
    value: "Named operator ownership, SLA, and handoff accountability"
  },
  {
    icon: Radio,
    label: "Creative to Launch",
    value: "Creative review, platform setup, ad account, placement URL, and launch proof"
  },
  {
    icon: FileText,
    label: "Optimize to Complete",
    value: "Spend-safe optimization, daily updates, weekly reports, final report, and closure"
  }
];

export const emptyCampaignOpsMetrics: CampaignOpsMetric[] = [
  { label: "Pending reviews", value: "0", detail: "Submitted campaigns in review", tone: "info" },
  { label: "Launch prep", value: "0", detail: "Approved through platform launch", tone: "warning" },
  { label: "Budget alerts", value: "0", detail: "Campaigns near spend allocation", tone: "warning" },
  { label: "Reporting queue", value: "0", detail: "Daily, weekly, and final reports" }
];
