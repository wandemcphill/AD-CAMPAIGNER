import {
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  TimerReset,
  Wallet
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

export type OtpOrder = {
  id: string;
  service: string;
  country: string;
  status: OtpStatus;
  number: string;
  code: string | null;
  amount: string;
  route: string;
  requestedAt: string;
  expiresIn: string;
  events: Array<{ label: string; at: string; tone: "success" | "warning" | "info" | "neutral" }>;
};

export type OtpServiceRow = {
  name: string;
  country: string;
  price: string;
  stock: number;
  success: string;
  eta: string;
  tag: string;
  serviceCode?: string;
  countryCode?: string;
};

export type OtpWalletSummary = {
  available: string;
  held: string;
  spentToday: string;
};

export type OtpWalletLedgerEntry = {
  label: string;
  amount: string;
  rail: string;
  status: "COMPLETED" | "WAITING" | "REFUNDED";
  at: string;
};

export type OtpMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "info";
  icon: ComponentType<{ className?: string }>;
};

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

export const navItems = [
  { label: "Desk", href: "/otp", icon: ShieldCheck },
  { label: "Services", href: "/otp/services", icon: Smartphone },
  { label: "Orders", href: "/otp/orders", icon: TimerReset },
  { label: "Wallet", href: "/otp/wallet", icon: Wallet }
] as const;

export const quickStats: OtpMetric[] = [
  {
    label: "Wallet balance",
    value: "NGN 248,900",
    detail: "Instant debit enabled",
    tone: "success" as const,
    icon: CreditCard
  },
  {
    label: "Live orders",
    value: "2",
    detail: "1 waiting, 1 received",
    tone: "warning" as const,
    icon: Clock3
  },
  {
    label: "Success rate",
    value: "96.4%",
    detail: "Across current routes",
    tone: "info" as const,
    icon: CheckCircle2
  },
  {
    label: "Refunds today",
    value: "NGN 2,180",
    detail: "Auto-reconciled",
    tone: "neutral" as const,
    icon: RefreshCcw
  }
];
