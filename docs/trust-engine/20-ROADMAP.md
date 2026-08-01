# Trust Engine — Implementation Roadmap

**Current Status:** Phase 1 complete. Ready for Phase 1.5 (database) → Phase 2 (intake).

---

## Phase 1.5 — Database Schema Addition

**Objective:** Add 8 new tables to Prisma schema without changing any code.

**Work:**
1. Add to `packages/database/prisma/schema.prisma`:
   - `AssetSubmission` (discriminated union by `assetClass`)
   - `SubmissionSecret` (encrypted PINs/codes)
   - `ValidationRun` (pipeline execution record)
   - `StageResult` (individual stage outcome)
   - `Signal` (typed score from a stage)
   - `OcrResult` (extracted text)
   - `ImageQualityResult` (blur/darkness/glare metrics)
   - `BrandRuleSet` (configuration by brand)
   - `ModerationQueue` (human review queue)

2. Add relations to existing tables:
   - `MediaAsset.assetSubmissions`, `.ocrResults`, `.qualityResults`
   - `User.assetSubmissions`
   - `Workspace.assetSubmissions`

3. Run `pnpm prisma:generate`

4. Update `packages/types/` with Prisma-generated types

**Schema is 100% designed** in [02-DATABASE.md](02-DATABASE.md). Copy-paste from there.

**Estimated:** 1 day (mostly mechanical)

**Blockers:** None. Can start immediately after Phase 1.

---

## Phase 2 — Image Intake

**Objective:** Accept uploads, validate file integrity.

**Stages to implement:**
- `IntakeStage` — file type, size, resolution, orientation, metadata

**New types/interfaces:**
- `IntakeValidationInput` (file metadata from MediaAsset)
- `FileValidationError` (typed rejection reasons)

**Code locations:**
- `services/trust-engine/src/stages/intake.stage.ts` (new)
- `apps/api/src/modules/trust-engine/intake.service.ts` (new)
- Update `trust-engine.service.ts` to wire stages into pipeline

**Implementation details:**
1. Load MediaAsset by ID
2. Validate:
   - File type (JPEG/PNG/WEBP only)
   - File size (100KB–20MB)
   - Image resolution (min 1920×1440 for gift cards)
   - Aspect ratio (0.5–2.0, prevents extreme crops)
   - EXIF rotation (normalize)
   - No ZIP bombs or polyglot files
3. Compute SHA256 hash (for Phase 7 duplicate detection)
4. Reject on any failure; emit reason codes
5. Pass SHA256 and metadata to next stage

**Tests:**
- Valid image passes (no errors)
- Invalid file types rejected
- Undersized images rejected
- Over-resolution images rejected
- Extreme aspect ratio rejected
- EXIF rotation handled

**Estimated:** 4 days

**Blockers:**
- Phase 1.5: database schema (needed for `ValidationRun` persistence)
- D3 resolution: synchronous or async submission flow? (architecture decision)

---

## Phase 3 — Asset Classification

**Objective:** Determine if upload is a gift card, document, person, vehicle, etc.

**Inference options (D2 resolution needed):**
- Local heuristics (fast, cheap)
- Google Cloud Vision (accurate, $0.02/call)
- Anthropic CV (accurate, depends on pricing)
- Hybrid (recommended: local → cloud on ambiguity)

**Code locations:**
- `services/trust-engine/src/stages/classification.stage.ts` (new)
- `services/trust-engine/src/inference/classification.model.ts` (new)
- `packages/providers/src/asset-inference.adapter.ts` (new adapter interface)

**Implementation details:**
1. Accept image upload URL or inline bytes
2. Call inference (local heuristics first)
3. Return classification: `GIFT_CARD | DOCUMENT | PERSON | VEHICLE | SCREENSHOT | RANDOM_OBJECT | UNKNOWN`
4. Return confidence (0–100)
5. Emit signal with confidence weight
6. Reject if not a gift card (for Phase 1, only gift cards are supported)

