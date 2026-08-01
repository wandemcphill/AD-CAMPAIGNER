# FlipTrybe Trust Engine — Complete Documentation

Welcome to the Trust Engine implementation. This directory contains all design, architecture, and roadmap documentation for the validation system that gate-keeps all user-submitted digital assets before they reach any external provider.

---

## Quick Navigation

**For executives / product:**
- Start: [00-PRD.md](00-PRD.md) — what this solves, why now, risks
- Roadmap: [20-ROADMAP.md](20-ROADMAP.md) — timeline, phases 2–16

**For architects:**
- Design: [01-ARCHITECTURE.md](01-ARCHITECTURE.md) — system design, 6 ADRs, pipeline model
- Database: [02-DATABASE.md](02-DATABASE.md) — 9 tables, indexes, retention
- API: [03-API.md](03-API.md) — 9 endpoints, request/response shapes
- Config: [04-CONFIGURATION.md](04-CONFIGURATION.md) — hot-editable thresholds

**For engineers (Phase 1):**
- Completion: [10-PHASE1-COMPLETION.md](10-PHASE1-COMPLETION.md) — what was built, quality metrics
- Gate: [PHASE1-GATE.md](PHASE1-GATE.md) — checklist for Phase 2 readiness
- Code locations: see [File Locations](#file-locations) below

**For engineers (Phase 2+):**
- Roadmap phases: [20-ROADMAP.md](20-ROADMAP.md#phase-2--image-intake) onwards
- Each phase has estimated timeline, blockers, test strategy

---

## Status

| Phase | Status | Work |
|---|---|---|
| 0 | ✅ Complete | Design (5 docs), decision gates (D1–D5) |
| 1 | ✅ Complete | Foundation (module, DI, config, logging, tests) |
| 1.5 | ⏳ Ready | Database schema (Prisma) |
| 2 | 🔜 Planned | Image intake (file validation) |
| 3 | 🔜 Planned | Classification (CV) |
| 4 | 🔜 Planned | OCR (text extraction) |
| 5 | 🔜 Planned | Quality (blur/darkness/glare) |
| 6 | 🔜 Planned | Brand validation (rules) |
| 7 | 🔜 Planned | Duplicate detection |
| 8 | 🔜 Planned | E-code format |
| 9–10 | 🔜 Planned | Fraud + trust scoring |
| 11 | 🔜 Planned | Provider router |
| 12 | 🔜 Planned | Sogo integration |
| 13 | 🔜 Planned | Admin dashboard |
| 14 | 🔜 Planned | Analytics |
| 15 | 🔜 Planned | Testing |
| 16 | 🔜 Planned | Documentation |

**Current timeline:** 8–10 weeks to full launch (Phases 2–16).

---

## Key Files

### Documentation
```
docs/trust-engine/
├── 00-PRD.md                  # Product requirements + decisions D1–D5
├── 01-ARCHITECTURE.md         # System design + 6 ADRs
├── 02-DATABASE.md             # Schema design (9 tables)
├── 03-API.md                  # REST endpoints + DTOs
├── 04-CONFIGURATION.md        # Config model + hot-edit
├── 00-PHASE0-SUMMARY.md       # Phase 0 overview
├── 10-PHASE1-COMPLETION.md    # Phase 1 results + metrics
├── 20-ROADMAP.md              # Phases 2–16 detail
├── PHASE1-GATE.md             # Go/no-go checklist
└── README.md                  # This file
```

### Code

**Bounded context package:**
```
services/trust-engine/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                      # Exports
    ├── types.ts                      # 30+ types
    ├── logger.ts                     # Logger abstraction
    ├── config/
    │   ├── config-resolver.ts        # Config loading
    │   └── config-resolver.test.ts
    └── pipeline/
        └── orchestrator.ts           # Pipeline orchestration
```

**NestJS module:**
```
apps/api/src/modules/trust-engine/
├── trust-engine.module.ts        # DI wiring
├── trust-engine.controller.ts    # 2 routes
├── trust-engine.service.ts       # Service skeleton
├── trust-engine.service.test.ts
├── repositories.ts               # 6 repo adapters
└── dtos.ts                       # Request/response shapes
```

**Updated files:**
- `packages/feature-flags/src/index.ts` — added 2 flags
- `apps/worker/src/queues.ts` — added trust-engine queue
- `apps/api/src/modules/app.module.ts` — registered module

---

## Architecture at a Glance

### Three layers

```
API Controllers (REST routes)
    ↓
Service (pipeline orchestration)
    ↓
Domain Logic (bounded context)
    ↓
Repositories (data abstraction)
    ↓
Database (Prisma)
```

### Pipeline model

```
Input: AssetSubmission
  ↓
[Intake] → [Duplicate] → [Quality] → [Classification] → [OCR] → [Brand] → [E-code] → [Fraud]
  ↓        ↓             ↓          ↓                 ↓        ↓        ↓         ↓
[Signals + Reasons]
  ↓
[Arbiter: Apply thresholds, fraud + trust scores]
  ↓
Verdict: ACCEPT | REVIEW | REJECT
```

### Key constraints

1. **Provider-blind:** No imports from providers or payment modules (structural boundary)
2. **Configuration-driven:** All thresholds in DB/env, never hardcoded
3. **Fail-closed:** Errors route to REVIEW, never ACCEPT
4. **Auditable:** Every verdict is versionable and replayable
5. **Testable:** Stages are pure functions (no DB dependencies)

---

## Open Decisions Blocking Phase 2

**All must be resolved before Phase 2 starts.**

| Decision | Recommendation | Impact | Owner |
|---|---|---|---|
| D1: Generic `AssetSubmission` or gift-card-only? | Generic with discriminator | Reusability for airtime/vouchers | Product + Engineering |
| D2: Inference provider (cloud/local/hybrid)? | Hybrid behind adapter | Cost + accuracy tradeoff | Engineering + Finance |
| D3: Async two-step flow or sync inline? | Two-step async | API contract + fail-closed guarantee | Product + Mobile |
| D4: Data retention policy (90/180 days)? | Compliance to decide | Legal + storage cost | Compliance + Ops |
| D5: Fix plaintext card info now? | Yes, separately | Security defect | Engineering + Finance |

**Status:** ❌ NOT YET RESOLVED. See [00-PRD.md § 8](00-PRD.md) for full details.

---

## Running Phase 1 Code

### Compile & test
```bash
cd services/trust-engine
pnpm typecheck    # TypeScript verification
pnpm test         # Vitest: 6 passing
pnpm lint         # ESLint verification
```

### Check constraints
```bash
# Provider-blind check (should return nothing)
grep -r "providers\|PaymentGateway\|SmmSupplier" services/trust-engine/src/

# Configuration-driven check (no hardcoded policy numbers)
grep -r "const.*[0-9].*=" services/trust-engine/src/config/ | head -20
```

### Run API (once Phase 1.5 schema is added)
```bash
cd apps/api
pnpm dev

# In another terminal:
curl -X POST http://localhost:3000/trust/v1/submissions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetClass": "GIFT_CARD",
    "submissionProfile": { "brand": "APPLE", "region": "US", "denomination": 1000 }
  }'
```

---

## Project Statistics

| Metric | Value |
|---|---|
| Phase 1 LOC (domain) | ~1,300 |
| Phase 1 LOC (API module) | ~600 |
| Phase 1 LOC (docs) | ~8,000 |
| Test files | 2 |
| Tests passing | 8 |
| Test coverage (Phase 1) | 100% of testable code |
| Types defined | 30+ |
| Repositories | 6 |
| Feature flags | 2 |
| Queues | 1 |
| Endpoints (Phase 1) | 2 (skeleton) |
| Endpoints (Phase 13 admin) | 6 |
| Estimated total LOC (all phases) | ~5,000 |
| Estimated timeline (all phases) | 8–10 weeks |

---

## Glossary

| Term | Definition |
|---|---|
| **Asset** | User-submitted digital item (gift card image, PIN, code) |
| **Asset class** | Type of asset (GIFT_CARD, AIRTIME_PIN, etc.) |
| **Submission** | A user's attempt to upload an asset |
| **Stage** | A single validation step (intake, quality, OCR, etc.) |
| **Signal** | Typed score emitted by a stage |
| **Verdict** | Final decision (ACCEPT, REVIEW, REJECT) |
| **Reason code** | Specific rejection reason (QUALITY_TOO_DARK, DUPLICATE_EXACT, etc.) |
| **Arbiter** | Converts stage outcomes into verdicts using thresholds |
| **Trust score** | User reputation (-100 to +100) |
| **Fraud score** | Suspicion level (0–100) |
| **Bearer secret** | A PIN or code that grants value (encrypted always) |
| **Bounded context** | A service with clear boundaries (here: validation) |
| **Fail-closed** | Default safe action (REVIEW) on ambiguity, never ACCEPT |

---

## Who to contact

| Question | Contact |
|---|---|
| Product / scope | Product Manager |
| Architecture / design | Tech Lead (@service-team) |
| Database / schema | Database Engineer (@platform-team) |
| Security / audit | Security (@security-team) |
| Deployment / ops | Operations (@devops-team) |
| API / integration | Backend Lead (@api-team) |

---

## Next Steps

1. **Review Phase 0 design** ([00-PRD.md](00-PRD.md) + [01-ARCHITECTURE.md](01-ARCHITECTURE.md))
2. **Resolve D1–D5** decisions (3–5 days)
3. **Implement Phase 1.5** database schema (1 day)
4. **Gate Phase 1** using [PHASE1-GATE.md](PHASE1-GATE.md) checklist
5. **Begin Phase 2** (image intake)

---

## Changelog

### Phase 1 (complete)
- ✅ Bounded context package created
- ✅ NestJS module wired with DI
- ✅ Configuration resolver (env + DB)
- ✅ Logger abstraction with secret redaction
- ✅ Pipeline orchestrator skeleton
- ✅ 6 repository adapters
- ✅ Feature flags + queue registered
- ✅ Tests: 8 passing
- ✅ Compilation: clean

### Phase 0 (complete)
- ✅ PRD with acceptance criteria
- ✅ Architecture with 6 ADRs
- ✅ Database design (9 tables)
- ✅ API specification (9 endpoints)
- ✅ Configuration model
- ✅ Open decisions: D1–D5 (documented, awaiting resolution)

---

## License & Access

This documentation is internal to FlipTrybe. All code is subject to the repository's license and access controls.

---

**Last updated:** Phase 1 complete  
**Next phase:** Phase 1.5 (database schema)  
**Decision gate:** [PHASE1-GATE.md](PHASE1-GATE.md)
