import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CreditCard,
  Globe2,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Video,
  Wallet,
  Wand2,
  Zap
} from "lucide-react";

export type WorkflowStep = {
  detail: string;
  icon: LucideIcon;
  label: string;
  metric: string;
};

// The idea -> audience -> copy -> creative -> campaign pipeline the command bar simulates.
export const workflowSteps: WorkflowStep[] = [
  {
    detail: "Lagos buyers, creator affinity, mobile-first purchase paths",
    icon: Users,
    label: "Audience",
    metric: "2.4M reachable"
  },
  {
    detail: "Proof-led hooks, urgency windows, WhatsApp closing prompts",
    icon: Wand2,
    label: "Copy",
    metric: "18 variants"
  },
  {
    detail: "Product silhouette, offer stack, platform-safe exports",
    icon: Sparkles,
    label: "Creative",
    metric: "4 formats"
  },
  {
    detail: "Storyboard beats, kinetic captions, thumb-stop motion",
    icon: Video,
    label: "Video",
    metric: "6 cuts"
  },
  {
    detail: "Meta, TikTok, Google, and WhatsApp campaign packet",
    icon: Zap,
    label: "Launch",
    metric: "Live"
  }
];

export const channels = [
  { icon: ShoppingBag, label: "Meta", metric: "48k avg. reach" },
  { icon: Video, label: "TikTok", metric: "12 reels/wk" },
  { icon: Search, label: "Google", metric: "6.8x intent" },
  { icon: MessageCircle, label: "WhatsApp", metric: "320 chats" }
];

export type ProductPillar = {
  cta: string;
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
};

// Grounded in the real /os routes — see fliptrybe_route_map_canonical_vs_legacy.json.
export const productPillars: ProductPillar[] = [
  {
    cta: "Build a campaign",
    description:
      "A guided wizard turns an objective, a budget, and a creative upload into a live Meta, TikTok, Google, or WhatsApp campaign.",
    href: "/register",
    icon: Zap,
    title: "Campaign Builder"
  },
  {
    cta: "Explore the marketplace",
    description:
      "Airtime, data, bills, gift cards, and growth services in one unified marketplace — no more juggling five different apps.",
    href: "/guest",
    icon: ShoppingBag,
    title: "Unified Marketplace"
  },
  {
    cta: "See financial products",
    description:
      "Virtual accounts, virtual cards, and cross-border remittance — orchestrated through regulated financial infrastructure partners.",
    href: "/register",
    icon: Wallet,
    title: "Financial Hub"
  },
  {
    cta: "Grow with creators",
    description:
      "Book vetted agencies, freelancers, and SMM services to scale reach, engagement, and social proof around your campaigns.",
    href: "/register",
    icon: Globe2,
    title: "Growth Services"
  }
];

export const trustSignals = [
  { icon: ShieldCheck, label: "Ledger-backed transactions" },
  { icon: Banknote, label: "Regulated financial partners" },
  { icon: CreditCard, label: "No card data touches our servers" }
];

export const navItems = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#products", label: "Products" },
  // The only public, no-account flow on the platform (airtime, data, bills).
  { href: "/guest", label: "Pay bills" }
];