**Tests:**
- Gift card image → GIFT_CARD
- Selfie → PERSON
- Screenshot → SCREENSHOT
- Car photo → VEHICLE
- Random object → RANDOM_OBJECT
- Ambiguous image → UNKNOWN → query cloud provider

**Estimated:** 5 days

**Blockers:**
- D2 resolution: which inference provider(s)?
- Cloud API credentials (if using external service)

---

## Phase 4 — OCR (Text Extraction)

**Objective:** Extract brand, denomination, e-code from image.

**Code locations:**
- `services/trust-engine/src/stages/ocr.stage.ts` (new)
- `services/trust-engine/src/inference/ocr.model.ts` (new)

**Implementation details:**
1. Accept image and expected brand (from user or from Phase 3 classification)
2. Call OCR provider (Google Vision, Anthropic, tesseract, etc.)
3. Extract:
   - Brand (compare against declared brand)
   - Denomination
   - Region/country
   - All visible text
   - Confidence per field
4. Store extracted codes in `SubmissionSecret` (encrypted)
5. Store structure in `OcrResult` (unencrypted)
6. Emit signals:
   - `ocr_confidence` (0–100)
   - `brand_mismatch` (if user declared ≠ extracted)
   - `code_detected` (binary: was a code found?)

**Tests:**
- Valid card extracted correctly
- Partial card extracted with confidence penalty
- User-declared brand ≠ extracted brand → signal fraud suspicion
- Low OCR confidence → signal for manual review

**Estimated:** 4 days

