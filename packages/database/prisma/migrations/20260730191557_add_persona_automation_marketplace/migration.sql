-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('CREATED', 'SEALED', 'CLAIMED', 'REVEALED', 'FULFILLMENT_PENDING', 'REDEEMED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VoucherProductCategory" AS ENUM ('CAMPAIGN', 'TELECOM', 'SMM', 'CREATOR', 'GIFT', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "VoucherProductHandler" AS ENUM ('WALLET_CREDIT', 'VTU_TOPUP', 'SMM_ORDER', 'EXTERNAL_API');

-- CreateEnum
CREATE TYPE "VoucherWalletType" AS ENUM ('CAMPAIGN', 'CREATOR', 'PROMOTION', 'USER', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "PersonaType" AS ENUM ('SYNTHETIC', 'VERIFIED', 'CAST');

-- CreateEnum
CREATE TYPE "PersonaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AutomationTriggerKind" AS ENUM ('BUDGET_THRESHOLD', 'PERFORMANCE_THRESHOLD', 'SCHEDULE', 'WALLET_BALANCE', 'CREATIVE_AGE');

-- CreateEnum
CREATE TYPE "AutomationWorkflowStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DRAFT');

-- DropIndex
DROP INDEX "User_defaultWorkspaceId_idx";

-- AlterTable
ALTER TABLE "FxRate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PricingRule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProviderConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProviderHealth" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProviderRoutingAttempt" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuDataPlan" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuOrder" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuProviderRoute" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VtuWalletCharge" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "VoucherProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VoucherProductCategory" NOT NULL,
    "handler" "VoucherProductHandler" NOT NULL,
    "provider" TEXT,
    "providerServiceId" TEXT,
    "inputSchema" JSONB NOT NULL DEFAULT '{}',
    "targetWalletType" "VoucherWalletType",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "pinEncrypted" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'CREATED',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "ownerUserId" TEXT,
    "purchaserUserId" TEXT NOT NULL,
    "giftNote" TEXT,
    "redemptionInput" JSONB NOT NULL DEFAULT '{}',
    "redemptionDestination" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "revealedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherClaimToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "createdByShareActionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimedByUserId" TEXT,
    "channel" TEXT,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherClaimToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" "PersonaType" NOT NULL,
    "status" "PersonaStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "hasVoice" BOOLEAN NOT NULL DEFAULT false,
    "hasMotion" BOOLEAN NOT NULL DEFAULT false,
    "consentedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerKind" "AutomationTriggerKind" NOT NULL,
    "triggerSummary" TEXT NOT NULL,
    "actionSummary" TEXT NOT NULL,
    "status" "AutomationWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL DEFAULT '{}',
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceAgency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "ratingBps" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "campaignCount" INTEGER NOT NULL DEFAULT 0,
    "teamSize" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "packages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceAgency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCreator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "engagementBps" INTEGER NOT NULL DEFAULT 0,
    "rateMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pastCampaigns" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceCreator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoucherProduct_category_active_idx" ON "VoucherProduct"("category", "active");

-- CreateIndex
CREATE INDEX "VoucherProduct_handler_active_idx" ON "VoucherProduct"("handler", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_serialNumber_key" ON "Voucher"("serialNumber");

-- CreateIndex
CREATE INDEX "Voucher_status_expiresAt_idx" ON "Voucher"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Voucher_purchaserUserId_createdAt_idx" ON "Voucher"("purchaserUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Voucher_ownerUserId_status_idx" ON "Voucher"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "Voucher_productId_status_idx" ON "Voucher"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherClaimToken_token_key" ON "VoucherClaimToken"("token");

-- CreateIndex
CREATE INDEX "VoucherClaimToken_voucherId_tokenExpiresAt_idx" ON "VoucherClaimToken"("voucherId", "tokenExpiresAt");

-- CreateIndex
CREATE INDEX "VoucherClaimToken_claimedByUserId_claimedAt_idx" ON "VoucherClaimToken"("claimedByUserId", "claimedAt");

-- CreateIndex
CREATE INDEX "Persona_workspaceId_status_idx" ON "Persona"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Persona_deletedAt_idx" ON "Persona"("deletedAt");

-- CreateIndex
CREATE INDEX "AutomationWorkflow_workspaceId_status_idx" ON "AutomationWorkflow"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AutomationWorkflow_deletedAt_idx" ON "AutomationWorkflow"("deletedAt");

-- CreateIndex
CREATE INDEX "MarketplaceAgency_isActive_specialty_idx" ON "MarketplaceAgency"("isActive", "specialty");

-- CreateIndex
CREATE INDEX "MarketplaceAgency_deletedAt_idx" ON "MarketplaceAgency"("deletedAt");

-- CreateIndex
CREATE INDEX "MarketplaceCreator_isActive_niche_idx" ON "MarketplaceCreator"("isActive", "niche");

-- CreateIndex
CREATE INDEX "MarketplaceCreator_deletedAt_idx" ON "MarketplaceCreator"("deletedAt");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_productId_fkey" FOREIGN KEY ("productId") REFERENCES "VoucherProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_purchaserUserId_fkey" FOREIGN KEY ("purchaserUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherClaimToken" ADD CONSTRAINT "VoucherClaimToken_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherClaimToken" ADD CONSTRAINT "VoucherClaimToken_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
