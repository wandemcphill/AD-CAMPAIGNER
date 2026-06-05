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

export const fallbackServices: AdminGrowthService[] = [
  {
    code: "tiktok-views",
    name: "TikTok Views",
    platform: "TikTok",
    enabled: true,
    price: "NGN 1,800 / 1k",
    marginBps: 3500,
    maximumQuantity: 100000,
    expectedCompletion: "4-24 hours",
    preferredSupplier: "auto",
    routingStrategy: "LOWEST_COST",
    riskTone: "warning",
    riskSummary: "Artificial views can be filtered or reviewed by platform systems."
  },
  {
    code: "website-traffic",
    name: "Website Traffic",
    platform: "Website",
    enabled: false,
    price: "NGN 2,500 / 1k",
    marginBps: 3500,
    maximumQuantity: 250000,
    expectedCompletion: "2-7 days",
    preferredSupplier: "manual",
    routingStrategy: "MANUAL_REVIEW",
    riskTone: "danger",
    riskSummary: "Disabled until source quality controls are approved."
  }
];

export const fallbackOrders: AdminGrowthOrder[] = [
  {
    id: "GR-1042",
    serviceName: "TikTok Views",
    platform: "TikTok",
    destinationUrl: "https://www.tiktok.com/@fliptrybe",
    quantityOrdered: 1000,
    quantityDelivered: 640,
    status: "IN_PROGRESS",
    amount: "NGN 2,700",
    supplierName: "mock-smm",
    supplierReference: "mock_smm",
    updatedAt: "Delivery in progress"
  }
];

export const fallbackSuppliers: AdminSupplierAudit[] = [
  {
    name: "mock-smm",
    configured: true,
    mode: "mock",
    routingRole: "primary",
    serviceMapCoverage: 0,
    reliability: "healthy",
    latencyMs: 12
  }
];

export const fallbackRisks: AdminGrowthRisk[] = [
  {
    serviceCode: "youtube-subscribers",
    serviceName: "YouTube Subscribers",
    platform: "YouTube",
    platformPolicyRisk: "CRITICAL",
    accountRisk: "HIGH",
    refundRisk: "HIGH",
    reputationRisk: "HIGH",
    summary: "Subscriber services are highly exposed to spam and fake engagement enforcement."
  }
];

export const fallbackMetrics: AdminGrowthMetric[] = [
  { label: "Open orders", value: "1", detail: "Pending or in delivery", tone: "info" },
  { label: "Active services", value: "8", detail: "Customer-visible", tone: "success" },
  { label: "Disabled services", value: "1", detail: "Awaiting controls", tone: "warning" },
  { label: "Revenue", value: "NGN 0", detail: "Completed order value" }
];

export const navItems: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Overview", href: "/growth-services", icon: Store },
  { label: "Orders", href: "/growth-services/orders", icon: ListChecks },
  { label: "Services", href: "/growth-services/services", icon: SlidersHorizontal },
  { label: "Suppliers", href: "/growth-services/suppliers", icon: Route },
  { label: "Risk", href: "/growth-services/risk", icon: FileWarning }
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
