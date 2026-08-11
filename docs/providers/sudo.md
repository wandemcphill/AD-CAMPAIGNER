# Sudo Africa — Provider Integration Reference

Status: **DOCUMENTED AND LIVE-VERIFIED against a real sandbox account, NOT
PRODUCTION-READY.** Mapped line-by-line against the official Sudo API
documentation (`docs.sudo.africa`, checked 2026-08-11) and exercised end-to-end
against `https://api.sandbox.sudo.cards` with real sandbox credentials
(business "Flip Tryb LTD", `isApproved:false` — KYB not yet approved). This
adapter is standalone (not wired into `apps/api/src/modules/financial-products/`
and no feature flag touched) — see the "Not wired" note at the bottom.

Adapter: `createSudoVirtualCardProvider` in `packages/providers/src/financial-products.ts`.

---

## Role in FlipTrybe

Sudo is a candidate **Nigerian card-issuing** provider — an alternative/
supplement to Payscribe's USD-only virtual cards. Unlike Payscribe, Sudo issues
NGN cards (Verve/AfriGo/MasterCard/Visa enum) directly against a
business-owned settlement/wallet account structure, not a simple "customer +
card" model.

---

## Base URLs

| Environment | Base URL |
|---|---|
| Sandbox | `https://api.sandbox.sudo.cards` (live-verified) |
| Production | `https://api.sudo.africa` (per docs only — NOT live-tested) |

Adapter default: production (`https://api.sudo.africa`). Pass `baseUrl` to target sandbox.

## Authentication

- Header: `Authorization: Bearer <token>` (per `docs.sudo.africa/docs/authentication`).
- **Live-confirmed 2026-08-11:** the sandbox also accepted the token with no
  `Bearer ` prefix (`Authorization: <token>` alone returned HTTP 200 on
  `GET /cards`, same as with the prefix). This is undocumented leniency, not
  relied upon — the adapter always sends the documented `Bearer` form.
- Response envelope: `{ statusCode, message, data }`. On validation failures
  (HTTP 400), `message` is an **array** of `class-validator`-style error
  objects, not a string — the adapter's `callSudoApi` JSON-stringifies it for
  the thrown `ProviderApiError`.

---

## Endpoints used by this adapter

| Operation | Method & path | Notes |
|---|---|---|
| Create wallet account (auto-provisioned by `issueCard`) | `POST /accounts` | `{type:"wallet", currency, accountType:"Savings", customerId}` |
| Issue card | `POST /cards` | `{customerId, type:"virtual", currency, status:"active", brand, debitAccountId, amount}` |
| Get card | `GET /cards/{id}` | |
| Get card balance | `GET /cards/{id}/balance` | `{currentBalance, availableBalance}`, minor units |
| Freeze / unfreeze | `PUT /cards/{id}` | `{status:"inactive"}` / `{status:"active"}` — no dedicated freeze/unfreeze endpoints exist |
| Fund card (top-up) | `POST /accounts/transfer` | `{debitAccountId, creditAccountId, amount, paymentReference}` — `creditAccountId` = the card's own `account` id |
| (sandbox only, used during verification, not in the adapter) | `POST /accounts/simulator/fund` | instant test-money credit to a wallet-type account |

`POST /customers` (create the prerequisite customer) is a caller responsibility,
matching the Payscribe pattern — the adapter refuses to fabricate one.

### Not used / genuinely undocumented

- No dedicated "top-up" or "fund card" endpoint exists in the docs. The real
  mechanism, confirmed live, is `POST /accounts/transfer` moving funds from a
  business account/wallet into the card's own backing account.
- No freeze/unfreeze/terminate-specific endpoints exist; all are `status`
  transitions on `PUT /cards/{id}`.
- Card Programs (`/reference/create-card-program`) were **not** used — card
  creation succeeded without a `programId` by supplying `brand` + `currency`
  + `debitAccountId` directly, so a program is optional, not a hard
  prerequisite, at least for this flow.

---

## Field mapping (`VirtualCardDetails`)

| Interface field | Sudo source | Notes |
|---|---|---|
| `providerCardId` | `data._id` | |
| `last4` | last 4 chars of `data.maskedPan` (e.g. `"506321*********3765"` → `"3765"`) | Sudo has no separate `last4` field |
| `expiryMonth` / `expiryYear` | `Number(data.expiryMonth)` / `Number(data.expiryYear)` | Sudo returns these as zero-padded strings (`"08"`, `"2029"`) |
| `brand` | `data.brand` via `normalizeSudoCardBrand` | **see Brand-enum gap below** |
| `currency` | `data.currency` | |
| `status` | `data.status` via `mapSudoCardStatus` (`active`→ACTIVE, `inactive`→FROZEN, `canceled`→TERMINATED) | |
| `balanceMinor` (getCard only) | `GET /cards/{id}/balance` → `availableBalance` (falls back to `currentBalance`) | separate call, not on the card object itself |

