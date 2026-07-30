# FlipTrybe Growth Launch Readiness Report

Audit date: 2026-06-04  
Scope: production readiness for accepting real customers and real money.  
Instruction followed: audit and verify only; no feature work was implemented.

## Final Recommendation

**No-Go.**

The repository has a substantial managed-ads foundation and several local checks pass, but it is not production-ready for real customers or real money today. The strongest blockers are exposed admin endpoints, missing launch evidence and owner assignments, production URL drift in `render.yaml`, unverified authenticated/payment workflows, and non-durable Growth Services order state.

## Launch Readiness Scores

| Area | Score | Rationale |
| --- | ---: | --- |
| Infrastructure | 55/100 | API, worker, web, and admin builds pass locally; Prisma validates directly; reachable Render `-g25g` hosts pass smoke. However `render.yaml` points API/admin variables at 404 hosts, root Prisma script fails in this shell, and live routes do not fully match current code. |
| Security | 28/100 | Protected campaign/wallet/session routes reject unauthenticated requests on the reachable API, but `/v1/admin/overview`, `/v1/admin/smm/health`, and `/v1/admin/ai/suggestions` are publicly reachable. Admin campaign-ops methods require workspace auth but not explicit `admin:access`/operator permission. |
| Payment | 42/100 | Managed-ads payment intents, wallet ledger entries, invoices, holds, captures, and campaign ledger entries are durable in Prisma. Korapay adapter exists. But live payment creation, webhook signature, idempotency replay, settlement, treasury details, and authenticated invoice payment were not verified. |
| Operations | 8/100 | `ops:evidence` reports 0/110 tasks complete. `ops:readiness` fails with all 36 required owner/channel/URL/evidence items missing in this audit environment. |
| Customer Readiness | 35/100 | Web and admin shells render on reachable hosts. Managed Ads UI/API exists. Growth Services current-code routes are missing on live API and Growth order tracking is in memory in `PlatformService`. Authenticated signup/payment/campaign/report journeys were not verified. |

**Final Score: 34/100**

## Verification Performed

### Local Build And Test Results

| Check | Result |
| --- | --- |
| `corepack pnpm --filter @fliptrybe/api build` | Passed |
| `corepack pnpm --filter @fliptrybe/worker build` | Passed |
| `corepack pnpm --filter @fliptrybe/web build` | Passed |
| `corepack pnpm --filter @fliptrybe/admin build` | Passed |
| `corepack pnpm --filter @fliptrybe/database prisma validate` | Passed |
| `corepack pnpm --filter @fliptrybe/api test -- managed-ads.service.spec.ts platform.service.test.ts auth-session.service.test.ts workspace-context.middleware.test.ts` | Passed, 8 files / 42 tests |
| `corepack pnpm --filter @fliptrybe/worker test` | Passed, 21 tests |
| `corepack pnpm --filter @fliptrybe/providers test` | Passed, 10 tests |
| `corepack pnpm --filter @fliptrybe/service-smm test` | Passed, 11 tests |
| `corepack pnpm prisma:validate` | Failed locally because the root script shells out to `pnpm`, which is not on PATH in this shell. The direct Corepack Prisma command passed. |

### Ops Gates

| Check | Result |
| --- | --- |
| `corepack pnpm ops:evidence` | 0/110 complete; every OPS-001 through OPS-110 evidence/status item missing. |
| `corepack pnpm ops:readiness` | Failed; 36/36 required launch readiness items missing. |
| `corepack pnpm ops:run-phases` | Execution plan printed; all phases `not-started`. |
| `rollout-check.ts --stage=managed-ads-mvp --target=api` | Failed in this audit environment: missing production URLs, DB/Redis, JWT/session, Cloudinary, Korapay, and treasury vars. |
| `rollout-check.ts --stage=managed-ads-mvp --target=worker` | Failed in this audit environment: missing `NODE_ENV`, `DATABASE_URL`, and `REDIS_URL`. |
| `rollout-check.ts --stage=managed-ads-mvp --target=web/admin` | Failed in this audit environment: missing public API and app/admin URLs. |

### Deployed Route Smoke

Using the URLs declared in `render.yaml`:

| Target | Result |
| --- | --- |
| `https://ft-campaigner-api-fra.onrender.com` | Failed; `/v1/health` returned 404/not JSON and API routes returned 404. |
| `https://fliptrybe-ads-campaigner-admin.onrender.com` | Failed; admin routes returned 404. |
| `https://fliptrybe-ads-campaigner-web-g25g.onrender.com` | Web routes returned 200. |

Using the reachable `-g25g` hosts:

