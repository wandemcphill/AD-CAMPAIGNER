-- Airtime/data EPIN (printed recharge PIN) is a distinct ClubKonnect product family from
-- direct recharge (purchaseAirtime/purchaseData) — it returns a PIN instead of crediting a
-- phone number. AIRTIME_EPIN/DATA_EPIN let VtuOrder represent these purchases; PROVIDER_EPIN
-- lets VoucherProduct seal the returned PIN using the existing Voucher.pinEncrypted mechanism.

ALTER TYPE "VtuProductType" ADD VALUE IF NOT EXISTS 'AIRTIME_EPIN';
ALTER TYPE "VtuProductType" ADD VALUE IF NOT EXISTS 'DATA_EPIN';
ALTER TYPE "VoucherProductHandler" ADD VALUE IF NOT EXISTS 'PROVIDER_EPIN';
