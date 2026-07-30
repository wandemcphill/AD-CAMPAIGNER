# Readiness System Audit

Date: 2026-06-05

Commands investigated:

- `corepack pnpm ops:readiness`
- `corepack pnpm ops:evidence`

Observed result:

- `ops:readiness`: `36/36` missing
- `ops:evidence`: `0/110` complete

## Executive Finding

Readiness remains 0% because both scripts are environment-variable ledgers. They do not inspect the app implementation, existing reports, screenshots, tests, route behavior, database state, or files under `docs/e2e-evidence`.

`ops:readiness` checks 36 required launch-room variables in the current shell/CI environment. None are set, so every readiness item is missing.

`ops:evidence` checks `OPS_001_EVIDENCE` through `OPS_110_EVIDENCE` plus optional matching status variables in the current shell/CI environment. None are set, so every evidence task normalizes to `missing`.

## Direct Answers

1. Are these placeholders?
   Yes. `ops:readiness` explicitly calls `OPS_PHASE_0_EVIDENCE` through `OPS_PHASE_9_EVIDENCE` "phase evidence placeholders". `ops:evidence` treats every `OPS_###_EVIDENCE` value as an evidence pointer placeholder until populated.

2. Are these generated from configuration?
   Partly. The requirement lists are hard-coded in TypeScript scripts, with optional filtering from CLI/env config such as `--target`, `--phase`, `OPS_READINESS_TARGET`, and `OPS_READINESS_PHASE`. They are not generated from app modules or actual feature implementation.

3. Are they expecting files?
   Not directly. The scripts never open or validate evidence files. They expect env values that can point to files, launch-note anchors, tickets, screenshots, docs, channels, or URLs.

4. Are they expecting environment variables?
   Yes. This is the primary mechanism. Missing env vars are the exact reason the checks report 0%.

5. Are they disconnected from actual implementation?
   Yes. They are disconnected from runtime implementation status by design. They are operational launch gates. Passing tests, completed reports, local screenshots, and code fixes do not move the score unless someone exports the expected env variables with non-secret evidence pointers and accepted statuses.

## Script Behavior

### `ops:readiness`

Source:

- `package.json:26` runs `tsx scripts/ops-readiness.ts`.
- `scripts/ops-readiness.ts:63-158` defines the 36 default requirements.
- `scripts/ops-readiness.ts:358-362` groups the checks.
- `scripts/ops-readiness.ts:432-451` prints missing tasks and exits with code 1.

Default `--target=all --phase=all` requirement count:

- 11 owner slots
- 3 channels
- 1 alert destination, satisfied by either email or webhook
- 7 support/rollback/contact metadata values
- 4 target URLs
- 10 phase evidence placeholders

Validators reject empty values and placeholder-looking values such as `todo`, `tbd`, `changeme`, `placeholder`, `unknown`, and similar entries.

### `ops:evidence`

Source:

- `package.json:23` runs `node scripts/managed-ads-evidence.ts`.
- `scripts/managed-ads-evidence.ts:35-45` defines phases covering `OPS-001` through `OPS-110`.
- `scripts/managed-ads-evidence.ts:56-63` maps task numbers to env vars.
- `scripts/managed-ads-evidence.ts:70-80` normalizes missing env to `missing`.
- `scripts/managed-ads-evidence.ts:155-164` counts complete statuses.
- `docs/MANAGED_ADS_PRODUCTION_TASKS.md:54-218` defines the human-readable requirement, owner, and expected evidence for every OPS item.

Completion statuses are only:

- `local-complete`
- `evidence-captured`
- `go`

Open statuses are:

- `missing`
- `in-progress`
- `external-blocked`
- `no-go`

No `OPS_###_EVIDENCE` variables are present in the current shell, so every task defaults to `missing`.

## Why Existing Work Does Not Move The Score

Existing documents such as `docs/E2E_VALIDATION_REPORT.md`, `docs/LAUNCH_EVIDENCE_PACKAGE_R4.md`, and `docs/LAUNCH_READINESS_TRACKER_R4.md` are not read by either script.

The scripts also do not parse:

- test output
- Playwright screenshots
- API responses
- route availability
- Prisma migrations
- health checks
- Render config
- `.env.example`
- `render.yaml`

Those artifacts can be used as evidence, but only by exporting pointers into the expected env variables.

## Readiness Missing Items

