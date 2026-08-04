-- Re-enable RLS after gift card, airtime cashout, and growth override tables exist.
-- Earlier RLS migrations used IF EXISTS before some of these tables were created.

ALTER TABLE IF EXISTS public."GiftCardSellQuote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GiftCardSellTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GiftCardPurchaseQuote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GiftCardPurchaseTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GiftCardWalletCharge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AirtimeCashoutQuote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AirtimeCashoutTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GrowthServiceOverride" ENABLE ROW LEVEL SECURITY;
