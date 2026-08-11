# Maplerad — Provider Integration Reference

Status: **DOCUMENTED AND LIVE-VERIFIED against a real sandbox account, NOT
PRODUCTION-READY.** Mapped line-by-line against the official Maplerad API
documentation (`maplerad.dev`, checked 2026-08-11) and exercised end-to-end
against `https://api.maplerad.com/v1` with real sandbox credentials
(`mpr_sandbox_sk_***REDACTED***`). The card adapter is
standalone (not wired into `apps/api/src/modules/financial-products/`, no
feature flag touched). The FX adapter IS wired into
`apps/api/src/modules/fx/fx.service.ts`, gated behind `MAPLERAD_SECRET_KEY`,
mirroring the existing Fincra/Swappr pattern exactly.

Adapters:
- `createMapleradVirtualCardProvider` in `packages/providers/src/financial-products.ts`
- `createMapleradFxProvider` in `packages/providers/src/index.ts`

---

## Base URL & authentication

| Environment | Base URL |
|---|---|
| Sandbox (live-verified) | `https://api.maplerad.com/v1` |
| Production | Same host per available evidence — no separate production host was found documented or discoverable; the sandbox secret key worked directly against `https://api.maplerad.com/v1` with no environment prefix in the URL. **Not separately verified with a production key** (only the sandbox key was available). |

- Header: `Authorization: Bearer <secret key>` (`maplerad.dev/docs/authentication`), live-confirmed.
- Response envelope: `{ status: boolean, message: string, data: ... }`, confirmed on every endpoint below.
- **Important, live-confirmed and NOT assumed:** Maplerad returns HTTP 200 with `status:false` for many business-logic failures (e.g. `"service is only available for Tier 1 customers"`, `"insufficient balance"`, `"could not find quote"`) — not just non-2xx statuses. Both adapters treat `status:false` as an error regardless of HTTP status code.

## Trailing-slash behavior — per-endpoint, live-tested, NOT a single universal rule

The task brief assumed a Swappr-style universal "always needs a trailing slash" rule. Live testing found it is **inconsistent per endpoint**:

| Endpoint | No trailing slash | With trailing slash |
|---|---|---|
| `POST /customers` | **200 directly** | 307 redirect (needs `-L`/manual follow) |
| `GET /wallets` | **200 directly** | 301 redirect |
| `POST /issuing` | (not tested bare — used with slash per initial task guidance) | **200 directly**, this is the form used |
| `GET /issuing/{id}` | **200 directly** | not tested |
| `PATCH /issuing/{id}/freeze`, `/unfreeze` | **200 directly** | not tested |
| `GET /issuing/?customer_id=...` | 301 redirect (live-confirmed) | **200 directly** |
| `POST /fx/quote`, `POST /fx`, `GET /fx` | **200 directly** | not tested |

Both adapters call the exact path forms confirmed live above — no blanket trailing-slash rule is applied.

---

## PART 1 — Card issuing adapter

### Customer prerequisite — LIVE-CONFIRMED, Tier 1 required (not Tier 0)

The Issuing guide (`maplerad.dev/docs/issuing`) states card issuance needs at
minimum a Tier-1 customer. Live-confirmed directly:

```
POST /issuing/ {customer_id:<tier-0 customer>, currency:"USD", ...}
  -> {"status":false,"message":"service is only available for Tier 1 customers"}
```

- `POST /customers` (Tier 0) requires only `first_name`, `last_name`, `email`,
  `country` — genuinely lightweight, confirmed live: created
  `id: 416e2f6d-ed4a-42c6-adaa-c349fef9a290`, `tier: 0`.
- `PATCH /customers/upgrade/tier1` requires `customer_id`, `dob`, `phone`
  (`phone_country_code`+`phone_number`), `address` (street/city/state/country/
  postal_code), and `identification_number` (BVN for Nigeria) — this is real
  KYC, not lightweight. Live-confirmed with a test BVN
  (`12345678901`) and DOB `01-01-1990`: `{"status":true,"message":"Customer
  upgraded successfully"}`.
