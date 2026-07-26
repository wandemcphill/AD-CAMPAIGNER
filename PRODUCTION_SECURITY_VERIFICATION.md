# Production Security Verification

Date: 2026-06-05

Status: **BLOCKED - production still diverges from local remediation code**

## Executive Summary

The deployable remediation snapshot was isolated, tested, committed, and pushed:

- Branch: `codex/deploy-security-remediation-p1`
- Remediation commit: `5c2f013626e2d2030286073e76fbd94f45cfa4e0`
- Commit message: `security: deploy remediation guardrails`
- Remote: `origin/codex/deploy-security-remediation-p1`

Production did not pick up this commit after branch push. Live probes against `https://ft-campaigner-api-fra-g25g.onrender.com` still show the old production behavior:

- `GET /v1/admin/overview` is public (`200`)
- `GET /v1/admin/smm/health` is public (`200`)
- `POST /v1/admin/ai/suggestions` is public (`201`)
- Growth routes are missing (`404`)

Deployment is blocked because the local environment has no Render API token, deploy hook, or authenticated smoke credentials. A branch push alone did not update the live Render services.

## Deployment Evidence

| Item | Result |
| --- | --- |
| Remediation branch created | `codex/deploy-security-remediation-p1` |
| Branch push | Succeeded |
| Production deploy trigger | Blocked |
| Render credentials in environment | None found for `RENDER`, `DEPLOY`, or `HOOK` |
| Authenticated smoke credentials | None found for `AUTH_SMOKE_TOKEN`, `AUTH_SMOKE_EMAIL`, or `AUTH_SMOKE_PASSWORD` |
| Deployed commit hash | Not verified; production still appears stale |
| Candidate remediation commit | `5c2f013626e2d2030286073e76fbd94f45cfa4e0` |

## File Inventory

### Tracked Modified Files Included

- `.env.example`
- `apps/admin/app/page.tsx`
- `apps/api/src/modules/app.module.ts`
- `apps/api/src/modules/auth-session.service.ts`
- `apps/api/src/modules/digital-access/digital-access.controller.ts`
- `apps/api/src/modules/digital-access/digital-access.service.test.ts`
- `apps/api/src/modules/digital-access/digital-access.service.ts`
- `apps/api/src/modules/managed-ads.service.spec.ts`
- `apps/api/src/modules/managed-ads.service.ts`
- `apps/api/src/modules/otp/otp.controller.ts`
- `apps/api/src/modules/otp/otp.service.test.ts`
- `apps/api/src/modules/otp/otp.service.ts`
- `apps/api/src/modules/platform.controllers.ts`
- `apps/api/src/modules/platform.dtos.ts`
- `apps/api/src/modules/platform.service.test.ts`
- `apps/api/src/modules/platform.service.ts`
- `apps/api/src/modules/realtime.gateway.ts`
- `apps/api/src/modules/request-context.ts`
- `apps/web/app/campaigns/[id]/campaign-detail-client.tsx`
- `apps/web/app/campaigns/api.ts`
- `apps/web/app/page.tsx`
- `apps/worker/src/main.ts`
- `package.json`
- `packages/config/src/index.ts`
- `packages/database/prisma/schema.prisma`
- `packages/types/src/index.ts`
- `render.yaml`
- `scripts/deployed-smoke.ts`
- `services/otp/src/index.ts`
- `services/otp/src/otp.test.ts`
- `services/smm/src/index.ts`
- `services/smm/src/smm.test.ts`

### Untracked Files Promoted Into The Commit

- `apps/admin/app/growth-services/**`
- `apps/admin/app/not-found.tsx`
- `apps/api/src/modules/authorization.decorators.ts`
- `apps/api/src/modules/authorization.guard.test.ts`
- `apps/api/src/modules/authorization.guard.ts`
- `apps/web/app/campaigns/[id]/financial-history/**`
- `apps/web/app/growth-services/**`
- `apps/web/app/not-found.tsx`
- `packages/database/prisma/migrations/20260604120000_campaign_spend_transparency/migration.sql`
- `packages/database/prisma/migrations/20260604170000_financial_integrity_guards/migration.sql`

