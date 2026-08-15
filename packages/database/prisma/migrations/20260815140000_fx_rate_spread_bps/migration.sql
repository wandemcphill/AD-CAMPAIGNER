-- Make the customer FX spread admin-settable instead of a code constant.
-- Defaults to 150 bps, the value previously hardcoded as DEFAULT_SPREAD_BPS,
-- so existing rows keep their current pricing.
ALTER TABLE "FxRate" ADD COLUMN "spreadBps" INTEGER NOT NULL DEFAULT 150;
