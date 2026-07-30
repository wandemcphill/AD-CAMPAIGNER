-- Phase 0: Drop Otp* infra, add Provider registry, FX rate, Pricing rules, VTU models
-- No data migration needed: ENABLE_OTP_MODULE=false, zero production rows in any Otp* table.

-- Drop Otp* tables (dependent children first)
DROP TABLE IF EXISTS "OtpRoutingAttempt";
DROP TABLE IF EXISTS "OtpMessage";
DROP TABLE IF EXISTS "OtpWalletCharge";
DROP TABLE IF EXISTS "OtpOrder";
DROP TABLE IF EXISTS "OtpProviderHealth";
DROP TABLE IF EXISTS "OtpProviderConfig";
DROP TABLE IF EXISTS "OtpPricingRule";
DROP TABLE IF EXISTS "OtpService";

-- Drop Otp* enums
DROP TYPE IF EXISTS "OtpProviderTier";
DROP TYPE IF EXISTS "OtpProviderStatus";
DROP TYPE IF EXISTS "OtpOrderStatus";
DROP TYPE IF EXISTS "OtpWalletChargeStatus";

-- ─── New enums ────────────────────────────────────────────────────────────────

CREATE TYPE "ProviderDomain" AS ENUM ('VIRTUAL_NUMBER', 'VTU');
CREATE TYPE "ProviderTier" AS ENUM ('PREMIUM', 'BUDGET');
CREATE TYPE "ProviderStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'DISABLED');
CREATE TYPE "FxRateSource" AS ENUM ('MANUAL', 'CBN', 'PROVIDER_FEED');
CREATE TYPE "VtuProductType" AS ENUM ('AIRTIME', 'DATA');
CREATE TYPE "VtuNetwork" AS ENUM ('MTN', 'GLO', 'AIRTEL', 'NINE_MOBILE');
CREATE TYPE "VtuPlanType" AS ENUM ('SME', 'CG', 'GIFTING', 'CORPORATE');
CREATE TYPE "VtuOrderStatus" AS ENUM ('QUOTED', 'CHARGED', 'SUBMITTED', 'DELIVERED', 'FAILED', 'AMBIGUOUS', 'REVERSED', 'REFUNDED');

-- ─── Provider registry ────────────────────────────────────────────────────────

CREATE TABLE "ProviderConfig" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"                TEXT NOT NULL,
  "domain"              "ProviderDomain" NOT NULL,
  "tier"                "ProviderTier" NOT NULL DEFAULT 'BUDGET',
  "status"              "ProviderStatus" NOT NULL DEFAULT 'DISABLED',
  "priority"            INTEGER NOT NULL DEFAULT 100,
  "enabledCountries"    TEXT[] NOT NULL DEFAULT '{}',
  "enabledNetworks"     TEXT[] NOT NULL DEFAULT '{}',
  "enabledProductTypes" TEXT[] NOT NULL DEFAULT '{}',
  "credentialsRef"      TEXT,
  "metadata"            JSONB NOT NULL DEFAULT '{}',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  "deletedAt"           TIMESTAMP(3),
  CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderConfig_name_key" ON "ProviderConfig"("name");
CREATE INDEX "ProviderConfig_domain_status_priority_idx" ON "ProviderConfig"("domain", "status", "priority");
CREATE INDEX "ProviderConfig_deletedAt_idx" ON "ProviderConfig"("deletedAt");

CREATE TABLE "ProviderHealth" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerName"   TEXT NOT NULL,
  "domain"         "ProviderDomain" NOT NULL,
  "status"         "ProviderStatus" NOT NULL,
  "latencyMs"      INTEGER NOT NULL,
  "successRateBps" INTEGER NOT NULL,
  "balanceMinor"   INTEGER,
  "currency"       TEXT,
  "reason"         TEXT,
  "metadata"       JSONB NOT NULL DEFAULT '{}',
  "checkedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderHealth_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProviderHealth_providerName_checkedAt_idx" ON "ProviderHealth"("providerName", "checkedAt");
CREATE INDEX "ProviderHealth_domain_status_checkedAt_idx" ON "ProviderHealth"("domain", "status", "checkedAt");

CREATE TABLE "ProviderRoutingAttempt" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "domain"       "ProviderDomain" NOT NULL,
  "orderType"    TEXT NOT NULL,
  "orderId"      TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "score"        INTEGER NOT NULL,
  "status"       TEXT NOT NULL,
  "reason"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderRoutingAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProviderRoutingAttempt_orderType_orderId_createdAt_idx" ON "ProviderRoutingAttempt"("orderType", "orderId", "createdAt");
CREATE INDEX "ProviderRoutingAttempt_providerName_status_createdAt_idx" ON "ProviderRoutingAttempt"("providerName", "status", "createdAt");

-- ─── FX rate ──────────────────────────────────────────────────────────────────

