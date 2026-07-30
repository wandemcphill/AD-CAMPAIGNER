# Financial Integrity Report

Date: 2026-06-04

Scope: payment intents, Korapay webhook handling, wallet ledger behavior, invoice and budget-hold mutations, Growth Marketplace charging, OTP/Digital Access wallet paths, duplicate processing, replay, negative balances, and double-spend exposure.

Launch gate: FAIL. Critical money-integrity vulnerabilities remain unresolved.

## Executive Summary

The database schema includes useful financial controls: wallet uniqueness per workspace/currency, ledger idempotency keys, payment intent idempotency keys, campaign hold idempotency keys, and campaign ledger idempotency keys.

The runtime API does not consistently enforce those controls. Several money paths accept arbitrary or negative amounts, privileged finance actions are exposed to any workspace member, Growth Marketplace orders can be submitted to suppliers without a wallet charge, and budget hold capture can debit more than the reserved amount. These issues can create artificial wallet credits, negative balances, unpaid supplier liabilities, and inconsistent campaign finance records.

Goal status: "No unresolved Critical vulnerabilities" is not met.

## Risk Register

| ID | Severity | Area | Risk | Status |
| --- | --- | --- | --- | --- |
| FIN-01 | Critical | Invoice/wallet | Negative invoice amounts can create negative wallet debits, increasing available balance. | Open |
| FIN-02 | Critical | Budget holds | Negative holds and over-capture can create artificial credit or negative balances. | Open |
| FIN-03 | Critical | Growth Marketplace | Growth orders can be placed and supplier orders submitted without wallet debit or payment capture. | Open |
| FIN-04 | Critical | Authorization | Invoice, budget hold, release, and capture actions require only workspace membership, not finance permission. | Open |
| FIN-05 | High | Payment intent creation | Amount, invoice/campaign linkage, webhook URL, and idempotency are caller-controlled with insufficient validation. | Open |
| FIN-06 | High | Cross-record integrity | Payment intents can reference campaign/invoice IDs without validating workspace ownership at creation time. | Open |
| FIN-07 | High | Hold race/double release | Concurrent release and capture can both operate on an ACTIVE hold because the hold row is not re-read after wallet lock. | Open |
| FIN-08 | Medium | Webhook replay/concurrency | Completed payment replay is mostly idempotent, but concurrent completion can produce duplicate-key errors instead of clean replay handling. | Open |
| FIN-09 | Medium | OTP wallet | OTP charge/refund helpers are idempotent but process-global and exposed by public routes. | Open |
| FIN-10 | Low | Digital Access | Digital Access uses transactions, wallet row locks, idempotency, and admin checks; this is the strongest local pattern. | Observed |

## Payment Audit

### FIN-05 - Payment Intents Accept Unvalidated Amounts and Caller-Controlled Linkage

Severity: High

Proof:

- Payment intent creation reads `amountMinor` directly with `Number(...)` and no positive integer validation at `apps/api/src/modules/managed-ads.service.ts:1044-1048`.
- It accepts caller-supplied `campaignId`, `invoiceId`, `campaignInvoiceId`, `customerEmail`, `customerName`, and optional `idempotencyKey` at `apps/api/src/modules/managed-ads.service.ts:1059-1075`.
- The mock gateway stores the amount unchanged at `packages/providers/src/index.ts:668-683`.
- Korapay initialization sends the amount from input to the provider at `packages/providers/src/index.ts:696-715`.

Reproduction steps:

1. Authenticate as any workspace member.
2. Call `POST /v1/payments/intents` with `{"amountMinor":0}`.
3. Repeat with `{"amountMinor":-100000}`.
4. Repeat with `{"amountMinor":1,"invoiceId":"<some invoice id>"}`.
5. Observe that intent creation has no route-level finance permission and no amount validation before gateway creation.

Estimated impact:

Users can create invalid payment intents, spam duplicate checkout sessions, manipulate invoice payment amounts, and potentially attach payment records to records they should not control.

Recommended fixes:

- Validate `amountMinor` as a positive safe integer above a configured minimum.
- Validate currency.
- Require idempotency for payment intent creation and perform an idempotent lookup before provider calls.
- Reject caller-supplied `webhookUrl` unless explicitly allowlisted.
- Resolve and validate `campaignId` and `invoiceId` belong to the active workspace before creating the intent.
- Require `payment:manage` for admin-created payment intents and explicit ownership checks for client-created intents.

