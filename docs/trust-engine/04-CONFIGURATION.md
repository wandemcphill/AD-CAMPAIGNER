# Trust Engine — Configuration Model

**Status:** Phase 0 — Design.

---

## 1. Principles

1. **Nothing is hardcoded.** Every threshold, limit, and format lives in a DB row or
   environment variable.
2. **Configuration is versioned.** Every validation run stamps the config version, so
   replays are deterministic.
3. **Configuration is hot-editable.** No deploy needed to tune fraud thresholds or add a
   brand.
4. **Configuration is audited.** Every change is logged to `AuditLog`.
5. **Configuration is per-tenant where needed.** Workspace or global scope, with global
   defaults.

---

## 2. Configuration layers

Three scopes, in order of specificity:

1. **Global defaults** — environment variables, applied on startup.
2. **Tenant overrides** — per-workspace DB rows, can override any global setting.
3. **Feature flags** — `packages/feature-flags/index.ts`, gates entire subsystems.

---

## 3. Global defaults (environment variables)

```bash
# Inference provider
TRUST_ENGINE_INFERENCE_PROVIDER=local|google_vision|anthropic|hybrid  # hybrid = cheap first, expensive on ambiguity
TRUST_ENGINE_VISION_API_KEY=...
TRUST_ENGINE_OCR_API_KEY=...

# Cost ceiling
TRUST_ENGINE_MAX_COST_PER_SUBMISSION_MICRO=50000  # don't spend more than 50k micro units per submission
TRUST_ENGINE_MONTHLY_BUDGET_MICRO=10000000        # monthly cap across all submissions

# Duplicate detection
TRUST_ENGINE_DUPLICATE_EXACT_THRESHOLD=1.0  # 1.0 = exact match on SHA256
TRUST_ENGINE_DUPLICATE_NEAR_THRESHOLD=0.95  # perceptual hash similarity for near-dupes

# Rate limiting
TRUST_ENGINE_RATE_LIMIT_HIGH_TRUST=100          # submissions/hour
TRUST_ENGINE_RATE_LIMIT_MEDIUM_TRUST=50
TRUST_ENGINE_RATE_LIMIT_LOW_TRUST=10

# Retention
TRUST_ENGINE_RETENTION_ACCEPTED_DAYS=90
TRUST_ENGINE_RETENTION_REJECTED_DAYS=180
TRUST_ENGINE_RETENTION_DISPUTED_DAYS=never

# Encryption
TRUST_ENGINE_ENCRYPTION_KEY_VERSION=1
TRUST_ENGINE_ENCRYPTION_KEY_REF_1=kms://...  # reference to KMS key
```

Loaded at startup into a `TrustEngineConfig` singleton. Changes require restart (fine,
this is rarely needed; DB config is what ops tunes).

---

## 4. Per-workspace configuration (database)

Stored as rows in a new table `TrustEngineConfiguration`:

```prisma
model TrustEngineConfiguration {
  id                      String   @id @default(uuid())
  workspaceId             String
  configVersion           Int      // auto-increment per workspace
  
  // Thresholds (fraud scoring bands)
  fraudScoreAcceptMax     Int      @default(30)   // ≤ 30 = ACCEPT
  fraudScoreRejectMin     Int      @default(70)   // ≥ 70 = REJECT
  // Between 30–70 = REVIEW
  
  trustScoreBandShift     Int      @default(0)    // per-actor score shifts bands
  
  // Stage limits
  maxDurationPerStageMs   Int      @default(10000)
  maxTotalDurationMs      Int      @default(30000)
  maxExternalCallsPerRun  Int      @default(5)
  maxCostPerSubmissionMicro Int   @default(50000)
  
  // Quality thresholds
  minQualityScore         Int      @default(50)   // 0–100
  requireFullCard         Boolean  @default(true)
  minOcrConfidence        Int      @default(60)
  
  // Duplicate policy
  duplicateExactReject    Boolean  @default(true)  // treat exact dupe as REJECT
  duplicateNearReview     Boolean  @default(true)  // treat near-dupe as REVIEW
  duplicateHistoryDays    Int      @default(90)
  
  // Inference
  inferenceProvider       String   @default("hybrid")
  qualityAssessmentEngine String   @default("local_heuristic")
  ocrEngine               String   @default("google_vision")
  
  // Short-circuit behavior
  shortCircuitOnIntakeFail Boolean @default(true)  // fail-fast if upload invalid
  shortCircuitOnDuplicate Boolean @default(false)  // continue if near-dup found
  shortCircuitOnQualityFail Boolean @default(false)
  
  // Enabled asset classes
  enabledAssetClasses     String[] @default(["GIFT_CARD"])
  
  // Enabled brands (can be restricted per workspace)
  enabledBrands           String[] @default([])    // empty = all; non-empty = allowlist
  
  // Metadata for future use
  metadata                Json     @default("{}")
  
  // Audit
  createdBy               String
  createdAt               DateTime @default(now())
  updatedBy               String?
  updatedAt               DateTime @updatedAt
  appliedAt               DateTime @default(now())
  
  workspace               Workspace @relation(fields: [workspaceId], references: [id])
  
  @@unique([workspaceId])  // one active config per workspace
  @@index([workspaceId, appliedAt])
}
```

**Usage:**
When validating, the service resolves config in this order:
1. Look for `TrustEngineConfiguration` row for `workspaceId`.
2. If not found, use global defaults.
3. Pass resolved config to pipeline; stamp config version on every run.

**Edits:**
- Admin endpoint `POST /trust/v1/admin/config` creates a new row, updates the FK on
  active runs if needed.
