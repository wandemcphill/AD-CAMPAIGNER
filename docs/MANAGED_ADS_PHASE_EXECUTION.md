# Managed Ads Phase Execution Guide

Use this guide to run the remaining managed ads OPS-001 through OPS-110 launch
work without pretending local checks prove external readiness. The canonical task
inventory remains `docs/MANAGED_ADS_PRODUCTION_TASKS.md`; the daily board remains
`docs/MANAGED_ADS_LAUNCH_TRACKER.md`. This document explains how to assign the
10 phases into sequential waves and parallel worker lanes.

## Non-Negotiable Evidence Rule

Every phase worker must leave one of these outcomes in the launch tracker:

- `Evidence captured`: proof is posted in the launch notes, incident channel, or
  an environment variable consumed by the readiness/smoke scripts.
- `Local complete`: repo-side checks are complete, but provider/dashboard proof
  is still missing.
- `External blocked`: the worker needs provider credentials, dashboard access,
  production account access, approval, or live provider state that they do not
  have.
- `No-go`: the worker found a launch-blocking defect or operational gap.

Do not fake dashboard access, provider screenshots, live payment status, deploy
authority, ad account state, customer approval, or alert configuration. If the
worker cannot prove it from the repo, launch notes, incident channel, or env vars
used by scripts, mark it `External blocked` with the exact missing access.

Evidence must be captured in one of these places:

- Launch notes or final go/no-go thread, preferably linked from
  `OPS_LAUNCH_NOTES_URL`.
- Incident channel, for blockers, no-go findings, payment mismatches, ad
  rejections, rollback decisions, or customer-impacting risks.
- Environment variables consumed by scripts, such as `OPS_PHASE_0_EVIDENCE`
  through `OPS_PHASE_9_EVIDENCE`, owner variables, and deployed smoke URLs.

## Sequential Waves

Run the phases in four waves. A later wave can prepare in parallel, but it cannot
close until its prerequisites have either evidence or an explicit accepted risk.

| Wave | Phases | OPS Range | Exit Gate |
| --- | --- | --- | --- |
| Wave 1 - Access and deploy foundation | 0, 1 | OPS-001 - OPS-025 | Owners, channels, production deploy state, env review, backup, migration dry run, and rollout checks are evidenced or externally blocked. |
| Wave 2 - Product proof | 2, 3, 6 | OPS-026 - OPS-050 and OPS-071 - OPS-080 | Admin flow, client flow, media, proofs, and reports are usable by named operators with required access gaps called out. |
| Wave 3 - External operations | 4, 5, 7, 8 | OPS-051 - OPS-070 and OPS-081 - OPS-100 | Manual launch accounts, payments, reconciliation, support, notifications, and alerts have proof or named provider blockers. |
| Wave 4 - Final launch decision | 9 | OPS-101 - OPS-110 | Full smoke, rollback, reconciliation, customer messaging, config freeze, and owner signoff are complete. |

## Parallel Worker Lanes

Workers can run inside each wave by lane. Each lane must update the tracker row
for every phase it touches and include evidence links or blockers.

| Lane | Primary Phases | Owners | Work Focus | Can Run In Parallel With |
| --- | --- | --- | --- | --- |
| Deploy lane | 0, 1, 8, 9 | Deploy owner, Rollback owner | Owner roster, Render deploy state, commit provenance, backup, rollback target, config freeze, deploy alert. | API, worker, payments, media, support lanes after phase 0 owner roster exists. |
| API lane | 1, 2, 3, 6, 8 | API owner | Strict rollout checks, auth/permission checks, admin audit behavior, client-safe visibility, report/proof access, 5xx review. | Admin ops, client flow, media, monitoring lanes. |
| Worker lane | 1, 8 | Worker owner | Worker rollout, Redis/queue state, retries, queue depth alert or manual cadence. | API and deploy lanes once production env access is known. |
| Campaign ops lane | 0, 2, 4, 6, 9 | Campaign ops owner, Report QA owner | Operator roster, queue workflow, manual placement policy, proof standards, report review, admin screenshots. | Client/support, media, payments lanes after phase 2 roster is drafted. |
| Client/support lane | 0, 3, 7, 9 | Support owner, Customer comms owner | Client flow, support channel, macros, notification checks, customer messaging, mobile screenshots. | API, campaign ops, payments lanes after approved launch client exists. |
| Payments lane | 0, 1, 5, 8, 9 | Payments owner | Korapay access, live or approved sandbox payment, webhook idempotency, wallet ledger, holds, reconciliation. | Client flow and deploy lanes; cannot close without Korapay/provider evidence or external-blocked status. |
| Media lane | 0, 1, 6, 8 | Media owner | Cloudinary env, image/video uploads, rejection cases, proof assets, media alerts or review cadence. | Campaign ops and API lanes; cannot close without Cloudinary evidence or external-blocked status. |

## Phase Map

