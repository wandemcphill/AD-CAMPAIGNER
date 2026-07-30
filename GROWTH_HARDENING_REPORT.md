# Growth Hardening Report

Date: 2026-06-05

Scope: Growth Services marketplace supplier execution, payment gating, fund reservation, duplicate prevention, failure recovery, refund accounting, monitoring, and admin Growth controls. Source material reviewed: `ABUSE_PREVENTION_REPORT.md`, `SECURITY_AUDIT_REPORT.md`, and `docs/GROWTH_SERVICES_MARKETPLACE.md`.

## Executive Summary

The critical Growth marketplace execution blockers identified in the source reports have been closed for the current API execution path:

- Supplier-backed Growth orders now require a wallet reservation before supplier submission.
- Reserved funds are held with idempotent ledger entries and reduce available wallet balance.
- Duplicate active Growth supplier submissions are blocked.
- Reused idempotency keys return the existing order instead of submitting again.
- Supplier submission failure releases the reservation.
- Completion captures reserved funds; refund reverses captured funds or releases an uncaptured hold.
- Terminal order states are guarded so completed orders can only transition to refunded, refunded orders cannot move again, and failed orders can only transition to refunded.
- Growth monitoring now tracks unpaid execution attempts, duplicate submission prevention, supplier submission failures, and fulfillment delays.
- Growth admin service listing/mutation and supplier audit now require authenticated workspace context at the service boundary.

Current result:

| Success criterion | Status |
| --- | --- |
| Unpaid supplier execution = 0 | Met in code and tests |
| Duplicate supplier orders = 0 | Met in code and tests |
| Critical Growth marketplace findings = 0 | Met for the current Growth supplier execution path |

## Remaining Blockers

### Critical

None remaining in the current Growth supplier execution path.

### High Priority Before Live Multi-Instance Supplier Rollout

| Area | Risk | Required action |
| --- | --- | --- |
| Persistence | Growth orders and Growth reservations still live in `PlatformService` memory, matching the current marketplace foundation. A process restart can lose local Growth order state even though a live supplier order may still exist. | Add persisted `GrowthOrder` or extend persisted `SmmOrder` linkage, and create wallet hold/order/supplier submission inside a database transaction. |
| Invoice-specific path | Growth does not yet have a dedicated Growth invoice object. The safe payment path is wallet funded and reserved before execution. | Require paid Growth invoices to settle into wallet ledger credit, or add a `GrowthInvoice` link to the reservation. |
| External alerting | Monitoring counters are surfaced in API overview state, but not yet exported to the external monitoring stack. | Export Growth counters to the metrics provider and configure alert thresholds. |
| Rate limiting | Source reports still identify missing global rate limiting. | Add throttling for `POST /v1/growth/orders`, payment intents, auth, and supplier/admin endpoints. |

## Code Fixes

### Payment Gating

File: `apps/api/src/modules/platform.service.ts`

- `createGrowthOrder` now computes quote and fraud result, then reserves wallet funds before supplier submission.
- If available wallet balance is insufficient, order creation throws before `smmSupplier.createOrder`.
- A blocked payment attempt records:
  - monitoring event: `UNPAID_EXECUTION_ATTEMPT`
  - audit action: `growth.payment_blocked`

Result: supplier execution is impossible unless funds are already available and reserved.

### Fund Reservation and Locking

Files:

- `apps/api/src/modules/platform.service.ts`
- `packages/types/src/index.ts`

Implemented Growth finance fields:

- `idempotencyKey`
- `paymentStatus`
- `reservationLedgerEntryId`
- `captureLedgerEntryId`
- `releaseLedgerEntryId`
- `refundLedgerEntryId`
- `refundEligibility`
- `refundReviewStatus`

Implemented ledger transitions:

| Transition | Ledger action | Payment status |
| --- | --- | --- |
| Order accepted for execution/review | `HOLD` | `FUNDS_RESERVED` or `MANUAL_REVIEW` |
| Supplier submission failed | `RELEASE` | `FUNDS_RELEASED` |
| Order completed | `RELEASE` hold + `DEBIT` capture | `FUNDS_CAPTURED` |
| Order refunded after capture | `REVERSAL` | `REFUNDED` |
| Order refunded before capture | `RELEASE` | `REFUNDED` |

