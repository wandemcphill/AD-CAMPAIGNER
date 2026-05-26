# Production Checklist

Use this checklist with `docs/OPERATIONS.md` before enabling production traffic or beta feature flags.

## Global Preflight

- Render API, web, admin, worker, Postgres, and Key Value services are `Live`.
- API `/v1/health` returns success on the current Render domain.
- API deploy logs show successful Prisma migration.
- Worker logs show `FlipTrybe worker listening`.
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `SESSION_SECRET` are present on API and worker.
- Korapay live keys, webhook secret, redirect URL, and treasury bank details are present only in Render env.
- Cloudinary cloud name and unsigned upload preset are present before upload flows are exposed.
- SMM supplier keys and optional service maps are present on API and worker.
- `TRUST_PROXY_AUTH_HEADERS=false` and `DIGITAL_ACCESS_TRUST_AUTH_HEADERS=false` unless a trusted proxy auth boundary is live.
- A fresh Postgres logical export exists before launch or major flag changes.
- Render alerts cover failed deploys, API health failures, worker restart loops, Postgres capacity, Redis capacity, and payment mismatches.
- Owner names are assigned for deploy, API, worker, payments, database, and customer support.

## Managed Ads MVP

### Preflight

- Run the managed ads rollout check for every deployed surface before launch:

```powershell
corepack pnpm exec tsx scripts/rollout-check.ts --target=api --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=worker --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=web --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=admin --stage=managed-ads-mvp --strict-production
```

- API uses real persistent dependencies: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `SESSION_SECRET`.
- Media uploads use signed Cloudinary upload intents. `STORAGE_PROVIDER=cloudinary`, Cloudinary cloud name, API key, API secret, and upload preset are present.
- `MEDIA_UPLOAD_ALLOW_MOCK_STORAGE` is unset or false in production.
- Payments use live Korapay. `PAYMENT_PROVIDER=live`, Korapay keys, webhook secret, redirect URL, and treasury account details are present.
- Web and admin use the deployed API URL and do not expose diagnostic data-source badges.
- Trusted proxy auth flags stay disabled unless a trusted proxy boundary has been reviewed.

### MVP Smoke Flow

1. Client signs in, completes business profile, and submits a campaign brief with at least one media upload.
2. Admin opens Campaign Operations, claims the new brief, posts an internal note, and moves the campaign through review.
3. Admin issues an invoice or budget hold tied to the campaign.
4. Client pays through Korapay or funds wallet; duplicate webhook/verify events do not double-credit wallet state.
5. Admin stores manual ad placement links, uploads proofs/screenshots, enters metrics, and publishes a report.
6. Client sees the timeline update, published report, invoice/payment state, and no admin-only notes.
7. Admin closes the campaign and confirms audit/history rows remain visible.

## Digital Access Beta

### Preflight

- Beta workspace IDs and beta users are known.
- Login/session flow works for each beta workspace.
- Protected routes reject missing, expired, or revoked sessions.
- Wallet writes, requests, and admin reads stay scoped to the authenticated workspace.
- Admin operators know how to approve, reject, cancel, and refund Digital Access requests.
- `QUEUE_PRODUCER_ENABLED=true` on API.
- `DIGITAL_ACCESS_TRUST_AUTH_HEADERS=false` unless explicitly approved.

### Enable Sequence

1. Create a Postgres logical export.
2. Set API and worker env:

```text
ENABLE_DIGITAL_ACCESS=true
ENABLE_DIGITAL_ACCESS_ADMIN=true
DIGITAL_ACCESS_WORKER_ENABLED=false
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false
```

3. Redeploy API and worker.
4. Verify `/v1/health`, then create one beta request through the API or web.
5. Set web static env and redeploy web:

```text
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS=true
```

6. Set admin static env and redeploy admin:

```text
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN=true
```

7. Verify beta user and admin screens show the feature and non-beta users cannot access protected data.
8. Enable automation only after manual create/admin flows are verified:

```text
DIGITAL_ACCESS_WORKER_ENABLED=true
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=true
```

9. Redeploy worker and confirm `digital-access-automation` is in enabled queues.

### Post-Enable Verification

- API `/v1/health` stays healthy after every flag change.
- Web Digital Access pages load for beta users.
- Admin Digital Access pages load for operators.
- Creating a request debits or reserves wallet state exactly once.
- Admin status changes produce the expected request state.
- Worker logs show `job completed` for `digital-access-automation`.
- Queue depth for `digital-access-automation` does not grow without processing.
- A user from workspace A cannot read or mutate workspace B requests.
- Disabling `ENABLE_DIGITAL_ACCESS` returns a feature disabled response for user routes.
- Disabling `ENABLE_DIGITAL_ACCESS_ADMIN` returns a feature disabled response for admin routes.

### Rollback Order

