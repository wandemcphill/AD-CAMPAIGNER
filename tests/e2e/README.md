# E2E Acceptance Foundations

This folder tracks deployed acceptance coverage for the Render API, web app, and admin app. The first executable foundation is the deployed smoke runner at `scripts/deployed-smoke.ts`.

## Deployed Smoke

Run against deployed Render services:

```powershell
$env:API_URL = "https://your-api.onrender.com"
$env:APP_URL = "https://your-web.onrender.com"
$env:ADMIN_URL = "https://your-admin.onrender.com"
pnpm exec tsx scripts/deployed-smoke.ts
```

If `pnpm` shims are unavailable locally, use the pinned package manager through npm:

```powershell
npm exec --package pnpm@10.18.3 -- pnpm exec tsx scripts/deployed-smoke.ts
```

Default checks are production-safe GET checks:

- `GET /v1/health` returns JSON with `status=ok`.
- Web and admin URLs return an HTML app shell when `APP_URL` and `ADMIN_URL` are set.
- `GET /v1/destinations/catalog`, `GET /v1/smm/services`, and `GET /v1/wallet` return expected JSON shapes.
- `GET /v1/auth/session` rejects unauthenticated requests.
- `GET /v1/digital-access/requests` rejects unauthenticated requests.

The runner does not print bearer tokens, passwords, or response bodies.

## Environment Variables

Required:

- `API_URL`: deployed API origin. It can include `/v1`; the runner will avoid duplicating the prefix.

Recommended for full deployed acceptance:

- `APP_URL`: deployed customer web app URL.
- `ADMIN_URL`: deployed admin app URL.

Optional authenticated checks:

- `AUTH_SMOKE_TOKEN`: bearer token for a real smoke user. Preferred for production.
- `AUTH_SMOKE_EMAIL` and `AUTH_SMOKE_PASSWORD`: credentials to exchange for a token.
- `AUTH_SMOKE_LOGIN_URL`: login endpoint override. Defaults to `${API_URL}/v1/auth/login`.
- `AUTH_SMOKE_ADMIN=true`: also checks `GET /v1/admin/digital-access/overview`.

Optional behavior:

- `SMOKE_TIMEOUT_MS`: request timeout in milliseconds. Defaults to `15000`.
- `SMOKE_ENABLE_WRITE_CHECKS=true`: creates one synthetic support ticket through `POST /v1/support/tickets`. Leave unset for normal production smoke runs.

## Local Smoke

When the API and apps are running locally:

```powershell
$env:API_URL = "http://localhost:4000"
$env:APP_URL = "http://localhost:3000"
$env:ADMIN_URL = "http://localhost:3001"
pnpm exec tsx scripts/deployed-smoke.ts
```

For a help screen:

```powershell
pnpm exec tsx scripts/deployed-smoke.ts --help
```

## Acceptance Backlog

These browser flows should be automated next with Playwright or the repo-standard browser E2E tool once the frontend/API integration workers land their changes:

- Web onboarding, login, and session bootstrap.
- Workspace-scoped Digital Access service browse and request history.
- Campaign builder draft, quote, and create flow.
- Wallet funding through a configured smoke payment path.
- TikTok LIVE promotion setup.
- SMM service catalog and order creation.
- Support ticket creation and status visibility.
- Admin Digital Access fulfillment, payment review, risk/fraud desk, and audit trail checks.

Browser E2E should use a dedicated smoke workspace and must keep production mutation tests behind explicit opt-in env vars, following the same pattern as `SMOKE_ENABLE_WRITE_CHECKS`.
