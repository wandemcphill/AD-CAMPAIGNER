-- SmmOrder was never written to — real SMM/growth-service order placement has
-- always persisted through GrowthOrder instead (see platform.service.ts). This
-- table is a duplicate leftover from an earlier schema iteration; safe to drop
-- since it holds zero rows in every environment.

DROP TABLE "SmmOrder";
DROP TYPE "SmmOrderStatus";
