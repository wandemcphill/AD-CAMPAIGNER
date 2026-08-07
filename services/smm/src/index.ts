import type { SmmSupplierAdapter, SmmSupplierQuote } from "@fliptrybe/providers";
import type {
  CurrencyCode,
  DestinationKind,
  GrowthOrderStatus,
  GrowthServiceCatalogItem,
  GrowthServiceRouting,
  Money,
  PromotionDestination,
  SmmOrder,
  SmmServiceKind
} from "@fliptrybe/types";

export type SmmFraudRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type SmmFraudAction = "ALLOW" | "REVIEW" | "BLOCK";
export type SmmSupplierHealthStatus = "healthy" | "degraded" | "down";

export interface SmmPricingRule {
  serviceKind: SmmServiceKind;
  markupBps: number;
  rushMarkupBps: number;
  minimumMarginMinor: number;
  platformFeeMinor: number;
}

export interface SmmMarginResult {
  supplierCost: Money;
  customerPrice: Money;
  grossMargin: Money;
  marginBps: number;
  isProfitable: boolean;
}

export interface SmmPricedQuote extends SmmMarginResult {
  estimatedDeliveryMinutes: number;
  markupBps: number;
  minimumMarginApplied: boolean;
  supplierName?: string;
}

export interface SmmFraudSignal {
  code: string;
  message: string;
  score: number;
  severity: Exclude<SmmFraudRiskLevel, "LOW">;
}

export interface SmmFraudAssessment {
  score: number;
  riskLevel: SmmFraudRiskLevel;
  action: SmmFraudAction;
  signals: SmmFraudSignal[];
}

export interface SmmRetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface SmmFulfillmentQueueJob {
  orderId: string;
  workspaceId: string;
  serviceKind: SmmServiceKind;
  destinationKind: DestinationKind;
  destinationUrl?: string;
  deliveryContact?: string;
  quantity: number;
  supplierName?: string;
  supplierCost: Money;
  customerPrice: Money;
  grossMargin: Money;
  fraudRiskLevel: SmmFraudRiskLevel;
  retryPolicy: SmmRetryPolicy;
  enqueuedAt: string;
}

export interface SmmSupplierHealth {
  supplierName: string;
  status: SmmSupplierHealthStatus;
  latencyMs: number;
  checkedAt: string;
  reason?: string;
}

export interface SmmServiceHealthMonitor {
  checkSupplier(supplier: SmmSupplierAdapter): Promise<SmmSupplierHealth>;
  checkAll(): Promise<SmmSupplierHealth[]>;
}

export interface SmmSupplierAuditProvider {
  name: string;
  mode: "mock" | "perfect-panel";
  configured: boolean;
  apiHost?: string;
  supportedCategories: SmmServiceKind[];
  pricingModel: "per-1000-rate-card";
  routingRole: "primary" | "fallback" | "disabled";
  serviceMapCoverage: SmmServiceKind[];
}

export interface SmmSupplierAudit {
  supportedProviders: SmmSupplierAuditProvider[];
  serviceCategories: Array<{
    serviceKind: SmmServiceKind;
    label: string;
    compatibleDestinations: DestinationKind[];
  }>;
  pricingModels: Array<{
    name: string;
    description: string;
    marginBps: number;
    minimumMarginMinor: number;
    platformFeeMinor: number;
  }>;
  reliability: SmmSupplierHealth[];
}

export const smmService = {
  name: "smm",
  responsibilities: [
    "supplier APIs",
    "service catalog",
    "fulfillment",
    "retry policy",
    "pricing",
    "margin control",
    "fraud detection",
    "supplier health"
  ]
} as const;