- **Decision:** matching the Sudo/Payscribe precedent, `issueCard()` does
  **not** fabricate or auto-create a customer. It requires
  `input.providerCustomerId` and throws a clear error naming the two-step
  create+upgrade flow if it's missing. Unlike Sudo, Maplerad's Tier-0
  creation IS lightweight (no documents) — but Tier-1 (required for card
  issuance) is not, so the adapter still treats customer provisioning as a
  caller responsibility.

### Endpoints used

| Operation | Method & path | Notes |
|---|---|---|
| Issue card | `POST /issuing/` | `{customer_id, currency, type:"VIRTUAL", auto_approve:true, brand, amount}` — **asynchronous**, returns only `{reference}` |
| Poll for created card | `GET /issuing/?customer_id={id}&page_size=50` | Adapter polls this (bounded retries, 1.5s backoff) diffing against a pre-create snapshot, since the async create response's `reference` is NOT the resulting card id (live-confirmed: `reference:"d8792f11-..."` vs resulting `id:"15b94ef8-...-c5b0"` differ) |
| Get card | `GET /issuing/{id}` | |
| Fund card | `POST /issuing/{id}/fund` | `{amount}` — minor units |
| Freeze | `PATCH /issuing/{id}/freeze` | no body |
| Unfreeze | `PATCH /issuing/{id}/unfreeze` | no body |
| Get all cards | `GET /issuing/?customer_id=...` | used internally by issueCard's polling, not exposed as a separate interface method |

### Not used / genuinely undocumented

- **Terminate card**: no reference page exists. `https://maplerad.dev/reference/terminate-a-card` returns a live HTTP 404. The Issuing guide's only mention is "Termination: Cards can be terminated (available on dashboard)" — no API method/path documented anywhere discoverable. `terminateCard()` throws a clear, non-fabricated error instead of guessing a path, matching the Sudo precedent for genuinely undocumented irreversible operations.

### Field mapping (`VirtualCardDetails`)

| Interface field | Maplerad source | Notes |
|---|---|---|
| `providerCardId` | `data.id` | |
| `last4` | last 4 chars of `data.masked_pan` (e.g. `"222183******7030"` → `"7030"`) | |
| `expiryMonth` / `expiryYear` | parsed from `data.expiry` (`"MM/YY"`, e.g. `"08/31"` → month 8, year 2031) | live-confirmed 2-digit year form, expanded to 4 digits |
| `brand` | `data.issuer` (`"VISA"` \| `"MASTERCARD"` directly) | **no coercion needed — see brand determination below** |
| `currency` | `data.currency` | |
| `status` | `data.status` (`"ACTIVE"`→ACTIVE, `"DISABLED"`→FROZEN, `"TERMINATED"/"CANCELED"`→TERMINATED) | |
| `balanceMinor` | `data.balance` | present directly on the card object — unlike Sudo, no separate balance endpoint needed |

### Card-brand determination — LIVE-CONFIRMED, both brands work (unlike Sudo)

Unlike Sudo (where Visa/MasterCard issuance was account-wide disabled and
only Verve worked), **both VISA and MASTERCARD virtual-card issuance are
live-confirmed working** in this Maplerad sandbox, against the same Tier-1
customer (`416e2f6d-ed4a-42c6-adaa-c349fef9a290`):

| Request | Result |
|---|---|
| `POST /issuing/ {brand:"VISA", currency:"USD", amount:200}` | `200` — card created, id `15b94ef8-4a42-4df4-894f-68189f45c5b0`, `issuer:"VISA"` |
| `POST /issuing/ {brand:"MASTERCARD", currency:"USD", amount:200}` | `200` — card created, id `51b91688-29b1-4e12-8404-c8de00d26c9b`, `issuer:"MASTERCARD"` |

No brand-enum gap exists for this adapter — `VirtualCardDetails.brand`
('VISA' | 'MASTERCARD') maps directly onto Maplerad's `issuer` field with no
normalization needed beyond an uppercase compare (`normalizeMapleradCardBrand`
still throws rather than silently coercing if Maplerad ever returns an
unexpected value).

### Prerequisite flow (live-verified, real IDs from 2026-08-11)

