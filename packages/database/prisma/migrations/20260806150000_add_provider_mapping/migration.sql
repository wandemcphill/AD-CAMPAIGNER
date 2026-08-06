-- Gap 5, stage 1/2: ProviderMapping chokepoint table. Additive only — no existing
-- table's inline providerName/providerReference columns are touched. Populated by
-- a one-off backfill script (packages/database/prisma/backfill-provider-mapping.ts),
-- not by this migration.

CREATE TABLE "ProviderMapping" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "domain" "ProviderDomain" NOT NULL,
  "providerName" TEXT NOT NULL,
  "providerReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderMapping_entityType_entityId_key" ON "ProviderMapping"("entityType", "entityId");
CREATE INDEX "ProviderMapping_providerName_providerReference_idx" ON "ProviderMapping"("providerName", "providerReference");
CREATE INDEX "ProviderMapping_domain_idx" ON "ProviderMapping"("domain");
