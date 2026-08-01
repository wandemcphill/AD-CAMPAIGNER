# Trust Engine — Database Design

**Status:** Phase 0 — Design. Schema additions to `packages/database/prisma/schema.prisma`.

---

## 1. Overview

The Trust Engine adds 8 new tables and extends 2 existing ones. No tables from the brief
are created; see ADR-002 for the reasoning.

### 1.1 Reused tables

| Table | Existing use | Trust Engine use |
|---|---|---|
| `MediaAsset` | campaigns, company profiles | holds uploaded images, leverages `checksumSha256` |
| `AuditLog` | platform audit trail | logs every stage outcome, verdict, override |
| `ProviderConfig` | multi-domain provider routing | gates which providers can receive which asset classes |
| `ProviderRoutingAttempt` | tracks routing decisions | tracks submission → provider selection decision |

---

## 2. New tables

### 2.1 `AssetSubmission`

One row per user submission. Discriminates on `assetClass` to support gift cards, airtime
PINs, vouchers, documents etc. in the same table.

```prisma
enum AssetClass {
  GIFT_CARD
  AIRTIME_PIN
  RECHARGE_VOUCHER
  DIGITAL_COUPON
  // future: KYC_DOCUMENT, LOTTERY_TICKET, PROMO_CODE, ...
}

enum SubmissionStatus {
  PENDING        // awaiting first pipeline run
  PROCESSING     // pipeline in flight
  ACCEPTED       // ACCEPT verdict reached
  REVIEW         // REVIEW verdict; awaiting moderation
  REJECTED       // REJECT verdict; terminal
  DISPUTED       // user or mod contested the verdict
  COMPLETED      // finality: either accepted→approved or rejected→user notified
}

model AssetSubmission {
  id                  String         @id @default(uuid())
  workspaceId         String
  userId              String
  assetClass          AssetClass
  status              SubmissionStatus @default(PENDING)
  
  // Asset reference. Discriminated by assetClass.
  mediaAssetId        String?        // FK MediaAsset for GIFT_CARD image uploads
  submissionProfile   Json           // typed per-class: { brand?, region?, denomination? }
  
  // Execution
  lastValidationRunId String?        // FK ValidationRun, for quick lookup
  nextRetryAt         DateTime?
  retryCount          Int            @default(0)
  maxRetries          Int            @default(3)
  
  // Audit / legal
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  deletedAt           DateTime?      // soft delete for retention policy
  
  workspace           Workspace      @relation(fields: [workspaceId], references: [id])
  user                User           @relation("AssetSubmissionUser", fields: [userId], references: [id])
  mediaAsset          MediaAsset?    @relation(fields: [mediaAssetId], references: [id])
  validationRuns      ValidationRun[]
  secrets             SubmissionSecret?
  
  @@index([workspaceId, status, createdAt])
  @@index([userId, assetClass, createdAt])
  @@index([status, nextRetryAt])
  @@index([lastValidationRunId])
}
```

**Design notes:**
- `assetClass` discriminator is just a string tag, not a separate fk. Per-class rows
  (`GiftCardProfile`, `AirtimePinProfile` etc.) reference back to `AssetSubmission`, so
  the join is optional and explicit.
- `submissionProfile` is the per-class data in the clear: brand, region, denomination,
  networks etc. Anything secret (PIN, code) goes in `SubmissionSecret`, not here.
- `lastValidationRunId` is a denormalization for UI speed (show status without joining
  `ValidationRun`); `ValidationRun.submissionId` is the FK source-of-truth.

### 2.2 `SubmissionSecret`

Encrypted secrets tied to a submission. Never loaded except on explicit reveal.

```prisma
model SubmissionSecret {
  id              String   @id @default(uuid())
  submissionId    String   @unique  // one secret per submission
  encryptedValue  String   // encrypted with envelope key
  encryptionKeyRef String  // config ref to the key version
  secretKind      String   // 'gift_card_pin' | 'ecode' | 'airtime_pin'
  createdAt       DateTime @default(now())
  
  submission      AssetSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  
  @@index([submissionId])
}
```

**Design notes:**
- `encryptionKeyRef` enables key rotation: if you rotate the master key, old secrets
  still decrypt because they remember which version encrypted them.
- Never expose `encryptedValue` to logs or JSON serialisation without a `@Exclude`
  decorator or a custom serialiser.
- No plaintext code storage anywhere. The current plaintext `cardInfo` in metadata is
  fixed in Phase 1.

