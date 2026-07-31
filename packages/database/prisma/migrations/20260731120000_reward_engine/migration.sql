-- CreateEnum
CREATE TYPE "RewardCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RewardTaskType" AS ENUM ('QR_SCAN', 'REFERRAL', 'FLIPTRYBE_LINK_VISIT', 'TIKTOK_IDENTITY_BIND', 'TIKTOK_VIDEO_PUBLISH', 'CONTENT_MILESTONE', 'MANUAL_PROOF');

-- CreateEnum
CREATE TYPE "TaskCompletionStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RewardEntitlementStatus" AS ENUM ('RESERVED', 'FULFILLMENT_PENDING', 'FULFILLED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('AUTOMATIC', 'MANUAL_REVIEW', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "RewardFulfillmentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'AMBIGUOUS');

-- CreateTable
CREATE TABLE "RewardCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RewardCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "totalSlots" INTEGER NOT NULL,
    "claimedSlots" INTEGER NOT NULL DEFAULT 0,
    "rewardProductId" TEXT NOT NULL,
    "rewardValueMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "eligibilityRules" JSONB NOT NULL DEFAULT '{}',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTask" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "taskType" "RewardTaskType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "verificationConfig" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardParticipant" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "RewardParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "TaskCompletionStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "proofPayload" JSONB NOT NULL DEFAULT '{}',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardEntitlement" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "RewardEntitlementStatus" NOT NULL DEFAULT 'RESERVED',
    "rewardProductId" TEXT NOT NULL,
    "rewardValueMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "idempotencyKey" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardFulfillment" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "handler" "VoucherProductHandler" NOT NULL,
    "ledgerEntryId" TEXT,
    "vtuOrderId" TEXT,
    "providerRef" TEXT,
    "status" "RewardFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "providerRef" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardQrCode" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "maxScans" INTEGER NOT NULL DEFAULT 1,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardQrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLeaderboardEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardLeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RewardCampaign_workspaceId_status_idx" ON "RewardCampaign"("workspaceId", "status");
CREATE INDEX "RewardCampaign_status_startsAt_endsAt_idx" ON "RewardCampaign"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "RewardTask_campaignId_sortOrder_idx" ON "RewardTask"("campaignId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RewardParticipant_campaignId_userId_key" ON "RewardParticipant"("campaignId", "userId");
CREATE INDEX "RewardParticipant_userId_joinedAt_idx" ON "RewardParticipant"("userId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCompletion_idempotencyKey_key" ON "TaskCompletion"("idempotencyKey");
CREATE UNIQUE INDEX "TaskCompletion_taskId_participantId_key" ON "TaskCompletion"("taskId", "participantId");
CREATE INDEX "TaskCompletion_participantId_status_idx" ON "TaskCompletion"("participantId", "status");
CREATE INDEX "TaskCompletion_status_createdAt_idx" ON "TaskCompletion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardEntitlement_idempotencyKey_key" ON "RewardEntitlement"("idempotencyKey");
CREATE UNIQUE INDEX "RewardEntitlement_campaignId_participantId_key" ON "RewardEntitlement"("campaignId", "participantId");
CREATE INDEX "RewardEntitlement_status_campaignId_idx" ON "RewardEntitlement"("status", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardFulfillment_entitlementId_key" ON "RewardFulfillment"("entitlementId");
CREATE UNIQUE INDEX "RewardFulfillment_idempotencyKey_key" ON "RewardFulfillment"("idempotencyKey");
CREATE INDEX "RewardFulfillment_status_createdAt_idx" ON "RewardFulfillment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationEvent_completionId_createdAt_idx" ON "VerificationEvent"("completionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardQrCode_token_key" ON "RewardQrCode"("token");
CREATE INDEX "RewardQrCode_campaignId_taskId_idx" ON "RewardQrCode"("campaignId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardLeaderboardEntry_campaignId_userId_key" ON "RewardLeaderboardEntry"("campaignId", "userId");
CREATE INDEX "RewardLeaderboardEntry_campaignId_rank_idx" ON "RewardLeaderboardEntry"("campaignId", "rank");

-- AddForeignKey
ALTER TABLE "RewardCampaign" ADD CONSTRAINT "RewardCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardCampaign" ADD CONSTRAINT "RewardCampaign_rewardProductId_fkey" FOREIGN KEY ("rewardProductId") REFERENCES "VoucherProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTask" ADD CONSTRAINT "RewardTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardParticipant" ADD CONSTRAINT "RewardParticipant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardParticipant" ADD CONSTRAINT "RewardParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RewardTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "RewardParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardEntitlement" ADD CONSTRAINT "RewardEntitlement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardEntitlement" ADD CONSTRAINT "RewardEntitlement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "RewardParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardEntitlement" ADD CONSTRAINT "RewardEntitlement_rewardProductId_fkey" FOREIGN KEY ("rewardProductId") REFERENCES "VoucherProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardFulfillment" ADD CONSTRAINT "RewardFulfillment_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "RewardEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "TaskCompletion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardQrCode" ADD CONSTRAINT "RewardQrCode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardQrCode" ADD CONSTRAINT "RewardQrCode_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RewardTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLeaderboardEntry" ADD CONSTRAINT "RewardLeaderboardEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