### FIN-08 - Webhook Replay Is Partly Idempotent But Not Event-Idempotent

Severity: Medium

Proof:

- Korapay webhook finds a payment intent by provider reference at `apps/api/src/modules/managed-ads.service.ts:1109-1116`.
- `completePaymentIntent` returns early when status is `COMPLETED` and `creditedAt` exists at `apps/api/src/modules/managed-ads.service.ts:2669-2671`.
- The wallet credit ledger uses idempotency key `payment:${intent.id}:credit` at `apps/api/src/modules/managed-ads.service.ts:2680-2692`.
- There is no stored webhook event ID, replay nonce, or provider event ledger in the webhook path.

Reproduction steps:

1. Deliver a valid completed webhook for a payment reference.
2. Deliver the same webhook again after the first transaction commits.
3. The second request should return the completed intent without double credit.
4. Deliver the same webhook concurrently from two clients.
5. One transaction can attempt the same ledger idempotency key and fail instead of returning a clean idempotent response.

Estimated impact:

Replay after completion is mostly safe, but concurrent webhook replay can cause operational errors and noisy payment reconciliation. Lack of event storage also weakens auditability.

Recommended fixes:

- Store provider event IDs/signature hashes in a webhook event table with a unique key.
- Lock the payment intent row before checking `creditedAt`.
- Return a consistent idempotent success response for duplicate concurrent webhooks.
- Alert on unmatched references and repeated failed webhooks.

### FIN-06 - Payment Intent Can Reference Unvalidated Campaign/Invoice IDs

Severity: High

Proof:

- `campaignId` and `campaignInvoiceId` are inserted from input at `apps/api/src/modules/managed-ads.service.ts:1063-1064`.
- Webhook completion updates an invoice by ID without validating that the invoice workspace matches the payment intent workspace at `apps/api/src/modules/managed-ads.service.ts:2696-2721`.

Reproduction steps:

1. Obtain or guess an invoice ID outside the active workspace.
2. Create a payment intent in the attacker's workspace with that `invoiceId`.
3. Complete the payment through verification or webhook.
4. Observe the completion path loads and updates the referenced invoice by ID.

Estimated impact:

If invoice IDs leak through admin/data exposure, an attacker could tamper with another workspace's invoice payment state or create inconsistent campaign ledger records.

Recommended fixes:

- On intent creation, load invoice and campaign by `{ id, workspaceId: scope.workspaceId }`.
- In `completePaymentIntent`, validate every related campaign/invoice wallet belongs to the intent workspace.
- Add database-level consistency checks where possible, or transaction assertions before updates.

## Invoice Manipulation and Negative Balance Tests

### FIN-01 - Negative Invoice Payment Can Increase Wallet Balance

Severity: Critical

Proof:

- `createCampaignInvoice` accepts `totalMinor` from input with no positive validation at `apps/api/src/modules/managed-ads.service.ts:1139-1154`.
- `payInvoice` calculates amount due as `invoice.totalMinor - invoice.amountPaidMinor` at `apps/api/src/modules/managed-ads.service.ts:1201-1207`.
- `payInvoice` creates a wallet `DEBIT` using that amount at `apps/api/src/modules/managed-ads.service.ts:1202-1214`.
- The ledger math subtracts DEBIT/HOLD values at `packages/payments/src/index.ts:29-38`. A negative DEBIT therefore increases available balance.

Reproduction steps:

1. Authenticate as any workspace member.
2. Create an invoice: `POST /v1/campaigns/{campaignId}/invoices` with `{"totalMinor":-100000,"taxMinor":0}`.
3. Pay it: `POST /v1/invoices/{invoiceId}/pay` with `{"method":"wallet"}`.
4. Read wallet: `GET /v1/wallet`.
5. Expected exploit result: a negative DEBIT ledger entry increases available balance by 100000 minor units.

Estimated impact:

An abusive customer or dishonest operator can mint wallet balance, mark an invoice paid, and corrupt campaign finance history.

Recommended fixes:

- Reject invoice subtotal, tax, total, and line item amounts unless they are positive safe integers.
- Reject wallet payment if amount due is less than or equal to zero.
- Add database constraints for non-negative invoice fields and positive ledger amounts.
- Add tests that negative invoice creation and payment are rejected.

