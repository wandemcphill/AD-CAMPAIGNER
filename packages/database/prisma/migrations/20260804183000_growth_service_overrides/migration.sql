CREATE TABLE "GrowthServiceOverride" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "serviceCode" TEXT NOT NULL,
  "enabled" BOOLEAN,
  "marginBps" INTEGER,
  "preferredSupplier" TEXT,
  "maximumQuantity" INTEGER,
  "expectedCompletion" TEXT,
  "adminNote" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GrowthServiceOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GrowthServiceOverride_serviceCode_key" ON "GrowthServiceOverride"("serviceCode");
CREATE INDEX "GrowthServiceOverride_updatedByUserId_idx" ON "GrowthServiceOverride"("updatedByUserId");
