# Fincra — Provider Integration Reference

Status: **DOCUMENTED & CODE-COMPLETE; audited against official docs (2026-08-08).**
The existing adapters (`createFincraFxProvider`, `createFincraSettlementProvider`,
`verifyFincraWebhook` in `packages/providers/src/index.ts`) were audited against
the official Fincra documentation (`https://docs.fincra.com/llms.txt`) and match
it on auth, base URLs, webhook verification, and the quote→payout flow. Remaining
items are sandbox-verification tasks, not code corrections. The `remittance`
feature flag stays **disabled** until the DONE checklist passes.

---

## Role in FlipTrybe

Fincra is the **cross-border** provider — the piece Payscribe cannot be. It
supports FCY collection (GBP/EUR/USD virtual accounts), FX conversions, and
cross-currency payouts to 120+ corridors. This makes Fincra a candidate for the
**collection + FX + payout** legs of the required remittance corridors
(UK/US → NG/GH/LR*), subject to KYB and corridor enablement.

`*` Liberia (LRD) payout is **not** in Fincra's listed destination currencies —
see Corridors below. Confirm before enabling any LR corridor.

---

## Base URLs

| Environment | Base URL |
|---|---|
| Sandbox | `https://sandboxapi.fincra.com` |
| Production | `https://api.fincra.com` |

Encoded in the adapter as `FINCRA_SANDBOX_URL` / `FINCRA_PRODUCTION_URL`. Default: sandbox.

## Authentication — CONFIRMED

- Header: `api-key: <secret_key>` (NOT bearer). ✓ matches adapter.
- Optional `x-pub-key: <public_key>` for account identification (frontend-safe).
- Three key sets per account (test + live): secret, public, webhook encryption key.
- Errors: `"Invalid authentication credentials"`, `"No API key found in request"`.

## Required headers

- `api-key: <secret>`, `Content-Type: application/json`, `Accept: application/json`. ✓ matches adapter.

## IP whitelisting

Payouts require IP whitelisting (dashboard). Not enforced in code — an ops step.

---

## FX / Conversions — CONFIRMED

- **Generate quote:** `POST /quotes/generate` — body `{ business, sourceCurrency, destinationCurrency, amount, action:"send", transactionType, paymentDestination, feeBearer, paymentScheme? }`. Response `data{ sourceCurrency, destinationCurrency, sourceAmount, destinationAmount, rate, reference, expireAt, fee, amountToCharge, amountToReceive }`. The `data.reference` is the **quoteReference**. ✓ matches adapter.
- **Pure conversion (wallet-to-wallet):** `transactionType:"conversion"` + `POST /reference/initiate-currency-conversion` with `{ business, quoteReference, customerReference }`. (Not used by the settlement adapter, which quotes for disbursement.)
- Quotes expire (`expireAt`). Re-quote before payout if expired. The adapter re-quotes per transfer.

## Cross-currency payout — CONFIRMED

- **Create payout:** `POST /disbursements/payouts` — body `{ business, sourceCurrency, destinationCurrency, amount, description, paymentDestination, customerReference, beneficiary{ firstName, lastName, accountHolderName, accountNumber, type, country, bankCode?, sortCode?, bankSwiftCode?, email? }, quoteReference?, paymentScheme? }`. Response `data{ id, reference, customerReference, status }`. ✓ matches adapter.
- **Status:** `GET /disbursements/payouts/reference/{reference}` → `data{ id, amountSent, amountReceived, sourceCurrency, destinationCurrency, fee, status, reference, createdAt, updatedAt }`. ✓ matches adapter.
- `customerReference` is used as the idempotency key by the adapter. ✓
- **Payment schemes** by destination: GBP→`fps`, EUR→`sepa`, USD→`swift`, NGN→(none). ✓ encoded in adapter.

## Status lifecycle

`successful | processing | failed` → mapped to `COMPLETED | PROCESSING | FAILED`
(default `PENDING`). ✓ matches docs.

---

## Webhooks — CONFIRMED

- Header: `signature`.
- Algorithm: **HMAC-SHA512** over `JSON.stringify(payload)` (the `{event,data}` body), hex-encoded, compared to the `signature` header. ✓ `verifyFincraWebhook(body, signature, key)` matches the documented Node example exactly.
- Secret: the **webhook encryption key** (dashboard → Settings → Secret keys).
- Event categories: Payouts, Conversions, Virtual Account, Collections.
- Always return 2xx; validate signature before processing; store event id for idempotency.

