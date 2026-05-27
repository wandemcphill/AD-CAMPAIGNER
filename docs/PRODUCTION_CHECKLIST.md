# Production Checklist

Use this checklist with `docs/OPERATIONS.md` before enabling production traffic or beta feature flags.

## Global Preflight

- Render API, web, admin, worker, Postgres, and Key Value services are `Live`.
- API `/v1/health` returns success on the current Render domain.
- API deploy logs show successful Prisma migration.
- Worker logs show `FlipTrybe worker listening`.
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `SESSION_SECRET` are present on API and worker.
- Korapay live keys, webhook secret, redirect URL, and treasury bank details are present only in Render env.
- Cloudinary cloud name and unsigned upload preset are present before upload flows are exposed.
- SMM supplier keys and optional service maps are present on API and worker.
- `TRUST_PROXY_AUTH_HEADERS=false` and `DIGITAL_ACCESS_TRUST_AUTH_HEADERS=false` unless a trusted proxy auth boundary is live.
- A fresh Postgres logical export exists before launch or major flag changes.
- Render alerts cover failed deploys, API health failures, worker restart loops, Postgres capacity, Redis capacity, and payment mismatches.
- Owner names are assigned for deploy, API, worker, payments, database, and customer support.

## Managed Ads MVP

### Preflight

- Run the managed ads rollout check for every deployed surface before launch:

```powershell
corepack pnpm exec tsx scripts/rollout-check.ts --target=api --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=worker --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=web --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=admin --stage=managed-ads-mvp --strict-production
```

- Run the operational owner/channel readiness check before go/no-go:

```powershell
corepack pnpm ops:readiness
```

- Run the deployed smoke against the live Render URLs. Add `AUTH_SMOKE_TOKEN` or
  `AUTH_SMOKE_EMAIL`/`AUTH_SMOKE_PASSWORD` to include authenticated workspace checks,
  and `AUTH_SMOKE_ADMIN=true` to include admin Campaign Ops checks:

```powershell
$env:API_URL="https://api.example.com"; $env:APP_URL="https://app.example.com"; $env:ADMIN_URL="https://admin.example.com"; corepack pnpm smoke:deployed
```

- API uses real persistent dependencies: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `SESSION_SECRET`.
- Media uploads use signed Cloudinary upload intents. `STORAGE_PROVIDER=cloudinary`, Cloudinary cloud name, API key, API secret, and upload preset are present.
- `MEDIA_UPLOAD_ALLOW_MOCK_STORAGE` is unset or false in production.
- Payments use live Korapay. `PAYMENT_PROVIDER=live`, Korapay keys, webhook secret, redirect URL, and treasury account details are present.
- Web and admin use the deployed API URL and do not expose diagnostic data-source badges.
- Trusted proxy auth flags stay disabled unless a trusted proxy boundary has been reviewed.

### Operational Setup

