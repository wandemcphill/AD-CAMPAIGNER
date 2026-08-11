# Inflow Africa — Provider Integration Reference

Status: **VirtualAccountProvider LIVE-VERIFIED against real sandbox** (2026-08-11),
superseding the prior 2026-08-08 "BLOCKED BY CREDENTIALS" entry below — a
working sandbox key was supplied for this pass and confirmed live.
RemittanceProvider is **intentionally NOT implemented** — see the
determination below. Only the sandbox base URL and sandbox key have been
exercised; no production credentials were used. Not yet wired into `apps/api`
or gated behind a feature flag — this is an adapter-only pass per task scope.

Adapter: `createInflowVirtualAccountProvider` in
`packages/providers/src/financial-products.ts`.

---

## Role in FlipTrybe

Inflow Africa is a Nigerian fintech gateway that provisions **per-customer NGN
virtual accounts** (via the Monnify rail) and separately offers a **Payouts**
product for bank/mobile-money disbursements, including cross-currency payouts.
Only the virtual-account side is implemented here.

---

## Base URLs

| Environment | Base URL |
|---|---|
| Sandbox | `https://sandbox.inflowafrica.com/api` |
| Production | `https://app.inflowpay.net/api` |
| Local | `http://localhost:3000/api` |

Adapter default: production (`https://app.inflowpay.net/api`), matching this
codebase's existing convention (Payscribe/Swappr also default production).
Pass `baseUrl` to target sandbox. All sandbox verification below used
`https://sandbox.inflowafrica.com/api` explicitly, with the supplied
`gtw_sk_***REDACTED***` key. The same key
returns `401` against the production host — confirming environment is
selected by `baseUrl`, not by key prefix.

## Authentication

- Header: `Authorization: Bearer <key>`
- Key format: `gtw_sk_...` — confirmed live against sandbox in this pass.
  Docs also mention JWT bearer auth as an alternative; not exercised here.

## Response envelope & error shape (confirmed live)

- Success: `{ "data": ... }` (or `{ "data": [...], "meta": ... }` for
  paginated list endpoints).
- Error: `{ "message": "..." }` — a single flat string, no `status`/`error`
  field. `callInflowApi` treats any non-2xx as an error using this shape.

| Code | Meaning (per docs) |
|---|---|
| 201 | Created |
| 200 | Success / idempotent replay |
| 400 | Invalid input or disallowed operation |
| 401 | Missing/invalid/expired API key |
| 403 | Inactive org or insufficient permissions |
| 404 | Resource doesn't exist |
| 409 | Duplicate unique value (email, reference) |
| 500/502 | Server/provider issues |

---

## Customers (prerequisite for a virtual account)

- `POST /v1/customers` — required: `firstName`, `lastName`, `email`.
  Optional: `phone`, `dateOfBirth`, `gender`, `identityType`,
  `identityNumber`, `address{street,unit,city,state,postalCode,country}`.
  **Live-confirmed response** (docs page did not show a response body):
  ```json
  {
    "data": {
      "firstName": "Ada", "lastName": "Verify",
      "email": "ada.verify.claude+test1@example.com",
      "organizationId": "02610739-3832-4c58-ae00-39542d287bd4",
      "userId": "4fa4dd02-6664-4732-848c-14aa096e7b8c",
      "phone": null, "identityType": null, "identityNumber": null,
      "identityImage": null, "dateOfBirth": null, "gender": null,
      "customerIds": null,
      "id": "7474852b-ca34-4c2a-ac3b-5de029de9f22",
      "isActive": true,
      "createdAt": "2026-08-11T15:35:02.526Z", "updatedAt": "2026-08-11T15:35:02.526Z"
    }
  }
  ```
  HTTP 201.
- `GET /v1/customers`, `GET /v1/customers/{id}`, `PATCH /v1/customers/{id}` —
  documented, not exercised by this adapter.
- `DELETE /v1/customers/{id}` — "Deactivate a customer" — deactivates the
  **entire customer**, not a single product. Not called by this adapter (see
  closeAccount note below).

The adapter's `createAccount()` creates a new Inflow customer only when no
`providerCustomerId` is supplied (Inflow has no documented "find by email"
lookup, so it cannot dedupe on its own — callers that want to reuse an
existing customer must pass `providerCustomerId`).

---

## Virtual Accounts

