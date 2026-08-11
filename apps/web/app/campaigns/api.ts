"use client";

import type {
  Campaign,
  CampaignAuditTrailItem,
  CampaignBudgetSummary,
  CampaignLedgerEntry,
  CampaignObjective,
  CampaignSpendBreakdown,
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
  fallbackDestinations,
  type BillingActivity,
  type CampaignAiInsights,
  type CampaignAnalyticsOverview,
  type ClientDataSource,
  type PlatformHealth
} from "./data";

type CampaignReportShape = {
  clicks?: number | null;
  conversions?: number | null;
  createdAt?: string | null;
  impressions?: number | null;
  periodEnd?: string | null;
  publishedAt?: string | null;
  revenueMinor?: number | null;
  spendMinor?: number | null;
  status?: string | null;
};

// Not in @fliptrybe/types — these mirror the CampaignNote / CampaignReport /
// CampaignOutcome / CampaignCreative Prisma models (packages/database/prisma/
// schema.prisma) as returned by GET /campaigns/:id/{notes,reports,outcome,assets}.
export type CampaignNote = {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  pinnedAt: string | null;
  visibility: "INTERNAL" | "CLIENT_VISIBLE";
};

export type CampaignReportScreenshot = {
  id: string;
  sourceUrl: string | null;
  mediaAsset: { secureUrl?: string | null; url?: string | null } | null;
};

export type CampaignPublishedReport = {
  id: string;
  clicks: number;
  conversions: number;
  currency: CurrencyCode;
  impressions: number;
  periodEnd: string;
  periodStart: string;
  publishedAt: string | null;
  revenueMinor: number | null;
  screenshots: CampaignReportScreenshot[];
  spendMinor: number;
  summary: string | null;
};

export type CampaignOutcome = {
  capturedAt: string | null;
  currency: CurrencyCode;
  estRevenueMinor: number | null;
  messagesCount: number | null;
  notes: string | null;
  ordersCount: number | null;
  rating: number | null;
  wouldRunAgain: boolean | null;
} | null;

export type CampaignAsset = {
  id: string;
  callToAction: string | null;
  format: "IMAGE" | "VIDEO" | "CAROUSEL" | "OTHER";
  headline: string | null;
  landingUrl: string | null;
  mediaAsset: { secureUrl?: string | null; url?: string | null } | null;
  name: string;
  primaryText: string | null;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
};

type DashboardMetricTotals = {
  clicks: number;
  conversions: number;
  impressions: number;
  revenueMinor: number;
  spendMinor: number;
};

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

export type CreatePaymentIntentInput = {
  amountMinor?: number;
  currency?: CurrencyCode;
  customerEmail?: string;
  customerName?: string;
  redirectUrl?: string;
  webhookUrl?: string;
};

export type CampaignControlInput = {
  amountMinor?: number;
  budgetMinor?: number;
  deltaMinor?: number;
  message?: string;
  newBudgetMinor?: number;
  note?: string;
  reason?: string;
};

export const defaultCampaignDashboardState: CampaignDashboardState = {
  aiInsights: { items: [] },
  analytics: { metrics: [], trend: [] },
  campaigns: [],
  destinations: fallbackDestinations,
  loading: false,
  source: "fallback",
  wallet: null
};

export const defaultCampaignBuilderState: CampaignBuilderState = {
  destinations: fallbackDestinations,
  loading: false,
  source: "fallback"
};

export const defaultBillingState: BillingState = {
  activity: [],
  loading: false,
  source: "fallback",
  wallet: null
};

export const defaultOnboardingState: OnboardingState = {
  destinations: fallbackDestinations,
  health: null,
  loading: false,
  source: "fallback"
};

