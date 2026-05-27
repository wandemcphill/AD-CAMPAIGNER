# Managed Ads Launch Runbook And Evidence Packet

Use this packet during the managed ads launch room. The phase board in
`docs/MANAGED_ADS_LAUNCH_TRACKER.md` shows status; this document tells each
owner what to do, what evidence to collect, what is locally provable, and what
still depends on external dashboards or human approval.

The launch is only ready when every phase is either `Go` or explicitly accepted
as `Go with risk` by the named owner and deploy owner.

## How To Use This Packet

1. Create one launch notes thread or document for the launch window.
2. Paste the Launch Evidence Index below into that thread.
3. Work phases in order, but let owners collect evidence in parallel.
4. For every task, record either an evidence link, `External blocked`, or
   `No-go`.
5. Do not widen customer access until Phase 9 is signed off.

## Launch Evidence Index

```text
Launch date:
Launch commander:
Backup commander:
Launch channel:
Incident channel:
Customer support channel:
Target commit:
Rollback commit:

Phase 0 - Access and ownership:
Phase 1 - Production environment:
Phase 2 - Admin operations setup:
Phase 3 - Client flow setup:
Phase 4 - Manual launch accounts:
Phase 5 - Payments and reconciliation:
Phase 6 - Media and report evidence:
Phase 7 - Notifications and support:
Phase 8 - Monitoring and alerts:
Phase 9 - Go/no-go and rollback:

Open risks:
- 

Final decision:
- Go / Go with risk / No-go
```

## Phase 0 - Access And Ownership (OPS-001 - OPS-010)

Goal: every production responsibility has a named human, backup, and reachable
channel before customer work starts.

Local evidence:
- Owner roster with human names for every owner slot.
- Launch channel and incident channel links.
- Admin route permission check evidence for at least one operator and one
  non-admin account.
- Rollback owner acknowledgement that rollback authority is available.

External blockers:
- Render access for deploy/API/worker/rollback owners.
- GitHub auth or repository access for release owners.
- Korapay dashboard access for payment owner.
- Cloudinary dashboard access for media owner.
- Support inbox/channel access for support owner.

Runbook:
1. Fill the Owner Signoff Template for every owner slot.
2. Confirm every owner has a backup and escalation handle.
3. Confirm no shared, test, or personal-only admin accounts are launch-critical.
4. Post the owner roster in the launch notes.
5. Mark the phase `External blocked` if any owner cannot access their system.

Evidence to paste:
```text
Phase 0 evidence
- Owner roster:
- Launch channel:
- Incident channel:
- Admin operator login checked by:
- Non-admin rejection checked by:
- Missing access or blockers:
- Phase decision: Go / Go with risk / No-go
```

## Phase 1 - Production Environment (OPS-011 - OPS-025)

Goal: API, worker, web, and admin are running the expected commit with production
dependencies and no mock/demo pathways.

Local evidence:
- Strict rollout checks pass for API, worker, web, and admin.
- Expected commit SHA recorded.
- Migration dry run output recorded.
- Backup/export reference recorded.
- Production env review confirms no demo/mock flags are enabled.

External blockers:
- Render service/env access.
- Production Postgres and Redis access.
- GitHub deploy provenance.
- Korapay live env values and webhook URL.
- Cloudinary live env values and upload preset.

Runbook:
1. Record the expected launch commit and deployment references.
2. Run the strict rollout checks:

```powershell
corepack pnpm exec tsx scripts/rollout-check.ts --target=api --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=worker --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=web --stage=managed-ads-mvp --strict-production
corepack pnpm exec tsx scripts/rollout-check.ts --target=admin --stage=managed-ads-mvp --strict-production
```

3. Confirm `NODE_ENV=production` on API and worker.
4. Confirm API/worker use production Postgres and Redis.
5. Confirm Cloudinary and Korapay production values are present without posting
   secrets.
6. Confirm `MEDIA_UPLOAD_ALLOW_MOCK_STORAGE` and
   `NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE` are unset or false.
7. Record backup/export and migration dry-run evidence.

Evidence to paste:
```text
Phase 1 evidence
- API rollout check:
- Worker rollout check:
- Web rollout check:
- Admin rollout check:
- Deployed commit:
- Render deploy refs:
- Backup/export ref:
- Migration dry run:
- Mock/demo flags reviewed by:
- Phase decision: Go / Go with risk / No-go
```

