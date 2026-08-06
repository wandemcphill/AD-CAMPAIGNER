-- Sogo crypto-sell (deposit-address model) and RMB-buy (Alipay/WeChat/bank) — new
-- fulfillment domains, verified live against the real Sogo Partner API (2026-08-06)
-- via GET /crypto/assets and GET /rmb/buy/rates.

ALTER TYPE "ProviderDomain" ADD VALUE IF NOT EXISTS 'CRYPTO';
ALTER TYPE "ProviderDomain" ADD VALUE IF NOT EXISTS 'RMB';

CREATE TABLE "CryptoDepositAddress" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "asset" TEXT NOT NULL,
  "network" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "destinationTag" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CryptoDepositAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CryptoDepositAddress_workspaceId_asset_network_key" ON "CryptoDepositAddress"("workspaceId", "asset", "network");
CREATE INDEX "CryptoDepositAddress_workspaceId_idx" ON "CryptoDepositAddress"("workspaceId");

CREATE TABLE "CryptoSellTransaction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "depositAddressId" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "providerReference" TEXT NOT NULL,
  "txHash" TEXT,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "creditLedgerEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CryptoSellTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CryptoSellTransaction_providerName_providerReference_key" ON "CryptoSellTransaction"("providerName", "providerReference");
CREATE INDEX "CryptoSellTransaction_workspaceId_status_idx" ON "CryptoSellTransaction"("workspaceId", "status");
CREATE INDEX "CryptoSellTransaction_depositAddressId_idx" ON "CryptoSellTransaction"("depositAddressId");

CREATE TYPE "RmbChannel" AS ENUM ('ALIPAY', 'WECHAT', 'BANK');
CREATE TYPE "RmbOrderStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "RmbOrder" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "providerReference" TEXT,
  "channel" "RmbChannel" NOT NULL,
  "accountType" TEXT,
  "rmbAmount" DECIMAL(12,2) NOT NULL,
  "ngnAmountMinor" INTEGER NOT NULL,
  "exchangeRate" DECIMAL(10,4) NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientIdentifier" TEXT,
  "recipientBankName" TEXT,
  "recipientBankAccount" TEXT,
  "description" TEXT NOT NULL,
  "qrCodeUrl" TEXT,
  "status" "RmbOrderStatus" NOT NULL DEFAULT 'PROCESSING',
  "idempotencyKey" TEXT NOT NULL,
  "debitLedgerEntryId" TEXT,
  "refundLedgerEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RmbOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RmbOrder_idempotencyKey_key" ON "RmbOrder"("idempotencyKey");
CREATE INDEX "RmbOrder_workspaceId_status_idx" ON "RmbOrder"("workspaceId", "status");
CREATE INDEX "RmbOrder_walletId_idx" ON "RmbOrder"("walletId");