Wallet `heldBalance` is now calculated from active Growth holds instead of a hard-coded demo value.

### Supplier Idempotency and Duplicate Prevention

Files:

- `apps/api/src/modules/platform.service.ts`
- `apps/api/src/modules/platform.dtos.ts`

Implemented:

- `CreateGrowthOrderDto.idempotencyKey`
- idempotency lookup by workspace and key
- active duplicate detection by workspace, service, destination URL, and quantity
- duplicate prevention monitoring event: `SUPPLIER_SUBMISSION_SKIPPED_DUPLICATE`

Behavior:

- Same idempotency key returns the existing order.
- Same active order with a different idempotency key is rejected before supplier submission.

### Failure Recovery

File: `apps/api/src/modules/platform.service.ts`

Handled cases:

| Failure | Behavior |
| --- | --- |
| Supplier unavailable during submission | Order becomes `FAILED`, hold is released, failure is monitored. |
| Supplier timeout during submission | Same as supplier unavailable. |
| Supplier status refresh unavailable | Order keeps last known state; fulfillment delay monitoring is recorded. |
| Supplier partial delivery | Supplier `PARTIAL` maps to `IN_PROGRESS`; delivered quantity is calculated from supplier `remains`. |
| Supplier rejection/failure snapshot | Order becomes `FAILED`; reserved funds are released idempotently. |
| Supplier cancellation/refund snapshot | Order becomes `REFUNDED`; captured funds reverse or uncaptured holds release. |

### Refund Logic

File: `apps/api/src/modules/platform.service.ts`

Implemented:

- automatic refund eligibility for failed/refunded terminal states
- ledger reversal for captured orders
- hold release for uncaptured orders
- audit actions:
  - `growth.funds_released`
  - `growth.refund_recorded`
  - `growth.status_refunded`

Manual review path:

- fraud-review or manual-routing orders keep funds held and supplier submission is skipped.
- refund/release/capture happens only when the admin moves the order into a terminal financial state.

### Monitoring and Audit Trail

File: `apps/api/src/modules/platform.service.ts`

`getGrowthOverview` now includes:

- `monitoring.unpaidExecutionAttempts`
- `monitoring.failedSupplierOrders`
- `monitoring.duplicateSupplierSubmissionsPrevented`
- `monitoring.fulfillmentDelays`
- `monitoring.recentEvents`

Audit log now includes Growth finance actions alongside the demo campaign audit record.

### Admin Growth Control Hardening

Files:

- `apps/api/src/modules/platform.controllers.ts`
- `apps/api/src/modules/platform.service.ts`

Implemented:

- admin Growth disabled-service listing now calls `listAdminGrowthServices(context)`
- admin Growth service mutation now calls `updateGrowthService(context, code, body)`
- Growth supplier audit now requires context
- controller continues to use `@RequirePermissions("admin:access")`

This closes the Growth-specific admin mutation bypass identified as ABUSE-02/SEC-01 for this controller/service path.

## Order-State Validation

Validated lifecycle:

```text
Order request
  -> quote + fraud check
  -> wallet availability check
  -> HOLD reservation
  -> duplicate/idempotency guard
  -> supplier submission only after reservation
  -> supplier status refresh
  -> terminal financial transition
```

State rules:

| State | Supplier execution allowed? | Financial rule |
| --- | --- | --- |
| `PENDING` | No, unless manual operator later supplies a reference/status | Funds remain held for review. |
| `SUBMITTED` | Already submitted | Funds remain held. |
| `IN_PROGRESS` | Already submitted | Funds remain held until terminal state. |
| `COMPLETED` | No new execution | Hold is released and amount is debited. |
| `FAILED` | No new execution | Hold is released. |
| `REFUNDED` | No new execution | Captured amount is reversed, or uncaptured hold is released. |

Blocked transitions:

- no supplier submission when reservation fails
- no duplicate active supplier submission for same workspace/service/destination/quantity
- no second ledger mutation for repeated terminal transitions because ledger idempotency keys are reused
- no downgrade from `COMPLETED` to `FAILED` or another non-refund state
- no transition out of `REFUNDED`
- no transition from `FAILED` except to `REFUNDED`

## Tests

