/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { hasPermission } from "@fliptrybe/auth";
import {
  createKorapayPaymentGateway,
  createMockPaymentGateway,
  createMockStorageProvider,
  createPaystackPaymentGateway
} from "@fliptrybe/providers";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import {
  assessCampaignRisk,
  buildMetaLaunchSpec,
  estimateOutcomeForGoal,
  normalizeCampaignSpec,
  normalizeGoalSafe,
  recommendBudgetOptimization,
  recommendCampaignTargeting,
  type CampaignGoal,
  type CampaignPerformanceInput,
  type CampaignSpec,
  type CampaignTargetingRecommendation
} from "@fliptrybe/service-campaigns";
import { AnthropicRecommendationClient } from "@fliptrybe/service-ai-engine";
import {
  campaignLedgerEntryTypes,
  currencies,
  type CampaignBudgetSummary,
  type CampaignLedgerEntry,
  type CampaignLedgerEntryDirection,
  type CampaignLedgerEntryType,
  type CampaignSpendBreakdown,
  type CurrencyCode,
  type LedgerEntry,
  type Permission
} from "@fliptrybe/types";

import { PrismaService } from "./prisma.service";
import { NotificationsService } from "./notifications/notifications.service";
import type { AuthenticatedRequestContext } from "./request-context";
import { ApprovalsService } from "./approvals/approvals.service";

type DbClient = Record<string, any>;

const now = () => new Date();
const iso = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString() : value ?? undefined;
const id = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

const campaignInclude = {
  destination: true,
  companyProfile: true,
  persona: true,
  creatives: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
  notes: { orderBy: { createdAt: "desc" } },
  statusHistory: { orderBy: { createdAt: "asc" } },
  assignments: {
    include: { assignee: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" }
  },
  manualPlacements: { orderBy: { createdAt: "desc" } },
  reports: { orderBy: { createdAt: "desc" } },
  invoices: { orderBy: { createdAt: "desc" } },
  budgetHolds: { orderBy: { createdAt: "desc" } },
  spendEntries: { orderBy: { createdAt: "desc" } }
};

const allowedCampaignStatuses = [
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

const launchedCampaignStatuses = new Set(["ACTIVE", "RUNNING", "PAUSED", "COMPLETED"]);
const terminalCampaignStatuses = new Set(["COMPLETED", "CANCELLED", "FAILED", "REJECTED"]);
const clientPauseStatuses = new Set(["ACTIVE", "RUNNING"]);
const clientResumeStatuses = new Set(["PAUSED"]);
const clientChangeRequestStatuses = new Set([
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "CREATIVE_IN_PROGRESS",
  "QUEUED",
  "ACTIVE",
  "RUNNING",
  "PAUSED"
]);
const clientStopStatuses = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "CREATIVE_IN_PROGRESS",
  "QUEUED",
  "ACTIVE",
  "RUNNING",
  "PAUSED"
]);
const manualPlacementChannels = new Set([
  "TIKTOK",
  "INSTAGRAM",
  "FACEBOOK",
  "WHATSAPP",
  "GOOGLE",
  "OTHER"
]);
const reportTypes = new Set(["daily_update", "weekly_report", "final_report"]);

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoMimeTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const maxImageBytes = Number(process.env.MEDIA_MAX_IMAGE_BYTES ?? 10 * 1024 * 1024);
const maxVideoBytes = Number(process.env.MEDIA_MAX_VIDEO_BYTES ?? 100 * 1024 * 1024);
const maxScreenshotBytes = Number(process.env.MEDIA_MAX_SCREENSHOT_BYTES ?? 15 * 1024 * 1024);

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

function getSecret(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "..." || trimmed.startsWith("replace-")) {
    return undefined;
  }

  return trimmed;
}

function allowMockMediaStorageFallback() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return ["1", "true", "yes", "on"].includes(
    process.env.MEDIA_UPLOAD_ALLOW_MOCK_STORAGE?.trim().toLowerCase() ?? ""
  );
}

