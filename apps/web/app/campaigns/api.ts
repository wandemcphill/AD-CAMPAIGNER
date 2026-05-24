"use client";

import type {
  Campaign,
  CampaignObjective,
  CurrencyCode,
  DestinationKind,
  Money,
  PaymentIntent,
  Wallet
} from "@fliptrybe/types";

import {
  apiRequest,
  formatMoney,
  getStoredToken,
  subscribeToSessionChanges
} from "../lib/api-client";
import {
  fallbackAiInsights,
  fallbackAnalytics,
  fallbackBillingActivity,
  fallbackCampaigns,
  fallbackDestinations,
  fallbackHealth,
  fallbackWallet,
  type BillingActivity,
  type CampaignAiInsights,
  type CampaignAnalyticsOverview,
  type CampaignQuote,
  type ClientDataSource,
  type PlatformHealth
} from "./data";

export type CampaignDashboardState = {
  aiInsights: CampaignAiInsights | null;
  analytics: CampaignAnalyticsOverview | null;
  campaigns: Campaign[];
  destinations: DestinationKind[];
  error?: string;
  loading: boolean;
  source: ClientDataSource;
  wallet: Wallet | null;
};

export type CampaignBuilderState = {
  destinations: DestinationKind[];
  error?: string;
  loading: boolean;
  source: ClientDataSource;
};

export type BillingState = {
  activity: BillingActivity[];
  error?: string;
  loading: boolean;
  source: ClientDataSource;
  wallet: Wallet | null;
};

export type OnboardingState = {
  destinations: DestinationKind[];
  error?: string;
  health: PlatformHealth | null;
  loading: boolean;
  source: ClientDataSource;
};

export type CreateCampaignInput = {
  name?: string;
  objective?: CampaignObjective;
  budgetMinor?: number;
  currency?: CurrencyCode;
  destinationKind?: DestinationKind;
  destinationUrl?: string;
};

export type QuoteCampaignInput = {
  objective?: CampaignObjective;
  budgetMinor?: number;
  currency?: CurrencyCode;
  destinationKind?: DestinationKind;
};

export type CreatePaymentIntentInput = {
  amountMinor?: number;
  currency?: CurrencyCode;
  customerEmail?: string;
  customerName?: string;
  redirectUrl?: string;
  webhookUrl?: string;
};

export const defaultCampaignDashboardState: CampaignDashboardState = {
  aiInsights: fallbackAiInsights,
  analytics: fallbackAnalytics,
  campaigns: fallbackCampaigns,
  destinations: fallbackDestinations,
  loading: false,
  source: "fallback",
  wallet: fallbackWallet
};

export const defaultCampaignBuilderState: CampaignBuilderState = {
  destinations: fallbackDestinations,
  loading: false,
  source: "fallback"
};

export const defaultBillingState: BillingState = {
  activity: fallbackBillingActivity,
  loading: false,
  source: "fallback",
  wallet: fallbackWallet
};

export const defaultOnboardingState: OnboardingState = {
  destinations: fallbackDestinations,
  health: fallbackHealth,
  loading: false,
  source: "fallback"
};

export async function loadCampaignDashboardData(): Promise<CampaignDashboardState> {
  if (!getStoredToken()) {
    return defaultCampaignDashboardState;
  }

  const [campaigns, destinations, wallet, analytics, aiInsights] = await Promise.all([
    apiRequest<Campaign[]>("/campaigns"),
    apiRequest<DestinationKind[]>("/destinations/catalog"),
    apiRequest<Wallet>("/wallet"),
    apiRequest<CampaignAnalyticsOverview>("/analytics/overview"),
    apiRequest<CampaignAiInsights>("/analytics/ai-insights")
  ]);

  return {
    aiInsights,
    analytics,
    campaigns,
    destinations,
    loading: false,
    source: "api",
    wallet
  };
}

export async function loadCampaignBuilderData(): Promise<CampaignBuilderState> {
  const destinations = await apiRequest<DestinationKind[]>("/destinations/catalog");

  return {
    destinations,
    loading: false,
    source: "api"
  };
}

export async function loadBillingData(): Promise<BillingState> {
  if (!getStoredToken()) {
    return defaultBillingState;
  }

  const wallet = await apiRequest<Wallet>("/wallet");

  return {
    activity: [],
    loading: false,
    source: "api",
    wallet
  };
}

export async function loadOnboardingData(): Promise<OnboardingState> {
  const [health, destinations] = await Promise.all([
    apiRequest<PlatformHealth>("/health"),
    apiRequest<DestinationKind[]>("/destinations/catalog")
  ]);

  return {
    destinations,
    health,
    loading: false,
    source: "api"
  };
}

export function quoteCampaign(input: QuoteCampaignInput) {
  return apiRequest<CampaignQuote>("/campaigns/quote", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function createCampaign(input: CreateCampaignInput) {
  return apiRequest<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function startCampaign(campaignId: string) {
  return apiRequest<Campaign>(`/campaigns/${encodeURIComponent(campaignId)}/start`, {
    method: "POST"
  });
}

export function createPaymentIntent(input: CreatePaymentIntentInput) {
  return apiRequest<PaymentIntent>("/payments/intents", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type { CampaignQuote } from "./data";

export function formatCampaignMoney(money?: Money | null) {
  return money ? formatMoney(money) : "No amount";
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 1,
    notation: "compact"
  }).format(value);
}

export function amountToMinor(value: string) {
  const normalized = Number(value.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 0;
  }

  return Math.round(normalized * 100);
}

export function metricValue(analytics: CampaignAnalyticsOverview | null, name: string) {
  return analytics?.metrics.find((metric) => metric.name === name)?.value ?? 0;
}

export function totalBudgetMinor(campaigns: Campaign[]) {
  return campaigns.reduce((total, campaign) => total + campaign.budget.amountMinor, 0);
}

export function fallbackCurrency(campaigns: Campaign[], wallet: Wallet | null): CurrencyCode {
  return campaigns[0]?.budget.currency ?? wallet?.availableBalance.currency ?? "NGN";
}

export { subscribeToSessionChanges };
