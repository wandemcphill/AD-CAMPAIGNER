-- Provider-side customers, a KYC-gated prerequisite for cards and virtual
-- accounts. Payscribe refuses card issuance without a tier-2 customer; Sudo,
-- Maplerad and Inflow each have an equivalent gate. This is provider-agnostic
-- so swapping one out is additive rather than a rewrite.
--
-- PRIVACY: no identity data is stored here — no DOB, address, ID number or
-- document image. Those pass through to the provider at enrollment and are
-- dropped. Only the opaque customer id and the tier reached are persisted,
-- matching the rule KycService already follows.

CREATE TABLE "ProviderCustomer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "providerName" TEXT NOT NULL,
    "providerCustomerId" TEXT NOT NULL,
    "tier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCustomer_pkey" PRIMARY KEY ("id")
);

-- One customer per provider per workspace. The unique constraint is what makes
-- enrollment idempotent: a second attempt collides rather than silently
-- creating a duplicate customer at the provider.
CREATE UNIQUE INDEX "ProviderCustomer_workspaceId_providerName_key"
    ON "ProviderCustomer"("workspaceId", "providerName");

CREATE INDEX "ProviderCustomer_providerName_idx" ON "ProviderCustomer"("providerName");
