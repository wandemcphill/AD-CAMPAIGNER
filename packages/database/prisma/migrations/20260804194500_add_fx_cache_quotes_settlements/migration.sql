-- Add FX cache, FX quote, and settlement tables that exist in Prisma schema
-- but were missing from the earlier production migration set.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FxQuoteStatus') THEN
    CREATE TYPE "FxQuoteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'USED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettlementInstructionStatus') THEN
    CREATE TYPE "SettlementInstructionStatus" AS ENUM (
      'PENDING',
      'READY',
      'SUBMITTED',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'REQUIRES_REVIEW'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettlementReconciliationState') THEN
    CREATE TYPE "SettlementReconciliationState" AS ENUM (
      'SYNCED',
      'DIVERGED',
      'UNRECONCILED',
      'MANUAL_REVIEW_REQUIRED'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "FxRateCache" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
  "quoteCurrency" TEXT NOT NULL DEFAULT 'NGN',
  "providerName" TEXT NOT NULL,
  "providerRateMicros" BIGINT NOT NULL,
  "providerTimestamp" TIMESTAMP(3) NOT NULL,
  "validationStatus" TEXT NOT NULL DEFAULT 'VALID',
  "age_seconds" INTEGER NOT NULL DEFAULT 0,
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSuccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FxRateCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FxRateCache_baseCurrency_quoteCurrency_providerName_key"
  ON "FxRateCache"("baseCurrency", "quoteCurrency", "providerName");
CREATE INDEX IF NOT EXISTS "FxRateCache_baseCurrency_quoteCurrency_lastSuccessAt_idx"
  ON "FxRateCache"("baseCurrency", "quoteCurrency", "lastSuccessAt");

CREATE TABLE IF NOT EXISTS "FxQuote" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
  "quoteCurrency" TEXT NOT NULL DEFAULT 'NGN',
  "sourceAmountMinor" BIGINT NOT NULL,
  "providerRateMicros" BIGINT NOT NULL,
  "spreadBps" INTEGER NOT NULL,
  "bufferBps" INTEGER NOT NULL,
  "customerRateMicros" BIGINT NOT NULL,
  "resultAmountMinor" BIGINT NOT NULL,
  "status" "FxQuoteStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "transactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FxQuote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FxQuote_baseCurrency_quoteCurrency_expiresAt_status_idx"
  ON "FxQuote"("baseCurrency", "quoteCurrency", "expiresAt", "status");
CREATE INDEX IF NOT EXISTS "FxQuote_transactionId_idx" ON "FxQuote"("transactionId");

CREATE TABLE IF NOT EXISTS "SettlementInstruction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "quoteId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "beneficiaryId" TEXT,
  "sourceAmountMinor" BIGINT NOT NULL,
  "sourceCurrency" TEXT NOT NULL DEFAULT 'NGN',
  "destinationAmountMinor" BIGINT NOT NULL,
  "destinationCurrency" TEXT NOT NULL DEFAULT 'USD',
  "fxRateMicros" BIGINT NOT NULL,
  "spreadBps" INTEGER NOT NULL,
  "bufferBps" INTEGER NOT NULL,
  "feesMinor" BIGINT NOT NULL DEFAULT 0,
  "netAmountMinor" BIGINT NOT NULL,
  "beneficiaryName" TEXT,
  "beneficiaryReference" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "status" "SettlementInstructionStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL DEFAULT 'pending',
  "providerReference" TEXT,
  "providerStatus" TEXT,
  "providerTimestamp" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorReason" TEXT,
  "lastErrorAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "reconciliationState" "SettlementReconciliationState" NOT NULL DEFAULT 'UNRECONCILED',
  "reconciliationNote" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "readyAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementInstruction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SettlementInstruction_idempotencyKey_key"
  ON "SettlementInstruction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "SettlementInstruction_quoteId_idx" ON "SettlementInstruction"("quoteId");
CREATE INDEX IF NOT EXISTS "SettlementInstruction_partnerId_status_idx"
  ON "SettlementInstruction"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "SettlementInstruction_status_createdAt_idx"
  ON "SettlementInstruction"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SettlementInstruction_provider_providerReference_idx"
  ON "SettlementInstruction"("provider", "providerReference");
CREATE INDEX IF NOT EXISTS "SettlementInstruction_idempotencyKey_idx"
  ON "SettlementInstruction"("idempotencyKey");

CREATE TABLE IF NOT EXISTS "SettlementReconciliation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "settlementInstructionId" TEXT NOT NULL,
  "ftStatus" TEXT NOT NULL,
  "ftProviderReference" TEXT,
  "ftAmountMinor" BIGINT,
  "ftTimestamp" TIMESTAMP(3),
  "providerStatus" TEXT,
  "providerAmountMinor" BIGINT,
  "providerTimestamp" TIMESTAMP(3),
  "statusMatch" BOOLEAN NOT NULL DEFAULT false,
  "amountMatch" BOOLEAN NOT NULL DEFAULT false,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolvedBy" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SettlementReconciliation_settlementInstructionId_key"
  ON "SettlementReconciliation"("settlementInstructionId");
CREATE INDEX IF NOT EXISTS "SettlementReconciliation_resolved_statusMatch_amountMatch_idx"
  ON "SettlementReconciliation"("resolved", "statusMatch", "amountMatch");

CREATE TABLE IF NOT EXISTS "SettlementWebhookEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "settlementInstructionId" TEXT,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "parsedData" JSONB NOT NULL DEFAULT '{}',
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMP(3),
  "processError" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SettlementWebhookEvent_provider_providerEventId_key"
  ON "SettlementWebhookEvent"("provider", "providerEventId");
CREATE INDEX IF NOT EXISTS "SettlementWebhookEvent_settlementInstructionId_idx"
  ON "SettlementWebhookEvent"("settlementInstructionId");
CREATE INDEX IF NOT EXISTS "SettlementWebhookEvent_provider_processed_idx"
  ON "SettlementWebhookEvent"("provider", "processed");

ALTER TABLE IF EXISTS public."FxRateCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."FxQuote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SettlementInstruction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SettlementReconciliation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."SettlementWebhookEvent" ENABLE ROW LEVEL SECURITY;
