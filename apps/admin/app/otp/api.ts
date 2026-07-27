"use client";

import type { OtpOrder as ApiOtpOrder, OtpProviderHealth } from "@fliptrybe/types";

import { apiRequest, formatMoney } from "../lib/api-client";
import {
  healthBars as fallbackHealthBars,
  overviewMetrics as fallbackOverviewMetrics,
  type AdminOtpOrder,
  type AdminOtpMetric,
  type AdminOtpPricingRule,
  type AdminOtpProvider,
  type OtpStatus,
  type ProviderState
} from "./data";

type AdminOverview = {
  approvedWorkspaceCount: number;
  activeOrders: number;
  completed: number;
  refunded: number;
  providerHealth: {
    total: number;
    healthy: number;
    averageSuccessRateBps: number;
  };
  providers: Array<{
    successRateBps: number;
  }>;
};

type AdminProvider = {
  name: string;
  tier: string;
  control?: { enabled?: boolean };
  health?: OtpProviderHealth;
};

export type AdminOtpDashboardData = {
  overviewMetrics: AdminOtpMetric[];
  providers: AdminOtpProvider[];
  pricingRules: AdminOtpPricingRule[];
  orders: AdminOtpOrder[];
  healthBars: typeof fallbackHealthBars;
};

function percentFromBps(value?: number) {
  return typeof value === "number" ? `${(value / 100).toFixed(1)}%` : "0%";
}

function secondsFromMs(value?: number) {
  return typeof value === "number" ? `${Math.max(1, Math.round(value / 1000))}s` : "Pending";
}

function providerState(provider: AdminProvider): ProviderState {
  if (provider.control?.enabled === false || provider.health?.status === "DISABLED") {
    return "paused";
  }
  if (provider.health?.status === "DEGRADED" || provider.health?.status === "DOWN") {
    return "degraded";
  }

  return "healthy";
}

function mapStatus(status: ApiOtpOrder["status"]): OtpStatus {
  if (
    status === "CHARGED" ||
    status === "ALLOCATING" ||
    status === "WAITING" ||
    status === "RECEIVED" ||
    status === "EXPIRED" ||
    status === "REFUNDED" ||
    status === "COMPLETED"
  ) {
    return status;
  }

  return status === "CANCELLED" ? "REFUNDED" : "EXPIRED";
}

function riskLabel(score?: number) {
  if (typeof score !== "number") {
    return "Low";
  }
  if (score >= 70) {
    return "High";
  }
  if (score >= 35) {
    return "Medium";
  }

  return "Low";
}

function ageText(createdAt?: string) {
  if (!createdAt) {
    return "Now";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));

  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}

function mapProvider(provider: AdminProvider): AdminOtpProvider {
  const enabled = provider.control?.enabled !== false;

  return {
    name: provider.name,
    state: providerState(provider),
    fill: percentFromBps(provider.health?.successRateBps),
    latency: secondsFromMs(provider.health?.latencyMs),
    stock: enabled ? 1 : 0,
    refund: provider.health?.status === "DEGRADED" ? "Review" : "Normal",
    spend: provider.tier,
    enabled
  };
}

function mapOrder(order: ApiOtpOrder): AdminOtpOrder {
  return {
    id: order.id,
    user: order.workspaceId,
    service: order.serviceName,
    provider: order.providerName ?? order.providerTier,
    status: mapStatus(order.status),
    amount: formatMoney(order.amount),
    risk: riskLabel(order.riskScore),
    age: ageText(order.createdAt)
  };
}

function metricsFrom(overview: AdminOverview): AdminOtpMetric[] {
  return [
    {
      ...fallbackOverviewMetrics[0]!,
      value: `${overview.completed} completed`,
      detail: `${overview.refunded} refunded orders`
    },
    {
      ...fallbackOverviewMetrics[1]!,
      value: String(overview.activeOrders),
      detail: "Live API orders"
    },
    {
      ...fallbackOverviewMetrics[2]!,
      value: overview.providerHealth.averageSuccessRateBps
        ? percentFromBps(overview.providerHealth.averageSuccessRateBps)
        : "No routes",
      detail: `${overview.providerHealth.healthy}/${overview.providerHealth.total} healthy routes`
    },
    {
      ...fallbackOverviewMetrics[3]!,
      value: String(overview.approvedWorkspaceCount),
      detail: "Approved beta workspaces"
    }
  ];
}

export async function loadAdminOtpDashboard(): Promise<AdminOtpDashboardData> {
  const [overview, providers, pricingRules, orders] = await Promise.all([
    apiRequest<AdminOverview>("/admin/otp/overview"),
    apiRequest<AdminProvider[]>("/admin/otp/providers"),
    apiRequest<AdminOtpPricingRule[]>("/admin/otp/pricing-rules"),
    apiRequest<ApiOtpOrder[]>("/otp/orders")
  ]);

  return {
    overviewMetrics: metricsFrom(overview),
    providers: providers.map(mapProvider),
    pricingRules,
    orders: orders.map(mapOrder),
    healthBars:
      overview.providers.length > 0
        ? overview.providers.map((provider) => Math.max(8, Math.round(provider.successRateBps / 100)))
        : fallbackHealthBars
  };
}

export async function setOtpProviderControl(providerName: string, enabled: boolean) {
  return apiRequest(`/admin/otp/providers/${encodeURIComponent(providerName)}/controls`, {
    method: "POST",
    body: JSON.stringify({ enabled })
  });
}

export async function setOtpPricingRule(input: AdminOtpPricingRule) {
  return apiRequest<AdminOtpPricingRule>("/admin/otp/pricing-rules", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
