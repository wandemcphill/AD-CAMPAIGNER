-- Financial integrity guardrails.
-- This migration intentionally fails if existing rows contain invalid negative money values.

ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_budgetMinor_nonnegative"
  CHECK ("budgetMinor" >= 0);

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_amountMinor_positive"
  CHECK ("amountMinor" > 0);

ALTER TABLE "PaymentIntent"
  ADD CONSTRAINT "PaymentIntent_amountMinor_positive"
  CHECK ("amountMinor" > 0);

ALTER TABLE "CampaignInvoice"
  ADD CONSTRAINT "CampaignInvoice_amounts_valid"
  CHECK (
    "subtotalMinor" > 0
    AND "taxMinor" >= 0
    AND "totalMinor" > 0
    AND "amountPaidMinor" >= 0
    AND "totalMinor" >= "subtotalMinor"
    AND "amountPaidMinor" <= "totalMinor"
  );

ALTER TABLE "CampaignBudgetHold"
  ADD CONSTRAINT "CampaignBudgetHold_amountMinor_positive"
  CHECK ("amountMinor" > 0);

ALTER TABLE "ManualAdPlacement"
  ADD CONSTRAINT "ManualAdPlacement_money_nonnegative"
  CHECK ("budgetMinor" >= 0 AND "spendMinor" >= 0);

ALTER TABLE "CampaignSpendEntry"
  ADD CONSTRAINT "CampaignSpendEntry_amountMinor_nonnegative"
  CHECK ("amountMinor" >= 0);

ALTER TABLE "CampaignReport"
  ADD CONSTRAINT "CampaignReport_money_nonnegative"
  CHECK ("spendMinor" >= 0 AND ("revenueMinor" IS NULL OR "revenueMinor" >= 0));

ALTER TABLE "CampaignLedgerEntry"
  ADD CONSTRAINT "CampaignLedgerEntry_amountMinor_positive"
  CHECK ("amountMinor" > 0);

ALTER TABLE "OtpOrder"
  ADD CONSTRAINT "OtpOrder_amounts_valid"
  CHECK ("amountMinor" > 0 AND "supplierCostMinor" >= 0);

ALTER TABLE "OtpWalletCharge"
  ADD CONSTRAINT "OtpWalletCharge_amountMinor_positive"
  CHECK ("amountMinor" > 0);

ALTER TABLE "digital_access_services"
  ADD CONSTRAINT "digital_access_services_starting_price_nonnegative"
  CHECK ("starting_price" >= 0);

ALTER TABLE "digital_access_plans"
  ADD CONSTRAINT "digital_access_plans_price_nonnegative"
  CHECK ("price" >= 0);

ALTER TABLE "digital_access_requests"
  ADD CONSTRAINT "digital_access_requests_amount_positive"
  CHECK ("amount_minor" > 0);

ALTER TABLE "digital_access_wallet_charges"
  ADD CONSTRAINT "digital_access_wallet_charges_amount_positive"
  CHECK ("amount_minor" > 0);
