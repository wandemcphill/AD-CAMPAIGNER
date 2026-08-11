export const currencies = ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"] as const;
export type CurrencyCode = (typeof currencies)[number];

export const campaignObjectives = [
  "AWARENESS",
  "ENGAGEMENT",
  "TRAFFIC",
  "LEADS",
  "SALES",
  "APP_INSTALLS",
  "FOLLOWERS",
  "LIVE_VIEWERS"
] as const;
export type CampaignObjective = (typeof campaignObjectives)[number];

export const campaignStatuses = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "CREATIVE_IN_PROGRESS",
  "QUEUED",
  "ACTIVE",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "FAILED"
] as const;
export type CampaignStatus = (typeof campaignStatuses)[number];

export const destinationKinds = [
  "TIKTOK_PROFILE",
  "TIKTOK_LIVE",
  "TIKTOK_BOX_GAME",
  "TIKTOK_SHOP",
  "INSTAGRAM_PROFILE",
  "INSTAGRAM_REEL",
  "INSTAGRAM_LIVE",
  "FACEBOOK_PAGE",
  "FACEBOOK_LIVE",
  "WHATSAPP_CHANNEL",
  "WHATSAPP_GROUP",
  "TELEGRAM_CHANNEL",
  "TELEGRAM_GROUP",
  "YOUTUBE_CHANNEL",
  "WEBSITE",
  "APP",
  "ECOMMERCE_STORE",
  "FLIPTRYBE_STORE",
  "DELIVERY_CONTACT"
] as const;
export type DestinationKind = (typeof destinationKinds)[number];

export const providerKinds = ["MOCK", "META", "TIKTOK", "SMM", "MANUAL"] as const;
export type ProviderKind = (typeof providerKinds)[number];

export const paymentGatewayKinds = ["MOCK", "KORAPAY", "PAYSTACK", "STRIPE", "MANUAL"] as const;
export type PaymentGatewayKind = (typeof paymentGatewayKinds)[number];

export const ledgerEntryKinds = ["CREDIT", "DEBIT", "HOLD", "RELEASE", "REVERSAL"] as const;
export type LedgerEntryKind = (typeof ledgerEntryKinds)[number];

export const campaignLedgerEntryTypes = [
  "WALLET_FUNDING",
  "INVOICE_PAYMENT",
  "BUDGET_ALLOCATION",
  "AD_SPEND",
  "CREATIVE_COST",
  "AGENCY_FEE",
  "REFUND",
  "ADJUSTMENT"
] as const;
export type CampaignLedgerEntryType = (typeof campaignLedgerEntryTypes)[number];

export const campaignLedgerEntryDirections = [
  "CREDIT",
  "DEBIT",
  "HOLD",
  "RELEASE",
  "REVERSAL"
] as const;
export type CampaignLedgerEntryDirection = (typeof campaignLedgerEntryDirections)[number];

export const smmServiceKinds = [
  "FOLLOWERS",
  "LIKES",
  "VIEWS",
  "COMMENTS",
  "SHARES",
  "LIVE_VIEWERS",
  "CHANNEL_MEMBERS",
  "ACCOUNT_SALE",
  "VPN_SUBSCRIPTION",
  "STREAMING_SUBSCRIPTION"
] as const;
export type SmmServiceKind = (typeof smmServiceKinds)[number];

export const growthServicePlatforms = [
  "TIKTOK",
  "INSTAGRAM",
  "YOUTUBE",
  "TELEGRAM",
  "WEBSITE",
  "DIGITAL_GOODS"
] as const;
export type GrowthServicePlatform = (typeof growthServicePlatforms)[number];

export const growthOrderStatuses = [
  "PENDING",
  "SUBMITTED",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "REFUNDED"
] as const;
export type GrowthOrderStatus = (typeof growthOrderStatuses)[number];

export const growthRiskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type GrowthRiskLevel = (typeof growthRiskLevels)[number];

export const otpOrderStatuses = [
  "QUOTED",
  "CHARGED",
  "ALLOCATING",
  "WAITING",
  "RECEIVED",
  "COMPLETED",
  "EXPIRED",
  "REFUNDED",
  "FAILED",
  "CANCELLED"
] as const;
export type OtpOrderStatus = (typeof otpOrderStatuses)[number];

export const otpProviderTiers = ["PREMIUM", "BUDGET"] as const;
export type OtpProviderTier = (typeof otpProviderTiers)[number];

export const otpProviderStatuses = ["HEALTHY", "DEGRADED", "DOWN", "DISABLED"] as const;
export type OtpProviderStatus = (typeof otpProviderStatuses)[number];

