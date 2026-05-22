import {
  Bot,
  Clapperboard,
  Gamepad2,
  KeyRound,
  Music2,
  Palette,
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
  { label: "AI Tools", slug: "ai-creator-tools", icon: Sparkles, tone: "text-sky-600" },
  { label: "Streaming", slug: "streaming-entertainment", icon: Tv, tone: "text-rose-600" },
  { label: "Gaming", slug: "gaming-coins", icon: Gamepad2, tone: "text-emerald-600" },
  { label: "VPN & Security", slug: "infrastructure", icon: ShieldCheck, tone: "text-amber-600" }
];

export const services: AccessService[] = [
  {
    id: "dasvc_chatgpt",
    name: "ChatGPT",
    category: "ai-creator-tools",
    slug: "chatgpt",
    description: "Creator research, writing, and workflow access handled by FlipTrybe ops.",
    startingPrice: "From NGN 6,500",
    deliveryEta: "5-30 mins",
    icon: Bot,
    featured: true,
    plans: [
      {
        id: "chatgpt-monthly",
        name: "Plus Access",
        duration: "1 month",
        price: "NGN 6,500",
        description: "Manual setup after wallet payment and request review."
      },
      {
        id: "chatgpt-quarter",
        name: "Creator Quarter",
        duration: "3 months",
        price: "NGN 18,000",
        description: "Longer access window for active creator teams."
      }
    ]
  },
  {
    id: "dasvc_canva_pro",
    name: "Canva Pro",
    category: "ai-creator-tools",
    slug: "canva-pro",
    description: "Design access for sellers, campaign operators, and creator teams.",
    startingPrice: "From NGN 4,000",
    deliveryEta: "10-45 mins",
    icon: Palette,
    featured: true,
    plans: [
      {
        id: "canva-monthly",
        name: "Pro Access",
        duration: "1 month",
        price: "NGN 4,000",
        description: "Workspace-ready access request."
      }
    ]
  },
  {
    id: "dasvc_capcut_pro",
    name: "CapCut Pro",
    category: "ai-creator-tools",
    slug: "capcut-pro",
    description: "Video editing access requests for short-form content teams.",
    startingPrice: "From NGN 5,500",
    deliveryEta: "10-45 mins",
    icon: Clapperboard,
    plans: [
      {
        id: "capcut-monthly",
        name: "Creator Access",
        duration: "1 month",
        price: "NGN 5,500",
        description: "Manual fulfillment for creator editing workflows."
      }
    ]
  },
  {
    id: "dasvc_spotify",
    name: "Spotify Premium",
    category: "streaming-entertainment",
    slug: "spotify",
    description: "Music access request with wallet-paid manual fulfillment.",
    startingPrice: "From NGN 3,000",
    deliveryEta: "10-45 mins",
    icon: Music2,
    featured: true,
    plans: [
      {
        id: "spotify-quarter",
        name: "3 Month Access",
        duration: "3 months",
        price: "NGN 3,000",
        description: "Manual access request handled by operations."
      }
    ]
  },
  {
    id: "dasvc_fc26_coins",
    name: "FC26 Coins",
    category: "gaming-coins",
    slug: "fc26-coins",
    description: "Game coin request workflow with fulfillment visibility.",
    startingPrice: "From NGN 10,000",
    deliveryEta: "30-120 mins",
    icon: Gamepad2,
    plans: [
      {
        id: "fc26-starter",
        name: "Starter Coins",
        duration: "One-time",
        price: "NGN 10,000",
        description: "Admin-reviewed topup request."
      }
    ]
  },
  {
    id: "dasvc_vpns",
    name: "VPN Access",
    category: "infrastructure",
    slug: "vpns",
    description: "Secure infrastructure access requests for creator and business workflows.",
    startingPrice: "From NGN 4,500",
    deliveryEta: "10-60 mins",
    icon: KeyRound,
    plans: [
      {
        id: "vpn-monthly",
        name: "Secure Access",
        duration: "1 month",
        price: "NGN 4,500",
        description: "Manual infrastructure request with support tracking."
      }
    ]
  }
];

export const requests: AccessRequest[] = [
  {
    id: "DA-1042",
    service: "ChatGPT",
    plan: "Plus Access",
    contact: "c***@example.com",
    amount: "NGN 6,500",
    status: "processing",
    createdAt: "Today, 09:24",
    updatedAt: "Ops reviewing request"
  },
  {
    id: "DA-1038",
    service: "Spotify Premium",
    plan: "3 Month Access",
    contact: "+234***22",
    amount: "NGN 3,000",
    status: "fulfilled",
    createdAt: "Yesterday, 17:10",
    updatedAt: "Fulfilled by admin"
  },
  {
    id: "DA-1034",
    service: "VPN Access",
    plan: "Secure Access",
    contact: "s***@example.com",
    amount: "NGN 4,500",
    status: "pending",
    createdAt: "Yesterday, 13:02",
    updatedAt: "Awaiting assignment"
  }
];

export const navItems = [
  { label: "Hub", href: "/digital-access", icon: Sparkles },
  { label: "Services", href: "/digital-access/services", icon: ShieldCheck },
  { label: "Requests", href: "/digital-access/requests", icon: KeyRound }
];

export const statusTone = {
  pending: "warning",
  processing: "info",
  fulfilled: "success",
  cancelled: "neutral",
  failed: "danger"
} as const;