---

## Brand-enum gap — LIVE-CONFIRMED, not guessed

Sudo's card `brand` enum is `Verve | AfriGo | MasterCard | Visa`.
`VirtualCardDetails.brand` only allows `'VISA' | 'MASTERCARD'`. Real sandbox
testing against the FlipTrybe LTD business account (`isApproved:false`) found:

| Request | Result |
|---|---|
| `POST /cards` `currency:"USD"` `brand:"Visa"` | `400 "Visa Cards are not available at the moment. Please use Verve or MasterCard."` |
| `POST /cards` `currency:"USD"` `brand:"MasterCard"` | `400 "MasterCard Virtual Cards are not available at the moment."` |
| `POST /cards` `currency:"USD"` `brand:"Verve"` | `400 "Verve Virtual Cards are not available at the moment."` |
| `POST /cards` `currency:"USD"` `brand:"AfriGo"` | `400 "AfriGo Virtual Cards are not available at the moment."` |
| `POST /cards` `currency:"NGN"` `brand:"MasterCard"` | `400 "not available"` |
| `POST /cards` `currency:"NGN"` `brand:"Visa"` | `400 "not available"` |
| `POST /cards` `currency:"NGN"` `brand:"AfriGo"` | passed the brand check, failed later on `"No sufficient funds"` (real bank settlement account, not fundable via the sandbox simulator — see below) |
| `POST /cards` `currency:"NGN"` `brand:"Verve"` | **200 — card issued for real**, id `6a7b4006239d666d7ca2c9a4` |

**Decision:** in the current sandbox state, Visa/MasterCard virtual-card
issuance is disabled account-wide, and there is no reliable way to force
either brand today. Per the governing instruction, the adapter does **not**
silently coerce a Verve/AfriGo card into `'VISA'`/`'MASTERCARD'`.
`issueCard()` sends whatever the caller requested (`'VISA'`→`"Visa"`,
`'MASTERCARD'`→`"MasterCard"`, default `"Visa"`) — it never substitutes
`"Verve"` on the caller's behalf. If Sudo's response brand is not
`Visa`/`MasterCard`, `normalizeSudoCardBrand` throws a `ProviderApiError`
rather than lying about the card's network. In practice this means, in this
sandbox today, `issueCard()` will always fail (Visa/MasterCard unavailable) —
this is a real product-availability gap to resolve with Sudo, not a code bug.

---

## Prerequisite flow (live-verified, real IDs from 2026-08-11)

1. `POST /customers` — created `_id: 6a7b3f59239d666d7ca2c91f` (individual,
   NG billing address, no identity/KYC documents supplied — the docs mark
   `individual.identity` optional at creation).
2. `POST /accounts` `{type:"wallet", currency:"USD", customerId}` — created
   `_id: 6a7b3f78239d666d7ca2c933`, `provider:"Sudo"`. **NGN wallet creation
   for the same customer failed**: `400 "You are not allowed to use this
   route."` — likely gated on business KYB approval (`isApproved:false`);
   USD wallets are unaffected. This is the auto-provisioning step `issueCard()`
   performs internally.
3. `POST /cards` `{customerId, type:"virtual", currency:"NGN", brand:"Verve",
   debitAccountId:<default settlement account>, amount:500}` — created
   `_id: 6a7b4006239d666d7ca2c9a4`, `account: 6a7b4003239d666d7ca2c99c`
   (a second wallet account, auto-created by Sudo, backing the card),
   `maskedPan: "506321*********3765"`, `expiryMonth:"08"`, `expiryYear:"2029"`.
4. `GET /cards/{id}` — confirmed the full object shape above, including a
   nested `customer`/`account`/`fundingSource` when not previously updated.
5. `PUT /cards/{id}` `{status:"inactive"}` — confirmed `status` flips to
   `"inactive"` (mapped to `FROZEN`).
6. `PUT /cards/{id}` `{status:"active"}` — confirmed `status` flips back to
   `"active"` (mapped to `ACTIVE`).
7. `GET /cards/{id}/balance` — confirmed `{currentBalance, availableBalance}`
   in minor units (see below).
