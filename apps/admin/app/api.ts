"use client";

import type { ComponentType } from "react";
import { AlertTriangle, Banknote, Gauge, Users } from "lucide-react";

import { apiRequest, formatMoney } from "./lib/api-client";

type MetricTone = "neutral" | "success" | "warning" | "info";

export type AdminMetric = {
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
  icon: ComponentType<{ className?: string }>;
};

export type AdminQueueRow = {
  name: string;
  depth: number;
  status: "healthy" | "watch";
};

export type AdminRiskRow = {
  item: string;
  risk: "Low" | "Medium" | "High";
  reason: string;
};

export type AdminProviderRow = {
  name: string;
  status: string;
  healthy: boolean;
  mode?: string;
};

export type AdminDashboardData = {
  metrics: AdminMetric[];
  queues: AdminQueueRow[];
  risk: AdminRiskRow[];
  audits: string[];
  providers: AdminProviderRow[];
  source: "api" | "partial";
};

type CommandCenterOverview = {
  users?: { total?: number; active?: number; new24h?: number; suspended?: number };
  campaigns?: { active?: number; pendingReview?: number };
  payments?: { volumeMinor30d?: number; pending?: number; failed24h?: number };
  wallets?: { active?: number };
  fulfilment?: { growthOpen?: number; vtuOpen?: number; virtualNumbersOpen?: number };
  risk?: { review?: number; high?: number };
};

type PlatformOverview = {
  smmSupplierCount?: number;
  queueHealth?: Record<string, string>;
};

type CampaignOpsOverview = {
  totals?: {
    pendingReviews?: number;
    launchPreparation?: number;
    blocked?: number;
    reporting?: number;
    running?: number;
    urgent?: number;
  };
  queue?: Array<{
    id?: string;
    name?: string;
    status?: string;
    budgetUtilization?: number;
    assignedOperator?: { name?: string } | string | null;
  }>;
  reports?: Array<{ id?: string; title?: string; status?: string }>;
  activity?: Array<{ action?: string; entityType?: string; entityId?: string; createdAt?: string }>;
};

type SupplierHealth = {
  suppliers?: Array<{ name?: string; mode?: string; healthy?: boolean; status?: string }>;
};

type AuditLog = {
  action?: string;
  entityType?: string;
  entityId?: string;
  createdAt?: string;
};

function compactNumber(value?: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    value ?? 0
  );
}

function moneyFromMinor(amountMinor?: number) {
  return formatMoney({ amountMinor: amountMinor ?? 0, currency: "NGN" });
}

function queueStatus(value?: string): AdminQueueRow["status"] {
  return value === "healthy" || value === "HEALTHY" ? "healthy" : "watch";
}

function riskFromCampaignStatus(status?: string): AdminRiskRow["risk"] {
  if (status === "REJECTED" || status === "FAILED" || status === "CHANGES_REQUESTED") return "High";
  if (status === "PENDING_REVIEW" || status === "PAUSED") return "Medium";
  return "Low";
}

function auditText(item: AuditLog) {
  const target = [item.entityType, item.entityId].filter(Boolean).join(" ");
  return `${item.action ?? "audit.event"}${target ? ` on ${target}` : ""}`;
}

function buildMetrics(center?: CommandCenterOverview): AdminMetric[] {
  return [
    {
      label: "Users",
      value: compactNumber(center?.users?.total),
      detail: `${compactNumber(center?.users?.active)} active · ${compactNumber(center?.users?.new24h)} new today`,
      tone: "success",
      icon: Users
    },
    {
      label: "Payment volume",
      value: moneyFromMinor(center?.payments?.volumeMinor30d),
      detail: `${compactNumber(center?.payments?.pending)} pending payments`,
      tone: "info",
      icon: Banknote
    },
    {
      label: "Risk signals",
      value: String(center?.risk?.review ?? 0),
      detail: `${center?.risk?.high ?? 0} high-risk reviews`,
      tone: (center?.risk?.high ?? 0) > 0 ? "warning" : "success",
      icon: AlertTriangle
    },
    {
      label: "Open fulfilment",
      value: String(
        (center?.fulfilment?.growthOpen ?? 0) +
          (center?.fulfilment?.vtuOpen ?? 0) +
          (center?.fulfilment?.virtualNumbersOpen ?? 0)
      ),
      detail: `${center?.campaigns?.pendingReview ?? 0} campaigns awaiting review`,
      tone: "info",
      icon: Gauge
    }
  ];
}

