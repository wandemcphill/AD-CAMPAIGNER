-- Shareable payment links.
CREATE TYPE "PaymentLinkStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED');

CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amountMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "collectCustomerInfo" BOOLEAN NOT NULL DEFAULT false,
    "timesPaid" INTEGER NOT NULL DEFAULT 0,
    "totalCollectedMinor" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentLink_reference_key" ON "PaymentLink"("reference");
CREATE INDEX "PaymentLink_workspaceId_status_createdAt_idx" ON "PaymentLink"("workspaceId", "status", "createdAt");
CREATE INDEX "PaymentLink_deletedAt_idx" ON "PaymentLink"("deletedAt");

ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