- `POST /v1/customers/{id}/virtual-account` — body `{ "provider": "monnify" }`
  (provider optional, defaults to `monnify`). Docs: "Provisions a virtual bank
  account for the customer... returns an existing account if one is already
  assigned."
  **Live-confirmed response** (real shape carries more fields than the docs
  page showed — `entityId`/`entityType`/`accountReference`/
  `providerReservationId` were not documented but did come back live):
  ```json
  {
    "data": {
      "entityId": "7474852b-ca34-4c2a-ac3b-5de029de9f22",
      "entityType": "customer",
      "organizationId": "02610739-3832-4c58-ae00-39542d287bd4",
      "provider": "monnify",
      "accountReference": "cust_7474852b-ca34-4c2a-ac3b-5de029de9f22",
      "providerReservationId": "295QWLA2YNXGN5A00589",
      "accounts": [
        { "bankCode": "232", "bankName": "Sterling bank", "accountNumber": "2210260837", "accountName": "Ada" },
        { "bankCode": "035", "bankName": "Wema bank", "accountNumber": "0017869951", "accountName": "Ada" }
      ],
      "isActive": true,
      "id": "adbdef7f-c19c-4292-878f-b2e5122ad922",
      "createdAt": "2026-08-11T15:35:12.213Z", "updatedAt": "2026-08-11T15:35:12.213Z"
    }
  }
  ```
  HTTP 201. **Note:** a single assignment returned TWO bank accounts
  (Sterling + Wema) under one `id` — this is a real, live-observed fact, not
  a guess. **Note:** there is no `currency` field anywhere in this response;
  `monnify` is an NGN-only rail, so the adapter infers `"NGN"` rather than
  reading it off the payload.

- `GET /v1/customers/{id}/virtual-accounts` — **live-confirmed** to return the
  identical assignment shape as the create call, wrapped in `data: []`:
  ```json
  {
    "data": [{
      "id": "adbdef7f-c19c-4292-878f-b2e5122ad922",
      "entityId": "7474852b-ca34-4c2a-ac3b-5de029de9f22",
      "entityType": "customer",
      "organizationId": "02610739-3832-4c58-ae00-39542d287bd4",
      "provider": "monnify",
      "accountReference": "cust_7474852b-ca34-4c2a-ac3b-5de029de9f22",
      "providerReservationId": "295QWLA2YNXGN5A00589",
      "accounts": [ /* same two accounts */ ],
      "isActive": true,
      "createdAt": "...", "updatedAt": "..."
    }]
  }
  ```
  HTTP 200.

### Structural gap: no get-by-VA-id endpoint

`VirtualAccountProvider.getAccount(providerAccountId)` takes a single id, but
Inflow's only GET is customer-scoped (`/v1/customers/{id}/virtual-accounts`)
— there is no documented "get one virtual account by its own id" endpoint.
**Resolution (a deliberate encoding, not a guessed endpoint):**
`createAccount()` returns a composite `providerAccountId` of the form
`"{customerId}:{vaAssignmentId}"`. `getAccount()` splits it, calls the
customer-scoped list endpoint, and finds the row whose `id` matches the
`vaAssignmentId` half. This uses only documented, live-verified calls; it
just changes what FlipTrybe stores as the "account id."

### closeAccount() — no per-VA close endpoint

No section of the Inflow API reference (Customers, Virtual Accounts, or
Payouts) documents a way to deactivate a single virtual account. The only
deactivate endpoint that exists is `DELETE /v1/customers/{id}`, which
deactivates the **whole customer** — a materially more destructive operation
than closing one account. Per the "return UNSUPPORTED, not a fake
implementation" rule used elsewhere in this file (see Swappr),
`closeAccount()` throws explicitly instead of calling the customer-deactivate
endpoint.

### Balance

Neither the VA-assignment object nor the get-virtual-accounts response
carries a balance field. `GET /v1/wallets` (live-confirmed below) returns an
org-level balance per currency, but the docs do not describe a link between a
specific customer VA and that wallet's balance. `getAccount()` therefore
reports `balanceMinor: 0`, matching the same "no balance on the VA object
itself" convention already used for Swappr and Payscribe in this file, rather
than guessing a reconciliation.

---

## Wallets (live-confirmed, read-only, not used by the adapter's mapping logic)

