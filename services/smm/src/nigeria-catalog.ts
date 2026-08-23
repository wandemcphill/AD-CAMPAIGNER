import type { DestinationKind, GrowthServiceCatalogItem, GrowthServicePlatform, SmmServiceKind } from "@fliptrybe/types";

const NIGERIA_RISK = {
  platformPolicyRisk: "HIGH" as const,
  accountRisk: "MEDIUM" as const,
  refundRisk: "MEDIUM" as const,
  reputationRisk: "HIGH" as const,
  summary: "Nigeria-focused growth delivery can drop or be filtered by platform integrity systems; use public destinations and monitor fulfillment.",
  mitigations: [
    "Require public destinations and reject private, restricted, or misleading links.",
    "Cap order sizes, monitor delivery deltas, and pause services with abnormal failure rates.",
    "Show customers that outcomes are delivery-based, not engagement quality or account safety guarantees."
  ]
};

const PRICE_PER_1000: Record<SmmServiceKind, number> = {
  FOLLOWERS: 620000,
  LIKES: 320000,
  VIEWS: 180000,
  COMMENTS: 700000,
  SHARES: 320000,
  LIVE_VIEWERS: 450000,
  CHANNEL_MEMBERS: 420000,
  ACCOUNT_SALE: 2500000,
  VPN_SUBSCRIPTION: 250000,
  STREAMING_SUBSCRIPTION: 250000
};

function makeNigeriaService(input: {
  code: string;
  name: string;
  platform: GrowthServicePlatform;
  category: string;
  serviceKind: SmmServiceKind;
  destinationKind: DestinationKind;
  quantityStep?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  expectedCompletion?: string;
  estimatedDeliveryMinutes?: number;
  supportsRefill?: boolean;
  risk?: typeof NIGERIA_RISK;
}): GrowthServiceCatalogItem {
  const quantityStep = input.quantityStep ?? 100;
  const minimumQuantity = input.minimumQuantity ?? quantityStep;
  const maximumQuantity = input.maximumQuantity ?? 50_000;
  const expectedCompletion = input.expectedCompletion ?? "4-24 hours";
  const estimatedDeliveryMinutes = input.estimatedDeliveryMinutes ?? 720;

  return {
    code: input.code,
    name: input.name,
    platform: input.platform,
    category: input.category,
    serviceKind: input.serviceKind,
    destinationKind: input.destinationKind,
    description: `${input.name}. Availability and the final customer quote are confirmed against the live supplier catalogue at order time.`,
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: PRICE_PER_1000[input.serviceKind], currency: "NGN" },
    minimumQuantity,
    maximumQuantity,
    quantityStep,
    estimatedDeliveryMinutes,
    expectedCompletion,
    marginBps: input.serviceKind === "LIVE_VIEWERS" ? 6500 : input.serviceKind === "COMMENTS" ? 6000 : 4500,
    supportsRefill: input.supportsRefill ?? !["COMMENTS", "SHARES", "LIVE_VIEWERS"].includes(input.serviceKind),
    supportsCancel: true,
    supplierRouting: {
      strategy: "PREFERRED_FIRST",
      preferredSupplier: "gsubz",
      fallbackSuppliers: ["sizzle"]
    },
    risk: input.risk ?? NIGERIA_RISK
  };
}

