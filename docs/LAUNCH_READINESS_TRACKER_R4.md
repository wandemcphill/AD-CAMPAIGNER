# Launch Readiness Tracker R4

Date: 2026-06-04

This tracker accounts for the 36 operational readiness requirements and the 110 OPS evidence items required for launch closure. It does not mark external evidence complete unless the evidence was actually captured in this pass.

## Current Status

| Area | Required | Verified complete | Partial | Missing or blocked | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| Operational readiness placeholders | 36 | 0 | 4 | 36 in current shell | Missing |
| OPS evidence items | 110 | 0 | 36 smoke checks plus local tests | 110 in automation | Missing |
| Deployed read-only smoke checks | 38 | 36 | 0 | 2 skipped | Partial |
| Growth production routes | 3 | 0 | 0 | 3 | Critical blocker |
| Korapay live payment flow | 4 | 0 | 2 code/config controls | 4 live evidence items | Critical blocker |
| Cloudinary live media flow | 3 | 0 | 2 code/config controls | 3 live evidence items | High blocker |
| Backup and restore | 3 | 0 | 1 documented process | 3 execution evidence items | High blocker |

Automation proof:

- `corepack pnpm ops:readiness` returned `Missing operational readiness tasks (36/36)`.
- `corepack pnpm ops:evidence` returned `0/110 complete`.
- `corepack pnpm smoke:deployed` returned `36 passed, 0 failed, 2 skipped` against the working `-g25g` hosts.
- `corepack pnpm --filter @fliptrybe/api test -- managed-ads.service.spec.ts platform.service.test.ts` returned `8 passed`, `42 passed`.

## 36 Readiness Requirement Matrix

| Requirement group | Count | Owner | Evidence requirement | R4 evidence | Status |
| --- | ---: | --- | --- | --- | --- |
| Owner slots: `OPS_DEPLOY_OWNER`, `OPS_API_OWNER`, `OPS_WORKER_OWNER`, `OPS_PAYMENTS_OWNER`, `OPS_MEDIA_OWNER`, `OPS_CAMPAIGN_OWNER`, `OPS_REPORT_QA_OWNER`, `OPS_SUPPORT_OWNER`, `OPS_CUSTOMER_COMMS_OWNER`, `OPS_INCIDENT_COMMANDER`, `OPS_ROLLBACK_OWNER` | 11 | Deploy owner | Named humans with backups and escalation handles | Automation reports all 11 unset in current shell | Missing |
| Launch, incident, support, alert channels | 4 | Deploy owner, Support owner | `OPS_LAUNCH_CHANNEL`, `OPS_INCIDENT_CHANNEL`, `OPS_SUPPORT_CHANNEL`, and one of `OPS_ALERT_EMAIL` or `OPS_ALERT_WEBHOOK` | Automation reports all channel and alert values unset | Missing |
| Support, rollback, and contact metadata | 7 | Support owner, Rollback owner | Owner roster, launch notes, incident runbook, rollback plan, support contact, escalation contact, config freeze window | Automation reports all 7 unset | Missing |
| Target URLs | 4 | Deploy owner | `APP_URL`, `ADMIN_URL`, `API_URL`, `NEXT_PUBLIC_API_URL` | `render.yaml` has production values. `ADMIN_URL` was corrected to the reachable `-g25g` host in this pass. Current shell still lacks the variables, so automation fails. | Partial |
| Phase evidence placeholders | 10 | Deploy owner | `OPS_PHASE_0_EVIDENCE` through `OPS_PHASE_9_EVIDENCE` | Automation reports all 10 unset | Missing |

## 110 Evidence Item Matrix

