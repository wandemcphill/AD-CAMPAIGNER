# Deployment Hardening Report

Date: 2026-06-04  
Scope: Render Blueprint, env contract, Prisma migrations, Redis/BullMQ worker, monitoring, backups, rollback, and fresh-environment reproducibility.

## Executive Status

Critical deployment blockers remaining in the repository: **0**

Critical blockers resolved during this audit:

- Web and admin static exports failed on `/_document` during 404 prerendering. Added explicit App Router `not-found.tsx` pages for both apps. Verified both static builds now export successfully.
- Cloudinary signed upload env contract was incomplete. Added `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `MEDIA_UPLOAD_SIGNATURE_TTL_SECONDS`, and `MEDIA_UPLOAD_ALLOW_MOCK_STORAGE` to `render.yaml`, `.env.example`, and the shared config schema.
- API origin defaults were inconsistent. Aligned `API_URL` and both `NEXT_PUBLIC_API_URL` values with the documented Korapay webhook/API origin: `https://ft-campaigner-api-fra-g25g.onrender.com`.
- Render API/worker build commands invoked the root `prisma:generate` script, which depended on a bare `pnpm` shim. Updated Render commands to run database Prisma generation directly through the pinned pnpm invocation.
- Root Prisma helper scripts failed locally when no global `pnpm` shim existed. Updated them to use `corepack pnpm`.
- Worker shutdown handled `SIGINT` only. Added `SIGTERM` handling so Render deploys and rollbacks can close BullMQ workers cleanly.

## Verification Performed

Passing checks:

- `corepack pnpm --filter @fliptrybe/api build`
- `corepack pnpm --filter @fliptrybe/worker build`
- `corepack pnpm --filter @fliptrybe/web build`
- `corepack pnpm --filter @fliptrybe/admin build`
- `corepack pnpm --filter @fliptrybe/config build`
- `corepack pnpm prisma:validate`
- `corepack pnpm --filter @fliptrybe/worker test` with 21 tests passing
- `corepack pnpm --filter @fliptrybe/api test -- --run apps/api/src/modules/queue-producer.service.test.ts` with API test suite passing
- Render/env/schema diff: no Blueprint server env var is missing from `.env.example` or `packages/config`

Not verified from this workspace:

- Live Render dashboard status for API, web, admin, worker, Postgres, and Key Value.
- Live secret values, provider dashboard credentials, webhook registrations, alert routing, and backup recovery drills.

## Remaining Blockers

### High Priority External Signoffs

These do not block the repo from building, but they must be completed before production traffic is widened.

1. **Live Render evidence is required.** Confirm the current deployed services are `Live`, on the expected commit, and using the canonical API/web/admin URLs from `render.yaml`.
2. **Monitoring is not production-complete.** `infrastructure/monitoring/prometheus.yml` defines scrape targets, but the API does not expose a Prometheus metrics endpoint and the worker does not bind `worker:9100`. Render metrics/logs and manual runbooks exist, but first-class service metrics and alert definitions still need dashboard/provider setup.
3. **Worker health visibility is log-based.** Worker startup, completed jobs, and failed jobs are logged, and queue inspection is documented through Redis CLI. There is no dedicated worker health endpoint, queue dashboard, QueueEvents monitor, or automated dead-letter review.
4. **API health is shallow.** `/v1/health` reports app/provider config but does not actively check Postgres or Redis connectivity. A synthetic smoke check should cover dependency health until the endpoint is deepened.
5. **Backup recovery evidence is missing.** Backup docs and a `pg_dump` helper exist, but no scheduled backup job, retention automation, encrypted off-platform storage proof, or restore drill artifact is present in the repo.

### Medium Priority Risks

- API and worker production starts use `tsx src/main.ts` after typecheck-only builds. This works with `--prod=false`, but a compiled artifact start path would be more reproducible.
- Docker files are developer-oriented: Node 24, `dev` commands, and `--frozen-lockfile=false`, while Render pins Node 22. They should not be treated as production parity.
- Prisma migrations are additive and ordered, but rollback remains PITR/logical-restore based. App rollbacks do not reverse database changes.
- Existing migrations create normal indexes, not `CONCURRENTLY`. This is fine for current small/early tables, but large production tables need maintenance windows or a concurrent index plan.
- `sync: false` Blueprint secrets require manual entry during initial Render Blueprint creation. A fresh environment can build only after required provider secrets are entered.

