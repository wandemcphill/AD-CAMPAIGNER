# Abuse Prevention Report

Date: 2026-06-04

Scope: abusive customer behavior, dishonest operator behavior, malicious admin behavior, Growth Marketplace order/refund/pricing abuse, supplier failure handling, OTP/Digital Access abuse controls, rate limiting, and operational mitigations.

Launch gate: FAIL. Abuse controls are incomplete and several Critical issues remain open.

## Executive Summary

The codebase contains useful abuse-control building blocks: SMM fraud scoring, duplicate-destination signals, supplier health checks, retry policies, Digital Access abuse assessment, and OTP attestation/fraud logic. However, several controls are either advisory only, bypassed by public/admin routes, or not connected to real financial settlement.

The main abuse risks are public admin controls, Growth orders without payment, public OTP refund/order APIs, missing rate limits, and missing role checks for operator actions.

## Risk Register

| ID | Severity | Area | Abuse scenario | Status |
| --- | --- | --- | --- | --- |
| ABUSE-01 | Critical | Growth Marketplace | Customer can submit supplier-backed Growth orders without a wallet charge. | Open |
| ABUSE-02 | Critical | Admin/Growth | Public admin Growth service mutation allows pricing/routing/service availability manipulation. | Open |
| ABUSE-03 | Critical | OTP | Public OTP order, refund, wallet, provider control, and pricing endpoints allow unauthorized abuse. | Open |
| ABUSE-04 | Critical | Finance | Negative invoice/hold abuse can mint wallet balance and corrupt reconciliation. | Open |
| ABUSE-05 | High | Operator abuse | Non-admin workspace members can assign themselves, alter campaign status, create placements, add metrics, and publish reports. | Open |
| ABUSE-06 | High | Rate limiting | No global rate limiting for auth, payment intent, Growth order, OTP order, support ticket, or search endpoints. | Open |
| ABUSE-07 | High | Refund abuse | Growth order status can be set to REFUNDED without a financial reversal; OTP refund route is public. | Open |
| ABUSE-08 | Medium | Supplier failure | Growth supplier failure is captured as FAILED, but no payment/hold state exists to refund or reconcile. | Open |
| ABUSE-09 | Medium | Risk controls | SMM/Growth fraud REVIEW outcomes do not require payment-safe manual approval before queue pressure can build. | Open |
| ABUSE-10 | Low | Positive control | Digital Access implements transactional wallet charge/refund and admin scope checks. | Observed |

## Growth Marketplace Audit

### ABUSE-01 - Free Supplier-Backed Growth Orders

Severity: Critical

Proof:

- Growth order creation resolves a service and quantity at `apps/api/src/modules/platform.service.ts:718-735`.
- It computes pricing and fraud assessment at `apps/api/src/modules/platform.service.ts:752-768`.
- It submits to the SMM supplier at `apps/api/src/modules/platform.service.ts:815-838`.
- No wallet debit, hold, invoice, or payment intent is created in that flow at `apps/api/src/modules/platform.service.ts:718-871`.

Reproduction steps:

1. Authenticate as any workspace member.
2. Call `POST /v1/growth/orders` with `{"serviceCode":"tiktok-views","quantity":100}`.
3. Observe a Growth order is created.
4. Confirm no wallet debit or payment record is created.

Estimated impact:

Users can cause supplier spend without payment. With live suppliers, this is direct financial loss.

Recommended fixes:

- Require a wallet hold/debit or completed payment before supplier submission.
- Use a persistent GrowthOrder model with idempotency key and charge linkage.
- Add automated refund/reversal only when charge exists.
- Reject order creation if the wallet cannot pay.

### ABUSE-02 - Public Growth Admin Pricing/Routing Manipulation

Severity: Critical

Proof:

- Admin Growth service listing and mutation do not require request context at `apps/api/src/modules/platform.controllers.ts:691-699`.
- `updateGrowthService` changes enabled state, margin, preferred supplier, maximum quantity, and expected completion at `apps/api/src/modules/platform.service.ts:947-963`.
- `applyGrowthServiceAdminControls` applies admin-supplied controls at `services/smm/src/index.ts:967-1006`.

Reproduction steps:

1. Without authentication, call `PATCH /v1/admin/growth/services/tiktok-views`.
2. Use body `{"enabled":false,"marginBps":0,"maximumQuantity":999999,"preferredSupplier":"attacker-supplier"}`.
3. Observe service state changes in memory.

Estimated impact:

