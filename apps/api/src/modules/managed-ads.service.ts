/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  createKorapayPaymentGateway,
  createMockPaymentGateway,
  createMockStorageProvider
} from "@fliptrybe/providers";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import { currencies, type CurrencyCode, type LedgerEntry } from "@fliptrybe/types";

import { PrismaService } from "./prisma.service";
import type { AuthenticatedRequestContext } from "./request-context";

type DbClient = Record<string, any>;

const now = () => new Date();
const iso = (value: Date | string | null | undefined) =>
  value instanceof Date ? value.toISOString() : value ?? undefined;
const id = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

const campaignInclude = {
  destination: true,
  companyProfile: true,
  creatives: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
  notes: { orderBy: { createdAt: "desc" } },
  statusHistory: { orderBy: { createdAt: "asc" } },
  assignments: { orderBy: { createdAt: "desc" } },
  manualPlacements: { orderBy: { createdAt: "desc" } },
  reports: { orderBy: { createdAt: "desc" } },
  invoices: { orderBy: { createdAt: "desc" } },
  budgetHolds: { orderBy: { createdAt: "desc" } }
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

function getCurrency(value: string | undefined, fallback: CurrencyCode): CurrencyCode {
  return currencies.includes(value as CurrencyCode) ? (value as CurrencyCode) : fallback;
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
  if (process.env.PAYMENT_PROVIDER === "live" && getSecret(process.env.KORAPAY_SECRET_KEY)) {
    return createKorapayPaymentGateway({
      publicKey: getSecret(process.env.KORAPAY_PUBLIC_KEY),
      secretKey: getSecret(process.env.KORAPAY_SECRET_KEY),
      encryptionKey: getSecret(process.env.KORAPAY_ENCRYPTION_KEY),
      baseUrl: process.env.KORAPAY_BASE_URL,
      defaultRedirectUrl: process.env.KORAPAY_REDIRECT_URL ?? process.env.APP_URL,
      defaultWebhookUrl:
        process.env.KORAPAY_WEBHOOK_URL ??
        `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay`
    });
  }

  return createMockPaymentGateway();
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

@Injectable()
export class ManagedAdsService {
  private readonly paymentGateway = getPaymentGateway();
  private readonly mockStorageProvider = createMockStorageProvider();

  constructor(private readonly prisma: PrismaService) {}

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

  async createCampaign(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    const scope = requireScope(context);
    const startsAt = input.startsAt ? new Date(String(input.startsAt)) : now();
    const currency = getCurrency(input.currency, "NGN");
    const budgetMinor = Number(input.budgetMinor ?? input.budget?.amountMinor ?? input.budget ?? 250000);
    const objective = normalizeObjective(input.objective);
    const destinationKind = normalizeDestinationKind(input);
    const destinationUrl = String(input.destinationUrl ?? input.productLink ?? input.websiteUrl ?? "https://fliptrybe.com");

    if (!Number.isInteger(budgetMinor) || budgetMinor <= 0) {
      throw new BadRequestException("Campaign budget must be a positive minor-unit integer.");
    }

    return this.db.$transaction(async (tx: DbClient) => {
      const campaign = await tx.campaign.create({
        data: {
          workspaceId: scope.workspaceId,
          creatorUserId: scope.userId,
          companyProfileId: input.companyProfileId,
          name: String(input.name ?? input.title ?? "Managed ads campaign"),
          objective,
          status: "DRAFT",
          budgetMinor,
          currency,
          provider: "MANUAL",
          startsAt,
          endsAt: input.endsAt ? new Date(String(input.endsAt)) : undefined,
          timezone: input.timezone ?? "Africa/Lagos",
          brief: input.brief ?? input.description ?? input.productDetails,
          targetAudience: {
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

  async updateCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
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
            url: String(input.destinationUrl ?? input.productLink ?? "https://fliptrybe.com"),
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
    const existing = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    if (existing.status !== "DRAFT" && existing.status !== "CHANGES_REQUESTED") {
      throw new BadRequestException("Only draft or changes-requested campaigns can be submitted.");
    }

    return this.changeCampaignStatus(scope, campaignId, "PENDING_REVIEW", input.reason ?? "Submitted for review");
  }

  async startCampaign(context: AuthenticatedRequestContext | undefined, campaignId: string) {
    const scope = requireScope(context);
    return this.changeCampaignStatus(scope, campaignId, "RUNNING", "Manual ad launch started");
  }

  async addCampaignNote(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>, admin = false) {
    const scope = requireScope(context);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);

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
    const heldMinor = activeHolds.reduce((sum: number, hold: any) => sum + hold.amountMinor, 0);

    return {
      id: wallet.id,
      workspaceId: wallet.workspaceId,
      availableBalance,
      heldBalance: { amountMinor: heldMinor, currency: getCurrency(wallet.currency, "NGN") },
      entries: mappedEntries,
      createdAt: iso(wallet.createdAt),
      updatedAt: iso(wallet.updatedAt)
    };
  }

  async createFundingIntent(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    return this.createPaymentIntent(context, { ...input, purpose: "wallet_funding" });
  }

  async createPaymentIntent(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    const scope = requireScope(context);
    const amountMinor = Number(input.amountMinor ?? input.amount ?? 500000);
    const currency = getCurrency(input.currency, "NGN");
    const wallet = await this.getOrCreateWallet(this.db, scope.workspaceId, currency);
    const gatewayIntent = await this.paymentGateway.createPaymentIntent({
      amount: { amountMinor, currency },
      workspaceId: scope.workspaceId,
      customerEmail: input.customerEmail ?? scope.userEmail,
      customerName: input.customerName ?? scope.userName,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl
    });

    const intent = await this.db.paymentIntent.create({
      data: {
        workspaceId: scope.workspaceId,
        walletId: wallet.id,
        campaignId: input.campaignId,
        campaignInvoiceId: input.invoiceId ?? input.campaignInvoiceId,
        gateway: gatewayIntent.gateway,
        amountMinor,
        currency,
        status: gatewayIntent.status,
        providerReference: gatewayIntent.providerReference,
        checkoutUrl: gatewayIntent.checkoutUrl,
        customerEmail: input.customerEmail ?? scope.userEmail,
        customerName: input.customerName ?? scope.userName,
        idempotencyKey: input.idempotencyKey,
        metadata: { purpose: input.purpose ?? "payment" },
        providerPayload: gatewayIntent.metadata ?? {}
      }
    });

    return this.toPaymentIntent(intent);
  }

  async verifyPayment(context: AuthenticatedRequestContext | undefined, reference: string) {
    const scope = requireScope(context);
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
    if (!verifyKorapaySignature({ body, signature })) {
      throw new BadRequestException("Invalid Korapay webhook signature.");
    }

    const eventBody = typeof body === "object" && body !== null ? (body as Record<string, any>) : {};
    const data = typeof eventBody.data === "object" && eventBody.data !== null ? eventBody.data : {};
    const reference = data.reference ?? data.payment_reference;
    if (!reference || typeof reference !== "string") {
      throw new BadRequestException("Korapay webhook is missing a payment reference.");
    }

    const intent = await this.db.paymentIntent.findFirst({ where: { providerReference: reference } });
    if (!intent) {
      return { accepted: true, reference, status: data.status ?? "unmatched" };
    }

    const status = this.mapPaymentStatus(data.status);
    await this.completePaymentIntent(intent.id, status, reference);
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
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const totalMinor = Number(input.totalMinor ?? input.amountMinor ?? campaign.budgetMinor);
    const number = input.number ?? `INV-${Date.now().toString(36).toUpperCase()}-${campaign.id.slice(0, 6)}`;

    const invoice = await this.db.campaignInvoice.create({
      data: {
        workspaceId: scope.workspaceId,
        campaignId,
        companyProfileId: campaign.companyProfileId,
        number,
        status: "ISSUED",
        subtotalMinor: totalMinor,
        taxMinor: Number(input.taxMinor ?? 0),
        totalMinor: totalMinor + Number(input.taxMinor ?? 0),
        currency: campaign.currency,
        lineItems: input.lineItems ?? [
          { label: "Managed ad campaign budget", amountMinor: totalMinor, currency: campaign.currency }
        ],
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
    const invoice = await this.getInvoice(scope, invoiceId);
    if (invoice.status === "PAID") {
      return invoice;
    }

    if (String(input.method ?? "wallet").toLowerCase() !== "wallet") {
      return this.createPaymentIntent(scope, {
        amountMinor: invoice.totalMinor - invoice.amountPaidMinor,
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
      await this.assertWalletCanPay(tx, wallet.id, invoice.totalMinor - invoice.amountPaidMinor, invoice.currency);
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          kind: "DEBIT",
          amountMinor: invoice.totalMinor - invoice.amountPaidMinor,
          currency: invoice.currency,
          reference: `invoice:${invoice.id}`,
          description: `Campaign invoice ${invoice.number} paid from wallet`,
          idempotencyKey: `invoice:${invoice.id}:wallet_payment`,
          sourceType: "CampaignInvoice",
          sourceId: invoice.id
        }
      });
      const paid = await tx.campaignInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          amountPaidMinor: invoice.totalMinor,
          paidAt: now()
        }
      });
      await this.audit(tx, scope, "campaign_invoice.paid", "CampaignInvoice", invoice.id, {});
      await this.notify(tx, scope.workspaceId, "Invoice paid", "Your campaign invoice has been paid.", {
        entityType: "CampaignInvoice",
        entityId: invoice.id,
        actionUrl: `/billing/invoices/${invoice.id}`
      });
      return paid;
    });
  }

  async createBudgetHold(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    const campaign = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const amountMinor = Number(input.amountMinor ?? campaign.budgetMinor);
    const idempotencyKey = input.idempotencyKey ?? `campaign:${campaignId}:hold:${amountMinor}`;

    return this.db.$transaction(async (tx: DbClient) => {
      const existing = await tx.campaignBudgetHold.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return existing;
      }
      const wallet = await this.getOrCreateWallet(tx, scope.workspaceId, getCurrency(campaign.currency, "NGN"));
      await this.lockWallet(tx, wallet.id);
      await this.assertWalletCanPay(tx, wallet.id, amountMinor, campaign.currency);
      const ledger = await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          kind: "HOLD",
          amountMinor,
          currency: campaign.currency,
          reference: `campaign:${campaignId}:budget_hold`,
          description: "Campaign budget hold",
          idempotencyKey: `${idempotencyKey}:ledger`,
          sourceType: "Campaign",
          sourceId: campaignId
        }
      });
      const hold = await tx.campaignBudgetHold.create({
        data: {
          campaignId,
          walletId: wallet.id,
          invoiceId: input.invoiceId,
          createdByUserId: scope.userId,
          amountMinor,
          currency: campaign.currency,
          idempotencyKey,
          holdLedgerEntryId: ledger.id,
          reason: input.reason
        }
      });
      await this.audit(tx, scope, "campaign_budget_hold.created", "CampaignBudgetHold", hold.id, { campaignId });
      return hold;
    });
  }

  async releaseBudgetHold(context: AuthenticatedRequestContext | undefined, campaignId: string, holdId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    return this.db.$transaction(async (tx: DbClient) => {
      const hold = await tx.campaignBudgetHold.findFirst({ where: { id: holdId, campaignId }, include: { campaign: true } });
      if (!hold || hold.campaign.workspaceId !== scope.workspaceId) {
        throw new NotFoundException("Budget hold was not found in the active workspace.");
      }
      if (hold.status !== "ACTIVE") {
        return hold;
      }
      await this.lockWallet(tx, hold.walletId);
      const release = await tx.ledgerEntry.create({
        data: {
          walletId: hold.walletId,
          kind: "RELEASE",
          amountMinor: hold.amountMinor,
          currency: hold.currency,
          reference: `hold:${hold.id}:release`,
          description: input.reason ?? "Campaign budget hold released",
          idempotencyKey: `hold:${hold.id}:release`,
          sourceType: "CampaignBudgetHold",
          sourceId: hold.id
        }
      });

      return tx.campaignBudgetHold.update({
        where: { id: hold.id },
        data: { status: "RELEASED", releaseLedgerEntryId: release.id, releasedAt: now(), reason: input.reason ?? hold.reason }
      });
    });
  }

  async captureBudgetHold(context: AuthenticatedRequestContext | undefined, campaignId: string, holdId: string, input: Record<string, any> = {}) {
    const scope = requireScope(context);
    return this.db.$transaction(async (tx: DbClient) => {
      const hold = await tx.campaignBudgetHold.findFirst({ where: { id: holdId, campaignId }, include: { campaign: true } });
      if (!hold || hold.campaign.workspaceId !== scope.workspaceId) {
        throw new NotFoundException("Budget hold was not found in the active workspace.");
      }
      if (hold.status !== "ACTIVE") {
        return hold;
      }
      const amountMinor = Number(input.amountMinor ?? hold.amountMinor);
      await this.lockWallet(tx, hold.walletId);
      const release = await tx.ledgerEntry.create({
        data: {
          walletId: hold.walletId,
          kind: "RELEASE",
          amountMinor: hold.amountMinor,
          currency: hold.currency,
          reference: `hold:${hold.id}:capture_release`,
          description: "Campaign budget hold released for spend capture",
          idempotencyKey: `hold:${hold.id}:capture_release`,
          sourceType: "CampaignBudgetHold",
          sourceId: hold.id
        }
      });
      const debit = await tx.ledgerEntry.create({
        data: {
          walletId: hold.walletId,
          kind: "DEBIT",
          amountMinor,
          currency: hold.currency,
          reference: `hold:${hold.id}:capture_debit`,
          description: "Campaign spend captured",
          idempotencyKey: `hold:${hold.id}:capture_debit`,
          sourceType: "CampaignBudgetHold",
          sourceId: hold.id
        }
      });
      await tx.campaignSpendEntry.create({
        data: {
          campaignId,
          placementId: input.placementId,
          actorUserId: scope.userId,
          amountMinor,
          currency: hold.currency,
          source: input.source ?? "MANUAL",
          notes: input.notes,
          recordedForDate: input.recordedForDate ? new Date(String(input.recordedForDate)) : now()
        }
      });

      return tx.campaignBudgetHold.update({
        where: { id: hold.id },
        data: {
          status: "CAPTURED",
          captureReleaseLedgerEntryId: release.id,
          captureDebitLedgerEntryId: debit.id,
          capturedAt: now()
        }
      });
    });
  }

  async getAdminOverview(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
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
    const reviewing =
      Number(byStatus.PENDING_REVIEW ?? 0) +
      Number(byStatus.APPROVED ?? 0) +
      Number(byStatus.CREATIVE_IN_PROGRESS ?? 0);
    const blocked =
      Number(byStatus.CHANGES_REQUESTED ?? 0) +
      Number(byStatus.REJECTED ?? 0) +
      Number(byStatus.FAILED ?? 0);

    return {
      byStatus,
      unassigned,
      totals: {
        queued: Number(byStatus.PENDING_REVIEW ?? 0) + Number(byStatus.QUEUED ?? 0),
        reviewing,
        running,
        blocked,
        urgent: unassigned,
        completed: Number(byStatus.COMPLETED ?? 0)
      },
      activeOperators: activeOperators.length,
      metrics: [
        {
          label: "Open queue",
          value: String(Number(byStatus.PENDING_REVIEW ?? 0) + reviewing + blocked),
          detail: "Queued, reviewing, and blocked",
          tone: "info"
        },
        {
          label: "Running",
          value: String(running),
          detail: "Live campaigns under watch",
          tone: "success"
        },
        {
          label: "Unassigned",
          value: String(unassigned),
          detail: "Campaigns waiting for owner",
          tone: unassigned > 0 ? "warning" : "neutral"
        },
        {
          label: "Reports",
          value: String(reports.length),
          detail: "Draft and published jobs",
          tone: "info"
        }
      ],
      queue: campaigns.map((campaign: any) => this.toAdminCampaign(campaign)),
      reports: reports.map((report: any) => this.toAdminReport(report)),
      activity: activity.map((item: any) => this.toAdminActivity(item))
    };
  }

  async listAdminCampaigns(context: AuthenticatedRequestContext | undefined, query: Record<string, any>) {
    const scope = requireScope(context);
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
    const activity = await this.db.auditLog.findMany({
      where: { workspaceId: scope.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return activity.map((item: any) => this.toAdminActivity(item));
  }

  async updateAdminStatus(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    return this.changeCampaignStatus(scope, campaignId, normalizeCampaignStatus(input.status), input.reason, true);
  }

  async updateAssignment(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
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
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const placement = await this.db.manualAdPlacement.create({
      data: {
        campaignId,
        creativeId: input.creativeId,
        assignedUserId: input.assignedUserId ?? scope.userId,
        channel: String(input.channel ?? input.provider ?? "OTHER").toUpperCase(),
        provider: input.provider,
        externalPlacementId: input.externalPlacementId,
        destinationUrl: input.url ?? input.destinationUrl,
        status: input.status ?? "LAUNCHED",
        budgetMinor: Number(input.budgetMinor ?? 0),
        spendMinor: Number(input.spendMinor ?? 0),
        currency: input.currency ?? "NGN",
        startsAt: input.startsAt ? new Date(String(input.startsAt)) : now(),
        metadata: normalizeJsonObject(input.metadata)
      }
    });

    await this.db.auditLog.create({
      data: {
        workspaceId: scope.workspaceId,
        actorUserId: scope.userId,
        action: "campaign.manual_placement.created",
        entityType: "ManualAdPlacement",
        entityId: placement.id,
        metadata: { campaignId }
      }
    });
    return placement;
  }

  async addManualMetric(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const entry = await this.db.campaignSpendEntry.create({
      data: {
        campaignId,
        placementId: input.placementId,
        actorUserId: scope.userId,
        amountMinor: Number(input.amountMinor ?? input.spendMinor ?? 0),
        currency: input.currency ?? "NGN",
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
    await this.db.analyticsMetric.create({
      data: {
        workspaceId: scope.workspaceId,
        campaignId,
        name: input.metricName ?? "manual_spend",
        value: Number(input.value ?? input.spendMinor ?? input.amountMinor ?? 0),
        dimensions: { source: "manual" }
      }
    });
    return entry;
  }

  async createReport(context: AuthenticatedRequestContext | undefined, campaignId: string, input: Record<string, any>) {
    const scope = requireScope(context);
    await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
    const periodEnd = input.periodEnd ? new Date(String(input.periodEnd)) : now();
    const periodStart = input.periodStart ? new Date(String(input.periodStart)) : new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

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
        currency: input.currency ?? "NGN",
        impressions: Number(input.impressions ?? 0),
        clicks: Number(input.clicks ?? 0),
        conversions: Number(input.conversions ?? 0),
        metrics: normalizeJsonObject(input.metrics),
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
    const report = await this.db.campaignReport.findFirst({
      where: { id: reportId, campaign: { workspaceId: scope.workspaceId } }
    });
    if (!report) {
      throw new NotFoundException("Campaign report was not found in the active workspace.");
    }

    const published = await this.db.campaignReport.update({
      where: { id: report.id },
      data: { status: "PUBLISHED", publishedAt: now() },
      include: { screenshots: { include: { mediaAsset: true } } }
    });
    await this.db.notification.create({
      data: {
        workspaceId: scope.workspaceId,
        channel: "IN_APP",
        title: "Campaign report published",
        body: "A campaign performance report is ready to view.",
        entityType: "CampaignReport",
        entityId: report.id,
        actionUrl: `/campaigns/${report.campaignId}/reports`,
        idempotencyKey: `report:${report.id}:published`
      }
    });
    return published;
  }

  async bulkAdminAction(context: AuthenticatedRequestContext | undefined, input: Record<string, any>) {
    const scope = requireScope(context);
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

  private async changeCampaignStatus(
    scope: AuthenticatedRequestContext,
    campaignId: string,
    status: string,
    reason?: string,
    admin = false
  ) {
    const existing = await this.findCampaignOrThrow(this.db, scope.workspaceId, campaignId);
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
    });
  }

  private async completePaymentIntent(intentId: string, status: string, providerReference: string, scope?: AuthenticatedRequestContext) {
    return this.db.$transaction(async (tx: DbClient) => {
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
        const wallet = intent.walletId
          ? await tx.wallet.findUnique({ where: { id: intent.walletId } })
          : await this.getOrCreateWallet(tx, intent.workspaceId, getCurrency(intent.currency, "NGN"));
        await this.lockWallet(tx, wallet.id);
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            kind: "CREDIT",
            amountMinor: intent.amountMinor,
            currency: intent.currency,
            reference: providerReference,
            description: "Payment credited to wallet",
            idempotencyKey: `payment:${intent.id}:credit`,
            sourceType: "PaymentIntent",
            sourceId: intent.id
          }
        });
        creditedAt = now();

        if (intent.campaignInvoiceId) {
          const invoice = await tx.campaignInvoice.findUnique({ where: { id: intent.campaignInvoiceId } });
          const amountDue = Math.max(0, invoice.totalMinor - invoice.amountPaidMinor);
          const debitAmount = Math.min(intent.amountMinor, amountDue);
          if (debitAmount > 0) {
            await tx.ledgerEntry.create({
              data: {
                walletId: wallet.id,
                kind: "DEBIT",
                amountMinor: debitAmount,
                currency: intent.currency,
                reference: `invoice:${invoice.id}`,
                description: "Campaign invoice paid from payment",
                idempotencyKey: `payment:${intent.id}:invoice_debit`,
                sourceType: "CampaignInvoice",
                sourceId: invoice.id
              }
            });
            await tx.campaignInvoice.update({
              where: { id: invoice.id },
              data: {
                amountPaidMinor: invoice.amountPaidMinor + debitAmount,
                status: invoice.amountPaidMinor + debitAmount >= invoice.totalMinor ? "PAID" : "PARTIALLY_PAID",
                paidAt: invoice.amountPaidMinor + debitAmount >= invoice.totalMinor ? now() : undefined
              }
            });
          }
        }
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
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${walletId} FOR UPDATE`;
  }

  private async assertWalletCanPay(tx: DbClient, walletId: string, amountMinor: number, currency: string) {
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
        channel: "IN_APP",
        title,
        body,
        entityType: input.entityType,
        entityId: input.entityId,
        actionUrl: input.actionUrl,
        idempotencyKey,
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

  private toCampaign(campaign: any) {
    return {
      id: campaign.id,
      workspaceId: campaign.workspaceId,
      creatorUserId: campaign.creatorUserId,
      companyProfileId: campaign.companyProfileId,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      budget: { amountMinor: campaign.budgetMinor, currency: getCurrency(campaign.currency, "NGN") },
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
      creatives: campaign.creatives ?? [],
      notes: campaign.notes ?? [],
      statusHistory: campaign.statusHistory ?? [],
      assignments: campaign.assignments ?? [],
      manualPlacements: campaign.manualPlacements ?? [],
      reports: campaign.reports ?? [],
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

    return {
      id: campaign.id,
      name: campaign.name,
      workspaceName: campaign.companyProfile?.name ?? "Workspace",
      ownerName: campaign.companyProfile?.contactEmail ?? campaign.creatorUserId,
      channel: this.channelFromDestination(campaign.destination?.kind),
      objective: campaign.objective,
      budget: { amountMinor: campaign.budgetMinor, currency: getCurrency(campaign.currency, "NGN") },
      status: this.toAdminStatus(campaign.status),
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
      risk: "Unscored",
      progress: this.progressForStatus(campaign.status),
      nextAction: this.nextActionForStatus(campaign.status),
      tags: [campaign.objective, campaign.destination?.kind].filter(Boolean)
    };
  }

  private toAdminReport(report: any) {
    return {
      id: report.id,
      title: report.campaign?.name ? `${report.campaign.name} report` : "Campaign report",
      period: `${iso(report.periodStart) ?? ""} - ${iso(report.periodEnd) ?? ""}`,
      generatedAt: iso(report.updatedAt),
      status:
        report.status === "PUBLISHED" ? "ready" : report.status === "RETRACTED" ? "failed" : "generating",
      owner: report.generatedByUserId ?? "Ops",
      summary: report.summary,
      metrics: [
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

  private toAdminStatus(status: string) {
    switch (status) {
      case "PENDING_REVIEW":
        return "reviewing";
      case "APPROVED":
      case "CREATIVE_IN_PROGRESS":
      case "QUEUED":
        return "scheduled";
      case "ACTIVE":
      case "RUNNING":
      case "PAUSED":
        return "running";
      case "CHANGES_REQUESTED":
      case "REJECTED":
        return "blocked";
      case "COMPLETED":
        return "completed";
      case "FAILED":
      case "CANCELLED":
        return "failed";
      default:
        return "queued";
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

  private progressForStatus(status: string) {
    switch (status) {
      case "DRAFT":
        return 10;
      case "PENDING_REVIEW":
        return 25;
      case "APPROVED":
      case "CREATIVE_IN_PROGRESS":
        return 45;
      case "RUNNING":
      case "ACTIVE":
        return 70;
      case "COMPLETED":
        return 100;
      default:
        return 35;
    }
  }

  private nextActionForStatus(status: string) {
    switch (status) {
      case "DRAFT":
        return "Wait for client submission";
      case "PENDING_REVIEW":
        return "Review campaign brief";
      case "APPROVED":
        return "Assign operator and issue invoice";
      case "CREATIVE_IN_PROGRESS":
        return "Upload approved creatives";
      case "RUNNING":
      case "ACTIVE":
        return "Record proofs and metrics";
      case "COMPLETED":
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
