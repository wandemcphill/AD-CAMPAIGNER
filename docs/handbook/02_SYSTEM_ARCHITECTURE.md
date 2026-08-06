# 02 — System Architecture

**Status:** Deepened v1.0. Resolves the sync/async contract and saga-placement questions carried from the skeleton. Remaining open items are flagged at the end and are implementation choices, not architectural blockers.

## Purpose

Defines the shape every feature must fit. If a proposed change doesn't fit this shape, the change is wrong, not the shape — per the base spec's closing rule: *if implementing a new provider requires changes to Flutter screens, domain models, or core business logic, the architecture should be considered incorrect and refactored before proceeding.*

## 1. The layer stack

```text
Flutter (mobile) / Web

↓

API Gateway

↓

Financial Orchestration Layer (services: AccountService, WalletService, CardService, ...)

↓

Provider Routing Engine

↓

Provider Adapter Layer

↓

Licensed Provider
```

| Layer | Owns | Must never |
|---|---|---|
| Flutter / Web | UI state, navigation, calling FlipTrybe's own service clients | Call a provider directly; know a provider's name, shape, or error codes |
| API Gateway | Auth, request validation, idempotency-key issuance, response shaping (sync-fast-path vs. pending), rate limiting | Contain product logic or provider selection logic |
| Financial Orchestration Layer | Product logic per domain (Account, Wallet, Card, Transfer, FX, Stablecoin, Payment); saga coordination for multi-step operations (§5) | Call a provider's SDK directly — always goes through Routing Engine → Adapter |
| Provider Routing Engine | Provider selection (new-resource path and resource-affinity path — see `04`), reading the Provider Registry | Execute a provider call itself; hold product logic |
| Provider Adapter Layer | Translating one canonical operation/error/event shape to and from one provider's native shape | Make a routing decision; leak provider-native shapes upward |
| Licensed Provider | Actual regulated financial activity | — (external) |

## 2. Supporting systems that sit alongside the stack

Not in the request path for every call, but referenced by multiple layers:

- **Internal Ledger** — append-only system of record independent of any single provider (full mechanics: Ledger & Reconciliation addendum). Written to by Orchestration Layer services after every state-changing operation and by the Webhook Gateway after every confirmed provider event. Read by every entity's "current state" projection (see `07` §3).
- **Webhook Gateway / Event Bus** — inbound provider events, decoupled from the request path (full mechanics: Webhook Idempotency & Ordering addendum). Writes to the Ledger, publishes normalized events that Orchestration Layer services subscribe to.
- **Provider Registry** — **decision:** unify what the skeleton described as two registries (Capability Registry and Provider Registry) into one component with one schema, read by the Routing Engine and written to by three independent processes:

```json
{
  "provider": "bridgecard",
  "interface_version": "1.2",
  "capabilities": {
    "cards": { "supported": true, "currencies": ["USD", "NGN"], "single_use": false, "merchant_lock": false },
    "wallets": { "supported": true }
  },
  "reliability": { "idempotency": "strong", "ordering": "sequence", "webhook_signature": "hmac_sha256" },
  "health": { "status": "healthy", "latency_p50_ms": 240, "success_rate_24h": 0.994 },
  "commercial": { "margin_pct": 4.2 },
  "feature_flag_override": null
}
```

  Writers: `capabilities`/`interface_version`/`reliability` come from adapter registration (deploy-time, `05`); `health` is written continuously by the health-checker (runtime); `commercial` is written by ops/finance tooling (manual, infrequent); `feature_flag_override` is written by the Admin Portal (`11`) and, when non-null, is a hard gate the Routing Engine checks before health. This resolves the "two systems that can disagree" risk flagged earlier — there is exactly one place a provider's usability is recorded.

- **Feature Flags** — implemented as the `feature_flag_override` field above, not a separate system. This is the resolution to the open decision carried from `00_README.md`.

