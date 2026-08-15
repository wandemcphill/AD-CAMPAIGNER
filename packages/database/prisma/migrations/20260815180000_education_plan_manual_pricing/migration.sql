-- Let an admin price education plans for providers that cannot price themselves.
--
-- SirpData sells WAEC/NECO/UTME/NABTEB PINs but publishes no pricing endpoint —
-- its API exposes the cost only as `amountCharged` in the purchase response,
-- after the money is spent. education_catalog_sync therefore skips it entirely
-- and no plan row is ever created, so every education purchase routed to it
-- fails the price lookup. A MANUAL row is how that gets resolved, and the sync
-- must leave those rows alone.

ALTER TABLE "VtuEducationPlan" ADD COLUMN "pricingSource" TEXT NOT NULL DEFAULT 'SYNC';

-- Existing rows all came from the sync or the code bootstrap, so 'SYNC' is
-- accurate for every one of them — no backfill needed beyond the default.

ALTER TABLE "VtuEducationPlan" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "VtuEducationPlan" ADD CONSTRAINT "VtuEducationPlan_pricingSource_check"
    CHECK ("pricingSource" IN ('SYNC', 'MANUAL'));

-- Same positive-minor-units convention the rest of the platform's money columns
-- follow. A zero-cost plan would sell an exam PIN for nothing.
ALTER TABLE "VtuEducationPlan" ADD CONSTRAINT "VtuEducationPlan_costMinor_positive"
    CHECK ("costMinor" > 0);
