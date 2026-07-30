# Financial Remediation Report

Date: 2026-06-04

Scope: wallets, invoices, payment intents, Korapay completion/webhooks, campaign budget holds, captures, releases, spend logging, Growth order charging, OTP wallet helpers, Digital Access wallet charges, database constraints, and regression tests.

Source material reviewed:

- `FINANCIAL_INTEGRITY_REPORT.md`
- `SECURITY_AUDIT_REPORT.md`

## Executive Summary

The critical wallet-corruption and double-payment paths identified in the financial audit were remediated for the managed-ads finance surface and reinforced with database constraints. Payment intent creation now validates amount, workspace ownership, campaign/invoice linkage, idempotency scope, and production webhook safety before provider calls. Invoice settlement, budget holds, captures, releases, and payment completion now run through locked transactions with idempotent ledger writes and wallet consistency checks.

Additional negative-value guardrails were added to OTP wallet charging/pricing and Digital Access plan/charge entry points. Growth order reserve/capture/refund protections already existed in the current worktree and were verified with tests.

Launch note: financial mutation paths are hardened, but broader public-route and global-auth issues from `SECURITY_AUDIT_REPORT.md` should ship with the authorization remediation before production exposure.

## Remediated Risks

| Audit ID | Area | Remediation |
| --- | --- | --- |
| FIN-01 | Negative invoices | Invoice subtotal, tax, line items, totals, and wallet settlement amounts are validated; DB check constraints block invalid invoice rows. |
| FIN-02 | Negative holds / over-capture | Holds and captures require positive amounts; captures cannot exceed active hold; hold rows are re-read after wallet lock. |
| FIN-03 | Growth unpaid execution | Current worktree reserves wallet funds before supplier execution, blocks unpaid execution, captures on completion, releases/refunds idempotently. |
| FIN-04 | Finance authorization | Managed-ads payment intent, invoice, hold, release, capture, and verification paths now require `payment:manage`. |
| FIN-05 | Payment intent manipulation | Positive amount validation, workspace-scoped invoice/campaign validation, idempotency lookup, and production webhook URL stripping added. |
| FIN-06 | Cross-record payment linkage | Payment intents and completion invoice settlement validate active workspace ownership. |
| FIN-07 | Hold release/capture race | Wallet locks plus locked hold re-read prevent stale ACTIVE hold mutations. |
| FIN-08 | Webhook replay | Webhook receipts are keyed in `EventOutbox`; payment intents are row-locked; wallet/campaign ledgers use idempotent upserts. |
| FIN-09 | OTP negative wallet charge | OTP wallet charge/refund helpers reject non-positive amounts; pricing rule inputs reject negative values. |
| FIN-10 | Digital Access | Existing transaction pattern retained; admin plan prices and wallet charges now reject invalid amounts. |

## Wallet Consistency

Wallet responses now include a consistency proof:

`opening balance + credits - debits = current balance`

The service also asserts this equation after wallet-mutating transactions and refuses to proceed if a negative ledger entry is encountered.

## Database Migration

Added migration:

`packages/database/prisma/migrations/20260604170000_financial_integrity_guards/migration.sql`

The migration adds check constraints for:

- Campaign budgets
- Wallet ledger entries
- Payment intents
- Campaign invoices
- Budget holds
- Manual placements
- Spend entries
- Reports
- Campaign ledger entries
- OTP orders and wallet charges
- Digital Access services, plans, requests, and wallet charges

Migration note: this migration intentionally fails if existing rows contain invalid negative or non-positive money values. Production rollout should run a preflight data audit and either correct or quarantine invalid rows before applying it.

## Tests Added

Regression coverage now includes:

- Negative payment intent rejection before provider/database creation
- Payment intent idempotency replay
- Cross-workspace payment idempotency-key rejection
- Negative invoice rejection
- Negative manual spend rejection
- Budget over-capture rejection
- Concurrent invoice settlement replay without duplicate wallet debit
- Wallet consistency response proof
- OTP negative wallet charge rejection
- OTP negative pricing rule rejection
- Digital Access negative plan price rejection

## Verification

Passed:

- `corepack pnpm --filter @fliptrybe/api test -- src/modules/managed-ads.service.spec.ts src/modules/otp/otp.service.test.ts src/modules/digital-access/digital-access.service.test.ts`
- `corepack pnpm --filter @fliptrybe/api test -- src/modules/platform.service.test.ts`
- `corepack pnpm --filter @fliptrybe/api typecheck`
- `corepack pnpm --filter @fliptrybe/service-otp test`
- `corepack pnpm --filter @fliptrybe/service-otp typecheck`
- `corepack pnpm --filter @fliptrybe/database prisma validate`

## Remaining Operational Notes

- The OTP marketplace still uses process-local state in this codebase. Negative-value corruption is blocked, but production-grade OTP finance should move to authenticated, workspace-scoped persistent storage.
- The broader security audit still requires global auth/RBAC hardening across public admin and marketplace routes. Financial service methods now enforce finance permissions, but route exposure must remain part of the launch gate.
- Growth finance is verified in the current worktree, but it is also process-local; durable production reconciliation should persist Growth orders, reservations, captures, refunds, and supplier references.