export const otpWalletChargeStatuses = ["CHARGED", "REFUNDED", "FAILED"] as const;
export type OtpWalletChargeStatus = (typeof otpWalletChargeStatuses)[number];

export const digitalAccessRequestStatuses = [
  "pending",
  "processing",
  "fulfilled",
  "cancelled",
  "failed"
] as const;
export type DigitalAccessRequestStatus = (typeof digitalAccessRequestStatuses)[number];

export const digitalAccessContactTypes = ["whatsapp", "email"] as const;
export type DigitalAccessContactType = (typeof digitalAccessContactTypes)[number];

export const digitalAccessWalletChargeStatuses = ["CHARGED", "REFUNDED", "FAILED"] as const;
export type DigitalAccessWalletChargeStatus = (typeof digitalAccessWalletChargeStatuses)[number];

export const roles = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "MARKETER",
  "FINANCE",
  "SUPPORT",
  "VIEWER"
] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "campaign:create",
  "campaign:approve",
  "campaign:manage",
  "payment:manage",
  "wallet:withdraw",
  "analytics:read",
  "team:manage",
  "admin:access",
  "support:manage",
  "audit:read",
  "trust_engine:moderate"
] as const;
export type Permission = (typeof permissions)[number];

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Organization extends Timestamped {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  region: string;
}

export interface Workspace extends Timestamped {
  id: string;
  organizationId: string;
  name: string;
  defaultCurrency: CurrencyCode;
}

export interface TeamMember extends Timestamped {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  permissions: Permission[];
}

