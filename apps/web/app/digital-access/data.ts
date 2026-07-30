import {
  Gamepad2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Tv,
  type LucideIcon
} from "lucide-react";

export type AccessCategory = {
  label: string;
  slug: string;
  icon: LucideIcon;
  tone: string;
};

export type AccessPlan = {
  id: string;
  name: string;
  duration: string;
  price: string;
  description: string;
};

export type AccessService = {
  id: string;
  name: string;
  category: string;
  slug: string;
  description: string;
  startingPrice: string;
  deliveryEta: string;
  icon: LucideIcon;
  featured?: boolean;
  plans: AccessPlan[];
};

export type AccessRequest = {
  id: string;
  service: string;
  plan: string;
  contact: string;
  amount: string;
  status: "pending" | "processing" | "fulfilled" | "cancelled" | "failed";
  createdAt: string;
  updatedAt: string;
};

export const accessEnabled = process.env.NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS === "true";

export const categories: AccessCategory[] = [
  { label: "AI Tools", slug: "ai-creator-tools", icon: Sparkles, tone: "text-[var(--ft-accent)]" },
  {
    label: "Streaming",
    slug: "streaming-entertainment",
    icon: Tv,
    tone: "text-[var(--ft-purple)]"
  },
  { label: "Gaming", slug: "gaming-coins", icon: Gamepad2, tone: "text-[var(--ft-green)]" },
  {
    label: "VPN & Security",
    slug: "infrastructure",
    icon: ShieldCheck,
    tone: "text-[var(--ft-yellow)]"
  }
];

export const navItems = [
  { label: "Hub", href: "/os/digital-access", icon: Sparkles },
  { label: "Services", href: "/os/digital-access/services", icon: ShieldCheck },
  { label: "Requests", href: "/os/digital-access/requests", icon: KeyRound }
];

export const statusTone = {
  pending: "warning",
  processing: "info",
  fulfilled: "success",
  cancelled: "neutral",
  failed: "danger"
} as const;