### FIN-04 - Invoice and Budget Actions Lack Finance Permission

Severity: Critical

Proof:

- Invoice, hold, release, and capture endpoints are wired at `apps/api/src/modules/platform.controllers.ts:328-373`.
- These service methods call `requireScope` but do not require `payment:manage` at `apps/api/src/modules/managed-ads.service.ts:1139-1441`.
- The permission checker exists but is not used here at `apps/api/src/modules/managed-ads.service.ts:1902-1917`.

Reproduction steps:

1. Authenticate as VIEWER, SUPPORT, or MARKETER.
2. Create an invoice, create a budget hold, release it, or capture it.
3. Observe finance mutations are accepted if the user belongs to the workspace.

Estimated impact:

Any workspace member can manipulate invoices, wallet reserves, ad spend capture, and campaign finance reporting.

Recommended fixes:

- Require `payment:manage` for invoice, payment, budget hold, release, and capture endpoints.
- Consider `campaign:manage` plus `payment:manage` for campaign-specific finance actions.
- Add role tests for all seven roles.

## Wallet Audit

### FIN-02 - Negative Holds and Over-Capture Break Balance Integrity

Severity: Critical

Proof:

- `createBudgetHold` accepts `amountMinor` from input without positive validation at `apps/api/src/modules/managed-ads.service.ts:1248-1253`.
- It checks wallet balance against that amount at `apps/api/src/modules/managed-ads.service.ts:1259-1262`; a negative amount trivially passes.
- It creates a HOLD ledger entry with the supplied amount at `apps/api/src/modules/managed-ads.service.ts:1262-1274`.
- `captureBudgetHold` accepts capture amount from input at `apps/api/src/modules/managed-ads.service.ts:1371`.
- It releases the full hold and debits the requested amount without checking that `amountMinor <= hold.amountMinor` or that the wallet can pay the excess at `apps/api/src/modules/managed-ads.service.ts:1372-1398`.

Reproduction steps:

Negative hold:

1. `POST /v1/campaigns/{campaignId}/budget-holds` with `{"amountMinor":-500000}`.
2. Read `GET /v1/wallet`.
3. Expected exploit result: a negative HOLD increases available balance.

Over-capture:

1. Create a normal hold for 10000 minor units.
2. `POST /v1/campaigns/{campaignId}/budget-holds/{holdId}/capture` with `{"amountMinor":100000000}`.
3. Read wallet and campaign ledger.
4. Expected exploit result: wallet can go negative or record spend far above reserved budget.

Estimated impact:

Attackers can mint balance, bypass holds, overspend campaign budgets, or create unrecoverable reconciliation gaps.

Recommended fixes:

- Reject hold amount unless it is a positive safe integer.
- Reject capture amount unless it is positive and `<= hold.amountMinor`.
- If partial captures are allowed, track remaining held amount explicitly.
- In `captureBudgetHold`, after locking the wallet, re-check current hold status and wallet balance.
- Add DB constraints for positive `LedgerEntry.amountMinor`, `CampaignBudgetHold.amountMinor`, and `CampaignSpendEntry.amountMinor`.

### FIN-07 - Concurrent Release and Capture Can Double-Release a Hold

Severity: High

Proof:

- `releaseBudgetHold` reads the hold and checks `status !== "ACTIVE"` before locking the wallet at `apps/api/src/modules/managed-ads.service.ts:1310-1320`.
- `captureBudgetHold` does the same at `apps/api/src/modules/managed-ads.service.ts:1361-1372`.
- Release and capture use different ledger idempotency keys: `hold:${hold.id}:release` at `apps/api/src/modules/managed-ads.service.ts:1327-1329` and `hold:${hold.id}:capture_release` at `apps/api/src/modules/managed-ads.service.ts:1379-1382`.

Reproduction steps:

1. Create an ACTIVE hold.
2. Fire `release` and `capture` requests concurrently against the same hold.
3. Because both can read ACTIVE before either commits, the second transaction can continue after waiting for the wallet lock using stale hold state.
4. Expected result: both a release and capture release can be recorded, or one path fails with an operational error depending on timing.

Estimated impact:

Race conditions can credit/release funds twice or produce inconsistent hold state.