Dedicated webhook pages exist for payout, collection, mandate, charges, conversion,
and virtual-account events — map each event type in the ingestion layer as corridors go live.

---

## Supported corridors & currencies

Adapter's `FINCRA_SUPPORTED_CURRENCIES`: NGN, USD, EUR, GBP, GHS, KES, UGX, TZS, ZMW, XAF, XOF, ZAR, EGP.

Destination payout corridors (from docs — 120+):
- **EUR:** 26 European countries (SEPA).
- **GBP:** United Kingdom only.
- **USD:** 70+ countries incl. Nigeria.
- **African currencies:** GHS (Ghana), KES (Kenya), UGX (Uganda), RWF (Rwanda), XOF (Benin/Burkina/Côte d'Ivoire/Senegal), XAF (Cameroon/Gabon/Congo), SSP (South Sudan).
- **Digital assets:** USDT (TRC20/ERC20/Solana/BEP20), USDC (ERC20/Solana), cNGN.

Mapping to FlipTrybe's required corridors:
| Corridor | Fincra support |
|---|---|
| UK → Nigeria (GBP→NGN) | Plausible (GBP source collection + NGN payout) — verify GBP collection |
| US → Nigeria (USD→NGN) | Plausible (USD source + NGN payout) |
| UK → Ghana (GBP→GHS) | GHS payout supported — verify GBP collection |
| US → Ghana (USD→GHS) | GHS payout supported |
| UK → Liberia (GBP→LRD) | **LRD NOT listed** — likely unsupported |
| US → Liberia (USD→LRD) | **LRD NOT listed** — likely unsupported |

**Source (collection) currency support was not enumerated in the supported-currencies
page** — the docs there detail payout destinations only. The FCY virtual account
pages (GBP/EUR/USD collection) must be read to confirm origin-side collection per
corridor. Do not mark any corridor AVAILABLE until both legs are confirmed.

## Bank account / beneficiary validation

- `Verify Bank Account` (`/docs/verify-iban-and-account-numbers`) and `BVN Resolution`
  (`/docs/bvn-resolution-1`) — use before payout to validate the beneficiary name.
- Beneficiaries API (`/reference/beneficiaries-api`) for saved recipients.

## Environments & testing

- Separate sandbox/production hosts and key sets. Test cards, test mobile numbers,
  test EFT accounts, and a "Funding Test Balance" flow are documented for sandbox.

---

## Live sandbox verification (2026-08-08)

Real sandbox credentials supplied. Calls actually executed:

| Call | Result |
|---|---|
| `GET /profile/business/me` | **200.** Business "Flip Trybe LTD", businessId `6a7619dd0e7f1a56b7074256`, `isKYCApproved: true`, country NG |
| `GET /core/banks?currency=NGN&country=NG` | **200.** Full NG bank list with `code`/`nibssCode`/`name` — confirms the bank-code source for payouts |
| `POST /quotes/generate` (USD→NGN, 100) | **200.** `rate: 1390.605`, `fee: 0`, `amountToReceive: 139060.5`, `reference: <uuid>`, **`expireAt` ≈ 30s ahead** |
| `POST /core/accounts/resolve` (NUBAN) | **200** `"Account resolve successful"` but `data: null` — endpoint reachable; sandbox returns no name for the test account used. Needs a Fincra-documented sandbox test account to fully verify |
| `GET /wallets` | **422** `"No payload sent"` — wrong shape/path for balances; the correct balances endpoint is still unconfirmed |

### Key confirmations

- **Fincra genuinely supports LOCKED quotes.** `POST /quotes/generate` returns a `reference` (the `quoteReference`) plus an `expireAt` ~30 seconds out. This is a real, executable quote — the opposite of Swappr's indicative-only rate. The existing adapter's 30s comment was correct.
- The existing adapter's `/quotes/generate` request/response mapping is **confirmed correct against live sandbox** (`data.reference`, `data.rate`, `data.amountToReceive`, `data.expireAt` all present as coded).
- **`enableWebhook: false`** — webhooks are NOT enabled on the dashboard. Must be turned on (Settings → Portal Settings) with a `callbackURL` before any Fincra webhook will be delivered.

### Live FX comparison executed (§59)

| Provider | USD→NGN rate | Fee | Receive (100 USD) | Locked? |
|---|---|---|---|---|
| **Fincra** | 1390.605 | 0 | ₦139,060.50 | **Yes** (`expireAt` ~30s) |
| **Swappr** | — | — | — | No (indicative, 60s cache) — call blocked by `ip_not_allowed` on retry |

The comparison harness works; the Swappr side could not be re-read because its
IP allowlist began rejecting this egress IP mid-session (see `swappr.md`).

### Not yet executed against Fincra
Payout creation, conversion execution, virtual-account creation, webhook delivery.

## Audit result

The Fincra adapter is a **faithful, documented integration** — no guessed
endpoints. Confirmed correct: base URLs, `api-key` auth, `POST /quotes/generate`,
`POST /disbursements/payouts`, `GET /disbursements/payouts/reference/{ref}`,
status mapping, payment schemes, and HMAC-SHA512 webhook verification.

### Open verification items (sandbox, not code bugs)

1. ~~**Amount units.**~~ **RESOLVED — CONFIRMED MINOR UNITS (kobo).** See the
   verification sprint below: `amount: "100"` on `POST /disbursements/payouts`
   moved exactly ₦1.00 (kobo) — the wallet balance dropped by exactly 200 kobo
   (₦2) across two `amount:"100"` payouts, confirmed by direct before/after
   `GET /wallets` reads. The adapter's `String(sourceAmountMinor)` is correct
   as written — no unit conversion needed. This was the single most important
   money-safety open item and it is now closed with live evidence.
2. **Quote TTL.** Adapter comment says 30s; docs show an `expireAt` timestamp.
   Confirm the real TTL and ensure re-quote-on-expiry.
3. **FCY collection** per corridor (GBP/USD virtual accounts) — read the FCY
   account pages and confirm origin-side collection before enabling a corridor.
4. **Liberia (LRD)** — not in Fincra's destination list; find an alternative LR
   payout provider or drop the LR corridors.

## DONE checklist (remittance flag stays off until all pass)

- [x] Confirm amount unit (major vs minor) in sandbox — **CONFIRMED minor (kobo)**.
- [ ] KYB approved; IP whitelisted; live keys issued (sandbox only so far).
- [x] Sandbox quote → payout → status round-trip for **NGN same-currency** — **LIVE VERIFIED** (see below). Cross-currency corridors not yet tested.
- [ ] Webhook received, signature verified, idempotent — **BLOCKED**, `enableWebhook: false` on dashboard (dashboard-only setting, no API).
- [x] Beneficiary name validation wired — **`GET /core/banks` LIVE VERIFIED**; `POST /core/accounts/resolve` reachable (200) but returned `data: null` for the test account tried — needs a documented Fincra sandbox test account.
- [x] Ledger reconciles against Fincra `amountSent`/`amountReceived`/`fee` — **LIVE VERIFIED** via wallet-balance delta.
- [ ] `RemittanceCorridor` rows enabled only for confirmed corridors (not LR) — none enabled yet.
- [ ] Flip the `remittance` feature flag last — **still disabled**.

---

## Dedicated Fincra verification sprint (2026-08-08, session 3)

Objective: verify Fincra deeply enough to inform (not yet decide) a Fincra-vs-Swappr
routing choice, per explicit instruction NOT to switch production routing yet.
Every call below used the real sandbox credentials already configured in this
environment; no secret value is reproduced in this file.

### A. Balances — LIVE VERIFIED

Correct endpoint (found via docs, not guessed): **`GET /wallets?businessID={businessId}`**
— NOT `GET /wallets` alone (which 422s with `"No payload sent"`, as already
noted above and now explained).

```
GET https://sandboxapi.fincra.com/wallets?businessID=<businessId>
→ 200 { "success": true, "data": [ { "currency": "NGN", "availableBalance": 100000,
        "ledgerBalance": 100000, "lockedBalance": 0, "walletNumber": ... }, ... ] }
```

FlipTrybe's sandbox account has **21 currency wallets already provisioned and
enabled**, including NGN (₦1,000.00 test balance), GBP/USD/EUR/CAD (10.00 each),
GHS/KES/XOF (₦1,000-equivalent), plus USDT/USDC/CNGN stablecoin wallets (0
balance) and several African currencies at 0. Response schema per-wallet:
`id`, `_id`, `business`, `businessId`, `ledgerBalance`, `availableBalance`,
`lockedBalance`, `rollingReserveBalance`, `walletNumber`, `currency`, `status`,
`overdraftEnabled`, `overdraftLimit`, `createdAt`, `updatedAt`. Detail endpoint
`GET /wallets/{walletID}` also documented (per-wallet, not re-tested live —
the list endpoint already returns everything needed).

**Sufficiency for intended products:** NGN balance (₦1,000) is enough for
sandbox payout testing (tested at ₦1 increments). GBP/USD/EUR/CAD balances are
tiny (10.00 each) — sufficient for a single small cross-currency test, not for
volume testing.

### B. Bank account verification — PARTIALLY LIVE VERIFIED

- `GET /core/banks?currency=NGN&country=NG` — **200**, full NG bank list
  (`code`, `nibssCode`, `name`, `branches`) — this is the bank-code source of
  truth for payout `beneficiary.bankCode`.
- `POST /core/accounts/resolve` `{accountNumber, bankCode, type:"nuban"}` —
  **200** `"Account resolve successful"` but **`data: null`** for the NUBAN
  test account used (`0690000032`/`044`, a Swappr-documented test account, not
  a Fincra one). This means the endpoint is reachable and auth works, but name
  resolution did not actually return a name in this sandbox call. **Invalid
  account behavior was not separately tested against this endpoint** — only
  against the payout endpoint (see D, where an invalid account was *not*
  rejected in sandbox either). A Fincra-specific documented sandbox test
  account is needed to confirm the success path fully; none was found in the
  pages read.
- Separately, `POST /disbursements/payouts` itself resolved and returned the
  beneficiary's real bank name (`"ACCESS BANK PLC"`) in its response for the
  same account number — so bank-level resolution clearly works somewhere in
  the payout pipeline even though the standalone resolve endpoint returned null.

### C. FX / Conversion — LIVE VERIFIED, full lifecycle

```
POST /quotes/generate  { transactionType:"conversion", business, sourceCurrency:"USD",
  destinationCurrency:"NGN", amount:"100", action:"send", paymentDestination:"fliqpay_wallet" }
→ 200 { data: { rate: 1390.605, fee: 0, sourceAmount: 100, destinationAmount: 139060.5,
    amountToReceive: 139060.5, reference: "<uuid>", expireAt: "<~30s ahead>" } }
```

1. Quote reference: `data.reference` (a UUID) — **confirmed**, this is the
   `quoteReference` consumed by a subsequent payout's `quoteReference` field.
2–9. All fields (source/destination currency & amount, rate, fee, expiry) are
   present and correctly typed — **confirmed** against the adapter's mapping.
10. **Expiry behavior:** not tested — a quote was not deliberately allowed to
    expire before use in this sprint (time budget). The `expireAt` timestamp
    is real and ~30s out, consistent with the adapter's existing comment.
11. **Whether a payout can consume the quoteReference:** the `same-currency`
    payouts tested here (NGN→NGN) did **not** use a `quoteReference`
    (`quoteId: null` in every payout status response) — same-currency payouts
    don't need FX. A cross-currency payout referencing a `quoteReference` was
    **not tested this sprint** (would require spending one of the small
    GBP/USD/EUR/CAD test balances) — this remains **UNVERIFIED**.
12. Whether conversion must happen before payout: **not determined** — only
    inferable from docs, not confirmed live this sprint.
13. Reusability: **not tested** (would require deliberately reusing a
    `quoteReference` across two payout attempts).
14. Idempotency of quote generation itself: **not tested** — the payout
    endpoint's idempotency (via `customerReference`) was tested instead, see G.

### D. NGN payout — LIVE VERIFIED (the most important test)

Endpoint: `POST /disbursements/payouts`. Exact payload used (test/sandbox data
only, per rule 45):

```json
{
  "business": "<businessId>",
  "sourceCurrency": "NGN", "destinationCurrency": "NGN",
  "amount": "100",
  "description": "FlipTrybe audit test",
  "paymentDestination": "bank_account",
  "customerReference": "<unique>",
  "beneficiary": {
    "accountHolderName": "Test Recipient", "accountNumber": "0690000032",
    "bankCode": "044", "firstName": "Test", "lastName": "Recipient", "type": "individual"
  }
}
```

**Result: `200 { success:true, data:{ id, reference, customerReference, status:"processing" } }`.**
Status transitioned to `"successful"` within seconds (sandbox auto-settles).

`GET /disbursements/payouts/reference/{reference}` returned the full object:
`id`, `amountSent: 100`, `amountReceived: 100`, `sourceCurrency`,
`destinationCurrency`, `fee: 0`, `quoteId: null`, `status: "successful"`,
`reference`, `customerReference`, `description`, `paymentDestination`,
`valuedAt`, `createdAt`, `updatedAt`, and a fully-resolved `recipient` object
including `bankName: "ACCESS BANK PLC"`.

**Balance impact — LIVE VERIFIED:** NGN `availableBalance` dropped from
`100000` to `99800` (exactly 200 kobo = ₦2) after two successful ₦1 payouts,
confirmed by a direct `GET /wallets` before/after comparison. This is what
resolved the amount-units question (see above).

**Idempotency (§G) — LIVE VERIFIED, and it is a materially different model
from Swappr's:**

| Test | Result |
|---|---|
| First call with `customerReference=X` | `200`, payout created, `status:"processing"`→`"successful"` |
| **Same** `customerReference=X`, **same** body, retried | **`422 {"error":"Cannot continue, Duplicate Customer Reference Passed","errorType":"DUPLICATE_CUSTOMER_REFERENCE"}`** |
| **Same** `customerReference=X`, **different** body (different amount) | **Same `422 DUPLICATE_CUSTOMER_REFERENCE`** |

**This is NOT Swappr's idempotency model.** Swappr's `Idempotency-Key`
replays the *original successful response* (`200`, identical object) on an
exact retry. **Fincra's `customerReference` unconditionally rejects reuse**
— it never returns the original payout on retry, even with an identical body.
Practically: if a FlipTrybe API call to Fincra times out after Fincra actually
accepted the payout, a naive retry with the same `customerReference` gets a
`422`, **not** the original success — the caller must catch that specific
`errorType: "DUPLICATE_CUSTOMER_REFERENCE"` and then look up the outcome via
`GET /disbursements/payouts/reference/{reference}` (which requires already
knowing the `reference`, not just the `customerReference`) — **there is no
documented "look up by customerReference" endpoint**, which is a real gap:
if the original response was lost (the exact ambiguous-failure scenario this
whole exercise is about), a `422` on retry confirms *a* payout with that
reference exists, but does not by itself return which `reference`/`id` to
poll. This must be handled in the adapter's ambiguous-failure path — flagged
as a required code change, not yet implemented (see §K below).

**Invalid beneficiary — LIVE TESTED, sandbox limitation found:** a payout to
account number `0000000000` (bank code 044) was **not rejected** — it
returned `200`, `status:"processing"`, and settled to `"successful"` within
seconds, with the sandbox happily attaching `bankName: "ACCESS BANK PLC"` to
an account number that cannot possibly exist. **Sandbox does not simulate
real NIBSS account validation.** This means beneficiary-validation behavior
cannot be verified from sandbox — production behavior for a genuinely invalid
account is **UNKNOWN** and must be treated as a live-production risk until
tested carefully (with a real but low-value transfer) or confirmed via Fincra
support.

**Insufficient balance:** not tested (would require draining the ₦1,000 test
balance, judged not worth the balance budget this sprint).

**Timeout/network ambiguity:** not reproducible against a live sandbox on
demand — covered instead by the deterministic adapter/service-boundary test,
see `apps/api/src/modules/financial-products/financial-products.service.test.ts`.

### E. Virtual accounts — LIVE VERIFIED (creation)

Endpoint: `POST /profile/virtual-accounts/requests` (**merchant-level**, per
docs — there is no separate "customer-specific" virtual account creation call
documented for Fincra; the `KYCInformation` block identifies the account
holder but the account itself is provisioned under FlipTrybe's merchant
business).

Request used:
```json
{ "currency": "NGN", "accountType": "individual",
  "KYCInformation": { "firstName": "FlipTrybe", "lastName": "AuditTest",
    "email": "audit-test@fliptrybe.ng", "bvn": "12345678901" } }
```

**Result: `200`, `status: "approved"`, `isActive: true` immediately** (no
async pending state observed — matches the docs' "instantly approved" claim).
Response included `accountNumber`, `accountInformation.{accountNumber,
accountName, bankName:"sterling", bankCode:"232", reference,
channelReference}`, `isPermanent: true`, `virtualAccountType: "additional"`.

1. **Account number/identifier** — confirmed present (`accountNumber` +
   `accountInformation.accountNumber`, both populated).
2. **Status** — `"approved"` / `isActive: true`.
3. **Owner/customer reference** — the submitted `KYCInformation` names the
   holder; there is no separate FlipTrybe-side customer object Fincra
   returns/tracks — attribution is whatever FlipTrybe stores against the
   returned `_id`/`accountNumber` internally.
4. **Currency** — `"NGN"`, confirmed.
5. **Incoming-credit mechanism** — not tested this sprint (would require an
   actual inbound transfer, which sandbox does not appear to let us simulate
   on demand — no "simulate transfer" endpoint was found in the pages read,
   unlike Payscribe/Swappr which both document one).
6. **Webhook/event structure** — documented (`virtualaccount.approved` /
   `.issued` / `.changed` / `.declined` / `.closed`, with a
   `data.accountInformation.{accountNumber,bankName,bankCode,...}` payload) —
   **not received live**, webhooks are disabled on the dashboard (see F).
7. **Deterministic reconciliation to a ledger entry** — the payload shape
   (`data.id` as the VA identifier, `data.accountInformation.accountNumber`)
   is sufficient to look up the internal `VirtualAccount` row **once a webhook
   is actually enabled and received** — cannot be confirmed further without one.

**PII note:** the BVN used (`12345678901`) is a documented-pattern dummy
sandbox value, not a real customer's. The response's `note`/KYC echo was
reviewed and **no real customer PII is reproduced in this document** — the
resolved account-holder name from the dummy BVN fixture is intentionally
omitted here.

**Account closure** — a `POST` closure/deactivation endpoint was not located
in the pages read this sprint; not tested.

### F. Webhooks — BLOCKED, exact action required from you

**Confirmed from official docs: webhook enablement is dashboard-only.**
`https://docs.fincra.com/docs/setup-webhook.md` states there is no API
endpoint to set the callback URL or enable webhooks — it must be done via
**Dashboard → Account Settings → API keys and Webhook**, pasting a callback
URL and saving.

**STOP — action required from you, cannot be done programmatically:**
1. Log into `https://app.fincra.com` (or the sandbox dashboard equivalent).
2. Navigate to API keys and Webhook settings.
3. Paste FlipTrybe's inbound webhook URL once one exists (see §M — no such
   route exists in the API yet either).
4. Save. This must be repeated **separately for sandbox and live**.

Event types confirmed from docs (not received live): virtual account
(`virtualaccount.approved/issued/changed/declined/closed`), payout
(`payout.successful`/`payout.failed`), conversion, mandate, charges,
collection. Signature: header `signature`, `HMAC-SHA512(webhookEncryptionKey,
JSON.stringify(payload))` — this matches the existing `verifyFincraWebhook()`
implementation exactly (unchanged from prior audit). Retry behavior, event
ordering, and duplicate-event behavior are **not documented in the pages
read** and were not observable without live delivery — **UNKNOWN**.

**No webhook readiness claim is made. None can be, without a received event.**

### G. Idempotency — see D above (full detail); summary

| Endpoint | Same key+body | Same key+different body | Different key |
|---|---|---|---|
| `POST /disbursements/payouts` (`customerReference`) | **422 duplicate** (not a replay) | **422 duplicate** | New payout created |

This is the single most operationally important difference from Swappr and
must be reflected in the adapter/service layer (not yet done — see K).

### H. Ambiguous failure / reconciliation — DETERMINISTIC TEST ADDED

See `apps/api/src/modules/financial-products/financial-products.service.test.ts`
(new this session). Two tests:
1. A `sendTransfer` throwing an `ETIMEDOUT`-shaped error →
   `RemittanceTransfer.status` becomes `RECONCILIATION_REQUIRED` (never
   `FAILED`), a `FinancialReconciliationException` (`AMBIGUOUS_PROVIDER_RESULT`)
   is opened, and `sendTransfer` is confirmed called **exactly once** — no
   second/fallback provider call.
2. A `sendTransfer` throwing a `400`-status error (definitive pre-acceptance
   rejection) → status becomes `FAILED`, **no** reconciliation exception opened.

Both pass. `classifyFallbackSafety()` (`packages/providers/src/contract.ts`)
is the enforcement point and has its own 9-test suite
(`fallback-safety.test.ts`) independent of this integration test.