## Render Deployment Audit

API service:

- Service: `ft-campaigner-api-fra`
- Runtime: Node web service
- Region: Frankfurt
- Health check: `/v1/health`
- Migration: `preDeployCommand` runs `prisma migrate deploy`
- Build: installs pinned pnpm dependencies, generates Prisma client directly from `@fliptrybe/database`, then builds `@fliptrybe/api`
- Status: locally build-verified
- Risk: health endpoint does not verify DB/Redis

Web service:

- Service: `fliptrybe-ads-campaigner-web`
- Runtime: Render static site
- Build: `@fliptrybe/web` Next static export
- Publish path: `apps/web/out`
- Status: locally export-verified after explicit `not-found.tsx`

Admin service:

- Service: `fliptrybe-ads-campaigner-admin`
- Runtime: Render static site
- Build: `@fliptrybe/admin` Next static export
- Publish path: `apps/admin/out`
- Status: locally export-verified after explicit `not-found.tsx`

Worker service:

- Service: `fliptrybe-ads-campaigner-worker`
- Runtime: Node worker
- Region: Frankfurt
- Build: installs pinned pnpm dependencies, generates Prisma client directly from `@fliptrybe/database`, then builds `@fliptrybe/worker`
- Shutdown: now handles `SIGINT` and `SIGTERM`
- Status: locally build- and test-verified
- Risk: health and queue observability are log/Redis CLI based

Managed services:

- Postgres: `fliptrybe-ads-campaigner-postgres`, `postgresMajorVersion: "18"`
- Redis-compatible Key Value: `fliptrybe-ads-campaigner-redis`, `maxmemoryPolicy: noeviction`

## Environment Variable Audit

Canonical URL variables:

- `APP_URL`: `https://fliptrybe-ads-campaigner-web-g25g.onrender.com`
- `ADMIN_URL`: `https://fliptrybe-ads-campaigner-admin.onrender.com`
- `API_URL`: `https://ft-campaigner-api-fra-g25g.onrender.com`
- `NEXT_PUBLIC_API_URL`: `https://ft-campaigner-api-fra-g25g.onrender.com` for web and admin

Provider variables covered by Blueprint/template/schema:

- Core: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SESSION_SECRET`
- Cloudinary: cloud name, API key, API secret, upload preset, folder, secure distribution, upload signature TTL, mock-storage kill switch
- Korapay: base URL, public key, secret key, encryption key, webhook URL, webhook secret, redirect URL
- Treasury: bank name, account name, account number
- SMM suppliers: SMDPanel, SMM Raja, JustAnotherPanel, Peakerr API URLs, keys, currencies, and service maps
- OTP providers: TextVerified, 5sim, SMS-Man, SMS-Activate compatible endpoint variables
- AI brain: enabled flag, base URL, API key, timeout
- Dormant/future placeholders: Paystack, Stripe, Meta, TikTok

Provider mode defaults:

- `ADS_PROVIDER=mock`
- `PAYMENT_PROVIDER=live`
- `SMM_PROVIDER=live`
- `AI_PROVIDER=mock`
- `NOTIFICATION_PROVIDER=mock`
- `OTP_PROVIDER_MODE=mock`

Required live signoffs:

- Render API and worker both have all `sync: false` secrets populated.
- Korapay dashboard webhook URL exactly matches `https://ft-campaigner-api-fra-g25g.onrender.com/api/webhooks/korapay`.
- Web/admin have been rebuilt after any `NEXT_PUBLIC_*` env change.
- SMM live mode has at least one valid supplier API key and service map.
- Cloudinary signed uploads are tested with a real image and video-safe asset before broad traffic.

## Database Migration Audit

Migration order:

1. `20260521171500_init`
2. `20260522103000_otp_marketplace`
3. `20260522123000_digital_access_hub`
4. `20260524120000_managed_ads_marketplace`
5. `20260604120000_campaign_spend_transparency`