CREATE TABLE "FxRate" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "baseCurrency"  TEXT NOT NULL DEFAULT 'USD',
  "quoteCurrency" TEXT NOT NULL DEFAULT 'NGN',
  "rateMicros"    BIGINT NOT NULL,
  "bufferBps"     INTEGER NOT NULL DEFAULT 0,
  "source"        "FxRateSource" NOT NULL DEFAULT 'MANUAL',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo"   TIMESTAMP(3),
  "setByUserId"   TEXT,
  "note"          TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FxRate_baseCurrency_quoteCurrency_effectiveFrom_idx" ON "FxRate"("baseCurrency", "quoteCurrency", "effectiveFrom");

-- ─── Pricing rules ────────────────────────────────────────────────────────────

CREATE TABLE "PricingRule" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "domain"             "ProviderDomain" NOT NULL,
  "countryCode"        TEXT,
  "network"            TEXT,
  "productType"        TEXT,
  "providerName"       TEXT,
  "durationDays"       INTEGER,
  "markupBps"          INTEGER NOT NULL DEFAULT 0,
  "discountBps"        INTEGER NOT NULL DEFAULT 0,
  "minimumMarginMinor" INTEGER NOT NULL DEFAULT 0,
  "platformFeeMinor"   INTEGER NOT NULL DEFAULT 0,
  "customerCurrency"   TEXT NOT NULL DEFAULT 'NGN',
  "active"             BOOLEAN NOT NULL DEFAULT true,
  "specificity"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PricingRule_domain_active_specificity_idx" ON "PricingRule"("domain", "active", "specificity");

-- ─── VTU ──────────────────────────────────────────────────────────────────────

CREATE TABLE "VtuProviderRoute" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "productType" "VtuProductType" NOT NULL,
  "network"     "VtuNetwork",
  "provider"    TEXT NOT NULL,
  "priority"    INTEGER NOT NULL,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "note"        TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "updatedBy"   TEXT,
  CONSTRAINT "VtuProviderRoute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VtuProviderRoute_productType_network_active_priority_idx" ON "VtuProviderRoute"("productType", "network", "active", "priority");

CREATE TABLE "VtuDataPlan" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerName"   TEXT NOT NULL,
  "providerPlanId" TEXT NOT NULL,
  "network"        "VtuNetwork" NOT NULL,
  "planType"       "VtuPlanType" NOT NULL,
  "displayName"    TEXT NOT NULL,
  "sizeMb"         INTEGER NOT NULL,
  "validityDays"   INTEGER NOT NULL,
  "costMinor"      INTEGER NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'NGN',
  "active"         BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VtuDataPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VtuDataPlan_providerName_providerPlanId_key" ON "VtuDataPlan"("providerName", "providerPlanId");
CREATE INDEX "VtuDataPlan_network_planType_active_idx" ON "VtuDataPlan"("network", "planType", "active");

CREATE TABLE "VtuOrder" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"       TEXT NOT NULL,
  "userId"            TEXT,
  "productType"       "VtuProductType" NOT NULL,
  "network"           "VtuNetwork" NOT NULL,
  "msisdnMasked"      TEXT NOT NULL,
  "msisdnEncrypted"   TEXT NOT NULL,
  "planId"            TEXT,
  "faceValueMinor"    INTEGER,
  "amountMinor"       INTEGER NOT NULL,
  "costMinor"         INTEGER NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'NGN',
  "providerName"      TEXT,
  "providerReference" TEXT,
  "status"            "VtuOrderStatus" NOT NULL DEFAULT 'QUOTED',
  "idempotencyKey"    TEXT NOT NULL,
  "attemptCount"      INTEGER NOT NULL DEFAULT 0,
  "failureReason"     TEXT,
  "reconciledAt"      TIMESTAMP(3),
  "requestIpAddress"  TEXT,
  "requestUserAgent"  TEXT,
  "requestDeviceId"   TEXT,
  "metadata"          JSONB NOT NULL DEFAULT '{}',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VtuOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VtuOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VtuOrder_idempotencyKey_key" ON "VtuOrder"("idempotencyKey");
CREATE INDEX "VtuOrder_workspaceId_status_createdAt_idx" ON "VtuOrder"("workspaceId", "status", "createdAt");
CREATE INDEX "VtuOrder_providerName_providerReference_idx" ON "VtuOrder"("providerName", "providerReference");
CREATE INDEX "VtuOrder_status_createdAt_idx" ON "VtuOrder"("status", "createdAt");

CREATE TABLE "VtuWalletCharge" (
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
  CONSTRAINT "VtuWalletCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VtuWalletCharge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VtuWalletCharge_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VtuWalletCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "VtuOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VtuWalletCharge_idempotencyKey_key" ON "VtuWalletCharge"("idempotencyKey");
CREATE UNIQUE INDEX "VtuWalletCharge_workspaceId_orderId_key" ON "VtuWalletCharge"("workspaceId", "orderId");
CREATE INDEX "VtuWalletCharge_walletId_createdAt_idx" ON "VtuWalletCharge"("walletId", "createdAt");
