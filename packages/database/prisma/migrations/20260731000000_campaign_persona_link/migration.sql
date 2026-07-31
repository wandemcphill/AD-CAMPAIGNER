-- AlterTable: add optional persona link to Campaign
ALTER TABLE "Campaign" ADD COLUMN "personaId" TEXT;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Campaign_personaId_idx" ON "Campaign"("personaId");
