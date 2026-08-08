# Swappr — Provider Integration Audit

Status: **NGN PAYOUT PATH LIVE-VERIFIED IN SANDBOX. Still NOT production-ready**
(GBP/USD/EUR/CAD unmapped, no real webhook delivery tested, customer/KYC/VIBAN
flow unbuilt). Full documentation-to-code mapping completed 2026-08-08 against
`docs.swappr.me`. The `remittance` / `virtualAccounts` feature flags remain
**disabled** pending the full DONE checklist (§10).

## Sandbox calls actually executed (2026-08-08, real credentials)

| # | Call | Result |
|---|---|---|
| 1 | `GET /v1/wallets` | 200 — confirmed NGN wallet `cmsh4chiw0006j0g5vmmvdjgq`, admin-provisioned VA `2359114409` (Swappr Demo Bank), balance ₦50,000.00 |
| 2 | `GET /v1/rates?from=NGN&to=USD` | 200 — `{"from_currency":"NGN","to_currency":"USD","rate":"0.000696"}` — confirms `getQuote()`'s parsing shape exactly |
| 3 | `GET /v1/beneficiaries` | 200 — empty list (none created yet) |
| 4 | `GET /v1/payouts` (list) | 200 — empty list (before any payout) |
| 5 | `POST /v1/name-enquiry` on doc-example account `0690000032`/`044` | 200 — `resolved_name: "SHERIFAT BOLANLE IYANDA"` — confirms this is a real, resolvable sandbox test account |
| 6 | `POST /v1/payouts` — ₦1 to that account, real `Idempotency-Key` | **201 — `status: "paid"` immediately.** `payout.create` capability IS enabled. Confirms the exact request body shape (`amount_minor`, `currency`, `recipient{account_number,bank_code}`, `merchant_reference`) and response shape (`id`, `reference`, `status`) coded in the adapter |
| 7 | Repeat #6 with a **fixed** idempotency key, same body | **200 — identical cached object returned** (same `id`/`reference`), not a new payout |
| 8 | Repeat #6 with the **same fixed key, different body** (`amount_minor:"999"`) | **409** `idempotency_key_conflict` — exactly as documented |
| 9 | `GET /v1/payouts/{id}` for the payout from #6 | 200 — full object incl. `recipient{name,account_number,bank_code,bank_name}`, `provider{slug:"squad"}`, `nip_reference`, `timeline{...}` |
| 10 | `GET /v1/wallets` again | Balance dropped **exactly ₦2.00** (5,000,000 → 4,999,800 minor units) across the two payouts that actually succeeded — confirms no double-debit from the idempotent replay |

### ⚠️ IP ALLOWLIST NOW BLOCKING (discovered 2026-08-08, later in the same session)

A follow-up `GET /v1/rates` call returned:

```
403 {"error":{"type":"permission_error","code":"ip_not_allowed",
     "message":"Request IP (102.89.46.241) is not on this API key's allowlist."}}
```

The calls in the table above succeeded earlier from a different egress IP.
This confirms the documented IP allowlist **is actively enforced**, and that
this environment's egress IP is dynamic. Two consequences:

1. **Operational:** add the current egress IP to the key's allowlist (dashboard
   → API & Webhooks → key row → Restrict IPs) before further sandbox testing.
2. **Production:** the docs' warning ("production traffic should originate from
   a fixed egress IP") is not optional — API/worker traffic must go through a
   static-egress proxy or every deploy risks a `403 ip_not_allowed` outage.

This is exactly the class of failure that must NOT trigger provider fallback:
a `403` is a definitive pre-acceptance rejection, so
`classifyFallbackSafety` correctly returns `SAFE_TO_RETRY` for it — but only
because nothing was created. See `packages/providers/src/fallback-safety.test.ts`.

**This is a genuine, verified, working payout path for NGN — not just "compiles."** The adapter's NGN `sendTransfer`/`getTransferStatus` request and response mapping is now empirically confirmed correct against live Swappr sandbox behavior, including idempotency safety at the ledger level.

