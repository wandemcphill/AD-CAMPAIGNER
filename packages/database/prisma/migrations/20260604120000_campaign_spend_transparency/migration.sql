-- Campaign spend transparency ledger.
-- This migration is additive: existing invoices, wallet ledger entries, holds,
-- spend captures, payment intents, and reports remain valid source records.

CREATE TYPE "CampaignLedgerEntryType" AS ENUM (
  'WALLET_FUNDING',
  'INVOICE_PAYMENT',
  'BUDGET_ALLOCATION',
  'AD_SPEND',
  'CREATIVE_COST',
  'AGENCY_FEE',
  'REFUND',
  'ADJUSTMENT'
);

CREATE TYPE "CampaignLedgerEntryDirection" AS ENUM (
  'CREDIT',
  'DEBIT',
  'HOLD',
  'RELEASE',
  'REVERSAL'
);

CREATE TABLE "CampaignLedgerEntry" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "walletId" TEXT,
  "walletLedgerEntryId" TEXT,
  "paymentIntentId" TEXT,
  "campaignInvoiceId" TEXT,
  "campaignBudgetHoldId" TEXT,
  "campaignSpendEntryId" TEXT,
  "campaignReportId" TEXT,
  "actorUserId" TEXT,
  "type" "CampaignLedgerEntryType" NOT NULL,
  "direction" "CampaignLedgerEntryDirection" NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "CampaignLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignLedgerEntry_idempotencyKey_key" ON "CampaignLedgerEntry"("idempotencyKey");
CREATE INDEX "CampaignLedgerEntry_workspaceId_occurredAt_idx" ON "CampaignLedgerEntry"("workspaceId", "occurredAt");
CREATE INDEX "CampaignLedgerEntry_campaignId_occurredAt_idx" ON "CampaignLedgerEntry"("campaignId", "occurredAt");
CREATE INDEX "CampaignLedgerEntry_campaignId_type_idx" ON "CampaignLedgerEntry"("campaignId", "type");
CREATE INDEX "CampaignLedgerEntry_sourceType_sourceId_idx" ON "CampaignLedgerEntry"("sourceType", "sourceId");
CREATE INDEX "CampaignLedgerEntry_walletId_occurredAt_idx" ON "CampaignLedgerEntry"("walletId", "occurredAt");
CREATE INDEX "CampaignLedgerEntry_walletLedgerEntryId_idx" ON "CampaignLedgerEntry"("walletLedgerEntryId");
CREATE INDEX "CampaignLedgerEntry_paymentIntentId_idx" ON "CampaignLedgerEntry"("paymentIntentId");
CREATE INDEX "CampaignLedgerEntry_campaignInvoiceId_idx" ON "CampaignLedgerEntry"("campaignInvoiceId");
CREATE INDEX "CampaignLedgerEntry_campaignBudgetHoldId_idx" ON "CampaignLedgerEntry"("campaignBudgetHoldId");
CREATE INDEX "CampaignLedgerEntry_campaignSpendEntryId_idx" ON "CampaignLedgerEntry"("campaignSpendEntryId");
CREATE INDEX "CampaignLedgerEntry_campaignReportId_idx" ON "CampaignLedgerEntry"("campaignReportId");
CREATE INDEX "CampaignLedgerEntry_actorUserId_occurredAt_idx" ON "CampaignLedgerEntry"("actorUserId", "occurredAt");
CREATE INDEX "CampaignLedgerEntry_deletedAt_idx" ON "CampaignLedgerEntry"("deletedAt");

ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_walletLedgerEntryId_fkey"
  FOREIGN KEY ("walletLedgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_campaignInvoiceId_fkey"
  FOREIGN KEY ("campaignInvoiceId") REFERENCES "CampaignInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_campaignBudgetHoldId_fkey"
  FOREIGN KEY ("campaignBudgetHoldId") REFERENCES "CampaignBudgetHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_campaignSpendEntryId_fkey"
  FOREIGN KEY ("campaignSpendEntryId") REFERENCES "CampaignSpendEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_campaignReportId_fkey"
  FOREIGN KEY ("campaignReportId") REFERENCES "CampaignReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignLedgerEntry" ADD CONSTRAINT "CampaignLedgerEntry_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