### 2.3 `ValidationRun`

One row per pipeline execution for a submission. Append-only history.

```prisma
enum ValidationRunStatus {
  PENDING       // queued
  IN_PROGRESS   // stages running
  COMPLETED     // all stages done, verdict arbiter ran
  FAILED        // system failure, human review needed
}

model ValidationRun {
  id                  String                @id @default(uuid())
  submissionId        String
  configVersion       Int                   // stamp for determinism (ADR-006)
  pipelineVersion     Int                   // schema version of this run
  idempotencyKey      String                @unique // (submissionId, configVersion, pipelineVersion)
  status              ValidationRunStatus   @default(PENDING)
  
  // Verdict
  verdict             String                // 'ACCEPT' | 'REVIEW' | 'REJECT'
  verdictReasons      String[]              // ['DUPLICATE_EXACT', 'QUALITY_TOO_DARK', ...]
  verdictExplained    String?               // human-friendly summary
  
  // Scoring
  fraudScore          Int                   // 0–100
  trustScore          Int                   // –100 to +100
  finalScore          Int                   // arbiter's computed score for bands
  
  // Execution metadata
  stageDurationMs     Json                  // { intake: 45, classify: 2100, ... }
  totalDurationMs     Int
  stagesFailed        String[]              // which stages had FAIL status
  stagesInconcl       String[]              // which stages had INCONCLUSIVE
  externalCalls       Int                   // count of inference/API calls made
  externalCostMicro   Int                   // sum cost in micro-units (for billing)
  
  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt
  
  submission          AssetSubmission       @relation(fields: [submissionId], references: [id])
  stageResults        StageResult[]
  
  @@index([submissionId, createdAt])
  @@index([verdict, createdAt])
  @@index([configVersion, createdAt])
}
```

**Design notes:**
- `idempotencyKey` ensures replaying the same submission + config = same row, no
  duplicates.
- `stageDurationMs` is a JSON object keyed by stage (`intake`, `classify`, etc.), so
  ops can track which stage is slow without adding a join.
- `externalCostMicro` tracks spend per run, summed for billing and budgeting.
- `verdict` is a string, not an enum, so new verdicts can be added without schema
  migration — ops can add variants to thresholds without engineers deploying.

### 2.4 `StageResult`

Output of a single stage in a validation run. One row per (run, stage).

```prisma
enum StageStatus {
  PASS
  FAIL
  INCONCLUSIVE
}

model StageResult {
  id              String      @id @default(uuid())
  validationRunId String
  stageKey        String      // 'intake' | 'duplicate' | 'quality' | ...
  status          StageStatus
  
  // Evidence
  signals         Signal[]    // relation, see below
  reasonCodes     String[]    // ['DUPLICATE_EXACT', 'QUALITY_BLUR', ...]
  resultData      Json?       // stage-specific evidence: { hash, similarity, blur_pct, ... }
  
  // Audit
  retryCount      Int         @default(0)
  durationMs      Int
  failureMessage  String?     // if status == FAIL: error detail (redacted)
  
  createdAt       DateTime    @default(now())
  
  validationRun   ValidationRun @relation(fields: [validationRunId], references: [id])
  
  @@index([validationRunId, stageKey])
  @@unique([validationRunId, stageKey])  // only one result per stage per run
}
```

**Design notes:**
- `resultData` is stage-specific JSON: duplicate stage stores the hash and similarity
  score; quality stage stores blur/darkness/glare metrics; OCR stage stores the extracted
  structure (not the code itself — codes go in `SubmissionSecret`).
- `FailureMessage` is redacted before storage; it never contains a code or sensitive
  user input, only the error class and code reference.

### 2.5 `Signal`

Typed scores emitted by stages, consumed by the fraud model. One row per signal.

```prisma
model Signal {
  id              String   @id @default(uuid())
  stageResultId   String
  key             String   // 'duplicate_found' | 'blur_score' | 'device_mismatch' | ...
  value           Decimal  @db.Decimal(5, 2)  // raw value, unit-agnostic
  confidence      Int      // 0–100
  weight          Int      // 0–100, how much this signal affects fraud score
  
  createdAt       DateTime @default(now())
  
  stageResult     StageResult @relation(fields: [stageResultId], references: [id])
  
  @@index([stageResultId])
}
```

### 2.6 `OcrResult`

Extracted text from an image. Separate from validation run so OCR is versionable
independently and can be re-extracted without re-running the whole pipeline.

