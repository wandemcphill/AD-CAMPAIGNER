-- Phase E: Financial Products (accounts, cards, remittance). No real provider is
-- contracted yet — see packages/providers/src/financial-products.ts. All three are
-- wired against a mock adapter so schema/saga/API are ready to swap in a real
-- provider later.

ALTER TYPE "ProviderDomain" ADD VALUE 'VIRTUAL_ACCOUNT';
ALTER TYPE "ProviderDomain" ADD VALUE 'VIRTUAL_CARD';
ALTER TYPE "ProviderDomain" ADD VALUE 'REMITTANCE';

CREATE TYPE "VirtualAccountStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "VirtualCardStatus" AS ENUM ('ACTIVE', 'FROZEN', 'TERMINATED');
CREATE TYPE "RemittanceTransferStatus" AS ENUM ('QUOTED', 'CHARGED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DISPUTED');

CREATE TABLE "VirtualAccount" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "providerName" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "bankCode" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "VirtualAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VirtualAccount_providerName_providerAccountId_key" ON "VirtualAccount"("providerName", "providerAccountId");
CREATE INDEX "VirtualAccount_workspaceId_status_idx" ON "VirtualAccount"("workspaceId", "status");

CREATE TABLE "VirtualCard" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "providerName" TEXT NOT NULL,
  "providerCardId" TEXT NOT NULL,
  "last4" TEXT NOT NULL,
  "expiryMonth" INTEGER NOT NULL,
  "expiryYear" INTEGER NOT NULL,
  "brand" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "VirtualCardStatus" NOT NULL DEFAULT 'ACTIVE',
  "idempotencyKey" TEXT NOT NULL,
  "walletId" TEXT,
  "ledgerEntryId" TEXT,
  "chargeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "terminatedAt" TIMESTAMP(3),
  CONSTRAINT "VirtualCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VirtualCard_idempotencyKey_key" ON "VirtualCard"("idempotencyKey");
CREATE UNIQUE INDEX "VirtualCard_providerName_providerCardId_key" ON "VirtualCard"("providerName", "providerCardId");
CREATE INDEX "VirtualCard_workspaceId_status_idx" ON "VirtualCard"("workspaceId", "status");

CREATE TABLE "VirtualCardWalletCharge" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" TEXT NOT NULL DEFAULT 'CHARGED',
  "debitLedgerEntryId" TEXT,
  "refundLedgerEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualCardWalletCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VirtualCardWalletCharge_idempotencyKey_key" ON "VirtualCardWalletCharge"("idempotencyKey");
CREATE INDEX "VirtualCardWalletCharge_workspaceId_status_idx" ON "VirtualCardWalletCharge"("workspaceId", "status");
CREATE INDEX "VirtualCardWalletCharge_cardId_idx" ON "VirtualCardWalletCharge"("cardId");

CREATE TABLE "RemittanceTransfer" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "providerName" TEXT NOT NULL,
  "providerReference" TEXT,
  "quoteId" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientAccountNumber" TEXT NOT NULL,
  "recipientBankCode" TEXT NOT NULL,
  "recipientCountry" TEXT NOT NULL,
  "sourceAmountMinor" INTEGER NOT NULL,
  "sourceCurrency" TEXT NOT NULL,
  "destinationAmountMinor" INTEGER NOT NULL,
  "destinationCurrency" TEXT NOT NULL,
  "feeMinor" INTEGER NOT NULL,
  "status" "RemittanceTransferStatus" NOT NULL DEFAULT 'QUOTED',
  "idempotencyKey" TEXT NOT NULL,
  "walletId" TEXT,
  "ledgerEntryId" TEXT,
  "chargeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "RemittanceTransfer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RemittanceTransfer_idempotencyKey_key" ON "RemittanceTransfer"("idempotencyKey");
CREATE INDEX "RemittanceTransfer_workspaceId_status_idx" ON "RemittanceTransfer"("workspaceId", "status");

CREATE TABLE "RemittanceWalletCharge" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" TEXT NOT NULL DEFAULT 'CHARGED',
  "debitLedgerEntryId" TEXT,
  "refundLedgerEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RemittanceWalletCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RemittanceWalletCharge_idempotencyKey_key" ON "RemittanceWalletCharge"("idempotencyKey");
CREATE INDEX "RemittanceWalletCharge_workspaceId_status_idx" ON "RemittanceWalletCharge"("workspaceId", "status");
CREATE INDEX "RemittanceWalletCharge_transferId_idx" ON "RemittanceWalletCharge"("transferId");