- Name the launch commander, backup commander, deploy owner, API owner, worker owner, payment owner, media owner, report QA owner, support owner, and customer comms owner in the launch notes.
- Confirm each owner has a reachable phone number or escalation handle, a backup, and a clear handoff window for launch day.
- Create the production admin operator list with named humans only; remove shared, test, contractor, and inactive admin accounts.
- Assign least-privilege admin roles before launch: campaign operators can claim and update campaigns, finance operators can issue invoices and reconcile payments, support operators can read customer state and add support notes, and super-admin access is limited to approved owners.
- Verify every admin operator can sign in with production credentials, complete MFA if enabled, and access only the Managed Ads screens needed for their role.
- Record the first-line queue owner for campaign intake, media review, invoice issuance, payment verification, report publishing, customer support, and incident triage.
- Define queue SLAs before launch: new brief first response, media review, invoice issuance after approval, payment verification, report QA, and incident acknowledgement.
- Add a visible handoff field or internal note convention for every claimed campaign so operators can see current owner, next action, and blocker.
- Verify launch accounts are ready: at least one real client workspace, one admin operator per role, one finance reviewer, and one support reviewer.
- Confirm launch client accounts have verified email or phone, completed business profile data, and an agreed billing contact.
- Store production access instructions for Render, Postgres, Redis/Key Value, Korapay, Cloudinary, domain/DNS, transactional email, and customer support tooling in the approved password manager.
- Confirm no launch-critical credential is stored in chat, local files, screenshots, issue comments, or personal notes.
- Confirm only approved owners can view or rotate Korapay live keys, Cloudinary API secrets, Render env vars, database URLs, and Redis credentials.
- Verify support channels are live and staffed: public support email, internal incident channel, launch-room channel, finance escalation channel, and customer escalation path.
- Publish support macros for campaign submitted, media rejected, invoice sent, payment received, payment delayed, report published, campaign paused, incident active, and incident resolved.
- Add launch-window coverage for weekends, evenings, and local holidays if customers can submit campaigns during those periods.
- Configure monitoring alerts for API health failures, elevated 4xx/5xx rates, slow campaign endpoints, worker restart loops, queue depth growth, failed jobs, payment webhook failures, duplicate payment attempts, Cloudinary upload failures, and report publish errors.
- Route alerts to a channel watched by the named owner and backup; verify alerts are not email-only during the launch window.
- Run a test alert for API, worker, payment, and media monitoring; confirm the owner acknowledges each alert and records the expected runbook link.
- Create dashboards or saved views for campaign status counts, unclaimed campaigns, overdue operator tasks, failed uploads, unpaid invoices, wallet/payment mismatches, report drafts waiting for QA, and published report counts.
- Confirm worker queue ownership: every enabled queue has a named responder, retry policy, dead-letter/manual recovery path, and clear criteria for pausing producers.
- Confirm campaign jobs cannot run against mock providers or local queues in production.
- Record the manual recovery steps for stuck campaign state transitions, failed media processing, failed invoice creation, failed payment verification, failed report publish, and duplicate webhook delivery.
- Prepare a payment reconciliation sheet or dashboard with columns for campaign ID, workspace, invoice ID, Korapay reference, wallet ledger entry, expected amount, settled amount, fees, status, owner, and resolution notes.
- Reconcile the launch test payment from Korapay event to invoice state, wallet ledger, campaign budget state, and customer-visible payment state.
- Set daily reconciliation windows for the first launch week, plus an end-of-day signoff by the payment owner.
- Define mismatch thresholds that trigger incident review, including missing webhook, duplicate credit, amount mismatch, unsettled charge, failed refund, and manual adjustment.
- Verify refund, reversal, and manual wallet adjustment authority: who can request, who can approve, who can execute, and where evidence is stored.
- Confirm Cloudinary production folder naming, allowed formats, max file sizes, transformation behavior, signed upload expiry, and access controls.
- Upload at least one production-safe image and one production-safe video or large creative through the client flow, then verify admin preview, stored metadata, CDN delivery, and deletion/replacement behavior.
- Verify rejected media is visible to operators with a reason, hidden from public customer report surfaces when appropriate, and traceable in audit/history.
- Check Cloudinary usage limits, billing alerts, backup/export expectations, and emergency contact path before exposing customer uploads.
- Define report QA rules: metrics source evidence required, screenshots/proofs required, placement links validated, totals checked, dates checked, customer-only language reviewed, and internal notes excluded.
- Require a second operator or report QA owner to approve the first production report before publishing to a customer.
- Verify a published report cannot be edited silently; corrections need an internal note, customer-safe explanation, and audit/history record.
- Prepare a report correction template for wrong metric, wrong media proof, broken placement link, typo, delayed data, and customer dispute.
- Confirm customer communications are ready for launch announcement, campaign received, missing information, media issue, invoice ready, payment confirmed, campaign live, report ready, campaign completed, delay notice, and incident update.
- Assign who can send proactive customer comms during launch and who approves broad customer-facing incident language.
- Confirm customer comms include expected response time, next action, and a single support channel; avoid exposing internal queue names, provider details, or admin notes.
- Prepare internal incident levels for Managed Ads: payment-blocking, upload-blocking, admin-blocking, report-blocking, partial customer degradation, and full rollback.
- Document rollback switches and owners for disabling new campaign submissions, disabling admin actions, pausing queue producers, pausing workers, disabling payment entry points, and switching customer comms to manual handling.
- Verify rollback does not delete campaign briefs, media, invoices, wallet ledger entries, reports, audit history, or customer messages.
- Prepare manual operating mode for a partial outage: intake by support, payment verification by finance, media collection fallback, report drafting fallback, and customer status updates.
- Run one tabletop incident before launch covering a failed payment webhook, a Cloudinary upload outage, a worker queue backlog, and an incorrect report published to a customer.
- Confirm database backup/export exists immediately before launch and the database owner knows the restore decision process.
- Confirm audit/history retention expectations for campaign state changes, admin notes, invoice/payment actions, media changes, and report publishes.
- Review privacy and data-handling expectations for customer creatives, business profiles, invoices, reports, screenshots, and placement links.
- Confirm the launch go/no-go meeting has named decision owners for product, engineering, operations, finance, support, and customer comms.
- Capture go/no-go evidence in one place: deployed commit, rollout checks, smoke flow result, alert test result, payment reconciliation result, media verification result, report QA result, support readiness, and open risks.
- Require every go/no-go owner to sign off with `go`, `go with risk`, or `no-go`, plus the risk owner and mitigation for any non-clean signoff.
- Do not enable unmanaged customer access or widen launch accounts until operational setup, smoke flow, reconciliation, and go/no-go signoff are complete.

