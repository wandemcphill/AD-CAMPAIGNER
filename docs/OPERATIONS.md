# Production Operations Runbook

This runbook covers the Render production footprint for FlipTrybe Ads Campaigner:

- API: `ft-campaigner-api-fra`
- Web: `fliptrybe-ads-campaigner-web`
- Admin: `fliptrybe-ads-campaigner-admin`
- Worker: `fliptrybe-ads-campaigner-worker`
- Postgres: `fliptrybe-ads-campaigner-postgres`
- Redis-compatible Key Value: `fliptrybe-ads-campaigner-redis`

Replace example URLs with the current Render-assigned domains shown in the dashboard before running commands.

## Fast Incident Controls

Use flags before code rollback when the incident is isolated to a feature.

| Incident                                       | Disable first                                                                                                             | Then disable                                                                                                      | Notes                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Digital Access automation causing side effects | `DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false` on the worker                                                            | `DIGITAL_ACCESS_WORKER_ENABLED=false`, then `ENABLE_DIGITAL_ACCESS=false` and `ENABLE_DIGITAL_ACCESS_ADMIN=false` | Stops worker side effects while keeping queued jobs durable.                |
| Digital Access UI/API accepting bad requests   | `NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS=false` and `NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN=false`, then redeploy static sites | `ENABLE_DIGITAL_ACCESS=false`, `ENABLE_DIGITAL_ACCESS_ADMIN=false` on API and worker                              | Static `NEXT_PUBLIC_*` changes need a rebuild/redeploy.                     |
| OTP provider or allocation issue               | `OTP_ALLOCATION_WORKER_ENABLED=false` and `OTP_POLLING_WORKER_ENABLED=false`                                              | `ENABLE_BUDGET_OTP=false`, `ENABLE_PREMIUM_OTP=false`, then `ENABLE_OTP_MODULE=false`                             | Keep `OTP_REFUNDS_WORKER_ENABLED=true` only if refunds are known safe.      |
| OTP refund bug                                 | `OTP_REFUNDS_WORKER_ENABLED=false`                                                                                        | `ENABLE_OTP_MODULE=false` if new orders must stop                                                                 | Move refunds to manual reconciliation until fixed.                          |
| Redis or queue pressure                        | `QUEUE_PRODUCER_ENABLED=false` on API                                                                                     | Lower `WORKER_CONCURRENCY`, then disable feature worker flags or suspend worker                                   | Prevents new jobs while preserving existing queue data.                     |
| Payment mismatch                               | Pause new payment entry points in product/admin if available                                                              | Do not delete Korapay secrets unless compromised                                                                  | Keep the Korapay webhook online so already-paid events can still reconcile. |
| Secret compromise                              | Rotate at provider first, then Render env                                                                                 | Redeploy API and worker; invalidate sessions for JWT/session compromise                                           | Do not paste secrets in tickets, logs, or docs.                             |

Keep `TRUST_PROXY_AUTH_HEADERS=false` and `DIGITAL_ACCESS_TRUST_AUTH_HEADERS=false` unless a trusted proxy auth boundary is deliberately deployed.

## Deploy Verification

1. In Render, confirm API, web, admin, and worker deploys are `Live`.
2. On the API deploy, confirm `preDeployCommand` completed `prisma migrate deploy`.
3. Check API health:

```powershell
$ApiUrl = "https://ft-campaigner-api-fra-g25g.onrender.com"
Invoke-RestMethod "$ApiUrl/v1/health"
Invoke-RestMethod "$ApiUrl/v1/smm/health"
```

4. Open the web and admin URLs. Confirm the loaded pages are from the expected commit.
5. In worker logs, confirm `FlipTrybe worker listening` and review the `queues` and `disabledQueues` values.
6. Confirm there are no API runtime errors for `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SESSION_SECRET`, Korapay, Cloudinary, or SMM suppliers.
7. Confirm Korapay webhook URL is exactly:

```text
https://ft-campaigner-api-fra-g25g.onrender.com/api/webhooks/korapay
```

The Korapay webhook is intentionally outside the `/v1` prefix.

## Rollback

Feature flag rollback is the fastest rollback path for Digital Access and OTP incidents.

For code rollback:

1. Open the affected Render service.
2. Go to Events.
3. Select the latest known-good successful deploy.
4. Click Rollback and wait for the new rollback deploy to become `Live`.
5. Recheck `/v1/health`, worker logs, and the affected user flow.

Important rollback expectations:

- Render service rollbacks do not undo database migrations.
- Render rollbacks use current service configuration for many settings. Recheck env vars and feature flags after rollback.
- Static site rollback reuses a previous build artifact, so build-time `NEXT_PUBLIC_*` values may also move back with that artifact. For a flag-only static rollback, update the env var and redeploy the static site.
- If a migration caused data loss or corruption, prefer Postgres point-in-time recovery into a new recovery database, validate it, then switch services to that database.

## Logs And Metrics

Use Render Logs first:

- API logs: search for `Exception`, `Unauthorized`, `Korapay`, `Failed to enqueue`, `DATABASE_URL`, `REDIS_URL`, and feature flag names.
- Worker logs: search for `FlipTrybe worker listening`, `job completed`, `job failed`, `digital-access-automation`, `otp-allocation`, `otp-polling`, and `otp-refunds`.
- Build logs: verify `pnpm install`, `prisma:generate`, app build, and API migration steps.

Watch Render Metrics:

- API: restarts, memory, CPU, latency, 5xx spikes.
- Worker: restarts, memory, CPU, sustained high processing.
- Postgres: storage, connections, CPU, memory, slow query symptoms.
- Key Value: memory, CPU, active connections.

