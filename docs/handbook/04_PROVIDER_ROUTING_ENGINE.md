# 04 — Provider Routing Engine

**Status:** Deepened v1.0. Builds directly on the unified Provider Registry decided in `02` §2. Resolves the ranking-algorithm and resource-affinity open questions from the skeleton.

## Purpose

Defines how a provider is chosen for any given request. No feature, service, or UI ever chooses a provider directly — every provider selection passes through this engine.

## 1. Two distinct decision paths

The skeleton treated routing as one flow. It's actually two, with different rules:

- **New-resource path** — "I need a USD card, which provider handles it?" No history to consider; pure capability + health + ranking.
- **Resource-affinity path** — "This card already exists on BridgeCard, I need to freeze it." Must route back to the *same* provider that created the resource, not re-rank. This was a real gap in the original spec (§4 below resolves it).

## 2. New-resource routing flow

```text
Request: "Need USD Card"

↓

Query Provider Registry (`02` §2) for providers where:
  capabilities.cards.supported = true AND capabilities.cards.currencies includes "USD"

↓

Hard-filter out: health.status != "healthy" OR feature_flag_override = "disabled"/"deprecating"

↓

Rank remaining candidates (§3)

↓

Selected provider → passed to Adapter Layer, decision logged for audit (`08` §4)
```

## 3. Ranking algorithm — decision

**v1 (Phase 1–2, per `12`): priority-order with health as a hard gate.** Each provider has a static configured priority per product (from `03`'s entries). The highest-priority healthy provider wins. No weighting, no live scoring — this is intentionally simple because there isn't yet enough live latency/success-rate data to weight meaningfully, and a simple, auditable rule is easier to debug during early operation than a black-box score.

**v2 (Phase 3+, once real health data accumulates): weighted score** across configured priority, fees, latency (`health.latency_p50_ms`), and rolling success rate (`health.success_rate_24h`), all already tracked in the registry per `02` §2. The registry schema doesn't need to change to support this — only the ranking function does. This is deliberately designed so v2 is a routing-engine-internal upgrade, not a data-model migration.

```text
v1 rank = provider.priority (ascending, lower = preferred), filtered by health gate

v2 rank = weighted_score(priority, fees, latency_p50_ms, success_rate_24h)
          — weights configurable, not hardcoded (`11` §6 admin console)
```

## 4. Resource-affinity routing — resolved

```text
Request: "Freeze card card_a91f"

↓

Resolve ProviderMapping for card_a91f via resolveProviderMapping()
(access-controlled call defined in `07` §2 — this is the one place the
Routing Engine is permitted to look up a provider identity directly)

↓

Provider found: "bridgecard"

↓

Is bridgecard currently healthy?

  yes → route directly to BridgeCardAdapter, no ranking involved
  no  → policy: hold-and-flag (consistent with `02` §6's default for
        anything touching real money) — do NOT silently re-route a
        freeze/topup/terminate operation to a different provider than
        the one that holds the actual resource. Surface to Admin Portal
        (`11` §5) for manual resolution or wait for provider recovery.

        Exception: read-only operations (balance check, transaction
        history) may fall back to the Ledger's last-known-good state
        instead of blocking, since the Ledger is authoritative for
        historical fact regardless of current provider availability.
```

This is a deliberate asymmetry: new-resource creation can freely pick a different provider if one is unhealthy, because no resource commitment has happened yet. An existing resource cannot be silently moved — that would require the kind of provider migration process defined in `03` §4, not a routing-time decision.

## 5. Registry read contract

Confirmed as the unified schema from `02` §2 — no separate registry. Example read for the new-resource path:

```json
{
  "provider": "bridgecard",
  "capabilities": { "cards": { "supported": true, "currencies": ["USD", "NGN"] } },
  "health": { "status": "healthy", "latency_p50_ms": 240, "success_rate_24h": 0.994 },
  "feature_flag_override": null
}
```

## 6. Configurability — decision

Priority order (v1) and ranking weights (v2, once built) are stored in the same database the Provider Registry lives in, editable through the Admin Portal's Routing Dashboard (`11` §2) and Feature Flag console (`11` §6). Every change is written as an audited event (`08` §4) — who changed what, when, and the before/after values — since a routing config change is functionally a production deployment even though it doesn't go through a code release. Access to change routing config is scoped per `08` §9 to a specific permission, not general admin access.

## Resolved (was open in skeleton)

- Registry schema question → resolved upstream in `02` §2, this document just consumes it.
- Ranking algorithm → v1 priority+health-gate now, v2 weighted score later, §3.
- Resource affinity → explicit lookup path with hold-and-flag default, §4.
- Config storage and audit → database-backed, admin-editable, fully audited, §6.

## Remaining open questions

- [ ] Country-based provider override (flagged in `03` §2 for Yellow Card) — does v1's flat priority-per-product model need a country dimension, or is that a v2 concern? Recommend deciding before Stablecoin Settlement ships in Phase 4 (`12`).
- [ ] Exact weighting formula for v2 — deliberately deferred until real latency/success-rate data exists to tune against.