Findings:

- Ordering is chronological and valid for Prisma Migrate.
- Migration lock provider is PostgreSQL.
- Latest campaign spend transparency migration is additive.
- No `DROP TABLE`, `DROP COLUMN`, or destructive truncation was found.
- Existing-table changes add nullable columns or `NOT NULL` columns with defaults.
- Enum changes are additive with `ADD VALUE IF NOT EXISTS`.
- Indexes and foreign keys are created normally inside migrations.

Rollback safety:

- Application rollbacks are safe only for code/config artifacts.
- Database rollback requires backup restore or PITR into a recovery database.
- Before major migrations, create a logical export and record the PITR target time.
- Do not restore over production directly. Restore into a recovery DB, validate, then switch `DATABASE_URL` after signoff.

Production compatibility:

- Current migrations are compatible with PostgreSQL on Render.
- For high-row-count tables, future index creation should use a planned maintenance window or a hand-authored concurrent-index migration.

## Redis And Worker Audit

Queue connectivity:

- API producer uses BullMQ with `REDIS_URL`, `maxRetriesPerRequest: null`, and `enableReadyCheck: false`.
- Worker uses BullMQ workers over `REDIS_URL` and creates workers for all enabled queues.
- Render Key Value uses `noeviction`, which is appropriate for queue durability because memory pressure fails writes instead of silently evicting jobs.

Retry handling:

- Queue runtime policies define attempts, exponential backoff, completion retention, and failure retention per queue.
- Digital Access enqueue uses idempotent job IDs and six attempts.
- Worker tests cover queue options and feature-flag gating.

Worker health:

- Startup logs include enabled and disabled queues.
- Completed and failed jobs are logged.
- `SIGTERM` shutdown is now handled.
- Remaining gap: no metrics endpoint, no automated queue depth alert, no failed-job triage automation.

## Monitoring Audit

Existing assets:

