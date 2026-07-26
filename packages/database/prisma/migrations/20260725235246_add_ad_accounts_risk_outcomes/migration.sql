-- CreateEnum
CREATE TYPE "AdAccountType" AS ENUM ('CONNECTED', 'MANAGED', 'DEDICATED');

-- CreateEnum
CREATE TYPE "AdAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'TIKTOK', 'GOOGLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "KycTier" AS ENUM ('LIGHT', 'STANDARD', 'ENHANCED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignRiskAction" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK');

-- CreateEnum
CREATE TYPE "CampaignOutcomeSource" AS ENUM ('CUSTOMER_PROMPT', 'PLATFORM_DERIVED', 'OPERATOR');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "adAccountId" TEXT,
ADD COLUMN     "riskAction" "CampaignRiskAction",
ADD COLUMN     "riskScore" INTEGER;

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "AdAccountType" NOT NULL,
    "platform" "AdPlatform" NOT NULL DEFAULT 'META',
    "status" "AdAccountStatus" NOT NULL DEFAULT 'PENDING',
    "kycTier" "KycTier" NOT NULL DEFAULT 'LIGHT',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "riskTier" TEXT NOT NULL DEFAULT 'STANDARD',
    "label" TEXT NOT NULL,
    "walletId" TEXT,
    "connectedByUserId" TEXT,
    "externalBusinessId" TEXT,
    "externalAccountId" TEXT,
    "externalPageId" TEXT,
    "dailySpendCapMinor" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRiskAssessment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "action" "CampaignRiskAction" NOT NULL DEFAULT 'REVIEW',
    "tier" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoLaunchEligible" BOOLEAN NOT NULL DEFAULT false,
    "assessedByUserId" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignRiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignOutcome" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "messagesCount" INTEGER,
    "ordersCount" INTEGER,
    "estRevenueMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "rating" INTEGER,
    "wouldRunAgain" BOOLEAN,
    "source" "CampaignOutcomeSource" NOT NULL DEFAULT 'CUSTOMER_PROMPT',
    "capturedByUserId" TEXT,
    "capturedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdAccount_workspaceId_type_status_idx" ON "AdAccount"("workspaceId", "type", "status");

-- CreateIndex
CREATE INDEX "AdAccount_platform_externalAccountId_idx" ON "AdAccount"("platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "AdAccount_deletedAt_idx" ON "AdAccount"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRiskAssessment_campaignId_key" ON "CampaignRiskAssessment"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignRiskAssessment_action_score_idx" ON "CampaignRiskAssessment"("action", "score");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignOutcome_campaignId_key" ON "CampaignOutcome"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignOutcome_wouldRunAgain_idx" ON "CampaignOutcome"("wouldRunAgain");

-- CreateIndex
CREATE INDEX "CampaignOutcome_source_capturedAt_idx" ON "CampaignOutcome"("source", "capturedAt");

-- CreateIndex
CREATE INDEX "Campaign_adAccountId_status_idx" ON "Campaign"("adAccountId", "status");

-- CreateIndex
CREATE INDEX "Campaign_riskAction_status_idx" ON "Campaign"("riskAction", "status");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRiskAssessment" ADD CONSTRAINT "CampaignRiskAssessment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignOutcome" ADD CONSTRAINT "CampaignOutcome_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "digital_access_wallet_charges_workspace_id_status_created_at_id" RENAME TO "digital_access_wallet_charges_workspace_id_status_created_a_idx";

