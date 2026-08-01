# Phase 0 — Design Review Summary

**Status:** Ready for stakeholder review and sign-off.
**Timeline:** Design only; no code written in Phase 0. Phase 1 begins after D1–D5 are resolved.

---

## Deliverables

Phase 0 has produced five design documents:

1. **[00-PRD.md](00-PRD.md)** — Product Requirements Document
   - Purpose, scope, goals, non-goals, stakeholders
   - Acceptance criteria (A1–A11)
   - Five open decisions requiring sign-off (D1–D5)
   - Risks and mitigations

2. **[01-ARCHITECTURE.md](01-ARCHITECTURE.md)** — System Architecture
   - Position in the platform (bounded context in-process)
   - Pipeline model with six architectural decision records (ADR-001 through ADR-006)
   - Concurrency, idempotency, and failure modes
   - Secret handling for PINs and e-codes
   - Package boundaries

3. **[02-DATABASE.md](02-DATABASE.md)** — Database Design
   - Eight new tables: `AssetSubmission`, `SubmissionSecret`, `ValidationRun`,
     `StageResult`, `Signal`, `OcrResult`, `ImageQualityResult`, `BrandRuleSet`,
     `ModerationQueue`
   - Reuses existing: `MediaAsset`, `AuditLog`, `ProviderConfig`, `ProviderRoutingAttempt`
   - Indexes and retention policies
   - No tables from the brief are created; rationale in ADR-002

4. **[03-API.md](03-API.md)** — API Specification
   - Nine endpoints: intake, status, admin detail, moderation queue, override, secret
     reveal, config management, analytics
   - Error responses, idempotency, rate limiting
   - DTOs and implementation notes

5. **[04-CONFIGURATION.md](04-CONFIGURATION.md)** — Configuration Model
   - Three configuration layers: global (env vars), workspace (DB), feature flags
   - Brand rule sets, quota policies, versioning strategy
   - Hot-editable config for ops without deploys
   - Export/import for environment promotion

---

## What Phase 0 establishes

### Architectural constraints

- ✅ Trust Engine is a **bounded context**, not a microservice — runs in-process in
  `apps/api` and `apps/worker`.
- ✅ Trust Engine is **provider-blind** — no imports from `@fliptrybe/providers` adapter
  implementations, enforced by ESLint boundary rule.
- ✅ Trust Engine is **asset-class agnostic** — `AssetSubmission` discriminator + per-class
  profile rows, not a gift-card-specific table.
- ✅ Trust Engine is **fail-closed** — `INCONCLUSIVE` is a distinct status; defaults to
  `REVIEW`, never `ACCEPT`.
- ✅ Trust Engine is **config-driven** — no hardcoded thresholds; every limit and format
  is a DB row or env var.
- ✅ Trust Engine is **fully auditable** — every verdict is versionable and replayable;
  config versions are stamped on runs.

### What is NOT in scope

- Trust Engine does not talk to providers (Sogo, Cardtonic, etc.).
- Trust Engine does not move money or interact with `LedgerEntry`.
- Trust Engine does not guarantee card value — only format and integrity.
- Trust Engine does not own KYC — it reads `KycTier` as a signal but never writes it.
- Trust Engine does not notify users — it emits events; notification service decides.

### Package layout

```
services/trust-engine/                 domain logic, no Nest, no Prisma
  src/pipeline/
  src/stages/
  src/scoring/
  src/config/
apps/api/src/modules/trust-engine/    Nest module, repository impls, controllers
packages/types/                        AssetSubmission, Verdict, Signal, etc.
packages/providers/                    AssetInferenceAdapter + implementations
```

---

## Five decisions blocking Phase 1

**All five must be resolved and documented before implementation starts.**

### D1 — Submission model architecture

**Question:** Generic `AssetSubmission` with a discriminator, or gift-card-specific
`GiftCardSubmission`?

**Recommendation:** Generic with `assetClass` discriminator + per-class profile rows.

**Trade-off:** Slightly more indirection on gift-card queries today (a `JOIN` to the
profile) vs. impossible reuse for airtime/vouchers/documents/KYC later.

**Cost:** One discriminator column + six per-class profile rows eventually (not all
in Phase 1).

