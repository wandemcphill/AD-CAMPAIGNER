# Final Launch Review

Date: 2026-06-04

## Recommendation

No-Go today.

Launch approval is achievable, but not on the current evidence set. The deployed `-g25g` web, admin, and API shells are reachable and the read-only smoke suite passed, but Critical blockers remain: Growth routes return 404 in production, public admin overview is reachable without auth, readiness/evidence automation is empty, and Korapay live money movement is not proven end to end.

## Score

Old score: 34/100

New score: 51/100

| Category | Weight | R4 score | Reason |
| --- | ---: | ---: | --- |
| Deployment and routing | 25 | 18 | API/web/admin `-g25g` hosts passed read-only smoke. `ADMIN_URL` drift was patched in `render.yaml`. Growth production API routes still return 404. |
| Security and permissions | 20 | 7 | Many protected managed-ads routes reject unauthenticated requests, but live `/v1/admin/overview` returns 200 without auth and broader admin RBAC evidence is incomplete. |
| Financial integrity and Korapay | 20 | 10 | Korapay provider is configured, wallet locks/idempotency/signature code exists, and focused tests pass. No live creation, completion, webhook, replay, or wallet-credit proof exists. |
| Media and Cloudinary | 10 | 7 | Cloudinary provider is configured and focused signature tests pass. No live upload, signing, or retrieval evidence exists. |
| Operations evidence and owners | 15 | 3 | The tracker now accounts for all 36 readiness requirements and 110 evidence items, but automation still reports 36/36 readiness tasks missing and 0/110 evidence items complete. |
| Backup, monitoring, rollback | 10 | 3 | Runbooks and backup script exist. No backup execution, restore drill, alert dashboard, RTO, or final owner signoff was captured. |

## What Changed In R4

- Created `docs/LAUNCH_READINESS_TRACKER_R4.md` to account for all 36 readiness requirements and all 110 OPS evidence items.
- Created `docs/LAUNCH_EVIDENCE_PACKAGE_R4.md` with live endpoint proof, payment/media/backup evidence status, reproduction steps, recommended fixes, and risk register.
- Corrected `render.yaml` so API `ADMIN_URL` points to `https://fliptrybe-ads-campaigner-admin-g25g.onrender.com`.
- Updated the API test fixture so the payment idempotency test runs through an authorized `payment:manage` membership.
- Verified deployed read-only smoke: 36 passed, 0 failed, 2 skipped.
- Verified focused API integrity tests: 8 test files passed, 42 tests passed.

## Remaining Blockers

| Severity | Blocker | Proof | Required closure |
| --- | --- | --- | --- |
| Critical | Growth production routes are not deployed or not routed | `GET https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/catalog` returned 404 | Redeploy/reroute API so Growth catalog/services/orders work, then add deployed smoke coverage |
| Critical | Public admin overview exposure | `GET https://ft-campaigner-api-fra-g25g.onrender.com/v1/admin/overview` returned 200 without auth | Require authenticated admin RBAC and verify unauthenticated 401/403 |
| Critical | OPS readiness and evidence are not complete | `ops:readiness` reports 36/36 missing; `ops:evidence` reports 0/110 complete | Populate owner/channel/phase/evidence env vars and produce passing automation output |
| Critical | Korapay payment lifecycle is not live-proven | No production payment creation, completion, webhook, replay, or wallet ledger proof was available | Run controlled live/sandbox payment and capture OPS-061 through OPS-064 evidence |
| High | Cloudinary upload lifecycle is not live-proven | No production upload/signing/retrieval proof was available | Run authenticated image/video upload, valid completion, retrieval, and invalid signature rejection |
| High | Backup and restore are not launch-proven | Runbook/script exist, but no backup execution or restore timing was captured | Execute backup and restore drill against a non-live recovery DB and record timing |
| High | Render drift fix is repo-side only until redeployed | Old admin host returned 404; `render.yaml` now points to `-g25g` | Redeploy API and capture Render env/deploy evidence |

## Go Criteria

Launch can move to Go only after all of the following are true:

1. Critical blockers count is 0.
2. `corepack pnpm ops:readiness` passes with 36/36 requirements present.
3. `corepack pnpm ops:evidence` shows every OPS item either `evidence-captured`, `local-complete`, or signed `go`; no `missing`, `external-blocked`, or unresolved `no-go` items.
4. Growth production routes return expected 200 or authenticated 401/403 behavior.
5. Korapay payment creation, completion, webhook processing, wallet credit, and replay idempotency evidence is captured.
6. Cloudinary upload, signing, retrieval, and invalid-signature rejection evidence is captured.
7. Backup execution and restore timing are captured.
8. Deployed smoke passes again after the API redeploy and admin URL correction.

Final recommendation: No-Go until the Critical blockers above are closed. A Go recommendation is achievable after redeploying the corrected routes/security controls and collecting the missing provider, backup, and OPS evidence.