| Phase | OPS Range | Primary Owners | Evidence Expectations | Mark `External blocked` When Missing |
| --- | --- | --- | --- | --- |
| 0 - Access and ownership | OPS-001 - OPS-010 | Deploy owner, Support owner, Campaign ops owner, API owner, Payments owner, Media owner, Rollback owner | Owner roster, backups, escalation handles, launch channel, incident channel, admin route permission check, rollback responsibility acknowledgement. | Render access, GitHub/repo access, Korapay dashboard, Cloudinary dashboard, support inbox/channel, or named operator admin access is unavailable. |
| 1 - Production environment | OPS-011 - OPS-025 | Deploy owner, API owner, Worker owner, Media owner, Payments owner | Rollout checks for API/worker/web/admin, deployed commit SHA, production env review, backup/export reference, migration dry-run output, no mock/demo flags. | Render service/env access, production Postgres/Redis access, GitHub deploy provenance, Korapay live env values, or Cloudinary live env values is unavailable. |
| 2 - Admin operations setup | OPS-026 - OPS-040 | Campaign ops owner, API owner, Payments owner | Operator roster, assignment rules, SLAs, queue/default state, claim/assign/status/note/audit checks, empty state, desktop/mobile evidence. | Production admin credentials, operations lead roster approval, or deployed role/permission changes are unavailable. |
| 3 - Client flow setup | OPS-041 - OPS-050 | API owner, Support owner, Payments owner | Signup/login, business profile, incomplete profile gate, production campaign ID, client confirmation, client-safe timeline, billing context, published report visibility, mobile screenshots. | Approved launch client account, verified contact details, production billing contact, or support approval of client copy is unavailable. |
| 4 - Manual launch accounts | OPS-051 - OPS-060 | Campaign ops owner, Payments owner, Media owner | TikTok/Meta/page access confirmation, naming convention, UTM convention, spend cap policy, proof standard, rejection escalation path, test placement, live-before-proof guard. | TikTok Ads Manager, Meta Business/Ads Manager, Instagram/Facebook page access, ad policy escalation path, or real external proof access is unavailable. |
| 5 - Payments and reconciliation | OPS-061 - OPS-070 | Payments owner | Korapay reference, invoice/payment/campaign linkage, wallet ledger entry, duplicate webhook/idempotency proof, budget hold create/release/capture, insufficient balance result, reversal playbook. | Korapay live or approved sandbox access, webhook endpoint access, treasury/bank details, finance approver, or settlement visibility is unavailable. |
| 6 - Media and report evidence | OPS-071 - OPS-080 | Media owner, Campaign ops owner, API owner, Support owner, Report QA owner | Valid image/video asset IDs, oversized and MIME rejection evidence, invalid signature rejection, proof visibility checks, draft report, preview approval, published report. | Cloudinary dashboard, upload preset/secrets, usage/billing views, or required real external proof assets are unavailable. |
| 7 - Notifications and support | OPS-081 - OPS-090 | Support owner, Customer comms owner | Client/admin notification route checks, support channel, saved macros, incident templates, disabled-provider config evidence, staffing coverage. | Support inbox access, customer comms approval, WhatsApp/provider account access if enabled, or launch staffing is unavailable. |
| 8 - Monitoring and alerts | OPS-091 - OPS-100 | API owner, Worker owner, Deploy owner, Payments owner, Media owner, Support owner | Alert names or manual review cadence for API, worker, Postgres, Redis, payments, queue, media, deploy failures, 5xx review, owner contact path, alert acknowledgement. | Render alert configuration, Postgres/Redis dashboard, Korapay/payment alert source, Cloudinary usage/error views, or paging/on-call access is unavailable. |
| 9 - Go/no-go and rollback | OPS-101 - OPS-110 | Deploy owner, Rollback owner, Payments owner, Support owner, Campaign ops owner | Full production smoke IDs, UI audit screenshots, rollback target/order, reconciliation plan, customer messaging plan, config freeze notice, final owner signoff thread. | Render rollback permissions, GitHub deploy provenance, payment reconciliation approval, customer comms approval, or owner signoff availability is unavailable. |

## Wave Execution Checklist

### Wave 1 - Access And Deploy Foundation

1. Assign owners and backups for every owner slot.
2. Create or link launch notes and incident channel.
3. Populate `OPS_OWNER_ROSTER_URL`, `OPS_LAUNCH_NOTES_URL`,
   `OPS_INCIDENT_RUNBOOK_URL`, `OPS_ROLLBACK_PLAN_URL`,
   `OPS_SUPPORT_CONTACT`, and `OPS_ESCALATION_CONTACT`.
4. Run phase 0 readiness evidence collection.
5. Run phase 1 rollout, env, backup, migration, and commit checks.
6. Stop and mark `External blocked` for any provider/dashboard credential gap.

### Wave 2 - Product Proof

1. Campaign ops worker runs phase 2 admin checks.
2. Client/support worker runs phase 3 client flow checks.
3. Media/API/support workers run phase 6 media, proof, and report checks.
4. Use the incident channel for any finding that can affect customer money,
   external ad launch state, permissions, or privacy.
5. Do not close phase 6 from local UI checks alone when Cloudinary dashboard or
   real external proof assets are still missing. Mark those gaps `External blocked`.

### Wave 3 - External Operations

