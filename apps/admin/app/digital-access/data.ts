import {
  BarChart3,
  Clock,
  KeyRound,
  Layers3,
  ListChecks,
  SlidersHorizontal,
  Sparkles,
  TicketCheck,
  type LucideIcon
} from "lucide-react";

export type AdminAccessStatus = "pending" | "processing" | "fulfilled" | "cancelled" | "failed";
export type AdminServiceState = "active" | "draft" | "paused";

export type AdminAccessService = {
  id: string;
  name: string;
  category: string;
  plans: number;
  startingPrice: string;
  eta: string;
  state: AdminServiceState;
  demand: number;
};

export type AdminAccessRequest = {
  id: string;
  customer: string;
  contact: string;
  service: string;
  plan: string;
  amount: string;
  status: AdminAccessStatus;
  assignedTo: string;
  age: string;
};

export type AdminMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

export const adminAccessEnabled = process.env.NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN === "true";

export const navItems: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Overview", href: "/digital-access", icon: Sparkles },
  { label: "Requests", href: "/digital-access/requests", icon: ListChecks },
  { label: "Services", href: "/digital-access/services", icon: Layers3 },
  { label: "Pricing", href: "/digital-access/pricing", icon: SlidersHorizontal },
  { label: "Analytics", href: "/digital-access/analytics", icon: BarChart3 }
];

export const statusTone = {
  pending: "warning",
  processing: "info",
  fulfilled: "success",
  cancelled: "neutral",
  failed: "danger"
} as const;

export const serviceTone = {
  active: "success",
  draft: "warning",
  paused: "neutral"
} as const;

export const timeline = [
  { icon: TicketCheck, label: "Request submitted", value: "Wallet charged" },
  { icon: Clock, label: "Admin processing", value: "Manual fulfillment" },
  { icon: KeyRound, label: "Closeout", value: "Fulfilled or reversed" }
];