| Item | Source | Requirement | Remediation | Owner |
| --- | --- | --- | --- | --- |
| `OPS_DEPLOY_OWNER` | `scripts/ops-readiness.ts:64`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:16` | Assign the production deploy owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_API_OWNER` | `scripts/ops-readiness.ts:65`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:17` | Assign the production API owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_WORKER_OWNER` | `scripts/ops-readiness.ts:66`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:18` | Assign the production worker owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_PAYMENTS_OWNER` | `scripts/ops-readiness.ts:67`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:19` | Assign the production payments owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_MEDIA_OWNER` | `scripts/ops-readiness.ts:68`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:20` | Assign the production media and Cloudinary owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_CAMPAIGN_OWNER` | `scripts/ops-readiness.ts:69`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:21` | Assign the production campaign operations owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_REPORT_QA_OWNER` | `scripts/ops-readiness.ts:70`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:23` | Assign the production report QA owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_SUPPORT_OWNER` | `scripts/ops-readiness.ts:71`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:22` | Assign the production support owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_CUSTOMER_COMMS_OWNER` | `scripts/ops-readiness.ts:72`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:24` | Assign the production customer communications owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_INCIDENT_COMMANDER` | `scripts/ops-readiness.ts:73`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:25` | Assign the launch incident commander. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_ROLLBACK_OWNER` | `scripts/ops-readiness.ts:74`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:26` | Assign the production rollback owner. | Set a real human name, not a placeholder. | Deploy owner / launch coordinator |
| `OPS_LAUNCH_CHANNEL` | `scripts/ops-readiness.ts:84` | Record the launch-room channel or URL. | Set a channel, email, or URL such as `#managed-ads-launch` or a launch-room link. | Deploy owner |
| `OPS_INCIDENT_CHANNEL` | `scripts/ops-readiness.ts:85` | Record the incident channel or URL. | Set a separate incident channel, email, or URL. | Incident commander |
| `OPS_SUPPORT_CHANNEL` | `scripts/ops-readiness.ts:86` | Record the customer support inbox or channel. | Set the staffed support inbox/channel reference. | Support owner |
| `OPS_ALERT_EMAIL` or `OPS_ALERT_WEBHOOK` | `scripts/ops-readiness.ts:78-80` | Configure an operational alert destination. | Set either an alert email or an absolute webhook URL. | API owner / Worker owner |
| `OPS_OWNER_ROSTER_URL` | `scripts/ops-readiness.ts:91-94`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:36-43` | Link the owner roster with backups and escalation handles. | Set a launch-note, doc, ticket, or roster URL. | Deploy owner |
| `OPS_LAUNCH_NOTES_URL` | `scripts/ops-readiness.ts:96-99`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:36-43` | Link the launch notes or go/no-go thread where evidence will be posted. | Set the canonical launch evidence thread/document link. | Deploy owner |
| `OPS_INCIDENT_RUNBOOK_URL` | `scripts/ops-readiness.ts:101-104`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:36-43` | Link the managed ads incident runbook. | Set the incident runbook doc/ticket/link. | Incident commander |
| `OPS_ROLLBACK_PLAN_URL` | `scripts/ops-readiness.ts:106-109`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:36-43` | Link the rollback plan with order, target commit, and reconciliation owner. | Set the rollback plan reference. | Rollback owner |
| `OPS_SUPPORT_CONTACT` | `scripts/ops-readiness.ts:111-114`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:36-43` | Record the staffed client support contact for launch. | Set a staffed support contact, channel, email, or URL. | Support owner |
| `OPS_ESCALATION_CONTACT` | `scripts/ops-readiness.ts:116-119`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:36-43` | Record the urgent escalation contact or group. | Set an escalation contact, group, channel, email, or URL. | Incident commander |
| `OPS_CONFIG_FREEZE_WINDOW` | `scripts/ops-readiness.ts:121-124`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:36-43` | Record the production config freeze window for launch. | Set a date/time window or launch-note reference. | Deploy owner |
| `APP_URL` | `scripts/ops-readiness.ts:129` | Set the production client app URL. | Export the absolute production web URL. | Deploy owner |
| `ADMIN_URL` | `scripts/ops-readiness.ts:130` | Set the production admin app URL. | Export the absolute production admin URL. | Deploy owner |
| `API_URL` | `scripts/ops-readiness.ts:131` | Set the server-side production API URL. | Export the absolute production API URL. | API owner |
| `NEXT_PUBLIC_API_URL` | `scripts/ops-readiness.ts:133-136` | Set the browser-facing production API URL. | Export the public API URL used by web/admin clients. | API owner |
| `OPS_PHASE_0_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 0 - Access and ownership. | Set a non-secret evidence pointer for phase 0. | Deploy owner |
| `OPS_PHASE_1_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 1 - Production environment. | Set a non-secret evidence pointer for phase 1. | Deploy owner |
| `OPS_PHASE_2_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 2 - Admin operations setup. | Set a non-secret evidence pointer for phase 2. | Campaign ops owner |
| `OPS_PHASE_3_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 3 - Client flow setup. | Set a non-secret evidence pointer for phase 3. | Support owner |
| `OPS_PHASE_4_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 4 - Manual launch accounts. | Set a non-secret evidence pointer or `external-blocked:meta,tiktok,pages`. | Campaign ops owner |
| `OPS_PHASE_5_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 5 - Payments and reconciliation. | Set a non-secret evidence pointer or `external-blocked:korapay,webhook,finance-approval`. | Payments owner |
| `OPS_PHASE_6_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 6 - Media and report evidence. | Set a non-secret evidence pointer or `external-blocked:cloudinary,external-proof-assets`. | Media owner |
| `OPS_PHASE_7_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 7 - Notifications and support. | Set a non-secret evidence pointer or `external-blocked:support-inbox,customer-comms,whatsapp`. | Support owner |
| `OPS_PHASE_8_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 8 - Monitoring and alerts. | Set a non-secret evidence pointer or `external-blocked:render,postgres,redis,korapay,cloudinary,paging`. | API owner |
| `OPS_PHASE_9_EVIDENCE` | `scripts/ops-readiness.ts:158-162`; `docs/MANAGED_ADS_PRODUCTION_TASKS.md:43` | Create a launch evidence placeholder for Phase 9 - Go/no-go and rollback. | Set a non-secret evidence pointer or `external-blocked:render,github,payment-approval,customer-comms,owner-signoff`. | Deploy owner |

