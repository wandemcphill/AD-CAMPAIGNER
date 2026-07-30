# Thread F E2E Validation Report

Validation date: 2026-06-04

## Summary

Real user journey validation was partially completed.

The Growth customer journey passed through the API using development workspace headers: catalog browse, order creation, order tracking, admin completion, completed-order tracking, and marketplace management all returned 200/201 responses.

The Advertiser, Operator, and Admin managed-ads journeys could not be completed end to end because local Postgres was not reachable on `localhost:5432`. The API health endpoint was up with mock providers, but auth registration and DB-backed campaign endpoints returned 500. UI screenshots were still captured for the required customer/operator/admin surfaces.

## Environment

| Surface | URL | Result |
| --- | --- | --- |
| API | `http://localhost:4000/v1` | Healthy, mock providers |
| Web app | `http://localhost:3100` | Screenshots captured |
| Admin app | `http://localhost:3101` | Screenshots captured |
| Postgres | `localhost:5432` | Not reachable |

API health evidence: `docs/e2e-evidence/00-health.json`

DB readiness evidence: `docs/e2e-evidence/db-readiness-probes.json`

Screenshot manifest: `docs/e2e-evidence/screenshot-manifest.json`

## Test Accounts

| Persona | Account | Result |
| --- | --- | --- |
| Advertiser | `thread-f-advertiser-20260604154824@example.test` | Registration returned 500 |
| Admin / Operator | `thread-f-admin-20260604154824@example.test` | Registration returned 500 |
| Growth customer | `thread-f-growth-20260604154824@example.test` | Registration returned 500 |
| Growth customer, dev header session | `thread-f-growth-20260604164650@example.test` | API journey passed |

## API Evidence

| Step | URL | Status | Evidence |
| --- | --- | ---: | --- |
| API health | `GET /v1/health` | 200 | `docs/e2e-evidence/00-health.json` |
| Advertiser registration | `POST /v1/auth/register` | 500 | `docs/e2e-evidence/01-advertiser-register.json` |
| Admin registration | `POST /v1/auth/register` | 500 | `docs/e2e-evidence/11-admin-register.json` |
| Growth registration | `POST /v1/auth/register` | 500 | `docs/e2e-evidence/35-growth-register.json` |
| Growth catalog | `GET /v1/growth/catalog` | 200 | `docs/e2e-evidence/45-growth-dev-browse-catalog.json` |
| Growth order create | `POST /v1/growth/orders` | 201 | `docs/e2e-evidence/46-growth-dev-create-order.json` |
| Growth order track | `GET /v1/growth/orders/growth_kq8uwja86a` | 200 | `docs/e2e-evidence/47-growth-dev-track-order.json` |
| Growth order complete | `PATCH /v1/admin/growth/orders/growth_kq8uwja86a` | 200 | `docs/e2e-evidence/48-growth-dev-admin-complete-order.json` |
| Growth completed tracking | `GET /v1/growth/orders/growth_kq8uwja86a` | 200 | `docs/e2e-evidence/49-growth-dev-track-completed-order.json` |
| Admin marketplace management | `GET /v1/admin/growth/services` | 200 | `docs/e2e-evidence/50-growth-dev-admin-marketplace-management.json` |

## Screenshots

| Persona | Route | Screenshot |
| --- | --- | --- |
| Advertiser | `http://localhost:3100/onboarding` | `docs/e2e-evidence/screenshot-advertiser-onboarding.png` |
| Advertiser | `http://localhost:3100/campaigns` | `docs/e2e-evidence/screenshot-advertiser-campaigns.png` |
| Advertiser | `http://localhost:3100/campaigns/new` | `docs/e2e-evidence/screenshot-advertiser-campaign-new.png` |
| Advertiser | `http://localhost:3100/billing` | `docs/e2e-evidence/screenshot-advertiser-billing.png` |
| Advertiser | `http://localhost:3100/reports` | `docs/e2e-evidence/screenshot-advertiser-reports.png` |
| Advertiser | `http://localhost:3100/campaigns/thread-f-placeholder/financial-history` | `docs/e2e-evidence/screenshot-advertiser-financial-history.png` |
| Operator | `http://localhost:3101/campaign-ops` | `docs/e2e-evidence/screenshot-operator-dashboard.png` |
| Operator | `http://localhost:3101/campaign-ops/queue` | `docs/e2e-evidence/screenshot-operator-queue.png` |
| Operator | `http://localhost:3101/campaign-ops/detail?campaignId=campaign_123` | `docs/e2e-evidence/screenshot-operator-placement-reporting-detail.png` |
| Operator | `http://localhost:3101/campaign-ops/reports` | `docs/e2e-evidence/screenshot-operator-reports.png` |
| Operator | `http://localhost:3101/campaign-ops/activity` | `docs/e2e-evidence/screenshot-operator-activity.png` |
| Growth | `http://localhost:3100/growth-services` | `docs/e2e-evidence/screenshot-growth-catalog.png` |
| Growth | `http://localhost:3100/growth-services/orders` | `docs/e2e-evidence/screenshot-growth-orders.png` |
| Admin | `http://localhost:3101/growth-services` | `docs/e2e-evidence/screenshot-admin-growth-marketplace.png` |
| Admin | `http://localhost:3101/growth-services/orders` | `docs/e2e-evidence/screenshot-admin-growth-orders.png` |
| Admin | `http://localhost:3101/` | `docs/e2e-evidence/screenshot-admin-overview-financial-review.png` |

