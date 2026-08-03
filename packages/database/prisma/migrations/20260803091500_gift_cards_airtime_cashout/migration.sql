-- Gift cards, airtime cashout, and provider webhook event tables.
-- This migration must run before the Supabase RLS phases that secure these tables.

ALTER TYPE "ProviderDomain" ADD VALUE IF NOT EXISTS 'GIFT_CARD';
ALTER TYPE "ProviderDomain" ADD VALUE IF NOT EXISTS 'AIRTIME_CASHOUT';

CREATE TYPE "GiftCardBrand" AS ENUM (
  'APPLE',
  'AMAZON',
  'STEAM',
  'GOOGLE_PLAY',
  'PLAYSTATION',
  'XBOX',
  'RAZER_GOLD',
  'ITUNES',
  'OTHER'
);

CREATE TYPE "GiftCardRegion" AS ENUM (
  'US',
  'UK',
  'EU',
  'GLOBAL'
);

CREATE TYPE "GiftCardSellStatus" AS ENUM (
  'DRAFT',
  'QUOTED',
  'SUBMITTED',
  'PROCESSING',
  'VERIFIED',
  'APPROVED',
  'PAID',
  'COMPLETED',
  'REJECTED',
  'FAILED',
  'CANCELLED',
  'DISPUTED'
);

CREATE TYPE "GiftCardPurchaseStatus" AS ENUM (
  'CREATED',
  'AWAITING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'SUPPLIER_SELECTION',
  'PURCHASING',
  'FULFILLMENT_PENDING',
  'FULFILLED',
  'DELIVERED',
  'FAILED',
  'REFUND_PENDING',
  'REFUNDED',
  'DISPUTED'
);

CREATE TYPE "AirtimeCashoutStatus" AS ENUM (
  'INITIATED',
  'OTP_REQUIRED',
  'OTP_VERIFIED',
  'BALANCE_CHECKED',
  'QUOTED',
  'CONFIRMED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'EXPIRED',
  'DISPUTED'
);

CREATE TABLE "GiftCardProduct" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "brand"           "GiftCardBrand" NOT NULL,
  "region"          "GiftCardRegion" NOT NULL,
  "currencyCode"    TEXT NOT NULL DEFAULT 'USD',
  "minDenomination" INTEGER NOT NULL,
  "maxDenomination" INTEGER NOT NULL,
  "denominations"   INTEGER[] NOT NULL DEFAULT '{}',
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "metadata"        JSONB NOT NULL DEFAULT '{}',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiftCardProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GiftCardProduct_brand_region_key" ON "GiftCardProduct"("brand", "region");
CREATE INDEX "GiftCardProduct_active_idx" ON "GiftCardProduct"("active");

CREATE TABLE "GiftCardSellQuote" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"             TEXT NOT NULL,
  "userId"                  TEXT,
  "brand"                   "GiftCardBrand" NOT NULL,
  "region"                  "GiftCardRegion" NOT NULL,
  "denomination"            INTEGER NOT NULL,
  "currency"                TEXT NOT NULL DEFAULT 'USD',
  "providerRate"            DECIMAL(18,8) NOT NULL,
  "providerRateTimestamp"   TIMESTAMP(3) NOT NULL,
  "fliptrybeMarkupBps"      INTEGER NOT NULL DEFAULT 0,
  "fliptrybeFeeBps"         INTEGER NOT NULL DEFAULT 0,
  "quotedCustomerPayoutNgn" INTEGER NOT NULL,
  "expiresAt"               TIMESTAMP(3) NOT NULL,
  "status"                  TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftCardSellQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GiftCardSellQuote_workspaceId_expiresAt_status_idx" ON "GiftCardSellQuote"("workspaceId", "expiresAt", "status");
CREATE INDEX "GiftCardSellQuote_userId_idx" ON "GiftCardSellQuote"("userId");

CREATE TABLE "GiftCardSellTransaction" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"             TEXT NOT NULL,
  "userId"                  TEXT,
  "quoteId"                 TEXT,
  "brand"                   "GiftCardBrand" NOT NULL,
  "region"                  "GiftCardRegion" NOT NULL,
  "denomination"            INTEGER NOT NULL,
  "currency"                TEXT NOT NULL DEFAULT 'USD',
  "providerName"            TEXT NOT NULL,
  "providerTransactionId"   TEXT,
  "providerRate"            DECIMAL(18,8) NOT NULL,
  "providerRateTimestamp"   TIMESTAMP(3) NOT NULL,
  "providerPayoutNgn"       INTEGER NOT NULL,
  "fliptrybeFeeMicro"       INTEGER NOT NULL,
  "fliptrybeCommissionNgn"  INTEGER NOT NULL,
  "quotedCustomerPayoutNgn" INTEGER NOT NULL,
  "status"                  "GiftCardSellStatus" NOT NULL DEFAULT 'DRAFT',
  "cardInfoRequired"        TEXT[] NOT NULL DEFAULT '{}',
  "idempotencyKey"          TEXT NOT NULL,
  "metadata"                JSONB NOT NULL DEFAULT '{}',
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  "submittedAt"             TIMESTAMP(3),
  "completedAt"             TIMESTAMP(3),
  CONSTRAINT "GiftCardSellTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GiftCardSellTransaction_idempotencyKey_key" ON "GiftCardSellTransaction"("idempotencyKey");