## Evidence Missing Items

For every row below, the automation expects:

- `OPS_###_EVIDENCE`: non-secret proof pointer, launch-note anchor, ticket, screenshot bundle, command transcript location, or `external-blocked:<system>`.
- `OPS_###_STATUS`: optional status. To count complete, use `local-complete`, `evidence-captured`, or `go`. If omitted, a present evidence value counts as `evidence-captured`; no evidence value counts as `missing`.

| Item | Source | Requirement | Remediation | Owner |
| --- | --- | --- | --- | --- |
| OPS-001 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:54` | Confirm named humans for every owner slot above. | Capture "Owner list posted in launch channel." Set `OPS_001_EVIDENCE` and `OPS_001_STATUS`. | Deploy owner |
| OPS-002 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:55` | Confirm each owner has Render access for their surface. | Capture "Access check screenshot or confirmation." Set `OPS_002_EVIDENCE` and `OPS_002_STATUS`. | Deploy owner |
| OPS-003 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:56` | Confirm admin operators can sign into the admin app. | Capture "Test operator session recorded." Set `OPS_003_EVIDENCE` and `OPS_003_STATUS`. | Campaign ops owner |
| OPS-004 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:57` | Confirm operator roles map to admin route permissions. | Capture "Non-admin rejection and admin success verified." Set `OPS_004_EVIDENCE` and `OPS_004_STATUS`. | API owner |
| OPS-005 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:58` | Confirm finance/payment owner can view Korapay dashboard. | Capture "Dashboard access confirmed." Set `OPS_005_EVIDENCE` and `OPS_005_STATUS`. | Payments owner |
| OPS-006 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:59` | Confirm media owner can view Cloudinary media library. | Capture "Dashboard access confirmed." Set `OPS_006_EVIDENCE` and `OPS_006_STATUS`. | Media owner |
| OPS-007 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:60` | Confirm support owner has the production support inbox or support channel. | Capture "Inbox/channel URL posted in launch notes." Set `OPS_007_EVIDENCE` and `OPS_007_STATUS`. | Support owner |
| OPS-008 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:61` | Confirm rollback owner can trigger Render rollback for API, web, admin, and worker. | Capture "Dry-run plan acknowledged." Set `OPS_008_EVIDENCE` and `OPS_008_STATUS`. | Rollback owner |
| OPS-009 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:62` | Confirm launch channel exists and includes all owner slots. | Capture "Channel link captured." Set `OPS_009_EVIDENCE` and `OPS_009_STATUS`. | Deploy owner |
| OPS-010 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:63` | Confirm incident channel exists and is separate from ordinary launch chatter. | Capture "Channel link captured." Set `OPS_010_EVIDENCE` and `OPS_010_STATUS`. | Support owner |
| OPS-011 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:75` | Run managed ads rollout preflight for API. | Capture "Passing command output." Set `OPS_011_EVIDENCE` and `OPS_011_STATUS`. | API owner |
| OPS-012 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:76` | Run managed ads rollout preflight for worker. | Capture "Passing command output." Set `OPS_012_EVIDENCE` and `OPS_012_STATUS`. | Worker owner |
| OPS-013 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:77` | Run managed ads rollout preflight for web. | Capture "Passing command output." Set `OPS_013_EVIDENCE` and `OPS_013_STATUS`. | Deploy owner |
| OPS-014 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:78` | Run managed ads rollout preflight for admin. | Capture "Passing command output." Set `OPS_014_EVIDENCE` and `OPS_014_STATUS`. | Deploy owner |
| OPS-015 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:79` | Confirm `NODE_ENV=production` on API and worker. | Capture "Render env value confirmed." Set `OPS_015_EVIDENCE` and `OPS_015_STATUS`. | API owner |
| OPS-016 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:80` | Confirm `DATABASE_URL` and `REDIS_URL` point to production services. | Capture "Render env value confirmed without leaking secrets." Set `OPS_016_EVIDENCE` and `OPS_016_STATUS`. | API owner |
| OPS-017 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:81` | Confirm `STORAGE_PROVIDER=cloudinary`. | Capture "Render env value confirmed." Set `OPS_017_EVIDENCE` and `OPS_017_STATUS`. | Media owner |
| OPS-018 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:82` | Confirm `MEDIA_UPLOAD_ALLOW_MOCK_STORAGE` is unset or false. | Capture "Render env value confirmed." Set `OPS_018_EVIDENCE` and `OPS_018_STATUS`. | Media owner |
| OPS-019 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:83` | Confirm `PAYMENT_PROVIDER=live`. | Capture "Render env value confirmed." Set `OPS_019_EVIDENCE` and `OPS_019_STATUS`. | Payments owner |
| OPS-020 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:84` | Confirm `NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE` is unset or false. | Capture "Web/admin env confirmed." Set `OPS_020_EVIDENCE` and `OPS_020_STATUS`. | Deploy owner |
| OPS-021 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:85` | Confirm trusted auth header flags are false unless a trusted proxy boundary is live. | Capture "Preflight output captured." Set `OPS_021_EVIDENCE` and `OPS_021_STATUS`. | API owner |
| OPS-022 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:86` | Confirm no production wallet credits are seeded. | Capture "Seed/config review noted." Set `OPS_022_EVIDENCE` and `OPS_022_STATUS`. | Payments owner |
| OPS-023 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:87` | Confirm production database backup exists before deploy. | Capture "Backup/export reference captured." Set `OPS_023_EVIDENCE` and `OPS_023_STATUS`. | Deploy owner |
| OPS-024 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:88` | Confirm migration dry run has passed on disposable Postgres. | Capture "Dry-run output captured." Set `OPS_024_EVIDENCE` and `OPS_024_STATUS`. | API owner |
| OPS-025 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:89` | Confirm deployed commit SHA matches expected launch commit. | Capture "Commit SHA posted." Set `OPS_025_EVIDENCE` and `OPS_025_STATUS`. | Deploy owner |
| OPS-026 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:95` | Create the default campaign review operator roster. | Capture "Roster posted." Set `OPS_026_EVIDENCE` and `OPS_026_STATUS`. | Campaign ops owner |
| OPS-027 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:96` | Create assignment rules for operator, designer, finance, and reviewer roles. | Capture "Rules posted in runbook." Set `OPS_027_EVIDENCE` and `OPS_027_STATUS`. | Campaign ops owner |
| OPS-028 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:97` | Define unassigned queue SLA for new briefs. | Capture "SLA threshold posted." Set `OPS_028_EVIDENCE` and `OPS_028_STATUS`. | Campaign ops owner |
| OPS-029 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:98` | Define payment follow-up SLA for unpaid invoices. | Capture "SLA threshold posted." Set `OPS_029_EVIDENCE` and `OPS_029_STATUS`. | Payments owner |
| OPS-030 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:99` | Define report publication SLA after campaign completion. | Capture "SLA threshold posted." Set `OPS_030_EVIDENCE` and `OPS_030_STATUS`. | Campaign ops owner |
| OPS-031 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:100` | Confirm admin review queue defaults to unassigned or needs-action work. | Capture "Screenshot or route check." Set `OPS_031_EVIDENCE` and `OPS_031_STATUS`. | Campaign ops owner |
| OPS-032 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:101` | Confirm admin can claim or assign a campaign. | Capture "Test action recorded." Set `OPS_032_EVIDENCE` and `OPS_032_STATUS`. | Campaign ops owner |
| OPS-033 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:102` | Confirm admin can post internal-only notes. | Capture "Test note hidden from client." Set `OPS_033_EVIDENCE` and `OPS_033_STATUS`. | Campaign ops owner |
| OPS-034 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:103` | Confirm admin can post client-visible timeline updates. | Capture "Test update visible to client." Set `OPS_034_EVIDENCE` and `OPS_034_STATUS`. | Campaign ops owner |
| OPS-035 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:104` | Confirm admin can change every allowed campaign status. | Capture "Status matrix checked." Set `OPS_035_EVIDENCE` and `OPS_035_STATUS`. | Campaign ops owner |
| OPS-036 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:105` | Confirm destructive status changes require deliberate confirmation in UI. | Capture "UI check recorded." Set `OPS_036_EVIDENCE` and `OPS_036_STATUS`. | Campaign ops owner |
| OPS-037 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:106` | Confirm admin activity log records writes. | Capture "Audit entry IDs captured." Set `OPS_037_EVIDENCE` and `OPS_037_STATUS`. | API owner |
| OPS-038 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:107` | Confirm bulk admin actions have limits and clear failure behavior. | Capture "Manual test result." Set `OPS_038_EVIDENCE` and `OPS_038_STATUS`. | Campaign ops owner |
| OPS-039 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:108` | Confirm missing campaign detail IDs render a styled empty state. | Capture "Route check captured." Set `OPS_039_EVIDENCE` and `OPS_039_STATUS`. | Campaign ops owner |
| OPS-040 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:109` | Confirm mobile admin queue has card fallback and no horizontal scroll. | Capture "Mobile screenshot." Set `OPS_040_EVIDENCE` and `OPS_040_STATUS`. | Campaign ops owner |
| OPS-041 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:115` | Confirm public signup/login works on production web. | Capture "Test account created." Set `OPS_041_EVIDENCE` and `OPS_041_STATUS`. | API owner |
| OPS-042 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:116` | Confirm business profile can be completed. | Capture "Test profile ID captured." Set `OPS_042_EVIDENCE` and `OPS_042_STATUS`. | Support owner |
| OPS-043 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:117` | Confirm incomplete business profile blocks campaign submission. | Capture "UI check captured." Set `OPS_043_EVIDENCE` and `OPS_043_STATUS`. | Support owner |
| OPS-044 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:118` | Confirm campaign intake creates a draft or submitted campaign in production DB. | Capture "Campaign ID captured." Set `OPS_044_EVIDENCE` and `OPS_044_STATUS`. | API owner |
| OPS-045 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:119` | Confirm client sees post-submission confirmation and campaign detail. | Capture "Screenshot captured." Set `OPS_045_EVIDENCE` and `OPS_045_STATUS`. | Support owner |
| OPS-046 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:120` | Confirm client campaign list never shows raw IDs or internal terms. | Capture "UI check captured." Set `OPS_046_EVIDENCE` and `OPS_046_STATUS`. | Support owner |
| OPS-047 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:121` | Confirm client timeline shows only client-safe history and notes. | Capture "Client/admin comparison captured." Set `OPS_047_EVIDENCE` and `OPS_047_STATUS`. | API owner |
| OPS-048 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:122` | Confirm client reports list only published reports. | Capture "Unpublished report hidden." Set `OPS_048_EVIDENCE` and `OPS_048_STATUS`. | API owner |
| OPS-049 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:123` | Confirm client billing shows campaign-linked invoice context. | Capture "Invoice screenshot." Set `OPS_049_EVIDENCE` and `OPS_049_STATUS`. | Payments owner |
| OPS-050 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:124` | Confirm mobile bottom navigation does not obscure final page content. | Capture "Mobile screenshots." Set `OPS_050_EVIDENCE` and `OPS_050_STATUS`. | Support owner |
| OPS-051 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:134` | Confirm TikTok Ads Manager account access for operators. | Capture "Access confirmed." Set `OPS_051_EVIDENCE` and `OPS_051_STATUS`. | Campaign ops owner |
| OPS-052 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:135` | Confirm Meta Business/Ads Manager account access for operators. | Capture "Access confirmed." Set `OPS_052_EVIDENCE` and `OPS_052_STATUS`. | Campaign ops owner |
| OPS-053 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:136` | Confirm Instagram/Facebook page access for placements that need page context. | Capture "Access confirmed." Set `OPS_053_EVIDENCE` and `OPS_053_STATUS`. | Campaign ops owner |
| OPS-054 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:137` | Confirm naming convention for external campaigns. | Capture "Naming pattern posted." Set `OPS_054_EVIDENCE` and `OPS_054_STATUS`. | Campaign ops owner |
| OPS-055 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:138` | Confirm UTM/link tagging convention. | Capture "Tagging pattern posted." Set `OPS_055_EVIDENCE` and `OPS_055_STATUS`. | Campaign ops owner |
| OPS-056 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:139` | Confirm spend cap policy per campaign before launch. | Capture "Policy posted." Set `OPS_056_EVIDENCE` and `OPS_056_STATUS`. | Payments owner |
| OPS-057 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:140` | Confirm proof capture standard for each platform. | Capture "Proof examples posted." Set `OPS_057_EVIDENCE` and `OPS_057_STATUS`. | Media owner |
| OPS-058 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:141` | Confirm external platform policy rejection escalation path. | Capture "Escalation path posted." Set `OPS_058_EVIDENCE` and `OPS_058_STATUS`. | Campaign ops owner |
| OPS-059 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:142` | Confirm manual placement URL format and required fields. | Capture "Test placement saved." Set `OPS_059_EVIDENCE` and `OPS_059_STATUS`. | Campaign ops owner |
| OPS-060 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:143` | Confirm operator cannot mark a campaign live before proof/link policy is satisfied. | Capture "Manual checklist result." Set `OPS_060_EVIDENCE` and `OPS_060_STATUS`. | Campaign ops owner |
| OPS-061 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:149` | Create a Korapay payment intent from production web. | Capture "Reference captured." Set `OPS_061_EVIDENCE` and `OPS_061_STATUS`. | Payments owner |
| OPS-062 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:150` | Complete a small live or approved sandbox payment. | Capture "Provider status captured." Set `OPS_062_EVIDENCE` and `OPS_062_STATUS`. | Payments owner |
| OPS-063 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:151` | Confirm webhook credits wallet once. | Capture "Ledger entry captured." Set `OPS_063_EVIDENCE` and `OPS_063_STATUS`. | Payments owner |
| OPS-064 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:152` | Repeat webhook/verify and confirm no duplicate credit. | Capture "Idempotency result captured." Set `OPS_064_EVIDENCE` and `OPS_064_STATUS`. | Payments owner |
| OPS-065 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:153` | Confirm invoice payment links payment intent to invoice and campaign. | Capture "Invoice/payment IDs captured." Set `OPS_065_EVIDENCE` and `OPS_065_STATUS`. | Payments owner |
| OPS-066 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:154` | Confirm budget hold can be created from funded wallet. | Capture "Hold ID captured." Set `OPS_066_EVIDENCE` and `OPS_066_STATUS`. | Payments owner |
| OPS-067 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:155` | Confirm budget hold release restores available wallet balance. | Capture "Balance before/after captured." Set `OPS_067_EVIDENCE` and `OPS_067_STATUS`. | Payments owner |
| OPS-068 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:156` | Confirm budget hold capture creates spend/debit trail. | Capture "Ledger entry captured." Set `OPS_068_EVIDENCE` and `OPS_068_STATUS`. | Payments owner |
| OPS-069 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:157` | Confirm insufficient balance returns a clear error. | Capture "Error response captured." Set `OPS_069_EVIDENCE` and `OPS_069_STATUS`. | Payments owner |
| OPS-070 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:158` | Confirm refund/manual reversal playbook exists for failed launches. | Capture "Playbook link captured." Set `OPS_070_EVIDENCE` and `OPS_070_STATUS`. | Payments owner |
| OPS-071 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:164` | Upload a valid image asset through production web. | Capture "Asset ID and Cloudinary public ID captured." Set `OPS_071_EVIDENCE` and `OPS_071_STATUS`. | Media owner |
| OPS-072 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:165` | Upload a valid video asset through production web. | Capture "Asset ID and Cloudinary public ID captured." Set `OPS_072_EVIDENCE` and `OPS_072_STATUS`. | Media owner |
| OPS-073 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:166` | Attempt oversized upload and confirm client-side and API rejection. | Capture "Error screenshot/response." Set `OPS_073_EVIDENCE` and `OPS_073_STATUS`. | Media owner |
| OPS-074 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:167` | Attempt unsupported MIME type and confirm rejection. | Capture "Error screenshot/response." Set `OPS_074_EVIDENCE` and `OPS_074_STATUS`. | Media owner |
| OPS-075 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:168` | Confirm Cloudinary completion rejects invalid signatures. | Capture "API test or manual response captured." Set `OPS_075_EVIDENCE` and `OPS_075_STATUS`. | Media owner |
| OPS-076 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:169` | Confirm screenshot/proof assets can be marked client-visible. | Capture "Proof item captured." Set `OPS_076_EVIDENCE` and `OPS_076_STATUS`. | Campaign ops owner |
| OPS-077 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:170` | Confirm private proof assets are not visible to client unless marked visible. | Capture "Client/admin comparison captured." Set `OPS_077_EVIDENCE` and `OPS_077_STATUS`. | API owner |
| OPS-078 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:171` | Confirm report builder accepts metrics, summary, proofs, and next steps. | Capture "Draft report ID captured." Set `OPS_078_EVIDENCE` and `OPS_078_STATUS`. | Campaign ops owner |
| OPS-079 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:172` | Confirm report preview is reviewed before publish. | Capture "Reviewer approval captured." Set `OPS_079_EVIDENCE` and `OPS_079_STATUS`. | Campaign ops owner |
| OPS-080 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:173` | Confirm published report appears to client and triggers notification path if enabled. | Capture "Client screenshot." Set `OPS_080_EVIDENCE` and `OPS_080_STATUS`. | Support owner |
| OPS-081 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:179` | Confirm in-app notification list loads for client. | Capture "Route screenshot." Set `OPS_081_EVIDENCE` and `OPS_081_STATUS`. | Support owner |
| OPS-082 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:180` | Confirm in-app notification list loads for admin, if applicable. | Capture "Route screenshot." Set `OPS_082_EVIDENCE` and `OPS_082_STATUS`. | Support owner |
| OPS-083 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:181` | Confirm support inbox/channel route for new campaign questions. | Capture "Channel URL posted." Set `OPS_083_EVIDENCE` and `OPS_083_STATUS`. | Support owner |
| OPS-084 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:182` | Create canned response for brief received. | Capture "Template saved." Set `OPS_084_EVIDENCE` and `OPS_084_STATUS`. | Support owner |
| OPS-085 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:183` | Create canned response for invoice due. | Capture "Template saved." Set `OPS_085_EVIDENCE` and `OPS_085_STATUS`. | Support owner |
| OPS-086 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:184` | Create canned response for campaign live. | Capture "Template saved." Set `OPS_086_EVIDENCE` and `OPS_086_STATUS`. | Support owner |
| OPS-087 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:185` | Create canned response for report published. | Capture "Template saved." Set `OPS_087_EVIDENCE` and `OPS_087_STATUS`. | Support owner |
| OPS-088 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:186` | Create incident response for payment mismatch. | Capture "Template saved." Set `OPS_088_EVIDENCE` and `OPS_088_STATUS`. | Support owner |
| OPS-089 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:187` | Create incident response for external ad rejection. | Capture "Template saved." Set `OPS_089_EVIDENCE` and `OPS_089_STATUS`. | Support owner |
| OPS-090 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:188` | Confirm WhatsApp notification path is disabled unless provider is configured. | Capture "Env/config checked." Set `OPS_090_EVIDENCE` and `OPS_090_STATUS`. | Support owner |
| OPS-091 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:194` | Confirm Render API health alert. | Capture "Alert name captured." Set `OPS_091_EVIDENCE` and `OPS_091_STATUS`. | API owner |
| OPS-092 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:195` | Confirm Render worker restart alert. | Capture "Alert name captured." Set `OPS_092_EVIDENCE` and `OPS_092_STATUS`. | Worker owner |
| OPS-093 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:196` | Confirm Postgres capacity alert. | Capture "Alert name captured." Set `OPS_093_EVIDENCE` and `OPS_093_STATUS`. | Deploy owner |
| OPS-094 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:197` | Confirm Redis capacity/connection alert. | Capture "Alert name captured." Set `OPS_094_EVIDENCE` and `OPS_094_STATUS`. | Worker owner |
| OPS-095 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:198` | Confirm payment mismatch alert or manual daily reconciliation reminder. | Capture "Alert/reminder captured." Set `OPS_095_EVIDENCE` and `OPS_095_STATUS`. | Payments owner |
| OPS-096 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:199` | Confirm queue depth alert or manual queue check cadence. | Capture "Alert/reminder captured." Set `OPS_096_EVIDENCE` and `OPS_096_STATUS`. | Worker owner |
| OPS-097 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:200` | Confirm failed upload alert or manual media error review cadence. | Capture "Alert/reminder captured." Set `OPS_097_EVIDENCE` and `OPS_097_STATUS`. | Media owner |
| OPS-098 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:201` | Confirm 5xx API error review cadence. | Capture "Dashboard/log filter captured." Set `OPS_098_EVIDENCE` and `OPS_098_STATUS`. | API owner |
| OPS-099 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:202` | Confirm deploy failure notification reaches launch channel. | Capture "Test alert captured." Set `OPS_099_EVIDENCE` and `OPS_099_STATUS`. | Deploy owner |
| OPS-100 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:203` | Confirm incident owner can page or contact all other owner slots. | Capture "Contact path confirmed." Set `OPS_100_EVIDENCE` and `OPS_100_STATUS`. | Support owner |
| OPS-101 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:209` | Run one complete production smoke campaign from signup to report publish. | Capture "Smoke campaign ID captured." Set `OPS_101_EVIDENCE` and `OPS_101_STATUS`. | Deploy owner |
| OPS-102 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:210` | Confirm no client-facing screen shows demo/fallback/raw error markers. | Capture "UI audit and screenshots." Set `OPS_102_EVIDENCE` and `OPS_102_STATUS`. | Support owner |
| OPS-103 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:211` | Confirm admin screens are styled and usable on desktop. | Capture "Screenshots captured." Set `OPS_103_EVIDENCE` and `OPS_103_STATUS`. | Campaign ops owner |
| OPS-104 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:212` | Confirm client surfaces are usable at 375px mobile width. | Capture "Screenshots captured." Set `OPS_104_EVIDENCE` and `OPS_104_STATUS`. | Support owner |
| OPS-105 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:213` | Confirm rollback target commit/deploy is known. | Capture "Rollback target posted." Set `OPS_105_EVIDENCE` and `OPS_105_STATUS`. | Rollback owner |
| OPS-106 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:214` | Confirm rollback order for web, admin, API, and worker. | Capture "Order posted." Set `OPS_106_EVIDENCE` and `OPS_106_STATUS`. | Rollback owner |
| OPS-107 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:215` | Confirm data reconciliation plan after rollback. | Capture "Plan posted." Set `OPS_107_EVIDENCE` and `OPS_107_STATUS`. | Payments owner |
| OPS-108 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:216` | Confirm customer messaging plan for rollback or delayed launches. | Capture "Template posted." Set `OPS_108_EVIDENCE` and `OPS_108_STATUS`. | Support owner |
| OPS-109 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:217` | Confirm final go/no-go signoff from every owner slot. | Capture "Signoff thread captured." Set `OPS_109_EVIDENCE` and `OPS_109_STATUS`. | Deploy owner |
| OPS-110 | `docs/MANAGED_ADS_PRODUCTION_TASKS.md:218` | Freeze production config changes during launch window unless approved by deploy owner. | Capture "Freeze notice posted." Set `OPS_110_EVIDENCE` and `OPS_110_STATUS`. | Deploy owner |

## Disconnection From Implementation

The readiness system is useful as an operational ledger, but it is disconnected from actual implementation in these precise ways:

- It does not scan existing evidence reports.
- It does not detect screenshots.
- It does not run E2E journeys.
- It does not inspect routes, controllers, database rows, migrations, or provider configuration files.
- It does not read `.env.example` or `render.yaml`.
- It does not convert local test passes into `local-complete`.
- It does not convert blocker documents into `external-blocked`.

That means the repository can contain a real implementation and still report 0% readiness until the launch shell or CI job exports the expected variables.

## Recommended Remediation Model

Use one canonical launch env file or CI variable group for non-secret readiness pointers only.

Minimum readiness unblock:

```powershell
$env:OPS_DEPLOY_OWNER="Named Human"
$env:OPS_API_OWNER="Named Human"
$env:OPS_WORKER_OWNER="Named Human"
$env:OPS_PAYMENTS_OWNER="Named Human"
$env:OPS_MEDIA_OWNER="Named Human"
$env:OPS_CAMPAIGN_OWNER="Named Human"
$env:OPS_REPORT_QA_OWNER="Named Human"
$env:OPS_SUPPORT_OWNER="Named Human"
$env:OPS_CUSTOMER_COMMS_OWNER="Named Human"
$env:OPS_INCIDENT_COMMANDER="Named Human"
$env:OPS_ROLLBACK_OWNER="Named Human"
$env:OPS_LAUNCH_CHANNEL="#managed-ads-launch"
$env:OPS_INCIDENT_CHANNEL="#managed-ads-incident"
$env:OPS_SUPPORT_CHANNEL="support@example.com"
$env:OPS_ALERT_EMAIL="alerts@example.com"
$env:OPS_OWNER_ROSTER_URL="launch-notes#owner-roster"
$env:OPS_LAUNCH_NOTES_URL="launch-notes"
$env:OPS_INCIDENT_RUNBOOK_URL="docs/MANAGED_ADS_MONITORING_RUNBOOK.md"
$env:OPS_ROLLBACK_PLAN_URL="launch-notes#rollback"
$env:OPS_SUPPORT_CONTACT="support@example.com"
$env:OPS_ESCALATION_CONTACT="#managed-ads-incident"
$env:OPS_CONFIG_FREEZE_WINDOW="2026-06-05T00:00Z/2026-06-06T00:00Z"
$env:APP_URL="https://app.example.com"
$env:ADMIN_URL="https://admin.example.com"
$env:API_URL="https://api.example.com"
$env:NEXT_PUBLIC_API_URL="https://api.example.com"
```

Then set each `OPS_PHASE_N_EVIDENCE` and task-level `OPS_###_EVIDENCE` to the actual launch-note anchors, screenshot bundles, command transcript references, or explicit `external-blocked:<system>` markers.

## Bottom Line

Readiness remains 0% because the automation is not connected to the evidence already produced in the repo. It is waiting for a launch operator or CI environment to populate 36 readiness variables and 110 task evidence variables. Until those environment variables exist in the process that runs the commands, the scripts will continue to report `36/36 missing` and `0/110 complete`.
