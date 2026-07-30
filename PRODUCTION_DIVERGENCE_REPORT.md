# Production Divergence Report

Date: 2026-06-05

## Executive Finding

Production is not serving the current local workspace code for the API.

This is proven by two incompatible facts:

1. The current workspace registers Growth routes and attaches an authorization guard to admin routes.
2. Production returns 404 for those Growth routes and returns 200 for unauthenticated `/v1/admin/overview`.

The exact root cause available from local and public production evidence is: the route/guard fixes are present only in the current working tree and are not in the deployed production API artifact. The current working tree is also not clean: the relevant API module/controller files are modified, and the authorization guard/decorator files are untracked.

Without Render deploy metadata, this audit cannot name the deployed commit SHA. It can, however, state that the deployed API artifact does not contain the current local route/guard code.

## Determinations

| Question | Determination | Proof |
| --- | --- | --- |
| 1. Deployment is stale. | Yes, relative to the current workspace. | Production behavior cannot be produced by the current workspace route and guard definitions. |
| 2. Production differs from repository. | Production differs from the current local workspace. The current workspace also differs from Git HEAD. | `git status` shows modified `app.module.ts`, `platform.controllers.ts`, `render.yaml`, plus untracked `authorization.decorators.ts` and `authorization.guard.ts`. |
| 3. Route registration is broken. | Not in the current workspace. The Growth routes are registered locally. Production is missing them. | Local `GrowthController` is registered in `AppModule`; production `GET /v1/growth/catalog`, `/services`, and `/orders` return 404. |
| 4. Guards are not attached. | Not in the current workspace. Production does not enforce the expected guard on `/v1/admin/overview`. | Local `APP_GUARD` is registered. Production `/v1/admin/overview` returns 200 without auth. |
| 5. Admin endpoints bypass authorization. | Yes for production `/v1/admin/overview`. Not all admin endpoints are bypassing auth. | Production `/v1/admin/overview` returns 200, while `/v1/admin/campaign-ops/overview` returns 401. |

## Local Findings

### Git State

Current branch and HEAD:

```text
branch: main
HEAD: b9a75b5
```

Relevant dirty state:

```text
 M apps/api/src/modules/app.module.ts
 M apps/api/src/modules/platform.controllers.ts
 M render.yaml
?? apps/api/src/modules/authorization.decorators.ts
?? apps/api/src/modules/authorization.guard.ts
```

This means the guard implementation and route/guard wiring are not fully committed in the local checkout.

### Global Prefix

`apps/api/src/main.ts:11` sets the API global prefix to `v1`.

`apps/api/src/main.ts:12` excludes only the Korapay webhook path from that prefix.

Therefore `@Controller("growth")` maps to `/v1/growth/*`, and `@Controller("admin")` maps to `/v1/admin/*`.

### Growth Route Registration

Local code registers Growth routes:

- `apps/api/src/modules/app.module.ts:16` imports `GrowthController`.
- `apps/api/src/modules/app.module.ts:54` registers `GrowthController` in `controllers`.
- `apps/api/src/modules/platform.controllers.ts:503` defines `@Controller("growth")`.
- `apps/api/src/modules/platform.controllers.ts:504` applies `@RequirePermissions("analytics:read")` at class level.
- `apps/api/src/modules/platform.controllers.ts:509` marks the Growth catalog route public.
- `apps/api/src/modules/platform.controllers.ts:510` defines `catalog()`.
- `apps/api/src/modules/platform.controllers.ts:515` marks the Growth services route public.
- `apps/api/src/modules/platform.controllers.ts:516` defines `services()`.

Conclusion: local route registration is not broken for Growth. Production 404 is a deployment/artifact divergence.

### Admin Guard Registration

Local code registers an application guard:

- `apps/api/src/modules/app.module.ts:3` imports `APP_GUARD`.
- `apps/api/src/modules/app.module.ts:77` provides `APP_GUARD`.
- `apps/api/src/modules/app.module.ts:78` uses `AuthorizationGuard`.

Local admin controller metadata:

