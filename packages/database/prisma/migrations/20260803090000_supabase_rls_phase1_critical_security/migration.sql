-- Phase 1: Critical Supabase RLS lockdown for auth, wallet, token, and financial tables.
-- This migration assumes the Nest API and workers use a service-role/postgres/BYPASSRLS database connection.
-- RLS is intentionally not forced so service-role/owner access remains compatible with Prisma.

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', app_role);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', app_role);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', app_role);
    END IF;
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TwoFactorBackupCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Voucher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VoucherClaimToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."RewardQrCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."LedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."PaymentIntent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."CampaignInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."CampaignBudgetHold" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."CampaignSpendEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."CampaignLedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GiftCardPurchaseTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GiftCardWalletCharge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VtuOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VtuWalletCharge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VirtualNumberOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VirtualNumberWalletCharge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.digital_access_wallet_charges ENABLE ROW LEVEL SECURITY;