Attackers can disable revenue-generating services, reduce margins, manipulate routing, or increase order limits. If live suppliers are configured, this can cause loss, supplier exposure, and operational disruption.

Recommended fixes:

- Require `admin:access` plus marketplace-specific permission for all Growth admin actions.
- Persist service controls with audit logs.
- Restrict supplier names to configured suppliers.
- Require dual approval for margin/routing changes in production.

### ABUSE-07 - Refund Status Can Be Faked Without Financial Reversal

Severity: High

Proof:

- `updateGrowthOrder` accepts status `REFUNDED` and updates the in-memory order at `apps/api/src/modules/platform.service.ts:966-1013`.
- `AdminGrowthController.updateOrder` and override call that method at `apps/api/src/modules/platform.controllers.ts:706-721`.
- No wallet reversal or ledger update exists in this Growth order update flow.

Reproduction steps:

1. Create or locate a Growth order.
2. Call `PATCH /v1/admin/growth/orders/{id}` with `{"status":"REFUNDED"}`.
3. Observe the order status changes without a financial reversal.

Estimated impact:

Dishonest operators can mark orders refunded without returning money, or create fake refund rates that hide supplier or fulfillment problems.

Recommended fixes:

- Tie refund status to a ledger reversal.
- Require `payment:manage` for refund transitions.
- Store refund reason, actor, amount, ledger entry ID, and approval state.

### ABUSE-08 - Supplier Failure Handling Has No Financial Counterpart

Severity: Medium

Proof:

- Growth supplier submission failures are caught and converted to FAILED orders at `apps/api/src/modules/platform.service.ts:853-870`.
- Because no charge exists before submission, there is no refund, hold release, or customer balance reconciliation in that failure path.

Reproduction steps:

1. Configure a supplier to fail order creation.
2. Submit a Growth order.
3. Observe returned `FAILED` order with failure reason.
4. Confirm there is no linked financial reversal or hold release.

Estimated impact:

Failure state is visible, but reconciliation is impossible once real payment is added unless charge linkage is designed first.

Recommended fixes:

- Model order lifecycle around a charge/hold record.
- On supplier failure, release hold or reverse debit idempotently.
- Add supplier failure reason and refund/release IDs to the order.

## OTP Marketplace Abuse

### ABUSE-03 - Public OTP Order and Refund Surface

Severity: Critical

Proof:

- OTP order listing, creation, details, cancellation, refund, and wallet read are public at `apps/api/src/modules/otp/otp.controller.ts:25-61`.
- OTP admin overview, provider controls, and pricing rules are public at `apps/api/src/modules/otp/otp.controller.ts:65-87`.
- OTP service uses process-global `orders` and wallet state at `apps/api/src/modules/otp/otp.service.ts:169-178`.
- OTP refund mutates wallet state at `apps/api/src/modules/otp/otp.service.ts:392-402`.

Reproduction steps:

1. Call `GET /v1/otp/wallet` with no auth.
2. Call `GET /v1/otp/orders` with no auth.
3. Call `POST /v1/otp/orders/{id}/refund` with no auth.
4. Call `POST /v1/admin/otp/pricing-rules` with no auth.

Estimated impact:

Unauthenticated users can inspect or manipulate shared OTP state, cancel or refund orders, and alter provider/pricing controls. With real OTP providers, this can cause direct cost, fraud, and compliance exposure.

Recommended fixes:

- Add auth and workspace scoping to OTP.
- Require `admin:access` for admin OTP routes.
- Require owner/admin approval for high-risk OTP services.
- Move OTP state to Prisma with wallet row locks and idempotent ledger entries.

## Campaign and Operator Abuse

### ABUSE-05 - Non-Admin Operators Can Control Campaign Ops

Severity: High

Proof:

- Admin campaign status update calls `updateAdminStatus` at `apps/api/src/modules/platform.controllers.ts:764-770`.
- Assignment update calls `updateAssignment` at `apps/api/src/modules/platform.controllers.ts:773-779`.
- Placement, metrics, reports, publish, activity, and bulk actions are exposed at `apps/api/src/modules/platform.controllers.ts:782-846`.
- Service methods require workspace context but do not call RBAC checks at `apps/api/src/modules/managed-ads.service.ts:1595-1866`.

Reproduction steps:

1. Authenticate as a MARKETER, SUPPORT, FINANCE, or VIEWER member.
2. Assign yourself to a campaign.
3. Change status, add placement URL, add metrics, create and publish a report, or run bulk action.

Estimated impact:

