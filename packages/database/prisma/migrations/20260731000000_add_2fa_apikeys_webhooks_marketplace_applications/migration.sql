-- Two-factor auth fields on User, TwoFactorBackupCode
-- API keys, outgoing webhook subscriptions/deliveries
-- Marketplace agency/creator applications
-- Team member invite tracking

-- ─── User: 2FA fields ────────────────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN "totpSecretEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);

CREATE TABLE "TwoFactorBackupCode" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL,
  "codeHash"  TEXT NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TwoFactorBackupCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TwoFactorBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TwoFactorBackupCode_userId_usedAt_idx" ON "TwoFactorBackupCode"("userId", "usedAt");

-- ─── TeamMember: invite tracking ────────────────────────────────────────────

ALTER TABLE "TeamMember" ADD COLUMN "invitedByUserId" TEXT;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Developer API keys ──────────────────────────────────────────────────────

CREATE TYPE "ApiKeyEnvironment" AS ENUM ('TEST', 'PRODUCTION');

CREATE TABLE "ApiKey" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"     TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "environment"     "ApiKeyEnvironment" NOT NULL DEFAULT 'TEST',
  "keyPrefix"       TEXT NOT NULL,
  "keyHash"         TEXT NOT NULL,
  "scopes"          TEXT[] NOT NULL DEFAULT '{}',
  "lastUsedAt"      TIMESTAMP(3),
  "revokedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ApiKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_workspaceId_revokedAt_idx" ON "ApiKey"("workspaceId", "revokedAt");

-- ─── Outgoing webhooks ───────────────────────────────────────────────────────

CREATE TABLE "OutgoingWebhookSubscription" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"     TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "targetUrl"       TEXT NOT NULL,
  "events"          TEXT[] NOT NULL DEFAULT '{}',
  "signingSecret"   TEXT NOT NULL,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutgoingWebhookSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OutgoingWebhookSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OutgoingWebhookSubscription_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OutgoingWebhookSubscription_workspaceId_isActive_idx" ON "OutgoingWebhookSubscription"("workspaceId", "isActive");

CREATE TABLE "OutgoingWebhookDelivery" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "subscriptionId" TEXT NOT NULL,
  "eventName"      TEXT NOT NULL,
  "payload"        JSONB NOT NULL DEFAULT '{}',
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "responseStatus" INTEGER,
  "lastAttemptAt"  TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutgoingWebhookDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OutgoingWebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OutgoingWebhookSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OutgoingWebhookDelivery_subscriptionId_createdAt_idx" ON "OutgoingWebhookDelivery"("subscriptionId", "createdAt");
CREATE INDEX "OutgoingWebhookDelivery_eventName_status_idx" ON "OutgoingWebhookDelivery"("eventName", "status");

-- ─── Marketplace listing applications ──────────────────────────────────────

CREATE TYPE "MarketplaceApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "MarketplaceAgencyApplication" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"        TEXT NOT NULL,
  "applicantUserId"    TEXT NOT NULL,
  "status"             "MarketplaceApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "name"               TEXT NOT NULL,
  "specialty"          TEXT NOT NULL,
  "location"           TEXT NOT NULL,
  "description"        TEXT NOT NULL,
  "packages"           TEXT[] NOT NULL DEFAULT '{}',
  "reviewedByUserId"   TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "rejectionReason"    TEXT,
  "resultingListingId" TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceAgencyApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceAgencyApplication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceAgencyApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceAgencyApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "MarketplaceAgencyApplication_workspaceId_status_idx" ON "MarketplaceAgencyApplication"("workspaceId", "status");
CREATE INDEX "MarketplaceAgencyApplication_status_createdAt_idx" ON "MarketplaceAgencyApplication"("status", "createdAt");

CREATE TABLE "MarketplaceCreatorApplication" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"        TEXT NOT NULL,
  "applicantUserId"    TEXT NOT NULL,
  "status"             "MarketplaceApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "name"               TEXT NOT NULL,
  "niche"              TEXT NOT NULL,
  "bio"                TEXT NOT NULL,
  "followerCount"      INTEGER NOT NULL DEFAULT 0,
  "languages"          TEXT[] NOT NULL DEFAULT '{}',
  "platforms"          TEXT[] NOT NULL DEFAULT '{}',
  "rateMinor"          INTEGER NOT NULL DEFAULT 0,
  "reviewedByUserId"   TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "rejectionReason"    TEXT,
  "resultingListingId" TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceCreatorApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCreatorApplication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceCreatorApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceCreatorApplication_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "MarketplaceCreatorApplication_workspaceId_status_idx" ON "MarketplaceCreatorApplication"("workspaceId", "status");
CREATE INDEX "MarketplaceCreatorApplication_status_createdAt_idx" ON "MarketplaceCreatorApplication"("status", "createdAt");