1. Campaign ops/media/payments workers run phase 4 manual launch account checks.
2. Payments worker runs phase 5 with Korapay live or approved sandbox proof.
3. Support worker runs phase 7 notification, macro, and staffing checks.
4. Monitoring workers run phase 8 alert or manual cadence checks.
5. Any absent provider dashboard or alert source must be `External blocked`,
   not `Evidence captured`.

### Wave 4 - Final Launch Decision

1. Deploy owner runs the full deployed smoke and captures all IDs.
2. Support and campaign ops owners capture UI audit screenshots.
3. Rollback owner posts rollback target and order.
4. Payments owner posts reconciliation plan and approval.
5. Customer comms owner posts rollback/delay messaging plan.
6. Deploy owner posts config freeze notice.
7. Every owner signs off with `go`, `go with risk`, or `no-go`.

## Worker Prompt Templates

### Phase Worker Prompt

```text
You are Worker {letter} for ADS CAMPAIGNER. You are not alone in the codebase;
do not revert or overwrite changes made by others.

Work only on phase {phase_number}: {phase_name}, covering {ops_range}.
Primary owners: {owners}.

Mission:
- Read docs/MANAGED_ADS_PRODUCTION_TASKS.md for the task inventory.
- Read docs/MANAGED_ADS_LAUNCH_TRACKER.md for the current tracker language.
- Collect or document evidence for {ops_range}.
- Update only the launch notes/tracker fields assigned to you, unless told
  otherwise.
- Evidence must be posted in launch notes, the incident channel, or env vars
  consumed by scripts.
- If provider/dashboard credentials, production account access, approval, or
  live provider state is missing, mark the task or phase External blocked.
- Do not invent dashboard proof, provider state, screenshots, payment status,
  alert names, deploy permissions, or customer approvals.

Final response:
- Phase and OPS range handled.
- Evidence captured.
- External blockers.
- No-go findings.
- Files changed, if any.
```

### Lane Worker Prompt

```text
You are Worker {letter} for ADS CAMPAIGNER, assigned to the {lane_name} lane.
You are not alone in the codebase; do not revert or overwrite changes made by
others.

Lane scope:
- Phases: {phase_numbers}
- OPS ranges: {ops_ranges}
- Owners: {owners}

Mission:
- Work phases in wave order.
- Capture launch evidence in launch notes, the incident channel, or env vars
  consumed by readiness/smoke scripts.
- Update the launch tracker only for your assigned phases.
- Mark Local complete only for repo-side proof.
- Mark External blocked for missing provider/dashboard credentials, account
  access, live provider state, approvals, or staffing availability.
- Escalate customer money, privacy, ad launch, rollback, or incident-risk
  findings into the incident channel.

Final response:
- Lane completed.
- Per-phase status.
- Evidence links or env vars populated.
- External blockers.
- No-go risks.
```

### External Blocker Escalation Prompt

```text
You are Worker {letter} for ADS CAMPAIGNER. Escalate an external blocker for
phase {phase_number}: {phase_name}.

Post this in the launch notes or incident channel:
- Phase:
- OPS IDs affected:
- Missing credential/access/approval:
- Required owner:
- Why local evidence is insufficient:
- Launch impact:
- Next action:
- Status: External blocked

Do not substitute local screenshots, assumptions, or old evidence for missing
provider/dashboard proof.
```

### Final Go/No-Go Worker Prompt

```text
You are the final go/no-go worker for ADS CAMPAIGNER.

Mission:
- Verify phases 0-9 have Evidence captured, Go, accepted Go with risk, No-go,
  or External blocked status.
- Confirm every OPS range from OPS-001 through OPS-110 is represented.
- Confirm all launch evidence is in launch notes, incident channel, or env vars
  consumed by scripts.
- Confirm no provider/dashboard proof was faked or inferred from local checks.
- Confirm rollback target, rollback order, payment reconciliation plan, customer
  messaging plan, config freeze notice, and owner signoff are present.

Final response:
- Final decision: go / go with risk / no-go.
- Missing evidence.
- External blockers.
- Owner signoffs.
- Required next action before launch.
```

## Script Evidence Handoff

When a worker captures evidence as env vars, use stable references rather than
secret values. Examples:

```powershell
$env:OPS_PHASE_0_EVIDENCE="launch-notes#phase-0-owner-roster"
$env:OPS_PHASE_1_EVIDENCE="launch-notes#phase-1-rollout-checks"
$env:OPS_PHASE_5_EVIDENCE="incident-channel#korapay-idempotency-check"
$env:OPS_PHASE_9_EVIDENCE="launch-notes#final-go-no-go"
corepack pnpm ops:readiness -- --phase=9
corepack pnpm ops:run-phases -- --run-local
```

For deployed smoke, provide URLs and identifiers consumed by the script, but do
not expose provider secrets:

```powershell
$env:API_URL="https://api.example.com"
$env:APP_URL="https://app.example.com"
$env:ADMIN_URL="https://admin.example.com"
corepack pnpm smoke:deployed
```

If a script cannot run because a credential or live service is missing, capture
the attempted command, reason it could not run, and the required owner, then mark
the relevant phase `External blocked`.
