-- Make voucher face values admin-settable instead of hardcoded in three places
-- (the voucher inputSchema, the VTU EPIN guard, and its error text).
-- Backfilled below with the values that were previously hardcoded, so existing
-- products keep exactly their current denominations.
ALTER TABLE "VoucherProduct" ADD COLUMN "denominationsMinor" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

UPDATE "VoucherProduct"
SET "denominationsMinor" = ARRAY[10000, 20000, 50000]
WHERE "providerServiceId" = 'airtime-epin' AND cardinality("denominationsMinor") = 0;

UPDATE "VoucherProduct"
SET "denominationsMinor" = ARRAY[500000]
WHERE "handler" = 'WALLET_CREDIT' AND cardinality("denominationsMinor") = 0;
