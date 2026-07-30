# FlipTrybe Authorization Remediation Report

Generated: 2026-06-05

## Executive Summary

R1 remediation is implemented at code level.

- A global default-deny authorization guard now protects all HTTP handlers unless they are explicitly marked public or mapped to required permissions.
- All discovered API controllers in `apps/api/src/modules/platform.controllers.ts`, `apps/api/src/modules/otp/otp.controller.ts`, and `apps/api/src/modules/digital-access/digital-access.controller.ts` are explicitly annotated.
- Previously exposed admin routes are now protected by `admin:access`:
  - `GET /v1/admin/overview`
  - `GET /v1/admin/smm/health`
  - `POST /v1/admin/ai/suggestions`
- Managed ads finance and admin service methods now re-check DB-backed workspace membership before privileged mutations.
- Realtime socket events now emit privileged snapshots only when DB-backed context has the required permission.

Live production still requires deployment of this code before the public surface is remediated in production.

## Evidence Files

- Global guard and decorators: `apps/api/src/modules/authorization.guard.ts`, `apps/api/src/modules/authorization.decorators.ts`
- Guard registration: `apps/api/src/modules/app.module.ts`
- DB-backed session context: `apps/api/src/modules/auth-session.service.ts`
- Request context role/permission fields: `apps/api/src/modules/request-context.ts`
- HTTP route permission annotations: `apps/api/src/modules/platform.controllers.ts`, `apps/api/src/modules/otp/otp.controller.ts`, `apps/api/src/modules/digital-access/digital-access.controller.ts`
- Realtime permission checks: `apps/api/src/modules/realtime.gateway.ts`
- Service-level managed ads checks: `apps/api/src/modules/managed-ads.service.ts`
- Tests: `apps/api/src/modules/authorization.guard.test.ts`, `apps/api/src/modules/managed-ads.service.spec.ts`
- Role inheritance source: `packages/auth/src/index.ts`

## Default-Deny Policy

Implemented in `AuthorizationGuard`.

- `@Public()` routes bypass session lookup intentionally.
- Routes without `@Public()` or `@RequirePermissions(...)` throw `403 Route is not explicitly authorized.`
- Protected non-HTTP transports throw `403 Route is not explicitly authorized for this transport.`
- Protected HTTP routes resolve workspace membership through `AuthSessionService.getWorkspaceContext(...)`.
- Required permissions are evaluated with `hasPermission(...)` from `@fliptrybe/auth`.

`AppModule` registers the guard as an `APP_GUARD`, so it applies globally to HTTP controllers.

## Role Permission Matrix

Source: `packages/auth/src/index.ts`.

| Role | Effective built-in permissions |
|---|---|
| OWNER | `campaign:create`, `campaign:approve`, `campaign:manage`, `payment:manage`, `wallet:withdraw`, `analytics:read`, `team:manage`, `admin:access`, `support:manage`, `audit:read` |
| ADMIN | `campaign:create`, `campaign:approve`, `campaign:manage`, `payment:manage`, `analytics:read`, `team:manage`, `admin:access`, `support:manage`, `audit:read` |
| MANAGER | `campaign:create`, `campaign:manage`, `analytics:read`, `support:manage` |
| MARKETER | `campaign:create`, `campaign:manage`, `analytics:read` |
| FINANCE | `payment:manage`, `wallet:withdraw`, `analytics:read`, `audit:read` |
| SUPPORT | `support:manage`, `analytics:read` |
| VIEWER | `analytics:read` |

Team-member `permissions` may add explicit permissions in addition to role inheritance.

## Endpoint Inventory

All HTTP routes are under `/v1` except `POST /api/webhooks/korapay`, which remains excluded from the global prefix in `apps/api/src/main.ts`.