CREATE INDEX "GiftCardSellTransaction_workspaceId_status_createdAt_idx" ON "GiftCardSellTransaction"("workspaceId", "status", "createdAt");
CREATE INDEX "GiftCardSellTransaction_userId_idx" ON "GiftCardSellTransaction"("userId");
CREATE INDEX "GiftCardSellTransaction_providerName_idx" ON "GiftCardSellTransaction"("providerName");
CREATE INDEX "GiftCardSellTransaction_providerTransactionId_idx" ON "GiftCardSellTransaction"("providerTransactionId");

CREATE TABLE "GiftCardPurchaseQuote" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"        TEXT NOT NULL,
  "brand"              "GiftCardBrand" NOT NULL,
  "region"             "GiftCardRegion" NOT NULL,
  "denomination"       INTEGER NOT NULL,
  "supplierName"       TEXT NOT NULL,
  "supplierCostNgn"    INTEGER NOT NULL,
  "fliptrybeMarkupBps" INTEGER NOT NULL DEFAULT 200,
  "fliptrybeMarginNgn" INTEGER NOT NULL,
  "customerPriceNgn"   INTEGER NOT NULL,
  "landedCostNgn"      INTEGER NOT NULL,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftCardPurchaseQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GiftCardPurchaseQuote_workspaceId_expiresAt_status_idx" ON "GiftCardPurchaseQuote"("workspaceId", "expiresAt", "status");
CREATE INDEX "GiftCardPurchaseQuote_supplierName_idx" ON "GiftCardPurchaseQuote"("supplierName");

CREATE TABLE "GiftCardPurchaseTransaction" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"           TEXT NOT NULL,
  "userId"                TEXT,
  "quoteId"               TEXT,
  "brand"                 "GiftCardBrand" NOT NULL,
  "region"                "GiftCardRegion" NOT NULL,
  "denomination"          INTEGER NOT NULL,
  "supplierName"          TEXT NOT NULL,
  "supplierProductId"     TEXT NOT NULL,
  "supplierCostNgn"       INTEGER NOT NULL,
  "fliptrybeMarkupBps"    INTEGER NOT NULL,
  "fliptrybeMarginNgn"    INTEGER NOT NULL,
  "customerPriceNgn"      INTEGER NOT NULL,
  "status"                "GiftCardPurchaseStatus" NOT NULL DEFAULT 'CREATED',
  "supplierOrderId"       TEXT,
  "supplierTransactionId" TEXT,
  "giftCardCode"          TEXT DEFAULT '',
  "giftCardCodeMasked"    TEXT,
  "giftCardCodeEncrypted" TEXT,
  "codeDeliveredAt"       TIMESTAMP(3),
  "idempotencyKey"        TEXT NOT NULL,
  "metadata"              JSONB NOT NULL DEFAULT '{}',
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  "paymentConfirmedAt"    TIMESTAMP(3),
  "fulfilledAt"           TIMESTAMP(3),
  "deliveredAt"           TIMESTAMP(3),
  "walletId"              TEXT,
  "ledgerEntryId"         TEXT,
  "chargeId"              TEXT,
  CONSTRAINT "GiftCardPurchaseTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GiftCardPurchaseTransaction_idempotencyKey_key" ON "GiftCardPurchaseTransaction"("idempotencyKey");
CREATE INDEX "GiftCardPurchaseTransaction_workspaceId_status_createdAt_idx" ON "GiftCardPurchaseTransaction"("workspaceId", "status", "createdAt");
CREATE INDEX "GiftCardPurchaseTransaction_userId_idx" ON "GiftCardPurchaseTransaction"("userId");
CREATE INDEX "GiftCardPurchaseTransaction_supplierName_idx" ON "GiftCardPurchaseTransaction"("supplierName");
CREATE INDEX "GiftCardPurchaseTransaction_supplierOrderId_idx" ON "GiftCardPurchaseTransaction"("supplierOrderId");
CREATE INDEX "GiftCardPurchaseTransaction_walletId_idx" ON "GiftCardPurchaseTransaction"("walletId");