| Target | Result |
| --- | --- |
| `https://ft-campaigner-api-fra-g25g.onrender.com` | Passed deployed smoke: 36 passed, 0 failed, 2 skipped. |
| `https://fliptrybe-ads-campaigner-web-g25g.onrender.com` | Web shell and documented web routes returned 200. |
| `https://fliptrybe-ads-campaigner-admin-g25g.onrender.com` | Admin shell and campaign-ops routes returned 200. |
| Authenticated/write smoke | Skipped because no `AUTH_SMOKE_TOKEN` or `AUTH_SMOKE_EMAIL`/`AUTH_SMOKE_PASSWORD` was provided. |

Direct unauthenticated checks against the reachable API:

| Route | Result |
| --- | --- |
| `GET /v1/admin/overview` | **200 unauthenticated** |
| `GET /v1/admin/smm/health` | **200 unauthenticated**, supplier status degraded |
| `POST /v1/admin/ai/suggestions` | **201 unauthenticated** |
| `GET /v1/growth/catalog` | 404 on live reachable API |
| `GET /v1/growth/services` | 404 on live reachable API |
| `GET /v1/growth/orders` | 404 on live reachable API |

## Implemented, Partial, Missing

### Managed Ads

**Implemented**

- Durable Prisma models exist for `Campaign`, `Wallet`, `LedgerEntry`, `PaymentIntent`, `CampaignInvoice`, `CampaignBudgetHold`, `CampaignSpendEntry`, `CampaignLedgerEntry`, `CampaignAssignment`, `ManualAdPlacement`, and `CampaignReport` in `packages/database/prisma/schema.prisma`.
- Client campaign routes are implemented in `apps/api/src/modules/platform.controllers.ts` under `CampaignsController`.
- Managed ads service methods exist for campaign creation/submission/status controls, wallet funding, invoice payment, budget holds, spend captures, manual placements, metrics, report creation, and report publishing in `apps/api/src/modules/managed-ads.service.ts`.
- Payments are durable and idempotent in the managed-ads path: `completePaymentIntent` avoids double-crediting completed intents and records wallet/campaign ledger entries.
- Web campaign pages and admin campaign-ops pages build and render.

**Partial / Not Production-Verified**

- Signup/login/session code exists in `AuthController` and `AuthSessionService`, but no authenticated deployed smoke was run because credentials were unavailable.
- Campaign creation/submission, operator assignment, placement entry, report publishing, and invoice payment were verified by code/tests/builds, not by an authenticated live end-to-end run.
- Managed-ads campaign creation sets `provider: "MANUAL"` in `ManagedAdsService`; `render.yaml` sets `ADS_PROVIDER=mock`. Real Meta/TikTok ad network execution is not implemented as a production integration.
- Admin campaign-ops routes require a workspace context, but the service does not consistently require `admin:access` or `campaign:manage` for admin reads/writes.

**Missing / Blocking**

- Production proof of live payment intent, Korapay callback/webhook, duplicate webhook replay, wallet credit, invoice payment, hold/capture/release, and reconciliation.
- Production proof of named operators, assignment permissions, report QA, and customer-visible report publishing.
- Production proof of external ad account access, spend caps, placement proof, and manual launch process.

### Growth Services

**Implemented**

- SMM supplier adapters and tests exist in `packages/providers/src/index.ts` and `services/smm/src/index.ts`.
- Current code includes `GrowthController` and `AdminGrowthController` in `apps/api/src/modules/platform.controllers.ts`.
- SMM service catalog endpoint `/v1/smm/services` returns 200 on the reachable live API.

**Partial / Not Production-Ready**

- `PlatformService` stores `growthOrders`, `smmOrders`, `paymentIntents`, and related growth state in private in-memory arrays. This is not durable across restarts/deploys.
- Live `/v1/growth/*` routes returned 404 despite current code containing those controllers, indicating deployment drift or stale API code.
- Supplier health returned degraded on live `/v1/admin/smm/health`: `smdpanel` was down because no matching service was found, while other suppliers were healthy.

**Missing / Blocking**

- Durable Growth order persistence.
- Authenticated live order creation and tracking verification.
- Admin Growth route availability on live API.
- Clear customer refund/reversal handling for failed SMM supplier submissions.

## Provider Classification

