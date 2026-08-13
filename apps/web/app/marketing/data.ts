import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CreditCard,
  FileText,
  Gift,
  GraduationCap,
  Landmark,
  Link2,
  Megaphone,
  Palette,
  Receipt,
  Send,
  Signal,
  Smartphone,
  Sparkles,
  Store,
  Tv,
  Users,
  Wallet,
  Zap
} from "lucide-react";

/**
 * Capability status shown on the public site.
 *
 * This is a truthfulness contract, not decoration. "live" may only be used for a
 * capability that a customer can actually complete end-to-end today. Anything
 * whose feature flag defaults off in packages/feature-flags (virtual accounts,
 * virtual cards, remittance, multi-currency wallets, KYC) is "soon" until the
 * flag is enabled per-environment with a seeded ProviderConfig row.
 *
 * See docs/PHASE0-RECON.md for the audit this mapping came from.
 */
export type CapabilityStatus = "live" | "soon";

export type Capability = {
  description: string;
  icon: LucideIcon;
  status: CapabilityStatus;
  title: string;
};

export type Pillar = {
  blurb: string;
  capabilities: Capability[];
  eyebrow: string;
  headline: string;
  href: string;
  id: string;
  ctaLabel: string;
};

// ── MONEY ────────────────────────────────────────────────────────────────────
const moneyCapabilities: Capability[] = [
  {
    description: "Fund a naira wallet, hold budget, and settle across the platform.",
    icon: Wallet,
    status: "live",
    title: "Naira wallet"
  },
  {
    description: "Bill a client, track sent and viewed, and get paid online.",
    icon: FileText,
    status: "live",
    title: "Invoices"
  },
  {
    description: "Create a link, share it, and collect a one-off payment.",
    icon: Link2,
    status: "live",
    title: "Payment links"
  },
  {
    description: "Dedicated account numbers for collecting payments.",
    icon: Landmark,
    status: "soon",
    title: "Virtual accounts"
  },
  {
    description: "Issue cards for online spend in selected currencies.",
    icon: CreditCard,
    status: "soon",
    title: "Virtual cards"
  },
  {
    description: "Cross-border transfers on supported corridors.",
    icon: Send,
    status: "soon",
    title: "International transfers"
  }
];

// ── SERVICES ─────────────────────────────────────────────────────────────────
const servicesCapabilities: Capability[] = [
  {
    description: "MTN, Airtel, Glo and 9mobile — instant top-up.",
    icon: Smartphone,
    status: "live",
    title: "Airtime"
  },
  {
    description: "Every major bundle, delivered in seconds.",
    icon: Signal,
    status: "live",
    title: "Data"
  },
  {
    description: "Prepaid and postpaid meters, token delivered instantly.",
    icon: Zap,
    status: "live",
    title: "Electricity"
  },
  {
    description: "Renew your decoder subscription in one step.",
    icon: Tv,
    status: "live",
    title: "Cable TV"
  },
  {
    description: "WAEC, NECO, NABTEB and JAMB PINs on demand.",
    icon: GraduationCap,
    status: "live",
    title: "Education"
  },
  {
    description: "Buy and sell gift cards at competitive rates.",
    icon: Gift,
    status: "live",
    title: "Gift cards"
  }
];

// ── GROWTH ───────────────────────────────────────────────────────────────────
const growthCapabilities: Capability[] = [
  {
    description: "Brief a campaign and our operators plan, launch and optimise it.",
    icon: Megaphone,
    status: "live",
    title: "Managed campaigns"
  },
  {
    description: "Ad copy, flyers, product images and video cuts, generated for you.",
    icon: Palette,
    status: "live",
    title: "Creative studio"
  },
  {
    description: "Reach, clicks, conversions and spend in one report.",
    icon: BarChart3,
    status: "live",
    title: "Performance reporting"
  },
  {
    description: "Hire vetted creators and agencies to run growth with you.",
    icon: Users,
    status: "live",
    title: "Creator marketplace"
  }
];

export const pillars: Pillar[] = [
  {
    blurb:
      "Hold a balance, bill your clients, and get paid — with every movement recorded on a proper ledger.",
    capabilities: moneyCapabilities,
    ctaLabel: "Explore Money",
    eyebrow: "Money",
    headline: "Run the money side of your business.",
    href: "/register",
    id: "money"
  },
  {
    blurb:
      "Airtime, data, electricity, cable, exam PINs and gift cards — at competitive prices, delivered instantly.",
    capabilities: servicesCapabilities,
    ctaLabel: "Pay a bill now",
    eyebrow: "Services",
    headline: "Pay for what you need every day.",
    href: "/guest",
    id: "services"
  },
  {
    blurb:
      "Put your business in front of the right people, with creative and campaign management handled for you.",
    capabilities: growthCapabilities,
    ctaLabel: "Start growing",
    eyebrow: "Growth",
    headline: "Turn attention into customers.",
    href: "/register",
    id: "growth"
  }
];

/** Networks shown in the Services pillar. Order matches market share in NG. */
export const networks = ["MTN", "Airtel", "Glo", "9mobile"];

/**
 * Hero ticker events. These are ILLUSTRATIVE product moments, not live data —
 * every consumer of this list must label it as an example (see the hero's
 * "Example activity" caption). Do not wire real customer transactions here.
 */
export const heroEvents = [
  { amount: "+₦45,000", icon: Receipt, label: "Invoice paid", tone: "green" as const },
  { amount: "₦1,000", icon: Smartphone, label: "Airtime delivered", tone: "accent" as const },
  { amount: "2,480 clicks", icon: Megaphone, label: "Campaign running", tone: "purple" as const },
  { amount: "₦12,500", icon: Zap, label: "Electricity token sent", tone: "accent" as const },
  { amount: "+₦180,000", icon: Link2, label: "Payment link collected", tone: "green" as const }
];

export const guestServices = [
  { icon: Smartphone, label: "Airtime" },
  { icon: Signal, label: "Data" },
  { icon: Zap, label: "Electricity" },
  { icon: Tv, label: "Cable TV" },
  { icon: GraduationCap, label: "Education" },
  { icon: Store, label: "Betting" }
];

export const navItems = [
  { href: "#money", label: "Money" },
  { href: "#services", label: "Services" },
  { href: "#growth", label: "Grow" },
  { href: "/guest", label: "Pay a bill" }
];

export const trustSignals = [
  { icon: Sparkles, label: "Every transaction gets a receipt and reference" },
  { icon: Wallet, label: "Ledger-backed balances" },
  { icon: CreditCard, label: "Card details never touch our servers" }
];
