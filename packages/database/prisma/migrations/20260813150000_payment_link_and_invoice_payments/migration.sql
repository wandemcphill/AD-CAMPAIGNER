-- Payment collection: hosted-checkout wiring for Payment Links and Invoices,
-- plus fixing the managed-ads campaign provider default (FIX-06).

-- Invoice: record which gateway/reference settled it (manual settlements leave these null).
ALTER TABLE "Invoice" ADD COLUMN "paidVia" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "paymentProvider" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "paymentReference" TEXT;

-- PaymentLink: one row per payment attempt against a (possibly reusable) link.
CREATE TYPE "PaymentLinkPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

CREATE TABLE "PaymentLinkPayment" (
    "id" TEXT NOT NULL,
    "paymentLinkId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentLinkPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payerEmail" TEXT,
    "payerName" TEXT,
    "paymentProvider" TEXT,
    "paymentReference" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentLinkPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentLinkPayment_reference_key" ON "PaymentLinkPayment"("reference");
CREATE INDEX "PaymentLinkPayment_paymentLinkId_status_idx" ON "PaymentLinkPayment"("paymentLinkId", "status");
CREATE INDEX "PaymentLinkPayment_paymentReference_idx" ON "PaymentLinkPayment"("paymentReference");

ALTER TABLE "PaymentLinkPayment" ADD CONSTRAINT "PaymentLinkPayment_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "PaymentLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FIX-06: managed-ads campaigns always write provider "MANUAL" (this app is
-- human-in-the-loop, MOCK was never the intended live default).
ALTER TABLE "Campaign" ALTER COLUMN "provider" SET DEFAULT 'MANUAL';
