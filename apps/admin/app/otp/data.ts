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

export const providers: AdminOtpProvider[] = [
  {
    name: "5SIM Budget",
    state: "healthy" as const,
    fill: "98.2%",
    latency: "18s",
    stock: 1840,
    refund: "1.1%",
    spend: "NGN 2.8M"
  },
  {
    name: "SMS-Man Budget",
    state: "healthy" as const,
    fill: "96.1%",
    latency: "25s",
    stock: 920,
    refund: "1.8%",
    spend: "NGN 1.9M"
  },
  {
    name: "TextVerified Premium",
    state: "degraded" as const,
    fill: "91.4%",
    latency: "54s",
    stock: 406,
    refund: "4.9%",
    spend: "NGN 3.4M"
  },
  {
    name: "SMS-Activate Compatible",
    state: "paused" as const,
    fill: "82.0%",
    latency: "71s",
    stock: 0,
    refund: "9.8%",
    spend: "NGN 410K"
  }
];

export const orders: AdminOtpOrder[] = [
  {
    id: "OTP-10482",
    user: "creator@fliptrybe.test",
    service: "WhatsApp",
    provider: "5SIM Budget",
    status: "WAITING" as const,
    amount: "NGN 340",
    risk: "Low",
    age: "02m"
  },
  {
    id: "OTP-10481",
    user: "ops@market.test",
    service: "Telegram",
    provider: "SMS-Man Budget",
    status: "RECEIVED" as const,
    amount: "NGN 620",
    risk: "Low",
    age: "09m"
  },
  {
    id: "OTP-10480",
    user: "growth@studio.test",
    service: "Premium identity",
    provider: "TextVerified Premium",
    status: "COMPLETED" as const,
    amount: "NGN 1,120",
    risk: "Medium",
    age: "24m"
  },
  {
    id: "OTP-10479",
    user: "new@buyer.test",
    service: "Instagram",
    provider: "5SIM Budget",
    status: "EXPIRED" as const,
    amount: "NGN 510",
    risk: "Medium",
    age: "38m"
  },
  {
    id: "OTP-10478",
    user: "bulk@agency.test",
    service: "TikTok",
    provider: "SMS-Activate Compatible",
    status: "REFUNDED" as const,
    amount: "NGN 780",
    risk: "High",
    age: "51m"
  }
];

export const riskSignals = [
  {
    label: "High refund velocity",
    entity: "bulk@agency.test",
    severity: "High",
    action: "Limit route access"
  },
  {
    label: "Provider latency spike",
    entity: "TextVerified Premium",
    severity: "Medium",
    action: "Raise price guard"
  },
  {
    label: "Repeated expirations",
    entity: "new@buyer.test",
    severity: "Medium",
    action: "Shorten refund window"
  },
  {
    label: "Clean completion streak",
    entity: "5SIM Budget",
    severity: "Low",
    action: "Keep routing"
  }
];

export const pricingRows = [
  {
    service: "WhatsApp",
    country: "Nigeria",
    base: "NGN 260",
    markup: "31%",
    user: "NGN 340",
    margin: "NGN 80"
  },
  {
    service: "Telegram",
    country: "United Kingdom",
    base: "NGN 470",
    markup: "32%",
    user: "NGN 620",
    margin: "NGN 150"
  },
  {
    service: "Premium identity",
    country: "United States",
    base: "NGN 860",
    markup: "30%",
    user: "NGN 1,120",
    margin: "NGN 260"
  },
  {
    service: "TikTok",
    country: "Canada",
    base: "NGN 610",
    markup: "28%",
    user: "NGN 780",
    margin: "NGN 170"
  },
  {
    service: "Instagram",
    country: "South Africa",
    base: "NGN 390",
    markup: "31%",
    user: "NGN 510",
    margin: "NGN 120"
  }
];

export const auditEvents = [
  {
    event: "otp.provider.paused",
    actor: "Admin Operator",
    target: "SMS-Activate Compatible",
    at: "10:48",
    tone: "warning" as const
  },
  {
    event: "otp.refund.issued",
    actor: "Risk Engine",
    target: "OTP-10478",
    at: "10:09",
    tone: "neutral" as const
  },
  {
    event: "otp.price.updated",
    actor: "Pricing Desk",
    target: "Premium identity United States",
    at: "09:42",
    tone: "info" as const
  },
  {
    event: "otp.order.completed",
    actor: "Provider Webhook",
    target: "OTP-10480",
    at: "10:21",
    tone: "success" as const
  },
  {
    event: "otp.risk.flagged",
    actor: "Risk Engine",
    target: "bulk@agency.test",
    at: "09:58",
    tone: "warning" as const
  }
];

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