### Excluded And Stashed As Unrelated Work

The following work was intentionally excluded from the remediation commit and temporarily stashed as `p1-unrelated-worktree` while tests ran:

- `apps/admin/app/campaign-ops/**` tracked modifications
- Prior thread reports such as `READINESS_SYSTEM_AUDIT.md`, `FINANCIAL_REMEDIATION_REPORT.md`, and launch/evidence reports
- Prior E2E screenshots under `docs/e2e-evidence/**`
- `campaign-ops-overview-smoke.png`

## Remediation Surface

The commit includes these deploy-relevant changes:

- Global default-deny authorization guard registered via `APP_GUARD`
- `@Public()` and `@RequirePermissions(...)` decorators
- Admin route RBAC coverage for core admin, campaign ops, growth, digital access, OTP, realtime, and managed ads resources
- Growth marketplace API and UI routes
- Financial guardrails for wallet, invoices, holds, captures, refunds, spend logging, and consistency checks
- Prisma migrations for campaign spend transparency and financial integrity guardrails
- Render deployment fixes for API, Worker, Admin, and Web services
- Deployed smoke script updates for the exact P1 route matrix
- Protected `GET /v1/admin/ai/suggestions` route added so the required GET probe returns an authorization response after deployment

## Local Verification

| Check | Result |
| --- | --- |
| API tests | Passed: 9 files, 66 tests |
| OTP service tests | Passed: 1 file, 5 tests |
| SMM service tests | Passed: 1 file, 11 tests |
| Prisma schema validation | Passed |
| API build | Passed |
| Worker build | Passed |
| Admin typecheck | Passed |
| Admin tests | Passed with no test files |
| Admin production build | Passed |
| Web typecheck | Passed |
| Web tests | Passed with no test files |
| Web production build | Passed on isolated retry with `NODE_OPTIONS=--max_old_space_size=4096` |
| Cached diff whitespace check | Passed |

## Production Route Matrix

Before values are from `PRODUCTION_DIVERGENCE_REPORT.md`. After values were captured live on 2026-06-05 after pushing the remediation branch.

| Route | Expected | Before | After Branch Push | Status |
| --- | --- | --- | --- | --- |
| `GET /v1/admin/overview` | `401` or `403` | `200` | `200` | Fail |
| `GET /v1/admin/smm/health` | `401` or `403` | `200` | `200` | Fail |
| `GET /v1/admin/ai/suggestions` | `401` or `403` | `404` | `404` | Fail |
| `POST /v1/admin/ai/suggestions` | `401` or `403` | `201` | `201` | Fail |
| `GET /v1/growth/catalog` | `200` | `404` | `404` | Fail |
| `GET /v1/growth/services` | `200` | `404` | `404` | Fail |
| `GET /v1/growth/orders` | Authenticated response | `404` | `404` unauthenticated | Fail |

## Curl Output

```text
GET /v1/admin/overview
HTTP/1.1 200 OK
{"users":18420,"activeCampaigns":312,"pendingModeration":18,"paymentVolumeMinor":482500000,"fraudSignals":7,"smmSupplierCount":4,"queueHealth":{"campaign":"healthy","smm":"healthy","notifications":"healthy","analytics":"healthy"}}

GET /v1/admin/smm/health
HTTP/1.1 200 OK
{"status":"degraded","suppliers":[{"supplierName":"smdpanel","status":"down","reason":"smdpanel has no matching FOLLOWERS service for INSTAGRAM_PROFILE."},{"supplierName":"smmraja","status":"healthy"},{"supplierName":"justanotherpanel","status":"healthy"},{"supplierName":"peakerr","status":"healthy"}]}

GET /v1/admin/ai/suggestions
HTTP/1.1 404 Not Found
{"message":"Cannot GET /v1/admin/ai/suggestions","error":"Not Found","statusCode":404}

POST /v1/admin/ai/suggestions
HTTP/1.1 201 Created
{"headlines":["Grow your tiktok live today"],"captions":["A focused engagement campaign for creator-led commerce buyers."],"hashtags":["#FlipTrybe","#Growth","#CreatorBusiness"]}

GET /v1/growth/catalog
HTTP/1.1 404 Not Found
{"message":"Cannot GET /v1/growth/catalog","error":"Not Found","statusCode":404}

GET /v1/growth/services
HTTP/1.1 404 Not Found
{"message":"Cannot GET /v1/growth/services","error":"Not Found","statusCode":404}

GET /v1/growth/orders
HTTP/1.1 404 Not Found
{"message":"Cannot GET /v1/growth/orders","error":"Not Found","statusCode":404}
```