export const defaultSmmPricingRules: SmmPricingRule[] = [
  {
    serviceKind: "FOLLOWERS",
    markupBps: 4500,
    rushMarkupBps: 1500,
    minimumMarginMinor: 150,
    platformFeeMinor: 50
  },
  {
    serviceKind: "LIKES",
    markupBps: 4000,
    rushMarkupBps: 1000,
    minimumMarginMinor: 100,
    platformFeeMinor: 25
  },
  {
    serviceKind: "VIEWS",
    markupBps: 3500,
    rushMarkupBps: 1000,
    minimumMarginMinor: 75,
    platformFeeMinor: 25
  },
  {
    serviceKind: "COMMENTS",
    markupBps: 6000,
    rushMarkupBps: 2000,
    minimumMarginMinor: 250,
    platformFeeMinor: 75
  },
  {
    serviceKind: "SHARES",
    markupBps: 4000,
    rushMarkupBps: 1000,
    minimumMarginMinor: 100,
    platformFeeMinor: 25
  },
  {
    serviceKind: "LIVE_VIEWERS",
    markupBps: 6500,
    rushMarkupBps: 2500,
    minimumMarginMinor: 300,
    platformFeeMinor: 100
  },
  {
    serviceKind: "CHANNEL_MEMBERS",
    markupBps: 5000,
    rushMarkupBps: 1500,
    minimumMarginMinor: 200,
    platformFeeMinor: 50
  }
];

export const defaultSmmRetryPolicy: SmmRetryPolicy = {
  attempts: 5,
  baseDelayMs: 30_000,
  maxDelayMs: 900_000,
  jitterRatio: 0.2
};

const sharedHighRiskMitigations = [
  "Require public destinations and reject private, restricted, or misleading links.",
  "Cap order sizes, monitor delivery deltas, and pause services with abnormal failure rates.",
  "Show customers that outcomes are delivery-based, not engagement quality or account safety guarantees."
];