> **AMENDED 2026-08-06.** The unified single-JSON-document registry above was not the shape implemented, but the *decision* it represents ("one place a provider's usability is recorded", no separate feature-flag store) holds — see `11` §6's amendment for the full account. In the repo:
>
> - `capabilities`/`interface_version`/`reliability` → `ProviderAdapterBase.getCapabilities()` (`05`'s amendment), returned live by each adapter rather than persisted at registration time.
> - `health` → a separate `ProviderHealth` table (`packages/database`), not a field on the same row as config — a healthier design than the sketch above, since health is high-write/append-like data and config is low-write, and separating them avoids write contention and keeps a full health history rather than only the latest snapshot.
> - `feature_flag_override` → `ProviderConfig.status` (`HEALTHY | DEGRADED | DOWN | DISABLED`), on a third table, `ProviderConfig`. This is the actual hard gate the Routing Engine (`packages/providers/src/router.ts`'s `scoreCandidate()`) checks.
> - `commercial.margin_pct` → a separate `PricingRule` table with `markupBps`/`discountBps`/`minimumMarginMinor`/`platformFeeMinor` and a specificity tiebreaker (domain/country/network/productType/provider) — more capable than a flat percentage, since margin genuinely varies per scope in practice.
>
> Net effect: **three tables, not one document** (`ProviderConfig`, `ProviderHealth`, `PricingRule`), each read by the Routing Engine and written by a different process, same as this section's original writer-separation reasoning — the "one place a provider's usability is recorded" property holds, just not literally one row.

## 3. Golden rules

1. Never integrate providers directly inside UI.
2. No provider names appear anywhere in UI or user-facing copy.
3. No provider IDs in business logic — always mapped through FlipTrybe IDs (enforced concretely via the Provider Mapping pattern, `07` §2).
4. Every provider is replaceable without a client change. (Originally "without a Flutter change" — the client is Next.js, not Flutter; see `10`'s amendment. The rule itself is unchanged.)

## 4. Request lifecycle (worked example: "user requests a USD virtual card")

```text
1. Flutter calls CardService.createCard(currency: "USD") — client-side service client, see `10` §1

2. API Gateway
   - authenticates request, validates payload
   - generates fliptrybe_card_id
   - generates/validates idempotency key (client-supplied or gateway-generated)
   - writes initial Ledger entry: { resource: card, status: "initiated" }

3. CardService.createCard() (Orchestration Layer)
   - calls Routing Engine: "need card capability, currency=USD, new resource"

4. Routing Engine
   - reads Provider Registry, filters to providers where capabilities.cards.supported
     and currencies includes USD
   - filters out any with health.status != "healthy" or feature_flag_override = "disabled"
   - ranks remaining by priority/fees/latency (`04` §1)
   - selects BridgeCard, logs the decision (provider + reason) for audit

5. CardService calls Adapter Layer: BridgeCardAdapter.execute({ type: "create_card", ... })

6. Adapter
   - translates to BridgeCard's native request shape
   - calls BridgeCard's API
   - normalizes the response into AdapterResult (`05`)

7. CardService
   - writes ProviderMapping row (fliptrybe_card_id ↔ bridgecard_card_id)
   - writes Ledger entry: { resource: card, status: "active" | "pending", provider_reference: ... }

8. API Gateway response shaping (see §5 decision below)
   - if the Ledger write in step 7 completed within a short grace window (default 3s),
     return 200 with the resource in its resolved state
   - otherwise return 202 with status: "pending" and the fliptrybe_card_id

9. (If the provider confirms asynchronously via webhook rather than in the synchronous
   response — some providers do)
   Webhook Gateway → signature verification → dedup (addendum §2.2) → Event Bus
   → CardService's webhook handler → Ledger write → if the client's request is still
   "pending", push an update to the client (§5)
```

## 5. Sync vs. async contract — decision

**Decision:** hybrid, single response shape across the whole API.

- Every mutating endpoint returns the same envelope: `{ resource_id, status: "active" | "pending" | "failed", ... }`.
- The API Gateway holds the connection open for a short grace window (default 3 seconds, configurable per operation type) waiting for the Orchestration Layer to finish. Fast operations (card creation, wallet funding from an existing balance) typically resolve inside this window and the client gets an immediate `active`/`failed` result — no special-case client logic needed.
- Operations that are inherently slow (remittance settlement, some KYC-gated account openings) will not resolve inside the grace window. The client receives `pending` immediately and either polls `GET /resource/{id}` or receives a push notification when the Ledger is updated by a later webhook (step 9 above).
- This means Flutter builds **one** pending-state UI pattern (`10` §2) rather than per-product special cases, and the backend never holds a connection open for an operation that could take minutes.

## 6. Failure and partial-failure handling

**Decision on placement:** saga coordination lives inside the Orchestration Layer, as a shared internal capability used by any service with a multi-step operation — not as a separate top-level layer in the stack diagram in §1. Concretely, this is a small `SagaCoordinator` utility that Orchestration Layer services call into; it is not itself a service other layers talk to.

**Saga contract:** every multi-step operation defines its steps and, for each step, either:

- a **compensating action** (an operation that undoes the step), or
- an **idempotent retry** (safe to re-attempt without side effects), or
- an explicit **hold-and-flag** (the step cannot be safely auto-reversed or auto-retried — leave the resource in a clearly-labeled intermediate state and surface it to the Admin Portal, `11` §5, for manual resolution).

**Default policy for anything touching real money:** prefer hold-and-flag over automatic reversal. A failed automatic refund can itself fail and compound the problem; a resource sitting in a clearly labeled `created_unfunded` or `debited_unsettled` state, visible to ops, is safer than a silent automated reversal chain. Automatic compensation is reserved for steps with no funds movement (e.g., canceling a just-created, still-empty card).

**Worked example — Card creation (create → fund):**

```text
Step 1: create_card       compensating action: terminate_card (safe — no funds moved yet)
Step 2: fund_card         on failure after step 1 succeeded:
                             do NOT auto-terminate — card exists and is valid,
                             just unfunded. Ledger status: "created_unfunded".
                             Flagged to Admin Portal for retry or manual funding.
```

**Worked example — Remittance (quote → lock rate → debit → payout):**

```text
Step 1: quote              expires after N minutes — idempotent, safe to re-quote
Step 2: lock_fx_rate       compensating action: release_lock (safe, no funds moved)
Step 3: debit_source       compensating action: refund_source — but see policy above:
                             if refund_source itself fails, hold-and-flag, do not retry
                             indefinitely
Step 4: initiate_payout    on failure after debit succeeded: hold-and-flag,
                             never auto-retry payout with the same idempotency key
                             without confirming step 3's debit is still valid
```

Full state machines per product, including which operations are multi-step, are the responsibility of `06_FINANCIAL_PRODUCTS.md` — this document defines the *pattern*, `06` enumerates every case it applies to.

## 7. Service boundaries

| Service | Owns | Depends on | Backs (API, see `09`) |
|---|---|---|---|
| AccountService | Account entity, settlement preference | Routing Engine, Ledger | `/accounts/*` |
| WalletService | Wallet entity, funding/withdrawal | Routing Engine, Ledger | `/wallets/*` |
| CardService | Card entity, lifecycle (freeze/topup/terminate) | Routing Engine (new + affinity path, `04` §4), Ledger | `/cards/*` |
| RemittanceService | Transfer entity, quote/lock/track/cancel | Routing Engine, FXService, Ledger, SagaCoordinator | `/transfers/*` |
| FXService | FXQuote entity, rate locking | Routing Engine, Ledger | `/fx/*` |
| StablecoinService | Stablecoin settlement, on/off-ramp | Routing Engine, Ledger, AML checks (`08` §2) | `/stablecoin/*` |
| PaymentService | Cross-cutting payment orchestration where a flow spans more than one of the above (e.g., fund wallet from external card) | AccountService, WalletService, Ledger | `/payments/*` |

## Resolved (was open in skeleton)

- Provider Registry vs. Capability Registry → unified, schema in §2.
- Feature flags mechanism → `feature_flag_override` field on the unified registry, §2.
- Sync vs. async API contract → hybrid grace-window pattern, §5.
- Saga/compensation logic placement → inside Orchestration Layer as a shared `SagaCoordinator`, §6.

## Remaining open questions (implementation-level, not architecture-blocking)

- [ ] Grace window duration (§5 default 3s) — tune once real provider latency data exists (`03`/`04` health data).
- [ ] Push notification transport (websocket vs. FCM/APNs vs. both) — DevOps Lead decision, doesn't affect this document's contract.
- [ ] Job queue technology for dispatching async provider calls — implementation detail, not architecture.
