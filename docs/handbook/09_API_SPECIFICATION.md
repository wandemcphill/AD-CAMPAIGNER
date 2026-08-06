# 09 — API Specification

**Status:** Deepened v1.0. Builds on the response envelope decided in `02` §5 and the full product/state-machine detail in `06`.

## Purpose

The literal contract between Flutter (and any future client) and the backend.

## 1. Response envelope — shared across every mutating endpoint

Per `02` §5:

```json
{
  "resource_id": "card_a91f",
  "status": "active",
  "data": { }
}
```

`status` is always one of `active | pending | failed`, using each product's actual state machine values from `06` as the specific value within `data` when more granularity is needed (e.g., a Card's `data.status` can be `created_unfunded`, while the envelope's top-level `status` stays `pending` until it reaches a terminal state). This two-level status (envelope-level coarse, data-level product-specific) is what lets Flutter build one generic pending-state handler (`10` §2) while still showing product-accurate detail.

## 2. Endpoint index

```text
Accounts
  POST    /accounts
  GET     /accounts/{id}
  POST    /accounts/{id}/close

Wallets
  GET     /wallets/{id}
  POST    /wallets/{id}/fund
  POST    /wallets/{id}/withdraw
  GET     /wallets/{id}/history

Cards
  POST    /cards
  GET     /cards/{id}
  POST    /cards/{id}/freeze
  POST    /cards/{id}/unfreeze
  POST    /cards/{id}/topup
  POST    /cards/{id}/terminate

Transfers (Remittance)
  POST    /transfers/quote
  POST    /transfers                  (locks quote, debits, initiates payout — see `06` §4 saga)
  GET     /transfers/{id}
  POST    /transfers/{id}/cancel

FX
  POST    /fx/quote

Stablecoin
  POST    /stablecoin/onramp
  POST    /stablecoin/offramp
  GET     /stablecoin/{id}
```

## 3. Endpoint entry template

```text
[METHOD] [path]

Purpose:
Auth required:        [scope from `08` §9]
Request body:          { ... }
Response:              envelope per §1
Errors:                normalized AdapterErrorCode-derived list (`05` §3)
Idempotency:            required for all POST endpoints — client-supplied
                        idempotency key, or gateway-generated if omitted
                        (`02` §4 step 2)
Rate limit:
```

**Worked example:**

```text
POST /cards

Purpose:               Create a virtual card
Auth required:          account:write
Request body:            { "account_id": "acct_8821", "currency": "USD" }
Response (fast path):    { "resource_id": "card_a91f", "status": "active",
                            "data": { "status": "active", "last4": "4471" } }
Response (grace-window exceeded): { "resource_id": "card_a91f", "status": "pending",
                            "data": { "status": "created_unfunded" } }
Errors:                   insufficient_funds, provider_unavailable, invalid_request
Idempotency:               required
```

## 4. Error responses

```json
{
  "error": {
    "code": "insufficient_funds",
    "message": "The source wallet does not have enough balance for this operation.",
    "retryable": false
  }
}
```

`code` is always an `AdapterErrorCode` (`05` §3) — never a provider-native error code, enforced at the adapter boundary before the API Gateway ever sees the error.

## 5. Webhooks FlipTrybe emits

**Decision:** v1 does not expose external webhooks to partner/ecosystem consumers — the Event Bus (`02` §2) is internal-only for now. This is deferred rather than built speculatively, since a public webhook contract is hard to change once external consumers depend on it, and there's no confirmed near-term need per `12`'s roadmap (Phase 6 Marketplace is the earliest plausible point this becomes relevant). Revisit when a concrete partner integration is scoped.

## 6. Versioning — decision

URL-based versioning: `/v1/accounts`, `/v1/cards`, etc. **Rationale over header-based:** simpler to reason about in client code, easier to spot in logs/monitoring during debugging, and avoids a class of bugs where a client silently sends the wrong version header. Deprecation policy: a version is supported for a minimum of 12 months after the next version ships, with deprecation warnings surfaced in API responses (a `Deprecation` header) starting at least 3 months before end-of-support.

## 7. Authentication & authorization — decision

JWT-based access tokens with a refresh-token flow (standard short-lived access token, e.g., 15 minutes, longer-lived refresh token). Scopes map directly to the permission model in `08` §9 (e.g., `account:write`, `card:freeze`, `admin:routing_config`) — a token's scopes are checked at the API Gateway before a request reaches the Orchestration Layer, so permission logic isn't duplicated per-service.

## Resolved (was open in skeleton)

- Response envelope shape → two-level status, §1 (inherits `02` §5's decision).
- Sync/async handling → same grace-window pattern, reflected per-endpoint in §3's worked example.
- External webhook scope → deferred to Phase 6+, not built in v1, §5.
- Versioning scheme → URL-based, §6.
- Auth scheme → JWT + refresh, scoped to `08` §9's permission model, §7.

## Remaining open questions

- [ ] Full endpoint documentation (§3 template applied to every endpoint in §2's index) — this document establishes the pattern with one worked example; populate the rest as each product is implemented per `12`'s phases, rather than speculatively documenting endpoints for unbuilt features.
- [ ] Public API docs (OpenAPI/Swagger) generation — worth doing once the endpoint set stabilizes past Phase 2, premature before that.