1. `POST /customers` `{first_name:"Test", last_name:"User", email:"...", country:"NG"}` → `id: 416e2f6d-ed4a-42c6-adaa-c349fef9a290`, `status:"PENDING"`, `tier:0`.
2. `PATCH /customers/upgrade/tier1` with dob/phone/address/identification_number → `{"status":true,"message":"Customer upgraded successfully"}`.
3. `POST /issuing/` for the Tier-1 customer initially failed with `"insufficient balance"` — Maplerad's SPEND wallet (not TREASURY) must hold sufficient balance in the card's currency.
4. Sandbox-only funding flow used purely for verification (NOT part of either adapter, since neither `issueCard` nor `fundCard` should silently move business treasury funds):
   - `POST /test/wallet/credit {amount:1000000, currency:"USD"}` → credited the TREASURY wallet.
   - `POST /wallets/fund {currency:"USD", source_wallet_type:"TREASURY", destination_wallet_type:"SPEND", amount:5000}` → moved funds into SPEND.
5. `POST /issuing/ {customer_id, currency:"USD", type:"VIRTUAL", auto_approve:true, brand:"VISA", amount:200}` → `{"status":true,"message":"Card creation in progress","data":{"reference":"d8792f11-5dc0-4bec-966b-27bba0e7ff8f"}}` — async, no card id yet.
6. `GET /issuing/?customer_id=416e2f6d-...` (after a short delay) → returned the real card: `id:"15b94ef8-4a42-4df4-894f-68189f45c5b0"`, `masked_pan:"222183******7030"`, `expiry:"08/31"`, `issuer:"VISA"`, `status:"ACTIVE"`, `balance:0` initially (the `amount:200` request field took effect a moment later — confirmed at step 8, balance had risen to 200 by the time of the fund call).
7. Repeated for MASTERCARD → `id:"51b91688-29b1-4e12-8404-c8de00d26c9b"`, `issuer:"MASTERCARD"`.
8. `POST /issuing/15b94ef8.../fund {amount:500}` → `{"status":true,"message":"Successfully funded card","data":{"id":"bb031800-e7a3-48fe-90b4-ec88af90d70e"}}`; `GET /issuing/15b94ef8...` afterward showed `balance:700` (200 initial + 500 funded — exact minor-unit math, no conversion applied).
9. `PATCH /issuing/15b94ef8.../freeze` → `{"status":true,"message":"Successfully disabled card"}`; `GET` afterward showed `status:"DISABLED"`.
10. `PATCH /issuing/15b94ef8.../unfreeze` → `{"status":true,"message":"Successfully enabled card"}`.

`terminateCard()` was **not** called live — no documented endpoint exists (see above).

---

## PART 2 — FX quote/exchange adapter

### Endpoints used

| Operation | Method & path | Notes |
|---|---|---|
| Generate quote | `POST /fx/quote` | `{source_currency, target_currency, amount}` — `amount` is REQUIRED, in the source currency's minor unit |
| Execute exchange | `POST /fx` | `{quote_reference}` — **NOT called by the adapter** (see lock-vs-indicative below); only exercised manually during verification |
| Get FX history | `GET /fx` | not used by the adapter (no historical-lookup method in the `FxProvider` interface) |

### Quote lock determination — LIVE-CONFIRMED genuine lock, not indicative

The generate-quote endpoint returns a `reference` (quote id) with no explicit
expiry field documented. To determine whether it is a real lock or merely
indicative, both a fresh and a stale reference were tested against
`POST /fx`:

- Reusing an **already-used-in-a-different-quote** `reference` value:
  `POST /fx {"quote_reference":"6fffb1fb..."}` → `{"status":false,"message":"could not find quote"}`.
- A **fresh** quote followed immediately by `POST /fx` with its own
  `reference`: quote `POST /fx/quote {source_currency:"USD",
  target_currency:"NGN", amount:1000}` → `{"reference":"ade5bced...",
  "rate":600,...}`; then `POST /fx {"quote_reference":"ade5bced..."}` →
  `{"status":true,"message":"Exchange successful","data":{"rate":600,...}}`.

