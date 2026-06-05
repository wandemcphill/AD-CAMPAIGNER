"use client";

import {
  apiRequest,
  formatMoney,
  subscribeToSessionChanges,
  type ApiMoney
} from "../lib/api-client";
import {
  adminGrowthEnabled,
  fallbackMetrics,
  fallbackOrders,
  fallbackRisks,
  fallbackServices,
  fallbackSuppliers,
  type AdminGrowthMetric,
  type AdminGrowthOrder,
  type AdminGrowthRisk,
  type AdminGrowthService,
  type AdminGrowthStatus,
  type AdminSupplierAudit
} from "./data";

export type AdminGrowthState = {
  error?: string;
  loading: boolean;
  metrics: AdminGrowthMetric[];
  orders: AdminGrowthOrder[];
  risks: AdminGrowthRisk[];
  services: AdminGrowthService[];
  source: "api" | "disabled" | "fallback";
  suppliers: AdminSupplierAudit[];
};

type ApiRisk = {
  platformPolicyRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  accountRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  refundRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reputationRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
};

type ApiService = {
  code: string;
  name: string;
  platform: string;
  enabled: boolean;
  baseRate: ApiMoney;
  marginBps: number;
  maximumQuantity: number;
  expectedCompletion: string;
  supplierRouting: {
    strategy: string;
    preferredSupplier?: string;
    fallbackSuppliers: string[];
  };
  risk: ApiRisk;
};

type ApiOrder = {
  id: string;
  serviceName: string;
  platform: string;
  destinationUrl: string;
  quantityOrdered: number;
  quantityDelivered: number;
  status: AdminGrowthStatus;
  amount: ApiMoney;
  supplierName?: string;
  supplierReference?: string;
  updatedAt: string;
};

type ApiOverview = {
  totals: Record<AdminGrowthStatus, number>;
  activeServices: number;
  disabledServices: number;
  revenue: ApiMoney;
  recentOrders: ApiOrder[];
};

type ApiSupplierAudit = {
  supportedProviders: Array<{
    name: string;
    configured: boolean;
    mode: string;
    routingRole: string;
    serviceMapCoverage: string[];
  }>;
  reliability: Array<{
    supplierName: string;
    status: "healthy" | "degraded" | "down";
    latencyMs: number;
  }>;
};

type ApiRiskReport = {
  services: Array<{
    serviceCode: string;
    serviceName: string;
    platform: string;
    risk: ApiRisk;
  }>;
};

export type UpdateGrowthServiceInput = {
  enabled?: boolean;
  marginBps?: number;
  preferredSupplier?: string;
  maximumQuantity?: number;
  expectedCompletion?: string;
};

export type UpdateGrowthOrderInput = {
  status?: AdminGrowthStatus;
  quantityDelivered?: number;
  supplierName?: string;
  supplierReference?: string;
  adminNote?: string;
  failureReason?: string;
};

export const defaultState: AdminGrowthState = {
  loading: false,
  metrics: fallbackMetrics,
  orders: fallbackOrders,
  risks: fallbackRisks,
  services: fallbackServices,
  source: adminGrowthEnabled ? "fallback" : "disabled",
  suppliers: fallbackSuppliers
};

function normalizePlatform(platform: string) {
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
}