**Rejection:** If this is rejected and a gift-card-specific table is chosen, the
roadmap in PRD §7 and acceptance criterion A7 become unachievable. The system will
be redesigned at wave 2 when the second asset class arrives.

**Sign-off required from:** Product (FlipTrybe vision), Engineering (onboarding cost),
Sogo liaison (does it change what they see? no — it's internal).

---

### D2 — Inference provider for classification, OCR, and quality

**Question:** Cloud vision API (Google / Anthropic), self-hosted model, or hybrid
(cheap local heuristics first, cloud on ambiguity)?

**Options:**

| Option | Latency | Cost/call | Data leaves NG | Flexibility |
|---|---|---|---|---|
| Cloud-only | 2–4s | $0.02–0.10 | Yes | High |
| Self-hosted | 1–2s | ~$0 | No | Medium (fixed model) |
| Hybrid (recommended) | 1–4s depending on path | ~$0.001–0.05 | Partial | Very high |

**Recommendation:** Hybrid, behind an `AssetInferenceAdapter` interface (matches
existing adapter pattern in `@fliptrybe/providers`). Start with local heuristics for
classification (size, aspect ratio, basic content checks), cheap edge-detection for
quality; escalate to cloud only on ambiguity.

**Trade-off:** Local heuristics are less accurate than cloud vision but cover 95% of
the abuse patterns and cost nothing. Cloud is a fallback, not the default.

**Cost ceiling:** Operations must define a monthly budget ceiling in `TRUST_ENGINE_MONTHLY_BUDGET_MICRO`. Recommend starting at 1M micro units (~₦2.5k/month at typical rates).

**Sign-off required from:** Finance (budget ceiling), Engineering (adapter pattern
is standard but requires careful isolation), Operations (ops maintenance burden).

---

### D3 — Submission flow: synchronous or asynchronous?

**Question:** Caller waits for verdict inline, or submission becomes a two-step
(create → poll/subscribe)?

**Current pattern:** `submitGiftCardSell()` (digital-value.service.ts:154) calls
provider directly inline.

**Option A — Inline (current pattern):**
```
POST /digital-value/gift-cards/sell
├─ create GiftCardSellTransaction
├─ call TrustEngine.validate() inline
├─ if ACCEPT, call provider.submitCard()
└─ return verdict + provider response
```
- Pro: Simple, no polling.
- Con: Mobile client blocks on 8s pipeline; pipeline failure blocks money flow.

**Option B — Two-step (recommended):**
```
POST /digital-value/gift-cards/submit
├─ create AssetSubmission
├─ return submissionId immediately
└─ enqueue pipeline (async)

GET /digital-value/gift-cards/status/{submissionId}
├─ poll until status terminal
└─ on ACCEPT, proceed to submit-to-provider step
```
- Pro: Mobile acks fast; failure is isolated; A10 (fail-closed) is easy.
- Con: Adds polling loop; UI complexity; changes API contract.

**Recommendation:** Two-step. Non-negotiable for A10 (system failure → manual review, never
silent accept). Inline makes that nearly impossible because pipeline failure occurs
inside a transaction that has already decided to pay.

**Impact:** Changes `DigitalValueService.submitGiftCardSell()` flow. The domain service
no longer calls the trust engine directly; instead, it watches for `submission_accepted`
events from the queue.

**Sign-off required from:** Product/Mobile (API contract change), Backend (changes
digital-value service), DigitalAccess service (similar pattern for other verticals).

---

### D4 — Data retention and compliance

**Question:** How long do we keep images, codes, and audit logs?

**Proposal:**
- Accepted submissions: images deleted after 90 days, secrets after 30 days, hashes +
  audit retained forever.
- Rejected submissions: same as accepted + reason codes retained forever.
- Disputed submissions: never auto-deleted; audit-locked until resolved + 180 days.
- Audit logs: never deleted; retention compliance is legal responsibility.

**Trade-off:** Longer retention = more storage + more PII at risk. Shorter = less
evidence for fraud rings and duplicate detection.

**Recommendation:** Align with FlipTrybe's data retention policy (contact compliance).
Default proposal assumes GDPR-adjacent approach; if targeting Nigeria-only, can extend
to 180+ days.

**Sign-off required from:** Compliance / Legal (retention policy), Operations (storage
costs).

---

### D5 — Fix plaintext card info defect now or as part of Phase 2?

**Issue:** `digital-value.service.ts:183` stores raw `cardInfo: dto.cardInfo` in
metadata JSON:

```ts
metadata: { cardInfo: dto.cardInfo }  // ← PIN in plaintext!
```

**Question:** Fix this before Phase 0 ends, or as part of Phase 2 intake?

**Recommendation:** Fix **now, separately**. It is a live defect independent of the Trust
Engine programme.

**Scope of fix:**
1. Add `SubmissionSecret` table (already designed in 02-DATABASE.md).
2. In `DigitalValueService.submitGiftCardSell()`, extract the secret from `dto.cardInfo`
   and store it encrypted in `SubmissionSecret` instead of plaintext metadata.
3. Update digital-value DTOs to accept a secret parameter separately.
4. Audit all reads of `GiftCardSellTransaction.metadata` to ensure no secret leakage.

**Timeline:** One commit, one sprint. Blocks Trust Engine going live (can't trust a
system that stores the asset it's supposed to validate insecurely).

**Sign-off required from:** Finance (brief downtime for migration if `GiftCardSellTransaction`
data exists), Backend (code review).

---

## Timeline

| Phase | Work | Est. duration |
|---|---|---|
| 0 | Design | ✅ Done (this doc) |
| 0.5 | **D1–D5 resolution** | **2–5 days** — blocking decision |
| 1 | Foundation (module, DI, logging, config loading, tests) | 3 days |
| 2 | Image intake (upload, file type, validation) | 4 days |
| 3 | Classification (mock first, inference adapter shape) | 5 days |
| 4 | OCR | 4 days |
| 5 | Image quality | 4 days |
| 6 | Brand validation | 2 days |
| 7 | Duplicate detection | 3 days |
| 8 | E-code format validation | 2 days |
| 9 | Fraud scoring + trust scoring | 5 days |
| 10 | Trust score (continuation of 9) | 2 days |
| 11 | Provider router integration | 3 days |
| 12 | Sogo integration | 4 days |
| 13 | Admin dashboard | 5 days |
| 14 | Analytics | 3 days |
| 15 | Full test suite + performance | 6 days |
| 16 | Documentation + launch readiness | 3 days |
| **Total** | | **~60 engineer-days** |

---

## Success criteria for Phase 0 sign-off

Phase 0 is complete when:

1. ✅ PRD, architecture, database, API, and configuration documents are written.
2. ✅ All architectural constraints are documented and understood.
3. ✅ All non-goals are stated explicitly.
4. ❌ **All five open decisions (D1–D5) are resolved and documented.**
5. ❌ **Code for D5 (plaintext card info fix) is committed and tested.**
6. ❌ Prisma schema additions are reviewed (no code generated yet; just review the design).

---

## Next step

**Required action:** Review this summary + the five design documents. For each of D1–D5:

1. **Confirm the recommendation** or propose an alternative with rationale.
2. **Document the decision** in a commit message or a separate ADR file.
3. **Note any constraints** that were not captured in this design.

Once all five are resolved, Phase 1 can begin immediately. The foundation phase (module
setup, DI, logging, test framework) has no dependencies on feature decisions — it can
run in parallel with remaining design questions if needed.

---

## Glossary

| Term | Definition |
|---|---|
| **Verdict** | Final decision: `ACCEPT` \| `REVIEW` \| `REJECT` |
| **Reason code** | A specific rejection reason: `QUALITY_TOO_DARK`, `DUPLICATE_EXACT`, etc. |
| **Signal** | A typed score emitted by a stage, consumed by the fraud model |
| **Stage** | A single validation step: intake, duplicate, quality, classify, OCR, etc. |
| **Config version** | Stamped on every run for replay safety and audit |
| **Asset class** | The type of submission: `GIFT_CARD`, `AIRTIME_PIN`, etc. |
| **Bearer secret** | A PIN or code that grants value; treated as encrypted always |
| **Fail-closed** | Default to `REVIEW` / manual on ambiguity, never `ACCEPT` |
| **Bounded context** | A service that owns a domain (here: validation) with clear boundaries |
