export const currencies = ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR", "INR"] as const;
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
}

export interface PaymentIntent extends Timestamped {
  id: string;
  workspaceId: string;
  gateway: PaymentGatewayKind;
  amount: Money;
  status: "PENDING" | "REQUIRES_ACTION" | "COMPLETED" | "FAILED" | "CANCELLED";
  providerReference?: string;
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