Not yet tested live: GBP/USD/EUR/CAD payouts (unmapped in code), `POST /v1/customers` + KYC flow, `POST /v1/customers/{id}/virtual_accounts`, `POST /v1/webhook_endpoints` + a real webhook delivery, `POST /v1/conversions`.

---

## 1. Capability matrix

| # | Capability | Endpoint(s) | Classification | Notes |
|---|---|---|---|---|
| 1 | Authentication | `Authorization: Bearer sk_...` | **AVAILABLE_NOW** | Confirmed live — sandbox call succeeded |
| 2 | Idempotency | `Idempotency-Key` header | **AVAILABLE_NOW** | Documented, not yet exercised live |
| 3 | Wallets (list/get) | `GET /v1/wallets`, `/v1/wallets/{id}` | **AVAILABLE_NOW** | Confirmed live |
| 4 | Wallet balance | `GET /v1/wallets/{id}/balance`, `GET /v1/balances` | **AVAILABLE_NOW** | Documented |
| 5 | Wallet ledger/history | `GET /v1/wallets/{id}/transactions` | **AVAILABLE_NOW** | Documented |
| 5b | Funding events | `GET /v1/wallets/{id}/funding-events` | **AVAILABLE_NOW** | Documented |
| 6 | NGN virtual accounts (merchant) | `GET /v1/virtual_accounts[/{id}]` | **ADMIN_PROVISIONED** | Read-only; no merchant create/close endpoint. Confirmed live — our sandbox VA already exists, provisioned by Technest |
| 7 | International GBP/USD/EUR accounts — **merchant/treasury** | n/a (auto-provisioned) | **ADMIN_PROVISIONED** | "No per-customer issuing call; provisioned for your merchant" |
| 7b | International GBP/USD/EUR accounts — **customer VIBAN** | `POST /v1/customers/{id}/virtual_accounts` | **AVAILABLE_AFTER_COMPLIANCE** | **CORRECTION to earlier draft** — this IS a real create endpoint, but requires customer `status:verified` first (KYC gate). Idempotent per (customer, currency). Sandbox: only NGN settles; GBP/USD/EUR VIBANs provision but `account_number` stays empty in sandbox |
| 8 | Customer VIBANs (see 7b) | — | **AVAILABLE_AFTER_COMPLIANCE** | Same as above |
| 9 | Customer onboarding | `POST /v1/customers` (individual), Technest-managed (business) | **AVAILABLE_AFTER_COMPLIANCE** | Individual: self-serve, `id_expiry_date` required, immutable identity fields. Business: NOT self-serve — Technest KYB, 1–5 business days |
| 10 | KYC | `POST /v1/customers/{id}/files`, `PUT <upload_url>`, `POST /v1/customers/{id}/files/attach`, `POST /v1/customers/{id}/kyc` | **AVAILABLE_AFTER_COMPLIANCE** | Individual auto-verification, minutes–2hrs. Required before payout/VA issuance |
| 11 | Beneficiaries | `POST/GET/PATCH/DELETE /v1/beneficiaries[/{id}]` | **AVAILABLE_NOW** (mechanically) | Idempotent create on (merchant, currency, env, bank_code, account_number). Currency-specific validation shapes documented |
| 12 | Name enquiry (NUBAN) | `POST /v1/name-enquiry` | **AVAILABLE_NOW** | NGN only |
| 13 | NGN payouts | `POST /v1/payouts` (currency:NGN) | **AVAILABLE_AFTER_COMPLIANCE** | Mechanically documented & code-mapped; gated on `payout.create` capability + KYC'd sender customer for individual flow |
| 14 | GBP payouts | `POST /v1/payouts` (currency:GBP) | **AVAILABLE_AFTER_COMPLIANCE** | Requires `payout.create`+`payout.fx`; inline recipient "soft-deprecated" in favor of `beneficiary_id` |
| 15 | USD payouts | `POST /v1/payouts` (currency:USD) | **AVAILABLE_AFTER_COMPLIANCE** | `method: ach\|wire`; `swift_code` required for wire |
| 16 | EUR payouts | `POST /v1/payouts` (currency:EUR) | **AVAILABLE_AFTER_COMPLIANCE** | IBAN/BIC based |
| 17 | CAD/Interac payouts | `POST /v1/payouts` (currency:CAD) | **AVAILABLE_AFTER_COMPLIANCE** | Two rails: Interac (email+name only) or EFT (institution/transit/account number) |
| 18 | Payout status/requery | `GET /v1/payouts/{id}`, `POST /v1/payouts/{id}/requery` | **AVAILABLE_NOW** (mechanically) | requery forces a provider refresh for stuck `processing` |
| 19 | Payout cancellation | `POST /v1/payouts/{id}/cancel` | **AVAILABLE_NOW** (mechanically) | Only `draft`/`queued` states cancellable |
| 20 | FX/conversion (wallet↔wallet) | `POST /v1/conversions/quote` (preview), `POST /v1/conversions` (execute) | **AVAILABLE_AFTER_COMPLIANCE** | Requires "conversion capability enabled in dashboard". **No lockable quote** — preview is `indicative:true`; execution uses the rate active at execution time; fails with `fx_rate_stale` if none active |
| 21 | Remittance flow (end-to-end) | Customer create → KYC → VA/payout | **AVAILABLE_AFTER_COMPLIANCE** | Composite of items 9, 10, 13–19 |
| 22 | Webhooks (receiving) | Configured via webhook endpoints (23) | **AVAILABLE_AFTER_COMPLIANCE** | Requires endpoint registration first |
| 23 | Webhook endpoint management | `POST/GET/PATCH/DELETE /v1/webhook_endpoints[/{id}]`, `POST …/test` | **AVAILABLE_NOW** (mechanically) | Secret returned **once** at creation; rotate via dashboard (60-min dual-secret cutover window) |
| 24 | Errors | Standard error body + `409 idempotency_key_conflict`, `403 ip_not_allowed`, `400 fx_rate_stale` | **AVAILABLE_NOW** | Documented, not yet exercised |
| 25 | Rate limits | Not explicitly quantified in fetched pages | **UNKNOWN** | Not found in the pages fetched — flag for follow-up |
| 26 | Reports | Not covered by fetched pages | **UNKNOWN** | No dedicated reports endpoint surfaced — likely covered by wallet ledger/transactions (item 5) |

