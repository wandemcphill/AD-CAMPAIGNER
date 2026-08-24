import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Banknote,
  CircleDollarSign,
  Euro,
  BarChart3,
  CreditCard,
  FileText,
  Gift,
  Globe2,
  GraduationCap,
  Landmark,
  Link2,
  Megaphone,
  MapPinned,
  Plane,
  Palette,
  Receipt,
  Send,
  Signal,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Tv,
  PlayCircle,
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
 * The four tiers are deliberately distinct and must not be used loosely:
 *   live             — completable end-to-end today, in every market we serve.
 *   selected-markets — built and enabled, but only for some corridors/regions.
 *   early-access     — real, but gated to invited workspaces rather than open.
 *   soon             — not completable yet. Covers both "flag off pending
 *                      provider/compliance sign-off" and "not built".
 * When in doubt, pick the weaker claim.
 *
 * See docs/PHASE0-RECON.md for the audit this mapping came from.
 */
export type CapabilityStatus = "live" | "selected-markets" | "early-access" | "soon";

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
    // walletWithdrawals defaults false — same sandbox-verification gate as
    // remittance, since it reuses the NGN payout adapters.
    description: "Withdraw a settled balance to your bank account.",
    icon: Banknote,
    status: "soon",
    title: "Payouts"
  },
  {
    description: "Hold and settle in NGN today, with USD, GBP and EUR next.",
    icon: Globe2,
    status: "soon",
    title: "Multi-currency balances"
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
    description: "Convert between supported currencies at a quoted rate.",
    icon: ArrowLeftRight,
    status: "soon",
    title: "FX"
  },
  {
    description: "Cross-border transfers on supported corridors.",
    icon: Send,
    status: "soon",
    title: "International transfers"
  }
];

/**
 * Remittance corridors. These mirror the six seeded in the API
 * (apps/api/src/modules/financial-products/remittance-corridor.service.ts) —
 * inbound to West Africa from GB/US, NOT outbound from Nigeria. Every corridor
 * there is created `enabled: false` pending provider verification and
 * KYB/compliance sign-off, so none may be advertised as live, and no exchange
 * rate is quoted here because we have no verified public rate to quote.
 */
export const remittanceCorridors = [
  { from: "United Kingdom", fromCode: "GBP", to: "Nigeria", toCode: "NGN" },
  { from: "United States", fromCode: "USD", to: "Nigeria", toCode: "NGN" },
  { from: "United Kingdom", fromCode: "GBP", to: "Ghana", toCode: "GHS" },
  { from: "United States", fromCode: "USD", to: "Ghana", toCode: "GHS" },
  { from: "United Kingdom", fromCode: "GBP", to: "Liberia", toCode: "LRD" },
  { from: "United States", fromCode: "USD", to: "Liberia", toCode: "LRD" }
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
    description: "Brief once and run on Meta, Google and TikTok from one place.",
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

/** Ad platforms we run campaigns on, shown in the Growth pillar. */
export const adPlatforms = ["Meta", "Google", "TikTok"];

/** The campaign lifecycle, shown as a flow in the Growth pillar. */
export const growthStages = ["Audience", "Creative", "Launch", "Optimise", "Conversion"];

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

/**
 * Public nav. Every entry must resolve to a section that exists on this page or
 * a real route — no links to pages we haven't built. "Resources" is still
 * absent: there is no documentation/blog surface to point it at, and a nav item
 * leading nowhere is worse than one missing.
 */
export const navItems = [
  { href: "#money", label: "Money" },
  { href: "#services", label: "Services" },
  { href: "#growth", label: "Grow" },
  { href: "#marketplace", label: "Marketplace" },
  { href: "#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/guest", label: "Pay a bill" }
];

/** "How it works" — three honest steps, no account required for step one. */
export const howItWorks = [
  {
    body: "Pay a bill or buy airtime as a guest — no signup, no account, receipt included.",
    step: "01",
    title: "Start without an account"
  },
  {
    body: "Create a free account to keep your receipts, hold a balance and invoice clients.",
    step: "02",
    title: "Open your workspace"
  },
  {
    body: "Brief a campaign and put your business in front of the right customers.",
    step: "03",
    title: "Grow when you're ready"
  }
];

/**
 * Marketplace teaser. The marketplace agency/creator listings are served by a
 * @Public() API controller, so this section describes a genuinely public
 * surface — but the browsable directory itself lives behind /os, so the CTA
 * points at registration rather than pretending a public listing page exists.
 */
export const marketplaceHighlights = [
  { icon: Users, label: "Vetted creators you can hire for campaigns" },
  { icon: Store, label: "Agencies that run growth end-to-end" },
  { icon: Megaphone, label: "Brief, book and track the work in one place" }
];

export const trustSignals = [
  { icon: Sparkles, label: "Every transaction gets a receipt and reference" },
  { icon: Wallet, label: "Ledger-backed balances" },
  { icon: CreditCard, label: "Card details never touch our servers" }
];


export type UseCase = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  status: CapabilityStatus;
  tag: string;
};

