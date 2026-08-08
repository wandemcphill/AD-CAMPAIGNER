-- Migration: VTU routing engine models
-- Adds: VtuProviderStatus enum, VtuPricingSourceType enum,
--       VtuCanonicalSku, VtuProviderSkuMapping, VtuProviderPricingHistory,
--       VtuProviderBalance, VtuProviderConfig, VtuQuote

-- New enums

CREATE TYPE "VtuProviderStatus" AS ENUM (
  'DISCOVERED',
  'CONFIGURED',
  'SANDBOX',
  'VERIFIED',
  'PRODUCTION_READY',
  'ACTIVE',
  'PAUSED',
  'DEGRADED',
  'DISABLED',
  'BLOCKED_PENDING_CREDENTIALS'
);

CREATE TYPE "VtuPricingSourceType" AS ENUM (
  'RESEARCHED_PUBLIC_PRICE',
  'LIVE_PROVIDER',
  'MANUAL_OVERRIDE'
);

-- VtuCanonicalSku: provider-agnostic product SKU

CREATE TABLE "VtuCanonicalSku" (
  "id"           TEXT NOT NULL,
  "category"     TEXT NOT NULL,
  "network"      TEXT,
  "displayName"  TEXT NOT NULL,
  "sizeMb"       INTEGER,
  "unit"         TEXT,
  "validityDays" INTEGER,
  "planType"     TEXT,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "adminApproved" BOOLEAN NOT NULL DEFAULT false,
  "sellingPriceMinor" INTEGER,
  "minMarginBps" INTEGER NOT NULL DEFAULT 200,
  "metadata"     JSONB NOT NULL DEFAULT '{}',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VtuCanonicalSku_pkey" PRIMARY KEY ("id")
);

-- VtuProviderSkuMapping: maps a provider's internal SKU onto a canonical SKU

CREATE TABLE "VtuProviderSkuMapping" (
  "id"                TEXT NOT NULL,
  "canonicalSkuId"    TEXT NOT NULL,
  "providerName"      TEXT NOT NULL,
  "providerSku"       TEXT NOT NULL,
  "costMinor"         INTEGER NOT NULL,
  "pricingSourceType" "VtuPricingSourceType" NOT NULL DEFAULT 'RESEARCHED_PUBLIC_PRICE',
  "adminApproved"     BOOLEAN NOT NULL DEFAULT false,
  "active"            BOOLEAN NOT NULL DEFAULT true,
  "lastVerifiedAt"    TIMESTAMP(3),
  "lastSyncedAt"      TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VtuProviderSkuMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VtuProviderSkuMapping_providerName_providerSku_key"
  ON "VtuProviderSkuMapping"("providerName", "providerSku");

ALTER TABLE "VtuProviderSkuMapping"
  ADD CONSTRAINT "VtuProviderSkuMapping_canonicalSkuId_fkey"
  FOREIGN KEY ("canonicalSkuId") REFERENCES "VtuCanonicalSku"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- VtuProviderPricingHistory: audit trail for cost changes

CREATE TABLE "VtuProviderPricingHistory" (
  "id"            TEXT NOT NULL,
  "providerName"  TEXT NOT NULL,
  "providerSku"   TEXT NOT NULL,
  "oldCostMinor"  INTEGER,
  "newCostMinor"  INTEGER NOT NULL,
  "sourceType"    "VtuPricingSourceType" NOT NULL,
  "changedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VtuProviderPricingHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VtuProviderPricingHistory_providerName_providerSku_idx"
  ON "VtuProviderPricingHistory"("providerName", "providerSku");

-- VtuProviderBalance: latest balance snapshot per provider

CREATE TABLE "VtuProviderBalance" (
  "id"           TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "balanceMinor" INTEGER NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'HEALTHY',
  "threshold"    INTEGER NOT NULL DEFAULT 0,
  "checkedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VtuProviderBalance_pkey" PRIMARY KEY ("id")
);

-- Note: VtuProviderBalance already exists with an @@index on (providerName, checkedAt).
-- This adds the @@unique([providerName]) so upsert works.
-- If VtuProviderBalance was created before this migration with duplicate providerName rows,
-- run: DELETE FROM "VtuProviderBalance" a USING "VtuProviderBalance" b WHERE a.id > b.id AND a."providerName" = b."providerName";
CREATE UNIQUE INDEX "VtuProviderBalance_providerName_key"
  ON "VtuProviderBalance"("providerName");

-- VtuProviderConfig: routing weights, caps, and status per provider

CREATE TABLE "VtuProviderConfig" (
  "id"                    TEXT NOT NULL,
  "providerName"          TEXT NOT NULL,
  "displayName"           TEXT NOT NULL,
  "status"                "VtuProviderStatus" NOT NULL DEFAULT 'DISCOVERED',
  "enabledServices"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priority"              INTEGER NOT NULL DEFAULT 100,
  "costWeight"            INTEGER NOT NULL DEFAULT 70,
  "successRateWeight"     INTEGER NOT NULL DEFAULT 20,
  "latencyWeight"         INTEGER NOT NULL DEFAULT 5,
  "balanceWeight"         INTEGER NOT NULL DEFAULT 5,
  "minBalanceMinor"       INTEGER NOT NULL DEFAULT 0,
  "maxTransactionMinor"   INTEGER NOT NULL DEFAULT 50000000,
  "trafficAllocationPct"  INTEGER NOT NULL DEFAULT 100,
  "maintenanceMode"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VtuProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VtuProviderConfig_providerName_key"
  ON "VtuProviderConfig"("providerName");

-- VtuQuote: price-locked quote for a VTU procurement (15-minute TTL)

CREATE TABLE "VtuQuote" (
  "id"                  TEXT NOT NULL,
  "canonicalSkuId"      TEXT,
  "providerName"        TEXT NOT NULL,
  "providerSku"         TEXT NOT NULL,
  "productType"         TEXT NOT NULL,
  "network"             TEXT,
  "costMinor"           INTEGER NOT NULL,
  "customerPriceMinor"  INTEGER NOT NULL,
  "markupMinor"         INTEGER NOT NULL,
  "markupBps"           INTEGER NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'NGN',
  "expiresAt"           TIMESTAMP(3) NOT NULL,
  "usedAt"              TIMESTAMP(3),
  "orderId"             TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VtuQuote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VtuQuote_providerName_productType_idx"
  ON "VtuQuote"("providerName", "productType");

CREATE INDEX "VtuQuote_expiresAt_usedAt_idx"
  ON "VtuQuote"("expiresAt", "usedAt");