## Journey Results

### Advertiser Account

Requested flow: registration, onboarding, wallet funding, campaign creation, campaign submission, invoice payment, pause campaign, resume campaign, financial history, reports.

Result: blocked at registration because `POST /v1/auth/register` returned 500. UI evidence was captured for onboarding, campaigns, campaign creation, billing, reports, and financial history. The wallet/campaign/invoice/pause/resume API calls could not be executed because no authenticated account or campaign could be created.

### Operator Account

Requested flow: campaign review, assignment, placement creation, spend logging, report creation, report publication, campaign completion.

Result: blocked by the same auth/database issue. Operator UI evidence was captured for dashboard, queue, detail, report queue, and activity routes. API placement/report/guardrail execution requires a DB-backed managed campaign, so it was not completed.

### Growth Customer

Requested flow: browse catalog, create order, track order, complete order.

Result: passed through API with development workspace headers. Order `growth_kq8uwja86a` was created, tracked, completed by admin endpoint, then tracked as completed. Growth catalog and order-tracking screenshots were captured.

### Admin Account

Requested flow: campaign oversight, financial review, operator assignment, marketplace management.

Result: marketplace management passed via API. Campaign oversight/operator assignment/financial review could not be completed against live managed-ads data because auth and DB-backed campaign endpoints failed. Admin UI screenshots were captured for campaign ops, growth marketplace, growth orders, and admin overview.

## Observed Issues

| Severity | Issue | Evidence | Impact |
| --- | --- | --- | --- |
| High | Local Postgres is not reachable on `localhost:5432`; Prisma migrate status fails with a schema engine error. | `docs/e2e-evidence/db-readiness-probes.json` | Blocks registration, authenticated advertiser journeys, campaign creation, invoices, wallet payment, operator campaign actions, and managed-ads guardrail validation. |
| High | `POST /v1/auth/register` returns 500 for all test accounts. | `docs/e2e-evidence/01-advertiser-register.json`, `docs/e2e-evidence/11-admin-register.json`, `docs/e2e-evidence/35-growth-register.json` | Prevents real customer/operator/admin account simulation. |
| High | Financial history dynamic route returns a Next runtime error under `output: export`. | `docs/e2e-evidence/screenshot-advertiser-financial-history.png` | Blocks customer access to campaign financial history pages by campaign ID. |
| Medium | UI app first-load compilation is very slow on multiple routes. | Screenshot capture timings and dev-server output | Slows validation and may hide runtime failures behind timeouts. |
| Medium | Admin/operator pages show unauthenticated workspace warnings when no session is connected. | `docs/e2e-evidence/screenshot-operator-dashboard.png` | Expected without auth, but confirms account setup must work before operational workflows can be validated. |

## Guardrail Validation Status

| Guardrail | Status | Notes |
| --- | --- | --- |
| Prevent reporting before launch | Not executed in live API | Requires campaign creation and managed-ads DB writes. |
| Prevent completion without report | Not executed in live API | Requires a campaign, report draft, and status transition. |
| Prevent spend exceeding allocation | Not executed in live API | Requires campaign allocation state and spend logging. |
| Growth order completion | Passed | Admin growth order completion returned 200. |

## Next Validation Pass

1. Start or provision Postgres at `postgresql://fliptrybe:fliptrybe@localhost:5432/fliptrybe_ads`.
2. Run database migrations from `packages/database/prisma/migrations`.
3. Restart the API with `DATABASE_URL`, `JWT_SECRET`, mock providers, and queues disabled for local validation.
4. Rerun advertiser and operator API journeys from registration through campaign completion.
5. Fix the financial-history dynamic route for dev/static-export compatibility, then recapture that route.
