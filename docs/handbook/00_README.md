# FlipTrybe Financial OS — Documentation Index

**Status:** v0.2. `02_SYSTEM_ARCHITECTURE.md` and `07_DATA_MODEL.md` are deepened; the remaining 10 are still skeletons. Deepen in the order set by `12_IMPLEMENTATION_ROADMAP.md`, not necessarily numeric order.

> **AMENDED 2026-08-06.** This status line predates the deepened v1.0 pass — as of this copy, all 12 documents plus this index carry a "Deepened v1.0" status (see `12` §"Documentation deepening"). This copy is also the one amended against the actual repo state (convergence pass, 2026-08-06) — look for `> **AMENDED 2026-08-06**` callouts throughout `02`, `03`, `05`, `06`, `07`, `10`, `11`, `12`. The original, unamended set lives at `C:\Users\ayomc\Desktop\virtual\`; this copy under `docs/handbook/` is now the one to treat as current, since it's versioned alongside the code it describes.

**Decisions made while deepening 02 and 07 (carry these into the other docs as you deepen them):**
- Provider Registry vs. Capability Registry → unified into one registry, one schema (`02` §2). `03` and `04` should be updated to reference this rather than describing two separate systems.
- Feature flags → a field on that same unified registry, not a parallel mechanism (`02` §2). `11` §6 should be updated accordingly.
- Sync vs. async API contract → hybrid grace-window pattern, single response envelope (`02` §5). `09` and `10` should build on this rather than re-deciding it.
- Saga/compensation logic → lives inside the Orchestration Layer as a shared `SagaCoordinator`, with a default hold-and-flag policy for anything touching real money (`02` §6). `06` should enumerate every multi-step operation against this pattern.
- Provider-mapping enforcement → schema separation *and* access control, both (`07` §2).
- Settlement fallback → queue, never silently reconvert currency (`07` §4).

## How to read this handbook

This is not 12 independent documents — it's one system described from 12 angles. Read in this order the first time:

1. `01_PRODUCT_VISION.md` — why this exists, what it is not
2. `02_SYSTEM_ARCHITECTURE.md` — the shape everything else has to fit
3. `07_DATA_MODEL.md` — the nouns (Account, Wallet, Card, Transfer...)
4. `03_PROVIDER_STRATEGY.md` — the providers behind those nouns
5. `04_PROVIDER_ROUTING_ENGINE.md` + `05_PROVIDER_ADAPTER_SDK.md` — how they're selected and integrated
6. Everything else, as needed for the work at hand

## Document set

| # | Document | Answers |
|---|---|---|
| 01 | Product Vision | Why are we building this? What are we explicitly not? |
| 02 | System Architecture | What's the shape of the system, top to bottom? |
| 03 | Provider Strategy | Who are the providers, and why them? |
| 04 | Provider Routing Engine | How is a provider chosen for a given request? |
| 05 | Provider Adapter SDK | What contract does every provider integration implement? |
| 06 | Financial Products | What can a user actually do? |
| 07 | Data Model | What are the entities, and who owns which fields? |
| 08 | Security & Compliance | What must never be violated? |
| 09 | API Specification | What does the API actually look like? |
| 10 | Frontend Specification | What does Flutter know, and what must it never know? |
| 11 | Admin Portal | How do humans operate and intervene in this system? |
| 12 | Implementation Roadmap | What gets built, in what order? |

## Related documents (already drafted, referenced throughout)

- **Architecture & Implementation Specification** (base spec) — golden rules, per-product provider assignments, capability registry shape.
- **Ledger, Webhook Idempotency & Adapter Contract Addendum** — the internal system of record, webhook dedup/ordering, and the adapter interface contract in code-level detail. `05_PROVIDER_ADAPTER_SDK.md` and `07_DATA_MODEL.md` should absorb this rather than duplicate it — see cross-reference notes in each.

## Two components that cut across multiple documents

**Provider Registry** — introduced in the base spec as the Capability Registry, extended with margin and richer health metrics. Lives conceptually across `03`, `04`, and `07`. **Open decision carried over from prior review: confirm this is one component with a wide schema, not two registries that can drift out of sync — resolve before deepening `04` and `07`.**

**Feature Flags** — should write into the same registry the routing engine reads (per `04`), not operate as a parallel on/off system. Resolve alongside the Provider Registry decision above before deepening `04` and `11`.

## Conventions used across all 12 documents

- **FlipTrybe IDs only** outside the adapter layer — no provider ID, provider name, or provider-shaped data structure crosses into services, API responses, or UI. Enforced concretely in `07` (data model) and `10` (frontend).
- **"Open Questions" sections** in each document are real gaps, not filler — they're the first thing to resolve when that document is deepened.
- **No document assumes a specific provider stays forever.** Any sentence that would break if a named provider were swapped out is a bug in that document.