- `docs/OPERATIONS.md`
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/MANAGED_ADS_MONITORING_RUNBOOK.md`
- `infrastructure/monitoring/prometheus.yml`
- Deployed smoke runner at `scripts/deployed-smoke.ts`
- Ops readiness script at `scripts/ops-readiness.ts`
- Rollout preflight script at `scripts/rollout-check.ts`

Gaps:

- No API `/metrics` endpoint is implemented.
- Worker does not expose the configured `worker:9100` target.
- Alert rules are documented but not encoded as deployable infrastructure.
- No automated alert test artifact is present.

Minimum monitoring before traffic:

- Render deploy failure alerts.
- API health failure alert.
- API 5xx and latency alerts.
- Worker restart-loop alert.
- Redis memory and connection alerts.
- Queue depth and failed-job alerts for each enabled queue.
- Postgres storage, connection, CPU, and slow-query alerts.
- Korapay webhook/payment mismatch alert.
- Cloudinary upload failure and quota alerts.

## Backup Audit

Existing assets:

- `infrastructure/backup/README.md`
- `infrastructure/backup/backup.ps1`
- Render PITR and logical restore procedure in `docs/OPERATIONS.md`

Findings:

- `backup.ps1` creates a local `pg_dump` from `DATABASE_URL`.
- No scheduler, retention, encryption, offsite storage, or restore validation automation is included.
- Docs correctly state that app rollbacks do not undo migrations.

Required before production:

- Confirm Render PITR window for the actual Postgres plan.
- Create a pre-launch logical export.
- Store at least one encrypted export outside Render if retention beyond Render windows is required.
- Run and record a recovery drill into a separate database.
- Record the database owner, restore decision owner, and acceptance checklist.

## Deployment Reproducibility

Fresh environment status:

- Render Blueprint provisions API, web, admin, worker, Postgres, and Key Value.
- Build commands are pinned to pnpm `10.18.3`.
- API and worker now generate Prisma client directly with the pinned pnpm invocation.
- `.env.example`, `render.yaml`, and `packages/config` are aligned for Blueprint server variables.
- Web/admin static exports pass locally.

Fresh environment caveats:

- Required `sync: false` secrets must be entered during initial Blueprint setup.
- Static web/admin env values are build-time values; changing `NEXT_PUBLIC_*` requires redeploy.
- Docker Compose is useful for local dependencies but is not production parity.

## Deployment Checklist

- [ ] Confirm GitHub commit SHA to deploy.
- [ ] Confirm Render Blueprint services are linked to the correct repo and branch.
- [ ] Enter or verify all `sync: false` secrets in Render API and worker env.
- [ ] Verify `APP_URL`, `ADMIN_URL`, `API_URL`, and `NEXT_PUBLIC_API_URL` use the canonical production origins.
- [ ] Run `corepack pnpm prisma:validate`.
- [ ] Run `corepack pnpm --filter @fliptrybe/api build`.
- [ ] Run `corepack pnpm --filter @fliptrybe/worker build`.
- [ ] Run `corepack pnpm --filter @fliptrybe/web build`.
- [ ] Run `corepack pnpm --filter @fliptrybe/admin build`.
- [ ] Run `corepack pnpm --filter @fliptrybe/worker test`.
- [ ] Create a logical Postgres export before migrations or major flag changes.
- [ ] Deploy API first so `preDeployCommand` applies migrations.
- [ ] Verify `/v1/health`.
- [ ] Deploy worker and verify `FlipTrybe worker listening`.
- [ ] Deploy web and admin after API URL and feature flags are final.
- [ ] Run `corepack pnpm smoke:deployed` with `API_URL`, `APP_URL`, and `ADMIN_URL`.
- [ ] Run `corepack pnpm ops:readiness` with launch owner/channel evidence envs.
- [ ] Confirm Render alerts, provider alerts, and backup evidence before widening traffic.

## Rollback Checklist

- [ ] Assign incident commander, rollback owner, database owner, and comms owner.
- [ ] Freeze non-rollback deploys.
- [ ] Capture current Render deploy SHA, env changes, migration state, logs, and affected IDs.
- [ ] Disable the smallest unsafe feature flag first.
- [ ] For queue incidents, set `QUEUE_PRODUCER_ENABLED=false` before stopping safe drain workers.
- [ ] For Digital Access automation, disable `DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED`, then `DIGITAL_ACCESS_WORKER_ENABLED`.
- [ ] For OTP automation, disable allocation and polling first, then refunds only if refund processing is unsafe.
- [ ] Keep Korapay webhook online unless it is actively corrupting balances.
- [ ] Use Render rollback to restore the latest known-good API/worker/static artifact.
- [ ] Recheck `/v1/health`, worker startup logs, queue depths, and payment reconciliation.
- [ ] Do not assume database rollback happened with app rollback.
- [ ] If data is corrupt, restore/PITR into a recovery database, validate, then switch `DATABASE_URL` only after signoff.
- [ ] Keep heightened monitoring for at least one business day after recovery.

## Production Deployment Sequence

1. Freeze config and name owners.
2. Confirm production secrets in Render without copying values into docs or chat.
3. Run local verification: Prisma validation, API build, worker build/test, web build, admin build.
4. Create a pre-deploy logical Postgres export and record PITR time.
5. Deploy API. Confirm migration success and `/v1/health`.
6. Deploy worker. Confirm enabled queues and no startup Redis errors.
7. Deploy web with final `NEXT_PUBLIC_API_URL` and feature flags.
8. Deploy admin with final `NEXT_PUBLIC_API_URL` and admin feature flags.
9. Run deployed smoke checks against API, web, and admin.
10. Verify Korapay webhook, Cloudinary upload intent, SMM supplier health, and Redis queue inspection.
11. Confirm alert destinations and backup evidence.
12. Hold go/no-go. Only widen traffic after owners sign off.

## External References

- Render Blueprint spec: https://render.com/docs/blueprint-spec
- Render health checks: https://render.com/docs/health-checks
- Render rollbacks: https://render.com/docs/rollbacks
- Render PostgreSQL backups: https://render.com/docs/postgresql-backups
- Render Key Value: https://render.com/docs/key-value
- Prisma production migrations: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- BullMQ retries: https://docs.bullmq.io/guide/retrying-failing-jobs
