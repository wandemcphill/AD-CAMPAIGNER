# Campaign Spend Transparency

## Architecture Report

The managed ads workflow now has a canonical campaign ledger read model that sits beside the existing wallet, invoice, budget hold, payment intent, spend capture, and report records. Existing tables remain the source of truth for their operational domains:

- `Wallet` and `LedgerEntry` keep workspace wallet balance math.
- `PaymentIntent` keeps checkout, Korapay reference, verification, and credit timing.
- `CampaignInvoice` keeps issued/paid invoice state and historical line items.
- `CampaignBudgetHold` keeps reserved campaign funds and release/capture lifecycle.
- `CampaignSpendEntry` keeps operator-entered delivery spend.
- `CampaignReport` keeps client-facing performance reports.

`CampaignLedgerEntry` is the client-facing canonical financial timeline. New financial operations write campaign ledger rows as they happen. Read APIs also synthesize legacy rows from historical source records so existing campaigns and invoices remain visible before any backfill job runs.

## Schema Proposal

`CampaignLedgerEntry` stores one auditable campaign financial event.

Core fields:

- `workspaceId`, `campaignId`
- optional links to `walletId`, `walletLedgerEntryId`, `paymentIntentId`, `campaignInvoiceId`, `campaignBudgetHoldId`, `campaignSpendEntryId`, `campaignReportId`
- `actorUserId`
- `type`: `WALLET_FUNDING`, `INVOICE_PAYMENT`, `BUDGET_ALLOCATION`, `AD_SPEND`, `CREATIVE_COST`, `AGENCY_FEE`, `REFUND`, `ADJUSTMENT`
- `direction`: `CREDIT`, `DEBIT`, `HOLD`, `RELEASE`, `REVERSAL`
- `amountMinor`, `currency`
- `category`, `description`, `notes`
- `occurredAt`
- `sourceType`, `sourceId`
- `idempotencyKey`
- `metadata`

The table is additive and includes indexes for campaign timelines, campaign category summaries, workspace audit views, and source deduplication.

## API

Campaign financial endpoints:

- `GET /campaigns/:id/ledger`
- `GET /campaigns/:id/budget-summary`
- `GET /campaigns/:id/spend-breakdown`

The ledger endpoint returns persisted canonical entries plus legacy-derived entries when a canonical row does not already exist for the same source/type/direction. The summary endpoint calculates total budget, invoice paid, allocated budget, funds used, remaining balance, pending spend, refunds, ad spend, creative costs, agency fees, and adjustments. The breakdown endpoint returns spend categories and spend timeline.

## Migration Plan

1. Deploy the additive Prisma migration.
2. Generate Prisma client.
3. Deploy API with ledger synthesis enabled.
4. Deploy frontend panels and financial history page.
5. Optional backfill: insert canonical rows for historical invoices, holds, spends, reports, and campaign-linked payment intents using the same source keys used by the read model.
6. Monitor for duplicate source keys and compare summary totals against invoice/hold/spend records.

No breaking changes are required. Existing campaigns continue to use their original invoices, wallet ledger entries, holds, spend captures, and reports. Historical invoices remain valid because invoice data is not rewritten.