Recommended fixes:

- Lock the hold row with `SELECT ... FOR UPDATE` or update it using a conditional `where: { id, status: "ACTIVE" }`.
- Re-read the hold after obtaining the lock.
- Use one terminal transition function for release/capture/cancel.
- Add concurrency tests that race release vs capture.

## Duplicate Payment Processing and Replay

Observed controls:

- `LedgerEntry.idempotencyKey` is unique at `packages/database/prisma/schema.prisma:501-520`.
- `PaymentIntent.idempotencyKey` is unique at `packages/database/prisma/schema.prisma:523-534`.
- `CampaignBudgetHold.idempotencyKey` is unique at `packages/database/prisma/schema.prisma:843-852`.
- `CampaignLedgerEntry.idempotencyKey` is unique at `packages/database/prisma/schema.prisma:896-918`.
- `completePaymentIntent` uses deterministic ledger keys at `apps/api/src/modules/managed-ads.service.ts:2680-2692`, `2702-2714`, and `2742-2756`.

Residual risk:

- Payment intent idempotency is optional, so duplicate intent creation is not prevented.
- Webhook event IDs are not stored.
- Concurrent duplicate completions may fail rather than return clean idempotent success.

## Growth Marketplace Audit

### FIN-03 - Growth Orders Can Be Submitted Without Charge

Severity: Critical

Proof:

- `createGrowthOrder` computes a customer price at `apps/api/src/modules/platform.service.ts:752-761`.
- It creates/submits SMM supplier orders at `apps/api/src/modules/platform.service.ts:815-838`.
- It stores the Growth order in memory at `apps/api/src/modules/platform.service.ts:837-838`.
- There is no wallet debit, payment intent, invoice, or ledger write in `createGrowthOrder` at `apps/api/src/modules/platform.service.ts:718-871`.

Reproduction steps:

1. Authenticate as any workspace member.
2. Call `POST /v1/growth/orders` with a valid service and quantity.
3. Observe a Growth order and possibly supplier order are created.
4. Call `GET /v1/wallet` and observe no corresponding debit.

Estimated impact:

If SMM suppliers are live, users can trigger supplier cost without paying. This creates direct loss and unreconciled liabilities.

Recommended fixes:

- Before supplier submission, create a wallet hold/debit or require a completed payment.
- Store Growth orders and charges in Prisma with idempotency keys.
- Use the Digital Access transaction pattern: resolve tenant, idempotency lookup, lock wallet, assert balance, write debit, create order, enqueue fulfillment.
- Refund/reverse only through an idempotent financial reversal.

## OTP and Digital Access Financial Notes

OTP:

- OTP creates orders and charges process-global wallet state at `apps/api/src/modules/otp/otp.service.ts:213-315`.
- OTP cancellation/refund uses idempotent refund helper at `apps/api/src/modules/otp/otp.service.ts:373-402`.
- The helper prevents duplicate refunds at `services/otp/src/index.ts:493-520`.
- However, OTP endpoints are public at `apps/api/src/modules/otp/otp.controller.ts:25-87`.

Digital Access:

- Digital Access creates requests in a serializable transaction at `apps/api/src/modules/digital-access/digital-access.service.ts:284-430`.
- It locks wallet rows at `apps/api/src/modules/digital-access/digital-access.service.ts:344-349` and `1317-1339`.
- It performs idempotent refunds at `apps/api/src/modules/digital-access/digital-access.service.ts:1342-1378`.
- It enforces admin access at `apps/api/src/modules/digital-access/digital-access.service.ts:1259-1295`.

Recommendation:

Use Digital Access as the model for Growth, OTP, invoice payment, and campaign budget hold flows.

## Required Remediation Before Launch

1. Block negative or zero financial amounts at API and database layers.
2. Add `payment:manage` checks to invoice, payment, wallet, hold, release, and capture actions.
3. Validate payment intent related records belong to the active workspace.
4. Make payment intent creation idempotent before provider calls.
5. Add provider webhook event idempotency and payment intent row locking.
6. Charge or reserve funds before Growth supplier submission.
7. Convert OTP from public process-global state to authenticated, workspace-scoped, persistent ledger flows.
8. Add concurrency tests for payment webhook replay, wallet debits, hold release/capture, invoice payment, and Growth order charge.

