# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Bootstrap (first time)
corepack enable && corepack prepare pnpm@10.18.3 --activate && pnpm install

# Dev servers (all apps in parallel)
pnpm dev

# Run a single app
pnpm --filter @fliptrybe/web dev
pnpm --filter @fliptrybe/api dev
pnpm --filter @fliptrybe/worker dev

# Build / lint / typecheck / test (all workspaces via Turborepo)
pnpm build
pnpm lint
pnpm typecheck
pnpm test

# Run tests for a single package
pnpm --filter @fliptrybe/api test

# Full verification gate (typecheck + lint + test + prisma validate + ui audit)
pnpm verify

# Prisma
pnpm prisma:generate   # regenerate client after schema changes
pnpm prisma:validate   # validate schema without generating

# Smoke tests
pnpm smoke             # local
pnpm smoke:deployed    # deployed environment
```

Turbo pipelines respect dependency order (`^build` dependsOn). Run `pnpm build` before `pnpm typecheck` or `pnpm lint` in a fresh checkout; otherwise package outputs won't exist.

## Architecture

**Monorepo layout:** pnpm workspaces + Turborepo.

```
apps/
  web/       Next.js 15 — user-facing growth OS  (/os/* routes)
  admin/     Next.js   — ops/governance dashboard
  api/       NestJS    — REST + WebSocket API
  worker/    BullMQ    — background job processor
packages/
  database/  Prisma schema + generated client (@fliptrybe/database)
  providers/ All external adapter implementations (@fliptrybe/providers)
  events/    Typed PlatformEvent union + job factories (@fliptrybe/events)
  types/     Domain types shared across all apps (@fliptrybe/types)
  payments/  Wallet/ledger helpers + calculateAvailableBalance
  feature-flags/ Runtime flags object (currently static)
  auth/      Auth utilities
  ui/        Shared component library
  config/    Shared TS/ESLint/Prettier config
services/    Bounded domain contracts (not yet runtime-separated)
```

### Provider adapter pattern

`packages/providers/src/index.ts` contains **all** external adapter implementations and factory functions. Every adapter type is defined as an interface in this file and consumed throughout the codebase:

- `AdsProviderAdapter` — campaign ad platforms (mock only; real integrations behind `liveProviderIntegrations` flag)
- `PaymentGatewayAdapter` — Korapay (`createKorapayPaymentGateway`) + mock
- `SmmSupplierAdapter` — SMM panels via Perfect Panel API (`createPerfectPanelSmmSupplier`) + mock + router (`createRoutedSmmSupplier`)
- `OtpProviderAdapter` — TextVerified, 5sim, sms-man, sms-activate-compatible + mock (these are the OTP/phone-number adapters; see below for planned replacement)
- `StorageProviderAdapter` — Cloudinary + mock
- `NotificationProviderAdapter` / `AiGenerationAdapter` — mock only

When adding a new external integration, implement the relevant interface here and export a factory function. The adapter takes a config struct (never reads env vars directly) and an optional `fetcher` for testability.

### Ledger and wallet pattern

All money movements go through `LedgerEntry`. The `LedgerEntryKind` enum is `CREDIT | DEBIT | HOLD | RELEASE | REVERSAL`. A migration constraint enforces `amountMinor > 0` on all entries — refunds are separate positive `REVERSAL` entries, never negative amounts. The `idempotencyKey` column on `LedgerEntry` is unique; charge functions must derive a stable key and pass it so retries don't double-charge.

See `DigitalAccessWalletCharge` + `DigitalAccessHubService.refundRequest` in `apps/api/src/modules/digital-access/` as the canonical example of the charge-then-reverse pattern.

### BullMQ queues

All queues are declared in `apps/worker/src/queues.ts`:
- `queueNames` — the authoritative list of queue names
- `QueuePayloads` — typed map of queue → job payload
- `queueRuntimePolicies` — per-queue concurrency, retry policy, retention
- `createQueueJobOptions(queue)` — produces BullMQ job options from the policy

Add new queues by extending all three exports. New queues should be feature-flag-gated at worker startup.

### Feature flags

`packages/feature-flags/src/index.ts` — static object for now. All new verticals must add a flag here and gate both API endpoints and worker queue registration behind it. Current flags: `liveProviderIntegrations`, `manualPaymentReview`, `aiCampaignAssistant`, `globalSearch`, `realtimeCampaignUpdates`, `digitalAccess`, `digitalAccessAdmin`.

### NestJS API module structure

Each vertical in `apps/api/src/modules/` follows the same shape: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dtos.ts`, `*.service.test.ts`. `digital-access/` is the canonical example to copy from. `PrismaService` is injected for DB access; `QueueProducerService` for queue dispatch.

`platform.service.ts` / `platform.controllers.ts` handle cross-cutting concerns (workspaces, campaigns, SMM orders, payments). `realtime.gateway.ts` is a Socket.IO gateway for live updates.

### Otp* infrastructure

`packages/database/prisma/schema.prisma` contains `OtpService`, `OtpProviderConfig`, `OtpOrder`, `OtpMessage`, `OtpProviderHealth`, `OtpWalletCharge`, `OtpRoutingAttempt`. **These are being replaced** by `Provider*` / `VirtualNumber*` / `Vtu*` models as part of the Digital Products build. `ENABLE_OTP_MODULE=false` and there are zero call sites. Treat the existing `OtpProviderAdapter` interface and its adapters in `packages/providers` as a reference shape, not live functionality.

### Deployment

`render.yaml` is the Render Blueprint. Provisions API, web, admin, worker, PostgreSQL, and Redis-compatible Render Key Value. See `docs/DEPLOYMENT.md` for the full GitHub → Render flow.

### Money convention

All monetary values are stored and passed in **minor units** (kobo / cents) as integers. The `money()` helper in `packages/payments` throws if the value is not an integer. Display conversion (`/ 100`) belongs in the presentation layer only.