export async function loadCampaignDashboardData(): Promise<CampaignDashboardState> {
  if (!getStoredToken()) {
    return defaultCampaignDashboardState;
  }

  const [campaigns, destinations, wallet] = await Promise.all([
    apiRequest<Campaign[]>("/campaigns"),
    apiRequest<DestinationKind[]>("/destinations/catalog"),
    apiRequest<Wallet>("/wallet")
  ]);
  const analytics = buildDashboardAnalytics(campaigns);
  const aiInsights = buildDashboardInsights(campaigns);

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

function publishedReports(campaign: Campaign): CampaignReportShape[] {
  const reports = (campaign as Campaign & { reports?: CampaignReportShape[] }).reports ?? [];

  return reports.filter((report) => report.status === "PUBLISHED" || Boolean(report.publishedAt));
}

function buildDashboardAnalytics(campaigns: Campaign[]): CampaignAnalyticsOverview {
  const reports = campaigns.flatMap(publishedReports);
  const totals = reports.reduce<DashboardMetricTotals>(
    (sum, report) => ({
      clicks: sum.clicks + Number(report.clicks ?? 0),
      conversions: sum.conversions + Number(report.conversions ?? 0),
      impressions: sum.impressions + Number(report.impressions ?? 0),
      revenueMinor: sum.revenueMinor + Number(report.revenueMinor ?? 0),
      spendMinor: sum.spendMinor + Number(report.spendMinor ?? 0)
    }),
    { clicks: 0, conversions: 0, impressions: 0, revenueMinor: 0, spendMinor: 0 }
  );
  const roiBps =
    totals.spendMinor > 0 ? Math.round(((totals.revenueMinor - totals.spendMinor) / totals.spendMinor) * 10000) : 0;

  return {
    metrics: [
      { name: "impressions", value: totals.impressions },
      { name: "clicks", value: totals.clicks },
      { name: "roi_bps", value: roiBps },
      { name: "live_viewers", value: 0 }
    ],
    trend: reports
      .map((report) => ({
        day: formatShortDay(report.periodEnd ?? report.publishedAt ?? report.createdAt),
        spendMinor: Number(report.spendMinor ?? 0),
        conversions: Number(report.conversions ?? 0)
      }))
      .filter((point) => point.spendMinor > 0 || point.conversions > 0)
      .slice(-7)
  };
}

function buildDashboardInsights(campaigns: Campaign[]): CampaignAiInsights {
  return {
    summary: { mode: "operator_reports", campaign_count: campaigns.length },
    items: campaigns
      .filter((campaign) => publishedReports(campaign).length > 0)
      .slice(0, 4)
      .map((campaign) => ({
        id: campaign.id,
        label: campaign.name,
        metrics: {
          budget_minor: campaign.budget.amountMinor,
          published_reports: publishedReports(campaign).length,
          status: campaign.status
        },
        dimensions: {
          objective: campaign.objective,
          destination_kind: campaign.destination.kind
        },
        reasons: ["published_report_ready", "operator_metrics_reviewed"]
      }))
  };
}

function formatShortDay(value?: string | null) {
  if (!value) {
    return "Now";
  }
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Now";
  }

  return new Intl.DateTimeFormat("en-NG", { weekday: "short" }).format(date);
}

