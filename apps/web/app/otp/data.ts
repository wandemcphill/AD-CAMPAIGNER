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

export type OtpStatus = "WAITING" | "RECEIVED" | "EXPIRED" | "REFUNDED" | "COMPLETED";

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

export const statusTone: Record<OtpStatus, "neutral" | "success" | "warning" | "danger" | "info"> =
  {
    WAITING: "warning",
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

export const services = [
  {
    name: "WhatsApp",
    country: "Nigeria",
    price: "NGN 340",
    stock: 1840,
    success: "97.8%",
    eta: "18s",
    tag: "Hot"
  },
  {
    name: "Telegram",
    country: "United Kingdom",
    price: "NGN 620",
    stock: 920,
    success: "96.1%",
    eta: "25s",
    tag: "Stable"
  },
  {
    name: "TikTok",
    country: "Canada",
    price: "NGN 780",
    stock: 736,
    success: "95.4%",
    eta: "31s",
    tag: "Live"
  },
  {
    name: "Instagram",
    country: "South Africa",
    price: "NGN 510",
    stock: 1188,
    success: "94.8%",
    eta: "28s",
    tag: "Value"
  },
  {
    name: "Facebook",
    country: "Germany",
    price: "NGN 690",
    stock: 340,
    success: "92.6%",
    eta: "54s",
    tag: "Guarded"
  }
];

export const orders: OtpOrder[] = [
  {
    id: "OTP-10482",
    service: "WhatsApp",
    country: "Nigeria",
    status: "WAITING",
    number: "+234 704 118 9321",
    code: null,
    amount: "NGN 340",
    route: "Budget route",
    requestedAt: "10:42",
    expiresIn: "07:12",
    events: [
      { label: "Number assigned", at: "10:42:12", tone: "success" },
      { label: "Listening for OTP", at: "10:42:14", tone: "warning" }
    ]
  },
  {
    id: "OTP-10481",
    service: "Telegram",
    country: "United Kingdom",
    status: "RECEIVED",
    number: "+44 7400 194 275",
    code: "824119",
    amount: "NGN 620",
    route: "Budget route",
    requestedAt: "10:35",
    expiresIn: "02:45",
    events: [
      { label: "Number assigned", at: "10:35:01", tone: "success" },
      { label: "Code received", at: "10:35:36", tone: "info" }
    ]
  },
  {
    id: "OTP-10480",
    service: "Facebook",
    country: "Germany",
    status: "COMPLETED",
    number: "+1 415 618 9042",
    code: "390144",
    amount: "NGN 1,120",
    route: "Guarded route",
    requestedAt: "10:20",
    expiresIn: "0:00",
    events: [
      { label: "Number assigned", at: "10:20:18", tone: "success" },
      { label: "Code received", at: "10:21:02", tone: "info" },
      { label: "Order completed", at: "10:21:16", tone: "success" }
    ]
  },
  {
    id: "OTP-10479",
    service: "Instagram",
    country: "South Africa",
    status: "EXPIRED",
    number: "+27 63 510 8841",
    code: null,
    amount: "NGN 510",
    route: "Budget route",
    requestedAt: "10:08",
    expiresIn: "0:00",
    events: [
      { label: "Number assigned", at: "10:08:10", tone: "success" },
      { label: "OTP window expired", at: "10:18:10", tone: "warning" }
    ]
  },
  {
    id: "OTP-10478",
    service: "TikTok",
    country: "Canada",
    status: "REFUNDED",
    number: "+1 647 388 2159",
    code: null,
    amount: "NGN 780",
    route: "Budget route",
    requestedAt: "09:58",
    expiresIn: "0:00",
    events: [
      { label: "Number assigned", at: "09:58:40", tone: "success" },
      { label: "Refund issued", at: "10:09:02", tone: "neutral" }
    ]
  }
];

export const walletLedger = [
  {
    label: "Wallet top-up",
    amount: "+NGN 85,000",
    rail: "Paystack",
    status: "COMPLETED",
    at: "10:05"
  },
  {
    label: "WhatsApp OTP debit",
    amount: "-NGN 340",
    rail: "OTP-10482",
    status: "WAITING",
    at: "10:42"
  },
  {
    label: "TikTok OTP refund",
    amount: "+NGN 780",
    rail: "OTP-10478",
    status: "REFUNDED",
    at: "10:09"
  },
  {
    label: "Facebook OTP purchase",
    amount: "-NGN 1,120",
    rail: "OTP-10480",
    status: "COMPLETED",
    at: "10:21"
  }
] as const;

export const quickStats = [
  {
    label: "Wallet balance",
    value: "NGN 248,900",
    detail: "Instant debit enabled",
    tone: "success" as const,
    icon: CreditCard
  },
  {
    label: "Active orders",
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
