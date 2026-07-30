# Launch Evidence Package R4

Date: 2026-06-04

This package records the evidence captured during the R4 launch-readiness closure pass. It separates verified evidence from evidence that still requires production credentials, dashboard access, or controlled write tests.

## Evidence Captured

| Evidence | Command or source | Result |
| --- | --- | --- |
| Source launch reports reviewed | `LAUNCH_READINESS_REPORT.md`, `DEPLOYMENT_HARDENING_REPORT.md`, `docs/E2E_VALIDATION_REPORT.md` | Prior readiness score was 34/100 and No-Go. Deployment hardening had repo-side improvements, but live evidence was still missing. |
| Readiness automation | `corepack pnpm ops:readiness` | Failed with `Missing operational readiness tasks (36/36)`. |
| OPS evidence automation | `corepack pnpm ops:evidence` | Reported `0/110 complete`; every OPS item remains missing in automation. |
| Deployed read-only smoke | `corepack pnpm smoke:deployed` with `API_URL=https://ft-campaigner-api-fra-g25g.onrender.com`, `APP_URL=https://fliptrybe-ads-campaigner-web-g25g.onrender.com`, `ADMIN_URL=https://fliptrybe-ads-campaigner-admin-g25g.onrender.com` | Passed 36 checks, failed 0, skipped 2 authenticated/write checks. |
| API payment/media integrity tests | `corepack pnpm --filter @fliptrybe/api test -- managed-ads.service.spec.ts platform.service.test.ts` | Passed 8 test files and 42 tests after aligning the test fixture with the enforced `payment:manage` permission. |
| Deployment URL drift fix | `render.yaml` | API `ADMIN_URL` now points at `https://fliptrybe-ads-campaigner-admin-g25g.onrender.com`. |

## Live URL Verification

| Target | URL | Result | Impact |
| --- | --- | --- | --- |
| API health | `https://ft-campaigner-api-fra-g25g.onrender.com/v1/health` | 200. Health JSON reports `payments: korapay`, `storage: cloudinary-storage`, SMM suppliers, and mock ads/AI providers. | API is reachable, but ads/AI remain mock and health is shallow. |
| Base API health | `https://ft-campaigner-api-fra.onrender.com/v1/health` | 404 | Confirms the non-`g25g` API host is not the active host. |
| Web app | `https://fliptrybe-ads-campaigner-web-g25g.onrender.com/` | 200 HTML | Customer shell is reachable. |
| Admin app from old config | `https://fliptrybe-ads-campaigner-admin.onrender.com/` | 404 | Drift confirmed before the R4 config patch. |
| Admin app `-g25g` | `https://fliptrybe-ads-campaigner-admin-g25g.onrender.com/` | 200 HTML | Admin shell is reachable on the `-g25g` host. |
| Growth catalog | `https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/catalog` | 404 | Critical production route mismatch remains. |
| Growth services | `https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/services` | 404 | Critical production route mismatch remains. |
| Growth orders unauthenticated | `https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/orders` | 404 | Critical production route mismatch remains. |
| Admin overview unauthenticated | `https://ft-campaigner-api-fra-g25g.onrender.com/v1/admin/overview` | 200 JSON | Critical public admin exposure remains. |
| SMM services | `https://ft-campaigner-api-fra-g25g.onrender.com/v1/smm/services` | 200 JSON | Public catalog is reachable. |
| Destination catalog | `https://ft-campaigner-api-fra-g25g.onrender.com/v1/destinations/catalog` | 200 JSON | Public catalog is reachable. |

## Growth Production Routes

Proof:

- `GET /v1/growth/catalog` on the production `-g25g` API returned 404.
- `GET /v1/growth/services` on the production `-g25g` API returned 404.
- `GET /v1/growth/orders` on the production `-g25g` API returned 404.
- Local source registers `GrowthController` at `apps/api/src/modules/platform.controllers.ts:503`, so the live behavior indicates deployment mismatch, route mismatch, or an older API build.

Reproduction steps:

```sh
curl -i https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/catalog
curl -i https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/services
curl -i https://ft-campaigner-api-fra-g25g.onrender.com/v1/growth/orders
```

Recommended fix:

1. Confirm the deployed API commit includes `GrowthController`.
2. Confirm the global prefix is still `/v1` and the module registers `GrowthController`.
3. Redeploy API and rerun the three route checks.
4. Add Growth routes to `scripts/deployed-smoke.ts` so this cannot regress silently.

Estimated impact:

- Customers cannot use Growth Services in production.
- Admins cannot rely on live Growth Marketplace evidence.
- Launch cannot satisfy the Growth route validation requirement.

## Korapay Flow

Verified evidence:

- API health reports the payment provider as `korapay`.
- `render.yaml` sets `KORAPAY_WEBHOOK_URL` to `https://ft-campaigner-api-fra-g25g.onrender.com/api/webhooks/korapay`.
- `docs/OPERATIONS.md:267` documents the required webhook URL path.
- `apps/api/src/modules/managed-ads.service.ts:508` verifies webhook signatures.
- `apps/api/src/modules/managed-ads.service.ts:1223` rejects invalid Korapay webhook signatures.
- `apps/api/src/modules/managed-ads.service.ts:2891` uses the `payment:${intent.id}:credit` idempotency key for wallet credit.
- `apps/api/src/modules/managed-ads.service.ts:2995` locks wallets with `SELECT ... FOR UPDATE`.
- Focused API tests passed: 42/42.

