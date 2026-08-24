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
  providers/ External adapter implementations (@fliptrybe/providers)
  events/    Typed PlatformEvent union + job factories (@fliptrybe/events)
  types/     Domain types shared across all apps (@fliptrybe/types)
  payments/  Wallet/ledger helpers + calculateAvailableBalance
  feature-flags/ Runtime flags resolved from code defaults + FEATURE_* environment overrides
  auth/      Auth utilities
  ui/        Shared component library
  config/    Shared TS/ESLint/Prettier config
services/    Bounded domain contracts (not yet runtime-separated)
```

### Provider adapter pattern

`packages/providers/src/index.ts` contains the external adapter contracts and their implementations/factories. The current repository is no longer a mock-only provider architecture.

- `AdsProviderAdapter` — ad-platform execution adapters; live execution is governed by the runtime provider configuration/feature flags.
- `PaymentGatewayAdapter` — real payment gateways including Korapay, Paystack and Payscribe paths, plus explicit non-production/test fallbacks where applicable.
- `SmmSupplierAdapter` — routed SMM supplier adapters with real supplier implementations and explicit test/development fallbacks.
- `OtpProviderAdapter` — OTP/virtual-number supplier adapters used by the dedicated virtual-number/OTP domain.
- `StorageProviderAdapter` — Cloudinary-backed production storage with test/development fallback support.
- `NotificationProviderAdapter` — runtime notification delivery contract; production notifications must use a genuinely configured provider and must never report success against an absent provider.
- `AiGenerationAdapter` — AI generation contract; production deployments use the configured live AI provider when the AI feature is enabled.

When adding a new external integration, implement the relevant interface here and export a factory function. The adapter takes a config struct (never reads env vars directly) and an optional `fetcher` for testability.

**Production rule:** mocks/stubs may exist for tests and local development, but they must not be reachable as silent production providers. A missing provider credential/config must fail closed or leave the capability explicitly unavailable rather than fabricate a successful transaction, quote, delivery, or notification.

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

`packages/feature-flags/src/index.ts` resolves code defaults and then applies per-environment `FEATURE_*` overrides at process startup. The API exposes the resolved public flag state for browser clients. Do not describe the flags as static-only.

Current flag groups include live provider integrations, AI, search, realtime updates, digital access, virtual numbers, VTU, bills, rewards, gift cards, crypto/RMB flows, telecom, guest checkout, support, invoicing/payment links, and provider-gated financial products.

Financial-product flags such as `virtualAccounts`, `virtualCards`, `remittance`, and `walletWithdrawals` intentionally default to `false` until the corresponding provider has passed the required end-to-end verification. They may be enabled per environment only after that verification; the flag alone does not manufacture provider capability.

### NestJS API module structure

Each vertical in `apps/api/src/modules/` follows the same shape: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dtos.ts`, `*.service.test.ts`. `digital-access/` is a canonical example to copy from. `PrismaService` is injected for DB access; `QueueProducerService` for queue dispatch.

`platform.service.ts` / `platform.controllers.ts` handle cross-cutting concerns (workspaces, campaigns, SMM orders, payments). `realtime.gateway.ts` is a Socket.IO gateway for live updates.

### Otp* infrastructure

`packages/database/prisma/schema.prisma` contains legacy Otp* entities used by the existing OTP/virtual-number domain. Do not remove or resurrect old models based only on this note; inspect current call sites and feature flags before changing them. Provider implementations remain the reference shape for real supplier routing.

### Notification + email

Transactional notifications are persisted and delivered by the worker rather than being treated as fire-and-forget controller side effects. Keep notification persistence, queueing, provider delivery, retry, and idempotency as separate concerns.

The production email channel uses Resend when `RESEND_API_KEY` plus the configured sender are present. Resend sends must use stable idempotency keys so retries cannot intentionally create duplicate provider sends. Do not make application business state depend on an email provider call succeeding synchronously.

### Deployment

`render.yaml` is the Render Blueprint. The production web, API, admin, worker, PostgreSQL and Redis-compatible Render resources are deployed from Render. The repository is not a Vercel production target.

See `docs/DEPLOYMENT.md` for the full GitHub → Render flow.

### Money convention

All monetary values are stored and passed in **minor units** (kobo / cents) as integers. The `money()` helper in `packages/payments` throws if the value is not an integer. Display conversion (`/ 100`) belongs in the presentation layer only.
