# FLIPTRYBE ADS CAMPAIGNER Architecture

## Phase 1 Shape

The platform is a modular monorepo with four runtime apps:

- `apps/web` - user campaign operating dashboard.
- `apps/admin` - governance, moderation, payment, and audit console.
- `apps/api` - NestJS REST and websocket API boundary.
- `apps/worker` - BullMQ async processing boundary.

Shared packages hold public contracts, UI primitives, config validation, provider adapters, events, RBAC, ledger math, analytics helpers, notifications, and Prisma schema ownership.

## Provider Boundary

Phase 1 uses mock/sandbox provider implementations behind typed adapters:

- `AdsProviderAdapter`
- `PaymentGatewayAdapter`
- `SmmSupplierAdapter`
- `AiGenerationAdapter`
- `NotificationProviderAdapter`
- `StorageProviderAdapter`

Live Meta, TikTok, Korapay, Paystack, Stripe, SMM supplier, AI, WhatsApp, and S3 integrations must replace these adapters without leaking provider-specific shapes into the core domain.

## Data Ownership

The Prisma schema uses UUID primary keys, tenant/workspace scoping, soft deletes where appropriate, immutable ledger entries, immutable audit-log intent, provider references, and indexes for status, relation, and operational queries.

## Runtime Boundaries

REST routes serve product workflows. Websocket channels serve live updates for notifications, campaigns, livestreams, and admin monitoring. BullMQ queues isolate campaign execution, SMM fulfillment, notifications, analytics ingestion, media processing, payments, and audit events.