### Virtual account distinction (as requested)

| Type | Creatable via API? | Classification |
|---|---|---|
| **A. Merchant-level funding VA (NGN)** | No — admin/Technest-provisioned only | **ADMIN_PROVISIONED** |
| **B. Customer-specific VA** | Swappr does not separately document a "customer NGN VA" distinct from the international VIBAN flow — NGN collection appears to be merchant-pool only per the "Receiving Money" page | **ADMIN_PROVISIONED** (NGN) |
| **C. Customer-specific international VIBAN (GBP/USD/EUR)** | **Yes** — `POST /v1/customers/{id}/virtual_accounts`, gated on customer `verified` status | **AVAILABLE_AFTER_COMPLIANCE** |

This corrects an error in my first implementation pass, which treated *all*
virtual-account creation as unsupported. Only the merchant-level NGN VA is
admin-provisioned; **customer-level international VIBANs are a real,
documented, API-creatable capability**, gated behind KYC.

---

## 2. Existing guessed adapter vs. official API — comparison

| Aspect | Guessed (original) | Official (confirmed) |
|---|---|---|
| Base URL | `https://api.swappr.ng` | `https://api.swappr.me/api/v1` |
| Auth | `Authorization: Bearer <apiKey>` | Same — **correct by coincidence** |
| VA create | `POST /v1/virtual-accounts` | **Does not exist** for merchant NGN VAs; customer international VIBANs use `POST /v1/customers/{id}/virtual_accounts` (different path, different prerequisite) |
| VA get | `GET /v1/virtual-accounts/{id}` | `GET /v1/virtual_accounts/{id}` (underscore, not hyphen) — **wrong path** |
| VA close | `DELETE /v1/virtual-accounts/{id}` | **Does not exist** — no merchant close endpoint |
| Remittance quote | `POST /v1/remittance/quotes` → `quoteId` | **Does not exist.** Real: `GET /v1/rates` (indicative, no lock) or `POST /v1/conversions/quote` (also indicative, wallet-to-wallet only) |
| Remittance send | `POST /v1/remittance/transfers` with `quote_id` | **Does not exist.** Real: `POST /v1/payouts` with `amount_minor` + `currency` + `recipient`/`beneficiary_id` — no quote reference at all |
| Remittance status | `GET /v1/remittance/transfers/{ref}` | Real: `GET /v1/payouts/{id}` |
| Webhook verification | Not implemented | Real: `X-Swappr-Signature: t=<unix>,v1=<hex>` over `${t}.${rawBody}`, HMAC-SHA256 |
| Idempotency | Not implemented | Real: `Idempotency-Key` header, required on creates, permanent (no expiry), `409` on conflict |