## Phase 2 - Admin Operations Setup (OPS-026 - OPS-040)

Goal: operators can triage, claim, assign, update, audit, and recover managed
ads work without ambiguity.

Local evidence:
- Operator roster and assignment rules posted.
- Queue defaults to unassigned or needs-action work.
- Claim/assign/status/note/audit behavior verified.
- Missing campaign detail ID renders a styled empty state.
- Mobile admin queue has a card fallback and no horizontal scroll.

External blockers:
- Production admin credentials for named operators.
- Operations lead approval of the launch roster.
- Any role/permission changes required in the deployed admin app.

Runbook:
1. Post roster and assignment rules for operator, designer, finance, and report
   QA roles.
2. Define SLAs for unassigned briefs, unpaid invoices, and report publication.
3. Verify an admin can claim/assign a campaign.
4. Verify internal-only notes remain hidden from clients.
5. Verify client-visible timeline updates appear to the client.
6. Verify destructive status changes require confirmation.
7. Verify activity/audit entries are created for writes.
8. Capture desktop and mobile screenshots for queue and detail surfaces.

Evidence to paste:
```text
Phase 2 evidence
- Operator roster:
- Assignment rules:
- SLA thresholds:
- Claim/assign check:
- Internal note hidden from client:
- Client update visible:
- Status matrix:
- Audit entry IDs:
- Desktop screenshots:
- Mobile screenshots:
- Phase decision: Go / Go with risk / No-go
```

## Phase 3 - Client Flow Setup (OPS-041 - OPS-050)

Goal: a real client can sign up, complete profile, submit a campaign, and see
only client-safe campaign, billing, and report state.

Local evidence:
- Signup/login evidence.
- Business profile completion evidence.
- Incomplete profile gate evidence.
- Campaign draft/submission ID from production DB.
- Post-submission confirmation screenshot.
- Client timeline/report/billing visibility checks.
- Mobile bottom navigation screenshots.

External blockers:
- Approved launch client account.
- Verified client contact details.
- Production billing contact.
- Support owner approval of client-facing copy.

Runbook:
1. Create or use an approved launch client workspace.
2. Complete the business profile.
3. Attempt campaign submission with an incomplete profile and confirm the gate.
4. Submit a campaign brief with objective, platform, targeting, budget, links,
   and media.
5. Confirm the campaign appears immediately to the client.
6. Compare client and admin views to confirm internal notes and raw IDs are not
   visible to the client.
7. Confirm only published reports appear to the client.
8. Capture desktop and 375px mobile screenshots.

Evidence to paste:
```text
Phase 3 evidence
- Client workspace:
- Test campaign:
- Business profile check:
- Incomplete profile gate:
- Submission confirmation:
- Client-safe timeline:
- Billing context:
- Published report visibility:
- Mobile screenshots:
- Phase decision: Go / Go with risk / No-go
```

## Phase 4 - Manual Launch Accounts (OPS-051 - OPS-060)

Goal: operators can manually launch campaigns in external ad dashboards before
customer spend is at risk.

Local evidence:
- Naming convention posted.
- UTM/link tagging convention posted.
- Spend cap policy posted.
- Placement URL required fields documented.
- Local/admin checklist confirms campaign cannot be treated as live without
  proof/link policy.

External blockers:
- TikTok Ads Manager operator access.
- Meta Business/Ads Manager operator access.
- Instagram/Facebook page access.
- External ad policy escalation path.
- Real proof examples from external dashboards when required.

Runbook:
1. Confirm each launch operator can access TikTok Ads Manager.
2. Confirm each launch operator can access Meta Business/Ads Manager and the
   required pages.
3. Post the external campaign naming convention:
   `FT-{client}-{campaign}-{platform}-{YYYYMMDD}`.
4. Post the UTM pattern:
   `utm_source={platform}&utm_medium=paid_social&utm_campaign={campaign_ref}`.
5. Confirm spend cap policy with the payment owner before launch.
6. Capture proof standards for each platform: dashboard screenshot, placement
   URL, date/time, platform, spend cap, and operator initials.
7. Save a test manual placement URL in the admin app.