export const defaultGrowthServicesCatalog: GrowthServiceCatalogItem[] = [
  {
    code: "tiktok-views",
    name: "TikTok Views",
    platform: "TIKTOK",
    category: "TikTok",
    serviceKind: "VIEWS",
    destinationKind: "TIKTOK_PROFILE",
    description: "View delivery for public TikTok videos and profile-linked posts.",
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 180000, currency: "NGN" },
    minimumQuantity: 100,
    maximumQuantity: 100_000,
    quantityStep: 100,
    estimatedDeliveryMinutes: 240,
    expectedCompletion: "4-24 hours",
    marginBps: 3500,
    supportsRefill: false,
    supportsCancel: true,
    supplierRouting: {
      strategy: "LOWEST_COST",
      fallbackSuppliers: ["smdpanel", "justanotherpanel", "sizzle", "peakerr"]
    },
    risk: {
      platformPolicyRisk: "HIGH",
      accountRisk: "MEDIUM",
      refundRisk: "MEDIUM",
      reputationRisk: "HIGH",
      summary: "Artificial view delivery can conflict with platform authenticity expectations.",
      mitigations: sharedHighRiskMitigations
    }
  },
  {
    code: "tiktok-likes",
    name: "TikTok Likes",
    platform: "TIKTOK",
    category: "TikTok",
    serviceKind: "LIKES",
    destinationKind: "TIKTOK_PROFILE",
    description: "Like delivery for public TikTok posts.",
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 320000, currency: "NGN" },
    minimumQuantity: 50,
    maximumQuantity: 50_000,
    quantityStep: 50,
    estimatedDeliveryMinutes: 360,
    expectedCompletion: "6-36 hours",
    marginBps: 4000,
    supportsRefill: true,
    supportsCancel: true,
    supplierRouting: {
      strategy: "LOWEST_COST",
      fallbackSuppliers: ["smdpanel", "smmraja", "justanotherpanel", "sizzle"]
    },
    risk: {
      platformPolicyRisk: "HIGH",
      accountRisk: "HIGH",
      refundRisk: "MEDIUM",
      reputationRisk: "HIGH",
      summary: "Artificial likes can be removed by platform integrity systems or trigger review.",
      mitigations: sharedHighRiskMitigations
    }
  },
  {
    code: "tiktok-followers",
    name: "TikTok Followers",
    platform: "TIKTOK",
    category: "TikTok",
    serviceKind: "FOLLOWERS",
    destinationKind: "TIKTOK_PROFILE",
    description: "Follower delivery for public TikTok profiles.",
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 620000, currency: "NGN" },
    minimumQuantity: 100,
    maximumQuantity: 25_000,
    quantityStep: 100,
    estimatedDeliveryMinutes: 720,
    expectedCompletion: "12-72 hours",
    marginBps: 4500,
    supportsRefill: true,
    supportsCancel: true,
    supplierRouting: {
      strategy: "PREFERRED_FIRST",
      preferredSupplier: "smdpanel",
      fallbackSuppliers: ["justanotherpanel", "sizzle", "peakerr"]
    },
    risk: {
      platformPolicyRisk: "CRITICAL",
      accountRisk: "HIGH",
      refundRisk: "HIGH",
      reputationRisk: "HIGH",
      summary:
        "Follower growth services carry the highest integrity, drop, and customer dispute risk.",
      mitigations: sharedHighRiskMitigations
    }
  },
  {
    code: "instagram-followers",
    name: "Instagram Followers",
    platform: "INSTAGRAM",
    category: "Instagram",
    serviceKind: "FOLLOWERS",
    destinationKind: "INSTAGRAM_PROFILE",
    description: "Follower delivery for public Instagram profiles.",
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 650000, currency: "NGN" },
    minimumQuantity: 100,
    maximumQuantity: 25_000,
    quantityStep: 100,
    estimatedDeliveryMinutes: 720,
    expectedCompletion: "12-72 hours",
    marginBps: 4500,
    supportsRefill: true,
    supportsCancel: true,
    supplierRouting: {
      strategy: "PREFERRED_FIRST",
      preferredSupplier: "justanotherpanel",
      fallbackSuppliers: ["smdpanel", "peakerr"]
    },
    risk: {
      platformPolicyRisk: "CRITICAL",
      accountRisk: "HIGH",
      refundRisk: "HIGH",
      reputationRisk: "HIGH",
      summary:
        "Artificial follower delivery can be removed and can expose accounts to integrity review.",
      mitigations: sharedHighRiskMitigations
    }
  },
  {
    code: "instagram-likes",
    name: "Instagram Likes",
    platform: "INSTAGRAM",
    category: "Instagram",
    serviceKind: "LIKES",
    destinationKind: "INSTAGRAM_PROFILE",
    description: "Like delivery for public Instagram posts or reels.",
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 300000, currency: "NGN" },
    minimumQuantity: 50,
    maximumQuantity: 50_000,
    quantityStep: 50,
    estimatedDeliveryMinutes: 360,
    expectedCompletion: "6-36 hours",
    marginBps: 4000,
    supportsRefill: true,
    supportsCancel: true,
    supplierRouting: {
      strategy: "LOWEST_COST",
      fallbackSuppliers: ["smdpanel", "smmraja", "justanotherpanel", "sizzle"]
    },
    risk: {
      platformPolicyRisk: "HIGH",
      accountRisk: "HIGH",
      refundRisk: "MEDIUM",
      reputationRisk: "HIGH",
      summary: "Artificial likes can conflict with authenticity rules and may drop after delivery.",
      mitigations: sharedHighRiskMitigations
    }
  },
  {
    code: "youtube-views",
    name: "YouTube Views",
    platform: "YOUTUBE",
    category: "YouTube",
    serviceKind: "VIEWS",
    destinationKind: "YOUTUBE_CHANNEL",
    description: "View delivery for public YouTube videos.",
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 450000, currency: "NGN" },
    minimumQuantity: 100,
    maximumQuantity: 100_000,
    quantityStep: 100,
    estimatedDeliveryMinutes: 1440,
    expectedCompletion: "1-5 days",
    marginBps: 3500,
    supportsRefill: false,
    supportsCancel: true,
    supplierRouting: {
      strategy: "LOWEST_COST",
      fallbackSuppliers: ["smdpanel", "justanotherpanel", "sizzle", "peakerr"]
    },
    risk: {
      platformPolicyRisk: "CRITICAL",
      accountRisk: "HIGH",
      refundRisk: "HIGH",
      reputationRisk: "HIGH",
      summary: "Invalid or incentivized views can be filtered and may affect channel standing.",
      mitigations: sharedHighRiskMitigations
    }
  },
  {
    code: "youtube-subscribers",
    name: "YouTube Subscribers",
    platform: "YOUTUBE",
    category: "YouTube",
    serviceKind: "CHANNEL_MEMBERS",
    destinationKind: "YOUTUBE_CHANNEL",
    description: "Subscriber delivery for public YouTube channels.",
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 900000, currency: "NGN" },
    minimumQuantity: 50,
    maximumQuantity: 10_000,
    quantityStep: 50,
    estimatedDeliveryMinutes: 2880,
    expectedCompletion: "2-7 days",
    marginBps: 5000,
    supportsRefill: true,
    supportsCancel: true,
    supplierRouting: {
      strategy: "MANUAL_REVIEW",
      fallbackSuppliers: ["smdpanel", "justanotherpanel", "sizzle"]
    },
    risk: {
      platformPolicyRisk: "CRITICAL",
      accountRisk: "HIGH",
      refundRisk: "HIGH",
      reputationRisk: "HIGH",
      summary:
        "Subscriber services are highly exposed to platform spam and fake engagement enforcement.",
      mitigations: sharedHighRiskMitigations
    }
  },
  {
    code: "telegram-members",
    name: "Telegram Members",
    platform: "TELEGRAM",
    category: "Telegram",
    serviceKind: "CHANNEL_MEMBERS",
    destinationKind: "TELEGRAM_CHANNEL",
    description: "Member delivery for public Telegram channels or groups.",
    enabled: true,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 420000, currency: "NGN" },
    minimumQuantity: 100,
    maximumQuantity: 50_000,
    quantityStep: 100,
    estimatedDeliveryMinutes: 1440,
    expectedCompletion: "1-5 days",
    marginBps: 5000,
    supportsRefill: true,
    supportsCancel: true,
    supplierRouting: {
      strategy: "PREFERRED_FIRST",
      preferredSupplier: "peakerr",
      fallbackSuppliers: ["smdpanel", "justanotherpanel", "sizzle"]
    },
    risk: {
      platformPolicyRisk: "HIGH",
      accountRisk: "MEDIUM",
      refundRisk: "MEDIUM",
      reputationRisk: "HIGH",
      summary:
        "Member adds can create spam complaints and drop-off when groups moderate aggressively.",
      mitigations: sharedHighRiskMitigations
    }
  },
  {
    code: "website-traffic",
    name: "Website Traffic",
    platform: "WEBSITE",
    category: "Traffic",
    serviceKind: "VIEWS",
    destinationKind: "WEBSITE",
    description: "Traffic delivery for public websites and landing pages.",
    enabled: false,
    pricingModel: "PER_1000",
    baseRate: { amountMinor: 250000, currency: "NGN" },
    minimumQuantity: 500,
    maximumQuantity: 250_000,
    quantityStep: 500,
    estimatedDeliveryMinutes: 2880,
    expectedCompletion: "2-7 days",
    marginBps: 3500,
    supportsRefill: false,
    supportsCancel: true,
    supplierRouting: {
      strategy: "MANUAL_REVIEW",
      fallbackSuppliers: ["smdpanel", "peakerr"]
    },
    risk: {
      platformPolicyRisk: "HIGH",
      accountRisk: "MEDIUM",
      refundRisk: "HIGH",
      reputationRisk: "HIGH",
      summary: "Low-quality traffic can affect analytics, ads attribution, and customer trust.",
      mitigations: [
        ...sharedHighRiskMitigations,
        "Disable by default until traffic source quality, bot filtering, and analytics exclusions are approved."
      ]
    }
  },
  {
    code: "social-account-instagram",
    name: "Instagram Account (2026, Instant)",
    platform: "DIGITAL_GOODS",
    category: "Accounts",
    serviceKind: "ACCOUNT_SALE",
    destinationKind: "DELIVERY_CONTACT",
    description:
      "Instant-delivery Instagram account, sourced from Sizzle's digital account marketplace. Credentials are emailed as soon as the order completes.",
    enabled: true,
    pricingModel: "PER_1000",
    // Representative of Sizzle's live catalog (23 SKUs at this writing, rate 327,377.81-744,977.81
    // per 1000 as of 2026-08-05); createGrowthOrder always requotes live via quoteService, so this
    // is a display estimate only, not the charged price.
    baseRate: { amountMinor: 32738, currency: "NGN" },
    minimumQuantity: 1,
    maximumQuantity: 1,
    quantityStep: 1,
    estimatedDeliveryMinutes: 15,
    expectedCompletion: "Instant to 1 hour",
    marginBps: 2500,
    supportsRefill: false,
    supportsCancel: false,
    supplierRouting: {
      strategy: "PREFERRED_FIRST",
      preferredSupplier: "sizzle",
      fallbackSuppliers: []
    },
    risk: {
      platformPolicyRisk: "MEDIUM",
      accountRisk: "MEDIUM",
      refundRisk: "MEDIUM",
      reputationRisk: "LOW",
      summary: "Account resale can violate platform terms of service if detected.",
      mitigations: sharedHighRiskMitigations
    }
  }
];

