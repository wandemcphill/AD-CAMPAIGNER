-- Managed ads marketplace MVP domain model.

ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CREATIVE_IN_PROGRESS';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'RUNNING';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "CompanyProfileStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "CompanyVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "MediaAssetKind" AS ENUM ('IMAGE', 'VIDEO', 'SCREENSHOT', 'REPORT_ATTACHMENT', 'OTHER');
CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'READY', 'FAILED', 'DELETED');
CREATE TYPE "MediaDeliveryType" AS ENUM ('PUBLIC', 'AUTHENTICATED');
CREATE TYPE "CampaignCreativeFormat" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL', 'TEXT', 'MIXED');
CREATE TYPE "CampaignCreativeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "CampaignNoteVisibility" AS ENUM ('INTERNAL', 'CLIENT_VISIBLE');
CREATE TYPE "CampaignAssignmentRole" AS ENUM ('OPERATOR', 'DESIGNER', 'REVIEWER', 'FINANCE', 'SUPPORT');
CREATE TYPE "CampaignAssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ManualAdPlacementStatus" AS ENUM ('DRAFT', 'LAUNCHED', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ManualAdPlacementChannel" AS ENUM ('TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'GOOGLE', 'OTHER');
CREATE TYPE "CampaignReportStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETRACTED');
CREATE TYPE "CampaignBudgetHoldStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CAPTURED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "CampaignInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'OVERDUE');
CREATE TYPE "CampaignSpendSource" AS ENUM ('MANUAL', 'REPORT', 'AD_PLACEMENT');
CREATE TYPE "EventOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

ALTER TABLE "Wallet" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Wallet" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Campaign" ADD COLUMN "companyProfileId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "brief" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "targetAudience" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Campaign" ADD COLUMN "placementPlan" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Campaign" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "PaymentIntent" ADD COLUMN "walletId" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "campaignInvoiceId" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "checkoutUrl" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "customerName" TEXT;
ALTER TABLE "PaymentIntent" ADD COLUMN "providerPayload" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PaymentIntent" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PaymentIntent" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "PaymentIntent" ADD COLUMN "creditedAt" TIMESTAMP(3);