### MVP Smoke Flow

1. Client signs in, completes business profile, and submits a campaign brief with at least one media upload.
2. Admin opens Campaign Operations, claims the new brief, posts an internal note, and moves the campaign through review.
3. Admin issues an invoice or budget hold tied to the campaign.
4. Client pays through Korapay or funds wallet; duplicate webhook/verify events do not double-credit wallet state.
5. Admin stores manual ad placement links, uploads proofs/screenshots, enters metrics, and publishes a report.
6. Client sees the timeline update, published report, invoice/payment state, and no admin-only notes.
7. Admin closes the campaign and confirms audit/history rows remain visible.

## Digital Access Beta

### Preflight

- Beta workspace IDs and beta users are known.
- Login/session flow works for each beta workspace.
- Protected routes reject missing, expired, or revoked sessions.
- Wallet writes, requests, and admin reads stay scoped to the authenticated workspace.
- Admin operators know how to approve, reject, cancel, and refund Digital Access requests.
- `QUEUE_PRODUCER_ENABLED=true` on API.
- `DIGITAL_ACCESS_TRUST_AUTH_HEADERS=false` unless explicitly approved.

### Enable Sequence

1. Create a Postgres logical export.
2. Set API and worker env:

```text
ENABLE_DIGITAL_ACCESS=true
ENABLE_DIGITAL_ACCESS_ADMIN=true
DIGITAL_ACCESS_WORKER_ENABLED=false
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false
```

3. Redeploy API and worker.
4. Verify `/v1/health`, then create one beta request through the API or web.
5. Set web static env and redeploy web:

```text
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS=true
```

6. Set admin static env and redeploy admin:

```text
NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN=true
```

7. Verify beta user and admin screens show the feature and non-beta users cannot access protected data.
8. Enable automation only after manual create/admin flows are verified:

```text
DIGITAL_ACCESS_WORKER_ENABLED=true
DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=true
```

9. Redeploy worker and confirm `digital-access-automation` is in enabled queues.

### Post-Enable Verification

- API `/v1/health` stays healthy after every flag change.
- Web Digital Access pages load for beta users.
- Admin Digital Access pages load for operators.
- Creating a request debits or reserves wallet state exactly once.
- Admin status changes produce the expected request state.
- Worker logs show `job completed` for `digital-access-automation`.
- Queue depth for `digital-access-automation` does not grow without processing.
- A user from workspace A cannot read or mutate workspace B requests.
- Disabling `ENABLE_DIGITAL_ACCESS` returns a feature disabled response for user routes.
- Disabling `ENABLE_DIGITAL_ACCESS_ADMIN` returns a feature disabled response for admin routes.

### Rollback Order

1. Set `DIGITAL_ACCESS_AUTOMATION_WORKER_ENABLED=false`.
2. Set `DIGITAL_ACCESS_WORKER_ENABLED=false`.
3. Set `NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS=false` and redeploy web.
4. Set `NEXT_PUBLIC_ENABLE_DIGITAL_ACCESS_ADMIN=false` and redeploy admin.
5. Set `ENABLE_DIGITAL_ACCESS=false` and `ENABLE_DIGITAL_ACCESS_ADMIN=false` if new API writes must stop.
6. Keep Redis, Postgres, and payment webhooks intact.
7. Reconcile in-flight requests manually before deleting or retrying jobs.

## OTP Beta