1. Set `DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false`.
2. Set `DIGITAL_ACCESS_WORKER_ENABLED=false`.
3. Set `NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS=false` and redeploy web.
4. Set `NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN=false` and redeploy admin.
5. Set `ENABLE_DIGITAL_ACCESS=false` and `ENABLE_DIGITAL_ACCESS_ADMIN=false` if new API writes must stop.
6. Keep Redis, Postgres, and payment webhooks intact.
7. Reconcile in-flight requests manually before deleting or retrying jobs.

## OTP Beta

### Preflight

- Compliance approval exists for every workspace in `OTP_BETA_WORKSPACE_IDS`.
- OTP terms, refund rules, prohibited use policy, and support workflow are ready.
- Provider keys are present for the selected providers.
- `OTP_PROVIDER_MODE` is `mock`, `sandbox`, or `live` intentionally.
- `OTP_BETA_WORKSPACE_IDS` contains only approved beta workspaces.
- `OTP_USD_TO_NGN_RATE` has been reviewed against current pricing.
- `SMSACTIVATE_COMPATIBLE_ENABLED=false` unless a trusted compatible endpoint is approved.
- Korapay and wallet reconciliation are already stable.
- The worker service has these OTP worker flags defined before live OTP jobs are enabled:

```text
OTP_WORKER_ENABLED=false
OTP_ALLOCATION_WORKER_ENABLED=false
OTP_POLLING_WORKER_ENABLED=false
OTP_REFUNDS_WORKER_ENABLED=false
OTP_PROVIDER_HEALTH_WORKER_ENABLED=false
```

### Enable Sequence

1. Create a Postgres logical export.
2. Set beta access and provider mode on API and worker:

```text
OTP_PROVIDER_MODE=sandbox
OTP_BETA_WORKSPACE_IDS=<comma-separated-approved-workspace-ids>
ENABLE_OTP_MODULE=false
ENABLE_BUDGET_OTP=false
ENABLE_PREMIUM_OTP=false
ENABLE_OTP_ADMIN=false
```

3. Redeploy API and worker, then verify `/v1/health`.
4. Enable admin visibility for operators:

```text
ENABLE_OTP_ADMIN=true
```

5. Enable the marketplace for beta workspaces:

```text
ENABLE_OTP_MODULE=true
ENABLE_BUDGET_OTP=true
ENABLE_PREMIUM_OTP=false
```

6. Verify quotes and order blocking before enabling worker side effects.
7. Enable provider health jobs:

```text
OTP_WORKER_ENABLED=true
OTP_PROVIDER_HEALTH_WORKER_ENABLED=true
```

8. When ready for live order automation, enable allocation, polling, and refunds together:

```text
OTP_ALLOCATION_WORKER_ENABLED=true
OTP_POLLING_WORKER_ENABLED=true
OTP_REFUNDS_WORKER_ENABLED=true
```

9. Enable `ENABLE_PREMIUM_OTP=true` only after budget-tier provider health and refunds are stable.

### Post-Enable Verification

- Non-beta workspace requests are blocked.
- Beta workspace can list services and request a quote.
- Unsupported country or service returns a clear rejection.
- A successful order debits the OTP wallet exactly once.
- Cancellation or provider failure refunds exactly once.
- Admin OTP overview shows provider health and active order counts.
- Worker logs show expected activity for `otp-provider-health`, `otp-allocation`, `otp-polling`, and `otp-refunds`.
- Queue depth does not grow without processing.
- Provider dashboard totals match app order totals for the beta window.
- Korapay payments and wallet balance reconcile after OTP purchases.

### Rollback Order

1. Set `OTP_ALLOCATION_WORKER_ENABLED=false` and `OTP_POLLING_WORKER_ENABLED=false`.
2. Set `OTP_REFUNDS_WORKER_ENABLED=false` only if refund processing is unsafe.
3. Set `ENABLE_PREMIUM_OTP=false`.
4. Set `ENABLE_BUDGET_OTP=false`.
5. Set `ENABLE_OTP_MODULE=false` to stop new customer OTP actions.
6. Set `ENABLE_OTP_ADMIN=false` if admin actions are unsafe.
7. Clear or narrow `OTP_BETA_WORKSPACE_IDS` if abuse is workspace-specific.
8. Reconcile open orders, provider reservations, refunds, and wallet entries before reopening.

## Final Go Or No-Go

- Deploy owner confirms the exact commit deployed.
- API owner confirms health, logs, and protected routes.
- Worker owner confirms enabled queues and no failing jobs.
- Payment owner confirms Korapay webhook, settlement, and wallet reconciliation.
- Database owner confirms backup/export and recovery plan.
- Support owner confirms beta contact path and incident messaging.
- Product owner confirms only intended beta workspaces can access the feature.

Do not widen beta access until the previous beta window has a clean reconciliation report.
