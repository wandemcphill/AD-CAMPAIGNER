# 12 — Implementation Roadmap

**Status:** Deepened v1.0. Resolves the Future Expansion placement and Phase 1 Admin Portal scope questions carried from the skeleton.

> **AMENDED 2026-08-06 (repo convergence) — the phasing below is superseded.** This roadmap was written phase-ordered as if for a greenfield build: core banking (Phases 2–5) before the "Future Expansion" digital products (Phase 7+). The actual repo inverts that — Gift Cards, Virtual Numbers, VTU/Airtime, Utility Bills are built and shipping; Accounts, Cards, and Remittance did not exist in code until 2026-08-06 and remain mock-only pending provider diligence. See **"Resequenced roadmap (repo convergence)"** below for what's actually true today. The rest of this document (team roles, cross-cutting prerequisites, the punch list) is left as originally written except where individually annotated.

## Resequenced roadmap (repo convergence, 2026-08-06)

Replacing the phase ordering below (kept intact further down for historical reference — do not resequence work against it, use this section instead):

- **Phase A — Contract hardening (done).** `ProviderAdapterBase` + `AdapterErrorCode` taxonomy (`05` §1/§3, as amended) and `SagaCoordinator`/`runChargeSaga` (`02` §6, `packages/payments/src/saga.ts`) exist and are used by VTU, Virtual Numbers, Digital Access, Gift Card purchase, Virtual Cards, and Remittance.
- **Phase B — API contract (done).** Response envelope + grace window (`09` §1, `apps/api/src/modules/grace-window.ts`) live on Virtual Numbers and Digital Access as the proven verticals; not yet rolled to every mutating endpoint. Resource-affinity routing (`04` §4, `selectAffinityProvider()` in `packages/providers/src/router.ts`) exists and is wired into Virtual Numbers' renewal path; not yet wired elsewhere.
- **Phase C — Ops safety (mostly done).** Dual-approval gate (`11` §5, as amended) exists and is wired into Digital Access refunds; not yet wired into VTU's `adminResolveOrder`. Provider emergency-disable (`11` §6, as amended) is done.
- **Phase D — Digital product completion (done).** Gift Cards (buy + sell), Airtime Cashout, Bills (electricity/cable/betting/education), Crypto sell, RMB buy are all live behind `packages/feature-flags` — flipped on, not gated behind live credentials, per an explicit product decision to ship digital products ahead of financial-product diligence.
- **Phase E — Financial products (skeleton only, mock-backed).** Virtual Accounts, Virtual Cards, and Remittance exist as a full stack (`apps/api/src/modules/financial-products`, `packages/providers/src/financial-products.ts`) built against mock adapters. **No real provider is contracted** — this is the genuine blocker, not code; see `03`'s amendment for the actual diligence list (BridgeCard/SwervPay/Payceler/Nium/Swan/BVNK).
- **Deferred, explicitly, same as before:** `ProviderMapping` full migration (`07` §2, as amended — the table and a backfill script exist as of 2026-08-06; removing the inline columns and DB-role separation are not started), analytics/trending store (`11`'s open question, unchanged), external partner webhooks (`09` §5, unchanged).

This means: **Phase 1 and the "cross-cutting work that must exist before Phase 2" section below are effectively already complete** (Ledger, Provider Registry, Webhook Gateway all exist and are in active use) — the roadmap's starting line was behind where the code actually is even at v1.0's writing. Stablecoin (original Phase 4) and Business accounts/KYB (original Phase 5) remain entirely unbuilt, same as Accounts/Cards/Remittance — all four are blocked on the same category of provider/compliance diligence, not sequencing.

## Purpose

Sequences the build so nothing gets attempted before its dependencies exist. Never build everything at once.

## Documentation deepening — now complete for all 12 documents

All 12 documents plus this index have moved from skeleton to deepened. The decisions made along the way, and where each lives:

| Decision | Where resolved |
|---|---|
| Target market / mission (recommended default) | `01` §1/§3 |
| Provider Registry unified into one schema | `02` §2 |
| Feature flags as a registry field, not a parallel system | `02` §2, `11` §6 |
| Sync/async API contract — hybrid grace-window | `02` §5, `09` §1 |
| Saga/compensation pattern — `SagaCoordinator`, hold-and-flag default | `02` §6, applied per-product in `06` |
| Provider-mapping enforcement — schema + access control | `07` §2 |
| Settlement fallback — queue, never silent reconversion | `07` §4 |
| Data classification first pass | `07` §5 |
| Provider entries and selection/deprecation process | `03` |
| Resource-affinity routing | `04` §4 |
| Adapter directory structure and onboarding checklist | `05` §6/§7 |
| Full product state machines and saga list | `06` |
| Cross-provider AML/fraud layer, audit log split, permissions | `08` §2/§4/§9 |
| API versioning, auth, error format | `09` §4/§6/§7 |
| Pending-state UI pattern, error-to-UI mapping, offline behavior | `10` §2/§3/§4 |
| Dual-approval rules for manual interventions | `11` §5 |

Several documents still carry genuine open questions (marked in each) that need non-technical input — target market confirmation, provider commercial diligence, legal/compliance review, and a couple of explicit technology-choice confirmations (backend runtime, Flutter state management library). These are listed again in §5 below as a single consolidated punch list.

## Build phases

### Phase 1 — Foundation
- Authentication (`09` §7 JWT/refresh scheme)
- Users (`07` §1 `User` entity, KYC status tracking per `08` §1)
- Financial Hub shell (`10` §2's pending-state pattern built here, even before real financial data flows, so it's proven out early)
- **Decision (resolves skeleton's open question):** a bare-bones Admin Portal view — just the Provider Dashboard (`11` §1) and Health Dashboard (`11` §3), read-only, no intervention tools yet — ships in Phase 1, not deferred to after Phase 6. Reasoning: Phase 2 starts moving real money; operating that blind, with zero visibility into provider health, is an avoidable risk for the sake of sequencing convenience.

### Phase 2 — Core banking
- Accounts (`06` §1)
- Cards (`06` §3)
- **Prerequisite, not optional:** Internal Ledger and Webhook Gateway (addendum) must exist before Phase 2 ships to real users — this was already flagged as cross-cutting, restated here as a hard gate, not a nice-to-have.
- Full manual intervention tools (`11` §5) should land by the end of this phase, given Refund becomes a live capability the moment real balances exist.

### Phase 3 — Movement of money
- Remittance (`06` §4)
- FX (`06` §4's quote/lock mechanics)
- v2 weighted routing (`04` §3) is reasonable to start here — enough live latency/success-rate data should exist by this point to make weighting meaningful, versus guessing at weights in Phase 1.

### Phase 4 — Stablecoin
- USDT/USDC settlement (`06` §5)
- This is the point the cross-provider AML layer (`08` §2/§8) most needs to be genuinely operational, not just designed — stablecoin on/off-ramp is the highest AML-sensitivity product in the catalog.

### Phase 5 — Business
- Business accounts (`06` §1), KYB flow (`08` §1's `kyb_pending` sub-state)

### Phase 6 — Marketplace
- Marketplace surface
- This is the earliest point external/partner webhooks (`09` §5, deferred in v1) become worth revisiting — only if a concrete partner integration is actually scoped here, not speculatively ahead of need.

### Phase 7+ — Future Expansion (resolved placement)

**Decision (resolves skeleton's open question):** Gift Cards, eSIM, Virtual Numbers, VPN, AI, Airtime, Utility Bills, Streaming, Cloud Credits (`06` §6) are explicitly **not** part of Phases 1–6. They begin only after Phase 6, re-scoped individually against the same Provider Adapter + Routing Engine pattern once the core financial products have real production experience behind them. Reasoning: these products are lower-stakes individually (mostly single-step, per `06` §6) but numerous — sequencing them before the core financial stack is stable would dilute focus on the harder, higher-stakes work in Phases 2–5.

## Cross-cutting work that isn't a phase but must exist before Phase 2

- Internal Ledger (addendum) — before Phase 2
- Webhook Gateway + idempotency/dedup (addendum) — before Phase 2
- Provider adapter conformance test suite (`05` §8) — before the second provider adapter is built, so the pattern is validated with two real implementations, not just designed in the abstract

## Team roles mapped to phases

| Role | Phase 1 focus | Ongoing required reading |
|---|---|---|
| Chief Solutions Architect | Owns `02`, `07`; signs off on every subsequent document's open decisions | All 12, especially anything touching the registry/ledger/saga pattern |
| Backend Lead | Ledger, Webhook Gateway, Orchestration Layer skeleton, first two adapters (`05`) | `02`, `04`, `05`, `06`, `08` |
| Flutter Lead | `10` in full, especially §1 service layer and §2 pending-state component, before any screen work starts | `09` (response envelope), `10` |
| DevOps Lead | Secrets vault (`08` §6), backend runtime confirmation (`05` §1 open question), CI wiring for the conformance suite (`05` §8) | `02` supporting systems, `08` |
| QA & Reliability Lead | Provider simulators (`05` §6) built alongside each Phase 1/2 adapter, not after | `05`, `06` (saga failure modes to test against) |

## Resolved (was open in skeleton)

- Future Expansion placement → explicit Phase 7+, §"Phase 7+" above.
- Phase 1 Admin Portal scope → bare-bones read-only dashboards ship in Phase 1, §"Phase 1" above.

## Consolidated punch list — every remaining open question across all 12 documents

- [ ] `01` — target market/mission confirmation from product/business leadership
- [ ] `03` — provider diligence data (countries, weaknesses, commercial terms) for every TBD field
- [ ] `04` — country-based routing override for Stablecoin (Yellow Card) before Phase 4
- [x] `05` — backend language/runtime confirmation — **confirmed 2026-08-06**: NestJS on Node.js/TypeScript
- [ ] `06` — quote expiry window per remittance corridor; confirm Future Expansion single-step assumption once each product is scoped
- [ ] `08` — formal legal/compliance review of the entire document; exact audit-log retention period; refine the permissions role table against the real org
- [ ] `09` — full per-endpoint documentation as each is implemented; OpenAPI generation once the endpoint set stabilizes
- [x] `10` — client platform confirmed 2026-08-06 as **Next.js**, not Flutter — Riverpod question voided, see `10`'s amendment
- [ ] `11` — historical trending/analytics data source, not yet addressed anywhere in the handbook