| Provider | Status | Evidence |
| --- | --- | --- |
| Korapay | Implemented, unverified for launch | `createKorapayPaymentGateway` in `packages/providers/src/index.ts`; managed-ads payment code in `apps/api/src/modules/managed-ads.service.ts`; provider tests pass. No live payment/webhook replay evidence. |
| Cloudinary | Implemented, unverified for launch | `createCloudinaryStorageProvider` in `packages/providers/src/index.ts`; media upload intent code in `ManagedAdsService`; health reports `cloudinary-storage` on reachable API. No live upload/rejection/proof publishing evidence. |
| SMM suppliers | Implemented, partially live, degraded | PerfectPanel-style suppliers in `packages/providers/src/index.ts`; health endpoint reports router over `smdpanel`, `smmraja`, `justanotherpanel`, `peakerr`; live health degraded due `smdpanel`. |
| Notifications | Mostly mock/internal | `NOTIFICATION_PROVIDER=mock` in `render.yaml`; notification worker accepts jobs but no live email/WhatsApp provider verification. |
| Ads providers | Mock/manual | Managed Ads uses manual placements; `PlatformService` uses `createMockAdsProvider`; `render.yaml` sets `ADS_PROVIDER=mock`. |
| AI | Mock plus optional AI Brain | `AI_PROVIDER=mock`; `AI_BRAIN_ENABLED=false` in `render.yaml`. Public `/v1/admin/ai/suggestions` returns generated suggestions unauthenticated. |

## Worker System

**Implemented**

- Worker queue names and retry policies are defined in `apps/worker/src/queues.ts`.
- Worker process starts BullMQ workers for enabled queues in `apps/worker/src/main.ts`.
- Worker unit tests pass.

**Partial / Risk**

- `managed-ads-automation` processor returns `sideEffects: false` in `apps/worker/src/processors.ts`; it accepts work but does not execute real ad/provider side effects.
- I found API queue production only for Digital Access automation via `QueueProducerService`; no managed-ads queue producer wiring was found.
- Retry retention exists via BullMQ `removeOnFail`, but there is no separate dead-letter queue implementation.
- Live worker logs, Redis queue depth, failed job counts, and retry behavior were not verified.

## Environment Requirements

### Required For Managed Ads MVP

From `.env.example`, `render.yaml`, and `scripts/rollout-check.ts`:

- Core: `NODE_ENV`, `APP_URL`, `ADMIN_URL`, `API_URL`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SESSION_SECRET`, `NEXT_PUBLIC_API_URL`
- Storage: `STORAGE_PROVIDER=cloudinary`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET`
- Payments: `PAYMENT_PROVIDER=live`, `KORAPAY_PUBLIC_KEY`, `KORAPAY_SECRET_KEY`, `KORAPAY_ENCRYPTION_KEY`, `KORAPAY_WEBHOOK_URL`, `KORAPAY_WEBHOOK_SECRET`, `KORAPAY_REDIRECT_URL`
- Treasury: `TREASURY_BANK_NAME`, `TREASURY_ACCOUNT_NAME`, `TREASURY_ACCOUNT_NUMBER`
- Worker: `WORKER_CONCURRENCY`, `QUEUE_PRODUCER_ENABLED`
- SMM live mode: at least one supplier key among `SMDPANEL_API_KEY`, `SMMRAJA_API_KEY`, `JAP_API_KEY`, `PEAKERR_API_KEY`, plus service maps for production quality.

### Optional / Feature-Gated

