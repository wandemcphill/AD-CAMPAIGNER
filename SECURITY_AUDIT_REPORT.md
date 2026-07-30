# Security Audit Report

Date: 2026-06-04

Scope: static and local code audit of authentication, authorization, admin controls, campaign ownership, API exposure, realtime channels, and role behavior. This report is based on repository evidence only; no live production exploitation was performed.

Launch gate: FAIL. Critical vulnerabilities remain unresolved.

## Executive Summary

The system has a strong start in a few newer areas: JWT verification exists, workspace membership is checked in `AuthSessionService`, campaign records are usually scoped by `workspaceId`, and Digital Access shows a good admin authorization pattern.

The main platform surface is not yet safe for production. Several admin and marketplace endpoints are public, many privileged endpoints require only "any authenticated workspace member", and realtime sockets emit admin data without requiring admin authorization. A VIEWER or SUPPORT member can reach actions that should be OWNER, ADMIN, MANAGER, or FINANCE only. Some routes require no authentication at all.

Goal status: "No unresolved Critical vulnerabilities" is not met.

## Risk Register

| ID | Severity | Area | Risk | Status |
| --- | --- | --- | --- | --- |
| SEC-01 | Critical | API/Admin | Public admin, organization, team, OTP, SMM supplier, and Growth admin routes expose data or controls without authentication. | Open |
| SEC-02 | Critical | RBAC/Admin | Authenticated non-admin workspace members can call campaign-ops admin actions, assignments, reports, and finance-like campaign actions. | Open |
| SEC-03 | Critical | Realtime | Socket connections receive admin and marketplace monitoring snapshots without admin authorization. | Open |
| SEC-04 | High | Permission model | Role matrix exists but is not enforced broadly across platform controllers. | Open |
| SEC-05 | High | API hardening | No global guard, throttling, or rate limiting; CORS is wide open. | Open |
| SEC-06 | High | Campaign ops | Assignment, status, placement, metrics, report, and bulk admin endpoints are workspace-scoped but not role-scoped. | Open |
| SEC-07 | Medium | Auth headers | Trusted proxy auth headers are accepted outside production and can be enabled in production by env flags. | Open |
| SEC-08 | Medium | Data exposure | Legacy search and demo admin overview expose operational-looking data unauthenticated. | Open |
| SEC-09 | Low | Positive control | Digital Access admin routes validate admin privileges and can be used as the model for platform RBAC. | Observed |

## Findings

### SEC-01 - Public Admin and Marketplace Control Routes

Severity: Critical

Proof:

- `OrganizationsController` and `TeamsController` return data without request context at `apps/api/src/modules/platform.controllers.ts:75-92`.
- Legacy `AdminController` exposes overview, SMM health, and AI suggestions without request context at `apps/api/src/modules/platform.controllers.ts:662-679`.
- `AdminGrowthController` exposes all services and service mutation without request context at `apps/api/src/modules/platform.controllers.ts:691-699`.
- Growth supplier audit and risk report are also public at `apps/api/src/modules/platform.controllers.ts:724-731`.
- SMM supplier services, supplier balance, and health are public at `apps/api/src/modules/platform.controllers.ts:419-431`.
- OTP orders, order details, cancel, refund, wallet, provider controls, and pricing rules are public at `apps/api/src/modules/otp/otp.controller.ts:25-61` and `apps/api/src/modules/otp/otp.controller.ts:65-87`.
- `AppModule` registers these controllers without a global auth guard at `apps/api/src/modules/app.module.ts:39-76`.

Reproduction steps:

1. Send `GET /v1/admin/overview` with no `Authorization` header.
2. Send `GET /v1/organizations` and `GET /v1/teams` with no `Authorization` header.
3. Send `PATCH /v1/admin/growth/services/tiktok-views` with no `Authorization` header and body `{"enabled":false,"marginBps":0}`.
4. Send `GET /v1/otp/orders` or `POST /v1/otp/orders/{id}/refund` with no `Authorization` header.

Estimated impact:

Unauthenticated users can view operational data, alter Growth service availability/pricing controls, inspect supplier state, and manipulate OTP wallet/order state. If live suppliers are enabled, this can cause direct financial loss and service disruption.

Recommended fixes:

- Add a global authentication guard for all non-public routes.
- Mark explicit public routes with a decorator, for example `@Public()`, limited to health, public catalog pages, register, and login.
- Add a role/permission guard using `rolePermissions` from `@fliptrybe/auth`.
- Require `admin:access` for all `admin/*` routes.
- Require `payment:manage` for financial endpoints and `campaign:manage` or `campaign:approve` for campaign operations as appropriate.
- Move OTP from process-global unauthenticated state into workspace-scoped, authenticated, persistent storage.

### SEC-02 - Missing RBAC on Privileged Authenticated Endpoints

Severity: Critical

Proof:

- The RBAC matrix exists in `packages/auth/src/index.ts:3-35`.
- `ManagedAdsService` has `assertCampaignPermission` at `apps/api/src/modules/managed-ads.service.ts:1902-1917`.
- That checker is used for some client campaign controls at `apps/api/src/modules/managed-ads.service.ts:731`, `748`, `765`, `788`, `805`, and `813`.
- It is not called before admin overview/list/report/activity functions at `apps/api/src/modules/managed-ads.service.ts:1444-1597`.
- It is not called before assignment, placement, metrics, report, publish, or bulk admin mutations at `apps/api/src/modules/managed-ads.service.ts:1600-1866`.
- Campaign invoice and budget hold endpoints call finance-like service methods from `apps/api/src/modules/platform.controllers.ts:328-373`, but those methods only require workspace context at `apps/api/src/modules/managed-ads.service.ts:1139-1441`.

Reproduction steps:

1. Create or log in as a low-privilege workspace member, for example VIEWER.
2. Call `PATCH /v1/admin/campaign-ops/campaigns/{campaignId}/assignment` with `{"assigneeUserId":"attacker-user-id"}`.
3. Call `PATCH /v1/admin/campaign-ops/campaigns/{campaignId}/status` with `{"status":"APPROVED"}`.
4. Call `POST /v1/campaigns/{campaignId}/invoices` or `POST /v1/campaigns/{campaignId}/budget-holds`.

Estimated impact:

Any member of a workspace can behave like an operator, finance user, or admin. This enables unauthorized campaign launches, assignment hijacking, report publication, invoice creation, budget holds, and ledger changes.

Recommended fixes:

- Enforce permission checks in the service methods, not only the UI.
- Suggested mapping:
  - `admin/*`: `admin:access`
  - campaign status/assignment/placement/report publish: `campaign:manage` plus `admin:access` for internal admin views
  - approval transitions: `campaign:approve`
  - invoices, payment verification, budget holds, hold capture/release: `payment:manage`
  - audit logs: `audit:read`
  - support ticket management: `support:manage`
- Add table-driven tests for OWNER, ADMIN, MANAGER, MARKETER, FINANCE, SUPPORT, and VIEWER against every privileged route.

### SEC-03 - Realtime Socket Emits Admin Data Without Admin Authorization

Severity: Critical

Proof:

- `RealtimeGateway.handleConnection` accepts optional auth at `apps/api/src/modules/realtime.gateway.ts:38-40`.
- It emits `admin-monitoring` unconditionally at `apps/api/src/modules/realtime.gateway.ts:45`.
- It emits OTP order snapshots and OTP admin monitoring at `apps/api/src/modules/realtime.gateway.ts:46-52`.
- It emits Digital Access requests and admin monitoring snapshots for any authenticated workspace context at `apps/api/src/modules/realtime.gateway.ts:70-77`; unauthenticated clients receive empty Digital Access data from `apps/api/src/modules/digital-access/digital-access.service.ts:975-982`.

Reproduction steps:

1. Open a socket connection to the `realtime` namespace without a token.
2. Observe `admin-monitoring`, `otp-orders`, and `otp-admin-monitoring` events.
3. Repeat with a VIEWER token and observe that admin-style workspace data, including Digital Access monitoring counts, is still emitted without an admin permission check.

Estimated impact:

Unauthenticated clients can observe legacy admin and OTP operational state. Authenticated non-admin workspace members can also receive admin-style workspace monitoring data. This can leak volumes, queue health, OTP order metadata, provider health, and admin metrics.

Recommended fixes:

- Authenticate socket connections before joining privileged streams.
- Split client-safe streams from admin streams.
- Require `admin:access` for admin monitoring, `audit:read` for audit-like streams, and module-specific permissions for OTP/Digital Access admin streams.
- Emit empty client-safe payloads only after explicit authorization failure.

### SEC-04 - Role Enforcement Is Incomplete

Severity: High

Expected role behavior:

| Role | Expected allowed actions | Observed risk |
| --- | --- | --- |
| OWNER | Full organization and admin control | Allowed by matrix, but route guards are absent. |
| ADMIN | Full admin except ownership transfer/destructive owner-only actions | Allowed by matrix, but no reliable route enforcement. |
| MANAGER | Campaign management and support workflows | Can reach finance/admin paths that should be restricted. |
| MARKETER | Campaign creation/management and analytics | Can reach admin campaign-ops and finance-like endpoints if authenticated. |
| FINANCE | Payment, wallet, invoice, audit | Can reach non-finance admin/campaign ops routes. |
| SUPPORT | Support and analytics | Can reach campaign/admin/finance endpoints. |
| VIEWER | Read-only analytics | Can reach privileged authenticated endpoints and public admin endpoints. |

Proof:

- Role permissions are defined at `packages/auth/src/index.ts:3-35`.
- Main controllers do not use decorators/guards to require these permissions at `apps/api/src/modules/platform.controllers.ts`.
- `main.ts` configures a `ValidationPipe`, but no auth guard or rate limiter at `apps/api/src/main.ts:14-18`.

Reproduction steps:

1. Use a VIEWER membership token for a workspace.
2. Call `GET /v1/admin/campaign-ops/activity`.
3. Call `POST /v1/admin/campaign-ops/bulk`.
4. Call `POST /v1/campaigns/{campaignId}/budget-holds`.

Estimated impact:

Least privilege is not enforceable. Internal workflows can be performed by customer-facing or read-only users.

