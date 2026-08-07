-- Adds VtuBettingCompany and VtuEducationPlan, mirroring the existing VtuCablePackage
-- catalog table pattern. These replace the hardcoded BETTING_COMPANIES / EDUCATION_PLANS
-- in-memory arrays in vtu.service.ts with a DB-backed, provider-synced catalog populated
-- by the betting_catalog_sync / education_catalog_sync worker jobs (apps/worker/src/vtu-processor.ts).

CREATE TABLE "VtuBettingCompany" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerName" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VtuBettingCompany_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VtuBettingCompany_providerName_productCode_key" ON "VtuBettingCompany"("providerName", "productCode");
CREATE INDEX "VtuBettingCompany_active_idx" ON "VtuBettingCompany"("active");

CREATE TABLE "VtuEducationPlan" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerName" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "costMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VtuEducationPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VtuEducationPlan_providerName_productCode_key" ON "VtuEducationPlan"("providerName", "productCode");
CREATE INDEX "VtuEducationPlan_active_idx" ON "VtuEducationPlan"("active");
