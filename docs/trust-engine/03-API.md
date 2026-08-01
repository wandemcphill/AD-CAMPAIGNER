# Trust Engine — API Specification

**Status:** Phase 0 — Design. Nest controllers and DTOs in `apps/api/src/modules/trust-engine`.

---

## 1. Routes and operations

All routes require `@Auth()` and `@WorkspaceContext()` (standard FlipTrybe auth guards).

### 1.1 Submission intake

**POST `/trust/v1/submissions`**
Create and queue a submission for validation.

Request:
```ts
interface CreateSubmissionRequest {
  assetClass: 'GIFT_CARD' | 'AIRTIME_PIN' | ...
  
  // Asset-class-specific profile
  submissionProfile: {
    brand?: string        // user-declared brand
    region?: string
    denomination?: number
    networks?: string[]   // for AIRTIME_PIN
    // ...discriminated by assetClass
  }
  
  // Image upload (for GIFT_CARD)
  mediaAssetId?: string   // FK to existing MediaAsset
  // OR
  uploadUrl?: string      // S3 pre-signed, already uploaded
  
  // Secret (for AIRTIME_PIN, ECODE submissions)
  secret?: string         // PIN / code / serial — encrypted in transit (TLS)
  
  idempotencyKey?: string // optional; if omitted, UUID is generated
}
```

Response:
```ts
interface CreateSubmissionResponse {
  submissionId: string
  status: 'PENDING' | 'PROCESSING'
  mediaAsset?: {
    id: string
    url: string
    secure_url: string
  }
  createdAt: string  // ISO8601
  
  // User-facing message
  message: string    // "Submission received. We'll verify it in the next 30 seconds."
}
```

Errors:
- `400 BadRequest` — invalid assetClass, missing mediaAssetId for GIFT_CARD, invalid
  submissionProfile shape per validator.
- `403 Forbidden` — workspace has disabled this asset class.
- `413 PayloadTooLarge` — uploaded file exceeds limits (see §2, Configuration).
- `429 TooManyRequests` — rate limit exceeded (per-actor, keyed on trust score).
- `500 InternalServerError` — system failure; submissionId returned for ops investigation.

---

### 1.2 Status polling

**GET `/trust/v1/submissions/{submissionId}`**
Poll for verdict.

Response:
```ts
interface SubmissionStatusResponse {
  submissionId: string
  status: 'PENDING' | 'PROCESSING' | 'ACCEPTED' | 'REVIEW' | 'REJECTED'
  assetClass: string
  
  createdAt: string
  processedAt?: string
  
  // Only populated if terminal (ACCEPTED | REJECTED | REVIEW)
  verdict?: {
    result: 'ACCEPT' | 'REVIEW' | 'REJECT'
    reasons: string[]       // reason codes: DUPLICATE_EXACT, QUALITY_TOO_DARK, ...
    explained: string       // user-friendly message
  }
  
  // If REVIEW, the queue position
  moderationQueue?: {
    position: number
    estimatedWait: number   // seconds
  }
  
  // If ACCEPTED, next step
  nextStep?: 'APPROVE_AND_PAY' | 'PROVIDE_MORE_INFO'
}
```

---

### 1.3 Webhook stream (Socket.IO)

**Event: `submission:verdict`**
Real-time verdict push (optional; client may poll instead).

```ts
socket.on('submission:verdict', (event: {
  submissionId: string
  verdict: 'ACCEPT' | 'REVIEW' | 'REJECT'
  explained: string
  reasons: string[]
}))
```

---

### 1.4 Admin: submission detail

**GET `/trust/v1/admin/submissions/{submissionId}` (requires `trustEngineAdmin`)**
Detailed review surface.

Response:
```ts
interface AdminSubmissionDetail {
  submission: {
    id: string
    userId: string
    workspaceId: string
    status: string
    assetClass: string
    submissionProfile: Json
    createdAt: string
  }
  
  mediaAsset: {
    id: string
    url: string
    byteSize: number
    width: number
    height: number
    checksumSha256: string
  }
  
  validationRuns: Array<{
    id: string
    verdict: string
    verdictReasons: string[]
    fraudScore: number
    trustScore: number
    configVersion: number
    totalDurationMs: number
    createdAt: string
    
    stages: Array<{
      stageKey: string
      status: 'PASS' | 'FAIL' | 'INCONCLUSIVE'
      reasonCodes: string[]
      resultData: Json         // stage-specific evidence
      durationMs: number
    }>
  }>
  
  ocrResult?: {
    brand: string
    regionCode: string
    denomination: string
    visibleText: string[]
    overallConfidence: number
  }
  
  qualityResult?: {
    blurScore: number
    darkScore: number
    glareScore: number
    croppingDetected: boolean
    partialCardVisible: boolean
  }
  
  moderationQueue?: {
    reason: string
    status: string
    reviewer?: string
    decision?: string
    decidedAt?: string
  }
  
  auditLog: Array<{
    action: string
    actor: string
    timestamp: string
    metadata: Json
  }>
}
```

---

### 1.5 Admin: moderation queue

**GET `/trust/v1/admin/moderation-queue`**
List pending reviews.

Query params:
```
?status=PENDING&limit=50&offset=0&assignedTo=user123&sort=created_desc
```

Response:
```ts
interface ModerationQueueResponse {
  items: Array<{
    id: string
    submissionId: string
    reason: 'VERDICT_REVIEW' | 'SYSTEM_FAILURE' | ...
    createdAt: string
    assignedTo?: string
    thumbnail: string       // secure_url from MediaAsset
  }>
  total: number
  pageSize: number
  offset: number
}
```