Evidence to paste:
```text
Phase 4 evidence
- TikTok access:
- Meta access:
- Page access:
- Naming pattern:
- UTM pattern:
- Spend cap policy:
- Proof examples:
- Rejection escalation:
- Test placement:
- Phase decision: Go / Go with risk / No-go
```

## Phase 5 - Payments And Reconciliation (OPS-061 - OPS-070)

Goal: money state reconciles exactly once from Korapay event to invoice, wallet,
budget hold, campaign spend, and client-visible state.

Local evidence:
- Payment intent reference.
- Invoice/payment/campaign link evidence.
- Wallet ledger entry.
- Duplicate webhook/verify idempotency evidence.
- Budget hold create/release/capture evidence.
- Insufficient balance error evidence.
- Refund/manual reversal playbook posted.

External blockers:
- Korapay live or approved sandbox access.
- Webhook endpoint access.
- Treasury/bank details.
- Finance approver availability.
- Bank settlement visibility when required.

Runbook:
1. Create a small launch test invoice or wallet funding intent.
2. Complete the payment through Korapay live or approved sandbox.
3. Confirm webhook credits the wallet once.
4. Replay verify/webhook and confirm no duplicate credit.
5. Confirm payment intent is linked to invoice and campaign.
6. Create a budget hold from funded balance.
7. Release one hold and capture one hold; record before/after balances.
8. Confirm insufficient balance returns a client-safe error.
9. Post the Payment Mismatch Incident Template in the launch notes.

Evidence to paste:
```text
Phase 5 evidence
- Korapay reference:
- Invoice ID:
- Payment intent ID:
- Wallet ledger entry:
- Duplicate webhook/verify result:
- Budget hold create:
- Budget hold release:
- Budget hold capture:
- Insufficient balance result:
- Finance approver:
- Phase decision: Go / Go with risk / No-go
```

## Phase 6 - Media And Report Evidence (OPS-071 - OPS-080)

Goal: clients and operators can upload assets, operators can manage proofs, and
reports are reviewed before publication.

Local evidence:
- Valid image and video asset IDs.
- Rejected oversized upload evidence.
- Rejected unsupported MIME evidence.
- Invalid signature rejection evidence.
- Proof visibility comparison between admin and client.
- Draft report ID, preview evidence, and published report evidence.

External blockers:
- Cloudinary dashboard access.
- Production upload preset/secrets.
- Cloudinary usage/billing limits.
- Real external launch proof assets if required.

Runbook:
1. Upload one production-safe image through the client flow.
2. Upload one production-safe video through the client flow.
3. Attempt oversized upload and capture UI/API rejection.
4. Attempt unsupported MIME upload and capture rejection.
5. Confirm invalid upload completion signature is rejected.
6. Upload proof/screenshot in admin and mark it client-visible.
7. Confirm hidden proof is not visible to the client.
8. Build a report with metrics, summary, proofs, observations, and next steps.
9. Preview the report, get QA approval, then publish.

Evidence to paste:
```text
Phase 6 evidence
- Image asset:
- Video asset:
- Oversized rejection:
- MIME rejection:
- Invalid signature rejection:
- Client-visible proof:
- Hidden proof check:
- Draft report:
- Preview approval:
- Published report:
- Phase decision: Go / Go with risk / No-go
```

## Phase 7 - Notifications And Support (OPS-081 - OPS-090)

Goal: clients and operators receive useful updates, support can answer common
questions, and disabled notification providers stay disabled.

Local evidence:
- Client notification route screenshot.
- Admin notification route screenshot if applicable.
- Support channel URL.
- Support macros saved for expected launch events.
- Payment mismatch and ad rejection incident macros saved.
- WhatsApp/provider-disabled env/config evidence.

External blockers:
- Support inbox access.
- Customer comms approval.
- WhatsApp/provider account access if enabled.
- Support staffing for launch window.

Runbook:
1. Confirm client notifications load.
2. Confirm admin notifications load if enabled.
3. Post support channel URL and staffing coverage.
4. Save support macros for brief received, invoice due, payment received,
   campaign live, report published, campaign paused, incident active, and
   incident resolved.
5. Save the payment mismatch and ad rejection incident templates.
6. Confirm WhatsApp notifications are disabled unless a provider is configured.