```prisma
model OcrResult {
  id              String   @id @default(uuid())
  submissionId    String
  mediaAssetId    String?
  
  // Structured extraction
  brand           String?  // extracted brand (compare against user-declared)
  regionCode      String?  // extracted region
  denomination    String?  // extracted amount
  visibleText     String[] // all non-code text found
  
  // Confidence and metadata
  overallConfidence Int    // 0–100
  fieldConfidence   Json   // { brand: 92, denomination: 87 }
  ocrEngine        String  // 'google_vision' | 'anthropic_cv' | 'tesseract' | ...
  
  // Secret handling
  detectedCodeCount Int    // how many codes found (redacted from detail)
  // actual codes stored separately in SubmissionSecret
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  submission       AssetSubmission @relation(fields: [submissionId], references: [id])
  mediaAsset       MediaAsset?     @relation(fields: [mediaAssetId], references: [id])
  
  @@index([submissionId, createdAt])
  @@unique([submissionId])  // latest OCR per submission
}
```

### 2.7 `ImageQualityResult`

Low-level image metrics. Separate from `OcrResult` because quality assessment is a
separate stage and results may be useful for ML training.

```prisma
model ImageQualityResult {
  id              String   @id @default(uuid())
  submissionId    String
  mediaAssetId    String
  
  blurScore       Int      // 0–100, higher = more blurred
  darkScore       Int      // 0–100, higher = darker
  glareScore      Int      // 0–100, higher = more glare
  exposureOk      Boolean  // overall exposure acceptable
  
  croppingDetected Boolean // edges look cut
  partialCardVisible Boolean
  rotationDegrees Int?
  perspective     String?  // 'normal' | 'tilted' | 'extreme'
  
  metrics         Json     // engine-specific details
  assessmentEngine String   // 'google_vision' | 'local_heuristic' | ...
  
  createdAt       DateTime @default(now())
  
  submission      AssetSubmission @relation(fields: [submissionId], references: [id])
  mediaAsset      MediaAsset      @relation(fields: [mediaAssetId], references: [id])
  
  @@index([submissionId])
  @@unique([submissionId])  // latest quality assessment
}
```

### 2.8 `BrandRuleSet`

Configuration for brand-specific validation. Rows are edited by ops to control behavior.

```prisma
model BrandRuleSet {
  id                  String   @id @default(uuid())
  assetClass          AssetClass
  brand               String   // 'APPLE' | 'AMAZON' | 'STEAM' | ... or 'AIRTIME_MTN' etc.
  region              String?  // if brand × region is the key (gift cards are)
  
  // Validation rules
  minDenomination     Int?
  maxDenomination     Int?
  allowedDenominations Int[]?
  ecodeLengthMin      Int?
  ecodeLengthMax      Int?
  ecodeFormatRegex    String?  // regex for format (not stored secret)
  
  // Quality thresholds
  minQualityScore     Int      @default(50)  // 0–100
  requireFullCard     Boolean  @default(true)
  requireNoCropping   Boolean  @default(false)
  allowPartialOcr     Boolean  @default(false)
  
  // Fraud signals
  suspectIfOcrMismatchConfidence Int  @default(30)  // if extracted != declared
  duplicateHarsh      Boolean  @default(true)       // treat any near-dup as reject
  
  // Operational
  enabled             Boolean  @default(true)
  priority            Int      @default(100)
  metadata            Json     @default("{}")
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@unique([assetClass, brand, region])
  @@index([assetClass, enabled])
}
```

**Design notes:**
- Each row is one brand × region combination. Ops adds rows to add brands without code.
- Thresholds are the mechanism for ops to tune behavior; no hardcoded limits in the code.

### 2.9 `ModerationQueue`

Submissions that need human review.

```prisma
enum ModerationReason {
  VERDICT_REVIEW         // arbiter routed to REVIEW band
  SYSTEM_FAILURE         // pipeline crashed
  ESCALATION_MANUAL      // user or mod escalated
  FRAUD_SIGNAL_AMBIGUOUS // score is on boundary
  USER_DISPUTE           // user contested verdict
}

model ModerationQueue {
  id                  String              @id @default(uuid())
  submissionId        String
  validationRunId     String?
  reason              ModerationReason
  status              String              @default("PENDING")  // 'PENDING' | 'REVIEWING' | 'RESOLVED'
  
  // Assignment
  reviewerUserId      String?
  reviewedAt          DateTime?
  decision            String?             // 'ACCEPT' | 'REJECT' | 'RESUBMIT'
  decisionReason      String?
  
  // Audit
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  
  submission          AssetSubmission     @relation(fields: [submissionId], references: [id])
  validationRun       ValidationRun?      @relation(fields: [validationRunId], references: [id])
  reviewer            User?               @relation(fields: [reviewerUserId], references: [id])
  
  @@index([status, createdAt])
  @@index([reviewerUserId, status])
}
```