---

### 1.6 Admin: override verdict

**POST `/trust/v1/admin/submissions/{submissionId}/override`**
Moderator decision.

Request:
```ts
interface VerdictOverrideRequest {
  decision: 'ACCEPT' | 'REJECT' | 'RESUBMIT'
  reason: string           // why the mod is overriding
  internalNote?: string    // not shown to user
}
```

Response:
```ts
interface VerdictOverrideResponse {
  submissionId: string
  previousVerdict: string
  newVerdict: string
  overriddenAt: string
  overriddenBy: string
}
```

Behavior:
- `ACCEPT` updates `AssetSubmission.status` to `ACCEPTED` and emits `submission_accepted`
  event (consumed by `DigitalValueService`).
- `REJECT` updates status to `REJECTED` and emits `submission_rejected` event.
- `RESUBMIT` marks status back to `PENDING`, clears `lastValidationRunId`, enqueues
  for re-validation.
- All overrides logged to `AuditLog` with full context.

---

### 1.7 Admin: reveal secret (PII action)

**POST `/trust/v1/admin/submissions/{submissionId}/reveal-secret`** (requires
`trustEngineAdmin` + `readSecrets` permission)
Decrypt and return the card code.

Response:
```ts
interface RevealSecretResponse {
  secretKind: string
  value: string            // the actual PIN / code
  encryptionKeyRef: string // which key version
  revealedAt: string
  revealedBy: string       // user ID
}
```

Behavior:
- Requires explicit additional permission (not just admin).
- Logs to `AuditLog` with `action='secret_revealed'`, user and timestamp.
- Value is returned once and not cached; subsequent calls require re-auth.

---

### 1.8 Admin: configuration management

**GET `/trust/v1/admin/config`**
Current active configuration.

Response:
```ts
interface ConfigurationResponse {
  version: number
  appliedAt: string
  
  thresholds: {
    acceptMax: number      // fraud score ≤ this → ACCEPT
    rejectMin: number      // fraud score ≥ this → REJECT
    // between is REVIEW
  }
  
  stageLimits: {
    maxDurationMs: number
    maxExternalCalls: number
    maxCostMicro: number
  }
  
  brands: Array<BrandRuleSet>
  
  inference: {
    provider: string       // 'google_vision' | 'anthropic' | 'local'
    qualityThreshold: number
    ocrMinConfidence: number
  }
}
```

**POST `/trust/v1/admin/config`**
Update configuration (requires `trustEngineAdmin`).

Request: same shape as response above.

Response:
```ts
interface ConfigUpdateResponse {
  newVersion: number
  appliedAt: string
  affectsNewSubmissionsOnly: boolean
  message: string
}
```

Behavior:
- Creates a new config version.
- Immediately applies to new submissions; in-flight runs continue with old version.
- No downtime.

---

### 1.9 Admin: analytics

**GET `/trust/v1/admin/analytics`**
Aggregate metrics.

Query params:
```
?startDate=2025-01-01&endDate=2025-01-31&assetClass=GIFT_CARD&breakdown=daily|hourly|status
```

Response:
```ts
interface AnalyticsResponse {
  period: { start: string, end: string }
  assetClass: string
  
  totals: {
    submissions: number
    accepted: number
    review: number
    rejected: number
    duplicates: number
    systemFailures: number
  }
  
  breakdown: Array<{
    date: string          // or hour, depending on ?breakdown param
    submissions: number
    accepted: number
    review: number
    rejected: number
    avgProcessingMs: number
    fraudDetected: number  // REJECT verdict
  }>
  
  quality: {
    avgQualityScore: number
    avgOcrConfidence: number
    avgFraudScore: number
  }
  
  byBrand?: Array<{
    brand: string
    region?: string
    submissions: number
    acceptRate: number     // 0–100
    rejectionReasons: { [reason: string]: number }
  }>
}
```

---

## 2. Error responses

All error responses follow the standard FlipTrybe format:

```ts
interface ErrorResponse {
  error: {
    code: string           // 'DUPLICATE_EXACT' | 'QUALITY_TOO_DARK' | ...
    message: string        // user-facing
    details?: Json         // operational detail (not shown to end user)
  }
  requestId: string        // for support tickets
  timestamp: string
}
```

---

## 3. Idempotency and retries

- All POST endpoints are idempotent via `idempotencyKey`.
- The key is required on intake and returned in responses.
- Client may retry with the same key; server returns the original response + `200 OK`
  or `201 Created` (not `400 Conflict`).
- Key expires after 24 hours.

---

## 4. Rate limiting

Per-actor rate limits are computed from `UserTrustScore`:

```
- High trust (score ≥ +50): 100 submissions/hour
- Medium trust (0 to +50): 50 submissions/hour
- Low trust (< 0): 10 submissions/hour
- Blocked (< -100): 0 submissions/hour
```

Limits are configurable. Hitting a limit returns `429 TooManyRequests` with
`Retry-After: N` header.

---

## 5. Implementation notes

- DTOs in `apps/api/src/modules/trust-engine/dtos/`.
- Controllers in `apps/api/src/modules/trust-engine/trust-engine.controller.ts`.
- Serialiser excludes secrets by default: `@Exclude()` on `SubmissionSecret`.
- All timestamps are ISO8601 UTC.
- All IDs are UUIDs.
- All monetary values in minor units (kobo / cents), as per `packages/payments`.
