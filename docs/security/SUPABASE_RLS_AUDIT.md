# Supabase RLS And Database Security Audit

## Executive Summary

The application should not expose most Prisma tables through Supabase PostgREST. The live product is API-driven: the web/admin clients call the Nest API, and the Nest API plus workers use Prisma. Supabase RLS should therefore be used as a hard boundary around client database roles, not as a replacement for the existing backend authorization model.

The generated migrations revoke `anon` and `authenticated` table privileges across `public`, enable RLS on all Prisma-managed tables, and then grant read-only Supabase access back only to intentionally public catalog/listing tables. No wallet, ledger, auth, token, secret, webhook, session, or order table receives a client policy.

## Backend Compatibility

- Backend Prisma access must use a service-role/postgres/BYPASSRLS database connection.
- RLS is enabled without `FORCE ROW LEVEL SECURITY`; this preserves service-owner/bypass behavior.
- No application code needs to instantiate Supabase clients for private data. Existing Nest guards remain the application authorization layer.
- If any backend environment uses `anon`, `authenticated`, or another non-bypass role in `DATABASE_URL`, deployment should be stopped and the database URL corrected.

## API Exposure Plan

| Plan | Meaning | Tables |
|---|---|---|
| A | Expose with RLS, SELECT only | `VoucherProduct`, `GiftCardProduct`, `VtuDataPlan`, `NumberCountry`, `VirtualNumberProduct`, `digital_access_categories`, `digital_access_services`, `digital_access_plans`, `MarketplaceAgency`, `MarketplaceCreator` |
| B | Remove from PostgREST entirely | Recommended through Supabase API settings for every non-public table where supported |
| C | Backend Service Role only | 96 private/auth/financial/internal tables |

## Dangerous Tables

These tables contain tokens, encrypted secrets, PII, financial data, or privileged workflow state and must remain backend-service-only:

