-- CreateEnum
CREATE TYPE "FinancialReconciliationKind" AS ENUM ('MISSING_AT_PROVIDER', 'MISSING_INTERNALLY', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'STATUS_MISMATCH', 'FEE_MISMATCH', 'DUPLICATE_AT_PROVIDER', 'AMBIGUOUS_PROVIDER_RESULT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FinancialReconciliationStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'WONT_FIX');

-- CreateEnum
CREATE TYPE "FinancialCapability" AS ENUM ('NGN_VIRTUAL_ACCOUNT', 'USD_VIRTUAL_ACCOUNT', 'GBP_VIRTUAL_ACCOUNT', 'EUR_VIRTUAL_ACCOUNT', 'CAD_VIRTUAL_ACCOUNT', 'NGN_COLLECTION', 'INTERNATIONAL_COLLECTION', 'NGN_PAYOUT', 'INTERNATIONAL_PAYOUT', 'FX_CONVERSION', 'REMITTANCE', 'VIRTUAL_CARD', 'PHYSICAL_CARD', 'ACCOUNT_VERIFICATION', 'BENEFICIARY_MANAGEMENT', 'WEBHOOKS', 'IDEMPOTENCY');

-- CreateEnum
CREATE TYPE "WalletWithdrawalStatus" AS ENUM ('HOLD', 'PROCESSING', 'COMPLETED', 'FAILED', 'RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "KycVerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'REQUIRES_ACTION');

-- CreateEnum
CREATE TYPE "KycVerificationLevel" AS ENUM ('LIGHT', 'STANDARD', 'ENHANCED');

-- CreateEnum
CREATE TYPE "KybApplicationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_ACTION');

-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('GIFT_CARD', 'AIRTIME_PIN', 'RECHARGE_VOUCHER', 'DIGITAL_COUPON');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'REVIEW', 'REJECTED', 'DISPUTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PASS', 'FAIL', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "ValidationRunStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationReason" AS ENUM ('VERDICT_REVIEW', 'SYSTEM_FAILURE', 'ESCALATION_MANUAL', 'FRAUD_SIGNAL_AMBIGUOUS', 'USER_DISPUTE');

-- AlterEnum
ALTER TYPE "ProviderDomain" ADD VALUE 'KYC';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RemittanceTransferStatus" ADD VALUE 'UNKNOWN';
ALTER TYPE "RemittanceTransferStatus" ADD VALUE 'RECONCILIATION_REQUIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VtuProductType" ADD VALUE 'ELECTRICITY';
ALTER TYPE "VtuProductType" ADD VALUE 'CABLE';

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_workspaceId_fkey";

-- DropIndex
DROP INDEX "VtuProviderPricingHistory_providerName_providerSku_idx";

-- DropIndex
DROP INDEX "VtuQuote_expiresAt_usedAt_idx";

-- DropIndex
DROP INDEX "VtuQuote_providerName_productType_idx";

-- AlterTable
ALTER TABLE "AirtimeCashoutQuote" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AirtimeCashoutTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApprovalRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CryptoDepositAddress" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CryptoSellTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FxQuote" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FxRateCache" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GiftCardProduct" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GiftCardPurchaseQuote" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GiftCardPurchaseTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GiftCardSellQuote" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GiftCardSellTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GiftCardWalletCharge" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GrowthServiceOverride" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GuestTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProviderMapping" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProviderWebhookEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RemittanceTransfer" ADD COLUMN     "executedDestinationAmountMinor" INTEGER,
ADD COLUMN     "executedFeeMinor" INTEGER,
ADD COLUMN     "executedRate" DOUBLE PRECISION,
ADD COLUMN     "isLockedQuote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quotedRate" DOUBLE PRECISION,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RemittanceWalletCharge" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RmbOrder" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SettlementAlert" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SettlementBeneficiary" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SettlementInstruction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SettlementReconciliation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SettlementWebhookEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupportTicketReply" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualAccount" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualCard" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualCardWalletCharge" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuBettingCompany" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuCablePackage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuCanonicalSku" ADD COLUMN     "productFamily" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuEducationPlan" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuOrder" ADD COLUMN     "token" TEXT,
ALTER COLUMN "network" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VtuProviderBalance" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "VtuProviderConfig" ADD COLUMN     "notes" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuProviderPricingHistory" ADD COLUMN     "canonicalSkuId" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "sourceType" SET DEFAULT 'LIVE_PROVIDER';

-- AlterTable
ALTER TABLE "VtuProviderSkuMapping" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "providerProductName" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuQuote" ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "FinancialReconciliationException" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "domain" "ProviderDomain" NOT NULL,
    "providerName" TEXT NOT NULL,
    "kind" "FinancialReconciliationKind" NOT NULL,
    "status" "FinancialReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "internalStatus" TEXT,
    "providerStatus" TEXT,
    "internalAmountMinor" INTEGER,
    "providerAmountMinor" INTEGER,
    "internalCurrency" TEXT,
    "providerCurrency" TEXT,
    "internalFeeMinor" INTEGER,
    "providerFeeMinor" INTEGER,
    "providerReference" TEXT,
    "idempotencyKey" TEXT,
    "detail" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialReconciliationException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCapabilityGrant" (
    "id" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "capability" "FinancialCapability" NOT NULL,
    "domain" "ProviderDomain" NOT NULL,
    "documented" BOOLEAN NOT NULL DEFAULT false,
    "implemented" BOOLEAN NOT NULL DEFAULT false,
    "sandboxVerified" BOOLEAN NOT NULL DEFAULT false,
    "kybApproved" BOOLEAN NOT NULL DEFAULT false,
    "complianceApproved" BOOLEAN NOT NULL DEFAULT false,
    "productionApproved" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "currencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCapabilityGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletWithdrawal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "walletId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerReference" TEXT,
    "beneficiaryId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientAccountNumber" TEXT NOT NULL,
    "recipientBankCode" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "feeMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "WalletWithdrawalStatus" NOT NULL DEFAULT 'HOLD',
    "idempotencyKey" TEXT NOT NULL,
    "holdLedgerEntryId" TEXT,
    "debitLedgerEntryId" TEXT,
    "releaseLedgerEntryId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceBeneficiary" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "nickname" TEXT,
    "recipientName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "bankName" TEXT,
    "bankCode" TEXT,
    "accountNumber" TEXT,
    "mobileNumber" TEXT,
    "payoutMethod" TEXT NOT NULL DEFAULT 'BANK_ACCOUNT',
    "providerBeneficiaryId" TEXT,
    "verifiedName" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemittanceBeneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceCorridor" (
    "id" TEXT NOT NULL,
    "sourceCountry" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "destinationCurrency" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "primaryProvider" TEXT,
    "fallbackProvider" TEXT,
    "fxProvider" TEXT,
    "minAmountMinor" INTEGER NOT NULL DEFAULT 100,
    "maxAmountMinor" INTEGER NOT NULL DEFAULT 100000000,
    "fixedFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "percentageFeeBps" INTEGER NOT NULL DEFAULT 0,
    "etaMinutes" INTEGER NOT NULL DEFAULT 60,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemittanceCorridor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualAccountCredit" (
    "id" TEXT NOT NULL,
    "virtualAccountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "providerReference" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "senderName" TEXT,
    "senderAccount" TEXT,
    "creditLedgerEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualAccountCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerReference" TEXT,
    "country" TEXT NOT NULL,
    "level" "KycVerificationLevel" NOT NULL DEFAULT 'STANDARD',
    "status" "KycVerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "failureReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KybApplication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" "KybApplicationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "companyName" TEXT,
    "registrationNo" TEXT,
    "country" TEXT,
    "failureReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KybApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelecomOrder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productType" "VtuProductType" NOT NULL,
    "countryIso" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "operatorName" TEXT,
    "network" TEXT,
    "msisdnMasked" TEXT NOT NULL,
    "msisdnEncrypted" TEXT NOT NULL,
    "bundleId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "costMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerReference" TEXT,
    "status" "VtuOrderStatus" NOT NULL DEFAULT 'QUOTED',
    "idempotencyKey" TEXT NOT NULL,
    "failureReason" TEXT,
    "debitLedgerEntryId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelecomOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualNumberPurchaseLimit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "periodType" TEXT NOT NULL DEFAULT 'MONTH',
    "limitMinor" INTEGER NOT NULL,
    "spentMinor" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualNumberPurchaseLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualNumberReconciliation" (
    "id" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'VIRTUAL_NUMBER',
    "reportPeriodStart" TIMESTAMP(3) NOT NULL,
    "reportPeriodEnd" TIMESTAMP(3) NOT NULL,
    "providerBalanceMinor" INTEGER,
    "providerCurrency" TEXT NOT NULL DEFAULT 'USD',
    "declaredCostMinor" INTEGER NOT NULL DEFAULT 0,
    "discrepancyMinor" INTEGER,
    "discrepancyBps" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualNumberReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualNumberMarginAnalytics" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "costMinorUsd" INTEGER NOT NULL,
    "costMinorNgn" INTEGER NOT NULL,
    "sellMinorNgn" INTEGER NOT NULL,
    "marginMinorNgn" INTEGER NOT NULL DEFAULT 0,
    "marginBps" INTEGER NOT NULL DEFAULT 0,
    "expectedMarginBps" INTEGER NOT NULL DEFAULT 3500,
    "marginVarianceBps" INTEGER NOT NULL DEFAULT 0,
    "fxRateMicrosApplied" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualNumberMarginAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSubmission" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "mediaAssetId" TEXT,
    "submissionProfile" JSONB NOT NULL DEFAULT '{}',
    "lastValidationRunId" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AssetSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionSecret" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "encryptionKeyRef" TEXT NOT NULL,
    "secretKind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "pipelineVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ValidationRunStatus" NOT NULL DEFAULT 'PENDING',
    "verdict" TEXT,
    "verdictReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verdictExplained" TEXT,
    "fraudScore" INTEGER,
    "trustScore" INTEGER,
    "finalScore" INTEGER,
    "stageDurationMs" JSONB NOT NULL DEFAULT '{}',
    "totalDurationMs" INTEGER,
    "stagesFailed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stagesInconcl" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "externalCalls" INTEGER NOT NULL DEFAULT 0,
    "externalCostMicro" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageResult" (
    "id" TEXT NOT NULL,
    "validationRunId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "status" "StageStatus" NOT NULL,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resultData" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "stageResultId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "confidence" INTEGER NOT NULL,
    "weight" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "brand" TEXT,
    "regionCode" TEXT,
    "denomination" TEXT,
    "visibleText" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overallConfidence" INTEGER NOT NULL,
    "fieldConfidence" JSONB NOT NULL DEFAULT '{}',
    "ocrEngine" TEXT NOT NULL,
    "detectedCodeCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageQualityResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "blurScore" INTEGER NOT NULL,
    "darkScore" INTEGER NOT NULL,
    "glareScore" INTEGER NOT NULL,
    "exposureOk" BOOLEAN NOT NULL,
    "croppingDetected" BOOLEAN NOT NULL,
    "partialCardVisible" BOOLEAN NOT NULL,
    "rotationDegrees" INTEGER,
    "perspective" TEXT,
    "metrics" JSONB NOT NULL,
    "assessmentEngine" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageQualityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRuleSet" (
    "id" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "brand" TEXT NOT NULL,
    "region" TEXT,
    "minDenomination" INTEGER,
    "maxDenomination" INTEGER,
    "allowedDenominations" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "ecodeLengthMin" INTEGER,
    "ecodeLengthMax" INTEGER,
    "ecodeFormatRegex" TEXT,
    "minQualityScore" INTEGER NOT NULL DEFAULT 50,
    "requireFullCard" BOOLEAN NOT NULL DEFAULT true,
    "requireNoCropping" BOOLEAN NOT NULL DEFAULT false,
    "allowPartialOcr" BOOLEAN NOT NULL DEFAULT false,
    "suspectIfOcrMismatchConfidence" INTEGER NOT NULL DEFAULT 30,
    "duplicateHarsh" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationQueue" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "validationRunId" TEXT,
    "reason" "ModerationReason" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decision" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialReconciliationException_status_createdAt_idx" ON "FinancialReconciliationException"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialReconciliationException_providerName_status_idx" ON "FinancialReconciliationException"("providerName", "status");

-- CreateIndex
CREATE INDEX "FinancialReconciliationException_workspaceId_status_idx" ON "FinancialReconciliationException"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialReconciliationException_resourceType_resourceId_ki_key" ON "FinancialReconciliationException"("resourceType", "resourceId", "kind");

-- CreateIndex
CREATE INDEX "ProviderCapabilityGrant_capability_enabled_priority_idx" ON "ProviderCapabilityGrant"("capability", "enabled", "priority");

-- CreateIndex
CREATE INDEX "ProviderCapabilityGrant_domain_enabled_idx" ON "ProviderCapabilityGrant"("domain", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCapabilityGrant_providerName_capability_key" ON "ProviderCapabilityGrant"("providerName", "capability");

-- CreateIndex
CREATE UNIQUE INDEX "WalletWithdrawal_idempotencyKey_key" ON "WalletWithdrawal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_workspaceId_status_idx" ON "WalletWithdrawal"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_walletId_idx" ON "WalletWithdrawal"("walletId");

-- CreateIndex
CREATE INDEX "RemittanceBeneficiary_workspaceId_country_idx" ON "RemittanceBeneficiary"("workspaceId", "country");

-- CreateIndex
CREATE INDEX "RemittanceBeneficiary_userId_idx" ON "RemittanceBeneficiary"("userId");

-- CreateIndex
CREATE INDEX "RemittanceCorridor_sourceCountry_destinationCountry_enabled_idx" ON "RemittanceCorridor"("sourceCountry", "destinationCountry", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceCorridor_sourceCountry_sourceCurrency_destination_key" ON "RemittanceCorridor"("sourceCountry", "sourceCurrency", "destinationCountry", "destinationCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccountCredit_providerEventId_key" ON "VirtualAccountCredit"("providerEventId");

-- CreateIndex
CREATE INDEX "VirtualAccountCredit_workspaceId_status_idx" ON "VirtualAccountCredit"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "VirtualAccountCredit_virtualAccountId_idx" ON "VirtualAccountCredit"("virtualAccountId");

-- CreateIndex
CREATE INDEX "KycVerification_userId_status_idx" ON "KycVerification"("userId", "status");

-- CreateIndex
CREATE INDEX "KycVerification_workspaceId_status_idx" ON "KycVerification"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KycVerification_userId_providerName_level_key" ON "KycVerification"("userId", "providerName", "level");

-- CreateIndex
CREATE UNIQUE INDEX "KybApplication_workspaceId_key" ON "KybApplication"("workspaceId");

-- CreateIndex
CREATE INDEX "KybApplication_status_idx" ON "KybApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TelecomOrder_idempotencyKey_key" ON "TelecomOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TelecomOrder_workspaceId_status_createdAt_idx" ON "TelecomOrder"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TelecomOrder_providerName_providerReference_idx" ON "TelecomOrder"("providerName", "providerReference");

-- CreateIndex
CREATE INDEX "TelecomOrder_countryIso_status_idx" ON "TelecomOrder"("countryIso", "status");

-- CreateIndex
CREATE INDEX "VirtualNumberPurchaseLimit_workspaceId_userId_periodStart_p_idx" ON "VirtualNumberPurchaseLimit"("workspaceId", "userId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "VirtualNumberReconciliation_providerName_reportPeriodStart__idx" ON "VirtualNumberReconciliation"("providerName", "reportPeriodStart", "reportPeriodEnd");

-- CreateIndex
CREATE INDEX "VirtualNumberReconciliation_status_createdAt_idx" ON "VirtualNumberReconciliation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VirtualNumberMarginAnalytics_countryCode_providerName_creat_idx" ON "VirtualNumberMarginAnalytics"("countryCode", "providerName", "createdAt");

-- CreateIndex
CREATE INDEX "VirtualNumberMarginAnalytics_marginVarianceBps_createdAt_idx" ON "VirtualNumberMarginAnalytics"("marginVarianceBps", "createdAt");

-- CreateIndex
CREATE INDEX "AssetSubmission_workspaceId_status_createdAt_idx" ON "AssetSubmission"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AssetSubmission_userId_assetClass_createdAt_idx" ON "AssetSubmission"("userId", "assetClass", "createdAt");

-- CreateIndex
CREATE INDEX "AssetSubmission_status_nextRetryAt_idx" ON "AssetSubmission"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "AssetSubmission_lastValidationRunId_idx" ON "AssetSubmission"("lastValidationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionSecret_submissionId_key" ON "SubmissionSecret"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionSecret_submissionId_idx" ON "SubmissionSecret"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRun_idempotencyKey_key" ON "ValidationRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ValidationRun_submissionId_createdAt_idx" ON "ValidationRun"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationRun_verdict_createdAt_idx" ON "ValidationRun"("verdict", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationRun_configVersion_createdAt_idx" ON "ValidationRun"("configVersion", "createdAt");

-- CreateIndex
CREATE INDEX "StageResult_validationRunId_stageKey_idx" ON "StageResult"("validationRunId", "stageKey");

-- CreateIndex
CREATE UNIQUE INDEX "StageResult_validationRunId_stageKey_key" ON "StageResult"("validationRunId", "stageKey");

-- CreateIndex
CREATE INDEX "Signal_stageResultId_idx" ON "Signal"("stageResultId");

-- CreateIndex
CREATE UNIQUE INDEX "OcrResult_submissionId_key" ON "OcrResult"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "OcrResult_mediaAssetId_key" ON "OcrResult"("mediaAssetId");

-- CreateIndex
CREATE INDEX "OcrResult_submissionId_createdAt_idx" ON "OcrResult"("submissionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageQualityResult_submissionId_key" ON "ImageQualityResult"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageQualityResult_mediaAssetId_key" ON "ImageQualityResult"("mediaAssetId");

-- CreateIndex
CREATE INDEX "ImageQualityResult_submissionId_idx" ON "ImageQualityResult"("submissionId");

-- CreateIndex
CREATE INDEX "BrandRuleSet_assetClass_enabled_idx" ON "BrandRuleSet"("assetClass", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "BrandRuleSet_assetClass_brand_region_key" ON "BrandRuleSet"("assetClass", "brand", "region");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationQueue_submissionId_key" ON "ModerationQueue"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationQueue_validationRunId_key" ON "ModerationQueue"("validationRunId");

-- CreateIndex
CREATE INDEX "ModerationQueue_status_createdAt_idx" ON "ModerationQueue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationQueue_reviewerUserId_status_idx" ON "ModerationQueue"("reviewerUserId", "status");

-- CreateIndex
CREATE INDEX "VtuCanonicalSku_category_network_active_idx" ON "VtuCanonicalSku"("category", "network", "active");

-- CreateIndex
CREATE INDEX "VtuCanonicalSku_adminApproved_active_idx" ON "VtuCanonicalSku"("adminApproved", "active");

-- CreateIndex
CREATE INDEX "VtuProviderBalance_providerName_checkedAt_idx" ON "VtuProviderBalance"("providerName", "checkedAt");

-- CreateIndex
CREATE INDEX "VtuProviderConfig_status_priority_idx" ON "VtuProviderConfig"("status", "priority");

-- CreateIndex
CREATE INDEX "VtuProviderPricingHistory_providerName_providerSku_changedA_idx" ON "VtuProviderPricingHistory"("providerName", "providerSku", "changedAt");

-- CreateIndex
CREATE INDEX "VtuProviderPricingHistory_canonicalSkuId_changedAt_idx" ON "VtuProviderPricingHistory"("canonicalSkuId", "changedAt");

-- CreateIndex
CREATE INDEX "VtuProviderSkuMapping_canonicalSkuId_active_adminApproved_idx" ON "VtuProviderSkuMapping"("canonicalSkuId", "active", "adminApproved");

-- CreateIndex
CREATE INDEX "VtuProviderSkuMapping_providerName_active_idx" ON "VtuProviderSkuMapping"("providerName", "active");

-- CreateIndex
CREATE INDEX "VtuQuote_orderId_idx" ON "VtuQuote"("orderId");

-- CreateIndex
CREATE INDEX "VtuQuote_expiresAt_idx" ON "VtuQuote"("expiresAt");

-- AddForeignKey
ALTER TABLE "VirtualAccountCredit" ADD CONSTRAINT "VirtualAccountCredit_virtualAccountId_fkey" FOREIGN KEY ("virtualAccountId") REFERENCES "VirtualAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelecomOrder" ADD CONSTRAINT "TelecomOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualNumberPurchaseLimit" ADD CONSTRAINT "VirtualNumberPurchaseLimit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubmission" ADD CONSTRAINT "AssetSubmission_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubmission" ADD CONSTRAINT "AssetSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSubmission" ADD CONSTRAINT "AssetSubmission_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionSecret" ADD CONSTRAINT "SubmissionSecret_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssetSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssetSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageResult" ADD CONSTRAINT "StageResult_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_stageResultId_fkey" FOREIGN KEY ("stageResultId") REFERENCES "StageResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssetSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageQualityResult" ADD CONSTRAINT "ImageQualityResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssetSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageQualityResult" ADD CONSTRAINT "ImageQualityResult_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationQueue" ADD CONSTRAINT "ModerationQueue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssetSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationQueue" ADD CONSTRAINT "ModerationQueue_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationQueue" ADD CONSTRAINT "ModerationQueue_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "MarketplaceAgency_public_rls_idx" RENAME TO "MarketplaceAgency_isActive_deletedAt_idx";

-- RenameIndex
ALTER INDEX "MarketplaceCreator_public_rls_idx" RENAME TO "MarketplaceCreator_isActive_deletedAt_idx";

-- RenameIndex
ALTER INDEX "NumberCountry_public_rls_idx" RENAME TO "NumberCountry_enabled_sortOrder_idx";

-- RenameIndex
ALTER INDEX "VirtualNumberProduct_public_rls_idx" RENAME TO "VirtualNumberProduct_active_countryCode_idx";

-- RenameIndex
ALTER INDEX "VoucherProduct_public_rls_idx" RENAME TO "VoucherProduct_active_idx";

-- RenameIndex
ALTER INDEX "VtuDataPlan_public_rls_idx" RENAME TO "VtuDataPlan_active_network_idx";

-- RenameIndex
ALTER INDEX "digital_access_categories_public_rls_idx" RENAME TO "digital_access_categories_is_active_deleted_at_sort_order_idx";

-- RenameIndex
ALTER INDEX "digital_access_plans_public_rls_idx" RENAME TO "digital_access_plans_is_active_deleted_at_service_id_idx";

-- RenameIndex
ALTER INDEX "digital_access_services_public_rls_idx" RENAME TO "digital_access_services_is_active_deleted_at_category_idx";
