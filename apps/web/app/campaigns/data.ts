import {
  BarChart3,
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
  type Campaign,
  type CampaignObjective,
  type CampaignStatus,
  type DestinationKind,
  type Money,
  type Wallet
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
  { label: "Overview", href: "/campaigns", icon: Gauge },
  { label: "Builder", href: "/campaigns/new", icon: Sparkles },
  { label: "Analytics", href: "/campaigns/analytics", icon: BarChart3 },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Onboarding", href: "/onboarding", icon: ShieldCheck }
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

export const fallbackCampaigns: Campaign[] = [
  {
    id: "cmp_demo",
    workspaceId: "workspace_demo",
    creatorUserId: "user_demo",
    name: "TikTok LIVE launch boost",
    objective: "LIVE_VIEWERS",
    status: "ACTIVE",
    budget: { amountMinor: 350000, currency: "NGN" },
    destination: {
      kind: "TIKTOK_LIVE",
      url: "https://tiktok.com/@fliptrybe/live"
    },
    schedule: {
      startsAt: "2026-05-24T09:00:00.000Z",
      timezone: "Africa/Lagos"
    },
    provider: "MOCK",
    providerReference: "mock_ads_demo",
    createdAt: "2026-05-24T08:12:00.000Z",
    updatedAt: "2026-05-24T08:40:00.000Z"
  },
  {
    id: "cmp_reels_demo",
    workspaceId: "workspace_demo",
    creatorUserId: "user_demo",
    name: "Reels commerce sprint",
    objective: "SALES",
    status: "QUEUED",
    budget: { amountMinor: 225000, currency: "NGN" },
    destination: {
      kind: "INSTAGRAM_REEL",
      url: "https://instagram.com/fliptrybe"
    },
    schedule: {
      startsAt: "2026-05-24T13:30:00.000Z",
      timezone: "Africa/Lagos"
    },
    provider: "MOCK",
    providerReference: "mock_ads_reels",
    createdAt: "2026-05-23T17:12:00.000Z",
    updatedAt: "2026-05-24T07:05:00.000Z"
  },
  {
    id: "cmp_whatsapp_demo",
    workspaceId: "workspace_demo",
    creatorUserId: "user_demo",
    name: "WhatsApp channel growth",
    objective: "FOLLOWERS",
    status: "PENDING_REVIEW",
    budget: { amountMinor: 145000, currency: "NGN" },
    destination: {
      kind: "WHATSAPP_CHANNEL",
      url: "https://whatsapp.com/channel/fliptrybe"
    },
    schedule: {
      startsAt: "2026-05-25T10:00:00.000Z",
      timezone: "Africa/Lagos"
    },
    provider: "MANUAL",
    createdAt: "2026-05-23T11:20:00.000Z",
    updatedAt: "2026-05-23T11:22:00.000Z"
  }
];

export const fallbackWallet: Wallet = {
  id: "wallet_workspace_demo",
  workspaceId: "workspace_demo",
  availableBalance: { amountMinor: 1250000, currency: "NGN" },
  heldBalance: { amountMinor: 175000, currency: "NGN" },
  createdAt: "2026-05-24T08:00:00.000Z",
  updatedAt: "2026-05-24T08:00:00.000Z"
};

export const fallbackAnalytics: CampaignAnalyticsOverview = {
  metrics: [
    { name: "impressions", value: 428500, dimensions: { channel: "all" } },
    { name: "clicks", value: 18420, dimensions: { channel: "all" } },
    { name: "roi_bps", value: 1860, dimensions: { channel: "all" } },
    { name: "live_viewers", value: 1240, dimensions: { channel: "tiktok" } }
  ],
  trend: [
    { day: "Mon", spendMinor: 82000, conversions: 42 },
    { day: "Tue", spendMinor: 94000, conversions: 57 },
    { day: "Wed", spendMinor: 118000, conversions: 71 },
    { day: "Thu", spendMinor: 126000, conversions: 84 },
    { day: "Fri", spendMinor: 138000, conversions: 91 }
  ]
};

export const fallbackAiInsights: CampaignAiInsights = {
  summary: {
    mode: "local_fallback",
    account_id: "workspace_demo",
    campaign_count: fallbackCampaigns.length
  },
  items: fallbackCampaigns.map((campaign) => ({
    id: campaign.id,
    label: campaign.name,
    metrics: {
      budget_minor: campaign.budget.amountMinor,
      status: campaign.status
    },
    dimensions: {
      objective: campaign.objective,
      provider: campaign.provider,
      destination_kind: campaign.destination.kind
    },
    reasons: ["local_campaign_snapshot"]
  })),
  trace_id: null
};

export const fallbackBillingActivity: BillingActivity[] = [
  {
    id: "ledger_topup",
    label: "Wallet top-up",
    amount: "+NGN 850,000",
    reference: "mock_payment_demo",
    status: "COMPLETED",
    at: "Today, 08:00"
  },
  {
    id: "ledger_hold",
    label: "Campaign budget hold",
    amount: "-NGN 175,000",
    reference: "cmp_demo",
    status: "HELD",
    at: "Today, 08:40"
  }
];

export const fallbackHealth: PlatformHealth = {
  status: "fallback",
  service: "fliptrybe-web",
  checkedAt: "2026-05-24T08:00:00.000Z",
  providers: {
    ads: "mock-ads",
    payments: "mock-payments",
    smm: "mock-smm",
    storage: "mock-storage"
  }
};

export const onboardingSteps = [
  { label: "Workspace session", icon: ShieldCheck },
  { label: "Destinations", icon: Megaphone },
  { label: "Billing rail", icon: WalletCards },
  { label: "First campaign", icon: Rocket },
  { label: "Provider check", icon: Settings2 }
] satisfies Array<{ label: string; icon: LucideIcon }>;