- `User`: Authentication; Application account profile and authentication state.
- `Workspace`: Organization Scoped; Operational tenant boundary for campaigns, wallets, products, and support.
- `TeamMember`: Authentication; Organization role and permission assignment.
- `Session`: Authentication; Refresh/session token registry and device metadata.
- `Campaign`: Organization Scoped; Campaign planning, approval, execution, and lifecycle state.
- `AdAccount`: Organization Scoped; Advertising account/KYC linkage and spend metadata.
- `CampaignOutcome`: Organization Scoped; Post-campaign performance and customer feedback.
- `Wallet`: Financial; Workspace stored-value balance container.
- `LedgerEntry`: Financial; Immutable wallet ledger movement record.
- `PaymentIntent`: Financial; Gateway checkout and payment-credit tracking.
- `VoucherProduct`: Public Read; Public voucher product catalog.
- `Voucher`: Secrets; Issued voucher inventory and encrypted redemption material.
- `VoucherClaimToken`: Secrets; Bearer token used to claim a shared voucher.
- `CompanyProfile`: Organization Scoped; Advertiser business profile and contact metadata.
- `MediaAsset`: Organization Scoped; Uploaded creative/report media metadata and object storage references.
- `CampaignCreative`: Organization Scoped; Creative assignment, copy, review, and placement metadata.
- `CampaignNote`: Organization Scoped; Campaign collaboration notes.
- `ManualAdPlacement`: Organization Scoped; Manual placement execution and performance record.
- `CampaignReport`: Organization Scoped; Campaign reporting period, metrics, and publication state.
- `CampaignInvoice`: Financial; Campaign invoice and paid/voided state.
- `CampaignBudgetHold`: Financial; Reserved campaign wallet funds and release/capture ledger links.
- `CampaignSpendEntry`: Financial; Spend line item recorded against campaign placements.
- `CampaignLedgerEntry`: Financial; Campaign-specific financial ledger and reconciliation line.
- `EventOutbox`: Audit; Transactional outbox for async/domain events.
- `GrowthOrder`: Financial; Growth service order, supplier, margin, and wallet settlement state.
- `ProviderHealth`: Admin Only; Provider status, performance, and balance telemetry.
- `FxRate`: Financial; Configured foreign-exchange rate and buffer.
- `FxRateCache`: Financial; Cached provider FX rates.
- `FxQuote`: Financial; Customer FX quote and usage state.
- `SettlementInstruction`: Financial; Cross-border settlement instruction and provider state.
- `SettlementReconciliation`: Financial; Settlement reconciliation comparison result.
- `SettlementWebhookEvent`: Financial; Raw settlement webhook event and processing state.
- `GiftCardProduct`: Public Read; Public gift-card product catalog.
- `GiftCardSellQuote`: Financial; Gift-card sell quote and customer payout calculation.
- `GiftCardSellTransaction`: Financial; Gift-card sell transaction and provider payout state.
- `GiftCardPurchaseQuote`: Financial; Gift-card purchase quote and customer price calculation.
- `GiftCardPurchaseTransaction`: Secrets; Gift-card purchase fulfillment and encrypted code delivery state.
- `GiftCardWalletCharge`: Financial; Wallet debit/refund record for gift-card purchase.
- `AirtimeCashoutQuote`: Financial; Airtime cashout quote and payout calculation.
- `AirtimeCashoutTransaction`: Financial; Airtime cashout transaction and provider state.
- `ProviderWebhookEvent`: Audit; Provider webhook payload, signature, and processing audit.
- `PricingRule`: Admin Only; Internal pricing, margin, and fee rule.
- `VtuDataPlan`: Public Read; Public VTU data plan catalog.
- `VtuOrder`: Financial; VTU airtime/data order with encrypted recipient metadata.
- `VtuWalletCharge`: Financial; Wallet debit/refund record for VTU order.
- `VirtualNumber`: Organization Scoped; Provisioned virtual number lifecycle and user ownership.
- `VirtualNumberMessage`: Internal Infrastructure; Encrypted SMS/message payload for virtual numbers.
- `VirtualNumberOrder`: Financial; Virtual-number purchase/renewal order.
- `VirtualNumberWalletCharge`: Financial; Wallet debit/refund record for virtual-number order.
- `NumberCompatibility`: Admin Only; Internal compatibility/risk data for providers and countries.
- `VirtualNumberPurchaseLimit`: Financial; Workspace/user purchase-limit accounting.
- `VirtualNumberReconciliation`: Financial; Virtual-number provider reconciliation.
- `VirtualNumberMarginAnalytics`: Financial; Margin analytics for virtual-number orders.
- `digital_access_services`: Public Read; Public digital-access service catalog.
- `digital_access_plans`: Public Read; Public digital-access plan catalog.
- `digital_access_requests`: Organization Scoped; Digital-access order/request with contact destination.
- `digital_access_wallet_charges`: Financial; Wallet debit/refund record for digital-access request.
- `Notification`: Organization Scoped; User notification content and delivery state.
- `ReferralAccount`: Organization Scoped; Referral code and commission configuration.
- `MarketplaceCreator`: Public Read; Public creator marketplace listing.
- `TwoFactorBackupCode`: Authentication; Hashed 2FA backup code.
- `ApiKey`: Secrets; Workspace API key prefix/hash and scopes.
- `OutgoingWebhookSubscription`: Secrets; Outbound webhook target and signing secret.
- `MarketplaceCreatorApplication`: Organization Scoped; Private creator application review workflow.
- `RewardCampaign`: Organization Scoped; Reward campaign configuration and eligibility.
- `RewardTask`: Organization Scoped; Reward campaign task definition.
- `TaskCompletion`: Organization Scoped; Reward task proof and verification state.
- `RewardEntitlement`: Organization Scoped; Reward owed to participant.
- `RewardFulfillment`: Internal Infrastructure; Reward delivery/fulfillment state.
- `RewardQrCode`: Secrets; Reward QR bearer token and scan accounting.
- `AssetSubmission`: Organization Scoped; Submitted asset validation workflow.
- `SubmissionSecret`: Secrets; Encrypted submitted secret material.
- `ValidationRun`: Audit; Asset validation run verdict and telemetry.
- `StageResult`: Audit; Validation stage result.
- `Signal`: Audit; Validation signal used for scoring.
- `ImageQualityResult`: Audit; Image quality analysis output.
- `BrandRuleSet`: Admin Only; Internal fraud/validation rule set.

## RLS Summary

- Critical, business, financial, auth, audit, admin, and infrastructure tables: RLS enabled, no client policies, no `anon`/`authenticated` table grants.
- Public catalog/listing tables: RLS enabled, `SELECT` policy only, filtered to active/non-deleted rows where the schema supports those fields.
- No `INSERT`, `UPDATE`, or `DELETE` policies are created for Supabase client roles. Writes go through the Nest API.
- No policies use unrestricted `USING (true)`; even `NumberCountry` is filtered to enabled countries.

## Service Role Tables

