# 07 — Data Model

**Status:** Deepened v1.0. Resolves the provider-mapping enforcement mechanism, settlement-fallback behavior, and produces a first-pass data classification table. The classification table is a starting point for `08` — treat it as input to compliance/legal review, not a final answer on its own.

## Purpose

Defines every entity FlipTrybe stores, who owns which fields (FlipTrybe vs. provider vs. derived-from-Ledger), and how each entity relates to the Internal Ledger.

## 1. Core entities

### User
```text
id                      FlipTrybe ID
legal_name              PII
email                    PII
phone                    PII
kyc_status               enum: unverified | pending | verified | rejected
kyc_provider_reference   → ProviderMapping (see §2)
account_ids              [Account]
created_at
```

### Account (Global Accounts)
```text
id                        FlipTrybe ID
user_id                   → User
type                      enum: personal | freelancer | creator | business
currency                  NGN | USD | GBP | EUR | (future: CAD | AUD | AED | USDT | USDC)
status                    enum: active | closed | suspended
preferred_settlement      NGN | USD | USDT | USDC
provider_mapping_id       → ProviderMapping
created_at
```

### Wallet
```text
id                        FlipTrybe ID
account_id                → Account
currency
status                    enum: active | frozen | closed
balance                   DERIVED — folded from Ledger, never written directly (see §3)
provider_mapping_id       → ProviderMapping
```

### Card
```text
id                        FlipTrybe ID
account_id                → Account
currency
status                    enum: draft | created_unfunded | active | frozen | terminated
last4                     non-sensitive display value
spending_controls         { merchant_lock: bool, single_use: bool, limits: {...} }
provider_mapping_id       → ProviderMapping
```

### Transfer
```text
id                        FlipTrybe ID
account_id                → Account (source)
destination                { type: bank_account | fliptrybe_account, details: ... }
amount                    { value, currency }
fx_quote_id               → FXQuote (nullable — only for cross-currency transfers)
status                    enum: quoted | locked | debited | payout_initiated |
                                completed | failed | held_for_review
provider_mapping_id       → ProviderMapping
```

### FXQuote
```text
id                        FlipTrybe ID
from_currency
to_currency
rate
expires_at
locked                    bool
```

### Settlement
```text
id                        FlipTrybe ID
account_id                → Account
amount                    { value, currency }
source                    description of incoming funds origin
status                    enum: pending | settled | queued_unhealthy_provider | held
```

### ProviderMapping
```text
id                        FlipTrybe ID
fliptrybe_resource_type   enum: account | wallet | card | transfer | settlement
fliptrybe_resource_id     → the owning entity
provider                  e.g. "bridgecard"
provider_reference_id     provider's own ID for this resource
interface_version         adapter contract version at time of creation (`05`)
created_at
```

## 2. Provider mapping pattern — enforcement mechanism (resolved)

The skeleton left open whether the "no provider IDs above the adapter layer" rule is enforced by code convention or access control. **Decision: both, not either/or.**

- **Schema-level:** `ProviderMapping` is a separate table, never inline columns on `Account`/`Wallet`/`Card`/`Transfer`. Primary entities hold only a `provider_mapping_id` foreign key.
- **Access-control-level:** the database role used by Orchestration Layer services (`02` §1) has no `SELECT` grant on `ProviderMapping.provider` or `provider_reference_id`. Only the database role used by the Provider Adapter Layer has that grant. An Orchestration Layer service that genuinely needs to resolve a mapping (rare — mainly the Routing Engine's resource-affinity lookup, `04` §4) does so through an explicit `resolveProviderMapping()` call that itself runs under the adapter-layer role and is gated by the permission scopes defined in `08` §9.
- **Why both:** code convention alone is one accidental join away from a leak (e.g., a debugging query, an ORM eager-load default). Access control alone doesn't stop a well-meaning engineer from architecting a feature around provider identity in the first place — the separate table forces the *design* to be provider-agnostic, and the access control makes a *slip* fail loudly instead of silently leaking.

> **AMENDED 2026-08-06.** Implemented as a staged rollout, not both mechanisms at once — recorded honestly rather than left implicit:
>
> - **Now (done):** a `ProviderMapping` table exists (`packages/database` migration `20260806150000_add_provider_mapping`) with the shape this section describes (`entityType`, `entityId`, `domain`, `providerName`, `providerReference`). A one-off backfill script populates it from the 12 existing resource tables. It is **additive** — the inline `providerName`/`providerReference` columns this section says should never exist still exist on `VtuOrder`, `VirtualNumber`, `GiftCardSellTransaction`, and 9 other tables, and remain each table's actual source of truth today. `resolveProviderMapping()` and the schema-level enforcement (inline columns removed, `provider_mapping_id`-only FKs) are not built yet.
> - **Later (explicitly deferred):** removing the inline columns and rewriting every read/write site across the ~8 affected services to go through `ProviderMapping` instead. This is a substantial, cross-cutting change and is tracked as its own piece of work, not bundled into the table's creation.
> - **Not started, and the bigger open question:** the access-control layer this section describes (a Postgres role that literally cannot `SELECT` provider identity) assumes a multi-role Postgres setup. This codebase currently connects as a single Prisma role with no role separation at all. Standing that up is real infrastructure work — a second DB role, connection-string/credential management per role, and Prisma's own support for switching roles mid-request — not a schema migration. Until it exists, "no provider identity above the adapter layer" is enforced by **convention** (don't put `providerName` in an API response) — the exact failure mode this section originally warned against being vague about. Concretely: no controller in `apps/api` currently serializes `providerName`/`providerReference` in a non-`/admin/*` response, which is the convention holding today; there's no compiler or DB-level backstop if that changes.

