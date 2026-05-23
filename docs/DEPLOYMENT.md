# Deployment

FlipTrybe Ads Campaigner deploys from the repository root with the Render Blueprint in `render.yaml`.

## Current Render State

The production Render stack is already provisioned:

- `ft-campaigner-api-fra`: NestJS API web service with `/v1/health` checks.
- `fliptrybe-ads-campaigner-web`: customer dashboard static site served from Render's CDN.
- `fliptrybe-ads-campaigner-admin`: operations dashboard static site served from Render's CDN.
- `fliptrybe-ads-campaigner-worker`: paid BullMQ worker for queue processing.
- `fliptrybe-ads-campaigner-postgres`: managed PostgreSQL database.
- `fliptrybe-ads-campaigner-redis`: Render Key Value instance for Redis-compatible queues.

The API service runs Prisma migrations in `preDeployCommand` before starting. All managed services are pinned to Render's `frankfurt` region.

Production secrets are now configured in Render for Korapay, the treasury bank account, Cloudinary, SMM supplier keys and service maps, JWT/session secrets, Postgres, and Redis. Keep secret values in Render only; do not copy them into the repository or deployment notes.

The Blueprint keeps Digital Access, OTP, and worker automation disabled by default. After the initial Blueprint creation, Render's service Environment tabs are the source of truth for live toggles.

## Core Production Env

Media storage is configured for Cloudinary through `STORAGE_PROVIDER=cloudinary`. The API service must have `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`, and the optional Cloudinary folder/distribution values set before upload flows are enabled.

SMM fulfillment is configured as a routed multi-supplier layer across SMDPanel, SMM Raja, JustAnotherPanel, and Peakerr. Keep supplier currencies in USD, keep customer wallet/pricing in NGN unless a workspace explicitly changes currency later, and use each `*_SERVICE_MAP` JSON value to pin known-good services.

Korapay is the live Phase 1 payment gateway when `PAYMENT_PROVIDER=live` and `KORAPAY_SECRET_KEY` is present. Confirm `KORAPAY_WEBHOOK_URL` matches the actual API domain in the form `https://<api-domain>/api/webhooks/korapay`, keep `KORAPAY_REDIRECT_URL` pointed at the customer web app, and keep treasury bank details in Render env only. `KORAPAY_WEBHOOK_SECRET` is reserved for the actual webhook signing secret; do not put the webhook URL in that variable.

Keep `TRUST_PROXY_AUTH_HEADERS=false` and `DIGITAL_ACCESS_TRUST_AUTH_HEADERS=false` on public Render services. Only enable either flag behind a trusted auth proxy that strips incoming user-supplied identity headers and reissues verified headers to the API.

## Rollout Preflight

Use the local preflight script to check flag consistency before each staged change. It only reads environment variables and does not call external services.

```powershell
npx --yes tsx scripts/rollout-check.ts --target=api --stage=digital-access-api --strict-production
npx --yes tsx scripts/rollout-check.ts --target=web --stage=digital-access-api
npx --yes tsx scripts/rollout-check.ts --target=admin --stage=digital-access-admin
npx --yes tsx scripts/rollout-check.ts --target=worker --stage=digital-access-worker --strict-production
```

Targets are `api`, `web`, `admin`, and `worker`. Stages are `off`, `digital-access-api`, `digital-access-admin`, `digital-access-worker`, `otp-beta`, and `consistency`. `digital-access-beta` is accepted as an alias for `digital-access-admin`.

Use `--strict-production` when running with real Render env values so required production secrets are checked too.

## Staged Rollout

Roll out one phase at a time. Deploy the affected Render services, confirm `/v1/health` for the API, check logs for the API and worker, and only then move to the next phase.

### 1. Digital Access API

Enable the customer-facing Digital Access API and web UI while keeping admin actions and automation off.

API service:

```text
ENABLE_DIGITAL_ACCESS=true
ENABLE_DIGITAL_ACCESS_ADMIN=false
DIGITAL_ACCESS_WORKER_ENABLED=false
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false
TRUST_PROXY_AUTH_HEADERS=false
DIGITAL_ACCESS_TRUST_AUTH_HEADERS=false
```

Web service:

```text
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS=true
```

Admin service:

```text
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN=false
```

Worker service:

```text
DIGITAL_ACCESS_WORKER_ENABLED=false
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false
```

### 2. Digital Access Admin

After customer flows are healthy, enable the operations dashboard controls.

API service:

