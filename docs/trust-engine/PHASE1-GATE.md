# Phase 1 → Phase 2 Gate

**Document:** Go/no-go checklist for advancing to Phase 2 (Image Intake).

---

## Code Review Gate

- [ ] All code reviewed by a second engineer
- [ ] No hardcoded values or magic strings
- [ ] No plaintext secrets in code
- [ ] No unused imports
- [ ] All types are non-any (TypeScript strict mode)
- [ ] Comments are minimal and meaningful
- [ ] Function complexity is reasonable (cyclomatic ≤ 5)

**Files to review:**
- `services/trust-engine/src/types.ts` — type contract
- `services/trust-engine/src/logger.ts` — logging abstraction
- `services/trust-engine/src/config/config-resolver.ts` — configuration loading
- `services/trust-engine/src/pipeline/orchestrator.ts` — pipeline coordination
- `apps/api/src/modules/trust-engine/trust-engine.service.ts` — service skeleton
- `apps/api/src/modules/trust-engine/repositories.ts` — data abstraction

---

## Test Gate

- [ ] All unit tests pass (`pnpm test` in `services/trust-engine`)
- [ ] No test warnings or deprecations
- [ ] Code coverage ≥ 80% for testable code
- [ ] Integration tests compile (mock dependencies OK)

**Run:**
```bash
cd services/trust-engine
pnpm test
```

**Expected output:**
```
Test Files  1 passed (1)
     Tests  6 passed (6)
```

---

## Compilation Gate

- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero new violations
- [ ] No import cycles detected

**Run:**
```bash
pnpm typecheck
pnpm lint
```

**Expected:**
- No output = success
- Exit code 0

---

## Architecture Gate

Verify the four key constraints:

**Provider independence:**
```bash
grep -r "providers\|PaymentGateway\|SmmSupplier" services/trust-engine/src/
```
**Expected:** No output (zero matches)

**Configuration-driven:**
```bash
grep -r "hardcode\|magic.*number\|const.*[0-9].*=" services/trust-engine/src/ | grep -v "1.0\|0–100\|0–\|100\|version"
```
**Expected:** Only version constants and scale descriptions, no policy numbers

**Fail-closed:**
```bash
grep -r "ACCEPT\|approve" services/trust-engine/src/pipeline/
```
**Expected:** Only in comments or arbiter skeleton (returning placeholder REVIEW)

**Secret redaction:**
```bash
grep -r "password\|secret\|pin\|code\|ecode" services/trust-engine/src/ --exclude-dir=node_modules | grep -v "redact\|Secret\|encrypt\|config"
```
**Expected:** Only in type names, logger redaction, and config keys

---

## Database Gate

**Schema designed:** [02-DATABASE.md](02-DATABASE.md) reviewed and approved

- [ ] All 9 tables are fully specified
- [ ] All relations are clear (FK, 1:1, 1:N)
- [ ] All indexes are justified
- [ ] Retention policies are defined
- [ ] Encryption strategy is documented

**To be added in Phase 1.5:**
- [ ] Schema added to `packages/database/prisma/schema.prisma`
- [ ] `pnpm prisma:generate` runs without errors
- [ ] Migration file created and reviewed
- [ ] Types updated in `packages/types/`

---

## Feature Flag Gate

- [ ] `trustEngine: false` added to `packages/feature-flags/src/index.ts`
- [ ] `trustEngineAdmin: false` added
- [ ] Feature flags tested (toggle without deploy works)
- [ ] Flag guarding in `TrustEngineService` verified

**Test:**
```bash
# With trustEngine: false, the endpoints should return 403
curl -X POST http://localhost:3000/trust/v1/submissions \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"assetClass":"GIFT_CARD",...}'
```
**Expected:** 403 or Feature not enabled error

---

## Queue Gate

- [ ] `trust-engine` queue added to `apps/worker/src/queues.ts`
- [ ] `TrustEngineValidationJob` interface defined
- [ ] Added to `QueuePayloads` type
- [ ] Runtime policy defined (concurrency, retry, retention)
- [ ] Worker can start without errors

**Test:**
```bash
pnpm --filter @fliptrybe/worker test
```

---

## Module Wiring Gate

- [ ] `TrustEngineModule` created
- [ ] All repositories are injectable
- [ ] Service is exported for other modules
- [ ] Module is registered in `app.module.ts`
- [ ] App starts without errors

**Test:**
```bash
cd apps/api
pnpm build
```
**Expected:** No type errors, build succeeds

---

## Decision Gate

**All five Phase 0 decisions must be resolved:**

- [ ] **D1 — Submission model:** Generic `AssetSubmission` with discriminator? **Decision:** ___________
- [ ] **D2 — Inference provider:** Hybrid / cloud-only / self-hosted? **Decision:** ___________
- [ ] **D3 — Submission flow:** Async (two-step) or sync (inline)? **Decision:** ___________
- [ ] **D4 — Data retention:** 90/180 days? Compliance review done? **Decision:** ___________
- [ ] **D5 — Plaintext card info fix:** Implement now in separate PR? **Decision:** ___________

**Each decision must have:**
- A clear choice (not "TBD")
- Written justification in ADR format
- Stakeholder sign-off documented

**If ANY decision is unresolved, Phase 2 is BLOCKED.**

---

## Risk Gate

- [ ] No high-risk issues in code review
- [ ] No security concerns (no plaintext secrets, no SQL injection vectors, no XSS)
- [ ] No performance red flags (N+1 queries, unbounded loops)
- [ ] Logging strategy approved (audit + user events both covered)

---

## Documentation Gate

- [ ] Phase 0 docs (PRD, architecture, DB, API, config) are complete
- [ ] Phase 1 completion report written
- [ ] 20-ROADMAP.md specifies all phases 2–16
- [ ] CLAUDE.md updated with Trust Engine commands (if applicable)

---

## Sign-Off

| Role | Sign-off | Date |
|---|---|---|
| Tech Lead | _____ | ___ |
| Product Manager | _____ | ___ |
| Security | _____ | ___ |
| Ops | _____ | ___ |

---

## Phase 2 Readiness Checklist

Once all gates pass, Phase 2 is unblocked:

- [ ] Phase 1 code merged to main
- [ ] Phase 1.5 database schema merged to main
- [ ] All open decisions (D1–D5) documented
- [ ] Phase 1.5 migration tested locally
- [ ] `IntakeStage` skeleton created (file exists, throws "not implemented")
- [ ] Phase 2 branch created and ready for work

**Phase 2 start date:** ___________

---

## What blocks Phase 2

**Hard blockers** (must resolve before Phase 2):
- Code review failures
- Test failures
- Unresolved decisions D1–D5
- Schema not ready

**Soft blockers** (nice to have first, but doesn't block):
- D2 inference provider not finalized (can use mock first, integrate later)
- Sogo sandbox credentials not ready (can mock in Phase 2, use mock in Phase 12)

---

## Escalation path

If a gate fails:

1. **Document the issue** (in a GitHub issue or Slack thread)
2. **Propose a solution** (fix, workaround, or defer)
3. **Get stakeholder approval** (who depends on this?)
4. **Implement or defer** (do not proceed with a failed gate unless explicitly approved)

Example escalation:
> Gate: Code review found hardcoded API key in config-resolver.ts
> Issue: #123
> Solution: Use env var instead; PR #999 proposed
> Stakeholder: @devlead approved
> Action: Merge PR #999, re-run gate