export const defaultSmmServiceCategories: SmmSupplierAudit["serviceCategories"] = [
  {
    serviceKind: "FOLLOWERS",
    label: "Followers",
    compatibleDestinations: ["TIKTOK_PROFILE", "INSTAGRAM_PROFILE"]
  },
  {
    serviceKind: "LIKES",
    label: "Likes",
    compatibleDestinations: ["TIKTOK_PROFILE", "INSTAGRAM_PROFILE"]
  },
  {
    serviceKind: "VIEWS",
    label: "Views and traffic",
    compatibleDestinations: ["TIKTOK_PROFILE", "YOUTUBE_CHANNEL", "WEBSITE"]
  },
  {
    serviceKind: "COMMENTS",
    label: "Comments",
    compatibleDestinations: ["TIKTOK_PROFILE", "INSTAGRAM_PROFILE", "YOUTUBE_CHANNEL"]
  },
  {
    serviceKind: "SHARES",
    label: "Shares",
    compatibleDestinations: ["TIKTOK_PROFILE", "INSTAGRAM_PROFILE"]
  },
  {
    serviceKind: "LIVE_VIEWERS",
    label: "Live viewers",
    compatibleDestinations: ["TIKTOK_LIVE", "INSTAGRAM_LIVE", "FACEBOOK_LIVE"]
  },
  {
    serviceKind: "CHANNEL_MEMBERS",
    label: "Channel members and subscribers",
    compatibleDestinations: ["TELEGRAM_CHANNEL", "TELEGRAM_GROUP", "YOUTUBE_CHANNEL"]
  }
];

