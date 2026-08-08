-- KYC/KYB gating for settlement beneficiaries, and alerting on reconciliation
-- divergence / settlement failure. Beneficiaries are looked up loosely by
-- SettlementInstruction.beneficiaryId (already an unconstrained string column) —
-- no FK added there to avoid touching the existing settlement flow's shape.

CREATE TYPE "SettlementAlertKind" AS ENUM ('RECONCILIATION_DIVERGED', 'SETTLEMENT_FAILED');
CREATE TYPE "SettlementAlertSeverity" AS ENUM ('WARNING', 'CRITICAL');

CREATE TABLE "SettlementBeneficiary" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "country" TEXT,
  "currency" TEXT,
  "kycTier" "KycTier" NOT NULL DEFAULT 'LIGHT',
  "kycStatus" "KycStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "rejectedReason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementBeneficiary_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SettlementBeneficiary_workspaceId_kycStatus_idx" ON "SettlementBeneficiary"("workspaceId", "kycStatus");

CREATE TABLE "SettlementAlert" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "settlementInstructionId" TEXT NOT NULL,
  "kind" "SettlementAlertKind" NOT NULL,
  "severity" "SettlementAlertSeverity" NOT NULL DEFAULT 'WARNING',
  "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "acknowledgedByUserId" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SettlementAlert_acknowledged_createdAt_idx" ON "SettlementAlert"("acknowledged", "createdAt");
CREATE INDEX "SettlementAlert_settlementInstructionId_idx" ON "SettlementAlert"("settlementInstructionId");
