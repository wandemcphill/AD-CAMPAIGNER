import {
  BarChart3,
  Bell,
  CreditCard,
  Gauge,
  Megaphone,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  type LucideIcon
} from "lucide-react";

import {
  campaignObjectives,
  type CampaignObjective,
  type CampaignStatus,
  type DestinationKind,
  type Money
} from "@fliptrybe/types";

export type ClientDataSource = "api" | "fallback";

export type CampaignAnalyticsMetric = {
  name: string;
  value: number;
  dimensions?: Record<string, string>;
  recordedAt?: string;
};

export type CampaignTrendPoint = {
  day: string;
  spendMinor: number;
  conversions: number;
};

export type CampaignAnalyticsOverview = {
  metrics: CampaignAnalyticsMetric[];
  trend: CampaignTrendPoint[];
};

export type CampaignAiInsight = {
  id: string;
  label: string;
  metrics: Record<string, string | number | boolean | null>;
  dimensions: Record<string, string>;
  reasons: string[];
};

export type CampaignAiInsights = {
  summary?: Record<string, unknown>;
  items: CampaignAiInsight[];
  trace_id?: string | null;
};

export type CampaignQuote = {
  estimatedReach: {
    min: number;
    max: number;
  };
  estimatedCpmMinor: number;
  currency: Money["currency"];
};

export type BillingActivity = {
  id: string;
  label: string;
  amount: string;
  reference: string;
  status: string;
  at: string;
};

export type PlatformHealth = {
  status: string;
  service: string;
  checkedAt: string;
  providers: Record<string, string>;
  operations?: Record<string, unknown>;
};

export const campaignNavItems = [
  { label: "Studio", href: "/studio", icon: Rocket },
  { label: "My Campaigns", href: "/campaigns", icon: Gauge },
  { label: "Start a Campaign", href: "/campaigns/new", icon: Sparkles },
  { label: "Campaign Reports", href: "/reports", icon: BarChart3 },
  { label: "Wallet & Billing", href: "/billing", icon: CreditCard },
  { label: "Business Setup", href: "/onboarding", icon: ShieldCheck },
  { label: "Notifications", href: "/notifications", icon: Bell }
] satisfies Array<{ label: string; href: string; icon: LucideIcon }>;

export const objectiveOptions = campaignObjectives;

export const destinationLabels: Record<DestinationKind, string> = {
  TIKTOK_PROFILE: "TikTok profile",
  TIKTOK_LIVE: "TikTok LIVE",
  TIKTOK_BOX_GAME: "TikTok box game",
  TIKTOK_SHOP: "TikTok Shop",
  INSTAGRAM_PROFILE: "Instagram profile",
  INSTAGRAM_REEL: "Instagram Reel",
  INSTAGRAM_LIVE: "Instagram Live",
  FACEBOOK_PAGE: "Facebook page",
  FACEBOOK_LIVE: "Facebook Live",
  WHATSAPP_CHANNEL: "WhatsApp channel",
  WHATSAPP_GROUP: "WhatsApp group",
  TELEGRAM_CHANNEL: "Telegram channel",
  TELEGRAM_GROUP: "Telegram group",
  YOUTUBE_CHANNEL: "YouTube channel",
  WEBSITE: "Website",
  APP: "App",
  ECOMMERCE_STORE: "Ecommerce store",
  FLIPTRYBE_STORE: "FlipTrybe store"
};

export const objectiveLabels: Record<CampaignObjective, string> = {
  AWARENESS: "Awareness",
  ENGAGEMENT: "Engagement",
  TRAFFIC: "Traffic",
  LEADS: "Leads",
  SALES: "Sales",
  APP_INSTALLS: "App installs",
  FOLLOWERS: "Followers",
  LIVE_VIEWERS: "Live viewers"
};

export const campaignStatusTone: Record<
  CampaignStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  APPROVED: "info",
  CHANGES_REQUESTED: "warning",
  CREATIVE_IN_PROGRESS: "info",
  QUEUED: "info",
  ACTIVE: "success",
  RUNNING: "success",
  PAUSED: "warning",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "danger",
  FAILED: "danger"
};

export const fallbackDestinations: DestinationKind[] = [
  "TIKTOK_LIVE",
  "INSTAGRAM_REEL",
  "WHATSAPP_CHANNEL",
  "YOUTUBE_CHANNEL",
  "WEBSITE",
  "FLIPTRYBE_STORE"
];

export const onboardingSteps = [
  { label: "Workspace session", icon: ShieldCheck },
  { label: "Destinations", icon: Megaphone },
  { label: "Billing rail", icon: WalletCards },
  { label: "First campaign", icon: Rocket },
  { label: "Provider check", icon: Settings2 }
] satisfies Array<{ label: string; icon: LucideIcon }>;