Dishonest operators can manipulate campaign delivery proof, fabricate spend/performance, claim work, and alter customer-visible reports.

Recommended fixes:

- Require `admin:access` for admin campaign ops routes.
- Require `campaign:manage` for operational mutation and `campaign:approve` for approval transitions.
- Validate assignment target roles.
- Add immutable audit logs and review queues for sensitive changes.

## API and Rate Abuse

### ABUSE-06 - Missing Rate Limiting and Velocity Controls

Severity: High

Proof:

- `apps/api/package.json` has no throttler/rate-limit dependency.
- `main.ts` enables broad CORS and only configures validation at `apps/api/src/main.ts:10-18`.
- Platform DTOs are TypeScript interfaces, so the global validation pipe does not enforce most request shapes at `apps/api/src/modules/platform.dtos.ts:1-54`.

Reproduction steps:

1. Send repeated unauthenticated requests to `/v1/admin/overview`, `/v1/otp/orders`, `/v1/smm/balance`, and `/v1/search`.
2. Send repeated authenticated requests to `/v1/growth/orders`, `/v1/payments/intents`, and support ticket creation.
3. Observe no code-level throttling or velocity denial.

Estimated impact:

Order spam, supplier balance scraping, OTP abuse, payment intent spam, support queue flooding, brute force login attempts, and search scraping are practical.

Recommended fixes:

- Add per-IP, per-user, per-workspace, per-device, and per-route rate limits.
- Add stricter limits for payment, OTP, Growth order, auth, support, and admin routes.
- Add bot/device reputation checks for marketplace endpoints.
- Add audit events for blocked rate-limit attempts.

## Existing Abuse Controls That Should Be Preserved

SMM/Growth controls:

- SMM order fraud scoring checks public URL, oversized orders, destination/service mismatch, zero-cost quotes, and duplicate destination velocity at `services/smm/src/index.ts:692-785`.
- Supplier health checks use timeout/degraded/down state at `services/smm/src/index.ts:840-895`.
- Retry policy is bounded at `services/smm/src/index.ts:187-192` and `services/smm/src/index.ts:787-811`.
- Growth services include risk metadata for high-risk services at `services/smm/src/index.ts:200-499`.

Digital Access controls:

- Digital Access checks request abuse before charge at `apps/api/src/modules/digital-access/digital-access.service.ts:316-342`.
- It locks wallet and charges inside a serializable transaction at `apps/api/src/modules/digital-access/digital-access.service.ts:344-430`.
- It performs idempotent refunds at `apps/api/src/modules/digital-access/digital-access.service.ts:1342-1378`.
- It requires admin permissions for admin routes at `apps/api/src/modules/digital-access/digital-access.service.ts:1293-1295`.

OTP controls:

- OTP fraud assessment blocks unapproved workspaces and missing attestation at `services/otp/src/index.ts:337-356`.
- OTP duplicate active order and velocity checks exist at `services/otp/src/index.ts:368-395`.
- OTP charge/refund helpers use idempotency at `services/otp/src/index.ts:410-423` and `services/otp/src/index.ts:493-520`.

## Abuse Test Matrix

| Persona | Attempt | Result | Risk |
| --- | --- | --- | --- |
| Attacker | Call public admin endpoints without auth | Succeeds for several routes | Critical |
| Abusive customer | Submit Growth orders without wallet charge | Succeeds | Critical |
| Abusive customer | Create negative invoice and pay from wallet | Exploitable by code path | Critical |
| Dishonest operator | Self-assign and alter campaign state | Succeeds with any workspace context | High |
| Malicious admin | Change Growth service pricing/routing | Public route succeeds | Critical |
| VIEWER | Access admin campaign ops | Workspace context is enough | Critical |
| FINANCE | Access non-finance admin campaign actions | Workspace context is enough | High |
| SUPPORT | Publish reports or change assignments | Workspace context is enough | High |
| Anonymous user | Refund OTP order | Public route | Critical |

## Required Remediation Before Launch

1. Gate all admin and marketplace mutation endpoints with authentication and permission checks.
2. Charge/hold funds before Growth supplier submission.
3. Reject negative and zero financial amounts globally.
4. Move OTP to authenticated, workspace-scoped, persistent state.
5. Add marketplace rate limits and duplicate-order controls.
6. Tie refund status to real ledger reversals.
7. Split public, customer, operator, finance, and admin realtime channels, and require admin permission before emitting admin-style workspace counts.
8. Add abuse regression tests for attacker, abusive customer, dishonest operator, malicious admin, and each role.