| Surface | Routes | Authorization |
|---|---|---|
| Health | `GET /v1/health` | Public |
| Auth | `POST /v1/auth/register`, `POST /v1/auth/login` | Public |
| Auth session | `GET /v1/auth/session`, `POST /v1/auth/logout`, `POST /v1/auth/exchange` | `analytics:read` |
| Organizations | `GET /v1/organizations` | `admin:access` |
| Teams | `GET /v1/teams` | `team:manage` |
| Client profile | `GET /v1/client-profile` | `analytics:read` |
| Client profile mutation | `PATCH /v1/client-profile` | `campaign:create` |
| Company profiles | `GET /v1/company-profiles` | `analytics:read` |
| Company profile mutation | `POST /v1/company-profiles`, `PATCH /v1/company-profiles/:id` | `campaign:create` |
| Campaign reads | `GET /v1/campaigns`, `GET /v1/campaigns/:id`, ledger, budget, spend, timeline, notes, assets, reports | `analytics:read` |
| Campaign creation | `POST /v1/campaigns`, `POST /v1/campaigns/quote`, `POST /v1/campaigns/:id/submit` | `campaign:create` |
| Campaign controls | `PATCH /v1/campaigns/:id`, start, pause, resume, request changes, stop, notes, assets | `campaign:manage` |
| Campaign budget/finance | increase/decrease budget, invoices, budget holds, release, capture | `payment:manage` |
| Campaign audit | `GET /v1/campaigns/:id/audit`, `GET /v1/audit/logs` | `audit:read` |
| Destinations | `GET /v1/destinations/catalog` | Public |
| Live campaigns | `GET /v1/live` | `analytics:read` |
| Live boost creation | `POST /v1/live/boosts` | `campaign:create` |
| SMM public catalog | `GET /v1/smm/services` | Public |
| SMM supplier internals | supplier services, balance, health | `admin:access` |
| SMM order actions | quote/orders | `campaign:create` |
| SMM order management | status/refill/cancel | `campaign:manage` |
| Growth public catalog | `GET /v1/growth/catalog`, `GET /v1/growth/services` | Public |
| Growth customer orders | `GET /v1/growth/orders`, `GET /v1/growth/orders/:id` | `analytics:read` |
| Growth order creation | `POST /v1/growth/orders` | `campaign:create` |
| Growth risk report | `GET /v1/growth/risk-report` | `admin:access` |
| Payments | `POST /v1/payments/intents`, `POST /v1/payments/verify/:reference` | `payment:manage` |
| Wallet | `GET /v1/wallet`, `POST /v1/wallet/funding-intents` | `payment:manage` |
| Invoices | `GET /v1/invoices`, `GET /v1/invoices/:id`, `POST /v1/invoices/:id/pay` | `payment:manage` |
| Korapay webhook | `POST /api/webhooks/korapay` | Public HTTP route; service verifies Korapay signature |
| Analytics | overview and AI insights | `analytics:read` |
| Notifications | list, read, read-all | `analytics:read` |
| Referrals | `POST /v1/referrals/accounts` | `admin:access` |
| Support | `GET /v1/support/tickets` | `support:manage` |
| Support creation | `POST /v1/support/tickets` | `analytics:read` |
| Media uploads | upload and completion endpoints | `campaign:manage` |
| Search | `GET /v1/search` | `analytics:read` |
| Admin core | `GET /v1/admin/overview`, `GET /v1/admin/smm/health`, `POST /v1/admin/ai/suggestions` | `admin:access` |
| Admin growth | overview, services, orders, supplier audit, risk report | `admin:access` |
| Admin growth finance overrides | order update and override | `admin:access` + `payment:manage` |
| Admin campaign ops reads | overview, campaigns, queue, reports, activity | `admin:access` + `campaign:manage` |
| Admin campaign status/report publish | status update, report publish | `admin:access` + `campaign:approve` |
| Admin campaign ops mutations | assignment, notes, ad URLs, metrics, report draft, bulk | `admin:access` + `campaign:manage` |
| Digital Access public catalog | categories, services, service detail | Public |
| Digital Access request reads | request list/detail | `analytics:read` |
| Digital Access request creation | `POST /v1/digital-access/requests` | `campaign:create` |
| Digital Access admin | overview, categories, services, plans, requests, status, assignment | `admin:access` |
| OTP public catalog | `GET /v1/otp/services` | Public |
| OTP quote | `POST /v1/otp/quote` | `analytics:read` |
| OTP customer finance/order operations | orders, cancel, refund, wallet | `payment:manage` |
| OTP admin | overview, providers, controls, pricing rules | `admin:access` |

