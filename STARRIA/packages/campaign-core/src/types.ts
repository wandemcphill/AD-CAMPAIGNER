/**
 * @starria/campaign-core — canonical type definitions
 *
 * All monetary values use minor units (e.g. kobo, cents) as integers.
 * Dates are ISO-8601 strings.  IDs are opaque strings (UUID-friendly).
 */

// ─── Currency & Money ────────────────────────────────────────────────────────

export type CurrencyCode = "NGN" | "USD" | "GBP" | "EUR" | "GHS" | "KES" | "ZAR"

export interface Money {
  amountMinor: number
  currency: CurrencyCode
}

// ─── Promotable Content ───────────────────────────────────────────────────────
// The generic abstraction over anything STARRIA can promote.

export type PromotableKind =
  | "VIDEO"
  | "EVENT"
  | "AI_MOVIE"
  | "LIVE_SESSION"
  | "ARENA"

export interface PromotableContent {
  /** Stable ID of the content entity in the STARRIA system */
  contentId: string
  kind: PromotableKind
  /** Human-readable title — used in ops dashboards and reports */
  title: string
  /** Canonical URL or deep-link to the content */
  url: string
  /** Creator / host workspace */
  workspaceId: string
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>
}

// ─── Campaign Objectives ──────────────────────────────────────────────────────

export type CampaignObjective =
  | "AWARENESS"       // reach / impressions
  | "ENGAGEMENT"      // likes, comments, shares
  | "TRAFFIC"         // clicks to destination
  | "LEADS"           // lead-gen forms
  | "SALES"           // purchases / conversions
  | "APP_INSTALLS"    // app store installs
  | "FOLLOWERS"       // new follows / subscribers
  | "LIVE_VIEWERS"    // real-time viewer count boost

// Map each promotable kind to the objectives that make sense for it.
export const OBJECTIVE_AFFINITY: Record<PromotableKind, CampaignObjective[]> = {
  VIDEO:        ["AWARENESS", "ENGAGEMENT", "TRAFFIC", "FOLLOWERS"],
  EVENT:        ["AWARENESS", "TRAFFIC", "LEADS", "SALES"],
  AI_MOVIE:     ["AWARENESS", "ENGAGEMENT", "TRAFFIC"],
  LIVE_SESSION: ["AWARENESS", "LIVE_VIEWERS", "FOLLOWERS", "ENGAGEMENT"],
  ARENA:        ["AWARENESS", "ENGAGEMENT", "TRAFFIC", "FOLLOWERS"],
}

// ─── Campaign Status ──────────────────────────────────────────────────────────

export type CampaignStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "CREATIVE_IN_PROGRESS"
  | "QUEUED"
  | "ACTIVE"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED"

// ─── Targeting ────────────────────────────────────────────────────────────────

