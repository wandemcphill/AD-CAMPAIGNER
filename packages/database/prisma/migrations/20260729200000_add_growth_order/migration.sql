-- CreateEnum
CREATE TYPE "GrowthServicePlatform" AS ENUM ('TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'TELEGRAM', 'WEBSITE');

-- CreateEnum
CREATE TYPE "GrowthOrderStatus" AS ENUM ('PENDING', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "GrowthOrderPaymentStatus" AS ENUM ('FUNDS_REQUIRED', 'FUNDS_RESERVED', 'FUNDS_CAPTURED', 'FUNDS_RELEASED', 'REFUNDED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "GrowthRefundEligibility" AS ENUM ('NONE', 'AUTOMATIC', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "GrowthRefundReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "GrowthOrder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "platform" "GrowthServicePlatform" NOT NULL,
    "serviceKind" TEXT NOT NULL,
    "destinationKind" "DestinationKind" NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityDelivered" INTEGER NOT NULL DEFAULT 0,
    "status" "GrowthOrderStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "supplierCostMinor" INTEGER NOT NULL,
    "supplierCostCurrency" TEXT NOT NULL DEFAULT 'USD',
    "grossMarginMinor" INTEGER NOT NULL,
    "expectedCompletionAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "paymentStatus" "GrowthOrderPaymentStatus" NOT NULL DEFAULT 'FUNDS_REQUIRED',
    "reservationLedgerEntryId" TEXT,
    "captureLedgerEntryId" TEXT,
    "releaseLedgerEntryId" TEXT,
    "refundLedgerEntryId" TEXT,
    "refundEligibility" "GrowthRefundEligibility" NOT NULL DEFAULT 'NONE',
    "refundReviewStatus" "GrowthRefundReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "supplierName" TEXT,
    "supplierReference" TEXT,
    "failureReason" TEXT,
    "adminNote" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GrowthOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrowthOrder_idempotencyKey_key" ON "GrowthOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GrowthOrder_workspaceId_status_idx" ON "GrowthOrder"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "GrowthOrder_walletId_status_idx" ON "GrowthOrder"("walletId", "status");

-- CreateIndex
CREATE INDEX "GrowthOrder_supplierReference_idx" ON "GrowthOrder"("supplierReference");

-- CreateIndex
CREATE INDEX "GrowthOrder_deletedAt_idx" ON "GrowthOrder"("deletedAt");

-- AddForeignKey
ALTER TABLE "GrowthOrder" ADD CONSTRAINT "GrowthOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthOrder" ADD CONSTRAINT "GrowthOrder_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