**Conclusion:** every endpoint path and the entire remittance-quote model in the
original guess was fabricated. My first documented rewrite (before this deeper
audit) fixed the payout/VA paths and the quote-lock issue at a high level but
mis-scoped virtual-account support as fully unsupported — corrected above.

## 3. Incorrect assumptions found (cumulative, including my own first pass)

1. Base URL had no `/api/v1` suffix and wrong TLD (`.ng` vs `.me`).
2. VA create/close endpoints invented; real API has neither for merchant NGN VAs.
3. **My first rewrite incorrectly told customer VIBAN creation didn't exist.** It does (`POST /v1/customers/{id}/virtual_accounts`), gated on KYC.
4. Remittance modeled as `quote → quoteId → transfer(quoteId)`; real model is `rate lookup (indicative) → payout(amount, recipient)` with no server-side quote object for payouts. Wallet-to-wallet conversion (a separate, unrelated feature) does have `POST /v1/conversions` but still no lock — "indicative":true, rate applied at execution.
5. `sendTransfer()` was assumed to carry a rate-lock guarantee it cannot provide, and the `RemittanceProvider` interface has no `amount` field for `sendTransfer`, which Swappr's payout API requires — a genuine interface gap (see §4).
6. No idempotency key was sent on VA/payout creation in the original guess.
7. No webhook signature verification existed in the original guess.
8. Assumed FlipTrybe would send payouts as a "business" sender; docs say remittance integrators (which FlipTrybe is) use the **individual** flow — each end-user becomes a Swappr `individual` customer, with `sender_customer_id` on every payout.

## 4. Required code changes

**Done (this pass — 2026-08-08b):**
- `RemittanceProvider`/`VirtualAccountProvider` contracts extended with explicit
  `remittanceCapabilities`/`virtualAccountCapabilities` and a first-class
  `amountMinor`/`sourceCurrency`/`destinationCurrency`/`idempotencyKey` on
  `sendTransfer()` (see `packages/providers/src/financial-products.ts`). Applied
  to Swappr, Yativo, and the mock adapter.
- **Fixed a real base-URL bug**: `callSwapprApi` defaulted to
  `https://api.swappr.me/api/v1` while every path already started with
  `/v1/...`, silently doubling to `.../api/v1/v1/...`. Caught by a unit test
  assertion, not by TypeScript. Fixed to `https://api.swappr.me/api`.
- `createSwapprRemittanceProvider.sendTransfer()` now actually executes a real
  NGN payout (previously threw `UNSUPPORTED`) — **live-verified**, see the
  sandbox log above.
- `remittanceCapabilities.supportsLockedQuotes: false` declared honestly;
  every `RemittanceQuote` this adapter returns carries `isLocked: false`.
- Idempotency key threaded end-to-end: DTO → service → adapter → `Idempotency-Key` header — **live-verified** (200 replay / 409 conflict, both confirmed).
- `virtualAccountCapabilities` added to Swappr/Payscribe/mock VA adapters distinguishing merchant-provisioned vs customer-creatable.