Commands run:

```bash
corepack pnpm --filter @fliptrybe/api exec vitest run src/modules/platform.service.test.ts
corepack pnpm --filter @fliptrybe/api test
corepack pnpm --filter @fliptrybe/types build
corepack pnpm --filter @fliptrybe/api build
corepack pnpm prisma:validate
```

Results:

- `platform.service.test.ts`: 11 passed
- API test suite: 9 files, 56 tests passed
- `@fliptrybe/types` build: passed
- `@fliptrybe/api` build: passed
- Prisma schema validation: passed

New test coverage:

- unpaid Growth execution is blocked before supplier `createOrder`
- Growth funds are reserved and wallet available balance decreases
- active duplicate supplier submissions are rejected
- idempotency replay returns the existing order
- supplier submission failure releases reserved funds
- completion captures funds
- refund creates reversal and restores wallet balance
- completed orders cannot be downgraded to failed

## Monitoring Recommendations

Wire the in-code monitoring events to production metrics:

| Metric | Type | Alert |
| --- | --- | --- |
| `growth_unpaid_execution_attempts_total` | Counter | Any non-zero production event should page finance/security. |
| `growth_duplicate_submission_prevented_total` | Counter | Spike indicates client retry/idempotency misuse or abuse. |
| `growth_supplier_submission_failed_total` | Counter | Alert on sustained supplier failure rate above 5% over 15 minutes. |
| `growth_fulfillment_delay_total` | Counter | Alert when delayed active orders exceed operational SLA threshold. |
| `growth_reserved_funds_minor` | Gauge | Alert if reserved funds age beyond expected completion plus grace window. |

Operational dashboards should show:

- active holds by age
- submitted orders without supplier status refresh
- failed supplier orders by supplier
- refund/reversal volume
- manual-review queue age
- duplicate submission attempts by workspace

## Production Readiness Checklist

- [x] Supplier submission requires wallet reservation.
- [x] Reservation reduces available wallet balance.
- [x] Supplier failure releases hold.
- [x] Completion captures funds.
- [x] Refund reverses captured funds or releases uncaptured hold.
- [x] Idempotency key prevents retry duplication.
- [x] Equivalent active order duplicate is blocked.
- [x] Growth finance events are auditable.
- [x] Growth admin service mutation requires authenticated admin route and service context.
- [ ] Persist Growth orders and financial linkage transactionally before live multi-instance rollout.
- [ ] Export Growth monitoring events to external metrics/alerts.
- [ ] Add global throttling/rate limiting.
- [ ] Add Growth-specific invoice linkage if invoice checkout will bypass wallet funding.

## Production Deployment Sequence

1. Deploy API build containing Growth payment gating and idempotency.
2. Confirm `POST /v1/growth/orders` requires authenticated `campaign:create`.
3. Confirm admin Growth routes require `admin:access`.
4. Configure live payment provider and verify wallet funding credits ledger before enabling live suppliers.
5. Enable monitoring export for Growth counters.
6. Enable live supplier credentials only after wallet funding and monitoring checks pass.
7. Submit one low-value Growth order in production.
8. Verify order has `reservationLedgerEntryId` before supplier reference appears.
9. Force or simulate supplier failure and verify hold release.
10. Verify completion capture and refund reversal on a controlled test order.

## Rollback Checklist

1. Disable live SMM supplier credentials or set `SMM_PROVIDER` back to mock.
2. Disable affected Growth services through admin controls.
3. Stop accepting new Growth orders.
4. Export `growthMonitoringEvents`, audit logs, wallet ledger, and supplier references for reconciliation.
5. Release uncaptured Growth holds for failed/unsubmitted orders.
6. Reverse captured charges only after refund approval.
7. Reconcile supplier panel orders against local Growth order IDs and idempotency keys.

## Conclusion

The Growth marketplace no longer submits supplier orders for free in the current API path. Funds are reserved first, duplicate submissions are blocked, terminal financial states mutate the ledger, and tests cover the core abuse cases from ABUSE-01, ABUSE-02, ABUSE-07, and ABUSE-08.

The remaining hardening work is production durability and operational export: persist Growth order finance state transactionally, connect metrics to alerts, and rate-limit high-risk routes before enabling live suppliers at scale.