- AI Brain: `AI_BRAIN_ENABLED`, `AI_BRAIN_BASE_URL`, `AI_BRAIN_API_KEY`, `AI_BRAIN_TIMEOUT_SECONDS`
- OTP: `ENABLE_OTP_MODULE`, `ENABLE_PREMIUM_OTP`, `ENABLE_BUDGET_OTP`, `ENABLE_OTP_ADMIN`, `OTP_PROVIDER_MODE`, OTP provider API keys
- Digital Access: `ENABLE_DIGITAL_ACCESS`, `ENABLE_DIGITAL_ACCESS_ADMIN`, `DIGITAL_ACCESS_WORKER_ENABLED`, `DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED`
- Alternate payment providers: `PAYSTACK_*`, `STRIPE_*`
- Social app secrets: `META_APP_ID`, `META_APP_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

### Missing In This Audit Environment

The rollout and ops scripts reported missing local audit variables for production URLs, DB/Redis, JWT/session, Cloudinary, Korapay, treasury, owner roster, launch channels, alert destination, support/escalation contacts, config freeze, and phase evidence placeholders.

## Launch Blockers

### Critical

1. **Admin API exposure:** `/v1/admin/overview`, `/v1/admin/smm/health`, and `/v1/admin/ai/suggestions` are reachable without authentication on the live API. Evidence: direct curl checks and `AdminController` in `apps/api/src/modules/platform.controllers.ts`.
2. **Production URL drift:** `render.yaml` declares API/admin URLs that return 404, while reachable services use `-g25g` hostnames. `KORAPAY_WEBHOOK_URL` already uses the alternate API hostname, creating inconsistent production configuration.
3. **Operational launch evidence is absent:** `ops:evidence` is 0/110 complete and `ops:readiness` fails 36/36 required items.
4. **Payment launch is unverified:** no authenticated live Korapay payment, webhook, idempotency replay, invoice payment, budget hold/capture/release, or reconciliation evidence was captured.
5. **Growth Services cannot be treated as production-ready:** live `/v1/growth/*` routes return 404, and current-code Growth order state is in memory.

### High

6. **Supplier health degraded:** live SMM health reports `smdpanel` down.
7. **Admin authorization is incomplete:** campaign-ops admin endpoints require workspace authentication but do not consistently enforce `admin:access` or operator permissions.
8. **Worker execution is not launch-proven:** managed-ads automation has `sideEffects: false`, no managed-ads producer wiring was found, and Redis/worker live behavior was not verified.
9. **Real ad fulfillment is manual/mock:** managed ads do not integrate with Meta/TikTok ad APIs; manual ad account access and spend proof are external blockers.
10. **Root Prisma script portability issue:** root `prisma:validate` fails in this shell because it calls `pnpm` directly rather than Corepack-resolved pnpm.

### Medium

11. Authenticated route permission enforcement could not be live-verified without smoke credentials.
12. Cloudinary upload behavior, invalid MIME/size rejection, signed completion, and report screenshot flows were not live-verified.
13. Notification delivery is mock/internal; no customer support inbox, email, or WhatsApp delivery proof.

## Workflow Readiness

| Workflow | Current Status |
| --- | --- |
| Signup/login/session | Implemented in code; unauthenticated session rejects with 401 on reachable API; authenticated live flow not verified. |
| Wallet funding | Durable managed-ads implementation; live Korapay funding not verified. |
| Campaign creation | Durable managed-ads implementation; deployed authenticated create not verified. |
| Campaign submission | Implemented; deployed authenticated submit not verified. |
| Invoice payment | Durable wallet and payment-intent paths exist; live invoice payment not verified. |
| Operator assignment | Implemented in admin campaign-ops; permission model incomplete; live authenticated write not verified. |
| Placement entry | Implemented as manual placement; live authenticated write not verified. |
| Report publishing | Implemented and blocks completion until published report exists; live authenticated publish not verified. |
| Growth catalog | Current code has routes; live `/v1/growth/*` returns 404. `/v1/smm/services` returns 200. |
| Growth order creation/tracking | Current code has routes and supplier calls, but order state is in memory and live routes were unavailable. |

## Evidence Files

- API routes/controllers: `apps/api/src/modules/platform.controllers.ts`
- Managed Ads durable workflows: `apps/api/src/modules/managed-ads.service.ts`
- Legacy/platform and Growth/SMM state: `apps/api/src/modules/platform.service.ts`
- Auth/session and workspace context: `apps/api/src/modules/auth-session.service.ts`, `apps/api/src/modules/request-context.ts`, `apps/api/src/modules/workspace-context.middleware.ts`
- RBAC permission map: `packages/auth/src/index.ts`
- Prisma models: `packages/database/prisma/schema.prisma`
- Worker queues/processors: `apps/worker/src/queues.ts`, `apps/worker/src/processors.ts`, `apps/worker/src/main.ts`
- Provider adapters: `packages/providers/src/index.ts`
- SMM service logic: `services/smm/src/index.ts`
- Render deployment: `render.yaml`
- Readiness gates: `scripts/ops-readiness.ts`, `scripts/managed-ads-evidence.ts`, `scripts/managed-ads-phase-runner.ts`, `scripts/rollout-check.ts`, `scripts/deployed-smoke.ts`
- Ops docs: `docs/OPERATIONS.md`, `docs/PRODUCTION_CHECKLIST.md`, `docs/MANAGED_ADS_PRODUCTION_TASKS.md`, `docs/MANAGED_ADS_MONITORING_RUNBOOK.md`

## Go / No-Go Decision

**No-Go for public launch and real-money customer intake.**

The codebase is beyond prototype status for Managed Ads, but the current production posture is not safe enough. Before accepting real customers or real money, FlipTrybe must lock down public admin routes, correct production URLs, complete launch evidence and owner assignments, run authenticated deployed smoke with write checks in a safe test workspace, prove Korapay/Cloudinary/SMM behavior end to end, and make Growth Services durable or keep it disabled.