Recommended fixes:

- Introduce route metadata such as `@RequirePermission("payment:manage")`.
- Apply a global guard that checks the authenticated membership against route metadata.
- Add explicit owner-only checks for organization/team mutations once those routes are implemented.

### SEC-05 - API Hardening Gaps

Severity: High

Proof:

- `NestFactory.create(AppModule, { cors: true })` allows broad CORS at `apps/api/src/main.ts:10`.
- There is no throttler/rate-limit dependency or guard in `apps/api/package.json`.
- Search is public at `apps/api/src/modules/platform.controllers.ts:652-659`.
- The only global pipeline is validation at `apps/api/src/main.ts:14-18`; most DTOs are TypeScript interfaces without class-validator decorators, for example `apps/api/src/modules/platform.dtos.ts:1-54`.

Reproduction steps:

1. Script repeated unauthenticated calls to public endpoints such as `/v1/admin/overview`, `/v1/otp/orders`, and `/v1/search`.
2. Script repeated authenticated calls to create payment intents, growth orders, or support tickets.
3. Observe no code-level throttling, account velocity enforcement, or IP/device limits in the platform controllers.

Estimated impact:

Brute force, endpoint scraping, order spam, OTP abuse, and marketplace queue flooding are practical. Broad CORS increases browser-based abuse options.

Recommended fixes:

- Add Nest throttling or an edge/API gateway rate limiter.
- Scope CORS to the configured web/admin origins.
- Convert public DTO interfaces to decorated classes or use zod validation per route.
- Add account, workspace, IP, and device velocity controls to money and marketplace endpoints.

### SEC-06 - Campaign Ownership and Assignment Abuse

Severity: High

Proof:

- Customer-facing campaign reads are workspace-scoped at `apps/api/src/modules/managed-ads.service.ts:571-586`.
- Campaign lookup uses `workspaceId` at `apps/api/src/modules/managed-ads.service.ts:2772-2779`, which reduces cross-workspace access risk.
- Admin assignment accepts arbitrary assignee input and only requires workspace context at `apps/api/src/modules/managed-ads.service.ts:1600-1621`.
- Admin status updates only require workspace context and guardrails, not role permission, at `apps/api/src/modules/managed-ads.service.ts:1595-1597` and `apps/api/src/modules/managed-ads.service.ts:2547-2609`.

Reproduction steps:

1. Authenticate as a non-admin member of a workspace.
2. Assign yourself to another user's campaign with `PATCH /v1/admin/campaign-ops/campaigns/{campaignId}/assignment`.
3. Change status to `APPROVED`, add a placement URL, add metrics, or publish a report.

Estimated impact:

Dishonest operators or compromised low-privilege accounts can hijack work, fabricate campaign state, publish false reports, and obscure accountability.

Recommended fixes:

- Require `admin:access` or `campaign:manage` for internal ops routes.
- Validate assignees are active members with an allowed operator role.
- Add immutable audit events for assignment changes, status changes, placement updates, metric imports, and report publication.

### SEC-07 - Proxy Header Trust Can Be Dangerous

Severity: Medium

Proof:

- Header auth is recognized by `hasAuthenticationContextHeaders` at `apps/api/src/modules/request-context.ts:96-103`.
- Non-production trusts proxy headers by default, and production can trust them with env flags at `apps/api/src/modules/request-context.ts:178-183`.
- Header-derived user/workspace context is assembled at `apps/api/src/modules/request-context.ts:186-216`.

Reproduction steps:

1. In a non-production environment, call protected routes using `x-user-id` and `x-workspace-id`.
2. In production, set `TRUST_PROXY_AUTH_HEADERS=true` without enforcing an upstream-authenticated proxy boundary.
3. Send forged proxy auth headers.

Estimated impact:

Misconfigured staging or production environments can allow identity spoofing.

Recommended fixes:

- Disable trusted headers by default in every environment.
- Only trust headers from a verified internal proxy.
- Strip user-supplied auth headers at the edge.
- Add deployment checks that fail when `TRUST_PROXY_AUTH_HEADERS=true` without a documented proxy allowlist.

## Positive Findings

- JWT signature, algorithm, expiry, and not-before checks exist at `apps/api/src/modules/request-context.ts:116-154`.
- `AuthSessionService` validates active workspace membership at `apps/api/src/modules/auth-session.service.ts:511-548`.
- Digital Access admin routes resolve admin scope and reject non-admin members at `apps/api/src/modules/digital-access/digital-access.service.ts:1259-1295`.
- Campaign reads and writes are generally scoped by `workspaceId`, for example `apps/api/src/modules/managed-ads.service.ts:571-586` and `apps/api/src/modules/managed-ads.service.ts:2772-2779`.

## Required Remediation Before Launch

1. Add global authentication and permission guards.
2. Convert all admin, finance, OTP, SMM supplier, and Growth admin endpoints from public routes to authenticated/authorized routes.
3. Lock down realtime admin streams.
4. Add rate limiting and DTO validation.
5. Add role-based route tests covering OWNER, ADMIN, MANAGER, MARKETER, FINANCE, SUPPORT, and VIEWER.
