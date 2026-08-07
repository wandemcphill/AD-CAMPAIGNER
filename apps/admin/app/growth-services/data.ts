import {
  BarChart3,
  FileWarning,
  ListChecks,
  Route,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  type LucideIcon
} from "lucide-react";

export type AdminGrowthStatus =
  | "PENDING"
  | "SUBMITTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type AdminGrowthService = {
  code: string;
  name: string;
  platform: string;
  enabled: boolean;
  price: string;
  marginBps: number;
  maximumQuantity: number;
  expectedCompletion: string;
  preferredSupplier: string;
  routingStrategy: string;
  riskTone: "neutral" | "success" | "warning" | "danger" | "info";
  riskSummary: string;
};

export type AdminGrowthOrder = {
  id: string;
  serviceName: string;
  platform: string;
  destinationUrl: string;
  quantityOrdered: number;
  quantityDelivered: number;
  status: AdminGrowthStatus;
  amount: string;
  supplierName: string;
  supplierReference: string;
  updatedAt: string;
};

export type AdminSupplierAudit = {
  name: string;
  configured: boolean;
  mode: string;
  routingRole: string;
  serviceMapCoverage: number;
  reliability: "healthy" | "degraded" | "down" | "unknown";
  latencyMs: number;
};

export type AdminGrowthRisk = {
  serviceCode: string;
  serviceName: string;
  platform: string;
  platformPolicyRisk: string;
  accountRisk: string;
  refundRisk: string;
  reputationRisk: string;
  summary: string;
};

export type AdminGrowthMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

export const adminGrowthEnabled = process.env.NEXT_PUBLIC_ENABLE_GROWTH_SERVICES_ADMIN !== "false";

export const navItems: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Overview", href: "/growth-services/", icon: Store },
  { label: "Orders", href: "/growth-services/orders/", icon: ListChecks },
  { label: "Services", href: "/growth-services/services/", icon: SlidersHorizontal },
  { label: "Suppliers", href: "/growth-services/suppliers/", icon: Route },
  { label: "Risk", href: "/growth-services/risk/", icon: FileWarning }
];

export const statusTone = {
  PENDING: "warning",
  SUBMITTED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  FAILED: "danger",
  REFUNDED: "neutral"
} as const;

export const supplierTone = {
  healthy: "success",
  degraded: "warning",
  down: "danger",
  unknown: "neutral"
} as const;

export const riskIcon = ShieldAlert;
export const overviewIcon = BarChart3;
