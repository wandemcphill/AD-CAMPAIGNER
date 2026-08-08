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

## Audit result

The Fincra adapter is a **faithful, documented integration** — no guessed
endpoints. Confirmed correct: base URLs, `api-key` auth, `POST /quotes/generate`,
`POST /disbursements/payouts`, `GET /disbursements/payouts/reference/{ref}`,
status mapping, payment schemes, and HMAC-SHA512 webhook verification.

### Open verification items (sandbox, not code bugs)

1. **Amount units.** The adapter sends `amount: String(sourceAmountMinor)`. Fincra
   request examples use what look like **major** units (`"amount":"1000"`). Confirm
   in sandbox whether Fincra expects major or minor units for `amount`; if major,
   convert before sending (this is the single most important money-safety check).
2. **Quote TTL.** Adapter comment says 30s; docs show an `expireAt` timestamp.
   Confirm the real TTL and ensure re-quote-on-expiry.
3. **FCY collection** per corridor (GBP/USD virtual accounts) — read the FCY
   account pages and confirm origin-side collection before enabling a corridor.
4. **Liberia (LRD)** — not in Fincra's destination list; find an alternative LR
   payout provider or drop the LR corridors.

## DONE checklist (remittance flag stays off until all pass)

- [ ] Confirm amount unit (major vs minor) in sandbox — fix conversion if needed.
- [ ] KYB approved; IP whitelisted; live keys issued.
- [ ] Sandbox quote → payout → status round-trip for each enabled corridor.
- [ ] Webhook received, signature verified, idempotent.
- [ ] Beneficiary name validation wired (verify-account / BVN).
- [ ] Ledger reconciles against Fincra `amountSent`/`amountReceived`/`fee`.
- [ ] `RemittanceCorridor` rows enabled only for confirmed corridors (not LR).
- [ ] Flip the `remittance` feature flag last.
