import {
  Activity,
  BadgeDollarSign,
  ClipboardList,
  FileClock,
  Gauge,
  Network,
  ShieldAlert
} from "lucide-react";
import type { ComponentType } from "react";

export type OtpStatus =
  | "CHARGED"
  | "ALLOCATING"
  | "WAITING"
  | "RECEIVED"
  | "EXPIRED"
  | "REFUNDED"
  | "COMPLETED";
export type ProviderState = "healthy" | "degraded" | "paused";

export type AdminOtpProvider = {
  name: string;
  state: ProviderState;
  fill: string;
  latency: string;
  stock: number;
  refund: string;
  spend: string;
  enabled: boolean;
};

export type AdminOtpPricingRule = {
  tier: "BUDGET" | "PREMIUM";
  markupBps: number;
  minimumMarginMinor: number;
  platformFeeMinor: number;
  customerCurrency: string;
  usdToNgnRate: number;
};

export type AdminOtpRiskSignal = {
  label: string;
  entity: string;
  severity: "High" | "Medium" | "Low";
  action: string;
};

export type AdminOtpAuditEvent = {
  id: string;
  event: string;
  actor: string;
  target: string;
  at: string;
  tone: "info" | "neutral" | "success" | "warning";
};

export type AdminOtpOrder = {
  id: string;
  user: string;
  service: string;
  provider: string;
  status: OtpStatus;
  amount: string;
  risk: string;
  age: string;
};

export type AdminOtpMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "info";
  icon: ComponentType<{ className?: string }>;
};

export const navItems = [
  { label: "Overview", href: "/otp", icon: Activity },
  { label: "Providers", href: "/otp/providers", icon: Network },
  { label: "Orders", href: "/otp/orders", icon: ClipboardList },
  { label: "Risk", href: "/otp/risk", icon: ShieldAlert },
  { label: "Pricing", href: "/otp/pricing", icon: BadgeDollarSign },
  { label: "Audit", href: "/otp/audit", icon: FileClock }
] as const;

export const statusTone: Record<OtpStatus, "neutral" | "success" | "warning" | "danger" | "info"> =
  {
    WAITING: "warning",
    CHARGED: "info",
    ALLOCATING: "warning",
    RECEIVED: "info",
    EXPIRED: "danger",
    REFUNDED: "neutral",
    COMPLETED: "success"
  };

export const providerTone: Record<ProviderState, "success" | "warning" | "danger"> = {
  healthy: "success",
  degraded: "warning",
  paused: "danger"
};

export const healthBars = [82, 94, 88, 96, 91, 75, 84, 93, 89, 97, 92, 86];

export const overviewMetrics: AdminOtpMetric[] = [
  {
    label: "OTP GMV",
    value: "NGN 42.8M",
    detail: "+14.2% this week",
    tone: "success" as const,
    icon: BadgeDollarSign
  },
  {
    label: "Live orders",
    value: "214",
    detail: "37 waiting now",
    tone: "warning" as const,
    icon: ClipboardList
  },
  {
    label: "Provider fill",
    value: "95.6%",
    detail: "5 live routes",
    tone: "info" as const,
    icon: Gauge
  },
  {
    label: "Risk reviews",
    value: "9",
    detail: "2 escalated",
    tone: "warning" as const,
    icon: ShieldAlert
  }
];