## Realtime Authorization

Source: `apps/api/src/modules/realtime.gateway.ts`.

- Socket connection resolves DB-backed workspace context using `AuthSessionService`.
- Admin snapshots are emitted only when `admin:access` is present.
- `events:latest` requires `analytics:read`; unauthorized sockets receive an empty event list.
- `broadcast:test` requires `admin:access`; unauthorized sockets receive `authorization:error`.
- Digital access admin monitoring is emitted only with `admin:access`.

## Campaign Authorization Audit

Implemented protections:

- Campaign reads and writes scope by `workspaceId`.
- `AuthSessionService.getWorkspaceContext(...)` verifies that the session user belongs to the organization that owns the requested workspace.
- `ManagedAdsService.assertCampaignPermissions(...)` re-checks the workspace's organization and the caller's `TeamMember` before privileged campaign, finance, and admin operations.
- Campaign creation/submission requires `campaign:create`.
- Campaign edits, client controls, notes, assets, assignments, manual placements, manual metrics, report drafts, and bulk admin actions require `campaign:manage` where applicable.
- Admin status approval and report publishing require `campaign:approve`.
- Admin campaign operations additionally require `admin:access`.

## Finance Authorization Audit

Implemented protections:

- Payment intents and verification require `payment:manage`.
- Wallet funding and invoice payment routes require `payment:manage`.
- Campaign invoice creation, wallet settlement, budget hold creation, release, and capture require `payment:manage` at the controller and service layers.
- Budget increase/decrease now require `payment:manage` in `ManagedAdsService`, matching the controller policy.
- Finance mutations remain workspace-scoped by `workspaceId`.

## Cross-Workspace Controls

Implemented controls:

- Session workspace context is DB-validated in `AuthSessionService`; JWT/header values alone are not trusted for role or permissions.
- `requireScopedIdentity(...)` now preserves role and permission fields only after validated context is present.
- Managed ads service permission checks resolve the workspace, then resolve the caller's team membership in that workspace's organization.
- Existing campaign, invoice, wallet, media, notification, report, and budget-hold lookups continue to include the active `workspaceId`.

Regression coverage:

- `authorization.guard.test.ts` verifies protected route access uses DB-backed context and propagates auth-session failures.
- `managed-ads.service.spec.ts` verifies privileged service calls reject when the workspace membership cannot be verified.

## Tests And Verification

Commands executed:

```powershell
corepack pnpm --filter @fliptrybe/api test -- authorization.guard.test.ts managed-ads.service.spec.ts
corepack pnpm --filter @fliptrybe/api build
corepack pnpm --filter @fliptrybe/api test
git diff --check -- apps/api/src/modules/app.module.ts apps/api/src/modules/auth-session.service.ts apps/api/src/modules/request-context.ts apps/api/src/modules/authorization.decorators.ts apps/api/src/modules/authorization.guard.ts apps/api/src/modules/authorization.guard.test.ts apps/api/src/modules/platform.controllers.ts apps/api/src/modules/otp/otp.controller.ts apps/api/src/modules/digital-access/digital-access.controller.ts apps/api/src/modules/realtime.gateway.ts apps/api/src/modules/managed-ads.service.ts apps/api/src/modules/managed-ads.service.spec.ts
```

Results:

- Targeted API tests: 9 files passed, 56 tests passed.
- API TypeScript build: passed.
- Full API tests: 9 files passed, 56 tests passed.
- Diff whitespace check: passed; Git reported only existing CRLF normalization warning for `managed-ads.service.ts`.

## Remediation Status

| Success criterion | Status | Evidence |
|---|---|---|
| Unauthenticated admin access = 0 | Met in code | Global default-deny guard plus `admin:access` on admin controllers |
| Cross-workspace access = 0 | Met for audited API/service paths | DB-backed workspace context and service-level membership checks |
| Critical auth findings = 0 | Met for R1 scope in local verification | Build and API tests passed |

## Deployment Note

This report covers local code remediation and verification. Production will remain vulnerable until the remediated commit is deployed and verified against the live environment.