function riskTone(risk: ApiRisk): AdminGrowthService["riskTone"] {
  if (
    risk.platformPolicyRisk === "CRITICAL" ||
    risk.accountRisk === "CRITICAL" ||
    risk.refundRisk === "CRITICAL" ||
    risk.reputationRisk === "CRITICAL"
  ) {
    return "danger";
  }
  if (
    risk.platformPolicyRisk === "HIGH" ||
    risk.accountRisk === "HIGH" ||
    risk.refundRisk === "HIGH" ||
    risk.reputationRisk === "HIGH"
  ) {
    return "warning";
  }

  return "info";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function mapService(service: ApiService): AdminGrowthService {
  return {
    code: service.code,
    name: service.name,
    platform: normalizePlatform(service.platform),
    enabled: service.enabled,
    price: `${formatMoney(service.baseRate)} / 1k`,
    marginBps: service.marginBps,
    maximumQuantity: service.maximumQuantity,
    expectedCompletion: service.expectedCompletion,
    preferredSupplier: service.supplierRouting.preferredSupplier ?? "auto",
    routingStrategy: service.supplierRouting.strategy,
    riskTone: riskTone(service.risk),
    riskSummary: service.risk.summary
  };
}

function mapOrder(order: ApiOrder): AdminGrowthOrder {
  return {
    id: order.id,
    serviceName: order.serviceName,
    platform: normalizePlatform(order.platform),
    destinationUrl: order.destinationUrl,
    quantityOrdered: order.quantityOrdered,
    quantityDelivered: order.quantityDelivered,
    status: order.status,
    amount: formatMoney(order.amount),
    supplierName: order.supplierName ?? "Unassigned",
    supplierReference: order.supplierReference ?? "Pending",
    updatedAt: formatDate(order.updatedAt)
  };
}

function mapSuppliers(audit: ApiSupplierAudit): AdminSupplierAudit[] {
  return audit.supportedProviders.map((provider) => {
    const health = audit.reliability.find((item) => item.supplierName === provider.name);

    return {
      name: provider.name,
      configured: provider.configured,
      mode: provider.mode,
      routingRole: provider.routingRole,
      serviceMapCoverage: provider.serviceMapCoverage.length,
      reliability: health?.status ?? "unknown",
      latencyMs: health?.latencyMs ?? 0
    };
  });
}

function mapRisks(report: ApiRiskReport): AdminGrowthRisk[] {
  return report.services.map((service) => ({
    serviceCode: service.serviceCode,
    serviceName: service.serviceName,
    platform: normalizePlatform(service.platform),
    platformPolicyRisk: service.risk.platformPolicyRisk,
    accountRisk: service.risk.accountRisk,
    refundRisk: service.risk.refundRisk,
    reputationRisk: service.risk.reputationRisk,
    summary: service.risk.summary
  }));
}

function buildMetrics(overview: ApiOverview): AdminGrowthMetric[] {
  const open = overview.totals.PENDING + overview.totals.SUBMITTED + overview.totals.IN_PROGRESS;

  return [
    { label: "Open orders", value: String(open), detail: "Pending or in delivery", tone: "info" },
    {
      label: "Completed",
      value: String(overview.totals.COMPLETED),
      detail: "Supplier delivery complete",
      tone: "success"
    },
    {
      label: "Disabled services",
      value: String(overview.disabledServices),
      detail: `${overview.activeServices} active services`,
      tone: "warning"
    },
    { label: "Revenue", value: formatMoney(overview.revenue), detail: "Completed order value" }
  ];
}

export async function loadAdminGrowthData() {
  if (!adminGrowthEnabled) {
    return defaultState;
  }

  const [overview, services, orders, suppliers, risks] = await Promise.all([
    apiRequest<ApiOverview>("/admin/growth/overview"),
    apiRequest<ApiService[]>("/admin/growth/services"),
    apiRequest<ApiOrder[]>("/admin/growth/orders"),
    apiRequest<ApiSupplierAudit>("/admin/growth/supplier-audit"),
    apiRequest<ApiRiskReport>("/admin/growth/risk-report")
  ]);

  return {
    loading: false,
    metrics: buildMetrics(overview),
    orders: orders.length > 0 ? orders.map(mapOrder) : overview.recentOrders.map(mapOrder),
    risks: mapRisks(risks),
    services: services.map(mapService),
    source: "api" as const,
    suppliers: mapSuppliers(suppliers)
  };
}

export async function updateGrowthService(code: string, input: UpdateGrowthServiceInput) {
  const service = await apiRequest<ApiService>(`/admin/growth/services/${code}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });

  return mapService(service);
}

export async function updateGrowthOrder(orderId: string, input: UpdateGrowthOrderInput) {
  const order = await apiRequest<ApiOrder>(`/admin/growth/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });

  return mapOrder(order);
}

export { subscribeToSessionChanges };
