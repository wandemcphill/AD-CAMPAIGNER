-- SOGO Gift Card API compliance: e-code validation, duplicate detection, and
-- fraud scoring must happen before any provider call. These columns record
-- the validation outcome on every submission (accepted, flagged, or rejected)
-- so the pipeline has an audit trail and can route high-risk submissions to
-- manual review instead of Sogo.

ALTER TYPE "GiftCardSellStatus" ADD VALUE IF NOT EXISTS 'FLAGGED_FOR_REVIEW';

ALTER TABLE "GiftCardSellTransaction"
  ADD COLUMN "cardCodeHash" TEXT,
  ADD COLUMN "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "validationReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "fraudScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "approvalRequestId" TEXT;

CREATE INDEX "GiftCardSellTransaction_cardCodeHash_idx" ON "GiftCardSellTransaction"("cardCodeHash");
CREATE INDEX "GiftCardSellTransaction_approvalRequestId_idx" ON "GiftCardSellTransaction"("approvalRequestId");