- `User` (Authentication)
- `Organization` (Organization Scoped)
- `Workspace` (Organization Scoped)
- `TeamMember` (Authentication)
- `Session` (Authentication)
- `Campaign` (Organization Scoped)
- `Destination` (Organization Scoped)
- `LivePromotion` (Organization Scoped)
- `AdAccount` (Organization Scoped)
- `CampaignRiskAssessment` (Organization Scoped)
- `CampaignOutcome` (Organization Scoped)
- `Wallet` (Financial)
- `LedgerEntry` (Financial)
- `PaymentIntent` (Financial)
- `Voucher` (Secrets)
- `VoucherClaimToken` (Secrets)
- `CompanyProfile` (Organization Scoped)
- `MediaAsset` (Organization Scoped)
- `CampaignCreative` (Organization Scoped)
- `CampaignNote` (Organization Scoped)
- `CampaignStatusHistory` (Audit)
- `CampaignAssignment` (Organization Scoped)
- `ManualAdPlacement` (Organization Scoped)
- `CampaignReport` (Organization Scoped)
- `CampaignReportScreenshot` (Organization Scoped)
- `CampaignInvoice` (Financial)
- `CampaignBudgetHold` (Financial)
- `CampaignSpendEntry` (Financial)
- `CampaignLedgerEntry` (Financial)
- `EventOutbox` (Audit)
- `SmmOrder` (Organization Scoped)
- `GrowthOrder` (Financial)
- `ProviderConfig` (Admin Only)
- `ProviderHealth` (Admin Only)
- `ProviderRoutingAttempt` (Audit)
- `FxRate` (Financial)
- `FxRateCache` (Financial)
- `FxQuote` (Financial)
- `SettlementInstruction` (Financial)
- `SettlementReconciliation` (Financial)
- `SettlementWebhookEvent` (Financial)
- `GiftCardSellQuote` (Financial)
- `GiftCardSellTransaction` (Financial)
- `GiftCardPurchaseQuote` (Financial)
- `GiftCardPurchaseTransaction` (Secrets)
- `GiftCardWalletCharge` (Financial)
- `AirtimeCashoutQuote` (Financial)
- `AirtimeCashoutTransaction` (Financial)
- `ProviderWebhookEvent` (Audit)
- `PricingRule` (Admin Only)
- `VtuProviderRoute` (Admin Only)
- `VtuOrder` (Financial)
- `VtuWalletCharge` (Financial)
- `VirtualNumber` (Organization Scoped)
- `VirtualNumberMessage` (Internal Infrastructure)
- `VirtualNumberOrder` (Financial)
- `VirtualNumberWalletCharge` (Financial)
- `NumberCompatibility` (Admin Only)
- `VirtualNumberPurchaseLimit` (Financial)
- `VirtualNumberReconciliation` (Financial)
- `VirtualNumberMarginAnalytics` (Financial)
- `digital_access_requests` (Organization Scoped)
- `digital_access_wallet_charges` (Financial)
- `AnalyticsMetric` (Organization Scoped)
- `Notification` (Organization Scoped)
- `NotificationDeliveryAttempt` (Audit)
- `NotificationPreference` (Organization Scoped)
- `SupportTicket` (Organization Scoped)
- `ReferralAccount` (Organization Scoped)
- `AuditLog` (Audit)
- `Persona` (Organization Scoped)
- `AutomationWorkflow` (Organization Scoped)
- `TwoFactorBackupCode` (Authentication)
- `ApiKey` (Secrets)
- `OutgoingWebhookSubscription` (Secrets)
- `OutgoingWebhookDelivery` (Audit)
- `MarketplaceAgencyApplication` (Organization Scoped)
- `MarketplaceCreatorApplication` (Organization Scoped)
- `RewardCampaign` (Organization Scoped)
- `RewardTask` (Organization Scoped)
- `RewardParticipant` (Organization Scoped)
- `TaskCompletion` (Organization Scoped)
- `RewardEntitlement` (Organization Scoped)
- `RewardFulfillment` (Internal Infrastructure)
- `VerificationEvent` (Audit)
- `RewardQrCode` (Secrets)
- `RewardLeaderboardEntry` (Organization Scoped)
- `AssetSubmission` (Organization Scoped)
- `SubmissionSecret` (Secrets)
- `ValidationRun` (Audit)
- `StageResult` (Audit)
- `Signal` (Audit)
- `OcrResult` (Audit)
- `ImageQualityResult` (Audit)
- `BrandRuleSet` (Admin Only)
- `ModerationQueue` (Admin Only)

## Public Tables