| OPS range | Phase | Count | Primary owners | Evidence requirement | R4 evidence | Status |
| --- | --- | ---: | --- | --- | --- | --- |
| OPS-001 - OPS-010 | Access and ownership | 10 | Deploy, API, Payments, Media, Support, Campaign ops, Rollback | Owner roster, admin login proof, permission mapping, provider dashboard access, rollback access | No owner roster or access confirmations captured | Missing |
| OPS-011 - OPS-025 | Production environment | 15 | Deploy, API, Worker, Payments, Media | Rollout preflight, env review, DB/Redis target proof, backup/export reference, migration dry run, commit SHA | Deployed smoke passed on `-g25g` API/web/admin. `render.yaml` has production provider env contract. No Render dashboard, DB/Redis, backup, migration, or commit proof captured. | Partial |
| OPS-026 - OPS-040 | Admin operations setup | 15 | Campaign ops, API, Payments | Operator roster, assignment rules, admin queue/assignment/status/audit evidence, mobile screenshots | Admin app shell routes passed. Authenticated admin workflow evidence was skipped because no production token was supplied. | Partial |
| OPS-041 - OPS-050 | Client flow setup | 10 | API, Support, Payments | Production signup/login, business profile, campaign intake, billing, reports, mobile proof | Web app shell routes passed. Authenticated production customer journey was not run. | Partial |
| OPS-051 - OPS-060 | Manual launch accounts | 10 | Campaign ops, Payments, Media | Meta/TikTok/page access, naming/UTM/spend cap/proof policies, manual placement checks | No external Ads Manager evidence captured | External-blocked |
| OPS-061 - OPS-070 | Payments and reconciliation | 10 | Payments | Korapay creation, completion, webhook credit, replay idempotency, invoice linkage, holds, release, capture, refund playbook | API health reports Korapay provider, and local API tests passed. No live payment, webhook, replay, invoice, or wallet-credit evidence captured. | Critical blocker |
| OPS-071 - OPS-080 | Media and report evidence | 10 | Media, Campaign ops, API, Support | Cloudinary image/video uploads, invalid upload rejection, signature rejection, proof visibility, report publish | API health reports Cloudinary storage, and local signature tests passed. No live upload/retrieval evidence captured. | High blocker |
| OPS-081 - OPS-090 | Notifications and support | 10 | Support | Notification lists, support channel, canned responses, incident responses, WhatsApp disabled unless configured | Web notifications shell route passed. No authenticated support or notification evidence captured. | Missing |
| OPS-091 - OPS-100 | Monitoring and alerts | 10 | API, Worker, Deploy, Payments, Media, Support | Render/API/worker/Postgres/Redis/payment/upload/deploy alerts, incident contact path | No dashboard alert evidence captured | External-blocked |
| OPS-101 - OPS-110 | Go/no-go and rollback | 10 | Deploy, Rollback, Payments, Support, Campaign ops | Complete smoke campaign, UI audit, rollback target/order, reconciliation plan, owner signoff, config freeze | No complete production smoke campaign or owner signoff captured | Critical blocker |

## Launch Closure Checklist

| Item | Owner | Required proof | R4 status | Next action |
| --- | --- | --- | --- | --- |
| Deploy corrected `ADMIN_URL` | Deploy owner | Render env/deploy event showing `https://fliptrybe-ads-campaigner-admin-g25g.onrender.com` | Repo fixed, external deploy proof missing | Redeploy API and capture Render env/deploy screenshot or event |
| Restore Growth API routes in production | API owner | `GET /v1/growth/catalog` and `GET /v1/growth/services` return 200, `GET /v1/growth/orders` rejects auth or returns workspace data with auth | Live 404 | Confirm deployed API commit includes `GrowthController`; redeploy if mismatch |
| Lock public admin overview | API owner | `GET /v1/admin/overview` returns 401/403 unauthenticated | Live 200 | Add auth/RBAC guard and redeploy |
| Complete Korapay flow | Payments owner | Payment reference, completion status, webhook event ID, wallet ledger credit ID, replay idempotency result | Not captured | Run low-value live or approved sandbox payment in controlled launch window |
| Complete Cloudinary flow | Media owner | Upload intent ID, Cloudinary public ID, signed completion result, retrieval URL, invalid signature rejection | Not captured | Run image/video upload through production web with authenticated account |
| Execute backup and restore drill | Deploy owner | Backup/export ID, restore database ID, validation notes, measured recovery time | Not captured | Run Render PITR/logical export drill against non-live restore target |
| Populate 36 readiness values | Deploy owner | Passing `corepack pnpm ops:readiness` output | 36/36 missing in shell | Set owner/channel/URL/phase evidence env values in launch shell or CI |
| Populate 110 OPS evidence statuses | Deploy owner and phase owners | Passing `corepack pnpm ops:evidence` with every item complete, go, or explicitly no-go with signoff | 0/110 complete | Fill `OPS_001_EVIDENCE` through `OPS_110_EVIDENCE` and matching status vars |