export interface PromotionDestination {
  kind: DestinationKind;
  /** Required for URL-based destinations; omitted when kind is DELIVERY_CONTACT. */
  url?: string;
  handle?: string;
  /** WhatsApp number or email the order is fulfilled to, when kind is DELIVERY_CONTACT. */
  contactType?: DigitalAccessContactType;
  contactValue?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CampaignSchedule {
  startsAt: string;
  endsAt?: string;
  timezone: string;
}

export interface Campaign extends Timestamped {
  id: string;
  workspaceId: string;
  creatorUserId: string;
  companyProfileId?: string | null;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  budget: Money;
  budgetSummary?: CampaignBudgetSummary;
  remainingBudget?: Money;
  assignedOperator?: CampaignAssignedOperator | null;
  destination: PromotionDestination;
  schedule: CampaignSchedule;
  provider: ProviderKind;
  providerReference?: string;
  brief?: string | null;
  targetAudience?: Record<string, unknown>;
  placementPlan?: Record<string, unknown>;
  submittedAt?: string | null;
  approvedAt?: string | null;
  cancelledAt?: string | null;
  statusHistory?: CampaignStatusHistoryItem[];
  notes?: Array<Record<string, unknown>>;
}

export interface LivePromotion extends Timestamped {
  id: string;
  campaignId: string;
  destinationKind: Extract<DestinationKind, "TIKTOK_LIVE" | "INSTAGRAM_LIVE" | "FACEBOOK_LIVE">;
  realtimeBoostEnabled: boolean;
  expectedStartAt: string;
  actualStartedAt?: string | null;
  actualEndedAt?: string | null;
}

export interface SmmOrder extends Timestamped {
  id: string;
  workspaceId: string;
  serviceKind: SmmServiceKind;
  destination: PromotionDestination;
  quantity: number;
  status: "DRAFT" | "QUEUED" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  supplierReference?: string;
}

export interface GrowthRiskAssessment {
  platformPolicyRisk: GrowthRiskLevel;
  accountRisk: GrowthRiskLevel;
  refundRisk: GrowthRiskLevel;
  reputationRisk: GrowthRiskLevel;
  summary: string;
  mitigations: string[];
}

export interface GrowthServiceRouting {
  strategy: "LOWEST_COST" | "PREFERRED_FIRST" | "MANUAL_REVIEW";
  preferredSupplier?: string;
  fallbackSuppliers: string[];
}

export interface GrowthServiceCatalogItem {
  code: string;
  name: string;
  platform: GrowthServicePlatform;
  category: string;
  serviceKind: SmmServiceKind;
  destinationKind: DestinationKind;
  description: string;
  enabled: boolean;
  pricingModel: "PER_1000" | "FLAT";
  baseRate: Money;
  minimumQuantity: number;
  maximumQuantity: number;
  quantityStep: number;
  estimatedDeliveryMinutes: number;
  expectedCompletion: string;
  marginBps: number;
  supportsRefill: boolean;
  supportsCancel: boolean;
  supplierRouting: GrowthServiceRouting;
  risk: GrowthRiskAssessment;
}

export interface GrowthOrder extends Timestamped {
  id: string;
  workspaceId: string;
  serviceCode: string;
  serviceName: string;
  platform: GrowthServicePlatform;
  serviceKind: SmmServiceKind;
  destinationKind: DestinationKind;
  destinationUrl?: string;
  deliveryContact?: string;
  quantityOrdered: number;
  quantityDelivered: number;
  status: GrowthOrderStatus;
  amount: Money;
  supplierCost: Money;
  grossMargin: Money;
  expectedCompletionAt: string;
  idempotencyKey?: string;
  paymentStatus?:
    | "FUNDS_REQUIRED"
    | "FUNDS_RESERVED"
    | "FUNDS_CAPTURED"
    | "FUNDS_RELEASED"
    | "REFUNDED"
    | "MANUAL_REVIEW";
  reservationLedgerEntryId?: string;
  captureLedgerEntryId?: string;
  releaseLedgerEntryId?: string;
  refundLedgerEntryId?: string;
  refundEligibility?: "NONE" | "AUTOMATIC" | "MANUAL_REVIEW";
  refundReviewStatus?: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  submittedAt?: string;
  completedAt?: string;
  supplierName?: string;
  supplierReference?: string;
  failureReason?: string;
  adminNote?: string;
}

export interface OtpService extends Timestamped {
  id: string;
  code: string;
  name: string;
  countryCode: string;
  providerTier: OtpProviderTier;
  category: string;
  visible: boolean;
  requiresAdminApproval: boolean;
}

export interface OtpProviderHealth extends Timestamped {
  providerName: string;
  tier: OtpProviderTier;
  status: OtpProviderStatus;
  latencyMs: number;
  successRateBps: number;
  balance?: Money;
  reason?: string;
}

export interface OtpPricingResult {
  supplierCost: Money;
  customerPrice: Money;
  grossMargin: Money;
  marginBps: number;
  markupBps: number;
  exchangeRate: number;
  profitable: boolean;
}

export interface OtpRoutingAttempt extends Timestamped {
  id: string;
  otpOrderId: string;
  providerName: string;
  providerTier: OtpProviderTier;
  score: number;
  status: "SELECTED" | "FAILED" | "SKIPPED";
  reason?: string;
}

export interface OtpMessage extends Timestamped {
  id: string;
  otpOrderId: string;
  status: "RECEIVED" | "REDACTED";
  redactedMessage: string;
  receivedAt?: string;
}

export interface OtpWalletCharge extends Timestamped {
  id: string;
  workspaceId: string;
  walletId: string;
  otpOrderId: string;
  idempotencyKey: string;
  amount: Money;
  status: OtpWalletChargeStatus;
  debitLedgerEntryId?: string;
  refundLedgerEntryId?: string;
  providerName?: string;
  providerReference?: string;
}

export interface OtpOrder extends Timestamped {
  id: string;
  workspaceId: string;
  serviceCode: string;
  serviceName: string;
  countryCode: string;
  providerTier: OtpProviderTier;
  providerName?: string;
  providerReference?: string;
  status: OtpOrderStatus;
  phoneNumberMasked?: string;
  expiresAt?: string;
  amount: Money;
  supplierCost: Money;
  idempotencyKey: string;
  attestationAccepted: boolean;
  riskScore: number;
  message?: OtpMessage;
}

export interface OtpRefundResult {
  otpOrderId: string;
  status: "REFUNDED" | "SKIPPED";
  amount: Money;
  ledgerEntryId?: string;
}

export interface OtpRoutingResult {
  providerName: string;
  providerTier: OtpProviderTier;
  score: number;
  quote: OtpPricingResult;
  attempts: OtpRoutingAttempt[];
}

export interface DigitalAccessCategory extends Timestamped {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DigitalAccessPlan extends Timestamped {
  id: string;
  serviceId: string;
  planName: string;
  duration: string;
  price: Money;
  description: string;
  isActive: boolean;
}

export interface DigitalAccessService extends Timestamped {
  id: string;
  name: string;
  category: string;
  slug: string;
  description: string;
  startingPrice: Money;
  deliveryEta: string;
  isActive: boolean;
  isFeatured: boolean;
  thumbnail?: string;
  plans?: DigitalAccessPlan[];
}

export interface DigitalAccessRequest extends Timestamped {
  id: string;
  workspaceId: string;
  userId?: string | null;
  serviceId: string;
  planId: string;
  serviceName: string;
  planName: string;
  contactType: DigitalAccessContactType;
  contactValue: string;
  notes?: string;
  status: DigitalAccessRequestStatus;
  assignedTo?: string | null;
  amount: Money;
  idempotencyKey: string;
  walletChargeId?: string;
}

export interface DigitalAccessWalletCharge extends Timestamped {
  id: string;
  workspaceId: string;
  walletId: string;
  requestId: string;
  idempotencyKey: string;
  amount: Money;
  status: DigitalAccessWalletChargeStatus;
  debitLedgerEntryId?: string;
  refundLedgerEntryId?: string;
}

export interface DigitalAccessRefundResult {
  requestId: string;
  status: "REFUNDED" | "SKIPPED";
  amount: Money;
  ledgerEntryId?: string;
}

export interface Wallet extends Timestamped {
  id: string;
  workspaceId: string;
  availableBalance: Money;
  heldBalance: Money;
}

export interface LedgerEntry extends Timestamped {
  id: string;
  walletId: string;
  kind: LedgerEntryKind;
  amount: Money;
  reference: string;
  description: string;
  idempotencyKey?: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface CampaignLedgerEntry extends Timestamped {
  id: string;
  workspaceId: string;
  campaignId: string;
  type: CampaignLedgerEntryType;
  direction: CampaignLedgerEntryDirection;
  amount: Money;
  category: string;
  description: string;
  occurredAt: string;
  notes?: string | null;
  operator?: string | null;
  actorUserId?: string | null;
  walletId?: string | null;
  walletLedgerEntryId?: string | null;
  paymentIntentId?: string | null;
  campaignInvoiceId?: string | null;
  campaignBudgetHoldId?: string | null;
  campaignSpendEntryId?: string | null;
  campaignReportId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface CampaignBudgetSummary {
  campaignId: string;
  currency: CurrencyCode;
  totalBudget: Money;
  invoicePaid: Money;
  allocatedBudget: Money;
  fundsUsed: Money;
  remainingBalance: Money;
  pendingSpend: Money;
  refunded: Money;
  adSpend: Money;
  creativeCosts: Money;
  agencyFees: Money;
  adjustments: Money;
  updatedAt: string;
}

export interface CampaignSpendBreakdown {
  campaignId: string;
  currency: CurrencyCode;
  totalSpend: Money;
  categories: Array<{
    type: CampaignLedgerEntryType;
    label: string;
    amount: Money;
    percentageBps: number;
  }>;
  timeline: Array<{
    date: string;
    label: string;
    type: CampaignLedgerEntryType;
    amount: Money;
  }>;
}

export interface CampaignAssignedOperator {
  userId: string;
  name: string;
  email?: string | null;
}

export interface CampaignStatusHistoryItem extends Timestamped {
  id: string;
  campaignId: string;
  fromStatus?: CampaignStatus | null;
  toStatus: CampaignStatus;
  actorUserId?: string | null;
  actorType: string;
  reason?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface CampaignAuditTrailItem {
  id: string;
  kind: "audit" | "status";
  action: string;
  actorUserId?: string | null;
  actorType?: string | null;
  timestamp?: string | null;
  previousValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
  metadata?: Record<string, unknown>;
}

export interface PaymentIntent extends Timestamped {
  id: string;
  workspaceId: string;
  gateway: PaymentGatewayKind;
  amount: Money;
  status: "PENDING" | "REQUIRES_ACTION" | "COMPLETED" | "FAILED" | "CANCELLED";
  providerReference?: string;
  checkoutUrl?: string;
  walletId?: string | null;
  campaignId?: string | null;
  campaignInvoiceId?: string | null;
  completedAt?: string | null;
  creditedAt?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AnalyticsMetric {
  workspaceId: string;
  campaignId?: string;
  name: string;
  value: number;
  dimensions: Record<string, string>;
  recordedAt: string;
}

export interface AuditLog extends Timestamped {
  id: string;
  workspaceId?: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface NotificationMessage extends Timestamped {
  id: string;
  workspaceId: string;
  channel: "EMAIL" | "IN_APP" | "WEBSOCKET" | "WHATSAPP";
  title: string;
  body: string;
  readAt?: string | null;
}

export interface SupportTicket extends Timestamped {
  id: string;
  workspaceId: string;
  requesterUserId: string;
  subject: string;
  status: "OPEN" | "PENDING" | "ESCALATED" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

export interface ReferralAccount extends Timestamped {
  id: string;
  workspaceId: string;
  code: string;
  commissionRateBps: number;
}

export * from "./envelope";
