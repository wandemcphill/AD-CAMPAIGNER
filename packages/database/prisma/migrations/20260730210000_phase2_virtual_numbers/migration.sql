-- Phase 2: Virtual Numbers (International SMS) vertical
-- Adds NumberCountry, VirtualNumberProduct, VirtualNumber, VirtualNumberMessage,
-- VirtualNumberOrder, VirtualNumberWalletCharge, NumberCompatibility.

-- ─── New enums ────────────────────────────────────────────────────────────────

CREATE TYPE "NumberCapability" AS ENUM ('SMS');
CREATE TYPE "NumberRentalKind" AS ENUM ('TEMPORARY', 'STANDARD', 'EXTENDED', 'LONG_TERM');
CREATE TYPE "VirtualNumberStatus" AS ENUM ('RESERVED', 'PROVISIONING', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'RELEASED', 'FAILED', 'SUSPENDED');
CREATE TYPE "VirtualNumberOrderKind" AS ENUM ('PURCHASE', 'RENEWAL');
CREATE TYPE "VirtualNumberOrderStatus" AS ENUM ('QUOTED', 'CHARGED', 'PROVISIONING', 'FULFILLED', 'FAILED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "NumberCompatibilityLevel" AS ENUM ('TESTED_WORKING', 'LIKELY_WORKS', 'VARIES', 'NOT_SUPPORTED', 'UNKNOWN');

-- ─── Catalog ──────────────────────────────────────────────────────────────────

CREATE TABLE "NumberCountry" (
  "isoCode"    TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "dialPrefix" TEXT NOT NULL,
  "flagEmoji"  TEXT NOT NULL,
  "enabled"    BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"  INTEGER NOT NULL DEFAULT 100,
  CONSTRAINT "NumberCountry_pkey" PRIMARY KEY ("isoCode")
);

CREATE TABLE "VirtualNumberProduct" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "countryCode"        TEXT NOT NULL,
  "capability"         "NumberCapability" NOT NULL DEFAULT 'SMS',
  "rentalKind"         "NumberRentalKind" NOT NULL,
  "durationDays"       INTEGER NOT NULL,
  "displayName"        TEXT NOT NULL,
  "active"             BOOLEAN NOT NULL DEFAULT false,
  "preferredProviders" TEXT[] NOT NULL DEFAULT '{}',
  "metadata"           JSONB NOT NULL DEFAULT '{}',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualNumberProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VirtualNumberProduct_countryCode_capability_durationDays_key" ON "VirtualNumberProduct"("countryCode", "capability", "durationDays");
CREATE INDEX "VirtualNumberProduct_countryCode_active_idx" ON "VirtualNumberProduct"("countryCode", "active");

-- ─── Instances ────────────────────────────────────────────────────────────────

CREATE TABLE "VirtualNumber" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"       TEXT NOT NULL,
  "userId"            TEXT,
  "productId"         TEXT NOT NULL,
  "providerName"      TEXT NOT NULL,
  "providerNumberId"  TEXT NOT NULL,
  "e164"              TEXT NOT NULL,
  "countryCode"       TEXT NOT NULL,
  "status"            "VirtualNumberStatus" NOT NULL DEFAULT 'RESERVED',
  "provisionedAt"     TIMESTAMP(3),
  "activatedAt"       TIMESTAMP(3),
  "expiresAt"         TIMESTAMP(3),
  "expiryWarnedAt"    TIMESTAMP(3),
  "releasedAt"        TIMESTAMP(3),
  "renewalCount"      INTEGER NOT NULL DEFAULT 0,
  "messageCount"      INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt"     TIMESTAMP(3),
  "lastPolledAt"      TIMESTAMP(3),
  "supplierCostMinor" INTEGER NOT NULL DEFAULT 0,
  "supplierCurrency"  TEXT NOT NULL DEFAULT 'USD',
  "metadata"          JSONB NOT NULL DEFAULT '{}',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualNumber_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VirtualNumber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VirtualNumber_providerName_providerNumberId_key" ON "VirtualNumber"("providerName", "providerNumberId");
CREATE INDEX "VirtualNumber_workspaceId_status_expiresAt_idx" ON "VirtualNumber"("workspaceId", "status", "expiresAt");
CREATE INDEX "VirtualNumber_status_expiresAt_idx" ON "VirtualNumber"("status", "expiresAt");

CREATE TABLE "VirtualNumberMessage" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "virtualNumberId"    TEXT NOT NULL,
  "providerMessageId"  TEXT,
  "senderRaw"          TEXT,
  "senderMasked"       TEXT NOT NULL,
  "bodyEncrypted"      TEXT NOT NULL,
  "bodyRedacted"       TEXT NOT NULL,
  "receivedAt"         TIMESTAMP(3) NOT NULL,
  "providerReceivedAt" TIMESTAMP(3),
  "providerStatus"     TEXT,
  "retainUntil"        TIMESTAMP(3) NOT NULL,
  "metadata"           JSONB NOT NULL DEFAULT '{}',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VirtualNumberMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VirtualNumberMessage_virtualNumberId_fkey" FOREIGN KEY ("virtualNumberId") REFERENCES "VirtualNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VirtualNumberMessage_virtualNumberId_providerMessageId_key" ON "VirtualNumberMessage"("virtualNumberId", "providerMessageId");
CREATE INDEX "VirtualNumberMessage_virtualNumberId_receivedAt_idx" ON "VirtualNumberMessage"("virtualNumberId", "receivedAt");
CREATE INDEX "VirtualNumberMessage_retainUntil_idx" ON "VirtualNumberMessage"("retainUntil");

-- ─── Orders and charges ────────────────────────────────────────────────────────

CREATE TABLE "VirtualNumberOrder" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"         TEXT NOT NULL,
  "userId"              TEXT,
  "productId"           TEXT NOT NULL,
  "virtualNumberId"     TEXT,
  "kind"                "VirtualNumberOrderKind" NOT NULL,
  "status"              "VirtualNumberOrderStatus" NOT NULL DEFAULT 'QUOTED',
  "amountMinor"         INTEGER NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'NGN',
  "supplierCostMinor"   INTEGER NOT NULL DEFAULT 0,
  "supplierCurrency"    TEXT NOT NULL DEFAULT 'USD',
  "fxRateId"            TEXT,
  "fxRateMicrosApplied" BIGINT,
  "providerName"        TEXT,
  "providerReference"   TEXT,
  "idempotencyKey"      TEXT NOT NULL,
  "riskScore"           INTEGER NOT NULL DEFAULT 0,
  "attestationAccepted" BOOLEAN NOT NULL DEFAULT false,
  "requestIpAddress"    TEXT,
  "requestUserAgent"    TEXT,
  "requestDeviceId"     TEXT,
  "attemptCount"        INTEGER NOT NULL DEFAULT 0,
  "failureReason"       TEXT,
  "metadata"            JSONB NOT NULL DEFAULT '{}',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualNumberOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VirtualNumberOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VirtualNumberOrder_idempotencyKey_key" ON "VirtualNumberOrder"("idempotencyKey");
CREATE INDEX "VirtualNumberOrder_workspaceId_status_createdAt_idx" ON "VirtualNumberOrder"("workspaceId", "status", "createdAt");
CREATE INDEX "VirtualNumberOrder_providerName_providerReference_idx" ON "VirtualNumberOrder"("providerName", "providerReference");

CREATE TABLE "VirtualNumberWalletCharge" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"         TEXT NOT NULL,
  "walletId"            TEXT NOT NULL,
  "orderId"             TEXT NOT NULL,
  "idempotencyKey"      TEXT NOT NULL,
  "amountMinor"         INTEGER NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'NGN',
  "status"              TEXT NOT NULL DEFAULT 'CHARGED',
  "debitLedgerEntryId"  TEXT,
  "refundLedgerEntryId" TEXT,
  "metadata"            JSONB NOT NULL DEFAULT '{}',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualNumberWalletCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VirtualNumberWalletCharge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VirtualNumberWalletCharge_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VirtualNumberWalletCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VirtualNumberOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VirtualNumberWalletCharge_idempotencyKey_key" ON "VirtualNumberWalletCharge"("idempotencyKey");
CREATE UNIQUE INDEX "VirtualNumberWalletCharge_workspaceId_orderId_key" ON "VirtualNumberWalletCharge"("workspaceId", "orderId");
CREATE INDEX "VirtualNumberWalletCharge_walletId_createdAt_idx" ON "VirtualNumberWalletCharge"("walletId", "createdAt");

-- ─── Compatibility evidence ─────────────────────────────────────────────────────

CREATE TABLE "NumberCompatibility" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "serviceKey"     TEXT NOT NULL,
  "countryCode"    TEXT,
  "providerName"   TEXT,
  "numberType"     TEXT,
  "level"          "NumberCompatibilityLevel" NOT NULL DEFAULT 'UNKNOWN',
  "successRateBps" INTEGER,
  "sampleSize"     INTEGER NOT NULL DEFAULT 0,
  "lastTestedAt"   TIMESTAMP(3),
  "evidence"       TEXT,
  "blocked"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NumberCompatibility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NumberCompatibility_service_country_provider_type_key" ON "NumberCompatibility"("serviceKey", "countryCode", "providerName", "numberType");