### Preflight

- Compliance approval exists for every workspace in `OTP_BETA_WORKSPACE_IDS`.
- OTP terms, refund rules, prohibited use policy, and support workflow are ready.
- Provider keys are present for the selected providers.
- `OTP_PROVIDER_MODE` is `mock`, `sandbox`, or `live` intentionally.
- `OTP_BETA_WORKSPACE_IDS` contains only approved beta workspaces.
- `OTP_USD_TO_NGN_RATE` has been reviewed against current pricing.
- `SMSACTIVATE_COMPATIBLE_ENABLED=false` unless a trusted compatible endpoint is approved.
- Korapay and wallet reconciliation are already stable.
- The worker service has these OTP worker flags defined before live OTP jobs are enabled:

```text
OTP_WORKER_ENABLED=false
OTP_ALLOCATION_WORKER_ENABLED=false
OTP_POLLING_WORKER_ENABLED=false
OTP_REFUNDS_WORKER_ENABLED=false
OTP_PROVIDER_HEALTH_WORKER_ENABLED=false
```

### Enable Sequence

1. Create a Postgres logical export.
2. Set beta access and provider mode on API and worker:

```text
OTP_PROVIDER_MODE=sandbox
OTP_BETA_WORKSPACE_IDS=<comma-separated-approved-workspace-ids>
ENABLE_OTP_MODULE=false
ENABLE_BUDGET_OTP=false
ENABLE_PREMIUM_OTP=false
ENABLE_OTP_ADMIN=false
```

3. Redeploy API and worker, then verify `/v1/health`.
4. Enable admin visibility for operators:

```text
ENABLE_OTP_ADMIN=true
```

5. Enable the marketplace for beta workspaces:

```text
ENABLE_OTP_MODULE=true
ENABLE_BUDGET_OTP=true
ENABLE_PREMIUM_OTP=false
```

6. Verify quotes and order blocking before enabling worker side effects.
7. Enable provider health jobs:

```text
OTP_WORKER_ENABLED=true
OTP_PROVIDER_HEALTH_WORKER_ENABLED=true
```

8. When ready for live order automation, enable allocation, polling, and refunds together:

```text
OTP_ALLOCATION_WORKER_ENABLED=true
OTP_POLLING_WORKER_ENABLED=true
OTP_REFUNDS_WORKER_ENABLED=true
```

9. Enable `ENABLE_PREMIUM_OTP=true` only after budget-tier provider health and refunds are stable.

### Post-Enable Verification

- Non-beta workspace requests are blocked.
- Beta workspace can list services and request a quote.
- Unsupported country or service returns a clear rejection.
- A successful order debits the OTP wallet exactly once.
- Cancellation or provider failure refunds exactly once.
- Admin OTP overview shows provider health and active order counts.
- Worker logs show expected activity for `otp-provider-health`, `otp-allocation`, `otp-polling`, and `otp-refunds`.
- Queue depth does not grow without processing.
- Provider dashboard totals match app order totals for the beta window.
- Korapay payments and wallet balance reconcile after OTP purchases.

### Rollback Order

1. Set `OTP_ALLOCATION_WORKER_ENABLED=false` and `OTP_POLLING_WORKER_ENABLED=false`.
2. Set `OTP_REFUNDS_WORKER_ENABLED=false` only if refund processing is unsafe.
3. Set `ENABLE_PREMIUM_OTP=false`.
4. Set `ENABLE_BUDGET_OTP=false`.
5. Set `ENABLE_OTP_MODULE=false` to stop new customer OTP actions.
6. Set `ENABLE_OTP_ADMIN=false` if admin actions are unsafe.
7. Clear or narrow `OTP_BETA_WORKSPACE_IDS` if abuse is workspace-specific.
8. Reconcile open orders, provider reservations, refunds, and wallet entries before reopening.

## Final Go Or No-Go

- Deploy owner confirms the exact commit deployed.
- API owner confirms health, logs, and protected routes.
- Worker owner confirms enabled queues and no failing jobs.
- Payment owner confirms Korapay webhook, settlement, and wallet reconciliation.
- Database owner confirms backup/export and recovery plan.
- Support owner confirms beta contact path and incident messaging.
- Product owner confirms only intended beta workspaces can access the feature.

Do not widen beta access until the previous beta window has a clean reconciliation report.
