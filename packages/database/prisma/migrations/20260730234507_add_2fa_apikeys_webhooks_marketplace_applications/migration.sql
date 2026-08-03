-- AlterTable
ALTER TABLE "ApiKey" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MarketplaceAgencyApplication" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MarketplaceCreatorApplication" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NumberCompatibility" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OutgoingWebhookDelivery" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OutgoingWebhookSubscription" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TwoFactorBackupCode" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualNumber" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualNumberMessage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualNumberOrder" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualNumberProduct" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VirtualNumberWalletCharge" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "NumberCompatibility_service_country_provider_type_key" RENAME TO "NumberCompatibility_serviceKey_countryCode_providerName_num_key";