```text
ENABLE_DIGITAL_ACCESS=true
ENABLE_DIGITAL_ACCESS_ADMIN=true
DIGITAL_ACCESS_WORKER_ENABLED=false
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false
```

Admin service:

```text
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN=true
```

Keep the worker automation flags off in this phase.

### 3. Digital Access Automation Worker

After manual admin fulfillment is stable, enable worker processing for Digital Access automation.

API service stays on the admin phase values and should keep worker flags off:

```text
ENABLE_DIGITAL_ACCESS=true
ENABLE_DIGITAL_ACCESS_ADMIN=true
DIGITAL_ACCESS_WORKER_ENABLED=false
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false
```

Worker service:

```text
ENABLE_DIGITAL_ACCESS=true
ENABLE_DIGITAL_ACCESS_ADMIN=true
DIGITAL_ACCESS_WORKER_ENABLED=true
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=true
```

Keep all OTP flags false during the Digital Access automation rollout.

### 4. OTP Beta Later

Do not enable OTP until provider keys, compliance-approved beta workspaces, and the OTP migration path are confirmed.

API service:

```text
ENABLE_OTP_MODULE=true
ENABLE_PREMIUM_OTP=true
ENABLE_BUDGET_OTP=true
ENABLE_OTP_ADMIN=true
OTP_PROVIDER_MODE=live
OTP_BETA_WORKSPACE_IDS=<comma-separated-approved-workspace-ids>
SMSACTIVATE_COMPATIBLE_ENABLED=false
```

Worker service:

```text
ENABLE_OTP_MODULE=true
ENABLE_PREMIUM_OTP=true
ENABLE_BUDGET_OTP=true
ENABLE_OTP_ADMIN=true
OTP_WORKER_ENABLED=true
OTP_ALLOCATION_WORKER_ENABLED=true
OTP_POLLING_WORKER_ENABLED=true
OTP_REFUNDS_WORKER_ENABLED=true
OTP_PROVIDER_HEALTH_WORKER_ENABLED=true
OTP_PROVIDER_MODE=live
OTP_BETA_WORKSPACE_IDS=<comma-separated-approved-workspace-ids>
SMSACTIVATE_COMPATIBLE_ENABLED=false
```

Set `OTP_PROVIDER_MODE=sandbox` only if the selected OTP supplier has a real sandbox mode. Keep `SMSACTIVATE_COMPATIBLE_ENABLED=false` unless a trusted replacement endpoint is supplied with both `SMSACTIVATE_API_URL` and `SMSACTIVATE_API_KEY`.

## Disable Or Revert

For an urgent Digital Access automation stop, disable the worker first:

```text
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false
DIGITAL_ACCESS_WORKER_ENABLED=false
```

To hide Digital Access from users and operators:

```text
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS=false
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN=false
ENABLE_DIGITAL_ACCESS_ADMIN=false
ENABLE_DIGITAL_ACCESS=false
```

For an OTP stop, disable the worker queue gates first, then the API feature gates:

```text
OTP_PROVIDER_HEALTH_WORKER_ENABLED=false
OTP_REFUNDS_WORKER_ENABLED=false
OTP_POLLING_WORKER_ENABLED=false
OTP_ALLOCATION_WORKER_ENABLED=false
OTP_WORKER_ENABLED=false
ENABLE_OTP_ADMIN=false
ENABLE_BUDGET_OTP=false
ENABLE_PREMIUM_OTP=false
ENABLE_OTP_MODULE=false
OTP_PROVIDER_MODE=mock
```

After any revert, redeploy the changed Render services and run:

```powershell
npx --yes tsx scripts/rollout-check.ts --target=api --stage=off
npx --yes tsx scripts/rollout-check.ts --target=web --stage=off
npx --yes tsx scripts/rollout-check.ts --target=admin --stage=off
npx --yes tsx scripts/rollout-check.ts --target=worker --stage=off
```

## Fresh Blueprint Flow

For a new Render environment:

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the GitHub repo.
3. Render will detect `render.yaml` at the repo root.
4. Confirm the generated API, web, admin, worker, Postgres, and Key Value services.
5. Add real provider secrets in Render.
6. Deploy the Blueprint.

## Production Notes

- `DATABASE_URL` is injected from Render Postgres.
- `REDIS_URL` is injected from Render Key Value.
- The Key Value instance is internal-only with `ipAllowList: []`.
- Service names are used for the expected `onrender.com` URLs; update `APP_URL`, `ADMIN_URL`, `API_URL`, and `NEXT_PUBLIC_API_URL` if Render assigns different subdomains.
- Feature toggles should be changed in Render service env and deployed in small batches.