- `VoucherProduct`: read-only active catalog/listing data
- `GiftCardProduct`: read-only active catalog/listing data
- `VtuDataPlan`: read-only active catalog/listing data
- `NumberCountry`: read-only active catalog/listing data
- `VirtualNumberProduct`: read-only active catalog/listing data
- `digital_access_categories`: read-only active catalog/listing data
- `digital_access_services`: read-only active catalog/listing data
- `digital_access_plans`: read-only active catalog/listing data
- `MarketplaceAgency`: read-only active catalog/listing data
- `MarketplaceCreator`: read-only active catalog/listing data

## Internal Tables

- `User` (Authentication)
- `TeamMember` (Authentication)
- `Session` (Authentication)
- `Wallet` (Financial)
- `LedgerEntry` (Financial)
- `PaymentIntent` (Financial)
- `Voucher` (Secrets)
- `VoucherClaimToken` (Secrets)
- `CampaignStatusHistory` (Audit)
- `CampaignInvoice` (Financial)
- `CampaignBudgetHold` (Financial)
- `CampaignSpendEntry` (Financial)
- `CampaignLedgerEntry` (Financial)
- `EventOutbox` (Audit)
- `GrowthOrder` (Financial)
- `ProviderRoutingAttempt` (Audit)
- `FxRate` (Financial)
- `FxRateCache` (Financial)
- `FxQuote` (Financial)
- `SettlementInstruction` (Financial)
- `SettlementReconciliation` (Financial)
- `SettlementWebhookEvent` (Financial)
- `GiftCardSellQuote` (Financial)
- `GiftCardSellTransaction` (Financial)
- `GiftCardPurchaseQuote` (Financial)
- `GiftCardPurchaseTransaction` (Secrets)
- `GiftCardWalletCharge` (Financial)
- `AirtimeCashoutQuote` (Financial)
- `AirtimeCashoutTransaction` (Financial)
- `ProviderWebhookEvent` (Audit)
- `VtuOrder` (Financial)
- `VtuWalletCharge` (Financial)
- `VirtualNumberMessage` (Internal Infrastructure)
- `VirtualNumberOrder` (Financial)
- `VirtualNumberWalletCharge` (Financial)
- `VirtualNumberPurchaseLimit` (Financial)
- `VirtualNumberReconciliation` (Financial)
- `VirtualNumberMarginAnalytics` (Financial)
- `digital_access_wallet_charges` (Financial)
- `NotificationDeliveryAttempt` (Audit)
- `AuditLog` (Audit)
- `TwoFactorBackupCode` (Authentication)
- `ApiKey` (Secrets)
- `OutgoingWebhookSubscription` (Secrets)
- `OutgoingWebhookDelivery` (Audit)
- `RewardFulfillment` (Internal Infrastructure)
- `VerificationEvent` (Audit)
- `RewardQrCode` (Secrets)
- `SubmissionSecret` (Secrets)
- `ValidationRun` (Audit)
- `StageResult` (Audit)
- `Signal` (Audit)
- `OcrResult` (Audit)
- `ImageQualityResult` (Audit)

## Attack Review

- Horizontal privilege escalation: direct Supabase users cannot query organization, campaign, media, persona, workflow, order, wallet, or notification rows. They must go through API authorization.
- Vertical privilege escalation: no Supabase client role receives write policies; clients cannot self-promote, edit listings, change pricing, or mutate financial state.
- Token leakage: token/hash/encrypted material tables receive no client policies and no client grants.
- Wallet manipulation: wallet, ledger, payment, charge, order, invoice, and settlement tables are service-role-only.
- Anonymous access: anonymous users can only read active public catalogs/listings.
- Audit tampering: audit/event/validation tables have RLS and no client write policies.
- Webhook abuse: webhook subscriptions, secrets, delivery payloads, and provider raw events are service-role-only.

## Remaining Risks

- Supabase Dashboard API settings should verify that non-public tables are not exposed in PostgREST schemas beyond the lack of grants/policies.
- If a future Flutter/mobile client starts using Supabase Auth directly, add claim-aware helper functions and scoped policies instead of broadening the current policies.
- Public listings may reveal business marketplace inventory. This is intentional for active listings, but inactive/deleted listings remain hidden.
- RLS does not replace application-level authorization in Nest; controller guards and service checks must remain enforced.

## Performance Impact

- Private tables have no client policies, so client role scans are blocked early.
- Public policies use simple boolean/deletion predicates on small catalog/listing tables.
- Added partial indexes support active public listing/catalog filters used by RLS and public API reads.
