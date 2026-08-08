# Inflow Africa — Provider Integration Status

Status: **BLOCKED BY CREDENTIALS. No adapter implemented.**

Per the no-guessed-API rule, no `InflowAdapter` has been written. Documentation
was read; the supplied API key does not authenticate, so nothing could be
sandbox-verified and no endpoint shapes were confirmed against live responses.

## Credential verification result (2026-08-08)

The supplied key (a `gtw_sk_…` organization key, value withheld — see your
secret store) was probed **read-only** against both documented hosts:

| Host | Endpoint | Result |
|---|---|---|
| `https://sandbox.inflowafrica.com/api` | `GET /customers` | **401 `{"message":"Invalid token"}`** |
| `https://sandbox.inflowafrica.com/api` | `GET /organizations` | **401 `{"message":"Invalid token"}`** |
| `https://app.inflowpay.net/api` (production) | `GET /customers?limit=1` | **401 `{"message":"Invalid token"}`** |

The key is rejected in **both** environments — it is revoked, expired,
mistyped, or issued for a different tenant. No money-moving call was attempted
in either environment (governance §45).

`GET /wallets`, `/virtual-accounts`, `/me` returned `404 Route not found`, so
those are not top-level paths — the real paths are nested (see below).

**ACTION REQUIRED FROM YOU:** supply a working **sandbox** key
(`https://sandbox.inflowafrica.com/api`). Do not supply a production key for
integration work.

## Documented capabilities (from docs.inflowafrica.com, NOT verified)

Authentication: `Authorization: Bearer gtw_sk_...`, server-side only.

| Area | Documented operations |
|---|---|
| Customers | create, get by id, list, update, deactivate |
| Virtual accounts | assign a VA to a customer; get VAs for a customer (customer-scoped, not merchant-scoped) |
| Wallets | get a specific currency wallet; list organization wallets; **withdraw from NGN wallet** → Nigerian bank account |
| Payouts | add/list/update/remove payout bank account; create manual payout; list payout providers; list payouts |
| Payments/Collections | create payment request, cancel, get, list, list supported methods, get exchange rate, refresh payment link token |
| Webhooks | "payment, payout, and account events" — **signature scheme not documented in the pages read** |

There is an OpenAPI spec at `docs.inflowafrica.com/openapi.json` — that is the
right source for exact request/response shapes once a working key exists.

## Known gaps

- **Webhook signature verification scheme: UNDOCUMENTED in what was read.** Per §22, if it stays undocumented this must be marked `SIGNATURE_VERIFICATION_UNVERIFIED` and Inflow webhooks must not be trusted for crediting.
- Supported currency list not confirmed.
- KYC requirements not confirmed.
- No sandbox test account details confirmed.

## Compliance gating (§8, §31)

Inflow is designated **secondary/experimental NGN infrastructure**, never an
automatic production primary. Required flags before any live routing:

```
INFLOW_ENABLED=false
INFLOW_PRODUCTION_APPROVED=false
```

Backed in the DB by `ProviderCapabilityGrant` rows, which default every gate
(`documented`/`implemented`/`sandboxVerified`/`kybApproved`/`complianceApproved`/
`productionApproved`/`enabled`) to `false`.

## Classification

**BLOCKED BY CREDENTIALS** — documented, not implemented, not verified.