Missing live evidence:

- Payment creation reference from production.
- Payment completion status from Korapay.
- Webhook processing event/log proof.
- Wallet credit ledger entry proof.
- Replay proof showing no duplicate credit.

Reproduction steps to close:

1. Use an authenticated production customer or controlled sandbox account.
2. Create a small wallet funding intent through `POST /v1/wallet/funding-intents`.
3. Complete the Korapay payment.
4. Capture Korapay transaction reference, webhook event ID, API log entry, app payment intent ID, and wallet ledger entry ID.
5. Replay or verify the same event in a controlled window and capture unchanged wallet balance plus existing idempotency record.

Recommended fix:

- Do not launch paid workflows until the above live evidence exists.
- Add the Korapay creation, completion, webhook, and replay checks to the production launch notes and OPS-061 through OPS-064 evidence vars.

Estimated impact:

- Without live proof, the launch team cannot prove wallet balances are correct after payment completion.
- Payment replay or webhook failures could cause revenue, wallet, or customer trust incidents if not verified.

## Cloudinary Flow

Verified evidence:

- API health reports `storage: cloudinary-storage`.
- `render.yaml` contains the Cloudinary env contract for API.
- `apps/api/src/modules/managed-ads.service.ts:1050` handles upload completion.
- `apps/api/src/modules/managed-ads.service.ts:3099` uses `CLOUDINARY_API_SECRET` to verify completion signatures.
- Focused API tests passed signature rejection, workspace scoping, and valid signature completion cases.

Missing live evidence:

- Production upload intent ID.
- Cloudinary public ID and signed completion result.
- Retrieval URL from Cloudinary.
- Invalid signature rejection against production.

Reproduction steps to close:

1. Authenticate as a production customer.
2. Create a media upload intent for an image and a video.
3. Upload to Cloudinary using the returned preset/signing details.
4. Complete upload in the API and capture the media asset IDs.
5. Retrieve the assets from Cloudinary/CDN.
6. Submit a bad signature completion request and capture the rejection.

Recommended fix:

- Capture OPS-071 through OPS-075 evidence before launch.
- Keep mock storage disabled in production.

Estimated impact:

- Without live upload proof, customer creative intake and report proof publishing remain unproven.

## Backup And Recovery

Verified evidence:

- `docs/OPERATIONS.md:180` documents Postgres backup and restore expectations.
- `infrastructure/backup/backup.ps1:14` runs `pg_dump`.
- Render backup/PITR process is documented in the operations runbook.

Missing live evidence:

- Backup/export ID.
- Restore database ID.
- Validation notes for core tables, wallets, payment intents, orders, OTP orders, and audit logs.
- Measured recovery time.

Reproduction steps to close:

1. Create a logical export or Render recovery point before launch.
2. Restore to a separate recovery database, never over the live database.
3. Validate core tables and financial state.
4. Record start time, recovery availability time, validation completion time, and signoff.
5. Store the backup/export and recovery references in OPS-023 and OPS-105 through OPS-107.

Recommended fix:

- Run a non-live restore drill before production approval.
- Define an RTO only after the drill. The current recovery timing is not measured.

Estimated impact:

- Without a measured restore path, a bad migration, payment data incident, or destructive operator action has unknown recovery time.

## Risk Register

| Severity | Risk | Proof | Recommended fix | Estimated impact |
| --- | --- | --- | --- | --- |
| Critical | Growth production routes return 404 | Live `GET /v1/growth/catalog`, `/services`, `/orders` returned 404 | Redeploy the API build containing Growth routes and add smoke checks | Growth launch path unavailable |
| Critical | Public admin overview exposes internal metrics | Live `GET /v1/admin/overview` returned 200 without auth | Require auth and admin RBAC for all admin routes | Internal operations, payment volume, fraud signal, and queue health data exposed |
| Critical | Readiness and OPS evidence automation remains empty | `ops:readiness` 36/36 missing, `ops:evidence` 0/110 complete | Populate owners, channels, phase evidence, and item statuses | No auditable launch approval chain |
| Critical | Korapay live payment lifecycle is unverified | Health/config/code present, but no payment creation/completion/webhook/wallet-credit proof | Run controlled live/sandbox transaction and replay check | Money-state correctness is not launch-proven |
| High | Cloudinary live upload lifecycle is unverified | Health/config/code/tests present, but no production upload/retrieval proof | Run authenticated upload and invalid-signature checks | Customer creative intake and proof publishing may fail |
| High | Backup and restore timing is unmeasured | Runbook and `pg_dump` script exist, but no restore drill evidence | Execute restore drill and record timing | Unknown recovery time for data or money incidents |
| High | Admin URL drift required repo patch | Old `ADMIN_URL` host returned 404; `-g25g` host returned 200 | Redeploy API with corrected `render.yaml` and confirm Render env | Admin links/redirects can point to dead host until redeployed |