**Blockers:**
- Phase 3: classification must run first (need to know it's a card)
- D2 resolution: inference provider choice

---

## Phase 5 — Image Quality Assessment

**Objective:** Detect blur, darkness, glare, cropping, rotation.

**Code locations:**
- `services/trust-engine/src/stages/quality.stage.ts` (new)
- `services/trust-engine/src/inference/quality.model.ts` (new)

**Implementation details:**
1. Analyze image metrics:
   - Blur (Laplacian variance)
   - Darkness (mean brightness)
   - Glare (specular highlights)
   - Cropping (edge detection)
   - Partial card visibility
   - Rotation (angle from EXIF or CV)
   - Perspective distortion
2. Compute quality score (0–100)
3. Store in `ImageQualityResult`
4. Emit signals for each metric
5. Reject if quality < config.minQualityScore

**Tests:**
- Clear photo → high quality
- Blurry photo → rejected with reason
- Dark photo → rejected with reason
- Glare on card → rejected with reason
- Cropped card → rejected with reason
- Rotated card → normalized, accepted

**Estimated:** 4 days

**Blockers:**
- Phase 2: needs image from intake
- Local heuristics OR cloud vision

---

## Phase 6 — Brand Validation

**Objective:** Validate denomination, format against brand rules.

**Code locations:**
- `services/trust-engine/src/stages/brand-validation.stage.ts` (new)

**Implementation details:**
1. Load brand rules from `BrandRuleSet` table
2. Validate:
   - Brand is enabled and configured
   - Denomination in range (minDenomination → maxDenomination)
   - If allowedDenominations is set, must be in list
   - Region supported for this brand
3. Emit signals:
   - `brand_supported` (binary)
   - `denomination_valid` (binary)

**Tests:**
- Apple US $50 → valid
- Apple US $10,000 → rejected (exceeds max)
- Steam US $25 → valid
- Steam US $5 → rejected (not in allowedDenominations)
- Unknown brand → rejected (BRAND_NOT_CONFIGURED)

**Estimated:** 2 days

**Blockers:**
- Phase 4: need extracted brand and denomination
- BrandRuleSet table must exist (Phase 1.5)

---

## Phase 7 — Duplicate Detection

**Objective:** Find exact duplicates and near-duplicates.

**Code locations:**
- `services/trust-engine/src/stages/duplicate.stage.ts` (new)

**Implementation details:**
1. Load SHA256 hash from Phase 2 intake
2. Query `MediaAsset` for exact hash matches
3. Query perceptual hash index for near-duplicates
4. Emit signals:
   - `duplicate_exact` (binary + count)
   - `duplicate_near` (binary + similarity score)
5. Reject if config.duplicatPolicy.exactReject and exact match found
6. REVIEW if config.duplicatePolicy.nearReview and near match found

**Short-circuit logic:**
- If `config.shortCircuit.onDuplicate = true`, stop pipeline here
- Otherwise continue to next stage

**Tests:**
- Same image uploaded twice → DUPLICATE_EXACT
- Re-cropped version of same card → DUPLICATE_NEAR
- Similar-looking but different cards → no duplicate
- First upload of a card → no duplicate

**Estimated:** 3 days

**Blockers:**
- Phase 2: need SHA256 hash
- Perceptual hashing library (e.g., `imagehash` or `phash`)
- MediaAsset table must have checksumSha256 (already exists)

---

## Phase 8 — E-Code Format Validation

**Objective:** Validate serial/PIN format against brand rules.

**Code locations:**
- `services/trust-engine/src/stages/ecode-format.stage.ts` (new)

**Implementation details:**
1. Load extracted code from Phase 4 OCR
2. Load brand rules (ecodeLengthMin, ecodeLengthMax, ecodeFormatRegex)
3. Validate:
   - Length in range
   - Format matches regex
   - No truncation signs (partial codes)
4. Emit signals:
   - `ecode_valid` (binary)
   - `ecode_length_ok` (binary)
   - `ecode_format_ok` (binary)

**Tests:**
- Valid Apple code → accepted
- Truncated code → rejected (ECODE_PARTIAL)
- Wrong length → rejected
- Wrong format → rejected

**Estimated:** 2 days

**Blockers:**
- Phase 4: need extracted code
- BrandRuleSet table with regex patterns (Phase 1.5)

---

## Phase 9 — Fraud Scoring

**Objective:** Compute fraud score from all signals collected.

**Code locations:**
- `services/trust-engine/src/scoring/fraud-scorer.ts` (new)
- `services/trust-engine/src/scoring/trust-scorer.ts` (new)
- Update `DefaultArbiter` → `ConditionalArbiter`

**Implementation details:**
1. Collect signals from all stages
2. Weight each signal by importance
3. Compute fraud score: 0–100 (higher = riskier)
4. Factors:
   - Duplicate history (exact dupe = high risk)
   - OCR confidence (low confidence = higher fraud risk)
   - Brand mismatch (declared ≠ extracted = signal)
   - Quality (poor quality = higher risk)
   - Velocity (N submissions in M hours = risk)
   - Device/IP reputation
5. Compute trust score: -100 to +100 (higher = more trustworthy)
6. Factors:
   - KYC tier (verified users higher trust)
   - Historical accuracy (past submissions were valid)
   - Age of account
   - Dispute rate
7. Apply thresholds (from config):
   - fraud_score ≤ acceptMax → ACCEPT
   - fraud_score ∈ (acceptMax, rejectMin) → REVIEW
   - fraud_score ≥ rejectMin → REJECT
8. Trust score shifts bands: high-trust actor gets wider ACCEPT band

**Tests:**
- Clean submission, high-trust user → ACCEPT
- Suspicious submission, low-trust user → REJECT
- Borderline submission → REVIEW (manual)
- Same submission: high-trust → ACCEPT, low-trust → REJECT

**Estimated:** 5 days

**Blockers:**
- Phases 2–8: all stages must emit signals
- User trust score data (KYC tier, dispute history)

---

## Phase 10 — Trust Score Computation

**Continuation of Phase 9 — isolated for clarity.**

**Code locations:**
- Update `TrustScoringModel` implementation

**Factors:**
- KYC tier (VERIFIED > STANDARD > UNVERIFIED)
- Submission accuracy (%, historical)
- Dispute/reversal rate
- Account age
- Velocity (reasonable submission rate or abuse pattern?)
- Device fingerprint (consistent or hopping?)

**Tests:**
- Verified user, 0 disputes, 100 accurate submissions → high trust
- Unverified user, 50% dispute rate → low trust
- New account (< 24h) → low trust → narrow ACCEPT band

**Estimated:** 2 days (continuation of 9)

**Blockers:**
- User/account data in database
- Device fingerprinting (if implemented)

---

## Phase 11 — Provider Router Integration

**Objective:** Hand off accepted submissions to the right provider.

**Note:** Trust Engine does NOT directly contact providers. It emits an event.

**Code locations:**
- `apps/api/src/modules/digital-value/digital-value.service.ts` (modify)
- Add event consumer that watches for `submission_accepted`

**Flow:**
1. Trust Engine emits `AssetSubmissionAccepted` event
2. `DigitalValueService` listens
3. Selects provider based on `ProviderConfig` priority + health
4. Creates `ProviderSubmission` record
5. Calls provider adapter (Sogo, Cardtonic, etc.)
6. Tracks `ProviderRoutingAttempt`

**Tests:**
- ACCEPT verdict → event emitted
- Event → provider selected → provider called
- Provider down → retry with fallback
- Unknown provider → error handling

**Estimated:** 3 days

**Blockers:**
- Phases 2–10: pipeline complete
- Event system (already in codebase)

---

## Phase 12 — Sogo Integration

**Objective:** Implement Sogo-specific adapter.

**Code locations:**
- `packages/providers/src/gift-card-sell.adapter.ts` (already exists, Phase 1)
- `apps/api/src/modules/digital-value/sogo.provider.ts` (new implementation)

**Implementation:**
- Use existing `GiftCardSellProvider` interface
- Call Sogo API with validated card info
- Handle Sogo responses: quote, submit, reject
- Implement retry logic
- Webhook handling for async results

**Tests:**
- Valid card → Sogo accepts
- Invalid card → Sogo rejects
- Network timeout → retry
- Webhook callback → status update

**Estimated:** 4 days

**Blockers:**
- Phase 11: provider router ready
- Sogo API credentials + sandbox access

---

## Phase 13 — Admin Dashboard

**Objective:** Moderator review interface.

**Endpoints to add:**
- `GET /trust/v1/admin/submissions/{id}` — full detail view
- `GET /trust/v1/admin/moderation-queue` — list pending reviews
- `POST /trust/v1/admin/submissions/{id}/override` — mod decision
- `POST /trust/v1/admin/submissions/{id}/reveal-secret` — decrypt PIN
- `GET /trust/v1/admin/config` — view current config
- `POST /trust/v1/admin/config` — update config

**DTOs in `dtos.ts`:**
- `AdminSubmissionDetailDto`
- `ModerationQueueDto`
- `VerdictOverrideDto`
- `RevealSecretDto`
- `ConfigurationDto`

**Permissions:**
- `trustEngineAdmin` feature flag
- Additional `readSecrets` permission for reveal

**Tests:**
- Mod can view submission details
- Mod can override verdict
- Override logged to AuditLog
- Secret reveal requires permission

**Estimated:** 5 days

**Blockers:**
- Phases 2–10: all data must exist
- Frontend: not in scope (API only)

---

## Phase 14 — Analytics

**Objective:** Aggregate metrics for ops.

**Endpoints:**
- `GET /trust/v1/admin/analytics` — acceptance rate, rejection reasons, fraud trends

**Data to track:**
- Submissions by status
- Rejection reasons histogram
- Fraud score distribution
- Trust score distribution
- OCR confidence avg
- Quality score avg
- Duplicate detection rate
- Provider success rate
- False positive rate (by mod override)

**Export:**
- CSV export for BI tools

**Tests:**
- Analytics computed correctly
- Date range filtering works
- Breakdown by brand/region

**Estimated:** 3 days

**Blockers:**
- Phases 2–10: data populated

---

## Phase 15 — Testing & Performance

**Objective:** Unit, integration, stress tests. Performance benchmarks.

**Test categories:**
1. **Unit tests** — every stage, scorer, logger
2. **Integration tests** — full pipeline end-to-end
3. **Stress tests** — 1000 concurrent submissions
4. **Fraud simulations** — ring attacks, velocity abuse
5. **Provider failure tests** — network down, timeout, invalid response
6. **Config mutation tests** — changing config mid-run

**Performance targets:**
- p95 end-to-end: ≤ 8s (per Phase 0 PRD)
- p95 intake ack: ≤ 800ms
- Duplicate lookup: ≤ 50ms
- External calls batched (if possible)

**Tests:**
- Replay determinism: same input + config = same verdict
- Idempotency: rerun with same idempotencyKey = same result
- Fail-closed: all errors route to REVIEW, never ACCEPT

**Estimated:** 6 days

**Blockers:**
- Phases 2–14 complete

---

## Phase 16 — Documentation & Launch

**Objective:** Complete documentation and production readiness.

**Deliverables:**
1. **Developer guide** — how to add a new stage, scorer, brand
2. **Architecture diagrams** — pipeline, data flow, integrations
3. **Database documentation** — schema, migrations, indexes
4. **API documentation** — OpenAPI/Swagger (auto-generated)
5. **Deployment guide** — env vars, scaling, monitoring
6. **Configuration guide** — how to edit brands, thresholds
7. **Operational handbook** — common issues, debugging, runbooks
8. **Launch checklist** — pre-prod verification

**Code cleanup:**
- Remove all Phase 1 "not implemented" placeholders
- Add boundary rule to ESLint (prevent money/provider imports)
- Update CLAUDE.md with Trust Engine commands

**Estimated:** 3 days

**Blockers:**
- Phases 2–15 complete

---

## Timeline & dependencies

```
Phase 1      (complete)
  ↓
Phase 1.5    (1 day) — database schema
  ↓
Phase 2      (4 days) — intake
  ↓
Phase 3      (5 days) — classification [BLOCKED by D2]
  ↓
Phase 4      (4 days) — OCR [BLOCKED by D2]
  ↓
Phase 5      (4 days) — quality
  ↓
Phase 6      (2 days) — brand validation
  ↓
Phase 7      (3 days) — duplicate
  ↓
Phase 8      (2 days) — ecode format
  ↓
Phases 9–10  (7 days) — fraud + trust scoring
  ↓
Phase 11     (3 days) — provider router [BLOCKED by D3]
  ↓
Phase 12     (4 days) — Sogo integration
  ↓
Phase 13     (5 days) — admin dashboard
  ↓
Phase 14     (3 days) — analytics
  ↓
Phase 15     (6 days) — testing
  ↓
Phase 16     (3 days) — documentation
  
Total: ~60 engineer-days
```

**Critical path blockers:**
- **D2 (inference provider)** — blocks Phase 3 start
- **D3 (async flow)** — blocks Phase 11, shapes Phase 2 entirely
- **Phase 1.5 (schema)** — blocks Phase 2

**Parallelizable:**
- Phases 9–10 can run in parallel with 2–8
- Phases 13–14 can run in parallel with 2–10
- Phase 16 can start during Phase 15

**Recommended approach:**
1. Resolve D1–D5 NOW (3–5 days)
2. Implement 1.5 (1 day)
3. Run Phases 2–8 in series (4+5+4+4+2+3+2 = 24 days)
4. Run Phases 9–10 in parallel (7 days)
5. Run Phases 11–12 in series (3+4 = 7 days)
6. Parallel tracks: (13–14 in 8 days) + (15–16 in 9 days) while core finishes

**Optimized timeline:** ~45 days critical path + parallel work = ~8–10 weeks to full launch.

---

## Success metrics

At launch:
- ✅ A1–A11: all acceptance criteria met
- ✅ Zero PINs in logs/metadata
- ✅ 95%+ of non-gift-card uploads rejected
- ✅ <2% false reject rate (mod overturn metric)
- ✅ Sogo satisfied with validation quality
- ✅ Configuration hot-editable by ops
- ✅ Full audit trail for every verdict
- ✅ All tests passing, CI green