`GET /v1/wallets` — HTTP 200:
```json
{
  "data": [
    { "id": "52b1c2e6-5c86-49ea-a086-2807c18f618d", "currency": "EUR", "balance": 0, "isActive": true, "accountNumber": null, "accountName": null, "bankName": null, "createdAt": "2026-08-07T12:16:51.232Z" },
    { "id": "719b6fd3-72b8-4108-b515-882bb02152d0", "currency": "USD", "balance": 0, "isActive": true, "accountNumber": null, "accountName": null, "bankName": null, "createdAt": "2026-08-07T12:16:50.720Z" },
    { "id": "b31c772b-6b8b-4683-90c8-f306173289f8", "currency": "GBP", "balance": 0, "isActive": true, "accountNumber": null, "accountName": null, "bankName": null, "createdAt": "2026-08-07T12:16:51.193Z" },
    { "id": "f5320ea6-2d89-48a2-8d9a-d99c3303a560", "currency": "NGN", "balance": 0, "isActive": true, "accountNumber": null, "accountName": null, "bankName": null, "createdAt": "2026-08-07T12:16:50.710Z" }
  ]
}
```
One row per currency (EUR/USD/GBP/NGN all present for this sandbox org, all
`balance: 0`). Matches the documented shape exactly. Recorded here as the
"safe read call" the task asked for; not wired into this adapter's mapping.

---

## Remittance determination: NOT implemented, evidence below

Inflow's Payouts API (`POST /v1/payouts`) genuinely supports cross-currency /
cross-country transfers — the docs state it handles "Same-currency NGN and
mobile-money payouts" that auto-execute, **plus** "USD/EUR/GBP bank payouts
and all cross-currency (USD source, local destination) payouts," which are
created as `PENDING` for manual admin approval rather than auto-executing.
That is a real capability, not domestic-only.

However, it fails the task's bar for implementing `RemittanceProvider`
("a real quote-then-execute flow"), for two independent, documented reasons:

