import {
  BarChart3,
  ShieldAlert,
  Users,
  type LucideIcon
} from "lucide-react";

export type GrowthService = {
  code: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  price: string;
  pricingModel: "PER_1000" | "FLAT";
  destinationKind: string;
  minimumQuantity: number;
  maximumQuantity: number;
  quantityStep: number;
  expectedCompletion: string;
  enabled: boolean;
  riskTone: "neutral" | "success" | "warning" | "danger" | "info";
  riskSummary: string;
  icon: LucideIcon;
};

export type GrowthOrderStatus =
  | "PENDING"
  | "SUBMITTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type GrowthOrder = {
  id: string;
  serviceName: string;
  platform: string;
  destinationUrl?: string;
  deliveryContact?: string;
  quantityOrdered: number;
  quantityDelivered: number;
  status: GrowthOrderStatus;
  amount: string;
  expectedCompletionAt: string;
  updatedAt: string;
};

export type GrowthMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

export const growthEnabled = process.env.NEXT_PUBLIC_ENABLE_GROWTH_SERVICES !== "false";

export const statusTone = {
  PENDING: "warning",
  SUBMITTED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  FAILED: "danger",
  REFUNDED: "neutral"
} as const;

export const navItems = [
  { label: "Storefront", href: "/os/growth", icon: Users },
  { label: "Services", href: "/os/growth/services", icon: ShieldAlert },
  { label: "Orders", href: "/os/growth/orders", icon: BarChart3 }
];