export async function loadCampaignBuilderData(): Promise<CampaignBuilderState> {
  if (!getStoredToken()) {
    return defaultCampaignBuilderState;
  }

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
  if (!getStoredToken()) {
    return defaultOnboardingState;
  }

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

export function createCampaign(input: CreateCampaignInput) {
  return apiRequest<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type StudioGoal =
  | "WHATSAPP_MESSAGES"
  | "WEBSITE_VISITS"
  | "VIDEO_VIEWS"
  | "PHONE_CALLS"
  | "MORE_FOLLOWERS"
  | "SALES";

export type CreateCampaignFromWizardInput = {
  goal: StudioGoal;
  link: string;
  budgetMinor: number;
  city?: string;
  productDescription?: string;
};

export type CreateCampaignFromWizardResult = {
  campaign: Campaign;
  warnings: string[];
};

/**
 * The Studio one-screen flow: "what do you want more of -> paste link -> where -> budget".
 * Hits the wizard-specific endpoint, which normalizes this into a full campaign and transparently
 * resolves (or provisions) the workspace's shared ad account -- the customer never sees or
 * manages one.
 */
export function createCampaignFromWizard(input: CreateCampaignFromWizardInput) {
  return apiRequest<CreateCampaignFromWizardResult>("/campaigns/wizard", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function startCampaign(campaignId: string) {
  return apiRequest<Campaign>(`/campaigns/${encodeURIComponent(campaignId)}/start`, {
    method: "POST"
  });
}

// Moves a DRAFT (or CHANGES_REQUESTED) campaign into the review pipeline —
// this is the call that actually sends the brief to the ops team. Creating a
// campaign (POST /campaigns) only ever leaves it in DRAFT; skipping this call
// after create silently strands the campaign there forever.
export function submitCampaign(campaignId: string, input?: CampaignControlInput) {
  return apiRequest<Campaign>(`/campaigns/${encodeURIComponent(campaignId)}/submit`, {
    method: "POST",
    body: JSON.stringify(input ?? {})
  });
}

function campaignAction(campaignId: string, action: string, input: CampaignControlInput = {}) {
  return apiRequest<Campaign>(`/campaigns/${encodeURIComponent(campaignId)}/actions/${action}`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function pauseCampaign(campaignId: string, input?: CampaignControlInput) {
  return campaignAction(campaignId, "pause", input);
}

export function resumeCampaign(campaignId: string, input?: CampaignControlInput) {
  return campaignAction(campaignId, "resume", input);
}

export function requestCampaignChanges(campaignId: string, input?: CampaignControlInput) {
  return campaignAction(campaignId, "request-changes", input);
}

export function increaseCampaignBudget(campaignId: string, input?: CampaignControlInput) {
  return campaignAction(campaignId, "increase-budget", input);
}

export function decreaseCampaignBudget(campaignId: string, input?: CampaignControlInput) {
  return campaignAction(campaignId, "decrease-budget", input);
}

export function stopCampaign(campaignId: string, input?: CampaignControlInput) {
  return campaignAction(campaignId, "stop", input);
}

export function transferCampaignBudget(campaignId: string, input?: CampaignControlInput) {
  return campaignAction(campaignId, "transfer-budget", input);
}

export function loadCampaignAuditTrail(campaignId: string) {
  return apiRequest<{ campaignId: string; items: CampaignAuditTrailItem[] }>(
    `/campaigns/${encodeURIComponent(campaignId)}/audit`
  );
}

export function loadCampaignLedger(campaignId: string) {
  return apiRequest<CampaignLedgerEntry[]>(`/campaigns/${encodeURIComponent(campaignId)}/ledger`);
}

export function loadCampaignBudgetSummary(campaignId: string) {
  return apiRequest<CampaignBudgetSummary>(`/campaigns/${encodeURIComponent(campaignId)}/budget-summary`);
}

export function loadCampaignSpendBreakdown(campaignId: string) {
  return apiRequest<CampaignSpendBreakdown>(`/campaigns/${encodeURIComponent(campaignId)}/spend-breakdown`);
}

// payment:manage-gated finance operations. No frontend role check here,
// matching increaseCampaignBudget/decreaseCampaignBudget above — the backend
// enforces the permission and the UI surfaces whatever error comes back.
export function createCampaignInvoice(
  campaignId: string,
  input: { subtotalMinor?: number; dueAt?: string } = {}
) {
  return apiRequest<CampaignInvoiceRecord>(`/campaigns/${encodeURIComponent(campaignId)}/invoices`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type CampaignBudgetHold = {
  id: string;
  status: "ACTIVE" | "RELEASED" | "CAPTURED";
  amountMinor: number;
  currency: CurrencyCode;
  reason: string | null;
  createdAt: string;
  releasedAt: string | null;
  capturedAt: string | null;
};

export function createCampaignBudgetHold(
  campaignId: string,
  input: { amountMinor?: number; reason?: string } = {}
) {
  return apiRequest<CampaignBudgetHold>(`/campaigns/${encodeURIComponent(campaignId)}/budget-holds`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function captureCampaignBudgetHold(campaignId: string, holdId: string) {
  return apiRequest<CampaignBudgetHold>(
    `/campaigns/${encodeURIComponent(campaignId)}/budget-holds/${encodeURIComponent(holdId)}/capture`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function releaseCampaignBudgetHold(campaignId: string, holdId: string) {
  return apiRequest<CampaignBudgetHold>(
    `/campaigns/${encodeURIComponent(campaignId)}/budget-holds/${encodeURIComponent(holdId)}/release`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function loadCampaignNotes(campaignId: string) {
  return apiRequest<CampaignNote[]>(`/campaigns/${encodeURIComponent(campaignId)}/notes`);
}

// The API always stores a note added through this route (rather than the
// admin ops route) as CLIENT_VISIBLE — see addCampaignNote in
// managed-ads.service.ts — so it reappears in the same GET immediately.
export function addCampaignNote(campaignId: string, body: string) {
  return apiRequest<CampaignNote>(`/campaigns/${encodeURIComponent(campaignId)}/notes`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
}

export function loadCampaignReports(campaignId: string) {
  return apiRequest<CampaignPublishedReport[]>(`/campaigns/${encodeURIComponent(campaignId)}/reports`);
}

export function loadCampaignOutcome(campaignId: string) {
  return apiRequest<CampaignOutcome>(`/campaigns/${encodeURIComponent(campaignId)}/outcome`);
}

export function loadCampaignAssets(campaignId: string) {
  return apiRequest<CampaignAsset[]>(`/campaigns/${encodeURIComponent(campaignId)}/assets`);
}

export async function loadCampaignFinancialData(campaignId: string) {
  const [ledger, budgetSummary, spendBreakdown] = await Promise.all([
    loadCampaignLedger(campaignId),
    loadCampaignBudgetSummary(campaignId),
    loadCampaignSpendBreakdown(campaignId)
  ]);

  return {
    budgetSummary,
    ledger,
    spendBreakdown
  };
}

export function createPaymentIntent(input: CreatePaymentIntentInput) {
  return apiRequest<PaymentIntent>("/payments/intents", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

// Manual re-check against the gateway, for when a user has paid but the
// webhook hasn't landed yet and the intent still shows pending.
export function verifyPayment(reference: string) {
  return apiRequest<PaymentIntent>(`/payments/verify/${encodeURIComponent(reference)}`, {
    method: "POST"
  });
}

export function createWalletFundingIntent(input: CreatePaymentIntentInput) {
  return apiRequest<PaymentIntent>("/wallet/funding-intents", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

// ─── Wallet withdrawal (bank payout) ───────────────────────────────────────────
//
// Bank-only, NGN, same-currency payout of the workspace's own wallet balance
// to its own bank account. Mirrors the shape of
// apps/api/src/modules/financial-products/financial-products.dtos.ts
// (RequestWalletWithdrawalDto) and the WalletWithdrawal Prisma model.

export type WalletWithdrawalStatus =
  | "HOLD"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "RECONCILIATION_REQUIRED";

export type WalletWithdrawalRecord = {
  id: string;
  workspaceId: string;
  userId: string | null;
  walletId: string;
  providerName: string;
  providerReference: string | null;
  beneficiaryId: string | null;
  recipientName: string;
  recipientAccountNumber: string;
  recipientBankCode: string;
  amountMinor: number;
  currency: CurrencyCode;
  feeMinor: number;
  status: WalletWithdrawalStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RequestWalletWithdrawalInput = {
  amountMinor: number;
  beneficiaryId?: string;
  recipientName?: string;
  recipientAccountNumber?: string;
  recipientBankCode?: string;
};

export function requestWalletWithdrawal(input: RequestWalletWithdrawalInput) {
  return apiRequest<WalletWithdrawalRecord>("/financial-products/wallet-withdrawals", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function listWalletWithdrawals() {
  return apiRequest<WalletWithdrawalRecord[]>("/financial-products/wallet-withdrawals");
}

// Real campaign invoices (CampaignInvoice) — a distinct concept from the
// PaymentIntent-based "Invoices" tab content above, which is really an
// ahead-of-time wallet top-up prompt. These are invoices ops actually issued
// against a specific campaign, with real line items and a real pay action.
export type CampaignInvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID" | "OVERDUE";

export type CampaignInvoiceLineItem = { description: string; amountMinor: number };

export type CampaignInvoiceRecord = {
  id: string;
  campaignId: string;
  number: string;
  status: CampaignInvoiceStatus;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  currency: CurrencyCode;
  lineItems: CampaignInvoiceLineItem[];
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
};

export function loadInvoices() {
  return apiRequest<CampaignInvoiceRecord[]>("/invoices");
}

export function loadInvoice(invoiceId: string) {
  return apiRequest<CampaignInvoiceRecord>(`/invoices/${encodeURIComponent(invoiceId)}`);
}

// method "wallet" (default) debits the wallet directly; anything else opens
// an external checkout via a new PaymentIntent (same shape as
// createWalletFundingIntent above) — see payInvoice in managed-ads.service.ts.
export function payInvoiceFromWallet(invoiceId: string) {
  return apiRequest<CampaignInvoiceRecord>(`/invoices/${encodeURIComponent(invoiceId)}/pay`, {
    method: "POST",
    body: JSON.stringify({ method: "wallet" })
  });
}

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
