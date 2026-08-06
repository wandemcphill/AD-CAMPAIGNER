-- Cable package catalog (DStv/GOtv/StarTimes/Showmax) synced from ClubKonnect's live
-- APICableTVPackagesV2 endpoint, mirroring the VtuDataPlan pattern for data bundles.

CREATE TABLE "VtuCablePackage" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerName" TEXT NOT NULL,
  "cableProvider" TEXT NOT NULL,
  "packageCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "costMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VtuCablePackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VtuCablePackage_providerName_packageCode_key" ON "VtuCablePackage"("providerName", "packageCode");
CREATE INDEX "VtuCablePackage_cableProvider_active_idx" ON "VtuCablePackage"("cableProvider", "active");