export const nigeriaGrowthServicesCatalog: GrowthServiceCatalogItem[] = [
  makeNigeriaService({ code: "tiktok-live-viewers-ng", name: "TikTok LIVE Viewers • Nigeria", platform: "TIKTOK", category: "TikTok • Nigeria", serviceKind: "LIVE_VIEWERS", destinationKind: "TIKTOK_LIVE", quantityStep: 100, minimumQuantity: 100, maximumQuantity: 100_000, expectedCompletion: "5-60 minutes", estimatedDeliveryMinutes: 60 }),
  makeNigeriaService({ code: "tiktok-live-likes-ng", name: "TikTok LIVE Likes • Nigeria", platform: "TIKTOK", category: "TikTok • Nigeria", serviceKind: "LIKES", destinationKind: "TIKTOK_LIVE", expectedCompletion: "5-60 minutes", estimatedDeliveryMinutes: 60 }),
  makeNigeriaService({ code: "tiktok-live-comments-ng", name: "TikTok LIVE Comments • Nigeria", platform: "TIKTOK", category: "TikTok • Nigeria", serviceKind: "COMMENTS", destinationKind: "TIKTOK_LIVE", quantityStep: 10, minimumQuantity: 10, maximumQuantity: 10_000, expectedCompletion: "10-120 minutes", estimatedDeliveryMinutes: 120 }),
  makeNigeriaService({ code: "tiktok-followers-ng", name: "TikTok Followers • Nigeria", platform: "TIKTOK", category: "TikTok • Nigeria", serviceKind: "FOLLOWERS", destinationKind: "TIKTOK_PROFILE", expectedCompletion: "12-72 hours", estimatedDeliveryMinutes: 720 }),
  makeNigeriaService({ code: "tiktok-likes-ng", name: "TikTok Likes • Nigeria", platform: "TIKTOK", category: "TikTok • Nigeria", serviceKind: "LIKES", destinationKind: "TIKTOK_PROFILE", expectedCompletion: "1-24 hours", estimatedDeliveryMinutes: 360 }),
  makeNigeriaService({ code: "tiktok-views-ng", name: "TikTok Views • Nigeria", platform: "TIKTOK", category: "TikTok • Nigeria", serviceKind: "VIEWS", destinationKind: "TIKTOK_PROFILE", expectedCompletion: "1-24 hours", estimatedDeliveryMinutes: 360 }),
  makeNigeriaService({ code: "tiktok-shares-ng", name: "TikTok Shares • Nigeria", platform: "TIKTOK", category: "TikTok • Nigeria", serviceKind: "SHARES", destinationKind: "TIKTOK_PROFILE", expectedCompletion: "1-24 hours", estimatedDeliveryMinutes: 360 }),
  makeNigeriaService({ code: "tiktok-comments-ng", name: "TikTok Comments • Nigeria", platform: "TIKTOK", category: "TikTok • Nigeria", serviceKind: "COMMENTS", destinationKind: "TIKTOK_PROFILE", quantityStep: 10, minimumQuantity: 10, maximumQuantity: 10_000, expectedCompletion: "2-48 hours", estimatedDeliveryMinutes: 480 }),

  makeNigeriaService({ code: "instagram-live-viewers-ng", name: "Instagram LIVE Viewers • Nigeria", platform: "INSTAGRAM", category: "Instagram • Nigeria", serviceKind: "LIVE_VIEWERS", destinationKind: "INSTAGRAM_LIVE", expectedCompletion: "5-60 minutes", estimatedDeliveryMinutes: 60 }),
  makeNigeriaService({ code: "instagram-live-likes-ng", name: "Instagram LIVE Likes • Nigeria", platform: "INSTAGRAM", category: "Instagram • Nigeria", serviceKind: "LIKES", destinationKind: "INSTAGRAM_LIVE", expectedCompletion: "5-60 minutes", estimatedDeliveryMinutes: 60 }),
  makeNigeriaService({ code: "instagram-followers-ng", name: "Instagram Followers • Nigeria", platform: "INSTAGRAM", category: "Instagram • Nigeria", serviceKind: "FOLLOWERS", destinationKind: "INSTAGRAM_PROFILE", expectedCompletion: "12-72 hours", estimatedDeliveryMinutes: 720 }),
  makeNigeriaService({ code: "instagram-likes-ng", name: "Instagram Likes • Nigeria", platform: "INSTAGRAM", category: "Instagram • Nigeria", serviceKind: "LIKES", destinationKind: "INSTAGRAM_PROFILE", expectedCompletion: "1-24 hours", estimatedDeliveryMinutes: 360 }),
  makeNigeriaService({ code: "instagram-reel-views-ng", name: "Instagram Reel Views • Nigeria", platform: "INSTAGRAM", category: "Instagram • Nigeria", serviceKind: "VIEWS", destinationKind: "INSTAGRAM_REEL", expectedCompletion: "1-24 hours", estimatedDeliveryMinutes: 360 }),
  makeNigeriaService({ code: "instagram-comments-ng", name: "Instagram Comments • Nigeria", platform: "INSTAGRAM", category: "Instagram • Nigeria", serviceKind: "COMMENTS", destinationKind: "INSTAGRAM_REEL", quantityStep: 10, minimumQuantity: 10, maximumQuantity: 10_000, expectedCompletion: "2-48 hours", estimatedDeliveryMinutes: 480 }),
  makeNigeriaService({ code: "instagram-shares-ng", name: "Instagram Shares • Nigeria", platform: "INSTAGRAM", category: "Instagram • Nigeria", serviceKind: "SHARES", destinationKind: "INSTAGRAM_REEL", expectedCompletion: "1-24 hours", estimatedDeliveryMinutes: 360 }),

  makeNigeriaService({ code: "youtube-views-ng", name: "YouTube Views • Nigeria", platform: "YOUTUBE", category: "YouTube • Nigeria", serviceKind: "VIEWS", destinationKind: "YOUTUBE_CHANNEL", expectedCompletion: "1-5 days", estimatedDeliveryMinutes: 1440 }),
  makeNigeriaService({ code: "youtube-subscribers-ng", name: "YouTube Subscribers • Nigeria", platform: "YOUTUBE", category: "YouTube • Nigeria", serviceKind: "CHANNEL_MEMBERS", destinationKind: "YOUTUBE_CHANNEL", quantityStep: 50, minimumQuantity: 50, maximumQuantity: 10_000, expectedCompletion: "2-7 days", estimatedDeliveryMinutes: 2880 }),
  makeNigeriaService({ code: "youtube-likes-ng", name: "YouTube Likes • Nigeria", platform: "YOUTUBE", category: "YouTube • Nigeria", serviceKind: "LIKES", destinationKind: "YOUTUBE_CHANNEL", expectedCompletion: "1-48 hours", estimatedDeliveryMinutes: 720 }),
  makeNigeriaService({ code: "youtube-comments-ng", name: "YouTube Comments • Nigeria", platform: "YOUTUBE", category: "YouTube • Nigeria", serviceKind: "COMMENTS", destinationKind: "YOUTUBE_CHANNEL", quantityStep: 10, minimumQuantity: 10, maximumQuantity: 5_000, expectedCompletion: "2-72 hours", estimatedDeliveryMinutes: 720 }),

  makeNigeriaService({ code: "telegram-members-ng", name: "Telegram Members • Nigeria", platform: "TELEGRAM", category: "Telegram • Nigeria", serviceKind: "CHANNEL_MEMBERS", destinationKind: "TELEGRAM_CHANNEL", expectedCompletion: "1-5 days", estimatedDeliveryMinutes: 1440 }),
  makeNigeriaService({ code: "telegram-views-ng", name: "Telegram Views • Nigeria", platform: "TELEGRAM", category: "Telegram • Nigeria", serviceKind: "VIEWS", destinationKind: "TELEGRAM_CHANNEL", expectedCompletion: "1-48 hours", estimatedDeliveryMinutes: 720 })
];
