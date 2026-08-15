-- AiConfig was added to schema.prisma without a migration, so the model existed
-- in the client while the table did not exist in any database. Generated from
-- `prisma migrate diff` against the live schema.
-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL DEFAULT 'OpenAI',
    "apiEndpoint" TEXT NOT NULL,
    "systemPromptOverride" TEXT NOT NULL DEFAULT '',
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiConfig_workspaceId_key" ON "AiConfig"("workspaceId");

-- CreateIndex
CREATE INDEX "AiConfig_workspaceId_idx" ON "AiConfig"("workspaceId");