Evidence to paste:
```text
Phase 7 evidence
- Client notifications:
- Admin notifications:
- Support channel:
- Saved support macros:
- Payment mismatch macro:
- Ad rejection macro:
- WhatsApp/provider setting:
- Staffing coverage:
- Phase decision: Go / Go with risk / No-go
```

## Phase 8 - Monitoring And Alerts (OPS-091 - OPS-100)

Goal: owners can see failures quickly, acknowledge them, and know the runbook to
use.

Local evidence:
- Saved log filters or dashboard links for API 5xx, slow campaign endpoints,
  queue failures, media failures, payment mismatches, and report publish errors.
- Manual review cadence if an automated alert is not available.
- Owner contact path.
- Test alert acknowledgement.

External blockers:
- Render alert configuration.
- Postgres/Redis dashboard access.
- Korapay/payment alert source.
- Cloudinary usage/error views.
- On-call or paging tool access if used.

Runbook:
1. Capture Render API health alert name.
2. Capture worker restart alert name.
3. Capture Postgres and Redis capacity alert names or manual review cadence.
4. Capture payment mismatch alert or daily reconciliation reminder.
5. Capture queue depth alert or manual queue check cadence.
6. Capture failed upload alert or manual media error review cadence.
7. Capture 5xx API log filter.
8. Send one deploy/API/worker/payment/media test alert where possible.
9. Confirm owner and backup acknowledge the alert in the launch channel.

Evidence to paste:
```text
Phase 8 evidence
- API health alert/filter:
- Worker restart alert/filter:
- Postgres alert/cadence:
- Redis alert/cadence:
- Payment mismatch alert/cadence:
- Queue depth alert/cadence:
- Media upload alert/cadence:
- 5xx review filter:
- Test alert acknowledgement:
- Owner contact path:
- Phase decision: Go / Go with risk / No-go
```

## Phase 9 - Go/No-Go And Rollback (OPS-101 - OPS-110)

Goal: one full production smoke is complete, rollback is understood, and every
owner signs off.

Local evidence:
- Complete production smoke campaign from signup to report publish.
- UI audit and screenshots prove no demo/fallback/raw error markers.
- Admin desktop and client mobile screenshots.
- Rollback target commit/deploy.
- Rollback order.
- Reconciliation and customer messaging plans.
- Final signoff thread.
- Production config freeze notice.

External blockers:
- Render rollback permissions.
- GitHub deploy provenance.
- Payment reconciliation approval.
- Customer comms approval.
- Owner availability for signoff.

Runbook:
1. Run the deployed smoke with live Render URLs:

```powershell
$env:API_URL="https://api.example.com"; $env:APP_URL="https://app.example.com"; $env:ADMIN_URL="https://admin.example.com"; corepack pnpm smoke:deployed
```

2. Run the static UI audit and collect screenshots:

```powershell
corepack pnpm ui:audit
```

3. Record campaign, invoice, payment, media, placement, and report IDs from the
   smoke.
4. Confirm rollback target commit/deploy and rollback order.
5. Confirm rollback preserves campaign briefs, media, invoices, wallet ledger,
   reports, audit history, and customer messages.
6. Post customer messaging plan for delayed launches or rollback.
7. Freeze production config changes unless approved by deploy owner.
8. Collect final owner signoff.

Evidence to paste:
```text
Phase 9 evidence
- Smoke workspace:
- Smoke campaign:
- Smoke invoice:
- Smoke payment:
- Smoke media asset:
- Smoke manual placement:
- Smoke report:
- UI audit result:
- Admin desktop screenshots:
- Client mobile screenshots:
- Rollback target:
- Rollback order:
- Reconciliation plan:
- Customer messaging plan:
- Config freeze notice:
- Owner signoff thread:
- Final decision: Go / Go with risk / No-go
```

## Templates

### Owner Signoff Template

```text
Owner signoff
- Owner slot:
- Name:
- Backup:
- Escalation handle:
- Systems verified:
- Evidence links:
- Open risk:
- Risk owner:
- Decision: go / go with risk / no-go
```

### Final Go/No-Go Template

```text
Final go/no-go
- Launch date:
- Target commit:
- Deployed commit:
- Rollback commit/deploy:
- Production smoke result:
- Payment reconciliation result:
- Media/report result:
- Monitoring result:
- Open risks:
- Decision owner:
- Final decision: go / go with risk / no-go
```

### Rollback Template