CREATE TABLE "CompanyProfile" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "slug" TEXT NOT NULL,
  "websiteUrl" TEXT,
  "industry" TEXT,
  "countryCode" TEXT,
  "city" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "status" "CompanyProfileStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "verificationStatus" "CompanyVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "uploaderUserId" TEXT NOT NULL,
  "companyProfileId" TEXT,
  "kind" "MediaAssetKind" NOT NULL,
  "status" "MediaAssetStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "deliveryType" "MediaDeliveryType" NOT NULL DEFAULT 'PUBLIC',
  "storageProvider" TEXT NOT NULL DEFAULT 'cloudinary',
  "storageKey" TEXT NOT NULL,
  "providerAssetId" TEXT,
  "providerPublicId" TEXT,
  "url" TEXT,
  "secureUrl" TEXT,
  "thumbnailUrl" TEXT,
  "contentType" TEXT NOT NULL,
  "format" TEXT,
  "byteSize" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "checksumSha256" TEXT,
  "originalFilename" TEXT,
  "altText" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignCreative" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "mediaAssetId" TEXT,
  "name" TEXT NOT NULL,
  "format" "CampaignCreativeFormat" NOT NULL DEFAULT 'IMAGE',
  "status" "CampaignCreativeStatus" NOT NULL DEFAULT 'DRAFT',
  "role" TEXT,
  "placement" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "primaryText" TEXT,
  "headline" TEXT,
  "description" TEXT,
  "callToAction" TEXT,
  "landingUrl" TEXT,
  "reviewFeedback" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignCreative_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignNote" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "visibility" "CampaignNoteVisibility" NOT NULL DEFAULT 'INTERNAL',
  "body" TEXT NOT NULL,
  "pinnedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignStatusHistory" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "fromStatus" "CampaignStatus",
  "toStatus" "CampaignStatus" NOT NULL,
  "actorUserId" TEXT,
  "actorType" TEXT NOT NULL DEFAULT 'USER',
  "reason" TEXT,
  "providerReference" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignAssignment" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "assigneeUserId" TEXT NOT NULL,
  "assignerUserId" TEXT,
  "role" "CampaignAssignmentRole" NOT NULL DEFAULT 'OPERATOR',
  "status" "CampaignAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManualAdPlacement" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "creativeId" TEXT,
  "assignedUserId" TEXT,
  "channel" "ManualAdPlacementChannel" NOT NULL,
  "provider" TEXT,
  "externalPlacementId" TEXT,
  "destinationUrl" TEXT,
  "status" "ManualAdPlacementStatus" NOT NULL DEFAULT 'DRAFT',
  "budgetMinor" INTEGER NOT NULL DEFAULT 0,
  "spendMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ManualAdPlacement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignReport" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "placementId" TEXT,
  "generatedByUserId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "CampaignReportStatus" NOT NULL DEFAULT 'DRAFT',
  "summary" TEXT,
  "spendMinor" INTEGER NOT NULL DEFAULT 0,
  "revenueMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignReportScreenshot" (
  "id" TEXT NOT NULL,
  "campaignReportId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "capturedAt" TIMESTAMP(3),
  "viewport" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignReportScreenshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignInvoice" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "companyProfileId" TEXT,
  "number" TEXT NOT NULL,
  "status" "CampaignInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotalMinor" INTEGER NOT NULL,
  "taxMinor" INTEGER NOT NULL DEFAULT 0,
  "totalMinor" INTEGER NOT NULL,
  "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "lineItems" JSONB NOT NULL DEFAULT '[]',
  "issuedAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignBudgetHold" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "createdByUserId" TEXT,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "CampaignBudgetHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "idempotencyKey" TEXT NOT NULL,
  "holdLedgerEntryId" TEXT NOT NULL,
  "releaseLedgerEntryId" TEXT,
  "captureReleaseLedgerEntryId" TEXT,
  "captureDebitLedgerEntryId" TEXT,
  "reason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "capturedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignBudgetHold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignSpendEntry" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "placementId" TEXT,
  "actorUserId" TEXT,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "source" "CampaignSpendSource" NOT NULL DEFAULT 'MANUAL',
  "recordedForDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignSpendEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventOutbox" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "name" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT NOT NULL,
  "status" "EventOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification" ADD COLUMN "recipientUserId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "eventId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'campaign';
ALTER TABLE "Notification" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "Notification" ADD COLUMN "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED';
ALTER TABLE "Notification" ADD COLUMN "actionUrl" TEXT;
ALTER TABLE "Notification" ADD COLUMN "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Notification" ADD COLUMN "provider" TEXT;
ALTER TABLE "Notification" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "failedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "Notification" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "NotificationDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "response" JSONB NOT NULL DEFAULT '{}',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "inApp" BOOLEAN NOT NULL DEFAULT true,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "whatsapp" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyProfile_workspaceId_slug_key" ON "CompanyProfile"("workspaceId", "slug");
CREATE INDEX "CompanyProfile_workspaceId_status_createdAt_idx" ON "CompanyProfile"("workspaceId", "status", "createdAt");
CREATE INDEX "CompanyProfile_ownerUserId_createdAt_idx" ON "CompanyProfile"("ownerUserId", "createdAt");
CREATE INDEX "CompanyProfile_deletedAt_idx" ON "CompanyProfile"("deletedAt");
CREATE UNIQUE INDEX "MediaAsset_workspaceId_storageProvider_storageKey_key" ON "MediaAsset"("workspaceId", "storageProvider", "storageKey");
CREATE UNIQUE INDEX "MediaAsset_storageProvider_providerAssetId_key" ON "MediaAsset"("storageProvider", "providerAssetId");
CREATE UNIQUE INDEX "MediaAsset_storageProvider_providerPublicId_key" ON "MediaAsset"("storageProvider", "providerPublicId");
CREATE INDEX "MediaAsset_workspaceId_status_createdAt_idx" ON "MediaAsset"("workspaceId", "status", "createdAt");
CREATE INDEX "MediaAsset_companyProfileId_createdAt_idx" ON "MediaAsset"("companyProfileId", "createdAt");
CREATE INDEX "MediaAsset_uploaderUserId_createdAt_idx" ON "MediaAsset"("uploaderUserId", "createdAt");
CREATE INDEX "MediaAsset_checksumSha256_idx" ON "MediaAsset"("checksumSha256");
CREATE INDEX "MediaAsset_deletedAt_idx" ON "MediaAsset"("deletedAt");
CREATE INDEX "Campaign_companyProfileId_status_idx" ON "Campaign"("companyProfileId", "status");
CREATE INDEX "CampaignCreative_campaignId_status_idx" ON "CampaignCreative"("campaignId", "status");
CREATE INDEX "CampaignCreative_campaignId_sortOrder_idx" ON "CampaignCreative"("campaignId", "sortOrder");
CREATE INDEX "CampaignCreative_mediaAssetId_idx" ON "CampaignCreative"("mediaAssetId");
CREATE INDEX "CampaignCreative_deletedAt_idx" ON "CampaignCreative"("deletedAt");
CREATE INDEX "CampaignNote_campaignId_createdAt_idx" ON "CampaignNote"("campaignId", "createdAt");
CREATE INDEX "CampaignNote_authorUserId_createdAt_idx" ON "CampaignNote"("authorUserId", "createdAt");
CREATE INDEX "CampaignNote_visibility_createdAt_idx" ON "CampaignNote"("visibility", "createdAt");
CREATE INDEX "CampaignNote_deletedAt_idx" ON "CampaignNote"("deletedAt");
CREATE INDEX "CampaignStatusHistory_campaignId_createdAt_idx" ON "CampaignStatusHistory"("campaignId", "createdAt");
CREATE INDEX "CampaignStatusHistory_toStatus_createdAt_idx" ON "CampaignStatusHistory"("toStatus", "createdAt");
CREATE INDEX "CampaignStatusHistory_actorUserId_createdAt_idx" ON "CampaignStatusHistory"("actorUserId", "createdAt");
CREATE INDEX "CampaignAssignment_campaignId_status_idx" ON "CampaignAssignment"("campaignId", "status");
CREATE INDEX "CampaignAssignment_assigneeUserId_status_dueAt_idx" ON "CampaignAssignment"("assigneeUserId", "status", "dueAt");
CREATE INDEX "CampaignAssignment_deletedAt_idx" ON "CampaignAssignment"("deletedAt");
CREATE INDEX "ManualAdPlacement_campaignId_status_idx" ON "ManualAdPlacement"("campaignId", "status");
CREATE INDEX "ManualAdPlacement_channel_status_idx" ON "ManualAdPlacement"("channel", "status");
CREATE INDEX "ManualAdPlacement_provider_externalPlacementId_idx" ON "ManualAdPlacement"("provider", "externalPlacementId");
CREATE INDEX "ManualAdPlacement_deletedAt_idx" ON "ManualAdPlacement"("deletedAt");
CREATE INDEX "CampaignReport_campaignId_status_createdAt_idx" ON "CampaignReport"("campaignId", "status", "createdAt");
CREATE INDEX "CampaignReport_placementId_createdAt_idx" ON "CampaignReport"("placementId", "createdAt");
CREATE INDEX "CampaignReport_publishedAt_idx" ON "CampaignReport"("publishedAt");
CREATE INDEX "CampaignReport_deletedAt_idx" ON "CampaignReport"("deletedAt");
CREATE INDEX "CampaignReportScreenshot_campaignReportId_capturedAt_idx" ON "CampaignReportScreenshot"("campaignReportId", "capturedAt");
CREATE INDEX "CampaignReportScreenshot_mediaAssetId_idx" ON "CampaignReportScreenshot"("mediaAssetId");
CREATE UNIQUE INDEX "CampaignInvoice_workspaceId_number_key" ON "CampaignInvoice"("workspaceId", "number");
CREATE INDEX "CampaignInvoice_workspaceId_status_createdAt_idx" ON "CampaignInvoice"("workspaceId", "status", "createdAt");
CREATE INDEX "CampaignInvoice_campaignId_status_idx" ON "CampaignInvoice"("campaignId", "status");
CREATE INDEX "CampaignInvoice_dueAt_idx" ON "CampaignInvoice"("dueAt");
CREATE INDEX "CampaignInvoice_deletedAt_idx" ON "CampaignInvoice"("deletedAt");
CREATE UNIQUE INDEX "CampaignBudgetHold_idempotencyKey_key" ON "CampaignBudgetHold"("idempotencyKey");
CREATE INDEX "CampaignBudgetHold_campaignId_status_idx" ON "CampaignBudgetHold"("campaignId", "status");
CREATE INDEX "CampaignBudgetHold_walletId_status_createdAt_idx" ON "CampaignBudgetHold"("walletId", "status", "createdAt");
CREATE INDEX "CampaignBudgetHold_invoiceId_idx" ON "CampaignBudgetHold"("invoiceId");
CREATE INDEX "CampaignSpendEntry_campaignId_recordedForDate_idx" ON "CampaignSpendEntry"("campaignId", "recordedForDate");
CREATE INDEX "CampaignSpendEntry_placementId_recordedForDate_idx" ON "CampaignSpendEntry"("placementId", "recordedForDate");
CREATE INDEX "CampaignSpendEntry_actorUserId_createdAt_idx" ON "CampaignSpendEntry"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "EventOutbox_idempotencyKey_key" ON "EventOutbox"("idempotencyKey");
CREATE INDEX "EventOutbox_workspaceId_status_createdAt_idx" ON "EventOutbox"("workspaceId", "status", "createdAt");
CREATE INDEX "EventOutbox_entityType_entityId_idx" ON "EventOutbox"("entityType", "entityId");
CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");
CREATE INDEX "PaymentIntent_walletId_status_idx" ON "PaymentIntent"("walletId", "status");
CREATE INDEX "PaymentIntent_campaignId_status_idx" ON "PaymentIntent"("campaignId", "status");
CREATE INDEX "PaymentIntent_campaignInvoiceId_status_idx" ON "PaymentIntent"("campaignInvoiceId", "status");
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");
CREATE INDEX "Notification_workspaceId_status_createdAt_idx" ON "Notification"("workspaceId", "status", "createdAt");
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");
CREATE INDEX "NotificationDeliveryAttempt_notificationId_attemptedAt_idx" ON "NotificationDeliveryAttempt"("notificationId", "attemptedAt");
CREATE INDEX "NotificationDeliveryAttempt_channel_provider_attemptedAt_idx" ON "NotificationDeliveryAttempt"("channel", "provider", "attemptedAt");
CREATE UNIQUE INDEX "NotificationPreference_workspaceId_userId_eventName_key" ON "NotificationPreference"("workspaceId", "userId", "eventName");
CREATE INDEX "NotificationPreference_userId_eventName_idx" ON "NotificationPreference"("userId", "eventName");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_campaignInvoiceId_fkey" FOREIGN KEY ("campaignInvoiceId") REFERENCES "CampaignInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignCreative" ADD CONSTRAINT "CampaignCreative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignCreative" ADD CONSTRAINT "CampaignCreative_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignNote" ADD CONSTRAINT "CampaignNote_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignNote" ADD CONSTRAINT "CampaignNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignStatusHistory" ADD CONSTRAINT "CampaignStatusHistory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignAssignment" ADD CONSTRAINT "CampaignAssignment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignAssignment" ADD CONSTRAINT "CampaignAssignment_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignAssignment" ADD CONSTRAINT "CampaignAssignment_assignerUserId_fkey" FOREIGN KEY ("assignerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualAdPlacement" ADD CONSTRAINT "ManualAdPlacement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualAdPlacement" ADD CONSTRAINT "ManualAdPlacement_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "CampaignCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignReport" ADD CONSTRAINT "CampaignReport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignReport" ADD CONSTRAINT "CampaignReport_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ManualAdPlacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignReport" ADD CONSTRAINT "CampaignReport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignReportScreenshot" ADD CONSTRAINT "CampaignReportScreenshot_campaignReportId_fkey" FOREIGN KEY ("campaignReportId") REFERENCES "CampaignReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignReportScreenshot" ADD CONSTRAINT "CampaignReportScreenshot_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignInvoice" ADD CONSTRAINT "CampaignInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignInvoice" ADD CONSTRAINT "CampaignInvoice_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignInvoice" ADD CONSTRAINT "CampaignInvoice_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignBudgetHold" ADD CONSTRAINT "CampaignBudgetHold_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignBudgetHold" ADD CONSTRAINT "CampaignBudgetHold_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignBudgetHold" ADD CONSTRAINT "CampaignBudgetHold_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CampaignInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignSpendEntry" ADD CONSTRAINT "CampaignSpendEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignSpendEntry" ADD CONSTRAINT "CampaignSpendEntry_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "ManualAdPlacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventOutbox" ADD CONSTRAINT "EventOutbox_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