export const customerUseCases: UseCase[] = [
  {
    eyebrow: "Global money",
    title: "Send money home from the US, UK, Europe or Canada.",
    description: "Move money into Nigeria through supported corridors, with the route and availability shown before you start.",
    icon: Send,
    href: "/register",
    status: "soon",
    tag: "International transfers"
  },
  {
    eyebrow: "Multi-currency",
    title: "Keep USD, GBP and EUR balances in one place.",
    description: "A global money layer for people who earn, travel, subscribe and operate across currencies.",
    icon: CircleDollarSign,
    href: "/register",
    status: "soon",
    tag: "USD · GBP · EUR"
  },
  {
    eyebrow: "Global spending",
    title: "Use a virtual card for subscriptions and foreign websites.",
    description: "A future-ready card layer for software, streaming, travel and other international online payments.",
    icon: CreditCard,
    href: "/register",
    status: "soon",
    tag: "Virtual card"
  },
  {
    eyebrow: "Travel",
    title: "Flights, safaris, tours and experiences.",
    description: "Discover travel products from one platform instead of stitching together multiple booking journeys.",
    icon: Plane,
    href: "/register",
    status: "soon",
    tag: "Travel"
  },
  {
    eyebrow: "China",
    title: "Pay suppliers and businesses in China.",
    description: "A cross-border purchasing and settlement lane designed for people and businesses buying from China.",
    icon: ShoppingBag,
    href: "/register",
    status: "soon",
    tag: "China payments"
  },
  {
    eyebrow: "TikTok growth",
    title: "Put Nigerian viewers around your TikTok LIVE.",
    description: "Use growth services to reach Nigerian audiences, build visibility and support creator growth.",
    icon: PlayCircle,
    href: "/register",
    status: "live",
    tag: "TikTok LIVE"
  },
  {
    eyebrow: "Audience growth",
    title: "Grow your Nigerian TikTok following.",
    description: "Campaign and creator-growth infrastructure designed around measurable audience acquisition.",
    icon: Users,
    href: "/register",
    status: "live",
    tag: "Followers & reach"
  },
  {
    eyebrow: "Everyday Nigeria",
    title: "Airtime, data, electricity, cable and more.",
    description: "Handle everyday services from the same account that powers your bigger money and growth workflows.",
    icon: Zap,
    href: "/guest",
    status: "live",
    tag: "Everyday services"
  }
];

export const moneyRoutes = [
  { from: "🇺🇸 United States", code: "USD", to: "🇳🇬 Nigeria", toCode: "NGN", status: "soon" as CapabilityStatus },
  { from: "🇬🇧 United Kingdom", code: "GBP", to: "🇳🇬 Nigeria", toCode: "NGN", status: "soon" as CapabilityStatus },
  { from: "🇪🇺 Europe", code: "EUR", to: "🇳🇬 Nigeria", toCode: "NGN", status: "soon" as CapabilityStatus },
  { from: "🇨🇦 Canada", code: "CAD", to: "🇳🇬 Nigeria", toCode: "NGN", status: "soon" as CapabilityStatus },
  { from: "🇳🇬 Nigeria", code: "NGN", to: "🇨🇳 China", toCode: "CNY", status: "soon" as CapabilityStatus }
];