Alert on:

- API health check failures.
- Any failed deploy.
- Worker restart loop.
- Redis memory above 75 percent warning or 90 percent critical.
- Postgres storage above 75 percent warning or 90 percent critical.
- Korapay payment count or amount mismatch greater than zero after reconciliation.

## Postgres Backup And Restore

Render paid Postgres has point-in-time recovery. Confirm the current workspace recovery window in Render before launch; Render documents 3 days for Hobby workspaces and 7 days for Pro or higher workspaces as of May 2026.

Operational expectations:

- Create a logical export before major migrations, payment changes, or beta flag launches.
- Keep a weekly logical export outside Render if long-term retention is required.
- Logical exports from Render are compressed directory archives and are retained by Render for 7 days after creation.
- Do not restore an export over the live database during an incident.
- Restore to a separate recovery database or staging database first, validate data, then switch services only after signoff.

Point-in-time recovery drill:

1. Open the Postgres service Recovery page.
2. Start a recovery to a time at least ten minutes in the past.
3. Wait for the recovery database to become available.
4. Validate core tables, wallet balances, payment intents, Digital Access requests, OTP orders, and audit logs.
5. If the recovery database is the accepted source of truth, update API and worker `DATABASE_URL` references to the recovery database and redeploy.
6. Keep the old database until reconciliation is complete.

## Redis And Queue Monitoring

The Render Key Value instance is configured with `noeviction`, which is correct for queues because writes fail instead of silently dropping jobs when memory is full. Paid instances persist to disk frequently, but the last second of writes can still be at risk during interruption.

Queue names:

- `campaigns`
- `smm-fulfillment`
- `notifications`
- `analytics-ingestion`
- `media-processing`
- `payments`
- `audit-events`
- `digital-access-automation`
- `otp-allocation`
- `otp-polling`
- `otp-refunds`
- `otp-provider-health`

From a Render Shell on a service in the same region, inspect queue pressure with Redis CLI:

```sh
QUEUE=digital-access-automation
redis-cli -u "$REDIS_URL" LLEN "bull:$QUEUE:wait"
redis-cli -u "$REDIS_URL" LLEN "bull:$QUEUE:active"
redis-cli -u "$REDIS_URL" ZCARD "bull:$QUEUE:delayed"
redis-cli -u "$REDIS_URL" ZCARD "bull:$QUEUE:failed"
```

If memory is climbing:

1. Set `QUEUE_PRODUCER_ENABLED=false` on API.
2. Disable feature-specific worker flags for unsafe queues.
3. Keep safe workers running if the goal is to drain.
4. Lower `WORKER_CONCURRENCY` if suppliers or DB are rate-limiting.
5. Scale storage or instance size before memory reaches critical levels.

## Payment Reconciliation

Daily during beta, and after every payment incident:

1. Export Korapay transactions and settlements for the reconciliation window.
2. Compare by reference, amount, currency, customer/workspace, and status against app payment intents and wallet ledger entries.
3. For webhook misses, run the verify flow for the exact reference:

```text
POST /v1/payments/verify/:reference
```

4. Confirm each successful Korapay transaction credited the wallet once.
5. Confirm failed, abandoned, or duplicate transactions did not credit the wallet.
6. Record manual adjustments with reason, operator, source reference, amount, and timestamp.

Never manually credit a wallet unless the Korapay reference, amount, currency, and workspace mapping have been verified.

## Webhook Verification

Korapay production webhook:

```text
POST https://ft-campaigner-api-fra-g25g.onrender.com/api/webhooks/korapay
Header: x-korapay-signature
```

Verification steps:

1. Confirm `KORAPAY_WEBHOOK_URL` uses `/api/webhooks/korapay`, not `/v1/api/webhooks/korapay`.
2. Confirm `KORAPAY_WEBHOOK_SECRET` is the provider signing secret, not the webhook URL.
3. Trigger a Korapay test event or low-value live test.
4. Confirm API logs show webhook receipt without auth failure.
5. Confirm wallet crediting is idempotent by replaying the same event only in a controlled test window.
6. Keep webhook processing online during payment incidents unless the webhook handler itself is corrupting balances.

## Incident Response

First 15 minutes:

1. Assign an incident commander.
2. Name severity, affected feature, first detected time, and customer impact.
3. Freeze deploys except rollback or hotfix.
4. Disable the smallest unsafe flag or worker first.
5. Capture Render deploy SHA, env changes, logs, Korapay event IDs, queue names, and affected workspace IDs.

Containment:

- Stop new unsafe writes before draining or fixing old work.
- Preserve queued jobs unless they are proven corrupt.
- Keep payment webhooks running when possible so paid events reconcile.
- Avoid provider key rotation unless compromise is suspected.

Recovery:

1. Apply feature flag rollback, Render rollback, or hotfix.
2. Verify API health, worker logs, queue depth, payment reconciliation, and affected beta workspaces.
3. Re-enable flags one at a time.
4. Keep heightened monitoring for at least one business day after SEV1 or payment incidents.

Post-incident:

- Write a short timeline.
- List root cause, customer impact, data impact, money impact, and queue impact.
- Record exact flags changed and when.
- Add missing tests, alerts, dashboard checks, or runbook steps before reopening the feature.

## References

- Render Postgres recovery and backups: https://render.com/docs/postgresql-backups
- Render rollbacks: https://render.com/docs/rollbacks
- Render health checks: https://render.com/docs/health-checks
- Render Key Value: https://render.com/docs/key-value