export interface AudienceTargeting {
  /** ISO 3166-1 alpha-2 country codes */
  countries?: string[]
  /** City names */
  cities?: string[]
  /** Distribution channels / platforms */
  platforms?: string[]
  /** Age range */
  ageRange?: { min: number; max: number }
  /** Interests / content categories */
  interests?: string[]
  /** Freeform notes for managed campaigns */
  notes?: string
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface CampaignSchedule {
  startsAt: string          // ISO-8601
  endsAt?: string           // ISO-8601; null = open-ended
  timezone: string          // IANA tz, e.g. "Africa/Lagos"
  /** For LIVE_SESSION promotions — when the live is expected to start */
  liveExpectedStartAt?: string
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export interface CampaignBudget {
  /** Total campaign budget in minor units */
  totalMinor: number
  currency: CurrencyCode
  /** Daily spend cap; null = no cap */
  dailyCapMinor?: number
}

export type BudgetHoldStatus =
  | "ACTIVE"
  | "RELEASED"
  | "CAPTURED"
  | "EXPIRED"
  | "CANCELLED"

export interface BudgetHold {
  id: string
  campaignId: string
  walletId: string
  amountMinor: number
  status: BudgetHoldStatus
  reason?: string
  expiresAt?: string
  releasedAt?: string
  capturedAt?: string
}

export type LedgerEntryType =
  | "WALLET_FUNDING"
  | "INVOICE_PAYMENT"
  | "BUDGET_ALLOCATION"
  | "AD_SPEND"
  | "CREATIVE_COST"
  | "AGENCY_FEE"
  | "REFUND"
  | "ADJUSTMENT"

export type LedgerEntryKind = "CREDIT" | "DEBIT" | "HOLD" | "RELEASE" | "REVERSAL"

export interface CampaignLedgerEntry {
  id: string
  campaignId: string
  workspaceId: string
  type: LedgerEntryType
  kind: LedgerEntryKind
  amountMinor: number
  currency: CurrencyCode
  description?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface CampaignBudgetSummary {
  campaignId: string
  currency: CurrencyCode
  totalBudget: Money
  invoicePaid: Money
  allocatedBudget: Money
  fundsUsed: Money
  remainingBalance: Money
  pendingSpend: Money
  refunded: Money
  adSpend: Money
  creativeCosts: Money
  agencyFees: Money
  adjustments: Money
  updatedAt: string
}

// ─── Delivery / Placements ────────────────────────────────────────────────────

export type PlacementChannel =
  | "TIKTOK"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "WHATSAPP"
  | "YOUTUBE"
  | "GOOGLE"
  | "TWITTER_X"
  | "SNAPCHAT"
  | "IN_APP"    // STARRIA in-app feed
  | "OTHER"

export type PlacementStatus =
  | "DRAFT"
  | "LAUNCHED"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"

export interface AdPlacement {
  id: string
  campaignId: string
  channel: PlacementChannel
  status: PlacementStatus
  /** Provider-specific ad account / ad-set reference */
  provider?: string
  externalPlacementId?: string
  destinationUrl?: string
  budgetMinor: number
  spendMinor: number
  impressions: number
  clicks: number
  conversions: number
  startsAt?: string
  endsAt?: string
  metadata?: {
    adAccountId?: string
    adSetId?: string
    launchNotes?: string
    placementUrl?: string
    clientVisible?: boolean
    [key: string]: unknown
  }
}

// ─── Analytics & Metrics ──────────────────────────────────────────────────────

export type MetricSource = "MANUAL" | "REPORT" | "AD_PLACEMENT" | "PIXEL" | "SDK"

export interface CampaignMetric {
  id: string
  campaignId: string
  workspaceId: string
  name: string
  value: number
  source: MetricSource
  dimensions?: Record<string, string>
  recordedForDate?: string
  recordedAt: string
}

export interface CampaignReport {
  id: string
  campaignId: string
  placementId?: string
  impressions: number
  clicks: number
  conversions: number
  spendMinor: number
  periodStart: string
  periodEnd: string
  publishedAt?: string
  metadata?: Record<string, unknown>
}

export interface AnalyticsOverview {
  campaignId: string
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  totalSpendMinor: number
  ctr: number            // click-through rate (0–1)
  cpm: number            // cost per mille (in minor units)
  cpc: number            // cost per click (in minor units)
  roas?: number          // return on ad spend (ratio)
  liveViewers?: number   // peak live viewers (LIVE_SESSION only)
  trend: Array<{ date: string; impressions: number; clicks: number; spendMinor: number }>
}

// ─── Campaign — core entity ───────────────────────────────────────────────────

export interface Campaign {
  id: string
  workspaceId: string
  creatorUserId: string
  name: string
  objective: CampaignObjective
  status: CampaignStatus

  /** The content being promoted */
  content: PromotableContent

  budget: CampaignBudget
  targeting: AudienceTargeting
  schedule: CampaignSchedule

  /** For LIVE_SESSION campaigns — real-time boost flag */
  realtimBoostEnabled?: boolean

  brief?: string
  provider?: string
  providerReference?: string
  companyProfileId?: string

  submittedAt?: string
  approvedAt?: string
  cancelledAt?: string
  createdAt: string
  updatedAt: string

  metadata?: Record<string, unknown>
}

// ─── Status History ───────────────────────────────────────────────────────────

export interface CampaignStatusEvent {
  id: string
  campaignId: string
  fromStatus?: CampaignStatus
  toStatus: CampaignStatus
  actor: string     // userId or "system"
  reason?: string
  occurredAt: string
}

// ─── Promotion Engine ─────────────────────────────────────────────────────────

export type PromotionSignalKind =
  | "BUDGET_ALERT"        // spend ≥ 85% of budget
  | "UNASSIGNED"          // no operator assigned
  | "PENDING_REVIEW"      // awaiting approval
  | "LAUNCH_PREP"         // approved / creative / queued
  | "LIVE_ACTIVE"         // currently running / live
  | "REPORTING_READY"     // ready for final report
  | "EXPIRING_SOON"       // ending within 24h

export interface PromotionSignal {
  kind: PromotionSignalKind
  campaignId: string
  campaignName: string
  severity: "INFO" | "WARNING" | "CRITICAL"
  detail: string
}

export interface PromotionQueueSummary {
  pendingReviews: number
  launchPreparation: number
  budgetAlerts: number
  reportingQueue: number
  unassigned: number
  signals: PromotionSignal[]
}

// ─── Operator / Assignment ────────────────────────────────────────────────────

export interface CampaignAssignment {
  id: string
  campaignId: string
  userId: string
  role: "LEAD" | "SUPPORT" | "REVIEWER"
  assignedAt: string
  completedAt?: string
  notes?: string
}

// ─── Note ─────────────────────────────────────────────────────────────────────

export type NoteVisibility = "INTERNAL" | "CLIENT"

export interface CampaignNote {
  id: string
  campaignId: string
  authorId: string
  body: string
  visibility: NoteVisibility
  createdAt: string
}