This confirms the quote is a genuine server-side lock referenced by id (the
`Exchange Currency` doc explicitly frames quote-then-exchange as a two-step
flow), not just an indicative number. **The adapter's `getRate()` only
generates a quote and reads its rate — it deliberately does not call
`POST /fx`**, since executing a real currency conversion is a distinct,
money-moving operation outside the read-only `FxProvider` contract
(`getRate`/`getRates`/`getSupportedCurrencies`/`healthCheck`). `POST /fx` was
exercised manually (not through the adapter) purely to confirm the lock
semantics above.

### Field mapping (`FxRate`)

| Interface field | Maplerad source |
|---|---|
| `baseCurrency` | input `source_currency` |
| `quoteCurrency` | input `target_currency` |
| `rateMicros` | `BigInt(Math.round(data.rate * 1_000_000))` |
| `timestamp` | `new Date()` at call time (Maplerad's quote response has no timestamp field) |
| `provider` | `"maplerad"` |

Live-confirmed real quote: `POST /fx/quote {source_currency:"USD",
target_currency:"NGN", amount:10000}` → `{"reference":"6fffb1fb214648ab8b81539a242c5ed4","source":{"currency":"USD","amount":10000,"human_readable_amount":100},"target":{"currency":"NGN","amount":6000000,"human_readable_amount":60000},"rate":600}` → `rateMicros = 600_000_000n`.

### Supported currencies — FX-specific set, live-tested to be BROADER than the documented enum

The `generate-fx-quote` reference doc's field description names only
`NGN`/`USD` as the `source_currency`/`target_currency` enum. Live testing
found this to be inaccurate/incomplete: `POST /fx/quote
{source_currency:"USD", target_currency:"GHS", amount:10000}` succeeded with
a real rate (`8.1`), not rejected. `GET /currencies` (platform-wide) returned
18 currencies (NGN, USD, GHS, KES, TZS, UGX, MWK, MZN, PYUSD, RWF, CDF, ZAR,
SLE, LRD, XAF, XOF, USDT, USDC). Since the FX quote endpoint did not reject a
currency present in that list and no narrower FX-specific enum was found
enforced, `getSupportedCurrencies()` reports the full 18-currency
`GET /currencies` list rather than the narrower 2-currency set the reference
doc's prose implies.

### Wiring into `fx.service.ts`

`apps/api/src/modules/fx/fx.service.ts` constructor now also checks
`MAPLERAD_SECRET_KEY` (optional `MAPLERAD_BASE_URL` override) and, if set,
pushes `createMapleradFxProvider(...)` into the same `fxProviders: FxProvider[]`
array used by Fincra/Swappr — no other logic in that file was touched. The
existing best-rate comparison and cache-refresh loop work generically across
however many providers are configured.

---

## Production readiness gaps

- [ ] Card issuance's SPEND-wallet funding is a manual treasury operation in
      this sandbox (`POST /wallets/fund`) — no automated top-up-the-SPEND-wallet
      flow exists in either adapter; a real integration needs a defined
      treasury-management strategy before `issueCard()`/`fundCard()` can be
      relied upon in production.
- [ ] `issueCard()`'s async-create polling (bounded 10 attempts × 1.5s) is a
      stopgap for the lack of a webhook receiver in this pass — a production
      integration should receive Maplerad's card-creation webhook instead of
      polling.
- [ ] `terminateCard()` remains unimplemented — no documented API endpoint
      was found; must be resolved with Maplerad support/docs.
- [ ] Only the sandbox host/key was tested; production base URL and any
      production-specific behavior differences are unverified.
- [ ] `POST /fx` (actual currency exchange execution) was verified manually
      but is intentionally not exposed through `FxProvider` — if a
      money-moving FX-execution capability is needed later, it should be a
      distinct interface/method with its own idempotency-key handling, not
      folded into `getRate()`.
- [ ] Webhooks (`maplerad.dev/docs/verifying-webhooks`) were not implemented
      or verified in this pass — out of scope for both adapters.

## Not wired (card adapter)

`createMapleradVirtualCardProvider` is standalone: no changes were made to
`apps/api/src/modules/financial-products/` (service/controller/DTOs), no
`ProviderConfig` row, and no feature flag was touched — matching how Sudo was
added before being wired in. It is exported from
`packages/providers/src/financial-products.ts` and ready to be wired once the
gaps above are resolved.
