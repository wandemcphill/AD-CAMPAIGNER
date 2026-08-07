-- Guest Checkout: unauthenticated bill payments (airtime, data, electricity, cable,
-- betting, exam pins). GuestTransaction is deliberately independent of Workspace/User/
-- Wallet -- guests never hold a balance, so there is no ledger relation here.

CREATE TYPE "GuestProductType" AS ENUM ('AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE', 'BETTING', 'EDUCATION');
CREATE TYPE "GuestPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
CREATE TYPE "GuestFulfilmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'REFUNDED');

CREATE TABLE "GuestTransaction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "reference" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "productType" "GuestProductType" NOT NULL,
  "provider" TEXT NOT NULL,
  "beneficiaryMasked" TEXT NOT NULL,
  "beneficiaryEncrypted" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "paymentMethod" TEXT,
  "paymentProvider" TEXT,
  "paymentReference" TEXT,
  "paymentStatus" "GuestPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "fulfilmentStatus" "GuestFulfilmentStatus" NOT NULL DEFAULT 'PENDING',
  "providerReference" TEXT,
  "failureReason" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "requestIpAddress" TEXT,
  "requestUserAgent" TEXT,
  "receiptEmailedAt" TIMESTAMP(3),
  "migratedToUserId" TEXT,
  "migratedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestTransaction_reference_key" ON "GuestTransaction"("reference");
CREATE UNIQUE INDEX "GuestTransaction_idempotencyKey_key" ON "GuestTransaction"("idempotencyKey");
CREATE INDEX "GuestTransaction_email_createdAt_idx" ON "GuestTransaction"("email", "createdAt");
CREATE INDEX "GuestTransaction_phone_createdAt_idx" ON "GuestTransaction"("phone", "createdAt");
CREATE INDEX "GuestTransaction_requestIpAddress_createdAt_idx" ON "GuestTransaction"("requestIpAddress", "createdAt");
CREATE INDEX "GuestTransaction_paymentStatus_fulfilmentStatus_createdAt_idx" ON "GuestTransaction"("paymentStatus", "fulfilmentStatus", "createdAt");
CREATE INDEX "GuestTransaction_paymentReference_idx" ON "GuestTransaction"("paymentReference");