## 3. Ledger relationship

The Internal Ledger (full mechanics: Ledger & Reconciliation addendum) is the append-only fact log. Entity fields fall into two categories — this document states which, per entity, so it's never ambiguous whether a field is safe to write directly:

| Entity | Derived from Ledger (never written directly) | FlipTrybe-owned direct state |
|---|---|---|
| Wallet | `balance` | `status`, `currency` |
| Card | — (no balance concept on the card itself; funding flows through Wallet or a dedicated card-funding ledger trail) | `status`, `spending_controls`, `last4` |
| Account | — | `type`, `preferred_settlement`, `status` |
| Transfer | `status` transitions past `debited` (i.e., "did the money actually move") are Ledger-confirmed, not just set by the service that initiated them | initial `status` values (`quoted`, `locked`) prior to any funds movement |
| Settlement | `status` | `source` description |

Rule of thumb: **any field whose correctness depends on "did a provider actually confirm this" is derived from the Ledger. Any field that's purely a FlipTrybe-side preference or label is direct state.** This distinction is what prevents a derived field from accidentally becoming writable and drifting from the Ledger — a service should get a compile-time or schema-level error if it tries to write to a derived field outside the Ledger-folding process.

## 4. Settlement preferences — fallback behavior (resolved)

`Account.preferred_settlement` determines which currency incoming funds settle to. **Decision:** if the preferred settlement currency's provider is unhealthy at the moment of settlement, the settlement is **queued**, not silently redirected to a different currency. Currency conversion changes the amount the user actually receives — that's a decision with real financial consequence and must not happen without the user's awareness, even implicitly.

```text
Settlement due → check provider health for preferred_settlement currency

  healthy   → settle normally
  unhealthy → status: queued_unhealthy_provider
              retry with backoff
              if still unhealthy after configurable threshold (e.g. 1 hour)
                → status: held, surfaced to Admin Portal (`11` §5) for manual
                  intervention or explicit user notification with options
```

## 5. Data classification (first pass — input to `08`, not a substitute for compliance review)

| Field | Classification | Storage | Notes |
|---|---|---|---|
| `User.legal_name`, `email`, `phone` | PII | Encrypted at rest | Standard PII handling per `08` |
| `User.kyc_status` | Non-sensitive (status only) | Plain | The status itself reveals little; the underlying documents never touch FlipTrybe (§ base spec KYC flow) |
| `User.kyc_provider_reference` | PII-adjacent | Encrypted, adapter-layer access only | Links to provider-held identity documents — treat as sensitive even though it's just a reference ID |
| `Card` full PAN, CVV | **PCI-scoped** | **Never stored.** Pass-through only. | Must not appear in the Ledger, in `AdapterResult.rawResponse` once persisted, or in any log with retention beyond a bounded debugging window (see below) |
| `Card.last4` | Non-sensitive | Plain | Display-only, not reconstructable to a full PAN |
| `ProviderMapping.provider_reference_id` | Internal/operational | Encrypted, adapter-layer access only | Not PII itself, but reveals provider relationships and is part of the access boundary in §2 |
| `Wallet.balance`, `Transfer.amount` | Financial-transaction | Ledger-scoped access control | Not encrypted-at-rest the same way PII is, but access-restricted per `08` §9 — a support agent shouldn't have blanket read access to every user's balance |
| `Transfer.destination` (bank details, recipient name) | PII | Encrypted at rest | Same handling tier as `User` PII |
| `FXQuote.rate` | Non-sensitive | Plain | Public-ish market data, no handling burden |

**Rule for `AdapterResult.rawResponse` (defined in `05`):** raw provider responses may contain PCI-scoped fields (e.g., a provider's card-creation response echoing a full PAN). This must be scrubbed of PCI-scoped fields before any persistence — including the Ledger's audit trail. A scrubbed version may be logged transiently in a separate, access-restricted debug store with a short retention window (recommend 24–48 hours) for incident debugging; it must never enter permanent storage in its raw form.

This table is a first pass covering the entities defined in §1 — it is not exhaustive (e.g., it doesn't yet cover Admin Portal audit-log fields or analytics events) and should be finalized with compliance/legal input per `08`'s open question on regulatory review, not treated as final on the basis of this document alone.

## Resolved (was open in skeleton)

- Provider-mapping enforcement → schema separation + access control, both, §2.
- Settlement fallback behavior → queue, never silently reconvert currency, §4.
- Data classification table → first pass complete, §5 (still needs compliance sign-off, noted above).

## Remaining open questions

- [ ] Full classification pass on Admin Portal audit-log fields and any future analytics/warehouse layer — not yet covered here since those systems aren't fully specified elsewhere in the handbook (`11` flagged the same gap).
- [ ] Formal compliance/legal review of §5 before treating it as final input to `08`'s encryption requirements.