CREATE TABLE "GiftCardWalletCharge" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"         TEXT NOT NULL,
  "walletId"            TEXT NOT NULL,
  "transactionId"       TEXT NOT NULL,
  "idempotencyKey"      TEXT NOT NULL,
  "amountMinor"         INTEGER NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'NGN',
  "status"              TEXT NOT NULL DEFAULT 'CHARGED',
  "debitLedgerEntryId"  TEXT,
  "refundLedgerEntryId" TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiftCardWalletCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GiftCardWalletCharge_idempotencyKey_key" ON "GiftCardWalletCharge"("idempotencyKey");
CREATE INDEX "GiftCardWalletCharge_workspaceId_status_idx" ON "GiftCardWalletCharge"("workspaceId", "status");
CREATE INDEX "GiftCardWalletCharge_walletId_idx" ON "GiftCardWalletCharge"("walletId");

CREATE TABLE "AirtimeCashoutQuote" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"          TEXT NOT NULL,
  "userId"               TEXT,
  "network"              TEXT NOT NULL,
  "phoneNumber"          VARCHAR(20) NOT NULL,
  "phoneNumberMasked"    TEXT NOT NULL,
  "requestedAmountNgn"   INTEGER NOT NULL,
  "providerFeeNgn"       INTEGER NOT NULL,
  "providerPayoutNgn"    INTEGER NOT NULL,
  "fliptrybeFeeMicroNgn" INTEGER NOT NULL,
  "customerPayoutNgn"    INTEGER NOT NULL,
  "expiresAt"            TIMESTAMP(3) NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AirtimeCashoutQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AirtimeCashoutQuote_workspaceId_expiresAt_status_idx" ON "AirtimeCashoutQuote"("workspaceId", "expiresAt", "status");
CREATE INDEX "AirtimeCashoutQuote_userId_idx" ON "AirtimeCashoutQuote"("userId");

CREATE TABLE "AirtimeCashoutTransaction" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"           TEXT NOT NULL,
  "userId"                TEXT,
  "network"               TEXT NOT NULL,
  "phoneNumber"           VARCHAR(20) NOT NULL,
  "phoneNumberMasked"     TEXT NOT NULL,
  "providerName"          TEXT NOT NULL,
  "providerTransactionId" TEXT,
  "requestedAmountNgn"    INTEGER NOT NULL,
  "providerFeeNgn"        INTEGER NOT NULL,
  "providerPayoutNgn"     INTEGER NOT NULL,
  "fliptrybeFeeMicroNgn"  INTEGER NOT NULL,
  "customerPayoutNgn"     INTEGER NOT NULL,
  "status"                "AirtimeCashoutStatus" NOT NULL DEFAULT 'INITIATED',
  "sessionId"             TEXT,
  "idempotencyKey"        TEXT NOT NULL,
  "metadata"              JSONB NOT NULL DEFAULT '{}',
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  "completedAt"           TIMESTAMP(3),
  CONSTRAINT "AirtimeCashoutTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AirtimeCashoutTransaction_idempotencyKey_key" ON "AirtimeCashoutTransaction"("idempotencyKey");
CREATE INDEX "AirtimeCashoutTransaction_workspaceId_status_createdAt_idx" ON "AirtimeCashoutTransaction"("workspaceId", "status", "createdAt");
CREATE INDEX "AirtimeCashoutTransaction_userId_idx" ON "AirtimeCashoutTransaction"("userId");
CREATE INDEX "AirtimeCashoutTransaction_network_idx" ON "AirtimeCashoutTransaction"("network");
CREATE INDEX "AirtimeCashoutTransaction_providerTransactionId_idx" ON "AirtimeCashoutTransaction"("providerTransactionId");

CREATE TABLE "ProviderWebhookEvent" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "provider"          TEXT NOT NULL,
  "domain"            TEXT NOT NULL,
  "providerEventId"   VARCHAR(255) NOT NULL,
  "eventType"         TEXT NOT NULL,
  "signature"         TEXT,
  "signatureValid"    BOOLEAN NOT NULL DEFAULT false,
  "rawPayload"        JSONB NOT NULL,
  "parsedMetadata"    JSONB NOT NULL DEFAULT '{}',
  "processed"         BOOLEAN NOT NULL DEFAULT false,
  "processedAt"       TIMESTAMP(3),
  "processError"      TEXT,
  "relatedOrderId"    TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_domain_providerEventId_key" ON "ProviderWebhookEvent"("provider", "domain", "providerEventId");
CREATE INDEX "ProviderWebhookEvent_provider_processed_createdAt_idx" ON "ProviderWebhookEvent"("provider", "processed", "createdAt");
CREATE INDEX "ProviderWebhookEvent_domain_eventType_idx" ON "ProviderWebhookEvent"("domain", "eventType");