## Deployed Smoke Output

Command:

```powershell
$env:API_URL='https://ft-campaigner-api-fra-g25g.onrender.com'
$env:APP_URL='https://fliptrybe-ads-campaigner-web-g25g.onrender.com'
$env:ADMIN_URL='https://fliptrybe-ads-campaigner-admin-g25g.onrender.com'
corepack pnpm smoke:deployed
```

Summary:

```text
36 passed, 5 failed, 2 skipped

Failed:
- P1 growth catalog returned HTTP 404
- P1 growth services returned HTTP 404
- P1 admin overview returned HTTP 200; expected 401 or 403
- P1 admin SMM health returned HTTP 200; expected 401 or 403
- P1 admin AI suggestions returned HTTP 404; expected 401 or 403

Skipped:
- Authenticated checks skipped because AUTH_SMOKE_TOKEN or AUTH_SMOKE_EMAIL/AUTH_SMOKE_PASSWORD was not available.
- Write smoke skipped because SMOKE_ENABLE_WRITE_CHECKS=true was not set.
```

## Screenshots And Evidence Files

- Web shell screenshot: `docs/production-security-evidence/production-web-shell.png`
- Admin shell screenshot: `docs/production-security-evidence/production-admin-shell.png`
- API route matrix evidence: `docs/production-security-evidence/production-api-route-matrix.html`

Direct API screenshots could not be captured through the in-app browser because the browser blocked navigation to the API host. The API evidence is therefore captured as curl output and a generated HTML route matrix populated from live production responses.

## Observed Issues

| Severity | Issue | Evidence | Remediation |
| --- | --- | --- | --- |
| Critical | Core admin routes remain public in production | `GET /v1/admin/overview` returns `200`; `GET /v1/admin/smm/health` returns `200`; `POST /v1/admin/ai/suggestions` returns `201` | Deploy commit `5c2f013626e2d2030286073e76fbd94f45cfa4e0` to production API |
| Critical | Growth API is not deployed | `/v1/growth/catalog`, `/v1/growth/services`, and `/v1/growth/orders` all return `404` | Deploy API commit and verify `GrowthController` registration |
| High | Required `GET /v1/admin/ai/suggestions` probe cannot pass on current production | Production returns `404`; local commit adds protected GET route | Deploy API commit |
| High | Authenticated growth order production check could not be completed | No production smoke auth token or credentials in environment | Provide `AUTH_SMOKE_TOKEN` or smoke account credentials |
| High | Production deployment could not be triggered from this environment | No Render deploy hook/API token found | Provide Render deploy access or merge this branch into the Render-tracked branch |

## Required Next Steps

1. Promote `codex/deploy-security-remediation-p1` into the branch Render tracks for production, or provide a Render deploy hook/API token.
2. Deploy all affected services:
   - `ft-campaigner-api-fra`
   - `fliptrybe-ads-campaigner-worker`
   - `fliptrybe-ads-campaigner-admin`
   - `fliptrybe-ads-campaigner-web`
3. Run `corepack pnpm smoke:deployed` with:
   - `API_URL=https://ft-campaigner-api-fra-g25g.onrender.com`
   - `APP_URL=https://fliptrybe-ads-campaigner-web-g25g.onrender.com`
   - `ADMIN_URL=https://fliptrybe-ads-campaigner-admin-g25g.onrender.com`
   - `AUTH_SMOKE_TOKEN` or `AUTH_SMOKE_EMAIL` plus `AUTH_SMOKE_PASSWORD`
4. Re-run the P1 curl matrix and confirm:
   - Public admin routes return `401` or `403`
   - Growth catalog and services return `200`
   - Authenticated growth orders return a workspace-scoped response