8. `POST /accounts/transfer` `{debitAccountId:<settlement account>,
   creditAccountId:<card's account id>, amount:500}` — moved the card's
   balance from 4000 → 4500 (after a prior simulator-funded 5000 → 4000 debit
   test), confirming both the transfer mechanism and minor-unit amounts.

**Minor units confirmed end-to-end:** `POST /accounts/simulator/fund`
`amount:500` on a fresh wallet produced `currentBalance:500`;
`POST /accounts/transfer` `amount:1000` debited exactly 1000 from a 5000
balance. No unit conversion is applied anywhere in the adapter.

---

## `fundCard` — genuine interface gap

Sudo's real top-up mechanism, `POST /accounts/transfer`, requires both a
`debitAccountId` (funding source) and `creditAccountId` (destination — the
card's own `account`). `VirtualCardProvider.fundCard(input)` only carries
`providerCardId`, `amountMinor`, and `reference` — no source-account concept.
Rather than guess a source, this adapter requires `SudoConfig.fundingAccountId`
to be configured (a funded business account/wallet `_id`); `fundCard()` throws
a clear error if it is missing. `fundCard()` itself: `GET /cards/{id}` to read
the card's own `account` id, then `POST /accounts/transfer`, then
`GET /cards/{id}/balance` to report the resulting `balanceMinor`.

## `terminateCard` — NOT implemented, deliberately

`PUT /cards/{id}` with `status:"canceled"` requires
`cancellationReason: "lost" | "stolen"` and a `creditAccountId` (refund
destination for any remaining balance). Neither documented reason value fits
a routine, business-initiated termination, and termination is irreversible
per the docs. Per the task's instruction to skip anything genuinely uncertain
rather than guess, this was **not called live**, and `terminateCard()` throws
a clear, non-fabricated error explaining exactly why, instead of forcing
`"lost"` or `"stolen"` to satisfy the type. This must be resolved with Sudo
(support or clearer docs on a legitimate cancellation reason) before
`terminateCard()` can be implemented for real.

---

## Currency, KYB, and sandbox-funding gaps

- **NGN wallet accounts are blocked for this business** (`400 "not allowed"`),
  while USD wallets work — plausibly tied to `isApproved:false` (KYB not
  approved). This may resolve once KYB is approved; not otherwise explained
  by the docs.
- **The default NGN settlement account (`type:"account"`, SafeHaven-backed)
  cannot be funded via `POST /accounts/simulator/fund`** — repeated attempts
  (`accountId` and `bankCode`+`accountNumber` variants) returned
  `200 "Approved or completed successfully"` but balance stayed 0. Only
  `type:"wallet"` accounts (Sudo-provider-backed) were reliably fundable via
  the simulator. This may be a sandbox limitation specific to real-bank-backed
  accounts.
- Despite the above, **a real Verve NGN card was still issued successfully**
  against the (zero-balance) default settlement account with `amount:500` —
  Sudo appears not to strictly enforce settlement-account balance at card
  creation for this flow, unlike the `AfriGo` attempt which surfaced
  `"No sufficient funds"` in one case. This inconsistency was observed, not
  fully explained by docs — flagged for further investigation, not resolved.

---

## Production readiness gaps (feature flag / wiring stays off)

- [ ] Resolve why Visa/MasterCard virtual-card issuance is unavailable for
      this sandbox business (likely KYB-approval-gated) — cannot go live on
      card issuance without at least one VISA/MASTERCARD-compatible brand.
- [ ] Confirm the same brand-availability matrix in production
      (`https://api.sudo.africa`) — only sandbox was tested.
- [ ] Resolve `terminateCard`'s `cancellationReason` semantics with Sudo.
- [ ] Decide product-level `fundingAccountId` provisioning/funding strategy —
      currently a manual config value, no automated top-up-the-funding-account
      flow exists.
- [ ] Card programs (`/reference/create-card-program`) were not explored —
      may offer a cleaner brand/spending-control template if account-level
      brand gating turns out to be program-scoped rather than business-scoped.
- [ ] Webhooks (`docs.sudo.africa/docs/webhooks`) were not implemented or
      verified in this pass — out of scope for this adapter, no
      `verifySudoWebhook` exists yet.

## Not wired

This adapter is standalone: no changes were made to
`apps/api/src/modules/financial-products/` (service/controller/DTOs), no
`ProviderConfig` row, and no feature flag was touched, matching how the Fincra
remittance adapter was added before being wired in. `createSudoVirtualCardProvider`
is exported from `packages/providers/src/financial-products.ts` and ready to be
wired once the gaps above are resolved.
