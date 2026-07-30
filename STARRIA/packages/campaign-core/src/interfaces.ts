/**
 * @starria/campaign-core — service interfaces
 *
 * These are the contracts that any STARRIA module must implement to
 * participate in the campaign lifecycle.  Implementations live in
 * the consuming app/service; this package provides only the shapes.
 */

import type {
  Campaign,
  CampaignBudget,
  CampaignBudgetSummary,
  CampaignLedgerEntry,
  CampaignMetric,
  CampaignNote,
  CampaignReport,
  CampaignSchedule,
  CampaignStatus,
  CampaignStatusEvent,
  CampaignAssignment,
  AdPlacement,
  AnalyticsOverview,
  AudienceTargeting,
  BudgetHold,
  CampaignObjective,
  NoteVisibility,
  PlacementChannel,
  PromotableContent,
  PromotionQueueSummary,
} from "./types"

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number
  pageSize?: number
  cursor?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  hasMore: boolean
  nextCursor?: string
}

// ─── Campaign Service ─────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  workspaceId: string
  creatorUserId: string
  name: string
  objective: CampaignObjective
  content: PromotableContent
  budget: CampaignBudget
  targeting: AudienceTargeting
  schedule: CampaignSchedule
  brief?: string
  realtimeBoostEnabled?: boolean
  metadata?: Record<string, unknown>
}

export interface UpdateCampaignInput {
  name?: string
  objective?: CampaignObjective
  budget?: Partial<CampaignBudget>
  targeting?: Partial<AudienceTargeting>
  schedule?: Partial<CampaignSchedule>
  brief?: string
  metadata?: Record<string, unknown>
}

export interface CampaignFilters {
  workspaceId?: string
  status?: CampaignStatus | CampaignStatus[]
  objective?: CampaignObjective
  contentKind?: PromotableContent["kind"]
  creatorUserId?: string
  fromDate?: string
  toDate?: string
}

export interface ICampaignService {
  create(input: CreateCampaignInput): Promise<Campaign>
  getById(campaignId: string): Promise<Campaign | null>
  update(campaignId: string, input: UpdateCampaignInput): Promise<Campaign>
  list(filters: CampaignFilters, pagination?: PaginationParams): Promise<PaginatedResult<Campaign>>
  delete(campaignId: string): Promise<void>
}

// ─── Campaign Lifecycle Service ───────────────────────────────────────────────

export interface ILifecycleService {
  submit(campaignId: string, actorId: string): Promise<Campaign>
  approve(campaignId: string, actorId: string): Promise<Campaign>
  requestChanges(campaignId: string, actorId: string, reason: string): Promise<Campaign>
  reject(campaignId: string, actorId: string, reason: string): Promise<Campaign>
  queue(campaignId: string, actorId: string): Promise<Campaign>
  start(campaignId: string, actorId: string): Promise<Campaign>
  pause(campaignId: string, actorId: string): Promise<Campaign>
  resume(campaignId: string, actorId: string): Promise<Campaign>
  complete(campaignId: string, actorId: string): Promise<Campaign>
  cancel(campaignId: string, actorId: string, reason?: string): Promise<Campaign>
  getStatusHistory(campaignId: string): Promise<CampaignStatusEvent[]>
}

// ─── Budget Service ───────────────────────────────────────────────────────────

export interface BudgetAdjustmentInput {
  amountMinor: number
  reason?: string
  actorId: string
}

export interface IBudgetService {
  getSummary(campaignId: string): Promise<CampaignBudgetSummary>
  getLedger(campaignId: string, pagination?: PaginationParams): Promise<PaginatedResult<CampaignLedgerEntry>>
  increase(campaignId: string, input: BudgetAdjustmentInput): Promise<CampaignBudgetSummary>
  decrease(campaignId: string, input: BudgetAdjustmentInput): Promise<CampaignBudgetSummary>
  createHold(campaignId: string, walletId: string, amountMinor: number, reason?: string): Promise<BudgetHold>
  releaseHold(campaignId: string, holdId: string, actorId: string): Promise<BudgetHold>
  captureHold(campaignId: string, holdId: string, actualSpendMinor: number, actorId: string): Promise<BudgetHold>
  /** Returns true if campaign spend has crossed the given threshold (0–1) */
  isNearBudgetLimit(campaignId: string, threshold?: number): Promise<boolean>
}

// ─── Targeting Service ────────────────────────────────────────────────────────

export interface ITargetingService {
  get(campaignId: string): Promise<AudienceTargeting>
  update(campaignId: string, targeting: Partial<AudienceTargeting>): Promise<AudienceTargeting>
  /**
   * Validate that the targeting spec is satisfiable for the given content kind.
   * Returns an array of human-readable validation issues (empty = valid).
   */
  validate(targeting: AudienceTargeting, contentKind: PromotableContent["kind"]): Promise<string[]>
}

// ─── Scheduling Service ───────────────────────────────────────────────────────

export interface ISchedulingService {
  get(campaignId: string): Promise<CampaignSchedule>
  update(campaignId: string, schedule: Partial<CampaignSchedule>): Promise<CampaignSchedule>
  /** Returns campaigns whose schedule window starts within [from, to] */
  getUpcoming(from: string, to: string): Promise<Campaign[]>
  /** Returns campaigns whose schedule window ended before `asOf` but are still RUNNING */
  getOverdue(asOf?: string): Promise<Campaign[]>
}

