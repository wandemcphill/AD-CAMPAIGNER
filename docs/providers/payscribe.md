# Payscribe — Provider Integration Reference

Status: **DOCUMENTED, NOT PRODUCTION-READY.** Mapped line-by-line against the
official Payscribe API documentation (supplied 2026-08-08). No live credentials
or sandbox transaction has been run yet. The `virtualCards` / `virtualAccounts`
feature flags remain **disabled** until the DONE checklist at the bottom passes.

Adapters: `createPayscribeVirtualCardProvider`, `createPayscribeVirtualAccountProvider`,
`verifyPayscribeWebhook` — all in `packages/providers/src/financial-products.ts`.

---

## Role in FlipTrybe

Payscribe is a **Nigerian** infrastructure provider. It gives FlipTrybe:
- **USD virtual cards** (issued to KYC'd customers; card processor is "Miden").
- **NGN virtual accounts** (collection; funds settle to FlipTrybe's Payscribe NGN collection balance).
- **NGN bank payouts** (documented; see Payout API — can serve the NGN payout leg of remittance).

It is **NOT** a cross-border collection provider — it cannot legally collect
GBP/USD from consumers in the UK/US. For remittance, Payscribe is at most the
**NGN destination payout leg**; the collection + FX legs must come from a
provider that supports the origin jurisdiction (e.g. Fincra).

---

## Base URLs

| Environment | Base URL |
|---|---|
| Sandbox | `https://sandbox.payscribe.ng/api/v1` |
| Production | `https://api.payscribe.ng/api/v1` |

Adapter default: production. Pass `baseUrl` (or `PAYSCRIBE_BASE_URL`) to target sandbox.

## Authentication

- Header: `Authorization: Bearer <secret>`
- Key format: `ps_sk_test_...` (sandbox) / `ps_sk_live_...` (production).
- All requests/responses are JSON. Requests must use HTTPS.

## Required headers

- `Authorization: Bearer <key>`
- `Content-Type: application/json`

## Rate limits

- 60 requests/second. Exceeding returns HTTP `429` `{"message":"API rate limit exceeded"}`.

## Response envelope & status codes

Body shape: `{ status: boolean, description?, message: { description?, details } }`.
A `200` with `status:false` is a **business failure**, not success. The adapter's
`callPayscribeApi` treats both as errors.

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | **Transaction pending — must reverify** via `trans_id`/`ref` |
| 400 | Bad request (missing body field) |
| 401 | Not authenticated |
| 403 | Forbidden — contact support |
| 404 | Not found |
| 405 | Duplicate transaction |
| 406 | Missing required information |
| 407 | Invalid product code / token |
| 408 | Result not found |
| 409 | Invalid amount / transaction limit |
| 410 | Insufficient wallet balance |
| 434 | Operator-side error, transaction failed |
| 435 | Database error, transaction failed |
| 429 | Rate limit exceeded |
| 5xx | Server error |

The adapter maps `201` to an explicit pending error so pending is never treated as success.

---

## Customers (prerequisite for cards & virtual accounts)

Cards and VAs require a Payscribe **customer**. FlipTrybe stores the returned
`customer_id` and passes it to the adapters as `providerCustomerId`. The adapters
**refuse to fabricate a customer** — the service layer must create/enroll one.

- `POST /customers/create` (Tier 0) — `first_name`, `last_name`, `phone` (with country code), `email`, `country?` (default NG) → returns `customer_id`.
- `PATCH /customers/create/tier1` — `customer_id`, `dob` (YYYY-MM-DD), `address{street,city,state,country,postal_code}`, `identification_type` (e.g. BVN), `identification_number`, `photo?`. Required for collections / VAs.
- `PATCH /customers/create/tier2` — `customer_id`, `identity{type(NIN|PASSPORT|VIN),number,country,image}`. Required for card issuing.
- A "Create Customer - Full" endpoint is referenced as a one-shot alternative to the tier upgrades (exact schema not captured — verify in sandbox).

---

## Virtual Cards (USD only)

Flow: create customer → enroll tier 2 → create card → (optional) set MCC/limits.
Card network: VISA | MASTERCARD. Amounts are **USD major units** (decimal, min 1).

| Operation | Method & path | Body |
|---|---|---|
| Issue | `POST /cards/create` | `customer_id`, `currency:"USD"`, `brand`, `amount` (USD major, min 1), `type:"virtual"`, `ref`. Optional `contactless`, `card_limits{daily_limit,transaction_limit}` |
| Top up | `PATCH /cards/{id}/topup` | `amount` (USD major), `ref` |
| Withdraw | `PATCH /cards/{id}/withdraw` | `amount`, `ref` |
| Get | `GET /cards/{id}` | — |
| Freeze | `PATCH /cards/{id}/freeze` | `ref` |
| Unfreeze | `PATCH /cards/{id}/unfreeze` | `ref` |
| Terminate | `POST /cards/{id}/terminate` | `ref` (irreversible) |
| Transactions | `GET /cards/{id}/transactions?start_date&end_date&page&page_size` | — |
| Replace (decommissioned BIN) | `PATCH /cards/replace/{id}` | `card_id` |
| Update contact | `PATCH /cards/{id}/card-contact` | `email`, `mobile`, `billing_details{...}` |

Get-card response `message.details`: `id`, `currency`, `card_type`, `brand`,
`first_six`, `last_four`, `masked`, `card_number`, `expiry`, `ccv`, `balance`,
`status`, `billing{address,country,state,city,postal_code}`, `terminate`,
`terminate_date`, `customer{id,name}`.

Card creation fee: $2 standard / $1 on paid plans. Stablecoin funding (USDT/USDC)
is also available via `payment_method:"stablecoin"`. Cards work mainly at US
merchants; MCC restrictions apply (betting, crypto, dating, etc.).

## Virtual Accounts (NGN only)

A VA does **not** hold a balance — funds settle to the business NGN collection
balance. Supported banks: `9psb`, `palmpay`, `cashconnect`.

| Operation | Method & path | Body |
|---|---|---|
| Create permanent (static) | `POST /collections/virtual-accounts/create` | `account_type:"static"`, `currency:"NGN"`, `customer_id`, `bank:[...]`; `bvn`/`identity_*` required for palmpay tier-0 |
| Create dynamic (temporary) | `POST /collections/virtual-accounts/create` | `account_type:"dynamic"`, `ref`, `currency`, `order{amount,amount_type(EXACT\|ANY),description,expiry{duration,duration_type(hours\|minute)}}`, `customer{name,email,phone}` |
| Get | `GET /collections/virtual-accounts/{account}` | — |
| Deactivate | `POST /collections/virtual-accounts/deactivate` | `account` (the account **number**) |
| Re-activate | `POST /collections/virtual-accounts/activate` | `account` |
| Confirm payment | `POST /collections/virtual-accounts/confirm-payment` | `trans_id`, `session_id`, `amount`, `account_number` |
| Simulate transfer (sandbox) | `POST /collections/virtual-accounts/simulate-transfer` | `ref`, `amount`, `description`, `currency`, `account`, `name`, `bank`, `sender_account_number`, `sender_name`, `hash` |

## Payout API (NGN bank transfers) — documented, not yet adapted

Requires IP whitelisting. Available to serve the NGN payout leg of remittance.

- `GET /payouts/bank/list?country` → `{code,name}[]`
- `POST /payouts/account/lookup` → `{account,bank}` (validate before transfer)
- `GET /payouts/fee/?amount&currency`
- `POST /payouts/transfer` → `amount`, `bank`, `account`, `currency?`, `narration`, `ref`
- `POST /payouts/transfer` (bulk) → `rows[]{bank_code,account_number,amount,narration,country?}`, `ref` → `batch_id`, `processed[]`, `total_charge`
- `GET /payouts/verify/{trans_id}`

---

## Webhooks

Configure per-section webhook URLs in the Payscribe dashboard. Always return
HTTP `200` to acknowledge; non-2xx triggers retries (up to 5, exponential back-off).
Store `X-Payscribe-Event-Id` with a UNIQUE constraint for idempotency.

### Event types (by product)

| Product | Events |
|---|---|
| Virtual account (collection) | `accounts.payment.status` (funds landed in a VA) |
| Payout | `payouts.created`, `payout.transfer.failed` |
| Card | `cards.auth.verified`, `card.adjusted.refund`, `card.status.changed` |
| Payment link | `payment_link.paid` |

`card.status.changed` payload: `card_id`, `customer_id`, `previous_status`,
`new_status`, `created_at`.

Collection (`accounts.payment.status`) payload (captured, likely truncated):
`event_id`, `event_type`, `trans_id`, `amount`, `fee`, `currency`,
`transaction{session_id,date}`.

### Signature verification — DOCUMENTED DISCREPANCY (must confirm in sandbox)

The docs describe **two** schemes:

1. **Webhook Security section (newer):** headers `X-Payscribe-Event-Id`,
   `X-Payscribe-Timestamp`, `X-Payscribe-Signature` (`v1=<hex>`),
   `X-Payscribe-Event`, `Idempotency-Key`. Signed base string:
   `timestamp + "." + event_id + "." + rawBody`, `HMAC-SHA256(secret)`, hex.
   Replay window: reject if `abs(now - timestamp) > 300s`.
2. **Per-product webhook pages (payout/collection/card):**
   `HMAC-SHA256(secret, raw_request_body)` in `X-Payscribe-Signature` (no `v1=`).

`verifyPayscribeWebhook` accepts **either** documented scheme (v1 when the
header is `v1=...` with timestamp+event_id, else the raw-body scheme) and always
enforces the replay window when a timestamp is present. **This ambiguity must be
resolved against a real sandbox delivery before go-live.**

Secret: `ps_sk_test_...`/`ps_sk_live_...` (or the webhook secret from the dashboard),
supplied via `PAYSCRIBE_WEBHOOK_SECRET`.

---

## Currency, country, corridor, fees, limits

- **Cards:** USD only; customer domicile NG. Card fee $2/$1. Min load $1.
- **Virtual accounts:** NGN only.
- **Payouts:** NGN only (`country` "defaults to NGN, the only available country at the moment").
- **Corridors:** Payscribe alone supports **no cross-border corridor** — origin is Nigeria for all products. Fees are per-product and returned by the API (`GET /payouts/fee`), not hard-coded.

## Sandbox vs production

- Different hosts (see Base URLs). Never mix `ps_sk_test_` and `ps_sk_live_` keys.
- Sandbox provides `simulate-transfer` for VA-credit testing and card sandbox flows.

## Required customer / KYC information

- Tier 0: name, phone, email, country.
- Tier 1 (collections/VA): DOB, full address, government ID type + number (e.g. BVN).
- Tier 2 (cards): identity document (NIN/PASSPORT/VIN) with image.

---

## Adapter GAPS still requiring sandbox verification

1. **Card `expiry` format** — docs give `expiry` as an unspecified string; `parsePayscribeExpiry` handles MM/YY and MM/YYYY defensively.
2. **Card-create response shape** — only partially documented; the adapter reads `message.details.card` and falls back to `getCard` field names.
3. **Terminate refund semantics** — termination is irreversible and does not itself return funds; balance must be reclaimed via `PATCH /cards/{id}/withdraw` first. The adapter reports the pre-terminate balance as `refundableMinor` but does **not** auto-withdraw.
4. **VA-credit webhook → account mapping** — the captured `accounts.payment.status` payload does not clearly include the destination account number; the webhook handler looks under several keys. Verify with `simulate-transfer`.
5. **VA-credit amount units** — Payscribe reports `amount` in **major** units (naira); the ledger uses minor (kobo). A provider-specific normalization is required before go-live (flagged in the webhook handler).

## DONE checklist (feature flag stays off until all pass)

- [ ] Sandbox credentials obtained; auth works.
- [ ] Customer create + tier-2 enrollment works in sandbox.
- [ ] Card issue + topup + freeze/unfreeze + terminate verified in sandbox.
- [ ] VA create + `simulate-transfer` credit → webhook received & verified.
- [ ] Webhook signature scheme confirmed (resolve the v1-vs-raw discrepancy).
- [ ] Idempotency verified (duplicate `X-Payscribe-Event-Id` → one ledger effect).
- [ ] Amount-unit normalization (major↔minor) implemented and tested.
- [ ] Ledger entries reconcile against Payscribe wallet ledger / transactions list.
- [ ] Provider transaction IDs (`trans_id`) persisted on every record.
- [ ] Enable via `ProviderConfig` row, then flip the feature flag.