- Old rows are retained for replay (A9).
- Changes are audited to `AuditLog` with `action='trust_engine_config_update'`.

---

## 5. Brand configuration

Stored in `BrandRuleSet` table (defined in 02-DATABASE.md). Example rows:

```
assetClass=GIFT_CARD, brand=APPLE, region=US:
  ├─ minDenomination: 1 (0.01 USD)
  ├─ maxDenomination: 50000 (500 USD)
  ├─ ecodeLengthMin: 16
  ├─ ecodeLengthMax: 16
  ├─ ecodeFormatRegex: '^[A-F0-9]{16}$'
  ├─ minQualityScore: 60
  ├─ requireFullCard: true
  └─ suspectIfOcrMismatchConfidence: 40

assetClass=GIFT_CARD, brand=STEAM, region=GLOBAL:
  ├─ minDenomination: 500 (5 USD)
  ├─ allowedDenominations: [500, 1000, 2500, 5000]  // only these, no ranges
  ├─ ecodeLengthMin: 10
  ├─ ecodeLengthMax: 12
  ├─ ecodeFormatRegex: '^[A-Z0-9-]{10,12}$'
  └─ duplicateHarsh: true        // any near-dup = REJECT for Steam
```

**Ops adds new brands by inserting rows.** No code change needed. Brands can be:
- **Enabled** — brand is recognized and validated
- **Disabled** — brand is recognized but submissions are auto-rejected with
  `BRAND_DISABLED`
- **Retired** — brand is deprecated; submissions are `REVIEW` with a note to the
  moderator

---

## 6. Feature flags

Two new flags in `packages/feature-flags/index.ts`:

```ts
export const featureFlags = {
  // ...existing flags...
  trustEngine: false,           // enable the whole subsystem
  trustEngineAdmin: false,      // enable mod dashboard
  trustEngineInference: false,  // use expensive inference vs local-only
}
```

Gates:
- `trustEngine=false` → all submission routes return `403 FeatureNotEnabled`
- `trustEngineAdmin=false` → admin routes return `403 FeatureNotEnabled`
- `trustEngineInference=false` → pipeline uses only local heuristics, skips cloud
  calls (useful for staging)

---

## 7. Quota and rate limiting configuration

Stored per-workspace in a `QuotaPolicy` table:

```prisma
model QuotaPolicy {
  id                    String   @id @default(uuid())
  workspaceId           String   @unique
  
  // Rate limits
  submissionsPerHourHighTrust   Int @default(100)
  submissionsPerHourMediumTrust Int @default(50)
  submissionsPerHourLowTrust    Int @default(10)
  
  // Spending cap
  monthlyBudgetMicro    Int?     // null = unlimited
  currentMonthSpentMicro Int     @default(0)
  currentMonthResetAt   DateTime @default(now())
  
  // Abuse patterns
  duplicateCountThreshold Int    @default(3)  // >3 dupes in 24h = alert
  duplicateDetectionWindow Int   @default(86400)  // seconds
  
  workspace             Workspace @relation(fields: [workspaceId], references: [id])
  
  @@index([workspaceId])
}
```

---

## 8. Configuration versioning strategy

Every row that participates in verdict has a version field:

```ts
interface ConfigurationContext {
  configVersion: number              // e.g. 5
  brandRuleSetVersion: number       // e.g. 12
  pipelineVersion: number           // code version (e.g. phase 1, phase 2, ...)
  inferenceAdapterVersion: string   // e.g. 'google_vision@2024-01-15'
}
```

Idempotency key includes these:
```ts
idempotencyKey = hash(`${submissionId}:${configVersion}:${pipelineVersion}`)
```

This means if config changes, a re-run of the same submission produces a new run record
and potentially a different verdict. The audit trail captures both. A moderator can see
"this was REVIEW under v4 config, but would be ACCEPT under v5" without confusion.

---

## 9. Defaults policy

**When a new workspace is created:**
1. It inherits global defaults from environment variables.
2. It does NOT automatically get a `TrustEngineConfiguration` row.
3. On first submission, if no row exists, global defaults are used.
4. Once a row is created (explicitly via admin, or auto-on-first-submission),
   it is the source of truth.

**When a new brand ships:**
1. Ops adds a `BrandRuleSet` row with sensible defaults.
2. Brands are NOT supported until the row exists and is enabled.
3. Unknown brands are rejected with `BRAND_NOT_CONFIGURED`.

---

## 10. Configuration validation

Every config edit must pass validation before committing:

```ts
interface ConfigValidation {
  acceptMax < rejectMin
  minQualityScore between 0–100
  ecodeLengthMin ≤ ecodeLengthMax
  minDenomination ≤ maxDenomination
  all enabled asset classes have at least one brand rule set
}
```

If validation fails, the edit is rejected with a clear error listing what's wrong.

---

## 11. Configuration consumption

In the pipeline:

```ts
class PipelineOrchestrator {
  async run(submission: AssetSubmission, config: TrustEngineConfiguration) {
    // ... pipeline uses config for all threshold / limit / format decisions
    // ... resolution is deterministic: same input + config = same output
  }
}
```

---

## 12. Configuration export and import

For disaster recovery and environment promotion (dev → staging → prod):

**GET `/trust/v1/admin/config/export`**
Returns full configuration as JSON.

**POST `/trust/v1/admin/config/import`**
Accepts JSON, validates, and applies in a transaction.

Useful for:
- Syncing staging and production config
- Backing up before a risky change
- Bulk brand onboarding (export template, edit, import)