// ─── Delivery Service ─────────────────────────────────────────────────────────

export interface CreatePlacementInput {
  campaignId: string
  channel: PlacementChannel
  destinationUrl?: string
  budgetMinor: number
  spendMinor?: number
  impressions?: number
  clicks?: number
  conversions?: number
  startsAt?: string
  endsAt?: string
  provider?: string
  externalPlacementId?: string
  metadata?: AdPlacement["metadata"]
}

export interface UpdatePlacementInput {
  status?: AdPlacement["status"]
  spendMinor?: number
  impressions?: number
  clicks?: number
  conversions?: number
  endsAt?: string
  metadata?: AdPlacement["metadata"]
}

export interface IDeliveryService {
  createPlacement(input: CreatePlacementInput, actorId: string): Promise<AdPlacement>
  updatePlacement(placementId: string, input: UpdatePlacementInput, actorId: string): Promise<AdPlacement>
  listPlacements(campaignId: string): Promise<AdPlacement[]>
  getPlacement(placementId: string): Promise<AdPlacement | null>
  pausePlacement(placementId: string, actorId: string): Promise<AdPlacement>
  completePlacement(placementId: string, actorId: string): Promise<AdPlacement>
  cancelPlacement(placementId: string, actorId: string): Promise<AdPlacement>
}

// ─── Analytics Service ────────────────────────────────────────────────────────

export interface AddMetricInput {
  metricName?: string
  value?: number
  impressions?: number
  clicks?: number
  conversions?: number
  spendMinor?: number
  liveViewers?: number
  source?: CampaignMetric["source"]
  recordedForDate?: string
  notes?: string
  dimensions?: Record<string, string>
}

export interface IAnalyticsService {
  getOverview(campaignId: string): Promise<AnalyticsOverview>
  addMetric(campaignId: string, input: AddMetricInput, actorId: string): Promise<CampaignMetric>
  listMetrics(campaignId: string, pagination?: PaginationParams): Promise<PaginatedResult<CampaignMetric>>
  /** Workspace-level roll-up across all campaigns */
  getWorkspaceOverview(workspaceId: string): Promise<AnalyticsOverview>
}

// ─── Impression & Click Tracking ──────────────────────────────────────────────
// Lightweight tracking interfaces suited for high-frequency event ingestion.

export interface ImpressionEvent {
  campaignId: string
  placementId?: string
  contentId: string
  viewerId?: string          // null = anonymous
  platform?: string
  countryCode?: string
  occurredAt: string
}

export interface ClickEvent {
  campaignId: string
  placementId?: string
  contentId: string
  clickerId?: string
  destinationUrl?: string
  platform?: string
  countryCode?: string
  occurredAt: string
}

export interface IImpressionTracker {
  record(event: ImpressionEvent): Promise<void>
  recordBatch(events: ImpressionEvent[]): Promise<void>
  getCount(campaignId: string, from?: string, to?: string): Promise<number>
}

export interface IClickTracker {
  record(event: ClickEvent): Promise<void>
  recordBatch(events: ClickEvent[]): Promise<void>
  getCount(campaignId: string, from?: string, to?: string): Promise<number>
  getCTR(campaignId: string, from?: string, to?: string): Promise<number>
}

// ─── Reporting Service ────────────────────────────────────────────────────────

export interface CreateReportInput {
  campaignId: string
  placementId?: string
  impressions: number
  clicks: number
  conversions: number
  spendMinor: number
  periodStart: string
  periodEnd: string
  metadata?: Record<string, unknown>
}

export interface IReportingService {
  create(input: CreateReportInput, actorId: string): Promise<CampaignReport>
  publish(reportId: string, actorId: string): Promise<CampaignReport>
  list(campaignId: string, pagination?: PaginationParams): Promise<PaginatedResult<CampaignReport>>
  getById(reportId: string): Promise<CampaignReport | null>
}

// ─── Promotion Engine ─────────────────────────────────────────────────────────

export interface IPromotionEngine {
  /** Compute the full signal set for a workspace ops dashboard */
  getQueueSummary(workspaceId: string): Promise<PromotionQueueSummary>
  /** Returns campaigns that need operator action right now */
  getActionableItems(workspaceId: string, limit?: number): Promise<Campaign[]>
  /**
   * Score a piece of promotable content against active campaigns.
   * Higher score = more promotional pressure.  0 = no active campaign.
   */
  scoreContent(contentId: string): Promise<number>
}

// ─── Notes Service ────────────────────────────────────────────────────────────

export interface INotesService {
  add(campaignId: string, authorId: string, body: string, visibility: NoteVisibility): Promise<CampaignNote>
  list(campaignId: string, visibility?: NoteVisibility): Promise<CampaignNote[]>
}

// ─── Assignment Service ───────────────────────────────────────────────────────

export interface IAssignmentService {
  assign(campaignId: string, userId: string, role: CampaignAssignment["role"], assignedBy: string): Promise<CampaignAssignment>
  unassign(campaignId: string, userId: string): Promise<void>
  list(campaignId: string): Promise<CampaignAssignment[]>
  getUnassigned(workspaceId: string): Promise<Campaign[]>
}
