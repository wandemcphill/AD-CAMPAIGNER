# Settlement Layer Architecture

**Status**: Commit `3696ff3` — Provider-neutral settlement layer implemented with mock provider

## Overview

The settlement layer manages the complete lifecycle of financial transfers from FxQuote (locked rate) through provider submission, status tracking, webhook handling, and reconciliation. It is **completely provider-agnostic** — no Wise, Stripe, or other provider logic is embedded in the core architecture.

---

## Architecture Philosophy

### Separation of Concerns

```
FX Layer (Rate Management)
↓ (FxQuote: locked rate + amounts)
Settlement Layer (Payment Execution)
↓ (SettlementInstruction: state machine)
Provider Layer (Wise, Stripe, etc.)
↓ (SettlementProvider interface)
Ledger Layer (Financial Recording)
```

**Key principle**: Settlement layer does NOT know which provider is active. It only knows the `SettlementProvider` interface.

### Idempotency & Safety

- Every settlement instruction has a unique `idempotencyKey`
- Submitted transfers are safely retryable (won't create duplicates in real providers)
- Webhook events are stored + replayed (safe from duplicate processing)
- Reconciliation detects divergences (FT state vs provider state mismatch)

### Graduated Degradation

1. **Success path**: Submit → Provider ✓ → Webhook → COMPLETED
2. **Polling path**: Submit → Poll status → COMPLETED (no webhook needed)
3. **Timeout path**: Submit → Timeout → Mark PROCESSING → Manual reconciliation
4. **Failure path**: Submit → Provider ✗ → FAILED → Retry available (safe due to idempotency)

---

## Data Models

### SettlementInstruction

The core settlement record. Lifecycle from creation to completion.

```typescript
SettlementInstruction {
  id: string                                 // Unique ID
  quoteId: string                            // FK to FxQuote (locked rate)
  workspaceId: string                        // Multi-tenancy
  partnerId: string                          // Who's receiving the funds
  beneficiaryId?: string                     // Destination account/person

  // Customer Input
  sourceAmountMinor: BigInt                  // e.g., 1,550,000 kobo (₦15,500)
  sourceCurrency: string                     // Usually "NGN"

  // Settlement Target
  destinationAmountMinor: BigInt             // e.g., 10,000 cents ($100)
  destinationCurrency: string                // "USD", "GBP", "EUR"

  // FX Details (locked at quote time, never changes)
  fxRateMicros: BigInt                       // Locked customer rate (1.55M = ₦1.55/USD)
  spreadBps: Int                             // 150 = 1.5%
  bufferBps: Int                             // 100 = 1%
  feesMinor: BigInt                          // Operational fees (optional)
  netAmountMinor: BigInt                     // What beneficiary gets (dest - fees)

  // Beneficiary Details
  beneficiaryName?: string
  beneficiaryReference: string               // Bank account, email, mobile money ID, etc.
  metadata: JSON                             // Provider-specific data

  // Settlement State
  status: SettlementInstructionStatus        // PENDING, SUBMITTED, PROCESSING, COMPLETED, etc.
  provider: string                           // "wise", "stripe", "mock", etc.
  providerReference?: string                 // Transfer ID from provider
  providerStatus?: string                    // Provider's status code
  providerTimestamp?: DateTime               // When provider recorded it

  // Error Tracking
  errorCode?: string
  errorReason?: string                       // "Bank account invalid", "Network timeout", etc.
  lastErrorAt?: DateTime
  retryCount: Int                            // Attempts made
  maxRetries: Int                            // Ceiling (default: 3)

  // Reconciliation
  reconciliationState: SettlementReconciliationState  // SYNCED, DIVERGED, etc.
  reconciliationNote?: string

  // Idempotency
  idempotencyKey: string @unique             // Stable key for duplicate detection

  // Timeline
  createdAt: DateTime
  createdBy?: string
  readyAt?: DateTime
  submittedAt?: DateTime
  completedAt?: DateTime
  failedAt?: DateTime
  updatedAt: DateTime

  // Indexes
  @@index([quoteId])
  @@index([partnerId, status])
  @@index([status, createdAt])
  @@index([provider, providerReference])
  @@index([idempotencyKey])
}
```

### SettlementReconciliation

Tracks whether FlipTrybe state matches provider state.

```typescript
SettlementReconciliation {
  id: string                                 // Unique ID
  settlementInstructionId: string @unique    // 1:1 with instruction

  // FlipTrybe recorded state
  ftStatus: SettlementInstructionStatus
  ftProviderReference?: string               // What we think the provider said
  ftAmountMinor?: BigInt                     // What we expect to send
  ftTimestamp?: DateTime                     // When we recorded it

  // Provider reported state
  providerStatus?: string                    // What provider actually said
  providerAmountMinor?: BigInt               // What provider will actually send
  providerTimestamp?: DateTime               // When provider recorded it

  // Comparison
  statusMatch: Boolean                       // true if ftStatus matches providerStatus
  amountMatch: Boolean                       // true if amounts match
  resolved: Boolean                          // true if both match

  // Resolution
  resolvedBy?: string                        // User who resolved divergence
  resolutionNote?: string                    // Why/how it was resolved

  // Timeline
  createdAt: DateTime
  updatedAt: DateTime

  // Indexes
  @@unique([settlementInstructionId])
  @@index([resolved, statusMatch, amountMatch])
}
```

### SettlementWebhookEvent

Stores provider webhooks for audit + replay.

```typescript
SettlementWebhookEvent {
  id: string                                 // Unique ID
  settlementInstructionId?: string           // FK (can be null if we don't recognize the provider ID)

  provider: string                           // "wise", "stripe", etc.
  providerEventId: string                    // Provider's event ID (unique per provider)
  eventType: string                          // "transfer.completed", "transfer.failed", etc.

  rawPayload: JSON                           // Original webhook payload
  parsedData: JSON                           // Normalized data (provider-agnostic)

  // Processing
  processed: Boolean                         // true when parsed + instruction updated
  processedAt?: DateTime
  processError?: string                      // If parsing failed

  // Timeline
  receivedAt: DateTime

  // Indexes
  @@unique([provider, providerEventId])      // Duplicate detection
  @@index([settlementInstructionId])
  @@index([provider, processed])
}
```

---

## Provider Interface

### SettlementProvider

```typescript
interface SettlementProvider {
  readonly name: string;

  // Create a transfer (must be idempotent)
  createTransfer(request: SettlementTransferRequest): Promise<SettlementTransfer>;

  // Get transfer status (safe to call multiple times)
  getTransferStatus(providerReference: string): Promise<SettlementTransfer>;

  // Cancel transfer (optional; not all providers support)
  cancelTransfer?(providerReference: string): Promise<{ cancelled: boolean; reason?: string }>;

  // Provider health
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
```

### SettlementTransferRequest

What we send to the provider:

```typescript
interface SettlementTransferRequest {
  idempotencyKey: string;              // Unique per logical transfer
  sourceAmountMinor: bigint;           // Input (e.g., 1,550,000 kobo)
  sourceCurrency: string;              // "NGN"
  destinationAmountMinor: bigint;      // Output (e.g., 10,000 cents)
  destinationCurrency: string;         // "USD"
  fxRateMicros: bigint;                // Locked rate (informational)
  beneficiaryName: string | undefined;
  beneficiaryReference: string;        // Bank account, email, etc.
  metadata?: Record<string, any>;      // Provider-specific data
}
```

### SettlementTransfer

What the provider returns:

```typescript
interface SettlementTransfer {
  id: string;                          // Provider's transfer ID
  source: {
    amount: bigint;
    currency: string;
  };
  destination: {
    amount: bigint;
    currency: string;
  };
  beneficiary: {
    name: string | undefined;
    reference: string;
  };
  fxRate?: bigint;                     // Provider's FX rate (may differ from ours)
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  providerReference: string;           // Stable ID (maps to SettlementInstruction.providerReference)
  providerTimestamp?: Date;            // When provider created it
  errorReason?: string;                // If failed
}
```

### Mock Settlement Provider

For development/testing without real money:

```typescript
createMockSettlementProvider(): SettlementProvider {
  // Simulates:
  // - Immediate success (instant completion)
  // - Failure (rejected by provider)
  // - Timeout (stays in PROCESSING)
  // - Duplicate detection (idempotencyKey memoization)
  // - Status progression (PROCESSING → COMPLETED over time)
  
  // Activated via metadata: { simulation: "success" | "failure" | "timeout" }
}
```

---

## Settlement Lifecycle

### Step 1: Quote → Settlement Instruction

```typescript
// After FxQuote is USED, create settlement
const instruction = await settlement.createSettlementInstruction(quoteId, {
  workspaceId,
  partnerId,
  destinationAmountMinor: 10_000,    // $100
  feesMinor: 100,                    // $1 fee
  beneficiaryReference: "user@wise.com",
  metadata: { ... }
});

// Returns:
{
  id: "settle_xyz",
  status: "PENDING",
  sourceAmountMinor: 1_550_000n,      // ₦15,500
  destinationAmountMinor: 10_000n,    // $100
  netAmountMinor: 9_900n,             // $99 (after fee)
  fxRateMicros: 1_550_000_000n,       // Locked from quote
  createdAt: now()
}
```

### Step 2: Submit to Provider

```typescript
// Admin or auto-job calls submit
const submitted = await settlement.submitSettlement(instructionId);

// Internally:
// 1. Construct SettlementTransferRequest from instruction
// 2. Call settlementProvider.createTransfer(request)
// 3. Update instruction with providerReference + status
// 4. Return updated instruction

// Returns:
{
  ...same instruction,
  status: "SUBMITTED",
  providerReference: "wise_transfer_12345",
  submittedAt: now(),
  providerStatus: "PROCESSING"
}
```

### Step 3a: Webhook Received (Best Case)

```typescript
// POST /admin/settlements/webhook/wise
{
  eventId: "evt_wise_12345",
  eventType: "transfer.completed",
  payload: {
    transfer_id: "wise_transfer_12345",
    status: "completed",
    amount: 100,
    currency: "USD",
    recipient_account: "..."
  }
}

// Handler:
// 1. Store SettlementWebhookEvent (for audit + replay)
// 2. Find SettlementInstruction by providerReference
// 3. Update status to COMPLETED + completedAt = now()
// 4. Create reconciliation record (SYNCED)
```

### Step 3b: Poll Status (If No Webhook)

```typescript
// Client or admin polls manually
const polled = await settlement.pollSettlementStatus(instructionId);

// Internally:
// 1. Get instruction by ID
// 2. Call settlementProvider.getTransferStatus(providerReference)
// 3. Update providerStatus + status based on response
// 4. Update completedAt if status is COMPLETED
// 5. Return updated instruction

// Returns:
{
  ...same instruction,
  status: "COMPLETED",
  providerStatus: "COMPLETED",
  completedAt: now()
}
```

### Step 4: Reconciliation

```typescript
// Periodically or on-demand:
const reconciled = await settlement.reconcileSettlement(instructionId);

// Compares:
// - instruction.status vs providerStatus
// - instruction.destinationAmountMinor vs provider's amount
// - instruction.submittedAt vs provider's timestamp

// Outcomes:
// - SYNCED: Both agree → proceed to ledger
// - DIVERGED: Disagree → mark REQUIRES_REVIEW → human investigation
// - UNRECONCILED: Unable to check (provider offline) → retry later

// Returns:
{
  id: "recon_xyz",
  settlementInstructionId,
  ftStatus: "COMPLETED",
  providerStatus: "COMPLETED",
  statusMatch: true,
  amountMatch: true,
  resolved: true
}
```

---

## State Machine

### Instruction Status

```
PENDING
  ↓ (admin clicks submit)
READY
  ↓ (submitSettlement called)
SUBMITTED
  ↓ (provider responds)
PROCESSING
  ↓ (provider processes)
COMPLETED ← SUCCESS
  or
FAILED ← FAILURE (retry available via idempotencyKey)
  or
REQUIRES_REVIEW ← DIVERGENCE (reconciliation mismatch)

CANCELLED (admin cancel, if provider supports it)
```

### Reconciliation State

```
UNRECONCILED (initial)
  ↓ (first reconciliation run)
SYNCED (FT ✓ provider ✓)
  ↓ (proceed to ledger)
or
DIVERGED (FT ≠ provider)
  ↓ (mark instruction as REQUIRES_REVIEW)
  ↓ (human investigation)
MANUAL_REVIEW_REQUIRED (awaiting human decision)
```

---

## Idempotency & Safety

### Duplicate Transfer Prevention

Each SettlementInstruction has a **unique `idempotencyKey`**:

```typescript
idempotencyKey = `settlement_${quoteId}_${transactionId}_${timestamp}`
```

Flow:

1. **First call** to `submitSettlement(instructionId)`:
   - Extract `instruction.idempotencyKey`
   - Call `settlementProvider.createTransfer({ idempotencyKey, ... })`
   - Provider stores idempotencyKey → transfer mapping
   - Returns transfer ID, status

2. **Retry** (network timeout, job restart, etc.):
   - Same idempotencyKey
   - Provider recognizes it, returns **same transfer ID**
   - No duplicate charge

3. **Real provider implementation**:
   - Wise API: https://docs.wise.com/api-reference/transfers#create-transfer (`idempotencyKey` header)
   - Stripe: https://stripe.com/docs/api/idempotent_requests (`Idempotency-Key` header)

### Webhook Replay Safety

SettlementWebhookEvent has **unique constraint on (provider, providerEventId)**:

```typescript
@@unique([provider, providerEventId])
```

Flow:

1. **First webhook** `evt_wise_12345`:
   - Check uniqueness constraint
   - Parse + update instruction
   - Store SettlementWebhookEvent with `processed: true`

2. **Duplicate webhook** `evt_wise_12345`:
   - Unique constraint violation → ignored (idempotent)
   - Or gracefully handle: `if (event.processed) { return; }`

---

## Error Handling & Retries

### Retryable Errors

- Network timeout
- Provider rate limit
- Temporary provider unavailability
- Webhook not received (poll status instead)

**Safe to retry** because:
- idempotencyKey prevents duplicate charges
- Polling eventually fetches true status

### Non-Retryable Errors

- Invalid beneficiary account (permanent rejection)
- Beneficiary KYC failure
- Amount exceeds transfer limit
- Unsupported currency pair

**Handling**:
- Status → FAILED
- `errorReason` set
- Mark for manual review
- Don't auto-retry (requires human fix)

### Max Retries

```typescript
instruction.retryCount < instruction.maxRetries (default: 3)
```

After max retries, status → FAILED + REQUIRES_REVIEW.

---

## Webhook Architecture

### Provider-Agnostic Handler

```typescript
@Post("webhook/:provider")
async handleWebhook(
  @Param("provider") provider: string,    // "wise", "stripe", etc.
  @Body() body: any
) {
  // Store raw event
  const event = await db.settlementWebhookEvent.create({
    provider,
    providerEventId: body.eventId,
    eventType: body.type,
    rawPayload: body,
    processed: false
  });

  // Delegate parsing to provider adapter (NOT implemented yet)
  // This is where provider-specific logic lives
  const parsed = parseProviderWebhook(provider, body);

  // Map to instruction
  const instruction = await db.settlementInstruction.findUnique({
    where: { providerReference: parsed.transferId }
  });

  if (!instruction) {
    logger.warn(`Webhook for unknown transfer: ${parsed.transferId}`);
    return;
  }

  // Update instruction
  await db.settlementInstruction.update({
    where: { id: instruction.id },
    data: {
      providerStatus: parsed.status,
      completedAt: parsed.status === "COMPLETED" ? now() : undefined,
      failedAt: parsed.status === "FAILED" ? now() : undefined,
      errorReason: parsed.errorReason
    }
  });

  // Mark event processed
  await db.settlementWebhookEvent.update({
    where: { id: event.id },
    data: { processed: true, processedAt: now(), parsedData: parsed }
  });
}
```

### Webhook Authentication

**Per-provider basis** (not yet implemented):

- **Wise**: Verify `X-Timestamp` + signature in Authorization header
- **Stripe**: Verify `X-Stripe-Signature` via webhook secret
- **Generic**: Check webhook secret against request

---

## API Endpoints

### Customer/Partner Endpoints

```
POST /v1/settlements
  Create settlement instruction from quote

GET /v1/settlements/:id
  Fetch settlement details

GET /v1/settlements?partnerId=...&status=...
  List settlements (filtered)

POST /v1/settlements/:id/submit
  Submit to provider (idempotent)

POST /v1/settlements/:id/poll
  Poll status from provider

POST /v1/settlements/:id/reconcile
  Check reconciliation status
```

### Admin Endpoints

```
GET /admin/settlements
  List all settlements (admin view)

GET /admin/settlements/:id
  Fetch settlement with full metadata

POST /admin/settlements/:id/retry
  Safely retry failed settlement (idempotent)

POST /admin/settlements/webhook/:provider
  Receive & process provider webhooks
```

---

## Ledger Integration (Not Yet Implemented)

When settlement reaches COMPLETED state, transfer to ledger:

```typescript
// NOT YET DONE - placeholder design
async completeSettlementToLedger(instructionId: string) {
  const instruction = await db.settlementInstruction.findUnique({ ... });

  if (instruction.status !== "COMPLETED") {
    throw new Error("Can only ledger completed settlements");
  }

  const reconciliation = await db.settlementReconciliation.findUnique({
    where: { settlementInstructionId: instructionId }
  });

  if (!reconciliation?.resolved) {
    throw new Error("Settlement must be reconciled before ledgering");
  }

  // Create ledger entries
  await db.$transaction(async (tx) => {
    // Debit from payout wallet (partner funds out)
    await tx.ledgerEntry.create({
      workspaceId: instruction.workspaceId,
      partnerId: instruction.partnerId,
      kind: "DEBIT",
      amountMinor: instruction.sourceAmountMinor,
      currency: instruction.sourceCurrency,
      reference: instruction.id,
      idempotencyKey: instruction.idempotencyKey
    });

    // Credit to settlement (funds in transit)
    await tx.settlementFund.create({
      settlementInstructionId: instruction.id,
      amountMinor: instruction.netAmountMinor,
      currency: instruction.destinationCurrency,
      status: "IN_TRANSIT"
    });

    // Mark settlement as ledgered
    await tx.settlementInstruction.update({
      where: { id: instructionId },
      data: { ledgeredAt: now() }
    });
  });
}
```

---

## Testing Checklist

### Unit Tests

- [ ] Settlement instruction creation (valid FxQuote)
- [ ] Settlement submission (idempotent, safe retry)
- [ ] Status polling (provider status → instruction status)
- [ ] Reconciliation (SYNCED vs DIVERGED)
- [ ] Mock provider (success, failure, timeout simulations)

### Integration Tests

- [ ] Complete flow: Quote → Settlement → Submit → Poll → Complete
- [ ] Webhook handling (received + processed + stored)
- [ ] Duplicate webhook detection (unique constraint)
- [ ] Duplicate submission detection (idempotencyKey)
- [ ] Reconciliation divergence detection (flag for review)

### E2E Tests

- [ ] Happy path: Quote → $100 settlement → $99 net (after $1 fee) → COMPLETED
- [ ] Failure path: Submit → Provider rejects → FAILED
- [ ] Retry path: Fail → Retry → Success
- [ ] Timeout path: Submit → Timeout → Poll → Success
- [ ] Divergence path: FT says COMPLETED, provider says PROCESSING → DIVERGED

---

## What's NOT Yet Implemented

1. **Real Provider Adapters**
   - No Wise integration yet
   - No Stripe integration yet
   - No CBN/manual settlement processor yet

2. **Webhook Parsing**
   - Placeholder handler stores raw payload
   - Provider-specific parsing not yet built
   - Signature verification not yet wired

3. **Ledger Integration**
   - Settlement completion doesn't yet create ledger entries
   - Partner wallet updates not yet connected
   - Revenue recognition not yet implemented

4. **KYC/KYB Gating**
   - No beneficiary verification before settlement
   - No compliance checks
   - No sanctions/AML screening

5. **Monitoring & Alerts**
   - No Slack alerts on failures
   - No email notifications
   - No settlement dashboard

6. **Batch Settlement**
   - Single transfer per instruction
   - No batch processing for efficiency

---

## Next Steps (Provider Selection Phase)

After this architecture is verified:

1. **Choose real provider** (Wise, Stripe, etc.)
2. **Implement SettlementProvider for chosen provider**
3. **Wire webhook parsing** (provider-specific payload → standard format)
4. **Implement ledger integration** (settlement → wallet update)
5. **Add KYC checks** (beneficiary verification before settlement)
6. **Build admin dashboard** (settlement monitoring + manual intervention)
7. **Launch diaspora payouts** (production settlement flow)

---

## Files

| File | Purpose |
|------|---------|
| `packages/database/prisma/schema.prisma` | SettlementInstruction, SettlementReconciliation, SettlementWebhookEvent models + enums |
| `packages/providers/src/index.ts` | SettlementProvider interface + mock implementation |
| `apps/api/src/modules/fx/settlement.service.ts` | Settlement business logic |
| `apps/api/src/modules/fx/settlement.controller.ts` | API endpoints (v1 + admin) |
| `apps/api/src/modules/fx/settlement.dtos.ts` | Request/response DTOs |
| `apps/api/src/modules/fx/fx.module.ts` | Module wiring (services + controllers) |

---

## Principles

- **No Provider Lock-In**: Swap providers by implementing SettlementProvider interface
- **Idempotent Operations**: Safe to retry indefinitely (no duplicates)
- **Audit Trail**: Every event logged (webhooks, state changes, errors)
- **Reconciliation**: Automatic divergence detection + manual review flag
- **Graceful Degradation**: Works with polling if webhooks fail
- **Financial Safety**: Separate quote lock from settlement execution; separate settlement from ledger
