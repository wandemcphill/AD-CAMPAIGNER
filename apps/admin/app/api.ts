"use client";

import type { ComponentType } from "react";
import {
  AlertTriangle,
  Banknote,
  Gauge,
  Users
} from "lucide-react";

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

export type AdminDashboardData = {
  metrics: AdminMetric[];
  queues: AdminQueueRow[];
  risk: AdminRiskRow[];
  audits: string[];
  rails: Array<{ name: string; status: string }>;
  source: "api" | "partial";
};

type PlatformOverview = {
  users?: number;
  activeCampaigns?: number;
  pendingModeration?: number;
  paymentVolumeMinor?: number;
  fraudSignals?: number;
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

const railNames = ["Korapay", "Paystack", "Stripe", "Manual transfer"];

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
  if (status === "REJECTED" || status === "FAILED" || status === "CHANGES_REQUESTED") {
    return "High";
  }
  if (status === "PENDING_REVIEW" || status === "PAUSED") {
    return "Medium";
  }

  return "Low";
}

function auditText(item: AuditLog) {
  const target = [item.entityType, item.entityId].filter(Boolean).join(" ");

  return `${item.action ?? "audit.event"}${target ? ` on ${target}` : ""}`;
}

function buildMetrics(platform?: PlatformOverview, campaignOps?: CampaignOpsOverview): AdminMetric[] {
  const totals = campaignOps?.totals;

  return [
    {
      label: "Active users",
      value: compactNumber(platform?.users),
      detail: `${compactNumber(platform?.activeCampaigns)} active campaigns`,
      tone: "success",
      icon: Users
    },
    {
      label: "Payment volume",
      value: moneyFromMinor(platform?.paymentVolumeMinor),
      detail: "Production payment telemetry",
      tone: "info",
      icon: Banknote
    },
    {
      label: "Fraud signals",
      value: String(platform?.fraudSignals ?? totals?.blocked ?? 0),
      detail: `${totals?.pendingReviews ?? platform?.pendingModeration ?? 0} reviews pending`,
      tone: (platform?.fraudSignals ?? totals?.blocked ?? 0) > 0 ? "warning" : "success",
      icon: AlertTriangle
    },
    {
      label: "Queue depth",
      value: String(
        (totals?.pendingReviews ?? 0) +
          (totals?.launchPreparation ?? 0) +
          (totals?.reporting ?? 0) +
          (platform?.smmSupplierCount ?? 0)
      ),
      detail: `${totals?.running ?? 0} campaigns running`,
      tone: "info",
      icon: Gauge
    }
  ];
}

function buildQueues(platform?: PlatformOverview, campaignOps?: CampaignOpsOverview): AdminQueueRow[] {
  const health = platform?.queueHealth ?? {};
  const totals = campaignOps?.totals ?? {};

  return [
    { name: "campaign reviews", depth: totals.pendingReviews ?? 0, status: queueStatus(health.campaign) },
    { name: "launch prep", depth: totals.launchPreparation ?? 0, status: queueStatus(health.campaign) },
    { name: "reporting", depth: totals.reporting ?? 0, status: queueStatus(health.analytics) },
    { name: "supplier routes", depth: platform?.smmSupplierCount ?? 0, status: queueStatus(health.smm) }
  ];
}

function buildRisk(campaignOps?: CampaignOpsOverview): AdminRiskRow[] {
  const queue = campaignOps?.queue ?? [];
  const risky = queue
    .filter((item) => riskFromCampaignStatus(item.status) !== "Low" || Number(item.budgetUtilization ?? 0) >= 85)
    .slice(0, 4)
    .map((item) => ({
      item: item.name ?? item.id ?? "Campaign",
      risk: Number(item.budgetUtilization ?? 0) >= 85 ? "Medium" : riskFromCampaignStatus(item.status),
      reason:
        Number(item.budgetUtilization ?? 0) >= 85
          ? "Budget utilization alert"
          : item.status ?? "Campaign needs review"
    }));

  return risky.length > 0
    ? risky
    : [{ item: "Campaign queue", risk: "Low", reason: "No urgent campaign exceptions returned" }];
}

function buildAudits(campaignOps?: CampaignOpsOverview, auditLogs?: AuditLog[]) {
  const activity = campaignOps?.activity?.map(auditText) ?? [];
  const logs = auditLogs?.map(auditText) ?? [];

  return [...activity, ...logs].slice(0, 5);
}

function buildRails(supplierHealth?: SupplierHealth) {
  const supplierStatuses = new Map(
    (supplierHealth?.suppliers ?? []).map((supplier) => [
      supplier.name?.toLowerCase(),
      supplier.healthy === false ? "watch" : supplier.status ?? supplier.mode ?? "live"
    ])
  );

  return railNames.map((name) => ({ name, status: supplierStatuses.get(name.toLowerCase()) ?? "configured" }));
}

async function optional<T>(request: Promise<T>) {
  try {
    return await request;
  } catch {
    return undefined;
  }
}

export async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const [platform, campaignOps, supplierHealth, auditLogs] = await Promise.all([
    optional(apiRequest<PlatformOverview>("/admin/overview")),
    optional(apiRequest<CampaignOpsOverview>("/admin/campaign-ops/overview")),
    optional(apiRequest<SupplierHealth>("/admin/smm/health")),
    optional(apiRequest<AuditLog[]>("/audit/logs"))
  ]);

  return {
    metrics: buildMetrics(platform, campaignOps),
    queues: buildQueues(platform, campaignOps),
    risk: buildRisk(campaignOps),
    audits: buildAudits(campaignOps, auditLogs),
    rails: buildRails(supplierHealth),
    source: platform && campaignOps ? "api" : "partial"
  };
}