const sampleDestination: PromotionDestination = {
  kind: "INSTAGRAM_PROFILE",
  url: "https://instagram.com/fliptrybe"
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function requireSameCurrency(left: Money, right: Money) {
  if (left.currency !== right.currency) {
    throw new Error(`Cannot compare ${left.currency} and ${right.currency} SMM money values.`);
  }
}

function getRule(serviceKind: SmmServiceKind, rules: SmmPricingRule[]) {
  const rule = rules.find((item) => item.serviceKind === serviceKind);

  if (!rule) {
    throw new Error(`Missing SMM pricing rule for ${serviceKind}.`);
  }

  return rule;
}

function getRisk(score: number): Pick<SmmFraudAssessment, "action" | "riskLevel"> {
  if (score >= 90) {
    return { action: "BLOCK", riskLevel: "BLOCKED" };
  }
  if (score >= 60) {
    return { action: "REVIEW", riskLevel: "HIGH" };
  }
  if (score >= 30) {
    return { action: "REVIEW", riskLevel: "MEDIUM" };
  }

  return { action: "ALLOW", riskLevel: "LOW" };
}

function hasValidPublicUrl(destination: PromotionDestination) {
  if (destination.kind === "DELIVERY_CONTACT") {
    return Boolean(destination.contactValue?.trim());
  }
  if (!destination.url) {
    return false;
  }

  try {
    const url = new URL(destination.url);
    const hostname = url.hostname.toLowerCase();

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      hostname.includes(".") &&
      hostname !== "localhost"
    );
  } catch {
    return false;
  }
}

function destinationMatchesService(order: SmmOrder) {
  const destination = order.destination.kind;

  if (order.serviceKind === "LIVE_VIEWERS") {
    return destination.includes("LIVE");
  }
  if (order.serviceKind === "CHANNEL_MEMBERS") {
    return destination.includes("CHANNEL") || destination.includes("GROUP");
  }

  return true;
}

function createSignal(
  code: string,
  message: string,
  score: number,
  severity: Exclude<SmmFraudRiskLevel, "LOW">
): SmmFraudSignal {
  return { code, message, score, severity };
}

