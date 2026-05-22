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
  "QUEUED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "REJECTED",
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
  "FLIPTRYBE_STORE"
] as const;
export type DestinationKind = (typeof destinationKinds)[number];

export const providerKinds = ["MOCK", "META", "TIKTOK", "SMM", "MANUAL"] as const;
export type ProviderKind = (typeof providerKinds)[number];

export const paymentGatewayKinds = ["MOCK", "KORAPAY", "PAYSTACK", "STRIPE", "MANUAL"] as const;
export type PaymentGatewayKind = (typeof paymentGatewayKinds)[number];

export const ledgerEntryKinds = ["CREDIT", "DEBIT", "HOLD", "RELEASE", "REVERSAL"] as const;
export type LedgerEntryKind = (typeof ledgerEntryKinds)[number];

export const smmServiceKinds = [
  "FOLLOWERS",
  "LIKES",
  "VIEWS",
  "COMMENTS",
  "SHARES",
  "LIVE_VIEWERS",
  "CHANNEL_MEMBERS"
] as const;
export type SmmServiceKind = (typeof smmServiceKinds)[number];

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
  "audit:read"
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
  url: string;
  handle?: string;
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
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  budget: Money;
  destination: PromotionDestination;
  schedule: CampaignSchedule;
  provider: ProviderKind;
  providerReference?: string;
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

export interface PaymentIntent extends Timestamped {
  id: string;
  workspaceId: string;
  gateway: PaymentGatewayKind;
  amount: Money;
  status: "PENDING" | "REQUIRES_ACTION" | "COMPLETED" | "FAILED" | "CANCELLED";
  providerReference?: string;
  checkoutUrl?: string;
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
