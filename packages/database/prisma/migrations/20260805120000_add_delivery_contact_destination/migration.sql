-- Allow SMM/growth orders to represent flat-rate digital goods (account sales,
-- VPN subscriptions, streaming subscriptions) that have no promotable URL and are
-- instead fulfilled to a buyer-supplied email contact.

ALTER TYPE "DestinationKind" ADD VALUE IF NOT EXISTS 'DELIVERY_CONTACT';
ALTER TYPE "GrowthServicePlatform" ADD VALUE IF NOT EXISTS 'DIGITAL_GOODS';

ALTER TABLE "SmmOrder" ALTER COLUMN "destinationUrl" DROP NOT NULL;

ALTER TABLE "GrowthOrder" ALTER COLUMN "destinationUrl" DROP NOT NULL;
ALTER TABLE "GrowthOrder" ADD COLUMN "deliveryContact" TEXT;