**Still required (not yet implemented):**

1. **Customer-VIBAN creation** (`POST /v1/customers/{id}/virtual_accounts`) — capability is now honestly declared (`supportsCustomerVirtualAccounts: true`), but `createAccount()` still throws because customer onboarding/KYC doesn't exist yet. Building this requires item 5 below first.
2. **Preserve the executed rate for cross-currency payouts.** Only mapped for NGN (single-currency, no rate) so far — `executedRate`/`executedDestinationAmountMinor` are wired in the interface and DB but Swappr's NGN payout response has no rate field to populate them with (expected — no FX involved). GBP/USD/EUR/CAD payout response shapes have not been inspected live for a rate field.
3. **Customer onboarding + KYC** — `POST /v1/customers`, file upload flow, `POST /v1/customers/{id}/kyc`. Not yet built.
4. **Currency-specific recipient builders** for GBP/USD/EUR/CAD (only NGN is mapped and **live-verified**) — `sort_code`; `routing_number`+`account_type`+`method`; `iban`+`bic_code`; Interac `email`+`name` or EFT `institution_number`+`transit_number`.
5. **`sender_customer_id`** on every payout call once customer onboarding exists (individual-flow requirement per docs).
6. **Beneficiaries adapter** — mechanically documented, confirmed reachable live (`GET /v1/beneficiaries` → 200), not yet implemented as create/list/delete methods.
7. **Webhook endpoint registration** (`POST /v1/webhook_endpoints`) — not yet done; no webhook has actually been delivered or tested against `verifySwapprWebhook`.
8. **Name-enquiry adapter method** — confirmed live and working (`POST /v1/name-enquiry`), not yet wrapped as a reusable adapter method.

## 5. Required database changes

**Done:** `RemittanceTransfer` gained `quotedRate`, `isLockedQuote`, `executedRate`,
`executedDestinationAmountMinor`, `executedFeeMinor` (migration applied via
`prisma generate`; schema validated). `isLockedQuote` is derived from the
provider's `remittanceCapabilities.supportsLockedQuotes` at send time, never
inferred from the quote alone.

**Still required:**
- `ProviderCustomer` row per FlipTrybe end-user once individual-flow onboarding is built, storing `swappr_customer_id` and KYC status.
- Consider a `ProviderCapabilityOverride`-style row so the DB-driven router can see the same capability distinctions the TypeScript interface now models (currently the capability flags live only in code, not in `ProviderConfig`).

## 6. Required environment variables

```
SWAPPR_API_KEY=sk_test_...        # SUPPLIED (sandbox) — live-verified working
SWAPPR_PUBLISHABLE_KEY=pk_test_... # SUPPLIED (sandbox) — frontend-safe, not yet used anywhere
SWAPPR_BASE_URL=                   # optional override; defaults to https://api.swappr.me/api (fixed from the earlier .../api/v1 bug)
SWAPPR_WEBHOOK_SECRET=             # returned ONCE when a webhook endpoint is created — not yet created
```

## 7. Required webhook configuration

1. `POST /v1/webhook_endpoints` with `url` pointing at `/api/webhooks/financial/swappr` and `events: ["wallet_funded","payout_paid","payout_failed","payout_reversed","kyc_status_changed","wallet_auto_converted", ...batch events]`.
2. Capture the one-time `secret` into `SWAPPR_WEBHOOK_SECRET` (a real secrets store, not `.env` in git).
3. Use `POST /v1/webhook_endpoints/{id}/test` to fire a synthetic `payout_paid` event and confirm `verifySwapprWebhook` accepts it end-to-end before relying on it.
4. Not yet done — no endpoint has been registered.

## 8. Required compliance/activation steps