```text
Rollback decision
- Trigger:
- Customer impact:
- Decision owner:
- Rollback owner:
- Target deploy/commit:
- Services to roll back:
  - Web:
  - Admin:
  - API:
  - Worker:
- Writes to pause:
- Queues to pause:
- Payment entry points to pause:
- Data that must be preserved:
- Reconciliation owner:
- Customer comms owner:
- Start time:
- End time:
- Current status:
```

### Payment Mismatch Incident Template

```text
Payment mismatch incident
- Severity:
- Detected by:
- Detected at:
- Workspace:
- Campaign:
- Invoice:
- Korapay reference:
- Expected amount:
- Provider amount/status:
- Wallet ledger entry:
- Budget hold/spend entry:
- Customer-visible status:
- Suspected issue:
  - Missing webhook / duplicate credit / amount mismatch / unsettled charge / refund issue / manual adjustment
- Immediate action:
- Customer comms needed: yes / no
- Finance approver:
- Resolution:
- Follow-up prevention task:
```

### External Ad Rejection Incident Template

```text
External ad rejection incident
- Severity:
- Platform: TikTok / Meta / Instagram / Facebook
- Campaign:
- Workspace:
- External ad account/page:
- Operator:
- Rejection reason from platform:
- Screenshot/proof link:
- Spend impact:
- Launch date impact:
- Client-visible status:
- Immediate action:
  - Edit creative / request client changes / appeal / switch placement / pause campaign
- Client update required: yes / no
- Owner:
- ETA:
- Resolution:
```

### Support Macro - Brief Received

```text
Subject: Your campaign brief has been received

Hi {{client_name}},

We have received your campaign brief for {{campaign_name}}. The Fliptrybe team
will review the brief, confirm the campaign plan, and follow up within
{{review_sla}}.

You can track the campaign status from your Fliptrybe dashboard. If we need more
details, we will message you there.
```

### Support Macro - Missing Information

```text
Subject: We need one more detail for your campaign

Hi {{client_name}},

We are reviewing {{campaign_name}} and need one more detail before we can move
forward: {{missing_information}}.

Please update the campaign brief or reply through the support channel. Once we
have this, our team can continue the review.
```

### Support Macro - Invoice Ready

```text
Subject: Your campaign invoice is ready

Hi {{client_name}},

Your invoice for {{campaign_name}} is ready. It covers {{service_description}}
for {{campaign_period}}.

You can pay the invoice or add funds to your wallet from Billing in your
Fliptrybe dashboard. Once payment is confirmed, our team will begin campaign
production.
```

### Support Macro - Payment Received

```text
Subject: Payment received for your campaign

Hi {{client_name}},

We have received payment for {{campaign_name}}. Your campaign is now moving into
production with the Fliptrybe team.

We will update your timeline when setup is complete and the campaign is ready to
go live.
```

### Support Macro - Campaign Live

```text
Subject: Your campaign is live

Hi {{client_name}},

{{campaign_name}} is now live on {{platforms}}. Our team will monitor delivery
and publish updates from your Fliptrybe dashboard.

Your next report is expected around {{expected_report_date}}.
```

### Support Macro - Report Published

```text
Subject: Your campaign report is ready

Hi {{client_name}},

Your Fliptrybe campaign report for {{campaign_name}} is ready. It includes the
campaign summary, performance metrics, spend summary, proofs, and next steps.

You can view or download the report from Reports in your dashboard.
```

### Support Macro - Campaign Paused

```text
Subject: Update on your campaign

Hi {{client_name}},

We have paused {{campaign_name}} while our team reviews {{pause_reason}}. Your
budget remains tracked in Fliptrybe, and we will update you before any next
action is taken.

Expected next update: {{next_update_time}}.
```

### Support Macro - Incident Active

```text
Subject: We are checking an issue affecting your campaign

Hi {{client_name}},

We are investigating an issue that may affect {{campaign_name}}:
{{customer_safe_summary}}.

Our team is working on it now. We will send the next update by
{{next_update_time}}.
```

### Support Macro - Incident Resolved

```text
Subject: Campaign issue resolved

Hi {{client_name}},

The issue affecting {{campaign_name}} has been resolved. {{resolution_summary}}

Your campaign status has been updated in Fliptrybe. If any timing, budget, or
reporting detail changed, we have noted it on the campaign timeline.
```