function verifyCloudinaryUploadCompletion(asset: Record<string, any>, input: Record<string, any>) {
  if (asset.storageProvider !== "cloudinary") {
    return true;
  }

  const apiSecret = getSecret(process.env.CLOUDINARY_API_SECRET);
  const publicId = String(input.public_id ?? input.providerPublicId ?? "");
  const version = input.version === undefined ? "" : String(input.version);
  const signature = String(input.signature ?? "");

  if (!apiSecret || !publicId || !version || !signature) {
    return false;
  }
  if (asset.providerPublicId && publicId !== asset.providerPublicId) {
    return false;
  }

  const expected = Buffer.from(
    createHash("sha1").update(`public_id=${publicId}&version=${version}${apiSecret}`).digest("hex")
  );
  const actual = Buffer.from(signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getCurrency(value: string | undefined, fallback: CurrencyCode): CurrencyCode {
  return currencies.includes(value as CurrencyCode) ? (value as CurrencyCode) : fallback;
}

const campaignLedgerLabels: Record<CampaignLedgerEntryType, string> = {
  WALLET_FUNDING: "Wallet funding",
  INVOICE_PAYMENT: "Invoice payment",
  BUDGET_ALLOCATION: "Budget allocation",
  AD_SPEND: "Ad spend",
  CREATIVE_COST: "Creative cost",
  AGENCY_FEE: "Agency fee",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment"
};

const campaignSpendTypes = new Set<CampaignLedgerEntryType>([
  "AD_SPEND",
  "CREATIVE_COST",
  "AGENCY_FEE",
  "ADJUSTMENT"
]);

function normalizeCampaignLedgerEntryType(value: unknown): CampaignLedgerEntryType {
  const normalized = String(value ?? "AD_SPEND").toUpperCase().replace(/[\s-]+/g, "_");

  return campaignLedgerEntryTypes.includes(normalized as CampaignLedgerEntryType)
    ? (normalized as CampaignLedgerEntryType)
    : "AD_SPEND";
}

function normalizeCampaignLedgerDirection(
  value: unknown,
  type: CampaignLedgerEntryType
): CampaignLedgerEntryDirection {
  const normalized = String(value ?? "").toUpperCase();
  if (["CREDIT", "DEBIT", "HOLD", "RELEASE", "REVERSAL"].includes(normalized)) {
    return normalized as CampaignLedgerEntryDirection;
  }
  if (type === "BUDGET_ALLOCATION") {
    return "HOLD";
  }
  if (type === "WALLET_FUNDING") {
    return "CREDIT";
  }
  if (type === "REFUND") {
    return "RELEASE";
  }

  return "DEBIT";
}

function campaignLedgerCategory(type: CampaignLedgerEntryType) {
  return campaignLedgerLabels[type] ?? "Campaign finance";
}

function money(amountMinor: number, currency: string | undefined) {
  return {
    amountMinor: Math.max(0, Math.round(Number(amountMinor) || 0)),
    currency: getCurrency(currency, "NGN")
  };
}

function entrySourceKey(entry: Pick<CampaignLedgerEntry, "sourceType" | "sourceId" | "type" | "direction">) {
  return `${entry.sourceType ?? "entry"}:${entry.sourceId ?? "none"}:${entry.type}:${entry.direction}`;
}

function isDebitSpend(entry: CampaignLedgerEntry) {
  return campaignSpendTypes.has(entry.type) && entry.direction === "DEBIT";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeObjective(value: unknown) {
  const normalized = String(value ?? "ENGAGEMENT").toUpperCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    WHATSAPP_MESSAGES: "LEADS",
    WEBSITE_TRAFFIC: "TRAFFIC",
    APP_INSTALLS: "APP_INSTALLS",
    AWARENESS: "AWARENESS",
    LEADS: "LEADS",
    SALES: "SALES",
    ENGAGEMENT: "ENGAGEMENT",
    FOLLOWERS: "FOLLOWERS",
    LIVE_VIEWERS: "LIVE_VIEWERS"
  };

  return aliases[normalized] ?? "ENGAGEMENT";
}

function normalizeDestinationKind(input: Record<string, any>) {
  const explicit = typeof input.destinationKind === "string" ? input.destinationKind : undefined;
  if (explicit) {
    return explicit.toUpperCase();
  }

  const platform = String(input.platform ?? input.channel ?? "INSTAGRAM").toUpperCase();
  if (platform.includes("TIKTOK")) {
    return "TIKTOK_PROFILE";
  }
  if (platform.includes("FACEBOOK")) {
    return "FACEBOOK_PAGE";
  }
  if (platform.includes("WHATSAPP")) {
    return "WHATSAPP_CHANNEL";
  }
  if (platform.includes("APP")) {
    return "APP";
  }
  if (platform.includes("WEBSITE")) {
    return "WEBSITE";
  }

  return "INSTAGRAM_REEL";
}

const LIVE_DESTINATION_KINDS = new Set(["TIKTOK_LIVE", "INSTAGRAM_LIVE", "FACEBOOK_LIVE"]);

function normalizeCampaignStatus(value: unknown) {
  const status = String(value ?? "").toUpperCase().replace(/[\s-]+/g, "_");

  if (allowedCampaignStatuses.includes(status as (typeof allowedCampaignStatuses)[number])) {
    return status;
  }

  throw new BadRequestException(`Unsupported campaign status: ${String(value)}`);
}

function normalizeJsonObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

const campaignGoals = new Set<CampaignGoal>([
  "WHATSAPP_MESSAGES",
  "WEBSITE_VISITS",
  "VIDEO_VIEWS",
  "PHONE_CALLS",
  "MORE_FOLLOWERS",
  "SALES",
  "STORE_VISITS",
  "LIVE_VIEWERS"
]);

function isCampaignGoal(value: unknown): value is CampaignGoal {
  return typeof value === "string" && campaignGoals.has(value as CampaignGoal);
}

/**
 * Best-effort reverse mapping from the coarser CampaignObjective to a CampaignGoal label, used
 * only for campaigns created outside the wizard (which don't persist an explicit goal). This is
 * advisory labelling for the launch-spec copy instructions -- it never affects budget, targeting,
 * or the destination link, which always come straight from stored campaign data.
 */
function goalFromObjective(objective: string, destinationKind?: string): CampaignGoal {
  switch (objective) {
    case "TRAFFIC":
      return "WEBSITE_VISITS";
    case "LEADS":
      return destinationKind === "WHATSAPP_CHANNEL" ? "WHATSAPP_MESSAGES" : "PHONE_CALLS";
    case "ENGAGEMENT":
      return "VIDEO_VIEWS";
    case "SALES":
      return "SALES";
    case "FOLLOWERS":
      return "MORE_FOLLOWERS";
    case "LIVE_VIEWERS":
      return "LIVE_VIEWERS";
    default:
      return "WEBSITE_VISITS";
  }
}

const campaignOutcomeSources = new Set(["CUSTOMER_PROMPT", "PLATFORM_DERIVED", "OPERATOR"]);

function normalizeCampaignOutcomeSource(value: unknown) {
  const normalized = String(value ?? "CUSTOMER_PROMPT").toUpperCase();

  return campaignOutcomeSources.has(normalized) ? normalized : "CUSTOMER_PROMPT";
}

function parseNonNegativeInt(value: unknown, field: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer.`);
  }

  return parsed;
}

const adAccountTypes = new Set(["CONNECTED", "MANAGED", "DEDICATED"]);
const adPlatforms = new Set(["META", "TIKTOK", "GOOGLE", "MANUAL"]);
const kycStatuses = new Set(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]);
const kycTiers = new Set(["LIGHT", "STANDARD", "ENHANCED"]);

function normalizeKycTier(value: unknown) {
  const normalized = String(value ?? "").toUpperCase();

  if (!kycTiers.has(normalized)) {
    throw new BadRequestException(`Unsupported KYC tier: ${String(value)}.`);
  }

  return normalized;
}

function normalizeAdAccountType(value: unknown) {
  const normalized = String(value ?? "MANAGED").toUpperCase();

  if (!adAccountTypes.has(normalized)) {
    throw new BadRequestException(`Unsupported ad account type: ${String(value)}.`);
  }

  return normalized;
}

function normalizeAdPlatform(value: unknown) {
  const normalized = String(value ?? "META").toUpperCase();

  return adPlatforms.has(normalized) ? normalized : "META";
}

function normalizeKycStatus(value: unknown) {
  const normalized = String(value ?? "").toUpperCase();

  if (!kycStatuses.has(normalized)) {
    throw new BadRequestException(`Unsupported KYC status: ${String(value)}.`);
  }

  return normalized;
}

/**
 * KYC scales with risk, not customer type (per the account-tier design): Connected advertisers
 * spend from their own platform account so a light identity check suffices; Managed pool
 * advertisers are funded by FlipTrybe so they need standard business verification; Dedicated
 * accounts are high-spend/high-risk and require enhanced KYB before any spend.
 */
function defaultKycTierForAccountType(type: string) {
  if (type === "DEDICATED") {
    return "ENHANCED";
  }
  if (type === "CONNECTED") {
    return "LIGHT";
  }

  return "STANDARD";
}

function platformFromDestinationKind(destinationKind?: string) {
  if (!destinationKind) {
    return "META";
  }
  if (destinationKind.startsWith("TIKTOK")) {
    return "TIKTOK";
  }
  if (destinationKind === "WEBSITE" || destinationKind === "ECOMMERCE_STORE" || destinationKind === "APP") {
    return "GOOGLE";
  }

  return "META";
}

function arrayOrSingle(list: unknown, single: unknown): string[] | undefined {
  if (Array.isArray(list) && list.length > 0) {
    return list.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  }
  if (typeof single === "string" && single.trim().length > 0) {
    return [single.trim()];
  }

  return undefined;
}

function requiredString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(message);
  }

  return value.trim();
}

function normalizeReportType(value: unknown) {
  const normalized = String(value ?? "weekly_report").toLowerCase().replace(/[\s-]+/g, "_");

  if (reportTypes.has(normalized)) {
    return normalized;
  }

  throw new BadRequestException("Report type must be daily_update, weekly_report, or final_report.");
}

function normalizeManualPlacementChannel(value: unknown) {
  const normalized = String(value ?? "OTHER").toUpperCase().replace(/[\s-]+/g, "_");

  if (manualPlacementChannels.has(normalized)) {
    return normalized;
  }

  return "OTHER";
}

function parseDateInput(value: unknown, message: string) {
  const date = value ? new Date(String(value)) : undefined;

  if (!date || Number.isNaN(date.getTime())) {
    throw new BadRequestException(message);
  }

  return date;
}

function parseMinorAmount(value: unknown, message: string) {
  const numeric = typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new BadRequestException(message);
  }

  return Math.round(numeric);
}

function parsePositiveMinorAmount(value: unknown, message: string) {
  const amountMinor = parseMinorAmount(value, message);

  if (amountMinor <= 0) {
    throw new BadRequestException(message);
  }

  return amountMinor;
}

function parseNonNegativeMinorAmount(value: unknown, message: string) {
  return parseMinorAmount(value, message);
}

function parseSpendMinor(input: Record<string, any>, required = false) {
  const value =
    input.spendMinor ??
    input.amountMinor ??
    input.spend ??
    input.amount ??
    (normalizeJsonObject(input.metadata) as Record<string, any>).spendMinor;

  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new BadRequestException("Spend must be recorded as a non-negative amount.");
    }

    return 0;
  }

  return parseMinorAmount(value, "Spend must be recorded as a non-negative amount.");
}

function normalizeIdempotencyKey(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 191) : undefined;
}

function eventFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}

function normalizeInvoiceLineItems(
  value: unknown,
  fallback: Array<Record<string, unknown>>,
  currency: string
) {
  const items = Array.isArray(value) && value.length > 0 ? value : fallback;

  return items.map((item, index) => {
    const record = normalizeJsonObject(item) as Record<string, unknown>;
    const amountMinor = parsePositiveMinorAmount(
      record.amountMinor,
      `Invoice line item ${index + 1} must have a positive amount.`
    );

    return {
      ...record,
      label:
        typeof record.label === "string" && record.label.trim().length > 0
          ? record.label.trim()
          : `Line item ${index + 1}`,
      amountMinor,
      currency: getCurrency(record.currency as string | undefined, getCurrency(currency, "NGN"))
    };
  });
}

function assertHttpUrl(value: string, message: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException(message);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException(message);
  }
}

function inferMediaKind(mimeType: string, purpose?: string) {
  if (purpose === "screenshot") {
    return "SCREENSHOT";
  }
  if (purpose === "report") {
    return "REPORT_ATTACHMENT";
  }
  if (videoMimeTypes.has(mimeType)) {
    return "VIDEO";
  }
  if (imageMimeTypes.has(mimeType)) {
    return "IMAGE";
  }

  return "OTHER";
}

function assertMediaPolicy(input: { mimeType: string; sizeBytes: number; purpose?: string }) {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new BadRequestException("Upload size must be a positive integer.");
  }

  if (input.purpose === "screenshot") {
    if (!imageMimeTypes.has(input.mimeType) || input.sizeBytes > maxScreenshotBytes) {
      throw new BadRequestException("Report screenshots must be JPEG, PNG, or WebP under 15 MB.");
    }
    return;
  }

  if (imageMimeTypes.has(input.mimeType)) {
    if (input.sizeBytes > maxImageBytes) {
      throw new BadRequestException("Image uploads must be under 10 MB.");
    }
    return;
  }

  if (videoMimeTypes.has(input.mimeType)) {
    if (input.sizeBytes > maxVideoBytes) {
      throw new BadRequestException("Video uploads must be under 100 MB.");
    }
    return;
  }

  throw new BadRequestException("Unsupported upload MIME type.");
}

function getPaymentGateway() {
  const preferredGateway = process.env.PAYMENT_GATEWAY?.toLowerCase();
  const paystackSecret = getSecret(process.env.PAYSTACK_SECRET_KEY);
  const korapaySecret = getSecret(process.env.KORAPAY_SECRET_KEY);

  if (process.env.PAYMENT_PROVIDER === "live" && preferredGateway === "paystack" && paystackSecret) {
    return createPaystackPaymentGateway({
      publicKey: getSecret(process.env.PAYSTACK_PUBLIC_KEY),
      secretKey: paystackSecret,
      baseUrl: process.env.PAYSTACK_BASE_URL,
      defaultRedirectUrl: process.env.PAYSTACK_REDIRECT_URL ?? process.env.APP_URL
    });
  }

  if (process.env.PAYMENT_PROVIDER === "live" && korapaySecret) {
    return createKorapayPaymentGateway({
      publicKey: getSecret(process.env.KORAPAY_PUBLIC_KEY),
      secretKey: korapaySecret,
      encryptionKey: getSecret(process.env.KORAPAY_ENCRYPTION_KEY),
      baseUrl: process.env.KORAPAY_BASE_URL,
      defaultRedirectUrl: process.env.KORAPAY_REDIRECT_URL ?? process.env.APP_URL,
      defaultWebhookUrl:
        process.env.KORAPAY_WEBHOOK_URL ??
        `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay`
    });
  }

  if (process.env.PAYMENT_PROVIDER === "live" && paystackSecret) {
    return createPaystackPaymentGateway({
      publicKey: getSecret(process.env.PAYSTACK_PUBLIC_KEY),
      secretKey: paystackSecret,
      baseUrl: process.env.PAYSTACK_BASE_URL,
      defaultRedirectUrl: process.env.PAYSTACK_REDIRECT_URL ?? process.env.APP_URL
    });
  }

  return createMockPaymentGateway();
}

function assertLivePaymentsConfiguredForProduction() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (
    process.env.PAYMENT_PROVIDER === "live" &&
    (getSecret(process.env.KORAPAY_SECRET_KEY) || getSecret(process.env.PAYSTACK_SECRET_KEY))
  ) {
    return;
  }

  throw new BadRequestException(
    "Payments are unavailable because live payment configuration is missing."
  );
}

function verifyKorapaySignature(input: { body: unknown; signature?: string | undefined }) {
  const signingSecret = getSecret(process.env.KORAPAY_WEBHOOK_SECRET) ?? getSecret(process.env.KORAPAY_SECRET_KEY);

  if (!signingSecret) {
    return process.env.NODE_ENV !== "production";
  }
  if (!input.signature) {
    return false;
  }

  const body = typeof input.body === "object" && input.body !== null ? (input.body as Record<string, unknown>) : {};
  const signedPayload = JSON.stringify(body.data ?? {});
  const expected = Buffer.from(createHmac("sha256", signingSecret).update(signedPayload).digest("hex"));
  const actual = Buffer.from(input.signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function mapLedgerEntry(entry: any): LedgerEntry {
  return {
    id: entry.id,
    walletId: entry.walletId,
    kind: entry.kind,
    amount: { amountMinor: entry.amountMinor, currency: getCurrency(entry.currency, "NGN") },
    reference: entry.reference,
    description: entry.description,
    ...(entry.idempotencyKey === null ? {} : { idempotencyKey: entry.idempotencyKey }),
    ...(entry.sourceType === null ? {} : { sourceType: entry.sourceType }),
    ...(entry.sourceId === null ? {} : { sourceId: entry.sourceId }),
    metadata: entry.metadata ?? {},
    createdAt: iso(entry.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(entry.updatedAt) ?? new Date().toISOString()
  };
}

function buildWalletConsistency(entries: LedgerEntry[]) {
  const availableBalance = calculateAvailableBalance(entries);
  const currency = availableBalance.currency;
  const openingBalanceMinor = entries
    .filter((entry) => entry.kind === "CREDIT" && entry.reference === "opening_balance")
    .reduce((sum, entry) => sum + entry.amount.amountMinor, 0);
  const creditsMinor = entries
    .filter(
      (entry) =>
        (entry.kind === "CREDIT" && entry.reference !== "opening_balance") ||
        entry.kind === "RELEASE" ||
        entry.kind === "REVERSAL"
    )
    .reduce((sum, entry) => sum + entry.amount.amountMinor, 0);
  const debitsMinor = entries
    .filter((entry) => entry.kind === "DEBIT" || entry.kind === "HOLD")
    .reduce((sum, entry) => sum + entry.amount.amountMinor, 0);
  const projectedBalanceMinor = openingBalanceMinor + creditsMinor - debitsMinor;

  return {
    openingBalance: { amountMinor: openingBalanceMinor, currency },
    credits: { amountMinor: creditsMinor, currency },
    debits: { amountMinor: debitsMinor, currency },
    currentBalance: availableBalance,
    consistent: projectedBalanceMinor === availableBalance.amountMinor
  };
}

@Injectable()
export class ManagedAdsService {
  private readonly paymentGateway = getPaymentGateway();
  private readonly mockStorageProvider = createMockStorageProvider();
  private readonly aiRecommendationClient = AnthropicRecommendationClient.fromEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    // Optional so unit tests that construct this service directly (without the full
    // Nest module graph) keep working unchanged — mirrors the pattern already used
    // by DigitalAccessHubService for the same ApprovalsService dependency.
    private readonly approvals?: ApprovalsService
  ) {
    // Lets the unified `/approvals/:id/decide` endpoint actually carry out the
    // campaign-status / KYC decision, instead of only flipping the ApprovalRequest
    // row's own status. See ApprovalsService.decideAndExecute and the "type" filter
    // (`ads` / `kyc`) the Growth OS Approvals Queue UI already renders.
    this.approvals?.registerExecutor("ads", {
      onApprove: async (approval) => {
        const payload = approval.payload as { campaignId?: string };
        if (!payload?.campaignId) return undefined;
        const scope = { workspaceId: approval.workspaceId ?? "", userId: approval.decidedByUserId ?? "" };
        return this.changeCampaignStatus(scope, payload.campaignId, "APPROVED", approval.decisionNote ?? undefined, true);
      },
      onReject: async (approval) => {
        const payload = approval.payload as { campaignId?: string };
        if (!payload?.campaignId) return undefined;
        const scope = { workspaceId: approval.workspaceId ?? "", userId: approval.decidedByUserId ?? "" };
        return this.changeCampaignStatus(scope, payload.campaignId, "REJECTED", approval.decisionNote ?? undefined, true);
      }
    });
    this.approvals?.registerExecutor("kyc", {
      onApprove: async (approval) => {
        const payload = approval.payload as { adAccountId?: string };
        if (!payload?.adAccountId) return undefined;
        return this.applyKycDecision(
          { workspaceId: approval.workspaceId ?? "", userId: approval.decidedByUserId ?? "" },
          payload.adAccountId,
          "VERIFIED",
          approval.decisionNote ?? undefined
        );
      },
      onReject: async (approval) => {
        const payload = approval.payload as { adAccountId?: string };
        if (!payload?.adAccountId) return undefined;
        return this.applyKycDecision(
          { workspaceId: approval.workspaceId ?? "", userId: approval.decidedByUserId ?? "" },
          payload.adAccountId,
          "REJECTED",
          approval.decisionNote ?? undefined
        );
      }
    });
  }

  private get db(): DbClient {
    return this.prisma.client as unknown as DbClient;
  }

  async listCompanyProfiles(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    return this.db.companyProfile.findMany({
      where: { workspaceId: scope.workspaceId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  async upsertCompanyProfile(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    const scope = requireScope(context);
    const name = String(input.name ?? input.businessName ?? "Untitled business").trim();
    const slug = slugify(String(input.slug ?? name)) || id("company");

    return this.db.$transaction(async (tx: DbClient) => {
      const existing = input.id
        ? await tx.companyProfile.findFirst({
            where: { id: String(input.id), workspaceId: scope.workspaceId, deletedAt: null }
          })
        : await tx.companyProfile.findFirst({
            where: { workspaceId_slug: { workspaceId: scope.workspaceId, slug } }
          });

      const profile = existing
        ? await tx.companyProfile.update({
            where: { id: existing.id },
            data: {
              name,
              legalName: input.legalName ?? existing.legalName,
              websiteUrl: input.websiteUrl ?? input.website ?? existing.websiteUrl,
              industry: input.industry ?? existing.industry,
              countryCode: input.countryCode ?? input.country ?? existing.countryCode,
              city: input.city ?? existing.city,
              timezone: input.timezone ?? existing.timezone,
              contactEmail: input.contactEmail ?? input.email ?? existing.contactEmail,
              contactPhone: input.contactPhone ?? input.phone ?? existing.contactPhone,
              status: "ACTIVE",
              metadata: normalizeJsonObject(input.metadata)
            }
          })
        : await tx.companyProfile.create({
            data: {
              workspaceId: scope.workspaceId,
              ownerUserId: scope.userId,
              name,
              slug,
              legalName: input.legalName,
              websiteUrl: input.websiteUrl ?? input.website,
              industry: input.industry,
              countryCode: input.countryCode ?? input.country,
              city: input.city,
              timezone: input.timezone ?? "Africa/Lagos",
              contactEmail: input.contactEmail ?? input.email ?? scope.userEmail,
              contactPhone: input.contactPhone ?? input.phone,
              status: "ACTIVE",
              metadata: normalizeJsonObject(input.metadata)
            }
          });

      await this.audit(tx, scope, "company_profile.upserted", "CompanyProfile", profile.id, {
        name: profile.name
      });
      return profile;
    });
  }

  async listAdAccounts(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    return this.db.adAccount.findMany({
      where: { workspaceId: scope.workspaceId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  async getAdAccount(context: AuthenticatedRequestContext | undefined, adAccountId: string) {
    const scope = requireScope(context);
    const adAccount = await this.findAdAccountOrThrow(this.db, scope.workspaceId, adAccountId);

    return adAccount;
  }

  /**
   * Explicit ad-account creation is for the two paths a customer or operator deliberately sets
   * up: a Connected account (the advertiser's own platform account) or a Dedicated account
   * (provisioned for a high-spend/high-risk company, isolated from the shared Managed pool). A
   * Studio customer on the Managed pool never calls this -- see getOrCreateDefaultManagedAdAccount.
   */
  async createAdAccount(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "campaign:create");

    const type = normalizeAdAccountType(input.type);
    const platform = normalizeAdPlatform(input.platform);
    const label = requiredString(input.label ?? input.name, "label is required to create an ad account.");
    const externalAccountId = input.externalAccountId ?? input.externalId;

    if (type === "CONNECTED" && !externalAccountId) {
      throw new BadRequestException(
        "A connected ad account must include the advertiser's existing externalAccountId."
      );
    }

    const kycTier = input.kycTier ? normalizeKycTier(input.kycTier) : defaultKycTierForAccountType(type);

    return this.db.$transaction(async (tx: DbClient) => {
      // Only FlipTrybe-funded accounts (Managed/Dedicated) need a wallet; a Connected account is
      // funded by the advertiser's own card/billing on the platform itself.
      const wallet =
        type === "CONNECTED"
          ? undefined
          : await this.getOrCreateWallet(tx, scope.workspaceId, getCurrency(input.currency, "NGN"));

      const adAccount = await tx.adAccount.create({
        data: {
          workspaceId: scope.workspaceId,
          type,
          platform,
          status: "PENDING",
          kycTier,
          kycStatus: "UNVERIFIED",
          label,
          walletId: wallet?.id,
          connectedByUserId: scope.userId,
          externalBusinessId: input.externalBusinessId,
          externalAccountId,
          externalPageId: input.externalPageId,
          dailySpendCapMinor:
            input.dailySpendCapMinor === undefined
              ? undefined
              : parseNonNegativeInt(input.dailySpendCapMinor, "dailySpendCapMinor"),
          metadata: normalizeJsonObject(input.metadata)
        }
      });

      await this.audit(tx, scope, "ad_account.created", "AdAccount", adAccount.id, { type, platform });
      await this.event(tx, scope.workspaceId, "AdAccountCreated", "AdAccount", adAccount.id, {
        adAccountId: adAccount.id,
        type,
        platform
      });

      return adAccount;
    }).then(async (adAccount: any) => {
      // Every new ad account starts kycStatus "UNVERIFIED" and needs an admin decision before it
      // can spend -- surface it in the unified Approvals Queue (entityType "kyc") right away.
      // Best-effort: outside the transaction (ApprovalsService uses its own PrismaService client)
      // and must never fail account creation itself.
      await this.approvals
        ?.request({
          workspaceId: scope.workspaceId,
          action: "ad_account.kyc_review",
          entityType: "kyc",
          entityId: adAccount.id,
          reason: "New ad account requires KYC/KYB review before it can spend.",
          payload: { adAccountId: adAccount.id },
          requestedByUserId: scope.userId
        })
        .catch(() => undefined);
      return adAccount;
    });
  }

  async updateAdAccount(
    context: AuthenticatedRequestContext | undefined,
    adAccountId: string,
    input: Record<string, any>
  ) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    await this.findAdAccountOrThrow(this.db, scope.workspaceId, adAccountId);

    return this.db.$transaction(async (tx: DbClient) => {
      const adAccount = await tx.adAccount.update({
        where: { id: adAccountId },
        data: {
          label: input.label === undefined ? undefined : requiredString(input.label, "label cannot be empty."),
          externalBusinessId: input.externalBusinessId,
          externalAccountId: input.externalAccountId,
          externalPageId: input.externalPageId,
          dailySpendCapMinor:
            input.dailySpendCapMinor === undefined
              ? undefined
              : parseNonNegativeInt(input.dailySpendCapMinor, "dailySpendCapMinor"),
          metadata: input.metadata === undefined ? undefined : normalizeJsonObject(input.metadata)
        }
      });

      await this.audit(tx, scope, "ad_account.updated", "AdAccount", adAccount.id, {});

      return adAccount;
    });
  }

  /**
   * Admin-gated KYC/KYB decision -- mirrors updateAdminStatus's approval permission tier. VERIFIED
   * activates the account for spend; REJECTED suspends it so it can't be used until resolved.
   *
   * This endpoint stays live as a direct admin override rather than being deprecated in favor of
   * the unified Approvals Queue (POST /approvals/:id/decide) -- deprecating a working admin flow
   * is riskier than keeping both entry points in sync. After applying the decision, it syncs any
   * still-PENDING ApprovalRequest for this ad account so the queue doesn't show a stale row.
   */
  async reviewAdAccountKyc(
    context: AuthenticatedRequestContext | undefined,
    adAccountId: string,
    input: Record<string, any>
  ) {
    const scope = requireScope(context);
    await this.assertCampaignPermissions(this.db, scope, ["admin:access", "campaign:approve"]);
    const kycStatus = normalizeKycStatus(input.kycStatus);
    const adAccount = await this.applyKycDecision(scope, adAccountId, kycStatus, input.reason, input.kycTier);

    if (kycStatus === "VERIFIED" || kycStatus === "REJECTED") {
      await this.approvals?.syncExternalDecision({
        entityType: "kyc",
        entityId: adAccountId,
        approve: kycStatus === "VERIFIED",
        decidedByUserId: scope.userId,
        note: input.reason
      });
    }

    return adAccount;
  }

  /**
   * Shared by the direct admin `reviewAdAccountKyc` endpoint and the ApprovalRequest executor
   * registered for entityType "kyc" -- both need to land the exact same DB transition so the two
   * decision paths (old ad-hoc endpoint vs. the unified Approvals Queue) can never diverge.
   */
  private async applyKycDecision(
    scope: { workspaceId: string; userId: string },
    adAccountId: string,
    kycStatus: string,
    reason?: string,
    kycTier?: string
  ) {
    const existing = await this.findAdAccountOrThrow(this.db, scope.workspaceId, adAccountId);
    const nextStatus =
      kycStatus === "VERIFIED" ? "ACTIVE" : kycStatus === "REJECTED" ? "SUSPENDED" : existing.status;

    return this.db.$transaction(async (tx: DbClient) => {
      const adAccount = await tx.adAccount.update({
        where: { id: adAccountId },
        data: {
          kycStatus,
          status: nextStatus,
          kycTier: kycTier ? normalizeKycTier(kycTier) : undefined
        }
      });

      await this.audit(tx, scope, "ad_account.kyc_reviewed", "AdAccount", adAccount.id, {
        kycStatus,
        status: nextStatus,
        reason: reason ?? null
      });
      await this.event(tx, scope.workspaceId, "AdAccountKycReviewed", "AdAccount", adAccount.id, {
        adAccountId: adAccount.id,
        kycStatus
      });

      return adAccount;
    });
  }

  private async findAdAccountOrThrow(tx: DbClient, workspaceId: string, adAccountId: string) {
    const adAccount = await tx.adAccount.findFirst({
      where: { id: adAccountId, workspaceId, deletedAt: null }
    });

    if (!adAccount) {
      throw new NotFoundException("Ad account was not found in the active workspace.");
    }

    return adAccount;
  }

  /**
   * The invisible-infrastructure path: a Studio (Managed pool) customer never creates or sees an
   * ad account. The first campaign on a given platform silently provisions (or reuses) one shared
   * MANAGED account per workspace+platform, funded by the workspace's wallet. KYC starts
   * UNVERIFIED/PENDING -- the Risk Engine already treats an unverified funded advertiser as a
   * review signal, so this doesn't bypass scrutiny, it just removes it from the customer's view.
   */
  private async getOrCreateDefaultManagedAdAccount(
    tx: DbClient,
    scope: AuthenticatedRequestContext,
    platform: string
  ) {
    const existing = await tx.adAccount.findFirst({
      where: { workspaceId: scope.workspaceId, type: "MANAGED", platform, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });

    if (existing) {
      return existing;
    }

    const wallet = await this.getOrCreateWallet(tx, scope.workspaceId, "NGN");
    const adAccount = await tx.adAccount.create({
      data: {
        workspaceId: scope.workspaceId,
        type: "MANAGED",
        platform,
        status: "PENDING",
        kycTier: defaultKycTierForAccountType("MANAGED"),
        kycStatus: "UNVERIFIED",
        label: `Shared pool - ${platform}`,
        walletId: wallet.id,
        connectedByUserId: scope.userId
      }
    });

    await this.audit(tx, scope, "ad_account.auto_provisioned", "AdAccount", adAccount.id, { platform });

    return adAccount;
  }

  async listCampaigns(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const campaigns = await this.db.campaign.findMany({
      where: { workspaceId: scope.workspaceId, deletedAt: null },
      include: campaignInclude,
      orderBy: { createdAt: "desc" }
    });

    return campaigns.map((campaign: any) => this.toCampaign(campaign));
  }

  async getCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);

    return this.toCampaign(campaign);
  }

  async getAdminCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "admin:access");
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);

    return this.toCampaign(campaign, { includeInternal: true });
  }

  /**
   * The concierge "spec sheet": translates a stored campaign's objective, destination, budget,
   * and targeting into a copyable Meta Ads Manager launch spec for the operator reviewing the
   * queue. Works for campaigns created via the wizard (goal recovered from metadata) or via the
   * full createCampaign path (goal inferred from objective as a best-effort label — targeting
   * and budget, the fields that actually matter for spend, always come from stored data).
   */
  async getCampaignLaunchSpec(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "admin:access");
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const spec = this.campaignToSpec(campaign);
    const advertiserName = campaign.companyProfile?.name ?? campaign.name;

    return buildMetaLaunchSpec(spec, advertiserName);
  }

  private campaignToSpec(campaign: any): CampaignSpec {
    const targetAudience = (campaign.targetAudience ?? {}) as Record<string, any>;
    const objective = String(campaign.objective) as CampaignSpec["objective"];
    const storedGoal = campaign.metadata?.goal;
    const goal: CampaignGoal = isCampaignGoal(storedGoal)
      ? storedGoal
      : goalFromObjective(objective, campaign.destination?.kind);
    const countries = arrayOrSingle(targetAudience.countries, targetAudience.country) ?? ["NG"];
    const states = arrayOrSingle(targetAudience.states, targetAudience.state) ?? [];
    const cities = arrayOrSingle(targetAudience.cities, targetAudience.city) ?? [];
    const localGovernmentAreas =
      arrayOrSingle(targetAudience.localGovernmentAreas, targetAudience.localGovernmentArea) ?? [];
    const ageMin = Number.isFinite(Number(targetAudience.ageMin)) ? Number(targetAudience.ageMin) : 18;
    const ageMax = Number.isFinite(Number(targetAudience.ageMax)) ? Number(targetAudience.ageMax) : 65;
    const gender = ["MALE", "FEMALE", "ALL"].includes(targetAudience.gender)
      ? targetAudience.gender
      : "ALL";
    const interests = Array.isArray(targetAudience.interests) ? targetAudience.interests : [];
    const behaviors = Array.isArray(targetAudience.behaviors) ? targetAudience.behaviors : [];
    const searchKeywords = Array.isArray(targetAudience.searchKeywords)
      ? targetAudience.searchKeywords
      : [];
    const optimizeAutomatically = targetAudience.optimizeAutomatically !== false;
    const radius =
      targetAudience.radius &&
      Number.isFinite(Number(targetAudience.radius.latitude)) &&
      Number.isFinite(Number(targetAudience.radius.longitude)) &&
      Number.isFinite(Number(targetAudience.radius.radiusKm))
        ? {
            latitude: Number(targetAudience.radius.latitude),
            longitude: Number(targetAudience.radius.longitude),
            radiusKm: Number(targetAudience.radius.radiusKm)
          }
        : undefined;

    return {
      goal,
      objective,
      destination: {
        url: campaign.destination?.url ?? "https://fliptrybe.store",
        kind: (campaign.destination?.kind ?? "WEBSITE") as CampaignSpec["destination"]["kind"]
      },
      budget: { amountMinor: campaign.budgetMinor, currency: campaign.currency ?? "NGN" },
      targeting: {
        countries,
        states,
        cities,
        localGovernmentAreas,
        ...(radius ? { radius } : {}),
        ageMin,
        ageMax,
        gender,
        interests,
        behaviors,
        searchKeywords,
        optimizeAutomatically
      },
      schedule: {
        ...(campaign.startsAt ? { startsAt: new Date(campaign.startsAt).toISOString() } : {}),
        ...(campaign.endsAt ? { endsAt: new Date(campaign.endsAt).toISOString() } : {})
      },
      warnings: Array.isArray(campaign.metadata?.warnings) ? campaign.metadata.warnings : []
    };
  }

  async createCampaign(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "campaign:create");
    const startsAt = input.startsAt ? new Date(String(input.startsAt)) : now();
    const currency = getCurrency(input.currency, "NGN");
    const budgetMinor = Number(input.budgetMinor ?? input.budget?.amountMinor ?? input.budget ?? 250000);
    const objective = normalizeObjective(input.objective);
    const destinationKind = normalizeDestinationKind(input);
    const destinationUrl = String(input.destinationUrl ?? input.productLink ?? input.websiteUrl ?? "https://fliptrybe.store");

    if (!Number.isInteger(budgetMinor) || budgetMinor <= 0) {
      throw new BadRequestException("Campaign budget must be a positive minor-unit integer.");
    }

    // Cross-platform advertising: the platform an ad RUNS on and the platform its destination
    // lives on are independent -- "advertise on Meta, send clicks into a TikTok LIVE" is a normal,
    // supported case. An explicit executionPlatform/adPlatform always wins; only when the caller
    // doesn't say where to run it do we fall back to guessing from the destination (e.g. a bare
    // TikTok link with no explicit platform assumes TikTok). Destination URLs are the platforms'
    // own share links (tiktok.com/@x/live, instagram.com/x, youtube.com/x), which already behave
    // as OS-level deep links on mobile -- clicking opens the installed app directly to that
    // content; FlipTrybe doesn't need to build separate deep-link infrastructure for this.
    const executionPlatform =
      input.executionPlatform ?? input.adPlatform
        ? normalizeAdPlatform(input.executionPlatform ?? input.adPlatform)
        : platformFromDestinationKind(destinationKind);

    return this.db.$transaction(async (tx: DbClient) => {
      // Every campaign spends from an AdAccount. Studio customers never manage one explicitly, so
      // when the caller doesn't pass adAccountId, transparently reuse (or provision) the
      // workspace's shared-pool MANAGED account for the resolved execution platform. Pro/Company
      // callers that explicitly connect their own account (Type 1) or hold a dedicated one (Type 3)
      // pass adAccountId directly and skip this entirely.
      const adAccountId = input.adAccountId
        ? String(input.adAccountId)
        : (await this.getOrCreateDefaultManagedAdAccount(tx, scope, executionPlatform)).id;
      const campaign = await tx.campaign.create({
        data: {
          workspaceId: scope.workspaceId,
          creatorUserId: scope.userId,
          companyProfileId: input.companyProfileId,
          personaId: input.personaId ? String(input.personaId) : undefined,
          adAccountId,
          name: String(input.name ?? input.title ?? "Managed ads campaign"),
          objective,
          status: "DRAFT",
          budgetMinor,
          dailySpendCapMinor:
            input.dailySpendCapMinor === undefined
              ? undefined
              : parseNonNegativeInt(input.dailySpendCapMinor, "dailySpendCapMinor"),
          currency,
          provider: "MANUAL",
          startsAt,
          endsAt: input.endsAt ? new Date(String(input.endsAt)) : undefined,
          timezone: input.timezone ?? "Africa/Lagos",
          brief: input.brief ?? input.description ?? input.productDetails,
          // A fully structured targetAudience (e.g. from the wizard's CampaignSpec.targeting, or
          // a Pro/Company dashboard setting age/gender/interests directly) wins outright; the
          // flat fields below remain for backward-compatible ad-hoc callers.
          targetAudience:
            input.targetAudience && typeof input.targetAudience === "object" && !Array.isArray(input.targetAudience)
              ? normalizeJsonObject(input.targetAudience)
              : {
                  country: input.targetCountry ?? input.country,
                  city: input.targetCity ?? input.city,
                  countries: input.countries ?? undefined,
                  cities: input.cities ?? undefined,
                  platform: input.platform,
                  platforms: input.platforms,
                  notes: input.targetingNotes
                },
          placementPlan: normalizeJsonObject(input.placementPlan),
          metadata: normalizeJsonObject(input.metadata),
          destination: {
            create: {
              kind: destinationKind,
              url: destinationUrl,
              handle: input.handle,
              metadata: normalizeJsonObject(input.destinationMetadata)
            }
          },
          livePromotion: LIVE_DESTINATION_KINDS.has(destinationKind)
            ? {
                create: {
                  destinationKind,
                  realtimeBoostEnabled: Boolean(input.realtimeBoostEnabled),
                  expectedStartAt: startsAt
                }
              }
            : undefined,
          statusHistory: {
            create: {
              toStatus: "DRAFT",
              actorUserId: scope.userId,
              reason: "Campaign draft created"
            }
          }
        },
        include: campaignInclude
      });

      await this.audit(tx, scope, "campaign.created", "Campaign", campaign.id, {
        status: campaign.status,
        objective: campaign.objective
      });
      await this.event(tx, scope.workspaceId, "CampaignCreated", "Campaign", campaign.id, {
        campaignId: campaign.id,
        status: campaign.status
      });

      return this.toCampaign(campaign);
    });
  }

  /**
   * Studio wizard entry point: "what do you want more of -> paste link -> where -> budget".
   * Normalizes plain-language wizard input into a platform-agnostic CampaignSpec (goal/objective
   * mapping, destination inference, targeting defaults) and delegates to createCampaign, which
   * remains the full-featured path used by the Pro/Company dashboards and admin tooling.
   */
  async createCampaignFromWizard(
    context: AuthenticatedRequestContext | undefined,
    input: Record<string, any>
  ) {
    const spec = normalizeCampaignSpec({
      goal: String(input.goal ?? ""),
      link: String(input.link ?? input.destinationUrl ?? ""),
      budgetMinor: Number(input.budgetMinor ?? 0),
      ...(input.productDescription === undefined
        ? {}
        : { productDescription: String(input.productDescription) }),
      ...(input.currency === undefined ? {} : { currency: input.currency }),
      ...(input.country === undefined ? {} : { country: input.country }),
      ...(input.countries === undefined ? {} : { countries: input.countries }),
      ...(input.state === undefined ? {} : { state: input.state }),
      ...(input.states === undefined ? {} : { states: input.states }),
      ...(input.city === undefined ? {} : { city: input.city }),
      ...(input.cities === undefined ? {} : { cities: input.cities }),
      ...(input.localGovernmentArea === undefined
        ? {}
        : { localGovernmentArea: input.localGovernmentArea }),
      ...(input.localGovernmentAreas === undefined
        ? {}
        : { localGovernmentAreas: input.localGovernmentAreas }),
      ...(input.latitude === undefined ? {} : { latitude: Number(input.latitude) }),
      ...(input.longitude === undefined ? {} : { longitude: Number(input.longitude) }),
      ...(input.radiusKm === undefined ? {} : { radiusKm: Number(input.radiusKm) }),
      ...(input.ageMin === undefined ? {} : { ageMin: Number(input.ageMin) }),
      ...(input.ageMax === undefined ? {} : { ageMax: Number(input.ageMax) }),
      ...(input.gender === undefined ? {} : { gender: input.gender }),
      ...(input.interests === undefined ? {} : { interests: input.interests }),
      ...(input.behaviors === undefined ? {} : { behaviors: input.behaviors }),
      ...(input.searchKeywords === undefined ? {} : { searchKeywords: input.searchKeywords }),
      ...(input.optimizeAutomatically === undefined
        ? {}
        : { optimizeAutomatically: Boolean(input.optimizeAutomatically) })
    });

    const campaign = await this.createCampaign(context, {
      companyProfileId: input.companyProfileId,
      name: input.name ?? `${spec.goal.replace(/_/g, " ").toLowerCase()} campaign`,
      objective: spec.objective,
      budgetMinor: spec.budget.amountMinor,
      dailySpendCapMinor: input.dailySpendCapMinor,
      currency: spec.budget.currency,
      destinationUrl: spec.destination.url,
      destinationKind: spec.destination.kind,
      // Where to run the ad (Meta/TikTok/Google), independent of where the destination link
      // lives -- e.g. "boost my TikTok LIVE" via ads running on Meta. Falls back to inferring
      // from the destination when not given.
      executionPlatform: input.executionPlatform ?? input.platform,
      targetAudience: {
        countries: spec.targeting.countries,
        states: spec.targeting.states,
        cities: spec.targeting.cities,
        localGovernmentAreas: spec.targeting.localGovernmentAreas,
        ...(spec.targeting.radius ? { radius: spec.targeting.radius } : {}),
        ageMin: spec.targeting.ageMin,
        ageMax: spec.targeting.ageMax,
        gender: spec.targeting.gender,
        interests: spec.targeting.interests,
        behaviors: spec.targeting.behaviors,
        searchKeywords: spec.targeting.searchKeywords,
        optimizeAutomatically: spec.targeting.optimizeAutomatically
      },
      metadata: { wizard: true, goal: spec.goal, warnings: spec.warnings },
      startsAt: spec.schedule.startsAt,
      endsAt: spec.schedule.endsAt
    });

    return { campaign, warnings: spec.warnings };
  }

  /**
   * Returns several targeting options (broad / focused / hyper-local), not one, with an
   * illustrative budget-to-outcome range for each -- helps a customer pick before they commit
   * budget, rather than guessing at settings.
   *
   * Tries the real AI provider first (AnthropicRecommendationClient, disabled unless
   * ANTHROPIC_API_KEY + AI_PROVIDER=anthropic are set), and falls back to the rule-based
   * recommendCampaignTargeting heuristic on disabled/timeout/parse failure -- same
   * try-AI-then-heuristic-fallback shape already verified working in RUNNR's AI orchestrator
   * (see the runnr-ai-orchestrator-reference memory). Every option is tagged with which path
   * actually produced it so the caller/analytics can tell them apart.
   */
  async getCampaignRecommendations(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "campaign:create");

    const goal = String(input.goal ?? "");
    const budgetMinor = Number(input.budgetMinor ?? 0);
    const productDescription = input.productDescription === undefined ? undefined : String(input.productDescription);
    const city = input.city === undefined ? undefined : String(input.city);
    const localGovernmentArea =
      input.localGovernmentArea === undefined ? undefined : String(input.localGovernmentArea);
    const latitude = input.latitude === undefined ? undefined : Number(input.latitude);
    const longitude = input.longitude === undefined ? undefined : Number(input.longitude);
    const radiusKm = input.radiusKm === undefined ? undefined : Number(input.radiusKm);

    if (this.aiRecommendationClient.enabled && productDescription) {
      const aiResult = await this.aiRecommendationClient.suggestTargeting({
        goal,
        budgetMinor,
        currency: "NGN",
        productDescription,
        ...(city === undefined ? {} : { city })
      });

      if (aiResult) {
        const normalizedGoal = normalizeGoalSafe(goal);
        const estimatedOutcome = estimateOutcomeForGoal(normalizedGoal, budgetMinor);

        return aiResult.options.map(
          (option): CampaignTargetingRecommendation => ({
            label: option.label,
            rationale: option.rationale,
            targeting: {
              ageMin: option.ageMin,
              ageMax: option.ageMax,
              gender: option.gender,
              interests: option.interests,
              behaviors: option.behaviors,
              localGovernmentAreas: []
            },
            optimizeAutomatically: true,
            estimatedOutcome
          })
        );
      }
    }

    return recommendCampaignTargeting({
      goal,
      budgetMinor,
      ...(productDescription === undefined ? {} : { productDescription }),
      ...(city === undefined ? {} : { city }),
      ...(localGovernmentArea === undefined ? {} : { localGovernmentArea }),
      ...(latitude === undefined ? {} : { latitude }),
      ...(longitude === undefined ? {} : { longitude }),
      ...(radiusKm === undefined ? {} : { radiusKm })
    });
  }

  async updateCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);

    return this.db.$transaction(async (tx: DbClient) => {
      if (input.destinationUrl || input.destinationKind) {
        await tx.destination.upsert({
          where: { campaignId },
          update: {
            kind: input.destinationKind ? normalizeDestinationKind(input) : undefined,
            url: input.destinationUrl ?? input.productLink ?? undefined,
            handle: input.handle,
            metadata: input.destinationMetadata === undefined ? undefined : normalizeJsonObject(input.destinationMetadata)
          },
          create: {
            campaignId,
            kind: normalizeDestinationKind(input),
            url: String(input.destinationUrl ?? input.productLink ?? "https://fliptrybe.store"),
            handle: input.handle,
            metadata: normalizeJsonObject(input.destinationMetadata)
          }
        });
      }

      const campaign = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          companyProfileId: input.companyProfileId,
          name: input.name,
          objective: input.objective === undefined ? undefined : normalizeObjective(input.objective),
          budgetMinor: input.budgetMinor === undefined ? undefined : Number(input.budgetMinor),
          dailySpendCapMinor:
            input.dailySpendCapMinor === undefined
              ? undefined
              : parseNonNegativeInt(input.dailySpendCapMinor, "dailySpendCapMinor"),
          currency: input.currency === undefined ? undefined : getCurrency(input.currency, "NGN"),
          brief: input.brief ?? input.description ?? input.productDetails,
          targetAudience: input.targetAudience === undefined ? undefined : normalizeJsonObject(input.targetAudience),
          placementPlan: input.placementPlan === undefined ? undefined : normalizeJsonObject(input.placementPlan),
          metadata: input.metadata === undefined ? undefined : normalizeJsonObject(input.metadata)
        },
        include: campaignInclude
      });

      await this.audit(tx, scope, "campaign.updated", "Campaign", campaign.id, {});
      return this.toCampaign(campaign);
    });
  }

  async submitCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "campaign:create");
    const existing = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    if (existing.status !== "DRAFT" && existing.status !== "CHANGES_REQUESTED") {
      throw new BadRequestException("Only draft or changes-requested campaigns can be submitted.");
    }

    const assessment = await this.assessCampaign(scope, campaignId);

    // Risk-gated routing: BLOCK (red) is auto-rejected before any spend; ALLOW (green) and
    // REVIEW (yellow) both enter the ops queue, differentiated by the persisted riskAction so
    // green campaigns can be fast-tracked. Green auto-launch activates once the execution engine
    // (Meta Marketing API) is live.
    if (assessment.action === "BLOCK") {
      const detail = assessment.categories.length
        ? `: ${assessment.categories.join(", ")}`
        : ".";

      return this.changeCampaignStatus(
        scope,
        campaignId,
        "REJECTED",
        `Blocked by risk controls${detail}`
      );
    }

    await this.createBudgetHoldRecord(scope, campaignId, {
      amountMinor: existing.budgetMinor,
      invoiceId: input.invoiceId,
      reason: input.reason ?? "Campaign submitted from Studio",
      idempotencyKey: `campaign:${campaignId}:studio-submit-hold`
    });

    return this.changeCampaignStatus(scope, campaignId, "PENDING_REVIEW", input.reason ?? "Submitted for review");
  }

  /**
   * Runs the Campaign Risk Engine for a campaign, persists a `CampaignRiskAssessment` row, and
   * denormalises the decision onto `Campaign.riskAction`/`riskScore` for ops-queue filtering.
   */
  private async assessCampaign(scope: AuthenticatedRequestContext, campaignId: string) {
    const campaign = await this.db.campaign.findFirst({
      where: { id: campaignId, workspaceId: scope.workspaceId },
      include: { destination: true, adAccount: true }
    });

    if (!campaign) {
      throw new NotFoundException("Campaign not found.");
    }

    const priorCampaigns = await this.db.campaign.count({
      where: {
        workspaceId: scope.workspaceId,
        id: { not: campaignId },
        status: { not: "DRAFT" }
      }
    });

    const assessment = assessCampaignRisk({
      accountType: campaign.adAccount?.type ?? "MANAGED",
      budgetMinor: campaign.budgetMinor,
      currency: campaign.currency,
      destinationUrl: campaign.destination?.url,
      destinationKind: campaign.destination?.kind,
      contentText: [campaign.name, campaign.brief].filter(Boolean).join(" "),
      advertiser: {
        kycStatus: campaign.adAccount?.kycStatus ?? "UNVERIFIED",
        priorCampaigns
      }
    });

    const reasons = assessment.signals.map((signal) => signal.message);

    await this.db.$transaction(async (tx: DbClient) => {
      await tx.campaignRiskAssessment.upsert({
        where: { campaignId },
        create: {
          campaignId,
          score: assessment.score,
          action: assessment.action,
          tier: assessment.riskLevel,
          categories: assessment.categories,
          reasons,
          autoLaunchEligible: assessment.autoLaunchEligible,
          assessedByUserId: scope.userId,
          metadata: { signals: assessment.signals }
        },
        update: {
          score: assessment.score,
          action: assessment.action,
          tier: assessment.riskLevel,
          categories: assessment.categories,
          reasons,
          autoLaunchEligible: assessment.autoLaunchEligible,
          assessedByUserId: scope.userId,
          assessedAt: now(),
          metadata: { signals: assessment.signals }
        }
      });
      await tx.campaign.update({
        where: { id: campaignId },
        data: { riskAction: assessment.action, riskScore: assessment.score }
      });
    });

    return assessment;
  }

  async startCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    return this.changeCampaignStatus(scope, campaignId, "RUNNING", "Manual ad launch started");
  }

  async pauseCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    this.assertStatusAllowed(campaign.status, clientPauseStatuses, "Only active campaigns can be paused.");

    return this.applyClientStatusControl(scope, campaign, {
      action: "pause",
      auditAction: "campaign.client_control.paused",
      eventName: "CampaignPaused",
      nextStatus: "PAUSED",
      notificationBody: `${scope.userName ?? "A client"} paused ${campaign.name}.`,
      notificationTitle: "Campaign paused by client",
      reason: String(input.reason ?? input.note ?? "Client paused campaign.")
    });
  }

  async resumeCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    this.assertStatusAllowed(campaign.status, clientResumeStatuses, "Only paused campaigns can be resumed.");

    return this.applyClientStatusControl(scope, campaign, {
      action: "resume",
      auditAction: "campaign.client_control.resumed",
      eventName: "CampaignResumed",
      nextStatus: "RUNNING",
      notificationBody: `${scope.userName ?? "A client"} resumed ${campaign.name}.`,
      notificationTitle: "Campaign resumed by client",
      reason: String(input.reason ?? input.note ?? "Client resumed campaign.")
    });
  }

  /**
   * Layer-3 business-outcome capture (the "data exhaust" the optimization engine will eventually
   * be built from): did the campaign actually help the business, not just what the platform
   * reported. Deliberately a one-tap surface, not a form -- every field is optional except that
   * at least one signal must be present, so a customer can respond to "How'd it go? Run it
   * again?" with a single boolean and nothing else.
   */
  async recordCampaignOutcome(
    context: AuthenticatedRequestContext | undefined,
    campaignId: string,
    input: Record<string, any> = {}
  ) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    this.assertCampaignLaunchedForReporting(campaign);

    const hasSignal = [
      input.wouldRunAgain,
      input.rating,
      input.messagesCount,
      input.ordersCount,
      input.estRevenueMinor
    ].some((value) => value !== undefined && value !== null);

    if (!hasSignal) {
      throw new BadRequestException(
        "At least one outcome signal (wouldRunAgain, rating, messagesCount, ordersCount, or estRevenueMinor) is required."
      );
    }

    const rating = input.rating === undefined ? undefined : parseNonNegativeInt(input.rating, "rating");
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new BadRequestException("rating must be between 1 and 5.");
    }

    const source = normalizeCampaignOutcomeSource(input.source);
    const data = {
      messagesCount:
        input.messagesCount === undefined ? undefined : parseNonNegativeInt(input.messagesCount, "messagesCount"),
      ordersCount:
        input.ordersCount === undefined ? undefined : parseNonNegativeInt(input.ordersCount, "ordersCount"),
      estRevenueMinor:
        input.estRevenueMinor === undefined
          ? undefined
          : parseNonNegativeInt(input.estRevenueMinor, "estRevenueMinor"),
      currency: getCurrency(input.currency, getCurrency(campaign.currency, "NGN")),
      rating,
      wouldRunAgain: input.wouldRunAgain === undefined ? undefined : Boolean(input.wouldRunAgain),
      source,
      capturedByUserId: scope.userId,
      capturedAt: now(),
      notes: input.notes === undefined ? undefined : String(input.notes)
    };

    return this.db.$transaction(async (tx: DbClient) => {
      const outcome = await tx.campaignOutcome.upsert({
        where: { campaignId },
        create: { campaignId, ...data },
        update: data
      });

      await this.audit(tx, scope, "campaign.outcome.recorded", "CampaignOutcome", outcome.id, {
        campaignId,
        source,
        wouldRunAgain: data.wouldRunAgain ?? null
      });
      await this.event(tx, scope.workspaceId, "CampaignOutcomeRecorded", "Campaign", campaignId, {
        campaignId,
        outcomeId: outcome.id,
        source
      });

      return outcome;
    });
  }

  async getCampaignOutcome(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);

    return this.db.campaignOutcome.findUnique({ where: { campaignId } });
  }

  async requestCampaignChanges(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    this.assertStatusAllowed(
      campaign.status,
      clientChangeRequestStatuses,
      "Changes can only be requested while a campaign is in review, preparation, live delivery, or pause."
    );

    const reason = String(input.reason ?? input.message ?? input.note ?? "Client requested campaign changes.");

    return this.applyClientStatusControl(scope, campaign, {
      action: "request_changes",
      auditAction: "campaign.client_control.changes_requested",
      eventName: "CampaignChangesRequested",
      nextStatus: "CHANGES_REQUESTED",
      notificationBody: reason,
      notificationTitle: "Campaign change requested",
      reason
    });
  }

  async stopCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    this.assertStatusAllowed(campaign.status, clientStopStatuses, "This campaign can no longer be stopped.");

    return this.applyClientStatusControl(scope, campaign, {
      action: "stop",
      auditAction: "campaign.client_control.stopped",
      eventName: "CampaignTerminated",
      nextStatus: "CANCELLED",
      notificationBody: `${scope.userName ?? "A client"} stopped ${campaign.name}.`,
      notificationTitle: "Campaign terminated by client",
      reason: String(input.reason ?? input.note ?? "Client stopped campaign.")
    });
  }

  async increaseCampaignBudget(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");

    return this.applyClientBudgetControl(scope, campaign, "increase_budget", input);
  }

  async decreaseCampaignBudget(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");

    return this.applyClientBudgetControl(scope, campaign, "decrease_budget", input);
  }

  /**
   * Redirects unspent budget from one of the customer's campaigns to another -- e.g. pausing a
   * slow-performing product's ad and putting the remaining budget behind a different one, without
   * a refund/re-fund round trip. Both campaigns must belong to the caller's workspace; only the
   * UNSPENT portion of the source campaign can move (spend already recorded is untouchable).
   */
  async transferCampaignBudget(
    context: AuthenticatedRequestContext | undefined,
    fromCampaignId: string,
    input: Record<string, any>
  ) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");

    const toCampaignId = requiredString(input.toCampaignId, "toCampaignId is required.");
    if (toCampaignId === fromCampaignId) {
      throw new BadRequestException("Cannot transfer a campaign's budget to itself.");
    }

    const amountMinor = parseNonNegativeInt(input.amountMinor, "amountMinor");
    if (amountMinor <= 0) {
      throw new BadRequestException("Transfer amount must be a positive minor-unit integer.");
    }

    const [fromCampaign, toCampaign] = await Promise.all([
      this.findCampaignOrThrow(this.db, scope.workspaceId, fromCampaignId),
      this.findCampaignOrThrow(this.db, scope.workspaceId, toCampaignId)
    ]);

    if (fromCampaign.currency !== toCampaign.currency) {
      throw new BadRequestException("Cannot transfer budget between campaigns in different currencies.");
    }

    const spentMinor = this.totalRecordedSpendMinor(fromCampaign);
    const availableMinor = fromCampaign.budgetMinor - spentMinor;
    if (amountMinor > availableMinor) {
      throw new BadRequestException(
        `Only ${availableMinor} minor units are unspent and available to transfer from this campaign.`
      );
    }

    return this.db.$transaction(async (tx: DbClient) => {
      const updatedFrom = await tx.campaign.update({
        where: { id: fromCampaignId },
        data: { budgetMinor: fromCampaign.budgetMinor - amountMinor },
        include: campaignInclude
      });
      const updatedTo = await tx.campaign.update({
        where: { id: toCampaignId },
        data: { budgetMinor: toCampaign.budgetMinor + amountMinor },
        include: campaignInclude
      });

      const reason = input.reason ?? `Budget redirected to campaign "${toCampaign.name}"`;
      await this.createCampaignLedgerEntry(tx, scope, fromCampaignId, {
        type: "ADJUSTMENT",
        direction: "DEBIT",
        amountMinor,
        currency: fromCampaign.currency,
        description: reason,
        sourceType: "Campaign",
        sourceId: toCampaignId,
        idempotencyKey: `campaign-transfer:${fromCampaignId}:${toCampaignId}:${randomUUID()}`
      });
      await this.createCampaignLedgerEntry(tx, scope, toCampaignId, {
        type: "ADJUSTMENT",
        direction: "CREDIT",
        amountMinor,
        currency: toCampaign.currency,
        description: `Budget received from campaign "${fromCampaign.name}"`,
        sourceType: "Campaign",
        sourceId: fromCampaignId,
        idempotencyKey: `campaign-transfer:${toCampaignId}:${fromCampaignId}:${randomUUID()}`
      });

      await this.audit(tx, scope, "campaign.budget_transferred", "Campaign", fromCampaignId, {
        toCampaignId,
        amountMinor
      });
      await this.event(tx, scope.workspaceId, "CampaignBudgetTransferred", "Campaign", fromCampaignId, {
        fromCampaignId,
        toCampaignId,
        amountMinor
      });

      return { from: this.toCampaign(updatedFrom), to: this.toCampaign(updatedTo) };
    });
  }

  /**
   * Compares cost-per-outcome across the workspace's own live campaigns and recommends moving
   * unspent budget from an underperformer to a better performer -- see recommendBudgetOptimization
   * in @fliptrybe/service-campaigns for the honest scope note (this is NOT cross-platform
   * auto-optimization). Pure recommendation: nothing moves until the caller separately confirms via
   * transferCampaignBudget, same "don't silently move money" discipline as budget increase/decrease.
   */
  async getBudgetOptimizationRecommendations(context: AuthenticatedRequestContext | undefined) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");

    const campaigns = await this.db.campaign.findMany({
      where: {
        workspaceId: scope.workspaceId,
        deletedAt: null,
        status: { in: [...launchedCampaignStatuses] }
      },
      include: { spendEntries: true, manualPlacements: true, outcome: true }
    });

    const performanceInputs: CampaignPerformanceInput[] = campaigns.map((campaign: any) => {
      const storedGoal = campaign.metadata?.goal;
      const goal: CampaignGoal = isCampaignGoal(storedGoal)
        ? storedGoal
        : goalFromObjective(String(campaign.objective), undefined);

      return {
        campaignId: campaign.id,
        name: campaign.name,
        currency: campaign.currency ?? "NGN",
        budgetMinor: campaign.budgetMinor,
        spentMinor: this.totalRecordedSpendMinor(campaign),
        goal,
        ...(campaign.outcome
          ? {
              outcome: {
                messagesCount: campaign.outcome.messagesCount ?? undefined,
                ordersCount: campaign.outcome.ordersCount ?? undefined,
                estRevenueMinor: campaign.outcome.estRevenueMinor ?? undefined
              }
            }
          : {})
      };
    });

    return recommendBudgetOptimization(performanceInputs);
  }

  async listCampaignAuditTrail(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);

    const [statusHistory, auditLogs] = await Promise.all([
      this.db.campaignStatusHistory.findMany({
        where: { campaignId },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      this.db.auditLog.findMany({
        where: { workspaceId: scope.workspaceId, entityType: "Campaign", entityId: campaignId },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);

    return {
      campaignId,
      items: [
        ...statusHistory.map((item: any) => this.toAuditTrailItem("status", item)),
        ...auditLogs.map((item: any) => this.toAuditTrailItem("audit", item))
      ].sort((left: any, right: any) => String(right.timestamp).localeCompare(String(left.timestamp)))
    };
  }

  async addCampaignNote(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>, admin = false) {
    const scope = requireScope(context);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");

    return this.db.$transaction(async (tx: DbClient) => {
      const note = await tx.campaignNote.create({
        data: {
          campaignId,
          authorUserId: scope.userId,
          visibility: admin ? input.visibility ?? "INTERNAL" : "CLIENT_VISIBLE",
          body: String(input.body ?? input.note ?? ""),
          metadata: normalizeJsonObject(input.metadata)
        }
      });

      await this.audit(tx, scope, "campaign.note.created", "Campaign", campaignId, {
        visibility: note.visibility
      });
      if (note.visibility === "CLIENT_VISIBLE") {
        await this.notify(tx, scope.workspaceId, "Campaign note added", "A new campaign note is available.", {
          entityType: "Campaign",
          entityId: campaignId,
          actionUrl: `/campaigns/${campaignId}`
        });
      }
      return note;
    });
  }

  async addCampaignAsset(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    await this.assertCampaignPermission(this.db, scope, "campaign:manage");
    const asset = await this.db.mediaAsset.findFirst({
      where: { id: String(input.mediaAssetId ?? input.assetId), workspaceId: scope.workspaceId, deletedAt: null }
    });
    if (!asset) {
      throw new NotFoundException("Media asset was not found in the active workspace.");
    }

    const creative = await this.db.campaignCreative.create({
      data: {
        campaignId,
        mediaAssetId: asset.id,
        name: input.name ?? asset.originalFilename ?? "Campaign asset",
        format: asset.kind === "VIDEO" ? "VIDEO" : "IMAGE",
        role: input.role ?? "CREATIVE",
        placement: input.placement,
        sortOrder: Number(input.sortOrder ?? 100),
        landingUrl: input.landingUrl
      },
      include: { mediaAsset: true }
    });

    return creative;
  }

  async listCampaignReports(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);

    return this.db.campaignReport.findMany({
      where: { campaignId, status: "PUBLISHED", deletedAt: null },
      include: { screenshots: { include: { mediaAsset: true } } },
      orderBy: { publishedAt: "desc" }
    });
  }

  async createUploadIntent(context: AuthenticatedRequestContext | undefined, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    const mimeType = String(input.mimeType ?? input.contentType ?? "image/png").toLowerCase();
    const sizeBytes = Number(input.sizeBytes ?? input.byteSize ?? 0);
    const purpose = String(input.purpose ?? "creative").toLowerCase();

    assertMediaPolicy({ mimeType, sizeBytes, purpose });
    if (input.campaignId) {
      await this.findCampaignOrThrow(this.db, scope.workspaceId, String(input.campaignId));
    }

    const resourceType = videoMimeTypes.has(mimeType) ? "video" : "image";
    const storageKey = `${scope.workspaceId}/campaign-assets/${id("asset")}`;
    const publicId = `${(process.env.CLOUDINARY_FOLDER ?? "fliptrybe").replace(/^\/+|\/+$/g, "")}/${storageKey}`;
    const signedUpload = this.createCloudinarySignedUpload(resourceType, publicId);
    if (!signedUpload && !allowMockMediaStorageFallback()) {
      throw new BadRequestException(
        "Media uploads are unavailable because Cloudinary signing is not configured."
      );
    }
    const fallback = signedUpload
      ? undefined
      : await this.mockStorageProvider.createUploadUrl({ key: storageKey, contentType: mimeType });

    const asset = await this.db.mediaAsset.create({
      data: {
        workspaceId: scope.workspaceId,
        uploaderUserId: scope.userId,
        companyProfileId: input.companyProfileId,
        kind: inferMediaKind(mimeType, purpose),
        status: "PENDING_UPLOAD",
        deliveryType: purpose === "screenshot" || purpose === "report" ? "AUTHENTICATED" : "PUBLIC",
        storageProvider: signedUpload ? "cloudinary" : "mock-storage",
        storageKey,
        providerPublicId: signedUpload ? publicId : undefined,
        url: fallback?.publicUrl,
        secureUrl: fallback?.publicUrl,
        contentType: mimeType,
        byteSize: sizeBytes,
        originalFilename: input.fileName ?? input.name,
        checksumSha256: input.checksumSha256,
        metadata: { purpose, campaignId: input.campaignId, reportId: input.reportId }
      }
    });

    return {
      assetId: asset.id,
      status: asset.status,
      uploadUrl: signedUpload?.uploadUrl ?? fallback?.uploadUrl,
      fields: signedUpload?.fields ?? {},
      expiresAt: new Date(Date.now() + Number(process.env.MEDIA_UPLOAD_SIGNATURE_TTL_SECONDS ?? 900) * 1000).toISOString(),
      maxBytes: purpose === "screenshot" ? maxScreenshotBytes : videoMimeTypes.has(mimeType) ? maxVideoBytes : maxImageBytes,
      allowedMimeTypes: [...imageMimeTypes, ...videoMimeTypes]
    };
  }

  async completeUpload(context: AuthenticatedRequestContext | undefined, assetId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    const asset = await this.db.mediaAsset.findFirst({ where: { id: assetId, workspaceId: scope.workspaceId } });
    if (!asset) {
      throw new NotFoundException("Media asset was not found in the active workspace.");
    }
    if (!verifyCloudinaryUploadCompletion(asset, input)) {
      throw new BadRequestException("Cloudinary upload completion could not be verified.");
    }

    return this.db.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: "READY",
        providerAssetId: input.asset_id ?? input.providerAssetId ?? asset.providerAssetId,
        providerPublicId: input.public_id ?? input.providerPublicId ?? asset.providerPublicId,
        format: input.format ?? asset.format,
        byteSize: Number(input.bytes ?? input.byteSize ?? asset.byteSize),
        width: input.width === undefined ? asset.width : Number(input.width),
        height: input.height === undefined ? asset.height : Number(input.height),
        durationMs: input.duration === undefined ? asset.durationMs : Math.round(Number(input.duration) * 1000),
        secureUrl: input.secure_url ?? input.secureUrl ?? input.url ?? asset.secureUrl,
        url: input.secure_url ?? input.secureUrl ?? input.url ?? asset.url,
        metadata: { ...(asset.metadata ?? {}), completed: true }
      }
    });
  }

  async getWallet(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const wallet = await this.getOrCreateWallet(this.db, scope.workspaceId, "NGN");
    const [entries, activeHolds] = await Promise.all([
      this.db.ledgerEntry.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" } }),
      this.db.campaignBudgetHold.findMany({ where: { walletId: wallet.id, status: "ACTIVE" } })
    ]);
    const mappedEntries = entries.map(mapLedgerEntry);
    const availableBalance = calculateAvailableBalance(mappedEntries);
    const consistency = buildWalletConsistency(mappedEntries);
    const heldMinor = activeHolds.reduce((sum: number, hold: any) => sum + hold.amountMinor, 0);

    return {
      id: wallet.id,
      workspaceId: wallet.workspaceId,
      availableBalance,
      heldBalance: { amountMinor: heldMinor, currency: getCurrency(wallet.currency, "NGN") },
      consistency,
      entries: mappedEntries,
      createdAt: iso(wallet.createdAt),
      updatedAt: iso(wallet.updatedAt)
    };
  }

  // `getWallet` returns every entry ever written, which is fine for balances but
  // not for history. This is the paged/filterable read the wallet UI and any
  // future statement export should use.
  async listWalletLedger(
    context: AuthenticatedRequestContext | undefined,
    query: { from?: string; to?: string; limit?: number; cursor?: string } = {}
  ) {
    const scope = requireScope(context);
    const wallet = await this.getOrCreateWallet(this.db, scope.workspaceId, "NGN");

    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const createdAt: { gte?: Date; lte?: Date } = {};

    if (query.from) {
      const from = new Date(query.from);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException("`from` must be an ISO 8601 date.");
      }
      createdAt.gte = from;
    }

    if (query.to) {
      const to = new Date(query.to);
      if (Number.isNaN(to.getTime())) {
        throw new BadRequestException("`to` must be an ISO 8601 date.");
      }
      createdAt.lte = to;
    }

    if (createdAt.gte && createdAt.lte && createdAt.gte > createdAt.lte) {
      throw new BadRequestException("`from` must not be after `to`.");
    }

    const rows = await this.db.ledgerEntry.findMany({
      where: {
        walletId: wallet.id,
        ...(createdAt.gte || createdAt.lte ? { createdAt } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    const page = rows.slice(0, limit);

    return {
      entries: page.map(mapLedgerEntry),
      nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null
    };
  }

  async listCampaignLedger(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignFinancialRecord(scope.workspaceId, campaignId);

    return this.buildCampaignLedger(campaign);
  }

  async getCampaignBudgetSummary(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignFinancialRecord(scope.workspaceId, campaignId);
    const ledger = this.buildCampaignLedger(campaign);

    return this.buildCampaignBudgetSummary(campaign, ledger);
  }

  async getCampaignSpendBreakdown(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignFinancialRecord(scope.workspaceId, campaignId);
    const ledger = this.buildCampaignLedger(campaign);

    return this.buildCampaignSpendBreakdown(campaign, ledger);
  }

  async createFundingIntent(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    return this.createPaymentIntent(context, { ...input, purpose: "wallet_funding" });
  }

  async createPaymentIntent(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    assertLivePaymentsConfiguredForProduction();
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");
    const amountMinor = parsePositiveMinorAmount(
      input.amountMinor ?? input.amount ?? 500000,
      "Payment amount must be a positive minor-unit integer."
    );
    const currency = getCurrency(input.currency, "NGN");
    const campaignId = typeof input.campaignId === "string" ? input.campaignId : undefined;
    const campaignInvoiceId =
      typeof input.invoiceId === "string"
        ? input.invoiceId
        : typeof input.campaignInvoiceId === "string"
          ? input.campaignInvoiceId
          : undefined;
    let invoice: { campaignId: string } | null = null;

    if (campaignId) {
      await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    }
    if (campaignInvoiceId) {
      invoice = await this.db.campaignInvoice.findFirst({
        where: { id: campaignInvoiceId, workspaceId: scope.workspaceId, deletedAt: null }
      });
      if (!invoice) {
        throw new NotFoundException("Invoice was not found in the active workspace.");
      }
      if (campaignId && invoice.campaignId !== campaignId) {
        throw new BadRequestException("Payment invoice does not belong to the supplied campaign.");
      }
    }

    const idempotencyKey =
      normalizeIdempotencyKey(input.idempotencyKey) ??
      (campaignInvoiceId
        ? `payment-intent:invoice:${campaignInvoiceId}`
        : campaignId
          ? `payment-intent:campaign:${campaignId}:${amountMinor}:${currency}:${input.purpose ?? "payment"}`
          : `payment-intent:wallet:${scope.workspaceId}:${amountMinor}:${currency}:${input.customerEmail ?? scope.userEmail ?? "customer"}`);
    const existingIntent = await this.db.paymentIntent.findUnique?.({ where: { idempotencyKey } });
    if (existingIntent) {
      if (existingIntent.workspaceId !== scope.workspaceId) {
        throw new BadRequestException("Idempotency key was already used for another workspace.");
      }
      return this.toPaymentIntent(existingIntent);
    }

    const wallet = await this.getOrCreateWallet(this.db, scope.workspaceId, currency);
    const gatewayIntent = await this.paymentGateway.createPaymentIntent({
      amount: { amountMinor, currency },
      workspaceId: scope.workspaceId,
      customerEmail: input.customerEmail ?? scope.userEmail,
      customerName: input.customerName ?? scope.userName,
      redirectUrl: input.redirectUrl,
      webhookUrl: process.env.NODE_ENV === "production" ? undefined : input.webhookUrl
    });

    const intent = await this.db.paymentIntent.create({
      data: {
        workspaceId: scope.workspaceId,
        walletId: wallet.id,
        campaignId: campaignId ?? invoice?.campaignId,
        campaignInvoiceId,
        gateway: gatewayIntent.gateway,
        amountMinor,
        currency,
        status: gatewayIntent.status,
        providerReference: gatewayIntent.providerReference,
        checkoutUrl: gatewayIntent.checkoutUrl,
        customerEmail: input.customerEmail ?? scope.userEmail,
        customerName: input.customerName ?? scope.userName,
        idempotencyKey,
        metadata: { purpose: input.purpose ?? "payment" },
        providerPayload: gatewayIntent.metadata ?? {}
      }
    });

    return this.toPaymentIntent(intent);
  }

  async verifyPayment(context: AuthenticatedRequestContext | undefined, reference: string) {
    assertLivePaymentsConfiguredForProduction();
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");
    const result = await this.paymentGateway.verifyPayment(reference);
    const intent = await this.db.paymentIntent.findFirst({
      where: { providerReference: result.providerReference ?? reference, workspaceId: scope.workspaceId }
    });
    if (!intent) {
      throw new NotFoundException("Payment intent was not found in the active workspace.");
    }

    return this.completePaymentIntent(intent.id, result.status, result.providerReference, scope);
  }

  async handleKorapayWebhook(body: unknown, signature?: string) {
    assertLivePaymentsConfiguredForProduction();
    if (!verifyKorapaySignature({ body, signature })) {
      throw new BadRequestException("Invalid Korapay webhook signature.");
    }

    const eventBody = typeof body === "object" && body !== null ? (body as Record<string, any>) : {};
    const data = typeof eventBody.data === "object" && eventBody.data !== null ? eventBody.data : {};
    const reference = data.reference ?? data.payment_reference;
    if (!reference || typeof reference !== "string") {
      throw new BadRequestException("Korapay webhook is missing a payment reference.");
    }

    const eventId =
      typeof eventBody.event === "string"
        ? eventBody.event
        : typeof eventBody.id === "string"
          ? eventBody.id
          : typeof data.id === "string"
            ? data.id
            : undefined;
    const replayKey = `korapay:webhook:${eventId ?? reference}:${eventFingerprint(data)}`;
    const existingReceipt = await this.db.eventOutbox.findUnique?.({
      where: { idempotencyKey: replayKey }
    });
    if (existingReceipt?.processedAt) {
      return { accepted: true, duplicate: true, reference, status: data.status ?? "processed" };
    }
    await this.db.eventOutbox.upsert?.({
      where: { idempotencyKey: replayKey },
      update: {},
      create: {
        workspaceId: null,
        name: "KorapayWebhookReceived",
        entityType: "PaymentIntent",
        entityId: reference,
        payload: { reference, status: data.status ?? null, eventId: eventId ?? null },
        idempotencyKey: replayKey
      }
    });

    const intent = await this.db.paymentIntent.findFirst({ where: { providerReference: reference } });
    if (!intent) {
      return { accepted: true, reference, status: data.status ?? "unmatched" };
    }

    const status = this.mapPaymentStatus(data.status);
    await this.completePaymentIntent(intent.id, status, reference);
    await this.db.eventOutbox.update?.({
      where: { idempotencyKey: replayKey },
      data: { workspaceId: intent.workspaceId, status: "PROCESSED", processedAt: now() }
    });
    return { accepted: true, reference, status };
  }

  async listInvoices(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    return this.db.campaignInvoice.findMany({
      where: { workspaceId: scope.workspaceId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  async getInvoice(context: AuthenticatedRequestContext | undefined, invoiceId: string) {
    const scope = requireScope(context);
    const invoice = await this.db.campaignInvoice.findFirst({
      where: { id: invoiceId, workspaceId: scope.workspaceId, deletedAt: null }
    });
    if (!invoice) {
      throw new NotFoundException("Invoice was not found in the active workspace.");
    }

    return invoice;
  }

  async createCampaignInvoice(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const subtotalMinor = parsePositiveMinorAmount(
      input.subtotalMinor ?? input.totalMinor ?? input.amountMinor ?? campaign.budgetMinor,
      "Invoice subtotal must be a positive minor-unit amount."
    );
    const taxMinor = parseNonNegativeMinorAmount(
      input.taxMinor ?? 0,
      "Invoice tax must be a non-negative minor-unit amount."
    );
    const totalMinor = subtotalMinor + taxMinor;
    const lineItems = normalizeInvoiceLineItems(
      input.lineItems,
      [{ label: "Managed ad campaign budget", amountMinor: subtotalMinor, currency: campaign.currency }],
      campaign.currency
    );
    const lineItemTotalMinor = lineItems.reduce((sum, item) => sum + item.amountMinor, 0);
    if (lineItemTotalMinor !== subtotalMinor) {
      throw new BadRequestException("Invoice line item amounts must equal the invoice subtotal.");
    }
    const number = input.number ?? `INV-${Date.now().toString(36).toUpperCase()}-${campaign.id.slice(0, 6)}`;

    const invoice = await this.db.campaignInvoice.create({
      data: {
        workspaceId: scope.workspaceId,
        campaignId,
        companyProfileId: campaign.companyProfileId,
        number,
        status: "ISSUED",
        subtotalMinor,
        taxMinor,
        totalMinor,
        currency: campaign.currency,
        lineItems,
        issuedAt: now(),
        dueAt: input.dueAt ? new Date(String(input.dueAt)) : undefined,
        metadata: normalizeJsonObject(input.metadata)
      }
    });

    await this.db.auditLog.create({
      data: {
        workspaceId: scope.workspaceId,
        actorUserId: scope.userId,
        action: "campaign_invoice.issued",
        entityType: "CampaignInvoice",
        entityId: invoice.id,
        metadata: { campaignId }
      }
    });
    return invoice;
  }

  async payInvoice(context: AuthenticatedRequestContext | undefined, invoiceId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");
    const invoice = await this.getInvoice(scope, invoiceId);
    if (invoice.status === "PAID") {
      return invoice;
    }
    const amountDueMinor = parsePositiveMinorAmount(
      invoice.totalMinor - invoice.amountPaidMinor,
      "Invoice amount due must be positive before settlement."
    );

    if (String(input.method ?? "wallet").toLowerCase() !== "wallet") {
      return this.createPaymentIntent(scope, {
        amountMinor: amountDueMinor,
        currency: invoice.currency,
        invoiceId: invoice.id,
        campaignId: invoice.campaignId,
        purpose: "invoice_payment",
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        redirectUrl: input.redirectUrl
      });
    }

    return this.db.$transaction(async (tx: DbClient) => {
      const wallet = await this.getOrCreateWallet(tx, scope.workspaceId, getCurrency(invoice.currency, "NGN"));
      await this.lockWallet(tx, wallet.id);
      const lockedInvoice = await tx.campaignInvoice.findFirst({
        where: { id: invoice.id, workspaceId: scope.workspaceId, deletedAt: null }
      });
      if (!lockedInvoice) {
        throw new NotFoundException("Invoice was not found in the active workspace.");
      }
      if (lockedInvoice.status === "PAID") {
        return lockedInvoice;
      }
      const lockedAmountDueMinor = parsePositiveMinorAmount(
        lockedInvoice.totalMinor - lockedInvoice.amountPaidMinor,
        "Invoice amount due must be positive before settlement."
      );
      await this.assertWalletCanPay(tx, wallet.id, lockedAmountDueMinor, lockedInvoice.currency);
      const walletDebit = await this.createWalletLedgerEntry(tx, {
        walletId: wallet.id,
        kind: "DEBIT",
        amountMinor: lockedAmountDueMinor,
        currency: lockedInvoice.currency,
        reference: `invoice:${lockedInvoice.id}`,
        description: `Campaign invoice ${lockedInvoice.number} paid from wallet`,
        idempotencyKey: `invoice:${lockedInvoice.id}:wallet_payment`,
        sourceType: "CampaignInvoice",
        sourceId: lockedInvoice.id
      });
      const paid = await tx.campaignInvoice.update({
        where: { id: lockedInvoice.id },
        data: {
          status: "PAID",
          amountPaidMinor: lockedInvoice.totalMinor,
          paidAt: now()
        }
      });
      await this.audit(tx, scope, "campaign_invoice.paid", "CampaignInvoice", lockedInvoice.id, {});
      await this.createCampaignLedgerEntry(tx, scope, lockedInvoice.campaignId, {
        amountMinor: lockedAmountDueMinor,
        campaignInvoiceId: lockedInvoice.id,
        category: campaignLedgerCategory("INVOICE_PAYMENT"),
        currency: lockedInvoice.currency,
        description: `Campaign invoice ${lockedInvoice.number} paid from wallet`,
        direction: "DEBIT",
        idempotencyKey: `campaign-ledger:invoice:${lockedInvoice.id}:wallet-payment`,
        occurredAt: paid.paidAt ?? now(),
        sourceId: lockedInvoice.id,
        sourceType: "CampaignInvoice",
        type: "INVOICE_PAYMENT",
        walletId: wallet.id,
        walletLedgerEntryId: walletDebit.id
      });
      await this.notify(tx, scope.workspaceId, "Invoice paid", "Your campaign invoice has been paid.", {
        entityType: "CampaignInvoice",
        entityId: lockedInvoice.id,
        actionUrl: `/billing/invoices/${lockedInvoice.id}`
      });
      await this.assertWalletConsistency(tx, wallet.id);
      return paid;
    });
  }

  async createBudgetHold(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");
    return this.createBudgetHoldRecord(scope, campaignId, input);
  }

  private async createBudgetHoldRecord(scope: AuthenticatedRequestContext, campaignId: string, input: Record<string, any>) {
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const amountMinor = parsePositiveMinorAmount(
      input.amountMinor ?? campaign.budgetMinor,
      "Budget hold amount must be a positive minor-unit amount."
    );
    const invoiceId = typeof input.invoiceId === "string" ? input.invoiceId : undefined;
    if (invoiceId) {
      const invoice = await this.db.campaignInvoice.findFirst({
        where: { id: invoiceId, campaignId, workspaceId: scope.workspaceId, deletedAt: null }
      });
      if (!invoice) {
        throw new NotFoundException("Invoice was not found in the active workspace.");
      }
    }
    const idempotencyKey =
      normalizeIdempotencyKey(input.idempotencyKey) ?? `campaign:${campaignId}:hold:${amountMinor}`;

    return this.db.$transaction(async (tx: DbClient) => {
      const existing = await tx.campaignBudgetHold.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return existing;
      }
      const wallet = await this.getOrCreateWallet(tx, scope.workspaceId, getCurrency(campaign.currency, "NGN"));
      await this.lockWallet(tx, wallet.id);
      await this.assertWalletCanPay(tx, wallet.id, amountMinor, campaign.currency);
      const ledger = await this.createWalletLedgerEntry(tx, {
        walletId: wallet.id,
        kind: "HOLD",
        amountMinor,
        currency: campaign.currency,
        reference: `campaign:${campaignId}:budget_hold`,
        description: "Campaign budget hold",
        idempotencyKey: `${idempotencyKey}:ledger`,
        sourceType: "Campaign",
        sourceId: campaignId
      });
      const hold = await tx.campaignBudgetHold.create({
        data: {
          campaignId,
          walletId: wallet.id,
          invoiceId,
          createdByUserId: scope.userId,
          amountMinor,
          currency: campaign.currency,
          idempotencyKey,
          holdLedgerEntryId: ledger.id,
          reason: input.reason
        }
      });
      await this.createCampaignLedgerEntry(tx, scope, campaignId, {
        amountMinor,
        campaignBudgetHoldId: hold.id,
        campaignInvoiceId: invoiceId,
        category: campaignLedgerCategory("BUDGET_ALLOCATION"),
        currency: campaign.currency,
        description: "Campaign budget allocated to launch reserve",
        direction: "HOLD",
        idempotencyKey: `campaign-ledger:hold:${hold.id}:allocation`,
        notes: input.reason,
        occurredAt: hold.createdAt ?? now(),
        sourceId: hold.id,
        sourceType: "CampaignBudgetHold",
        type: "BUDGET_ALLOCATION",
        walletId: wallet.id,
        walletLedgerEntryId: ledger.id
      });
      await this.audit(tx, scope, "campaign_budget_hold.created", "CampaignBudgetHold", hold.id, { campaignId });
      await this.assertWalletConsistency(tx, wallet.id);
      return hold;
    });
  }

  async releaseBudgetHold(context: AuthenticatedRequestContext | undefined, campaignId: string, holdId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");
    return this.db.$transaction(async (tx: DbClient) => {
      const hold = await tx.campaignBudgetHold.findFirst({ where: { id: holdId, campaignId }, include: { campaign: true } });
      if (!hold || hold.campaign.workspaceId !== scope.workspaceId) {
        throw new NotFoundException("Budget hold was not found in the active workspace.");
      }
      if (hold.status !== "ACTIVE") {
        return hold;
      }
      await this.lockWallet(tx, hold.walletId);
      const lockedHold = await tx.campaignBudgetHold.findFirst({
        where: { id: holdId, campaignId },
        include: { campaign: true }
      });
      if (!lockedHold || lockedHold.campaign.workspaceId !== scope.workspaceId) {
        throw new NotFoundException("Budget hold was not found in the active workspace.");
      }
      if (lockedHold.status !== "ACTIVE") {
        return lockedHold;
      }
      const release = await this.createWalletLedgerEntry(tx, {
        walletId: lockedHold.walletId,
        kind: "RELEASE",
        amountMinor: lockedHold.amountMinor,
        currency: lockedHold.currency,
        reference: `hold:${lockedHold.id}:release`,
        description: input.reason ?? "Campaign budget hold released",
        idempotencyKey: `hold:${lockedHold.id}:release`,
        sourceType: "CampaignBudgetHold",
        sourceId: lockedHold.id
      });

      const updated = await tx.campaignBudgetHold.update({
        where: { id: lockedHold.id },
        data: { status: "RELEASED", releaseLedgerEntryId: release.id, releasedAt: now(), reason: input.reason ?? lockedHold.reason }
      });
      await this.createCampaignLedgerEntry(tx, scope, campaignId, {
        amountMinor: lockedHold.amountMinor,
        campaignBudgetHoldId: lockedHold.id,
        campaignInvoiceId: lockedHold.invoiceId,
        category: campaignLedgerCategory("REFUND"),
        currency: lockedHold.currency,
        description: input.reason ?? "Campaign budget hold released",
        direction: "RELEASE",
        idempotencyKey: `campaign-ledger:hold:${lockedHold.id}:release`,
        notes: input.reason ?? lockedHold.reason,
        occurredAt: updated.releasedAt ?? now(),
        sourceId: lockedHold.id,
        sourceType: "CampaignBudgetHold",
        type: "REFUND",
        walletId: lockedHold.walletId,
        walletLedgerEntryId: release.id
      });
      await this.assertWalletConsistency(tx, lockedHold.walletId);

      return updated;
    });
  }

  async captureBudgetHold(context: AuthenticatedRequestContext | undefined, campaignId: string, holdId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "payment:manage");
    return this.db.$transaction(async (tx: DbClient) => {
      const hold = await tx.campaignBudgetHold.findFirst({ where: { id: holdId, campaignId }, include: { campaign: true } });
      if (!hold || hold.campaign.workspaceId !== scope.workspaceId) {
        throw new NotFoundException("Budget hold was not found in the active workspace.");
      }
      if (hold.status !== "ACTIVE") {
        return hold;
      }
      await this.lockWallet(tx, hold.walletId);
      const lockedHold = await tx.campaignBudgetHold.findFirst({
        where: { id: holdId, campaignId },
        include: { campaign: true }
      });
      if (!lockedHold || lockedHold.campaign.workspaceId !== scope.workspaceId) {
        throw new NotFoundException("Budget hold was not found in the active workspace.");
      }
      if (lockedHold.status !== "ACTIVE") {
        return lockedHold;
      }
      const amountMinor = parsePositiveMinorAmount(
        input.amountMinor ?? lockedHold.amountMinor,
        "Budget capture amount must be a positive minor-unit amount."
      );
      if (amountMinor > lockedHold.amountMinor) {
        throw new BadRequestException("Budget capture cannot exceed the active hold amount.");
      }
      const release = await this.createWalletLedgerEntry(tx, {
        walletId: lockedHold.walletId,
        kind: "RELEASE",
        amountMinor: lockedHold.amountMinor,
        currency: lockedHold.currency,
        reference: `hold:${lockedHold.id}:capture_release`,
        description: "Campaign budget hold released for spend capture",
        idempotencyKey: `hold:${lockedHold.id}:capture_release`,
        sourceType: "CampaignBudgetHold",
        sourceId: lockedHold.id
      });
      const debit = await this.createWalletLedgerEntry(tx, {
        walletId: lockedHold.walletId,
        kind: "DEBIT",
        amountMinor,
        currency: lockedHold.currency,
        reference: `hold:${lockedHold.id}:capture_debit`,
        description: "Campaign spend captured",
        idempotencyKey: `hold:${lockedHold.id}:capture_debit`,
        sourceType: "CampaignBudgetHold",
        sourceId: lockedHold.id
      });
      const spendEntry = await tx.campaignSpendEntry.create({
        data: {
          campaignId,
          placementId: input.placementId,
          actorUserId: scope.userId,
          amountMinor,
          currency: lockedHold.currency,
          source: input.source ?? "MANUAL",
          notes: input.notes,
          recordedForDate: input.recordedForDate ? new Date(String(input.recordedForDate)) : now()
        }
      });
      const ledgerType = normalizeCampaignLedgerEntryType(input.category ?? input.type ?? "AD_SPEND");
      await this.createCampaignLedgerEntry(tx, scope, campaignId, {
        amountMinor,
        campaignBudgetHoldId: lockedHold.id,
        campaignInvoiceId: lockedHold.invoiceId,
        campaignSpendEntryId: spendEntry.id,
        category: campaignLedgerCategory(ledgerType),
        currency: lockedHold.currency,
        description: input.description ?? campaignLedgerCategory(ledgerType),
        direction: "DEBIT",
        idempotencyKey: `campaign-ledger:hold:${lockedHold.id}:capture:${ledgerType}`,
        metadata: normalizeJsonObject(input.metadata),
        notes: input.notes,
        occurredAt: spendEntry.recordedForDate ?? now(),
        sourceId: spendEntry.id,
        sourceType: "CampaignSpendEntry",
        type: ledgerType,
        walletId: lockedHold.walletId,
        walletLedgerEntryId: debit.id
      });

      const updated = await tx.campaignBudgetHold.update({
        where: { id: lockedHold.id },
        data: {
          status: "CAPTURED",
          captureReleaseLedgerEntryId: release.id,
          captureDebitLedgerEntryId: debit.id,
          capturedAt: now()
        }
      });
      await this.assertWalletConsistency(tx, lockedHold.walletId);
      return updated;
    });
  }

  async getAdminOverview(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "admin:access");
    const [grouped, unassigned, campaigns, reports, activity, activeOperators] =
      await Promise.all([
        this.db.campaign.groupBy({
          by: ["status"],
          where: { workspaceId: scope.workspaceId, deletedAt: null },
          _count: { _all: true }
        }),
        this.db.campaign.count({
          where: {
            workspaceId: scope.workspaceId,
            deletedAt: null,
            assignments: { none: { status: "ACTIVE", deletedAt: null } }
          }
        }),
        this.db.campaign.findMany({
          where: { workspaceId: scope.workspaceId, deletedAt: null },
          include: campaignInclude,
          orderBy: { updatedAt: "desc" },
          take: 6
        }),
        this.db.campaignReport.findMany({
          where: { campaign: { workspaceId: scope.workspaceId }, deletedAt: null },
          include: { campaign: true },
          orderBy: { updatedAt: "desc" },
          take: 5
        }),
        this.db.auditLog.findMany({
          where: { workspaceId: scope.workspaceId },
          orderBy: { createdAt: "desc" },
          take: 8
        }),
        this.db.campaignAssignment.findMany({
          where: {
            status: "ACTIVE",
            campaign: { workspaceId: scope.workspaceId }
          },
          distinct: ["assigneeUserId"]
        })
      ]);
    const byStatus = Object.fromEntries(grouped.map((row: any) => [row.status, row._count._all]));
    const running = Number(byStatus.RUNNING ?? 0) + Number(byStatus.ACTIVE ?? 0);
    const pendingReviews = Number(byStatus.PENDING_REVIEW ?? 0);
    const launchPreparation =
      Number(byStatus.APPROVED ?? 0) +
      Number(byStatus.CREATIVE_IN_PROGRESS ?? 0) +
      Number(byStatus.QUEUED ?? 0);
    const blocked =
      Number(byStatus.CHANGES_REQUESTED ?? 0) +
      Number(byStatus.REJECTED ?? 0) +
      Number(byStatus.FAILED ?? 0);
    const adminCampaigns = campaigns.map((campaign: any) => this.toAdminCampaign(campaign));
    const budgetAlerts = adminCampaigns.filter(
      (campaign: any) => Number(campaign.budgetUtilization ?? 0) >= 85
    ).length;

    return {
      byStatus,
      unassigned,
      totals: {
        assigned: Math.max(0, launchPreparation - unassigned),
        blocked,
        completed: Number(byStatus.COMPLETED ?? 0),
        launchPreparation,
        pendingReviews,
        queued: pendingReviews,
        reporting: reports.filter((report: any) => report.status === "DRAFT").length,
        reviewing: pendingReviews,
        running,
        urgent: unassigned
      },
      activeOperators: activeOperators.length,
      metrics: [
        {
          label: "Pending reviews",
          value: String(pendingReviews),
          detail: "Submitted campaigns in review",
          tone: "info"
        },
        {
          label: "Launch prep",
          value: String(launchPreparation),
          detail: "Approved, assigned, creative, and launch work",
          tone: "warning"
        },
        {
          label: "Budget alerts",
          value: String(budgetAlerts),
          detail: "Campaigns near spend allocation",
          tone: budgetAlerts > 0 ? "warning" : "neutral"
        },
        {
          label: "Reporting queue",
          value: String(reports.length),
          detail: "Daily, weekly, and final reports",
          tone: "info"
        }
      ],
      queue: adminCampaigns,
      reports: reports.map((report: any) => this.toAdminReport(report)),
      activity: activity.map((item: any) => this.toAdminActivity(item))
    };
  }

  async listAdminCampaigns(context: AuthenticatedRequestContext | undefined, query: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "admin:access");
    const where: Record<string, any> = { workspaceId: scope.workspaceId, deletedAt: null };
    if (query.status) {
      where.status = normalizeCampaignStatus(query.status);
    }
    if (query.q) {
      where.OR = [
        { name: { contains: String(query.q), mode: "insensitive" } },
        { brief: { contains: String(query.q), mode: "insensitive" } }
      ];
    }

    const campaigns = await this.db.campaign.findMany({
      where,
      include: campaignInclude,
      orderBy: { updatedAt: "desc" },
      take: Math.min(Number(query.limit ?? 50), 100)
    });

    return campaigns.map((campaign: any) => this.toAdminCampaign(campaign));
  }

  async listAdminReports(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "admin:access");
    const reports = await this.db.campaignReport.findMany({
      where: { campaign: { workspaceId: scope.workspaceId }, deletedAt: null },
      include: { campaign: true },
      orderBy: { updatedAt: "desc" },
      take: 100
    });

    return reports.map((report: any) => this.toAdminReport(report));
  }

  async listAdminActivity(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    await this.assertCampaignPermission(this.db, scope, "admin:access");
    const activity = await this.db.auditLog.findMany({
      where: { workspaceId: scope.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return activity.map((item: any) => this.toAdminActivity(item));
  }

  /**
   * Stays live as a direct admin override rather than being deprecated in favor of the unified
   * Approvals Queue (POST /approvals/:id/decide) -- deprecating a working admin flow is riskier
   * than keeping both entry points in sync. When this lands the campaign on APPROVED or REJECTED
   * (the two terminal decisions the queue cares about), it syncs any still-PENDING ApprovalRequest
   * for the campaign so the queue doesn't show a stale row.
   */
  async updateAdminStatus(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermissions(this.db, scope, ["admin:access", "campaign:approve"]);
    const status = normalizeCampaignStatus(input.status);
    const result = await this.changeCampaignStatus(scope, campaignId, status, input.reason, true);

    if (status === "APPROVED" || status === "REJECTED") {
      await this.approvals?.syncExternalDecision({
        entityType: "ads",
        entityId: campaignId,
        approve: status === "APPROVED",
        decidedByUserId: scope.userId,
        note: input.reason
      });
    }

    return result;
  }

  async updateAssignment(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermissions(this.db, scope, ["admin:access", "campaign:manage"]);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const assigneeUserId = String(input.assignedToUserId ?? input.assigneeUserId ?? scope.userId);

    return this.db.$transaction(async (tx: DbClient) => {
      await tx.campaignAssignment.updateMany({
        where: { campaignId, role: input.role ?? "OPERATOR", status: "ACTIVE" },
        data: { status: "CANCELLED", completedAt: now() }
      });
      const assignment = await tx.campaignAssignment.create({
        data: {
          campaignId,
          assigneeUserId,
          assignerUserId: scope.userId,
          role: input.role ?? "OPERATOR",
          dueAt: input.dueAt ? new Date(String(input.dueAt)) : undefined,
          metadata: { priority: input.priority ?? "NORMAL" }
        }
      });
      await this.audit(tx, scope, "campaign.assignment.updated", "Campaign", campaignId, { assigneeUserId });
      return assignment;
    });
  }

  async createManualPlacement(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermissions(this.db, scope, ["admin:access", "campaign:manage"]);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const metadata = normalizeJsonObject(input.metadata) as Record<string, any>;
    const adAccountId = requiredString(
      input.adAccountId ?? input.adAccount ?? metadata.adAccountId,
      "Ad account is required before saving a placement."
    );
    const placementUrl = requiredString(
      input.placementUrl ?? input.adUrl ?? input.url ?? input.destinationUrl,
      "Placement URL is required before saving a placement."
    );
    assertHttpUrl(placementUrl, "Placement URL must be a valid http or https URL.");
    const launchDate = parseDateInput(
      input.launchDate ?? input.launchedAt ?? input.startsAt,
      "Launch date is required before saving a placement."
    );
    const notes = requiredString(
      input.notes ?? metadata.notes,
      "Placement notes are required before saving a placement."
    );
    const spendMinor = parseSpendMinor(input, true);

    this.assertSpendWithinAllocation(campaign, spendMinor);

    return this.db.$transaction(async (tx: DbClient) => {
      const placement = await tx.manualAdPlacement.create({
        data: {
          campaignId,
          creativeId: input.creativeId,
          assignedUserId: input.assignedUserId ?? scope.userId,
          channel: normalizeManualPlacementChannel(input.channel ?? input.platform ?? input.provider),
          provider: input.provider ?? input.platform ?? input.channel,
          externalPlacementId: input.externalPlacementId ?? input.campaignExternalId,
          destinationUrl: placementUrl,
          status: input.status ?? "LAUNCHED",
          budgetMinor: Number(input.budgetMinor ?? campaign.budgetMinor),
          spendMinor,
          currency: input.currency ?? campaign.currency ?? "NGN",
          startsAt: launchDate,
          impressions: Number(input.impressions ?? 0),
          clicks: Number(input.clicks ?? 0),
          conversions: Number(input.conversions ?? 0),
          metadata: {
            ...metadata,
            adAccountId,
            adSetId: input.adSetId ?? metadata.adSetId,
            clientVisible: Boolean(input.clientVisible ?? metadata.clientVisible),
            launchNotes: notes,
            placementUrl
          }
        }
      });

      if (spendMinor > 0) {
        const spendEntry = await tx.campaignSpendEntry.create({
          data: {
            campaignId,
            placementId: placement.id,
            actorUserId: scope.userId,
            amountMinor: spendMinor,
            currency: input.currency ?? campaign.currency ?? "NGN",
            source: "AD_PLACEMENT",
            notes,
            recordedForDate: launchDate,
            metadata: { adAccountId, placementUrl }
          }
        });
        await this.createCampaignLedgerEntry(tx, scope, campaignId, {
          amountMinor: spendMinor,
          campaignSpendEntryId: spendEntry.id,
          category: campaignLedgerCategory("AD_SPEND"),
          currency: input.currency ?? campaign.currency ?? "NGN",
          description: "Ad placement spend recorded",
          direction: "DEBIT",
          idempotencyKey: `campaign-ledger:placement:${placement.id}:spend`,
          metadata: { adAccountId, placementUrl },
          notes,
          occurredAt: spendEntry.recordedForDate ?? launchDate,
          sourceId: spendEntry.id,
          sourceType: "CampaignSpendEntry",
          type: "AD_SPEND"
        });
      }

      await this.audit(tx, scope, "campaign.manual_placement.created", "ManualAdPlacement", placement.id, {
        adAccountId,
        campaignId,
        placementUrl,
        spendMinor
      });
      return placement;
    });
  }

  async addManualMetric(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermissions(this.db, scope, ["admin:access", "campaign:manage"]);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const amountMinor = parseSpendMinor(input);
    this.assertSpendWithinAllocation(campaign, amountMinor);
    const ledgerType = normalizeCampaignLedgerEntryType(input.category ?? input.type ?? "AD_SPEND");
    return this.db.$transaction(async (tx: DbClient) => {
      const entry = await tx.campaignSpendEntry.create({
        data: {
          campaignId,
          placementId: input.placementId,
          actorUserId: scope.userId,
          amountMinor,
          currency: input.currency ?? campaign.currency ?? "NGN",
          source: input.source ?? "MANUAL",
          notes: input.notes,
          recordedForDate: input.recordedForDate ? new Date(String(input.recordedForDate)) : now(),
          metadata: {
            impressions: Number(input.impressions ?? 0),
            clicks: Number(input.clicks ?? 0),
            conversions: Number(input.conversions ?? 0),
            metricName: input.metricName,
            value: input.value
          }
        }
      });
      await tx.analyticsMetric.create({
        data: {
          workspaceId: scope.workspaceId,
          campaignId,
          name: input.metricName ?? "manual_spend",
          value: Number(input.value ?? input.spendMinor ?? input.amountMinor ?? 0),
          dimensions: { source: "manual" }
        }
      });
      if (amountMinor > 0) {
        await this.createCampaignLedgerEntry(tx, scope, campaignId, {
          amountMinor,
          campaignSpendEntryId: entry.id,
          category: campaignLedgerCategory(ledgerType),
          currency: input.currency ?? campaign.currency ?? "NGN",
          description: input.description ?? campaignLedgerCategory(ledgerType),
          direction: "DEBIT",
          idempotencyKey: `campaign-ledger:spend:${entry.id}:${ledgerType}`,
          metadata: {
            impressions: Number(input.impressions ?? 0),
            clicks: Number(input.clicks ?? 0),
            conversions: Number(input.conversions ?? 0),
            metricName: input.metricName,
            value: input.value
          },
          notes: input.notes,
          occurredAt: entry.recordedForDate ?? now(),
          sourceId: entry.id,
          sourceType: "CampaignSpendEntry",
          type: ledgerType
        });
      }

      return entry;
    });
  }

  async createReport(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermissions(this.db, scope, ["admin:access", "campaign:manage"]);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    this.assertCampaignLaunchedForReporting(campaign);
    const reportType = normalizeReportType(input.reportType ?? input.type);
    const periodEnd = input.periodEnd ? new Date(String(input.periodEnd)) : now();
    const defaultPeriodDays = reportType === "daily_update" ? 1 : 7;
    const periodStart = input.periodStart ? new Date(String(input.periodStart)) : new Date(periodEnd.getTime() - defaultPeriodDays * 24 * 60 * 60 * 1000);

    return this.db.campaignReport.create({
      data: {
        campaignId,
        placementId: input.placementId,
        generatedByUserId: scope.userId,
        periodStart,
        periodEnd,
        status: "DRAFT",
        summary: input.summary,
        spendMinor: Number(input.spendMinor ?? 0),
        revenueMinor: input.revenueMinor === undefined ? undefined : Number(input.revenueMinor),
        currency: input.currency ?? campaign.currency ?? "NGN",
        impressions: Number(input.impressions ?? 0),
        clicks: Number(input.clicks ?? 0),
        conversions: Number(input.conversions ?? 0),
        metrics: { ...normalizeJsonObject(input.metrics), reportType },
        screenshots:
          Array.isArray(input.assetIds) && input.assetIds.length > 0
            ? { create: input.assetIds.map((assetId: string) => ({ mediaAssetId: assetId })) }
            : undefined
      },
      include: { screenshots: { include: { mediaAsset: true } } }
    });
  }

  async publishReport(context: AuthenticatedRequestContext | undefined, reportId: string) {
    const scope = requireScope(context);
    await this.assertCampaignPermissions(this.db, scope, ["admin:access", "campaign:approve"]);
    const report = await this.db.campaignReport.findFirst({
      where: { id: reportId, campaign: { workspaceId: scope.workspaceId } },
      include: { campaign: { include: campaignInclude } }
    });
    if (!report) {
      throw new NotFoundException("Campaign report was not found in the active workspace.");
    }
    this.assertCampaignLaunchedForReporting(report.campaign);
    if (!report.summary || String(report.summary).trim().length === 0) {
      throw new BadRequestException("Report summary is required before publishing.");
    }

    const published = await this.db.campaignReport.update({
      where: { id: report.id },
      data: { status: "PUBLISHED", publishedAt: now() },
      include: { screenshots: { include: { mediaAsset: true } } }
    });
    await this.notifications.send({
      workspaceId: scope.workspaceId,
      channels: ["IN_APP"],
      content: {
        title: "Campaign report published",
        body: "A campaign performance report is ready to view."
      },
      entityType: "CampaignReport",
      entityId: report.id,
      actionUrl: `/campaigns/${report.campaignId}/reports`,
      idempotencyKey: `report:${report.id}:published`
    });
    return published;
  }

  async bulkAdminAction(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.assertCampaignPermissions(this.db, scope, ["admin:access", "campaign:manage"]);
    const campaignIds = Array.isArray(input.campaignIds) ? input.campaignIds.slice(0, 100) : [];
    const results = [];

    for (const campaignId of campaignIds) {
      if (input.action === "status") {
        results.push(await this.updateAdminStatus(scope, campaignId, input.payload ?? {}));
      } else if (input.action === "assign") {
        results.push(await this.updateAssignment(scope, campaignId, input.payload ?? {}));
      } else if (input.action === "add_note") {
        results.push(await this.addCampaignNote(scope, campaignId, input.payload ?? {}, true));
      }
    }

    return { count: results.length, results };
  }

  async listNotifications(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    return this.db.notification.findMany({
      where: {
        workspaceId: scope.workspaceId,
        OR: [{ recipientUserId: null }, { recipientUserId: scope.userId }]
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async markNotificationRead(context: AuthenticatedRequestContext | undefined, notificationId: string) {
    const scope = requireScope(context);
    const notification = await this.db.notification.findFirst({
      where: { id: notificationId, workspaceId: scope.workspaceId }
    });
    if (!notification) {
      throw new NotFoundException("Notification was not found in the active workspace.");
    }

    return this.db.notification.update({ where: { id: notification.id }, data: { readAt: now() } });
  }

  async markAllNotificationsRead(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    await this.db.notification.updateMany({
      where: { workspaceId: scope.workspaceId, OR: [{ recipientUserId: null }, { recipientUserId: scope.userId }] },
      data: { readAt: now() }
    });
    return { ok: true };
  }

  async listNotificationPreferences(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    return this.db.notificationPreference.findMany({
      where: { workspaceId: scope.workspaceId, userId: scope.userId },
      orderBy: { eventName: "asc" }
    });
  }

  async upsertNotificationPreference(
    context: AuthenticatedRequestContext | undefined,
    eventName: string,
    input: { inApp?: boolean; email?: boolean; sms?: boolean; whatsapp?: boolean }
  ) {
    const scope = requireScope(context);
    const trimmedEventName = eventName.trim();
    if (!trimmedEventName) {
      throw new BadRequestException("A notification event name is required.");
    }

    return this.db.notificationPreference.upsert({
      where: {
        workspaceId_userId_eventName: {
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          eventName: trimmedEventName
        }
      },
      create: {
        workspaceId: scope.workspaceId,
        userId: scope.userId,
        eventName: trimmedEventName,
        inApp: input.inApp ?? true,
        email: input.email ?? true,
        sms: input.sms ?? true,
        whatsapp: input.whatsapp ?? false
      },
      update: {
        ...(input.inApp === undefined ? {} : { inApp: input.inApp }),
        ...(input.email === undefined ? {} : { email: input.email }),
        ...(input.sms === undefined ? {} : { sms: input.sms }),
        ...(input.whatsapp === undefined ? {} : { whatsapp: input.whatsapp })
      }
    });
  }

  async listMediaAssets(context: AuthenticatedRequestContext | undefined, query: { kind?: string } = {}) {
    const scope = requireScope(context);
    return this.db.mediaAsset.findMany({
      where: {
        workspaceId: scope.workspaceId,
        deletedAt: null,
        status: { in: ["UPLOADED", "READY"] },
        ...(query.kind ? { kind: query.kind as any } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  private async assertCampaignPermission(tx: DbClient, scope: AuthenticatedRequestContext, permission: Permission) {
    await this.assertCampaignPermissions(tx, scope, [permission]);
  }

  private async assertCampaignPermissions(tx: DbClient, scope: AuthenticatedRequestContext, permissions: Permission[]) {
    const workspace = await tx.workspace.findFirst({
      where: { id: scope.workspaceId, deletedAt: null },
      select: { organizationId: true }
    });
    if (!workspace) {
      throw new ForbiddenException("Workspace membership could not be verified.");
    }

    const membership = await tx.teamMember.findFirst({
      where: { userId: scope.userId, organizationId: workspace.organizationId, deletedAt: null },
      select: { role: true, permissions: true }
    });

    // admin:access is resolved fresh from the User table, never from the
    // TeamMember role/permissions above — see hasPermission in packages/auth.
    let isPlatformAdmin = Boolean(scope.isPlatformAdmin);
    if (permissions.includes("admin:access")) {
      const user = await tx.user.findFirst({
        where: { id: scope.userId },
        select: { isPlatformAdmin: true }
      });
      isPlatformAdmin = Boolean(user?.isPlatformAdmin);
    }

    const missingPermission = permissions.find(
      (permission) => !membership || !hasPermission({ ...membership, isPlatformAdmin }, permission)
    );
    if (missingPermission) {
      throw new ForbiddenException(`Missing required permission: ${missingPermission}.`);
    }
  }

  private assertStatusAllowed(status: string, allowed: Set<string>, message: string) {
    if (!allowed.has(status)) {
      throw new BadRequestException(message);
    }
  }

  private activeOperatorAssignment(campaign: any) {
    return (campaign.assignments ?? []).find(
      (assignment: any) => assignment.status === "ACTIVE" && assignment.role === "OPERATOR"
    );
  }

  private assignedOperatorUserIds(campaign: any): string[] {
    return Array.from(
      new Set(
        (campaign.assignments ?? [])
          .filter((assignment: any) => assignment.status === "ACTIVE" && assignment.role === "OPERATOR")
          .map((assignment: any) => assignment.assigneeUserId)
          .filter((assigneeUserId: unknown): assigneeUserId is string => typeof assigneeUserId === "string")
      )
    );
  }

  private async applyClientStatusControl(
    scope: AuthenticatedRequestContext,
    campaign: any,
    input: {
      action: string;
      auditAction: string;
      eventName: string;
      nextStatus: string;
      notificationBody: string;
      notificationTitle: string;
      reason: string;
    }
  ) {
    return this.db.$transaction(async (tx: DbClient) => {
      const updated = await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          status: input.nextStatus,
          cancelledAt: input.nextStatus === "CANCELLED" ? now() : undefined
        },
        include: campaignInclude
      });
      await tx.campaignStatusHistory.create({
        data: {
          campaignId: campaign.id,
          fromStatus: campaign.status,
          toStatus: input.nextStatus,
          actorUserId: scope.userId,
          actorType: "USER",
          reason: input.reason,
          metadata: {
            clientControlAction: input.action,
            previousValue: campaign.status,
            newValue: input.nextStatus
          }
        }
      });
      if (input.action === "request_changes") {
        await tx.campaignNote.create({
          data: {
            campaignId: campaign.id,
            authorUserId: scope.userId,
            visibility: "CLIENT_VISIBLE",
            body: input.reason,
            metadata: { source: "client_control", action: input.action }
          }
        });
      }
      await this.audit(tx, scope, input.auditAction, "Campaign", campaign.id, {
        action: input.action,
        previousStatus: campaign.status,
        previousValue: campaign.status,
        newStatus: input.nextStatus,
        newValue: input.nextStatus,
        reason: input.reason
      });
      await this.event(tx, scope.workspaceId, input.eventName, "Campaign", campaign.id, {
        action: input.action,
        actorUserId: scope.userId,
        campaignId: campaign.id,
        previousStatus: campaign.status,
        newStatus: input.nextStatus
      });
      await this.notifyAssignedOperators(tx, scope.workspaceId, updated, input.notificationTitle, input.notificationBody, {
        eventName: input.eventName,
        idempotencyKey: `campaign-control:${campaign.id}:${input.action}:${campaign.status}:${input.nextStatus}:${updated.updatedAt?.getTime?.() ?? Date.now()}`,
        metadata: {
          action: input.action,
          actorUserId: scope.userId,
          previousStatus: campaign.status,
          newStatus: input.nextStatus
        },
        priority: input.action === "stop" ? "urgent" : "high"
      });

      return this.toCampaign(updated);
    });
  }

  private async applyClientBudgetControl(
    scope: AuthenticatedRequestContext,
    campaign: any,
    action: "increase_budget" | "decrease_budget",
    input: Record<string, any>
  ) {
    if (terminalCampaignStatuses.has(campaign.status)) {
      throw new BadRequestException("Budget cannot be modified after a campaign reaches a terminal status.");
    }

    const previousBudgetMinor = Number(campaign.budgetMinor ?? 0);
    const explicitNewBudget = input.newBudgetMinor ?? input.budgetMinor ?? input.totalMinor;
    const deltaSource = input.deltaMinor ?? input.amountMinor ?? input.amount;
    let newBudgetMinor: number;

    if (explicitNewBudget !== undefined && explicitNewBudget !== null && explicitNewBudget !== "") {
      newBudgetMinor = parseMinorAmount(explicitNewBudget, "Campaign budget must be a non-negative amount.");
      if (action === "increase_budget" && newBudgetMinor <= previousBudgetMinor) {
        throw new BadRequestException("Increased budget must be greater than the current budget.");
      }
      if (action === "decrease_budget" && newBudgetMinor >= previousBudgetMinor) {
        throw new BadRequestException("Decreased budget must be less than the current budget.");
      }
    } else {
      const deltaMinor = parseMinorAmount(deltaSource, "Budget change amount must be a non-negative amount.");
      if (deltaMinor <= 0) {
        throw new BadRequestException("Budget change amount must be greater than zero.");
      }
      newBudgetMinor = action === "increase_budget" ? previousBudgetMinor + deltaMinor : previousBudgetMinor - deltaMinor;
    }

    const recordedSpendMinor = this.totalRecordedSpendMinor(campaign);
    if (newBudgetMinor <= 0) {
      throw new BadRequestException("Campaign budget must remain greater than zero.");
    }
    if (action === "decrease_budget" && newBudgetMinor < recordedSpendMinor) {
      throw new BadRequestException("Campaign budget cannot be reduced below recorded spend.");
    }

    const reason = String(input.reason ?? input.note ?? "Client modified campaign budget.");
    const eventName = "CampaignBudgetModified";
    const notificationTitle =
      action === "increase_budget" ? "Campaign budget increased" : "Campaign budget decreased";

    return this.db.$transaction(async (tx: DbClient) => {
      const updated = await tx.campaign.update({
        where: { id: campaign.id },
        data: { budgetMinor: newBudgetMinor },
        include: campaignInclude
      });
      await this.audit(tx, scope, `campaign.client_control.${action}`, "Campaign", campaign.id, {
        action,
        previousBudgetMinor,
        previousValue: previousBudgetMinor,
        newBudgetMinor,
        newValue: newBudgetMinor,
        recordedSpendMinor,
        reason
      });
      await this.event(tx, scope.workspaceId, eventName, "Campaign", campaign.id, {
        action,
        actorUserId: scope.userId,
        campaignId: campaign.id,
        previousBudgetMinor,
        newBudgetMinor
      });
      await this.notifyAssignedOperators(
        tx,
        scope.workspaceId,
        updated,
        notificationTitle,
        `${scope.userName ?? "A client"} changed ${campaign.name} from ${previousBudgetMinor} to ${newBudgetMinor} minor units.`,
        {
          eventName,
          idempotencyKey: `campaign-control:${campaign.id}:${action}:${previousBudgetMinor}:${newBudgetMinor}`,
          metadata: { action, actorUserId: scope.userId, previousBudgetMinor, newBudgetMinor },
          priority: "high"
        }
      );

      return this.toCampaign(updated);
    });
  }

  private async notifyAssignedOperators(
    tx: DbClient,
    workspaceId: string,
    campaign: any,
    title: string,
    body: string,
    input: Record<string, any>
  ) {
    const operatorIds = this.assignedOperatorUserIds(campaign);
    const recipients = operatorIds.length > 0 ? operatorIds : [undefined];
    const notificationBaseKey = String(input.idempotencyKey ?? `campaign-control:${campaign.id}:${title}`);

    for (const recipientUserId of recipients) {
      await this.notify(tx, workspaceId, title, body, {
        actionUrl: `/campaign-ops/detail?campaignId=${campaign.id}`,
        category: "campaign_ops",
        entityId: campaign.id,
        entityType: "Campaign",
        idempotencyKey: recipientUserId
          ? `${notificationBaseKey}:operator:${recipientUserId}`
          : `${notificationBaseKey}:operator-broadcast`,
        metadata: input.metadata,
        priority: input.priority ?? "normal",
        recipientUserId
      });
    }
  }

  private async findCampaignFinancialRecord(workspaceId: string, campaignId: string) {
    const campaign = await this.db.campaign.findFirst({
      where: { id: campaignId, workspaceId, deletedAt: null },
      include: {
        ...campaignInclude,
        ledgerEntries: {
          where: { deletedAt: null },
          include: { actor: true },
          orderBy: { occurredAt: "desc" }
        },
        paymentIntents: { orderBy: { createdAt: "desc" } },
        spendEntries: { orderBy: { recordedForDate: "desc" } }
      }
    });
    if (!campaign) {
      throw new NotFoundException("Campaign was not found in the active workspace.");
    }

    return campaign;
  }

  private toCampaignLedgerEntry(input: {
    actorUserId?: string | null;
    amountMinor: number;
    campaignId: string;
    category?: string;
    createdAt?: Date | string | null;
    currency?: string | null;
    description: string;
    direction?: unknown;
    id: string;
    metadata?: Record<string, any>;
    occurredAt?: Date | string | null;
    sourceId?: string | null;
    sourceType?: string | null;
    type: unknown;
    updatedAt?: Date | string | null;
    workspaceId: string;
    walletId?: string | null;
    walletLedgerEntryId?: string | null;
    paymentIntentId?: string | null;
    campaignInvoiceId?: string | null;
    campaignBudgetHoldId?: string | null;
    campaignSpendEntryId?: string | null;
    campaignReportId?: string | null;
  }): CampaignLedgerEntry {
    const type = normalizeCampaignLedgerEntryType(input.type);
    const direction = normalizeCampaignLedgerDirection(input.direction, type);
    const occurredAt = iso(input.occurredAt) ?? new Date().toISOString();

    return {
      id: input.id,
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      type,
      direction,
      amount: money(input.amountMinor, input.currency ?? undefined),
      category: input.category ?? campaignLedgerCategory(type),
      description: input.description,
      occurredAt,
      ...(input.actorUserId === undefined ? {} : { actorUserId: input.actorUserId }),
      ...(input.walletId === undefined ? {} : { walletId: input.walletId }),
      ...(input.walletLedgerEntryId === undefined ? {} : { walletLedgerEntryId: input.walletLedgerEntryId }),
      ...(input.paymentIntentId === undefined ? {} : { paymentIntentId: input.paymentIntentId }),
      ...(input.campaignInvoiceId === undefined ? {} : { campaignInvoiceId: input.campaignInvoiceId }),
      ...(input.campaignBudgetHoldId === undefined ? {} : { campaignBudgetHoldId: input.campaignBudgetHoldId }),
      ...(input.campaignSpendEntryId === undefined ? {} : { campaignSpendEntryId: input.campaignSpendEntryId }),
      ...(input.campaignReportId === undefined ? {} : { campaignReportId: input.campaignReportId }),
      ...(input.sourceType === undefined ? {} : { sourceType: input.sourceType }),
      ...(input.sourceId === undefined ? {} : { sourceId: input.sourceId }),
      metadata: input.metadata ?? {},
      createdAt: iso(input.createdAt) ?? occurredAt,
      updatedAt: iso(input.updatedAt) ?? occurredAt
    };
  }

  private buildCampaignLedger(campaign: any): CampaignLedgerEntry[] {
    const entries: CampaignLedgerEntry[] = [];
    const seen = new Set<string>();
    const push = (entry: CampaignLedgerEntry) => {
      const key = entrySourceKey(entry);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      entries.push(entry);
    };

    for (const entry of campaign.ledgerEntries ?? []) {
      push(
        this.toCampaignLedgerEntry({
          actorUserId: entry.actorUserId,
          amountMinor: entry.amountMinor,
          campaignBudgetHoldId: entry.campaignBudgetHoldId,
          campaignId: entry.campaignId,
          campaignInvoiceId: entry.campaignInvoiceId,
          campaignReportId: entry.campaignReportId,
          campaignSpendEntryId: entry.campaignSpendEntryId,
          category: entry.category,
          createdAt: entry.createdAt,
          currency: entry.currency,
          description: entry.description,
          direction: entry.direction,
          id: entry.id,
          metadata: entry.metadata ?? {},
          occurredAt: entry.occurredAt,
          paymentIntentId: entry.paymentIntentId,
          sourceId: entry.sourceId ?? entry.id,
          sourceType: entry.sourceType ?? "CampaignLedgerEntry",
          type: entry.type,
          updatedAt: entry.updatedAt,
          walletId: entry.walletId,
          walletLedgerEntryId: entry.walletLedgerEntryId,
          workspaceId: entry.workspaceId
        })
      );
    }

    for (const intent of campaign.paymentIntents ?? []) {
      if (intent.status !== "COMPLETED" || !intent.creditedAt || !intent.campaignId) {
        continue;
      }
      push(
        this.toCampaignLedgerEntry({
          amountMinor: intent.amountMinor,
          campaignId: campaign.id,
          createdAt: intent.createdAt,
          currency: intent.currency ?? campaign.currency,
          description: "Payment credited to wallet",
          direction: "CREDIT",
          id: `payment_${intent.id}_wallet_funding`,
          occurredAt: intent.creditedAt ?? intent.completedAt ?? intent.updatedAt,
          paymentIntentId: intent.id,
          sourceId: intent.id,
          sourceType: "PaymentIntent",
          type: "WALLET_FUNDING",
          updatedAt: intent.updatedAt,
          walletId: intent.walletId,
          workspaceId: campaign.workspaceId
        })
      );
    }

    for (const invoice of campaign.invoices ?? []) {
      if (Number(invoice.amountPaidMinor ?? 0) <= 0) {
        continue;
      }
      push(
        this.toCampaignLedgerEntry({
          amountMinor: invoice.amountPaidMinor,
          campaignId: campaign.id,
          campaignInvoiceId: invoice.id,
          createdAt: invoice.paidAt ?? invoice.updatedAt,
          currency: invoice.currency ?? campaign.currency,
          description: `Invoice ${invoice.number ?? invoice.id} paid`,
          direction: "DEBIT",
          id: `invoice_${invoice.id}`,
          occurredAt: invoice.paidAt ?? invoice.updatedAt,
          sourceId: invoice.id,
          sourceType: "CampaignInvoice",
          type: "INVOICE_PAYMENT",
          updatedAt: invoice.updatedAt,
          workspaceId: campaign.workspaceId
        })
      );
    }

    for (const hold of campaign.budgetHolds ?? []) {
      const released = ["RELEASED", "CANCELLED", "EXPIRED"].includes(hold.status);
      push(
        this.toCampaignLedgerEntry({
          actorUserId: hold.createdByUserId,
          amountMinor: hold.amountMinor,
          campaignBudgetHoldId: hold.id,
          campaignId: campaign.id,
          createdAt: hold.createdAt,
          currency: hold.currency ?? campaign.currency,
          description: released ? "Campaign budget released" : "Campaign budget allocated",
          direction: released ? "RELEASE" : "HOLD",
          id: `hold_${hold.id}_${released ? "release" : "allocation"}`,
          occurredAt: released ? hold.releasedAt ?? hold.updatedAt : hold.createdAt,
          sourceId: hold.id,
          sourceType: "CampaignBudgetHold",
          type: released ? "REFUND" : "BUDGET_ALLOCATION",
          updatedAt: hold.updatedAt,
          walletId: hold.walletId,
          walletLedgerEntryId: released ? hold.releaseLedgerEntryId : hold.holdLedgerEntryId,
          workspaceId: campaign.workspaceId
        })
      );
    }

    for (const spend of campaign.spendEntries ?? []) {
      const metadata = normalizeJsonObject(spend.metadata) as Record<string, any>;
      const ledgerType = normalizeCampaignLedgerEntryType(metadata.category ?? metadata.type ?? "AD_SPEND");
      push(
        this.toCampaignLedgerEntry({
          actorUserId: spend.actorUserId,
          amountMinor: spend.amountMinor,
          campaignId: campaign.id,
          campaignSpendEntryId: spend.id,
          createdAt: spend.createdAt,
          currency: spend.currency ?? campaign.currency,
          description: spend.notes ?? "Campaign spend recorded",
          direction: "DEBIT",
          id: `spend_${spend.id}`,
          metadata,
          occurredAt: spend.recordedForDate ?? spend.createdAt,
          sourceId: spend.id,
          sourceType: "CampaignSpendEntry",
          type: ledgerType,
          updatedAt: spend.updatedAt,
          workspaceId: campaign.workspaceId
        })
      );
    }

    if ((campaign.spendEntries ?? []).length === 0) {
      for (const report of campaign.reports ?? []) {
        if (Number(report.spendMinor ?? 0) <= 0) {
          continue;
        }
        push(
          this.toCampaignLedgerEntry({
            amountMinor: report.spendMinor,
            campaignId: campaign.id,
            campaignReportId: report.id,
            createdAt: report.createdAt,
            currency: report.currency ?? campaign.currency,
            description: `${(normalizeJsonObject(report.metrics) as Record<string, any>).reportType ?? "Report"} spend`,
            direction: "DEBIT",
            id: `report_spend_${report.id}`,
            occurredAt: report.periodEnd ?? report.createdAt,
            sourceId: report.id,
            sourceType: "CampaignReport",
            type: "AD_SPEND",
            updatedAt: report.updatedAt,
            workspaceId: campaign.workspaceId
          })
        );
      }
    }

    return entries.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }

  private sumLedger(
    ledger: CampaignLedgerEntry[],
    predicate: (entry: CampaignLedgerEntry) => boolean
  ) {
    return ledger.reduce((total, entry) => (predicate(entry) ? total + entry.amount.amountMinor : total), 0);
  }

  private buildCampaignBudgetSummary(campaign: any, ledger: CampaignLedgerEntry[]): CampaignBudgetSummary {
    const currency = getCurrency(campaign.currency, "NGN");
    const totalBudgetMinor = Math.max(0, Number(campaign.budgetMinor ?? 0));
    const fundsUsedMinor = this.sumLedger(ledger, isDebitSpend);
    const allocatedBudgetMinor = this.sumLedger(
      ledger,
      (entry) => entry.type === "BUDGET_ALLOCATION" && entry.direction === "HOLD"
    );
    const refundedMinor = this.sumLedger(
      ledger,
      (entry) => entry.type === "REFUND" && (entry.direction === "RELEASE" || entry.direction === "CREDIT")
    );
    const byType = (type: CampaignLedgerEntryType) =>
      this.sumLedger(ledger, (entry) => entry.type === type && entry.direction === "DEBIT");

    return {
      campaignId: campaign.id,
      currency,
      totalBudget: money(totalBudgetMinor, currency),
      invoicePaid: money(
        this.sumLedger(ledger, (entry) => entry.type === "INVOICE_PAYMENT" && entry.direction === "DEBIT"),
        currency
      ),
      allocatedBudget: money(allocatedBudgetMinor, currency),
      fundsUsed: money(fundsUsedMinor, currency),
      remainingBalance: money(Math.max(0, totalBudgetMinor - fundsUsedMinor - refundedMinor), currency),
      pendingSpend: money(Math.max(0, allocatedBudgetMinor - fundsUsedMinor - refundedMinor), currency),
      refunded: money(refundedMinor, currency),
      adSpend: money(byType("AD_SPEND"), currency),
      creativeCosts: money(byType("CREATIVE_COST"), currency),
      agencyFees: money(byType("AGENCY_FEE"), currency),
      adjustments: money(byType("ADJUSTMENT"), currency),
      updatedAt: iso(campaign.updatedAt) ?? new Date().toISOString()
    };
  }

  private buildCampaignSpendBreakdown(campaign: any, ledger: CampaignLedgerEntry[]): CampaignSpendBreakdown {
    const currency = getCurrency(campaign.currency, "NGN");
    const spendEntries = ledger.filter(isDebitSpend);
    const totalSpendMinor = spendEntries.reduce((total, entry) => total + entry.amount.amountMinor, 0);
    const categories = Array.from(campaignSpendTypes).map((type) => {
      const amountMinor = spendEntries
        .filter((entry) => entry.type === type)
        .reduce((total, entry) => total + entry.amount.amountMinor, 0);

      return {
        type,
        label: campaignLedgerCategory(type),
        amount: money(amountMinor, currency),
        percentageBps: totalSpendMinor > 0 ? Math.round((amountMinor / totalSpendMinor) * 10000) : 0
      };
    });

    return {
      campaignId: campaign.id,
      currency,
      totalSpend: money(totalSpendMinor, currency),
      categories,
      timeline: spendEntries
        .slice()
        .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
        .map((entry) => ({
          date: entry.occurredAt,
          label: entry.description,
          type: entry.type,
          amount: entry.amount
        }))
    };
  }

  private toAuditTrailItem(kind: "audit" | "status", item: any) {
    if (kind === "status") {
      const metadata = normalizeJsonObject(item.metadata) as Record<string, unknown>;

      return {
        id: item.id,
        kind,
        action: "campaign.status.updated",
        actorUserId: item.actorUserId,
        actorType: item.actorType,
        timestamp: iso(item.createdAt),
        previousValue: item.fromStatus ?? metadata.previousValue ?? null,
        newValue: item.toStatus ?? metadata.newValue ?? null,
        metadata: {
          ...metadata,
          reason: item.reason ?? null
        }
      };
    }

    const metadata = normalizeJsonObject(item.metadata) as Record<string, unknown>;

    return {
      id: item.id,
      kind,
      action: item.action,
      actorUserId: item.actorUserId,
      timestamp: iso(item.createdAt),
      previousValue:
        metadata.previousValue ?? metadata.previousStatus ?? metadata.previousBudgetMinor ?? null,
      newValue: metadata.newValue ?? metadata.newStatus ?? metadata.newBudgetMinor ?? null,
      metadata
    };
  }

  private totalRecordedSpendMinor(campaign: any) {
    const spendEntries = Array.isArray(campaign.spendEntries) ? campaign.spendEntries : [];
    const spendEntryPlacementIds = new Set(
      spendEntries
        .map((entry: any) => entry.placementId)
        .filter((placementId: unknown): placementId is string => typeof placementId === "string")
    );
    const ledgerSpendMinor = spendEntries.reduce(
      (total: number, entry: any) => total + Math.max(0, Number(entry.amountMinor ?? 0)),
      0
    );
    const legacyPlacementSpendMinor = (campaign.manualPlacements ?? []).reduce(
      (total: number, placement: any) =>
        placement.deletedAt || spendEntryPlacementIds.has(placement.id)
          ? total
          : total + Math.max(0, Number(placement.spendMinor ?? 0)),
      0
    );

    return ledgerSpendMinor + legacyPlacementSpendMinor;
  }

  private assertSpendWithinAllocation(campaign: any, additionalSpendMinor: number) {
    if (additionalSpendMinor <= 0) {
      return;
    }

    const budgetMinor = Number(campaign.budgetMinor ?? 0);
    const currentSpendMinor = this.totalRecordedSpendMinor(campaign);

    if (budgetMinor > 0 && currentSpendMinor + additionalSpendMinor > budgetMinor) {
      throw new BadRequestException("Recorded spend cannot exceed the campaign budget allocation.");
    }
  }

  private hasLaunchedPlacement(campaign: any) {
    return (campaign.manualPlacements ?? []).some(
      (placement: any) => placement.status === "LAUNCHED" && !placement.deletedAt
    );
  }

  private hasPublishedReport(campaign: any) {
    return (campaign.reports ?? []).some(
      (report: any) => report.status === "PUBLISHED" && !report.deletedAt
    );
  }

  private assertCampaignLaunchedForReporting(campaign: any) {
    if (launchedCampaignStatuses.has(campaign.status) || this.hasLaunchedPlacement(campaign)) {
      return;
    }

    throw new BadRequestException("Reports cannot be created or published before campaign launch.");
  }

  private assertAdminStatusGuardrails(campaign: any, status: string) {
    if ((status === "RUNNING" || status === "ACTIVE") && !this.hasLaunchedPlacement(campaign)) {
      throw new BadRequestException(
        "Campaigns cannot move into optimization until at least one launched placement is recorded."
      );
    }

    if (status === "COMPLETED" && !this.hasPublishedReport(campaign)) {
      throw new BadRequestException("Campaigns cannot be completed until a client report is published.");
    }
  }

  private async changeCampaignStatus(
    scope: AuthenticatedRequestContext,
    campaignId: string,
    status: string,
    reason?: string,
    admin = false
  ) {
    const existing = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    if (admin) {
      this.assertAdminStatusGuardrails(existing, status);
    }

    return this.db.$transaction(async (tx: DbClient) => {
      const campaign = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status,
          submittedAt: status === "PENDING_REVIEW" ? now() : undefined,
          approvedAt: status === "APPROVED" ? now() : undefined,
          approvedByUserId: status === "APPROVED" ? scope.userId : undefined,
          cancelledAt: status === "CANCELLED" ? now() : undefined
        },
        include: campaignInclude
      });
      await tx.campaignStatusHistory.create({
        data: {
          campaignId,
          fromStatus: existing.status,
          toStatus: status,
          actorUserId: scope.userId,
          actorType: admin ? "ADMIN" : "USER",
          reason
        }
      });
      if (status === "RUNNING" || status === "COMPLETED") {
        await tx.livePromotion
          .update({
            where: { campaignId },
            data: status === "RUNNING" ? { actualStartedAt: now() } : { actualEndedAt: now() }
          })
          .catch(() => undefined); // no-op unless this campaign has a LivePromotion row
      }
      await this.audit(tx, scope, "campaign.status.updated", "Campaign", campaignId, {
        fromStatus: existing.status,
        toStatus: status,
        reason: reason ?? null
      });
      await this.event(tx, scope.workspaceId, "CampaignStatusChanged", "Campaign", campaignId, {
        campaignId,
        fromStatus: existing.status,
        toStatus: status
      });
      await this.notify(tx, scope.workspaceId, `Campaign ${status.toLowerCase().replace(/_/g, " ")}`, reason ?? "Campaign status changed.", {
        entityType: "Campaign",
        entityId: campaignId,
        actionUrl: `/campaigns/${campaignId}`
      });
      return this.toCampaign(campaign);
    }).then(async (result: any) => {
      // Surfaces the campaign in the unified Approvals Queue (entityType "ads") the moment
      // it needs a decision. Fired outside the transaction since ApprovalsService uses its
      // own PrismaService client, not this transaction's `tx`. Best-effort: a failure here
      // must not roll back (or even fail) the status change itself.
      if (status === "PENDING_REVIEW" && this.approvals) {
        const alreadyPending = await this.db.approvalRequest
          .findFirst({ where: { entityType: "ads", entityId: campaignId, status: "PENDING" } })
          .catch(() => null);
        if (!alreadyPending) {
          await this.approvals
            .request({
              workspaceId: scope.workspaceId,
              action: "campaign.launch_review",
              entityType: "ads",
              entityId: campaignId,
              reason: reason ?? "Campaign submitted for launch review.",
              payload: { campaignId },
              requestedByUserId: scope.userId
            })
            .catch(() => undefined);
        }
      }
      return result;
    });
  }

  private async createCampaignLedgerEntry(
    tx: DbClient,
    scope: { workspaceId: string; userId?: string },
    campaignId: string,
    input: Record<string, any>
  ) {
    const type = normalizeCampaignLedgerEntryType(input.type);
    const direction = normalizeCampaignLedgerDirection(input.direction, type);
    const amountMinor = parseNonNegativeMinorAmount(
      input.amountMinor ?? input.amount?.amountMinor ?? 0,
      "Campaign ledger amount must be a non-negative minor-unit amount."
    );
    if (amountMinor <= 0) {
      return undefined;
    }
    const sourceType = input.sourceType ?? input.entityType;
    const sourceId = input.sourceId ?? input.entityId;
    const idempotencyKey =
      input.idempotencyKey ??
      `campaign-ledger:${campaignId}:${sourceType ?? type}:${sourceId ?? input.walletLedgerEntryId ?? type}:${direction}`;

    return tx.campaignLedgerEntry.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        workspaceId: scope.workspaceId,
        campaignId,
        walletId: input.walletId,
        walletLedgerEntryId: input.walletLedgerEntryId,
        paymentIntentId: input.paymentIntentId,
        campaignInvoiceId: input.campaignInvoiceId,
        campaignBudgetHoldId: input.campaignBudgetHoldId,
        campaignSpendEntryId: input.campaignSpendEntryId,
        campaignReportId: input.campaignReportId,
        actorUserId: input.actorUserId ?? scope.userId,
        type,
        direction,
        amountMinor,
        currency: input.currency ?? "NGN",
        category: input.category ?? campaignLedgerCategory(type),
        description: input.description ?? campaignLedgerCategory(type),
        notes: input.notes,
        occurredAt: input.occurredAt ?? now(),
        sourceType,
        sourceId,
        idempotencyKey,
        metadata: normalizeJsonObject(input.metadata)
      }
    });
  }

  private async completePaymentIntent(intentId: string, status: string, providerReference: string, scope?: AuthenticatedRequestContext) {
    return this.db.$transaction(async (tx: DbClient) => {
      await this.lockPaymentIntent(tx, intentId);
      const intent = await tx.paymentIntent.findUnique({ where: { id: intentId } });
      if (!intent) {
        throw new NotFoundException("Payment intent was not found.");
      }
      if (scope && intent.workspaceId !== scope.workspaceId) {
        throw new BadRequestException("Payment reference does not belong to the active workspace.");
      }
      if (intent.status === "COMPLETED" && intent.creditedAt) {
        return this.toPaymentIntent(intent);
      }

      let creditedAt = intent.creditedAt;
      const completedAt = status === "COMPLETED" ? now() : intent.completedAt;
      if (status === "COMPLETED" && !intent.creditedAt) {
        const paymentAmountMinor = parsePositiveMinorAmount(
          intent.amountMinor,
          "Payment intent amount must be positive before completion."
        );
        const wallet = intent.walletId
          ? await tx.wallet.findUnique({ where: { id: intent.walletId } })
          : await this.getOrCreateWallet(tx, intent.workspaceId, getCurrency(intent.currency, "NGN"));
        if (!wallet) {
          throw new NotFoundException("Payment intent wallet was not found.");
        }
        await this.lockWallet(tx, wallet.id);
        const creditLedger = await this.createWalletLedgerEntry(tx, {
          walletId: wallet.id,
          kind: "CREDIT",
          amountMinor: paymentAmountMinor,
          currency: intent.currency,
          reference: providerReference,
          description: "Payment credited to wallet",
          idempotencyKey: `payment:${intent.id}:credit`,
          sourceType: "PaymentIntent",
          sourceId: intent.id
        });
        creditedAt = now();
        let campaignIdForIntent = intent.campaignId;

        if (intent.campaignInvoiceId) {
          const invoice = await tx.campaignInvoice.findFirst({
            where: {
              id: intent.campaignInvoiceId,
              workspaceId: intent.workspaceId,
              deletedAt: null
            }
          });
          campaignIdForIntent = invoice?.campaignId ?? campaignIdForIntent;
          const amountDue = invoice ? Math.max(0, invoice.totalMinor - invoice.amountPaidMinor) : 0;
          const debitAmount = Math.min(paymentAmountMinor, amountDue);
          if (invoice && debitAmount > 0) {
            const invoiceDebit = await this.createWalletLedgerEntry(tx, {
              walletId: wallet.id,
              kind: "DEBIT",
              amountMinor: debitAmount,
              currency: intent.currency,
              reference: `invoice:${invoice.id}`,
              description: "Campaign invoice paid from payment",
              idempotencyKey: `payment:${intent.id}:invoice_debit`,
              sourceType: "CampaignInvoice",
              sourceId: invoice.id
            });
            const paidInvoice = await tx.campaignInvoice.update({
              where: { id: invoice.id },
              data: {
                amountPaidMinor: invoice.amountPaidMinor + debitAmount,
                status: invoice.amountPaidMinor + debitAmount >= invoice.totalMinor ? "PAID" : "PARTIALLY_PAID",
                paidAt: invoice.amountPaidMinor + debitAmount >= invoice.totalMinor ? now() : undefined
              }
            });
            await this.createCampaignLedgerEntry(tx, scope ?? { workspaceId: intent.workspaceId }, invoice.campaignId, {
              amountMinor: debitAmount,
              campaignInvoiceId: invoice.id,
              category: campaignLedgerCategory("INVOICE_PAYMENT"),
              currency: intent.currency,
              description: "Campaign invoice paid from payment",
              direction: "DEBIT",
              idempotencyKey: `campaign-ledger:payment:${intent.id}:invoice-payment`,
              occurredAt: paidInvoice.paidAt ?? completedAt,
              paymentIntentId: intent.id,
              sourceId: invoice.id,
              sourceType: "CampaignInvoice",
              type: "INVOICE_PAYMENT",
              walletId: wallet.id,
              walletLedgerEntryId: invoiceDebit.id
            });
          }
        }
        if (campaignIdForIntent) {
          await this.createCampaignLedgerEntry(tx, scope ?? { workspaceId: intent.workspaceId }, campaignIdForIntent, {
            amountMinor: paymentAmountMinor,
            category: campaignLedgerCategory("WALLET_FUNDING"),
            currency: intent.currency,
            description: "Payment credited to wallet",
            direction: "CREDIT",
            idempotencyKey: `campaign-ledger:payment:${intent.id}:wallet-funding`,
            occurredAt: creditedAt,
            paymentIntentId: intent.id,
            sourceId: intent.id,
            sourceType: "PaymentIntent",
            type: "WALLET_FUNDING",
            walletId: wallet.id,
            walletLedgerEntryId: creditLedger.id
          });
        }
        await this.assertWalletConsistency(tx, wallet.id);
      }

      const updated = await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status, providerReference, completedAt, creditedAt }
      });
      await this.event(tx, intent.workspaceId, "PaymentCompleted", "PaymentIntent", intent.id, {
        paymentIntentId: intent.id,
        status
      });
      return this.toPaymentIntent(updated);
    });
  }

  private async findCampaignOrThrow(tx: DbClient, workspaceId: string, campaignId: string) {
    const campaign = await tx.campaign.findFirst({
      where: { id: campaignId, workspaceId, deletedAt: null },
      include: campaignInclude
    });
    if (!campaign) {
      throw new NotFoundException("Campaign was not found in the active workspace.");
    }

    return campaign;
  }

  private async getOrCreateWallet(tx: DbClient, workspaceId: string, currency: string) {
    return tx.wallet.upsert({
      where: { workspaceId_currency: { workspaceId, currency } },
      update: {},
      create: { workspaceId, currency }
    });
  }

  private async lockWallet(tx: DbClient, walletId: string) {
    if (tx.$queryRaw) {
      await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${walletId} FOR UPDATE`;
    }
  }

  private async lockPaymentIntent(tx: DbClient, intentId: string) {
    if (tx.$queryRaw) {
      await tx.$queryRaw`SELECT id FROM "PaymentIntent" WHERE id = ${intentId} FOR UPDATE`;
    }
  }

  private async createWalletLedgerEntry(tx: DbClient, data: Record<string, any>) {
    const amountMinor = parsePositiveMinorAmount(
      data.amountMinor,
      "Wallet ledger entries must use a positive minor-unit amount."
    );
    const idempotencyKey = normalizeIdempotencyKey(data.idempotencyKey);
    const create = { ...data, amountMinor, idempotencyKey };

    if (idempotencyKey && tx.ledgerEntry.upsert) {
      return tx.ledgerEntry.upsert({
        where: { idempotencyKey },
        update: {},
        create
      });
    }

    return tx.ledgerEntry.create({ data: create });
  }

  private async assertWalletConsistency(tx: DbClient, walletId: string) {
    const entries = await tx.ledgerEntry.findMany({ where: { walletId } });
    const mappedEntries: LedgerEntry[] = entries.map(mapLedgerEntry);
    const negativeEntry = mappedEntries.find((entry) => entry.amount.amountMinor < 0);

    if (negativeEntry) {
      throw new BadRequestException("Wallet ledger contains a negative amount and cannot be mutated.");
    }

    const consistency = buildWalletConsistency(mappedEntries);
    if (!consistency.consistent) {
      throw new BadRequestException("Wallet ledger consistency check failed.");
    }

    return consistency;
  }

  private async assertWalletCanPay(tx: DbClient, walletId: string, amountMinor: number, currency: string) {
    parsePositiveMinorAmount(amountMinor, "Wallet debit amount must be positive.");
    const entries = await tx.ledgerEntry.findMany({ where: { walletId } });
    const balance = calculateAvailableBalance(entries.map(mapLedgerEntry));
    if (balance.currency !== currency || balance.amountMinor < amountMinor) {
      throw new BadRequestException("Insufficient wallet balance.");
    }
  }

  private async audit(tx: DbClient, scope: AuthenticatedRequestContext, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    await tx.auditLog.create({
      data: {
        workspaceId: scope.workspaceId,
        actorUserId: scope.userId,
        action,
        entityType,
        entityId,
        metadata
      }
    });
  }

  private async event(tx: DbClient, workspaceId: string | undefined, name: string, entityType: string, entityId: string, payload: Record<string, unknown>) {
    await tx.eventOutbox.upsert({
      where: { idempotencyKey: `${name}:${entityType}:${entityId}:${JSON.stringify(payload).slice(0, 80)}` },
      update: {},
      create: {
        workspaceId,
        name,
        entityType,
        entityId,
        payload,
        idempotencyKey: `${name}:${entityType}:${entityId}:${JSON.stringify(payload).slice(0, 80)}`
      }
    });
  }

  private async notify(tx: DbClient, workspaceId: string, title: string, body: string, input: Record<string, any>) {
    const idempotencyKey = input.idempotencyKey ?? `notification:${workspaceId}:${input.entityType}:${input.entityId}:${title}`;
    await tx.notification.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        workspaceId,
        recipientUserId: input.recipientUserId,
        channel: "IN_APP",
        category: input.category ?? "campaign",
        priority: input.priority ?? "normal",
        title,
        body,
        entityType: input.entityType,
        entityId: input.entityId,
        actionUrl: input.actionUrl,
        idempotencyKey,
        metadata: input.metadata ?? {},
        status: "DELIVERED",
        deliveredAt: now()
      }
    });
  }

  private createCloudinarySignedUpload(resourceType: string, publicId: string) {
    const cloudName = getSecret(process.env.CLOUDINARY_CLOUD_NAME);
    const apiKey = getSecret(process.env.CLOUDINARY_API_KEY);
    const apiSecret = getSecret(process.env.CLOUDINARY_API_SECRET);
    if (!cloudName || !apiKey || !apiSecret) {
      return undefined;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const uploadPreset =
      resourceType === "video"
        ? process.env.CLOUDINARY_VIDEO_UPLOAD_PRESET
        : process.env.CLOUDINARY_IMAGE_UPLOAD_PRESET ?? process.env.CLOUDINARY_UPLOAD_PRESET;
    const params: Record<string, string | number> = {
      public_id: publicId,
      timestamp
    };
    if (uploadPreset) {
      params.upload_preset = uploadPreset;
    }
    const signatureBase = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const signature = createHash("sha1").update(`${signatureBase}${apiSecret}`).digest("hex");

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      fields: {
        ...params,
        api_key: apiKey,
        signature
      }
    };
  }

  private mapPaymentStatus(value: unknown) {
    const status = String(value ?? "").toLowerCase();
    if (["success", "successful", "completed"].includes(status)) {
      return "COMPLETED";
    }
    if (["pending", "processing"].includes(status)) {
      return "PENDING";
    }
    if (["cancelled", "canceled"].includes(status)) {
      return "CANCELLED";
    }

    return "FAILED";
  }

  private toCampaign(campaign: any, options: { includeInternal?: boolean } = {}) {
    const includeInternal = options.includeInternal === true;
    const reports = (campaign.reports ?? []).filter((report: any) =>
      includeInternal ? true : report.status === "PUBLISHED" && !report.deletedAt
    );
    const notes = (campaign.notes ?? []).filter((note: any) =>
      includeInternal ? true : note.visibility === "CLIENT_VISIBLE"
    );
    const assignedOperator = this.activeOperatorAssignment(campaign);
    const ledger = this.buildCampaignLedger(campaign);
    const budgetSummary = this.buildCampaignBudgetSummary(campaign, ledger);

    return {
      id: campaign.id,
      workspaceId: campaign.workspaceId,
      creatorUserId: campaign.creatorUserId,
      companyProfileId: campaign.companyProfileId,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      budget: { amountMinor: campaign.budgetMinor, currency: getCurrency(campaign.currency, "NGN") },
      budgetSummary,
      remainingBudget: budgetSummary.remainingBalance,
      assignedOperator: assignedOperator
        ? {
            userId: assignedOperator.assigneeUserId,
            name: assignedOperator.assignee?.name ?? assignedOperator.assigneeUserId,
            email: assignedOperator.assignee?.email
          }
        : null,
      destination: campaign.destination
        ? {
            kind: campaign.destination.kind,
            url: campaign.destination.url,
            handle: campaign.destination.handle,
            metadata: campaign.destination.metadata ?? {}
          }
        : undefined,
      schedule: {
        startsAt: iso(campaign.startsAt),
        endsAt: iso(campaign.endsAt),
        timezone: campaign.timezone
      },
      provider: campaign.provider,
      providerReference: campaign.providerReference,
      brief: campaign.brief,
      targetAudience: campaign.targetAudience ?? {},
      placementPlan: campaign.placementPlan ?? {},
      submittedAt: iso(campaign.submittedAt),
      approvedAt: iso(campaign.approvedAt),
      cancelledAt: iso(campaign.cancelledAt),
      companyProfile: campaign.companyProfile,
      persona: campaign.persona ?? null,
      creatives: campaign.creatives ?? [],
      notes,
      statusHistory: campaign.statusHistory ?? [],
      assignments: includeInternal ? (campaign.assignments ?? []) : [],
      manualPlacements: includeInternal ? (campaign.manualPlacements ?? []) : [],
      reports,
      invoices: campaign.invoices ?? [],
      budgetHolds: campaign.budgetHolds ?? [],
      createdAt: iso(campaign.createdAt),
      updatedAt: iso(campaign.updatedAt),
      deletedAt: iso(campaign.deletedAt)
    };
  }

  private toAdminCampaign(campaign: any) {
    const latestAssignment = campaign.assignments?.find(
      (assignment: any) => assignment.status === "ACTIVE"
    );
    const latestNote = campaign.notes?.[0];
    const status = this.toAdminStatus(campaign);
    const spendMinor = this.totalRecordedSpendMinor(campaign);
    const budgetMinor = Number(campaign.budgetMinor ?? 0);
    const launchedPlacementCount = (campaign.manualPlacements ?? []).filter(
      (placement: any) => placement.status === "LAUNCHED" && !placement.deletedAt
    ).length;
    const publishedReportCount = (campaign.reports ?? []).filter(
      (report: any) => report.status === "PUBLISHED" && !report.deletedAt
    ).length;
    const guardrails = [
      latestAssignment ? undefined : "Needs operator assignment",
      launchedPlacementCount > 0 ? undefined : "Needs launch placement",
      budgetMinor > 0 && spendMinor >= budgetMinor * 0.85 ? "Budget allocation near limit" : undefined,
      status === "reporting" && publishedReportCount === 0 ? "Needs published report" : undefined
    ].filter(Boolean);

    return {
      id: campaign.id,
      name: campaign.name,
      workspaceName: campaign.companyProfile?.name ?? "Workspace",
      ownerName: campaign.companyProfile?.contactEmail ?? campaign.creatorUserId,
      channel: this.channelFromDestination(campaign.destination?.kind),
      objective: campaign.objective,
      budget: { amountMinor: campaign.budgetMinor, currency: getCurrency(campaign.currency, "NGN") },
      budgetMinor,
      budgetUtilization: budgetMinor > 0 ? Math.round((spendMinor / budgetMinor) * 100) : 0,
      guardrails,
      launchedPlacementCount,
      placementCount: (campaign.manualPlacements ?? []).filter((placement: any) => !placement.deletedAt).length,
      publishedReportCount,
      reportCount: (campaign.reports ?? []).filter((report: any) => !report.deletedAt).length,
      spend: { amountMinor: spendMinor, currency: getCurrency(campaign.currency, "NGN") },
      spendMinor,
      status,
      workflowStage: this.workflowStageForAdminStatus(status),
      priority: latestAssignment?.metadata?.priority ?? "normal",
      assignee: latestAssignment?.assigneeUserId ?? "Unassigned",
      submittedAt: iso(campaign.submittedAt ?? campaign.createdAt),
      createdAt: iso(campaign.createdAt),
      updatedAt: iso(campaign.updatedAt),
      startsAt: iso(campaign.startsAt),
      endsAt: iso(campaign.endsAt),
      destinationUrl: campaign.destination?.url,
      notes: latestNote?.body,
      sla: campaign.status === "PENDING_REVIEW" ? "Review due" : "On track",
      risk: guardrails.length > 0 ? guardrails.join("; ") : "On track",
      progress: this.progressForAdminStatus(status),
      nextAction: this.nextActionForCampaign(campaign, status),
      tags: [campaign.objective, campaign.destination?.kind].filter(Boolean)
    };
  }

  private toAdminReport(report: any) {
    const metrics = normalizeJsonObject(report.metrics) as Record<string, any>;
    const reportType = String(metrics.reportType ?? "weekly_report");
    const hasMetrics =
      Number(report.impressions ?? 0) > 0 ||
      Number(report.clicks ?? 0) > 0 ||
      Number(report.conversions ?? 0) > 0 ||
      Number(report.spendMinor ?? 0) > 0;

    return {
      id: report.id,
      title: report.campaign?.name ? `${report.campaign.name} report` : "Campaign report",
      period: `${iso(report.periodStart) ?? ""} - ${iso(report.periodEnd) ?? ""}`,
      generatedAt: iso(report.updatedAt),
      reportType,
      type: reportType,
      status:
        report.status === "PUBLISHED" ? "published" : report.status === "RETRACTED" ? "failed" : hasMetrics ? "ready" : "generating",
      owner: report.generatedByUserId ?? "Ops",
      summary: report.summary,
      metrics: [
        { label: "Spend", value: report.spendMinor },
        { label: "Impressions", value: report.impressions },
        { label: "Clicks", value: report.clicks },
        { label: "Conversions", value: report.conversions }
      ]
    };
  }

  private toAdminActivity(item: any) {
    return {
      id: item.id,
      actor: item.actorUserId ?? "System",
      action: item.action,
      target: `${item.entityType}:${item.entityId}`,
      timestamp: iso(item.createdAt),
      createdAt: iso(item.createdAt),
      severity: item.action.includes("failed") ? "danger" : "info",
      description: JSON.stringify(item.metadata ?? {})
    };
  }

  private toAdminStatus(campaign: any) {
    const latestAssignment = campaign.assignments?.find(
      (assignment: any) => assignment.status === "ACTIVE"
    );
    const hasDraftReport = (campaign.reports ?? []).some(
      (report: any) => report.status === "DRAFT" && !report.deletedAt
    );

    switch (campaign.status) {
      case "DRAFT":
        return "submitted";
      case "PENDING_REVIEW":
        return "review";
      case "APPROVED":
        return latestAssignment ? "assigned" : "approved";
      case "CREATIVE_IN_PROGRESS":
        return "creative_review";
      case "QUEUED":
        return "platform_launch";
      case "PAUSED":
        return "paused";
      case "ACTIVE":
      case "RUNNING":
        return hasDraftReport ? "reporting" : "optimization";
      case "CHANGES_REQUESTED":
      case "REJECTED":
        return "blocked";
      case "COMPLETED":
        return "completed";
      case "FAILED":
      case "CANCELLED":
        return "failed";
      default:
        return "submitted";
    }
  }

  private workflowStageForAdminStatus(status: string) {
    switch (status) {
      case "submitted":
        return "Campaign Submitted";
      case "review":
        return "Review";
      case "approved":
        return "Approved";
      case "assigned":
        return "Assigned";
      case "creative_review":
        return "Creative Review";
      case "platform_launch":
        return "Platform Launch";
      case "optimization":
        return "Optimization";
      case "reporting":
        return "Reporting";
      case "paused":
        return "Paused";
      case "completed":
        return "Completion";
      case "blocked":
        return "Blocked";
      case "failed":
        return "Failed";
      default:
        return "Campaign Submitted";
    }
  }

  private channelFromDestination(kind?: string) {
    if (!kind) {
      return "Mixed channels";
    }
    if (kind.includes("TIKTOK")) {
      return "TikTok";
    }
    if (kind.includes("INSTAGRAM")) {
      return "Instagram";
    }
    if (kind.includes("FACEBOOK")) {
      return "Facebook";
    }
    if (kind.includes("WHATSAPP")) {
      return "WhatsApp";
    }
    return kind.replace(/_/g, " ");
  }

  private progressForAdminStatus(status: string) {
    switch (status) {
      case "submitted":
        return 10;
      case "review":
        return 20;
      case "approved":
        return 30;
      case "assigned":
        return 45;
      case "creative_review":
        return 55;
      case "platform_launch":
        return 65;
      case "optimization":
        return 70;
      case "paused":
        return 70;
      case "reporting":
        return 90;
      case "completed":
        return 100;
      default:
        return 35;
    }
  }

  private nextActionForCampaign(campaign: any, status: string) {
    const hasAssignment = (campaign.assignments ?? []).some(
      (assignment: any) => assignment.status === "ACTIVE"
    );
    const hasLaunch = this.hasLaunchedPlacement(campaign);
    const hasReport = this.hasPublishedReport(campaign);

    switch (status) {
      case "submitted":
        return "Move submitted campaign into review";
      case "review":
        return "Review campaign brief";
      case "approved":
        return hasAssignment ? "Confirm assigned operator" : "Assign operator";
      case "assigned":
        return "Run creative review";
      case "creative_review":
        return "Approve creative and prepare platform launch";
      case "platform_launch":
        return hasLaunch ? "Move into optimization" : "Record launch placement";
      case "optimization":
        return "Record optimization metrics and prepare report";
      case "paused":
        return "Review the client pause or change request";
      case "reporting":
        return hasReport ? "Review completion readiness" : "Publish client report";
      case "completed":
        return "Review published report";
      default:
        return "Open campaign workspace";
    }
  }

  private toPaymentIntent(intent: any) {
    return {
      id: intent.id,
      workspaceId: intent.workspaceId,
      gateway: intent.gateway,
      amount: { amountMinor: intent.amountMinor, currency: getCurrency(intent.currency, "NGN") },
      status: intent.status,
      providerReference: intent.providerReference,
      checkoutUrl: intent.checkoutUrl,
      campaignId: intent.campaignId,
      campaignInvoiceId: intent.campaignInvoiceId,
      completedAt: iso(intent.completedAt),
      creditedAt: iso(intent.creditedAt),
      metadata: intent.metadata ?? {},
      createdAt: iso(intent.createdAt),
      updatedAt: iso(intent.updatedAt)
    };
  }
}