1. ~~Confirm `payout.create` capability enabled~~ — **CONFIRMED live**: a real NGN payout succeeded (201, `status:"paid"`).
2. Confirm "conversion capability" is enabled if wallet-to-wallet conversion is needed — not tested.
3. Decide sender model: **individual flow** (each end-user = Swappr customer, per the docs' explicit guidance for remittance integrators like FlipTrybe) vs treasury/business flow. Individual flow is what the docs recommend — adopt it. Not yet built.
4. Build the individual-customer onboarding + KYC flow (create customer → upload ID → `POST /kyc` → wait for `verified`) before any customer VIBAN or KYC-gated payout can be tested.
5. ~~IP allowlist~~ — **CONFIRMED not blocking**: all sandbox calls above succeeded from the current dev environment without a `403 ip_not_allowed`. Still confirm/tighten before production cutover.

## 9. Sandbox test plan — progress

1. ✅ `GET /v1/wallets` — auth works, NGN wallet + VA confirmed.
2. ⬜ `POST /v1/customers` — not yet executed (would create persistent test data; deferred pending onboarding-flow build).
3. ⬜ KYC file-upload flow — not yet executed (depends on 2).
4. ⬜ `POST /v1/customers/{id}/virtual_accounts` — not yet executed (depends on 2–3).
5. ✅ `GET /v1/rates?from=NGN&to=USD` — confirmed indicative rate shape, matches `getQuote()` exactly.
6. ✅ `POST /v1/name-enquiry` on `0690000032`/`044` — confirmed, resolved a real name.
7. ⬜ `POST /v1/beneficiaries` create — not yet executed (list confirmed reachable, empty).
8. ✅ `POST /v1/payouts` (NGN, ₦1, real `Idempotency-Key`) — **201, `status:"paid"` immediately.**
9. ✅ Same key + same body → **200, identical cached object**, no duplicate payout.
10. ✅ Same key + different body → **409 `idempotency_key_conflict`**, exactly as documented.
11. ⬜ `POST /v1/webhook_endpoints` — not yet executed (needs a reachable callback URL).
12. ⬜ `POST /v1/webhook_endpoints/{id}/test` — depends on 11.
13. ⬜ Real webhook delivery reconciliation against `FinancialProductsWebhookService` — depends on 11–12.
14. ⬜ `POST /v1/conversions/quote` / `POST /v1/conversions` — not yet executed.

**8 of 14 steps executed and passed live.** Remaining 6 depend on customer onboarding (2–4, 7) and webhook endpoint registration (11–14), neither built yet.

## 10. Production-readiness checklist

- [x] Sandbox auth confirmed (`GET /v1/wallets` → 200).
- [x] `RemittanceProvider` interface extended to carry `amountMinor`/currencies explicitly (your decision, implemented this pass) — applied to Swappr, Yativo, mock.
- [x] Real NGN payout created, confirmed `paid`.
- [x] Idempotency replay (200, cached) and conflict (409) both tested against real duplicates.
- [x] `payout.create` capability confirmed enabled on the FlipTrybe sandbox account.
- [x] Name-enquiry confirmed live (recipient-name validation path works).
- [ ] Individual customer onboarding + KYC flow built and tested.
- [ ] Currency-specific recipient builders for GBP/USD/EUR/CAD built (only NGN mapped and verified).
- [ ] Beneficiaries create/list/delete adapter methods built (list confirmed reachable).
- [ ] Webhook endpoint registered; secret stored in secrets manager; `verifySwapprWebhook` validated against a **real** delivery (currently only unit-tested with synthetic signatures).
- [ ] Ledger reconciliation tested end-to-end through `FinancialProductsWebhookService` for a Swappr `payout_paid`/`payout_failed` event.
- [ ] Rate-limit behavior discovered and documented (currently UNKNOWN — no 429 observed, but volume was low).
- [ ] `payout.fx`/conversion capabilities confirmed enabled if cross-currency payouts are needed.
- [ ] `RemittanceCorridor` rows enabled only for NGN-domestic routes until GBP/USD/EUR/CAD recipient builders exist.
- [ ] Feature flags (`remittance`, `virtualAccounts`) flipped only after all of the above — **currently still disabled**.

**Current status: NOT production-ready.** Only authentication has been verified live.