function buildQueues(
  center?: CommandCenterOverview,
  platform?: PlatformOverview,
  campaignOps?: CampaignOpsOverview
): AdminQueueRow[] {
  const health = platform?.queueHealth ?? {};
  const totals = campaignOps?.totals ?? {};

  return [
    { name: "campaign reviews", depth: center?.campaigns?.pendingReview ?? totals.pendingReviews ?? 0, status: queueStatus(health.campaign) },
    { name: "launch preparation", depth: totals.launchPreparation ?? 0, status: queueStatus(health.campaign) },
    { name: "Growth fulfilment", depth: center?.fulfilment?.growthOpen ?? 0, status: queueStatus(health.smm) },
    { name: "VTU / Virtual Numbers", depth: (center?.fulfilment?.vtuOpen ?? 0) + (center?.fulfilment?.virtualNumbersOpen ?? 0), status: queueStatus(health.smm) }
  ];
}

function buildRisk(campaignOps?: CampaignOpsOverview, center?: CommandCenterOverview): AdminRiskRow[] {
  const queue = campaignOps?.queue ?? [];
  const risky = queue
    .filter((item) => riskFromCampaignStatus(item.status) !== "Low" || Number(item.budgetUtilization ?? 0) >= 85)
    .slice(0, 4)
    .map((item) => ({
      item: item.name ?? item.id ?? "Campaign",
      risk: Number(item.budgetUtilization ?? 0) >= 85 ? "Medium" : riskFromCampaignStatus(item.status),
      reason: Number(item.budgetUtilization ?? 0) >= 85 ? "Budget utilization alert" : item.status ?? "Campaign needs review"
    }));

  if (risky.length > 0) return risky;
  if ((center?.risk?.review ?? 0) > 0) {
    return [{ item: "Campaign risk desk", risk: (center?.risk?.high ?? 0) > 0 ? "High" : "Medium", reason: `${center?.risk?.review} risk reviews are open` }];
  }

  return [{ item: "Risk desk", risk: "Low", reason: "No urgent risk exceptions returned" }];
}

function buildAudits(campaignOps?: CampaignOpsOverview, auditLogs?: AuditLog[]) {
  const activity = campaignOps?.activity?.map(auditText) ?? [];
  const logs = auditLogs?.map(auditText) ?? [];
  return [...activity, ...logs].slice(0, 6);
}

function buildProviders(supplierHealth?: SupplierHealth): AdminProviderRow[] {
  return (supplierHealth?.suppliers ?? [])
    .filter((supplier) => supplier.name)
    .map((supplier) => ({
      name: supplier.name!,
      status: supplier.healthy === false ? "watch" : supplier.status ?? "healthy",
      healthy: supplier.healthy !== false,
      ...(supplier.mode ? { mode: supplier.mode } : {})
    }));
}

async function optional<T>(request: Promise<T>) {
  try {
    return await request;
  } catch {
    return undefined;
  }
}

export async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const [center, platform, campaignOps, supplierHealth, auditLogs] = await Promise.all([
    optional(apiRequest<CommandCenterOverview>("/admin/command-center/overview")),
    optional(apiRequest<PlatformOverview>("/admin/overview")),
    optional(apiRequest<CampaignOpsOverview>("/admin/campaign-ops/overview")),
    optional(apiRequest<SupplierHealth>("/admin/smm/health")),
    optional(apiRequest<AuditLog[]>("/audit/logs"))
  ]);

  return {
    metrics: buildMetrics(center),
    queues: buildQueues(center, platform, campaignOps),
    risk: buildRisk(campaignOps, center),
    audits: buildAudits(campaignOps, auditLogs),
    providers: buildProviders(supplierHealth),
    source: center && campaignOps ? "api" : "partial"
  };
}
