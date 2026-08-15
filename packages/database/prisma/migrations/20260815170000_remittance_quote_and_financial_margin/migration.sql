-- Persist remittance quotes so the send leg can validate server-side instead of
-- trusting client-echoed amounts, and record markup on the financial verticals.

CREATE TYPE "RemittanceQuoteStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "RemittanceQuote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "providerName" TEXT NOT NULL,
    "providerQuoteId" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "sourceAmountMinor" INTEGER NOT NULL,
    "costMinor" INTEGER NOT NULL,
    "marginMinor" INTEGER NOT NULL DEFAULT 0,
    "destinationCurrency" TEXT NOT NULL,
    "destinationAmountMinor" INTEGER NOT NULL,
    "feeMinor" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" "RemittanceQuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemittanceQuote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RemittanceQuote_workspaceId_status_idx" ON "RemittanceQuote"("workspaceId", "status");
CREATE INDEX "RemittanceQuote_transferId_idx" ON "RemittanceQuote"("transferId");

-- Money columns follow the platform's positive-integer-minor-units convention.
ALTER TABLE "RemittanceQuote" ADD CONSTRAINT "RemittanceQuote_amounts_nonnegative"
    CHECK ("sourceAmountMinor" >= 0 AND "costMinor" >= 0 AND "marginMinor" >= 0
           AND "destinationAmountMinor" >= 0 AND "feeMinor" >= 0);

-- The customer's debit is the provider's leg plus our markup, by construction.
ALTER TABLE "RemittanceQuote" ADD CONSTRAINT "RemittanceQuote_source_is_cost_plus_margin"
    CHECK ("sourceAmountMinor" = "costMinor" + "marginMinor");

-- Existing rows predate persisted quotes and margin: quoteId held a provider
-- quote id, and debit always equalled the amount sent. Both new amount columns
-- are therefore nullable/zero-defaulted rather than backfilled with a guess.
ALTER TABLE "RemittanceTransfer" ADD COLUMN "providerQuoteId" TEXT;
ALTER TABLE "RemittanceTransfer" ADD COLUMN "costMinor" INTEGER;
ALTER TABLE "RemittanceTransfer" ADD COLUMN "marginMinor" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "VirtualCardWalletCharge" ADD COLUMN "costMinor" INTEGER;
ALTER TABLE "VirtualCardWalletCharge" ADD COLUMN "marginMinor" INTEGER NOT NULL DEFAULT 0;
