# Korapay Proof Report

Date: 2026-06-05

Scope: Korapay payment creation, verification, webhook processing, wallet credit, ledger updates, idempotency, and duplicate-credit protections.

Status: **BLOCKED FOR REAL-MONEY PROOF**

The platform’s Korapay code path and local financial protections were audited and tested, but a real Korapay payment could not be executed from this workspace because no Korapay credentials, database URL, JWT secret, public webhook URL, or checkout evidence are available in the current environment.

## Bottom Line

| Requirement | Result |
| --- | --- |
| Payment intent creation audited | Pass |
| Korapay verification flow audited | Pass |
| Korapay webhook signature flow audited | Pass |
| Wallet credit and ledger flow audited | Pass |
| Webhook replay duplicate-credit proof | Pass in automated local test |
| Duplicate verification duplicate-credit proof | Pass in automated local test |
| Real sandbox/live transaction executed | Blocked |
| Real payment flow verified | Not yet |

Success criteria are **not fully met** because real money did not move through Korapay in this environment.

## Official Korapay Contract Checked

Korapay’s official docs define the charge initialization endpoint as:

- `POST https://api.korapay.com/merchant/api/v1/charges/initialize`
- required fields include `amount`, `currency`, `reference`, and `notification_url`

Source: [Kora Public APIs](https://docs.korapay.com/)

Korapay’s webhook docs define:

- events such as `charge.success` and `charge.failed`
- payload shape with `event` and `data`
- `x-korapay-signature`
- HMAC SHA256 over only the webhook `data` object
- non-200 or timeout responses are retried for up to 72 hours

Source: [Korapay Webhooks](https://developers.korapay.com/docs/webhooks)

The implementation matches this contract.

## Environment Prerequisite Check

Sanitized environment check result:

| Variable | Present |
| --- | --- |
| `PAYMENT_PROVIDER` | No |
| `KORAPAY_BASE_URL` | No |
| `KORAPAY_PUBLIC_KEY` | No |
| `KORAPAY_SECRET_KEY` | No |
| `KORAPAY_ENCRYPTION_KEY` | No |
| `KORAPAY_WEBHOOK_URL` | No |
| `KORAPAY_WEBHOOK_SECRET` | No |
| `KORAPAY_REDIRECT_URL` | No |
| `DATABASE_URL` | No |
| `JWT_SECRET` | No |

Only `.env.example` is present locally. No secrets were printed or stored in this report.

## Code Audit

### Payment Creation

Files:

- `packages/providers/src/index.ts`
- `apps/api/src/modules/managed-ads.service.ts`
- `apps/api/src/modules/platform.controllers.ts`

Flow:

1. `POST /payments/intents` requires `payment:manage`.
2. `ManagedAdsService.createPaymentIntent` validates positive amount and workspace permission.
3. In production, missing live Korapay configuration fails closed.
4. The provider initializes Korapay charge with amount, currency, merchant reference, customer details, redirect URL, and notification URL.
5. `PaymentIntent` persists `providerReference`, `checkoutUrl`, wallet linkage, and idempotency key.

Payment creation protection:

- positive minor-unit amount required
- workspace-scoped payment permission required
- production rejects mock/missing Korapay config
- caller idempotency key or deterministic fallback key prevents repeated intent creation
- reused idempotency key from another workspace is rejected

### Verification Flow

Flow:

1. `POST /payments/verify/:reference` requires `payment:manage`.
2. Provider calls Korapay charge lookup by reference.
3. Local `PaymentIntent` is looked up by provider reference and active workspace.
4. `completePaymentIntent` performs completion and wallet credit inside a database transaction.

Duplicate verification protection:

- `completePaymentIntent` locks the payment intent row.
- If `status === COMPLETED` and `creditedAt` exists, it returns the existing intent.
- No wallet ledger write happens on repeated verification.

### Webhook Processing

Flow:

1. `POST /api/webhooks/korapay` is public as required for provider callbacks.
2. `verifyKorapaySignature` checks `x-korapay-signature`.
3. Signature input is `JSON.stringify(body.data)`, matching Korapay docs.
4. A webhook receipt is stored in `EventOutbox` using a replay idempotency key.
5. Matching `PaymentIntent` is completed through the same transaction path used by verification.
6. Processed webhook receipt is marked `PROCESSED`.

Replay protection:

- processed webhook receipt returns `{ duplicate: true }`
- even if replay reaches payment completion again, `creditedAt` and ledger idempotency prevent duplicate credit

### Wallet Credit and Ledger Update

Flow in `completePaymentIntent`:

1. Lock `PaymentIntent`.
2. Read payment intent.
3. Return existing intent if already completed and credited.
4. Lock wallet.
5. Create wallet `CREDIT` ledger entry with idempotency key `payment:{intent.id}:credit`.
6. If linked to an invoice, create invoice debit with idempotency key `payment:{intent.id}:invoice_debit`.
7. Create campaign ledger entries where applicable.
8. Run wallet consistency check.
9. Update `PaymentIntent.status`, `completedAt`, and `creditedAt`.

Database protections:

- `LedgerEntry.idempotencyKey` is unique.
- `PaymentIntent.idempotencyKey` is unique.
- wallet credit uses `ledgerEntry.upsert`.
- wallet consistency rejects negative amount corruption and inconsistent ledger state.

## Automated Evidence Captured

Commands run:

```bash
corepack pnpm --filter @fliptrybe/api exec vitest run src/modules/managed-ads.service.spec.ts --pool=forks --reporter=dot
corepack pnpm --filter @fliptrybe/api test -- --pool=forks --reporter=dot
corepack pnpm --filter @fliptrybe/api build
corepack pnpm prisma:validate
```

Results:

- Managed Ads focused test: 1 file passed, 26 tests passed
- Full API test suite: 9 files passed, 68 tests passed
- API build: passed
- Prisma schema validation: passed

New tests added:

- signed Korapay webhook credits wallet once and marks webhook receipt processed
- replay of processed webhook returns duplicate and does not write another wallet credit
- duplicate payment verification for an already credited payment does not write another wallet credit or update payment intent again

## Payload Samples

### Payment Intent Request

```json
{
  "amountMinor": 1000,
  "currency": "NGN",
  "customerEmail": "payer@example.com",
  "customerName": "Test Payer",
  "idempotencyKey": "korapay-proof:workspace:lowest-value"
}
```

Expected provider initialization body:

```json
{
  "amount": "10.00",
  "currency": "NGN",
  "reference": "ft_pay_<generated>",
  "customer": {
    "name": "Test Payer",
    "email": "payer@example.com"
  },
  "redirect_url": "<KORAPAY_REDIRECT_URL>",
  "notification_url": "<KORAPAY_WEBHOOK_URL>",
  "metadata": {
    "workspaceId": "<workspaceId>"
  }
}
```

### Webhook Payload

```json
{
  "event": "charge.success",
  "data": {
    "amount": 10,
    "currency": "NGN",
    "reference": "ft_pay_webhook_123",
    "status": "success"
  }
}
```

Expected signature:

```text
HMAC_SHA256(JSON.stringify(data), KORAPAY_WEBHOOK_SECRET)
```

Header:

```text
x-korapay-signature: <hex digest>
```

## Database Effects Proven by Test

Expected on first successful webhook:

| Table | Effect |
| --- | --- |
| `EventOutbox` | Upsert `KorapayWebhookReceived` receipt |
| `PaymentIntent` | Update `status=COMPLETED`, set `completedAt`, set `creditedAt` |
| `LedgerEntry` | Upsert `CREDIT` with `idempotencyKey=payment:{intent.id}:credit` |
| `CampaignLedgerEntry` | Upsert wallet funding entry when campaign-linked |

Expected on webhook replay:

| Table | Effect |
| --- | --- |
| `EventOutbox` | Existing processed receipt detected |
| `PaymentIntent` | No completion update required |
| `LedgerEntry` | No duplicate credit |

Expected on duplicate verification:

| Table | Effect |
| --- | --- |
| `PaymentIntent` | Existing completed/credited intent returned |
| `LedgerEntry` | No duplicate credit |

## Wallet Evidence

Automated proof:

- first webhook creates exactly one `LedgerEntry` credit with idempotency key `payment:payment_123:credit`
- replay webhook does not increase `ledgerEntry.upsert` calls
- duplicate verification does not call `ledgerEntry.upsert`

Real database wallet balance evidence is not available because no `DATABASE_URL` or real Korapay transaction exists in this environment.

## Test Transaction Plan

Use Korapay sandbox if available; otherwise use the lowest practical live amount approved by finance.

1. Configure:
   - `PAYMENT_PROVIDER=live`
   - `KORAPAY_PUBLIC_KEY`
   - `KORAPAY_SECRET_KEY`
   - `KORAPAY_ENCRYPTION_KEY`
   - `KORAPAY_WEBHOOK_SECRET`
   - `KORAPAY_WEBHOOK_URL=https://<public-api-host>/api/webhooks/korapay`
   - `KORAPAY_REDIRECT_URL=https://<app-host>/payments/return`
   - `DATABASE_URL`
   - `JWT_SECRET`
2. Ensure webhook URL is public and unauthenticated.
3. Create a finance-authorized workspace user.
4. Record wallet balance and ledger entry count before payment.
5. Create payment intent for the lowest approved amount.
6. Open the Korapay checkout URL.
7. Complete payment in sandbox/live checkout.
8. Capture:
   - payment intent JSON
   - checkout screenshot
   - Korapay dashboard transaction screenshot
   - webhook payload and headers
   - API webhook response
   - `PaymentIntent` row after completion
   - `LedgerEntry` row after completion
   - wallet balance before/after
9. Replay webhook with identical payload and signature.
10. Re-run verification endpoint.
11. Confirm no second wallet credit or duplicate ledger entry.

## Evidence Still Required for Launch

Real-payment proof must add:

- Korapay checkout screenshot
- Korapay dashboard transaction screenshot
- real payment intent row
- real webhook delivery log
- real wallet before/after balance
- real ledger entry row
- replay webhook log showing duplicate/no-op behavior
- duplicate verification log showing no duplicate credit

## Current Blockers

| Blocker | Impact |
| --- | --- |
| No Korapay credentials in environment | Cannot initialize a real or sandbox charge. |
| No `DATABASE_URL` in environment | Cannot capture real persistent wallet/ledger effects. |
| No `JWT_SECRET` in environment | Cannot create authenticated API proof calls against protected payment routes. |
| No public webhook URL configured | Korapay cannot deliver a real webhook to this local environment. |
| No checkout execution | No screenshot or dashboard evidence can be captured. |

## Conclusion

The Korapay integration is structurally wired and the duplicate-credit protections pass automated tests. The code path uses signed webhook verification, transactional payment completion, wallet locking, unique ledger idempotency keys, and early return for already credited payment intents.

However, the actual launch concern, “Korapay flow not proven,” remains open until a real sandbox/live Korapay checkout is completed and captured with database evidence. This report should be treated as a readiness proof for the code path, not as real-money production validation.
