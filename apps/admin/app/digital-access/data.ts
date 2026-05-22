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

export const services: AdminAccessService[] = [
  {
    id: "dasvc_chatgpt",
    name: "ChatGPT",
    category: "AI & Creator Tools",
    plans: 2,
    startingPrice: "NGN 6,500",
    eta: "5-30 mins",
    state: "active",
    demand: 42
  },
  {
    id: "dasvc_spotify",
    name: "Spotify Premium",
    category: "Streaming & Entertainment",
    plans: 1,
    startingPrice: "NGN 3,000",
    eta: "10-45 mins",
    state: "active",
    demand: 31
  },
  {
    id: "dasvc_canva_pro",
    name: "Canva Pro",
    category: "AI & Creator Tools",
    plans: 2,
    startingPrice: "NGN 4,000",
    eta: "10-45 mins",
    state: "active",
    demand: 28
  },
  {
    id: "dasvc_netflix",
    name: "Netflix",
    category: "Streaming & Entertainment",
    plans: 2,
    startingPrice: "Set price",
    eta: "15-60 mins",
    state: "draft",
    demand: 0
  },
  {
    id: "dasvc_fc26_coins",
    name: "FC26 Coins",
    category: "Gaming & Coins",
    plans: 2,
    startingPrice: "Set price",
    eta: "30-120 mins",
    state: "draft",
    demand: 0
  },
  {
    id: "dasvc_virtual_numbers",
    name: "Virtual Numbers",
    category: "Infrastructure",
    plans: 2,
    startingPrice: "Set price",
    eta: "10-60 mins",
    state: "draft",
    demand: 0
  }
];

export const requests: AdminAccessRequest[] = [
  {
    id: "DA-1042",
    customer: "Demo Creator",
    contact: "creator@example.com",
    service: "ChatGPT",
    plan: "Plus Access",
    amount: "NGN 6,500",
    status: "processing",
    assignedTo: "Support Lead",
    age: "18m"
  },
  {
    id: "DA-1041",
    customer: "Growth Team",
    contact: "+2348010000000",
    service: "Canva Pro",
    plan: "Pro Access",
    amount: "NGN 4,000",
    status: "pending",
    assignedTo: "Unassigned",
    age: "24m"
  },
  {
    id: "DA-1038",
    customer: "Music Desk",
    contact: "+2348020000000",
    service: "Spotify Premium",
    plan: "3 Month Access",
    amount: "NGN 3,000",
    status: "fulfilled",
    assignedTo: "Ops",
    age: "1d"
  },
  {
    id: "DA-1034",
    customer: "Infra Buyer",
    contact: "secure@example.com",
    service: "VPN Access",
    plan: "Secure Access",
    amount: "NGN 4,500",
    status: "failed",
    assignedTo: "Support Lead",
    age: "1d"
  }
];

export const metrics: AdminMetric[] = [
  { label: "Open requests", value: "17", detail: "Pending and processing", tone: "info" },
  { label: "Fulfilled today", value: "43", detail: "+12% from yesterday", tone: "success" },
  { label: "Refund rate", value: "3.1%", detail: "Auto reversals healthy", tone: "warning" },
  { label: "Revenue", value: "NGN 612k", detail: "Fulfilled request value" }
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