- `apps/api/src/modules/platform.controllers.ts:721` defines `@Controller("admin")`.
- `apps/api/src/modules/platform.controllers.ts:722` applies `@RequirePermissions("admin:access")`.
- `apps/api/src/modules/platform.controllers.ts:727` defines `overview()`.
- `apps/api/src/modules/platform.controllers.ts:728` returns `getAdminOverview()`.

Local guard behavior:

- `apps/api/src/modules/authorization.guard.ts:19` defines `AuthorizationGuard`.
- `apps/api/src/modules/authorization.guard.ts:31` allows only routes marked public.
- `apps/api/src/modules/authorization.guard.ts:41` rejects routes without explicit authorization metadata.
- `apps/api/src/modules/authorization.guard.ts:49` resolves workspace context from request headers.
- `apps/api/src/modules/authorization.guard.ts:60` rejects missing permissions.

Local tests:

```text
corepack pnpm --filter @fliptrybe/api test -- authorization.guard.test.ts

Test Files  9 passed (9)
Tests       66 passed (66)
```

Conclusion: local guard attachment is not broken. Production `/v1/admin/overview` is not running this guarded handler.

### Render Config

Local `render.yaml` identifies the API service and active health path:

- `render.yaml:4` names the API service `ft-campaigner-api-fra`.
- `render.yaml:9` sets `healthCheckPath: /v1/health`.
- `render.yaml:22` sets `API_URL`.
- `render.yaml:23` points API URL at `https://ft-campaigner-api-fra-g25g.onrender.com`.

The admin URL drift found in R4 was corrected locally:

- `render.yaml:20` defines `ADMIN_URL`.
- `render.yaml:21` now points to `https://fliptrybe-ads-campaigner-admin-g25g.onrender.com`.

This local config still needs a production deploy to become authoritative.

## Deployed Findings

Production target:

```text
https://ft-campaigner-api-fra-g25g.onrender.com
```

Public status checks from 2026-06-05:

| Route | Expected from current workspace | Production result | Finding |
| --- | --- | --- | --- |
| `GET /v1/health` | 200 | 200 | API host is alive. |
| `GET /v1/growth/catalog` | 200 public catalog | 404 | Growth route absent in deployed artifact. |
| `GET /v1/growth/services` | 200 public services | 404 | Growth route absent in deployed artifact. |
| `GET /v1/growth/orders` | 401/403 unauthenticated or authenticated workspace result | 404 | Growth route absent in deployed artifact. |
| `GET /v1/admin/overview` | 401/403 unauthenticated | 200 | Admin overview is publicly reachable in production. |
| `GET /v1/admin/campaign-ops/overview` | 401/403 unauthenticated | 401 | Not all admin routes bypass authorization. |
| `GET /v1/wallet` | 401/403 unauthenticated | 401 | Auth/scoping exists on other deployed routes. |
| `GET /v1/admin/growth/services` | 401/403 unauthenticated or 200 with admin token | 404 | Admin Growth route absent in deployed artifact. |

Command output:

```text
200 2.417090 https://ft-campaigner-api-fra-g25g.onrender.com/v1/health
404 1.207295 https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/catalog
404 1.399351 https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/services
404 1.434077 https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/orders
200 1.604554 https://ft-campaigner-api-fra-g25g.onrender.com/v1/admin/overview
401 2.093521 https://ft-campaigner-api-fra-g25g.onrender.com/v1/admin/campaign-ops/overview
401 2.216222 https://ft-campaigner-api-fra-g25g.onrender.com/v1/wallet
404 2.395829 https://ft-campaigner-api-fra-g25g.onrender.com/v1/admin/growth/services
```

Production health body:

```json
{"status":"ok","service":"fliptrybe-api","checkedAt":"2026-06-05T07:19:17.216Z","providers":{"ads":"mock-ads","ai":"mock-ai","payments":"korapay","smm":"smm-router:smdpanel,smmraja,justanotherpanel,peakerr","storage":"cloudinary-storage"},"operations":{"smmSuppliers":["smdpanel","smmraja","justanotherpanel","peakerr"],"smmPricingRules":7}}
```