---

## 3. Changes to existing tables

### 3.1 `MediaAsset` — add relation

```prisma
model MediaAsset {
  // ... existing fields ...
  assetSubmissions  AssetSubmission[]   // a media asset may be referenced by multiple submissions
  ocrResults        OcrResult[]
  qualityResults    ImageQualityResult[]
}
```

### 3.2 `AuditLog` — add structured metadata for verdicts

```prisma
model AuditLog {
  // ... existing fields ...
  // Existing pattern: action='asset_submission_verdict' | 'asset_override'
  // Metadata now may contain:
  // { verdictBefore: 'REVIEW', verdictAfter: 'ACCEPT', reason: 'OCR_CONFIDENCE_HIGH', ... }
}
```

No schema change needed; metadata is already JSON. Just document the pattern.

### 3.3 Constraint: trust-engine imports never reach `Wallet` or `LedgerEntry`

Enforced by ESLint boundary rule:

```js
{
  "allow": [
    "@fliptrybe/types",
    "@fliptrybe/providers",
    "@fliptrybe/feature-flags",
    "@fliptrybe/database"
  ],
  "disallow": [
    "@fliptrybe/payments",  // ← blocks LedgerEntry
    "@fliptrybe/service-smm",  // ← blocks money logic
    "apps/api/src/modules/digital-access",  // ← block other money modules
  ]
}
```

---

## 4. Indexes and constraints

### 4.1 Uniqueness

| Table | Unique constraint | Reason |
|---|---|---|
| `SubmissionSecret` | (submissionId) | one secret per submission |
| `ValidationRun` | (idempotencyKey) | replay safety |
| `StageResult` | (validationRunId, stageKey) | one result per stage per run |
| `OcrResult` | (submissionId) | latest OCR per submission |
| `ImageQualityResult` | (submissionId) | latest quality per submission |
| `BrandRuleSet` | (assetClass, brand, region) | one config per brand |

### 4.2 Indexes for query patterns

| Table | Index | Query pattern |
|---|---|---|
| `AssetSubmission` | (workspaceId, status, createdAt) | "show me pending submissions for this workspace" |
| `AssetSubmission` | (userId, assetClass, createdAt) | "user's submission history by class" |
| `AssetSubmission` | (status, nextRetryAt) | queue worker: "what needs retry?" |
| `ValidationRun` | (submissionId, createdAt) | "show me all runs for a submission" |
| `ValidationRun` | (verdict, createdAt) | ops: "how many accepts today?" |
| `StageResult` | (validationRunId, stageKey) | "what was the quality stage result?" |
| `OcrResult` | (submissionId, createdAt) | "show latest OCR" |
| `ModerationQueue` | (status, createdAt) | "what's in the queue?" |
| `ModerationQueue` | (reviewerUserId, status) | "what's assigned to me?" |

### 4.3 Partial indexes (for future optimization)

Not in MVP, but when storage becomes a constraint:

```prisma
model AssetSubmission {
  @@index([workspaceId, deletedAt]) // only non-deleted submissions
  @@index([userId, status]) // only for fast user-specific lookups
}
```

---

## 5. Data lifecycle and retention

- **Accepted submissions:** images and OCR deleted after 90 days; secrets after 30 days;
  hashes and audit retained forever for duplicate detection.
- **Rejected submissions:** same as accepted + reason codes retained forever.
- **In-REVIEW submissions:** hard delete only after mod decision + 180 days.
- **Disputed submissions:** audit-locked, never auto-deleted.

Retention is a `FeatureFlag` parameter once settled with compliance; default is defined
above. No hard-delete of `AuditLog` ever.

---

## 6. Prisma notes

- Add to `packages/database/prisma/schema.prisma` in a single migration.
- Run `pnpm prisma:generate` after schema changes.
- Add corresponding files to `packages/types`:
  - `AssetSubmission.ts`, `Verdict.ts`, `Signal.ts`, `ReasonCode.ts`
- Add to `.eslintrc.json` the boundary rule blocking imports of payment modules from
  `services/trust-engine`.