function getErrorReason(error: unknown) {
  return error instanceof Error ? error.message : "Unknown supplier health error.";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, supplierName: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${supplierName} health check timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function calculateSmmMargin(input: {
  supplierCost: Money;
  customerPrice: Money;
}): SmmMarginResult {
  requireSameCurrency(input.supplierCost, input.customerPrice);

  const grossMarginMinor = input.customerPrice.amountMinor - input.supplierCost.amountMinor;

  return {
    supplierCost: input.supplierCost,
    customerPrice: input.customerPrice,
    grossMargin: {
      amountMinor: grossMarginMinor,
      currency: input.customerPrice.currency
    },
    marginBps:
      input.customerPrice.amountMinor > 0
        ? Math.round((grossMarginMinor * 10_000) / input.customerPrice.amountMinor)
        : 0,
    isProfitable: grossMarginMinor >= 0
  };
}

export function calculateSmmPrice(input: {
  quote: SmmSupplierQuote;
  serviceKind: SmmServiceKind;
  rush?: boolean;
  rules?: SmmPricingRule[];
}): SmmPricedQuote {
  const rules = input.rules ?? defaultSmmPricingRules;
  const rule = getRule(input.serviceKind, rules);
  const markupBps = rule.markupBps + (input.rush ? rule.rushMarkupBps : 0);
  const markedUpMinor =
    Math.ceil((input.quote.amount.amountMinor * (10_000 + markupBps)) / 10_000) +
    rule.platformFeeMinor;
  const floorMinor = input.quote.amount.amountMinor + rule.minimumMarginMinor;
  const customerPrice: Money = {
    amountMinor: Math.max(markedUpMinor, floorMinor),
    currency: input.quote.amount.currency
  };
  const margin = calculateSmmMargin({
    supplierCost: input.quote.amount,
    customerPrice
  });
  const pricedQuote: SmmPricedQuote = {
    ...margin,
    estimatedDeliveryMinutes: input.quote.estimatedDeliveryMinutes,
    markupBps,
    minimumMarginApplied: customerPrice.amountMinor === floorMinor
  };

  return input.quote.supplierName
    ? { ...pricedQuote, supplierName: input.quote.supplierName }
    : pricedQuote;
}

export function assessSmmOrderFraud(input: {
  order: SmmOrder;
  quote?: SmmSupplierQuote;
  recentOrders?: SmmOrder[];
}): SmmFraudAssessment {
  const signals: SmmFraudSignal[] = [];

  if (!hasValidPublicUrl(input.order.destination)) {
    signals.push(
      createSignal(
        "INVALID_DESTINATION_URL",
        "Destination must be a public http(s) URL.",
        95,
        "BLOCKED"
      )
    );
  }

  if (input.order.quantity < 10) {
    signals.push(
      createSignal(
        "LOW_QUANTITY_PROBE",
        "Quantity is below normal supplier minimums.",
        25,
        "MEDIUM"
      )
    );
  }

  if (input.order.quantity > 100_000) {
    signals.push(
      createSignal(
        "OVERSIZED_ORDER",
        "Quantity is above the automated fulfillment limit.",
        70,
        "HIGH"
      )
    );
  } else if (input.order.quantity > 50_000) {
    signals.push(
      createSignal("LARGE_ORDER", "Quantity should be reviewed before fulfillment.", 35, "MEDIUM")
    );
  }

  if (!destinationMatchesService(input.order)) {
    signals.push(
      createSignal(
        "DESTINATION_SERVICE_MISMATCH",
        "Requested service does not match the destination type.",
        65,
        "HIGH"
      )
    );
  }

  if (input.quote && input.quote.amount.amountMinor <= 0) {
    signals.push(
      createSignal("ZERO_COST_QUOTE", "Supplier returned a zero or negative quote.", 90, "BLOCKED")
    );
  }

  const duplicates =
    input.recentOrders?.filter(
      (order) =>
        order.destination.url === input.order.destination.url &&
        order.serviceKind === input.order.serviceKind &&
        order.status !== "FAILED" &&
        order.status !== "CANCELLED"
    ) ?? [];

  if (duplicates.length >= 3) {
    signals.push(
      createSignal(
        "DUPLICATE_DESTINATION_VELOCITY",
        "Multiple active orders target the same destination and service.",
        45,
        "MEDIUM"
      )
    );
  }

  const score = clamp(
    signals.reduce((total, signal) => total + signal.score, 0),
    0,
    100
  );
  const risk = getRisk(score);

  return {
    score,
    ...risk,
    signals
  };
}

export function calculateSmmRetryDelayMs(
  policy: SmmRetryPolicy,
  attempt: number,
  randomSeed = 0.5
) {
  const normalizedAttempt = Math.max(1, attempt);
  const exponentialDelay = policy.baseDelayMs * 2 ** (normalizedAttempt - 1);
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
  const jitterRange = cappedDelay * policy.jitterRatio;
  const jitterOffset = Math.round((clamp(randomSeed, 0, 1) - 0.5) * 2 * jitterRange);

  return Math.max(0, cappedDelay + jitterOffset);
}

export function shouldRetrySmmFailure(input: {
  error: unknown;
  attempt: number;
  policy?: SmmRetryPolicy;
}) {
  const policy = input.policy ?? defaultSmmRetryPolicy;
  const message = getErrorReason(input.error).toLowerCase();
  const nonRetryable = ["invalid api key", "requires an api key", "service map references missing"];

  return input.attempt < policy.attempts && !nonRetryable.some((item) => message.includes(item));
}

export function createSmmFulfillmentQueueJob(input: {
  order: SmmOrder;
  pricedQuote: SmmPricedQuote;
  fraudAssessment: SmmFraudAssessment;
  retryPolicy?: SmmRetryPolicy;
  enqueuedAt?: string;
}): SmmFulfillmentQueueJob {
  const job: SmmFulfillmentQueueJob = {
    orderId: input.order.id,
    workspaceId: input.order.workspaceId,
    serviceKind: input.order.serviceKind,
    destinationKind: input.order.destination.kind,
    ...(input.order.destination.url ? { destinationUrl: input.order.destination.url } : {}),
    ...(input.order.destination.contactValue
      ? { deliveryContact: input.order.destination.contactValue }
      : {}),
    quantity: input.order.quantity,
    supplierCost: input.pricedQuote.supplierCost,
    customerPrice: input.pricedQuote.customerPrice,
    grossMargin: input.pricedQuote.grossMargin,
    fraudRiskLevel: input.fraudAssessment.riskLevel,
    retryPolicy: input.retryPolicy ?? defaultSmmRetryPolicy,
    enqueuedAt: input.enqueuedAt ?? new Date().toISOString()
  };

  return input.pricedQuote.supplierName
    ? { ...job, supplierName: input.pricedQuote.supplierName }
    : job;
}

export function createSmmServiceHealthMonitor(
  suppliers: SmmSupplierAdapter[],
  options?: {
    timeoutMs?: number;
    degradedLatencyMs?: number;
    sampleQuantity?: number;
    sampleServiceKind?: SmmServiceKind;
    sampleDestination?: PromotionDestination;
    now?: () => number;
  }
): SmmServiceHealthMonitor {
  const timeoutMs = options?.timeoutMs ?? 5_000;
  const degradedLatencyMs = options?.degradedLatencyMs ?? 2_500;
  const sampleQuantity = options?.sampleQuantity ?? 100;
  const sampleServiceKind = options?.sampleServiceKind ?? "FOLLOWERS";
  const healthDestination = options?.sampleDestination ?? sampleDestination;
  const getNow = options?.now ?? Date.now;

  return {
    async checkSupplier(supplier) {
      const startedAt = getNow();

      try {
        await withTimeout(
          supplier.quoteService({
            serviceKind: sampleServiceKind,
            quantity: sampleQuantity,
            destination: healthDestination
          }),
          timeoutMs,
          supplier.name
        );

        const latencyMs = Math.max(0, getNow() - startedAt);

        return {
          supplierName: supplier.name,
          status: latencyMs > degradedLatencyMs ? "degraded" : "healthy",
          latencyMs,
          checkedAt: new Date().toISOString()
        };
      } catch (error) {
        return {
          supplierName: supplier.name,
          status: "down",
          latencyMs: Math.max(0, getNow() - startedAt),
          checkedAt: new Date().toISOString(),
          reason: getErrorReason(error)
        };
      }
    },
    checkAll() {
      return Promise.all(suppliers.map((supplier) => this.checkSupplier(supplier)));
    }
  };
}

export function summarizeSmmSupplierHealth(results: SmmSupplierHealth[]) {
  const down = results.filter((result) => result.status === "down").length;
  const degraded = results.filter((result) => result.status === "degraded").length;

  if (results.length === 0 || down === results.length) {
    return "down" as const;
  }
  if (down > 0 || degraded > 0) {
    return "degraded" as const;
  }

  return "healthy" as const;
}

export function mapSmmOrderStatusToGrowthStatus(status: SmmOrder["status"]): GrowthOrderStatus {
  switch (status) {
    case "DRAFT":
      return "PENDING";
    case "QUEUED":
      return "SUBMITTED";
    case "PROCESSING":
    case "PARTIAL":
      return "IN_PROGRESS";
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
      return "REFUNDED";
    case "FAILED":
    default:
      return "FAILED";
  }
}

export function calculateGrowthDeliveredQuantity(input: {
  quantityOrdered: number;
  status: GrowthOrderStatus;
  remains?: number;
}) {
  if (input.status === "COMPLETED") {
    return input.quantityOrdered;
  }
  if (input.status === "FAILED" || input.status === "REFUNDED" || input.status === "PENDING") {
    return 0;
  }
  if (typeof input.remains === "number") {
    return clamp(input.quantityOrdered - input.remains, 0, input.quantityOrdered);
  }

  return 0;
}

export function getGrowthExpectedCompletionAt(input: {
  estimatedDeliveryMinutes: number;
  now?: string;
}) {
  const startedAt = new Date(input.now ?? new Date().toISOString());

  return new Date(startedAt.getTime() + input.estimatedDeliveryMinutes * 60_000).toISOString();
}

export function getGrowthServiceRiskReport(catalog = defaultGrowthServicesCatalog) {
  return catalog.map((service) => ({
    serviceCode: service.code,
    serviceName: service.name,
    platform: service.platform,
    category: service.category,
    risk: service.risk
  }));
}

export function applyGrowthServiceAdminControls(
  service: GrowthServiceCatalogItem,
  input: {
    enabled?: boolean;
    marginBps?: number;
    preferredSupplier?: string;
    maximumQuantity?: number;
    expectedCompletion?: string;
    adminNote?: string;
  }
): GrowthServiceCatalogItem {
  const routingWithoutPreferred: GrowthServiceRouting = {
    strategy: service.supplierRouting.strategy,
    fallbackSuppliers: [...service.supplierRouting.fallbackSuppliers]
  };
  const nextRouting: GrowthServiceRouting =
    input.preferredSupplier === undefined
      ? service.supplierRouting
      : input.preferredSupplier
        ? {
            ...routingWithoutPreferred,
            preferredSupplier: input.preferredSupplier,
            strategy: "PREFERRED_FIRST" as const
          }
        : routingWithoutPreferred;

  return {
    ...service,
    enabled: input.enabled ?? service.enabled,
    marginBps:
      typeof input.marginBps === "number"
        ? clamp(Math.round(input.marginBps), 0, 20_000)
        : service.marginBps,
    maximumQuantity:
      typeof input.maximumQuantity === "number"
        ? Math.max(service.minimumQuantity, Math.round(input.maximumQuantity))
        : service.maximumQuantity,
    expectedCompletion: input.expectedCompletion ?? service.expectedCompletion,
    supplierRouting: nextRouting
  };
}

export function createSmmSupplierAudit(input: {
  providers: SmmSupplierAuditProvider[];
  reliability: SmmSupplierHealth[];
  pricingRules?: SmmPricingRule[];
}): SmmSupplierAudit {
  const rules = input.pricingRules ?? defaultSmmPricingRules;

  return {
    supportedProviders: input.providers,
    serviceCategories: defaultSmmServiceCategories,
    pricingModels: rules.map((rule) => ({
      name: `${rule.serviceKind.toLowerCase()} per-quantity markup`,
      description:
        "Supplier rate is quoted per order, then customer price applies markup, platform fee, and a minimum margin floor.",
      marginBps: rule.markupBps,
      minimumMarginMinor: rule.minimumMarginMinor,
      platformFeeMinor: rule.platformFeeMinor
    })),
    reliability: input.reliability
  };
}

export function getCurrencyExposure(amounts: Money[]): Partial<Record<CurrencyCode, number>> {
  return amounts.reduce<Partial<Record<CurrencyCode, number>>>((exposure, amount) => {
    exposure[amount.currency] = (exposure[amount.currency] ?? 0) + amount.amountMinor;

    return exposure;
  }, {});
}