Production public admin overview body:

```json
{"users":18420,"activeCampaigns":312,"pendingModeration":18,"paymentVolumeMinor":482500000,"fraudSignals":7,"smmSupplierCount":4,"queueHealth":{"campaign":"healthy","smm":"healthy","notifications":"healthy","analytics":"healthy"}}
```

## Root Cause

The deployed production API artifact is not the current local workspace API code.

The current workspace contains:

- `GrowthController` route registration.
- `AdminGrowthController` route registration.
- `APP_GUARD` registration.
- `AuthorizationGuard`.
- `@RequirePermissions("admin:access")` on `AdminController`.

Production behaves as if those changes are missing for the affected routes:

- Growth routes return 404, which means the deployed router does not have those route handlers.
- `/v1/admin/overview` returns 200 without auth, which means the deployed handler is not protected by the current admin controller metadata and guard.
- Other routes return 401, so this is not a total production auth failure or a network/proxy issue.

The local Git state explains how this can happen: relevant route/guard files are modified or untracked in the working tree. They are not fully represented by committed Git state in this checkout, and therefore cannot be assumed to be present in any Git-based production deploy.

## What This Rules Out

### Route Registration Broken In Current Code

Ruled out.

The current workspace registers `GrowthController` in `AppModule`, defines `@Controller("growth")`, and maps public `catalog` and `services` handlers under the global `/v1` prefix.

### Guards Not Attached In Current Code

Ruled out.

The current workspace provides `APP_GUARD` with `AuthorizationGuard`, and `AuthorizationGuard` tests pass.

### All Admin Endpoints Bypass Authorization In Production

Ruled out.

Production `/v1/admin/campaign-ops/overview` returns 401. The bypass is confirmed for `/v1/admin/overview`; it is not universal across every admin route.

## Exact Remediation

1. Commit the route and authorization changes.

   Required files:

   ```text
   apps/api/src/modules/authorization.decorators.ts
   apps/api/src/modules/authorization.guard.ts
   apps/api/src/modules/app.module.ts
   apps/api/src/modules/platform.controllers.ts
   render.yaml
   ```

2. Push the commit to the branch Render deploys for `ft-campaigner-api-fra`.

3. Redeploy the API service from that commit.

   Required deploy proof:

   - Render deploy ID.
   - Deployed commit SHA.
   - Build log showing the pushed commit.
   - API health check after deploy.

4. Verify the production routes immediately after deploy.

   Required expected results:

   ```sh
   curl -i https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/catalog
   # expected: 200

   curl -i https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/services
   # expected: 200

   curl -i https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/orders
   # expected: 401 or 403 without auth

   curl -i https://ft-campaigner-api-fra-g25g.onrender.com/v1/admin/overview
   # expected: 401 or 403 without auth

   curl -i https://ft-campaigner-api-fra-g25g.onrender.com/v1/admin/growth/services
   # expected: 401 or 403 without auth
   ```

5. Add these assertions to deployed smoke coverage.

   Required smoke additions:

   - Growth catalog returns 200.
   - Growth services returns 200.
   - Growth orders rejects unauthenticated requests.
   - Admin overview rejects unauthenticated requests.
   - Admin Growth services rejects unauthenticated requests.

6. Block launch signoff until the status matrix is clean.

   Required final state:

   | Route | Required unauthenticated result |
   | --- | --- |
   | `/v1/growth/catalog` | 200 |
   | `/v1/growth/services` | 200 |
   | `/v1/growth/orders` | 401/403 |
   | `/v1/admin/overview` | 401/403 |
   | `/v1/admin/growth/services` | 401/403 |

## Final Conclusion

R1/R2/R3 may be present in the local working tree, but they are not present in production for the audited API routes.

The exact production divergence is:

- Growth route handlers are absent from the deployed API artifact.
- The deployed admin overview handler bypasses the authorization expected in the current workspace.
- The current workspace changes needed to fix this are not fully committed, and therefore are not safely deployable through a Git-based production pipeline until committed and pushed.

