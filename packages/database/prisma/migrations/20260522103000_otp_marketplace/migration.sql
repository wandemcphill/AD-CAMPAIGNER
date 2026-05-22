-- CreateEnum
CREATE TYPE "OtpProviderTier" AS ENUM ('PREMIUM', 'BUDGET');

-- CreateEnum
CREATE TYPE "OtpProviderStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'DISABLED');

-- CreateEnum
CREATE TYPE "OtpOrderStatus" AS ENUM ('QUOTED', 'CHARGED', 'ALLOCATING', 'WAITING', 'RECEIVED', 'COMPLETED', 'EXPIRED', 'REFUNDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OtpWalletChargeStatus" AS ENUM ('CHARGED', 'REFUNDED', 'FAILED');

-- AlterTable
ALTER TABLE "LedgerEntry"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "OtpService" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "providerTier" "OtpProviderTier" NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "visible" BOOLEAN NOT NULL DEFAULT false,
  "requiresAdminApproval" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "OtpService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpProviderConfig" (
  "id" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "tier" "OtpProviderTier" NOT NULL,
  "status" "OtpProviderStatus" NOT NULL DEFAULT 'DISABLED',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "markupBps" INTEGER NOT NULL DEFAULT 5500,
  "enabledCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "enabledServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "OtpProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpOrder" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "providerTier" "OtpProviderTier" NOT NULL,
  "providerName" TEXT,
  "providerReference" TEXT,
  "status" "OtpOrderStatus" NOT NULL DEFAULT 'QUOTED',
  "phoneNumberMasked" TEXT,
  "expiresAt" TIMESTAMP(3),
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "supplierCostMinor" INTEGER NOT NULL,
  "supplierCurrency" TEXT NOT NULL DEFAULT 'USD',
  "idempotencyKey" TEXT NOT NULL,
  "attestationAccepted" BOOLEAN NOT NULL DEFAULT false,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "requestIpAddress" TEXT,
  "requestUserAgent" TEXT,
  "requestDeviceId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "OtpOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpMessage" (
  "id" TEXT NOT NULL,
  "otpOrderId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "redactedMessage" TEXT NOT NULL,
  "messageTextEncrypted" TEXT,
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OtpMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpProviderHealth" (
  "id" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "tier" "OtpProviderTier" NOT NULL,
  "status" "OtpProviderStatus" NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "successRateBps" INTEGER NOT NULL,
  "balanceMinor" INTEGER,
  "currency" TEXT,
  "reason" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OtpProviderHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpWalletCharge" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "otpOrderId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "OtpWalletChargeStatus" NOT NULL DEFAULT 'CHARGED',
  "debitLedgerEntryId" TEXT,
  "refundLedgerEntryId" TEXT,
  "providerName" TEXT,
  "providerReference" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OtpWalletCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpRoutingAttempt" (
  "id" TEXT NOT NULL,
  "otpOrderId" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "providerTier" "OtpProviderTier" NOT NULL,
  "score" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OtpRoutingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpPricingRule" (
  "id" TEXT NOT NULL,
  "tier" "OtpProviderTier" NOT NULL,
  "markupBps" INTEGER NOT NULL,
  "minimumMarginMinor" INTEGER NOT NULL,
  "platformFeeMinor" INTEGER NOT NULL,
  "customerCurrency" TEXT NOT NULL DEFAULT 'NGN',
  "usdToNgnRate" INTEGER NOT NULL DEFAULT 1600,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OtpPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");
CREATE INDEX "LedgerEntry_sourceType_sourceId_idx" ON "LedgerEntry"("sourceType", "sourceId");
CREATE UNIQUE INDEX "OtpService_code_countryCode_providerTier_key" ON "OtpService"("code", "countryCode", "providerTier");
CREATE INDEX "OtpService_countryCode_visible_idx" ON "OtpService"("countryCode", "visible");
CREATE INDEX "OtpService_providerTier_visible_idx" ON "OtpService"("providerTier", "visible");
CREATE INDEX "OtpService_deletedAt_idx" ON "OtpService"("deletedAt");
CREATE UNIQUE INDEX "OtpProviderConfig_providerName_key" ON "OtpProviderConfig"("providerName");
CREATE INDEX "OtpProviderConfig_tier_status_idx" ON "OtpProviderConfig"("tier", "status");
CREATE INDEX "OtpProviderConfig_deletedAt_idx" ON "OtpProviderConfig"("deletedAt");
CREATE UNIQUE INDEX "OtpOrder_idempotencyKey_key" ON "OtpOrder"("idempotencyKey");
CREATE INDEX "OtpOrder_workspaceId_status_createdAt_idx" ON "OtpOrder"("workspaceId", "status", "createdAt");
CREATE INDEX "OtpOrder_providerName_providerReference_idx" ON "OtpOrder"("providerName", "providerReference");
CREATE INDEX "OtpOrder_serviceCode_countryCode_idx" ON "OtpOrder"("serviceCode", "countryCode");
CREATE INDEX "OtpOrder_deletedAt_idx" ON "OtpOrder"("deletedAt");
CREATE INDEX "OtpMessage_otpOrderId_receivedAt_idx" ON "OtpMessage"("otpOrderId", "receivedAt");
CREATE INDEX "OtpProviderHealth_providerName_checkedAt_idx" ON "OtpProviderHealth"("providerName", "checkedAt");
CREATE INDEX "OtpProviderHealth_tier_status_checkedAt_idx" ON "OtpProviderHealth"("tier", "status", "checkedAt");
CREATE UNIQUE INDEX "OtpWalletCharge_idempotencyKey_key" ON "OtpWalletCharge"("idempotencyKey");
CREATE UNIQUE INDEX "OtpWalletCharge_workspaceId_otpOrderId_key" ON "OtpWalletCharge"("workspaceId", "otpOrderId");
CREATE INDEX "OtpWalletCharge_workspaceId_status_createdAt_idx" ON "OtpWalletCharge"("workspaceId", "status", "createdAt");
CREATE INDEX "OtpWalletCharge_walletId_createdAt_idx" ON "OtpWalletCharge"("walletId", "createdAt");
CREATE INDEX "OtpWalletCharge_providerName_providerReference_idx" ON "OtpWalletCharge"("providerName", "providerReference");
CREATE INDEX "OtpRoutingAttempt_otpOrderId_createdAt_idx" ON "OtpRoutingAttempt"("otpOrderId", "createdAt");
CREATE INDEX "OtpRoutingAttempt_providerName_status_createdAt_idx" ON "OtpRoutingAttempt"("providerName", "status", "createdAt");
CREATE INDEX "OtpPricingRule_tier_active_idx" ON "OtpPricingRule"("tier", "active");

-- AddForeignKey
ALTER TABLE "OtpOrder" ADD CONSTRAINT "OtpOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtpMessage" ADD CONSTRAINT "OtpMessage_otpOrderId_fkey" FOREIGN KEY ("otpOrderId") REFERENCES "OtpOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtpWalletCharge" ADD CONSTRAINT "OtpWalletCharge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtpWalletCharge" ADD CONSTRAINT "OtpWalletCharge_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtpWalletCharge" ADD CONSTRAINT "OtpWalletCharge_otpOrderId_fkey" FOREIGN KEY ("otpOrderId") REFERENCES "OtpOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtpRoutingAttempt" ADD CONSTRAINT "OtpRoutingAttempt_otpOrderId_fkey" FOREIGN KEY ("otpOrderId") REFERENCES "OtpOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