1. **No quote-then-execute flow for payouts.** The only exchange-rate
   endpoint in the docs index is `GET .../payments/get-exchange-rate-for-
   payment`, which is scoped to the **Payments/collection** product (money
   coming in), not Payouts (money going out). `POST /v1/payouts` itself takes
   a single already-decided `amount` (documented as: "Destination amount for
   cross-currency; else source==destination") with **no rate-lock, no
   quoteId, and no separate quote endpoint**. There is nothing to map onto
   `RemittanceProvider.getQuote()` → `RemittanceQuote` that would be honest
   about being a real quote rather than a guess.
2. **Payouts require a pre-registered beneficiary, not inline recipient
   details.** `POST /v1/payouts` takes a `payoutAccountId` (a UUID), which
   must first be created via `POST /v1/payout-accounts` (currency,
   accountName, plus type-specific fields: accountNumber/bankCode for bank
   accounts, or `accountType: gtw_wallet` + a GlobalTravelWallet public id for
   wallet-to-wallet). `RemittanceProvider.sendTransfer()` in this codebase's
   interface passes `recipient` inline per call — there is no step for
   "resolve or create a beneficiary first." This is the same structural
   mismatch already flagged for Yativo's `beneficiary_details_id` requirement
   in this file; it is not something this adapter pass can paper over without
   either (a) adding a create-and-cache-beneficiary step before every
   `sendTransfer`, or (b) reshaping the `RemittanceProvider` interface — both
   out of scope here.

Given both gaps, `createInflowRemittanceProvider` was **not written**, per
the task's explicit instruction to skip it rather than guess. If a future
pass wants to build it, the two endpoints needed are documented and ready:
`POST /v1/payout-accounts` (beneficiary creation) and `POST /v1/payouts`
(payout creation, `Idempotency-Key` header supported, replay via
`clientReference`) — neither has been live-tested in this pass.

Related, unexercised documented endpoints: `GET /v1/payouts/providers`
(`country_iso_code` + `type` query params — no sample payload seen live),
`GET /v1/payout-recipients/gtw/{publicId}` (resolves a GlobalTravelWallet
recipient by public id — sandbox test id `5391261181` documented for
same-currency transfers only), `GET/PATCH/DELETE` on payout bank accounts,
`GET /v1/payouts`.

---

## Sandbox test data (from `guides/test-accounts.md`)

- Test USD card: `5204 2477 5000 1471`, exp `08/27`, CVV `123` (for Payments
  card flow, unrelated to this adapter).
- Pull-transfer sandbox credentials for GBP (NatWest, Modelo) and EUR SEPA
  (Modelo, test IBAN `ES9121000418450200051332`) — Payments product, not used
  here.
- Mobile-money MSISDN test numbers per country (CI, KE, ZM, UG, TZ, CM, RW).
- GlobalTravelWallet test public id: `5391261181` (same-currency transfers
  only).
- All sandbox testing uses `https://sandbox.inflowafrica.com/api`.

## Sandbox safety rules (from `guides/errors-and-testing.md`)

- Do not blindly retry failed create requests — look up by email/reference
  first.
- Sandbox and production data are completely isolated; do not mix keys.
- Use clearly test-marked emails/references (this pass used
  `ada.verify.claude+test1@example.com`).

---

## Live sandbox verification log (2026-08-11)

Run against `https://sandbox.inflowafrica.com/api` with the supplied
`gtw_sk_***REDACTED***` key via `curl`:

1. `POST /v1/customers` → **201**, created customer
   `id: 7474852b-ca34-4c2a-ac3b-5de029de9f22`.
2. `POST /v1/customers/7474852b.../virtual-account` (body `{}`) → **201**,
   assignment `id: adbdef7f-c19c-4292-878f-b2e5122ad922`, provider `monnify`,
   two live NGN accounts (Sterling `2210260837`, Wema `0017869951`), both
   `accountName: "Ada"`.
3. `GET /v1/customers/7474852b.../virtual-accounts` → **200**, returned the
   identical assignment (confirms create/get shape parity and confirms the
   composite-id `getAccount()` design works against the real API).
4. `GET /v1/wallets` → **200**, four wallets (EUR/USD/GBP/NGN), all
   `balance: 0` for this sandbox org.

No customer/VA deactivation was exercised (closeAccount() is intentionally
unimplemented — nothing to verify).

This supersedes the 2026-08-08 credential-probe entry below, which used a key
that returned 401 in both environments; the key supplied for this pass
authenticated successfully.

---

## Adapter GAPS / open questions

1. **Currency on virtual accounts** — inferred as `"NGN"` (monnify is
   NGN-only); never actually present in any live response. If Inflow later
   supports a non-NGN VA provider, this adapter will silently mislabel it.
2. **getAccount() composite id** — a FlipTrybe-side design choice (see
   above), not a native Inflow identifier. If Inflow ever ships a real
   get-by-VA-id endpoint, this should be simplified.
3. **closeAccount()** — unimplemented; throws. If product requirements need
   real account closure, this needs either a support/dashboard-side process
   (like Swappr's merchant VA) or confirmation from Inflow that
   `DELETE /v1/customers/{id}` is an acceptable (if blunt) substitute.
4. **RemittanceProvider** — not implemented; see determination above.
5. **Webhooks** — `guides/webhooks.md` was not read in this pass (out of
   scope: task only required VirtualAccountProvider). No webhook verifier
   exists for Inflow yet.
6. **Multiple bank accounts per assignment** — the adapter maps only the
   first (`accounts[0]`) into the single-account `VirtualAccountDetails`
   shape; the second account (Wema, in the live test) is currently
   inaccessible through this interface.

## DONE checklist (before this is production-usable)

- [x] Sandbox credentials obtained; auth works.
- [x] Customer create works in sandbox (real id captured).
- [x] Virtual account assignment works in sandbox (real accounts captured).
- [x] Get-virtual-accounts confirmed to match the assign-response shape.
- [x] GET /v1/wallets confirmed (safe read call).
- [ ] Wired into `apps/api/src/modules/financial-products/` (explicitly out
      of scope for this pass).
- [ ] Feature-flag gated and enabled via `ProviderConfig`.
- [ ] Webhook flow read and (if applicable) implemented.
- [ ] Decision made on closeAccount() semantics (see GAP 3).
- [ ] Remittance path revisited if/when beneficiary + payout endpoints are
      live-tested and the interface mismatch is resolved.

---

## Superseded: prior credential-probe entry (2026-08-08)

The section below is kept for history; it predates the working sandbox key
used in this pass and is no longer the current status.

> Status was: **BLOCKED BY CREDENTIALS. No adapter implemented.**
>
> The key probed then (a different `gtw_sk_…` value, since replaced) returned
> `401 {"message":"Invalid token"}` against both
> `https://sandbox.inflowafrica.com/api` (`GET /customers`, `GET
> /organizations`) and `https://app.inflowpay.net/api` (`GET
> /customers?limit=1`). `GET /wallets`, `/virtual-accounts`, `/me` returned
> `404 Route not found` against the bare paths — the real paths are nested
> under `/v1/...` and customer-scoped, as confirmed in this pass.
