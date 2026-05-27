# Managed Ads Production Task Inventory

This inventory turns the final operational setup work into concrete tasks for the managed ads MVP. The app is a human-in-the-loop service: internal staff launch campaigns manually in external Ads Manager dashboards, while Fliptrybe stores briefs, assets, invoices, wallet state, manual placements, proofs, metrics, reports, notes, and audit history.

Use this file before every production launch window. A task is not done until the evidence column has been captured in the launch notes or incident channel.

For daily standups and launch-room reporting, use
`docs/MANAGED_ADS_LAUNCH_TRACKER.md`. It groups these tasks into phase gates,
marks local/code-complete evidence separately from external credential blockers,
and gives the team a concise status table without reading the full inventory.

## Owner Map

| Owner Slot | Responsibility | Required Before Launch |
| --- | --- | --- |
| Deploy owner | Owns release timing, Render deploy state, rollback trigger, and final go/no-go call. | `OPS_DEPLOY_OWNER` |
| API owner | Owns API health, auth/session behavior, route protection, logs, and production errors. | `OPS_API_OWNER` |
| Worker owner | Owns queues, worker deploy, retries, dead-letter handling, and queue depth. | `OPS_WORKER_OWNER` |
| Payments owner | Owns Korapay, wallet ledger, invoices, budget holds, refunds, and reconciliation. | `OPS_PAYMENTS_OWNER` |
| Media owner | Owns Cloudinary, asset validation, proof uploads, storage privacy, and CDN access. | `OPS_MEDIA_OWNER` |
| Campaign ops owner | Owns review queue, assignments, manual launch checklist, proof requirements, and completion criteria. | `OPS_CAMPAIGN_OWNER` |
| Support owner | Owns client comms, support inbox, escalation templates, and incident messaging. | `OPS_SUPPORT_OWNER` |
| Report QA owner | Owns final report review, metric/source checks, proof visibility, and correction workflow. | `OPS_REPORT_QA_OWNER` |
| Customer comms owner | Owns launch announcements, broad customer incident language, and proactive status templates. | `OPS_CUSTOMER_COMMS_OWNER` |
| Incident commander | Owns incident coordination when delivery, data integrity, money state, or reporting may be wrong. | `OPS_INCIDENT_COMMANDER` |
| Rollback owner | Owns rollback decision, rollback execution, and post-rollback reconciliation. | `OPS_ROLLBACK_OWNER` |

## Phase 0 - Access And Ownership

External blockers for this phase are Render access, GitHub auth or repo access
for release owners, Korapay dashboard access, Cloudinary dashboard access, and
support channel access. Local evidence is limited to owner names, route checks,
channel links, and documented rollback responsibilities.

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-001 | Confirm named humans for every owner slot above. | Deploy owner | Owner list posted in launch channel. |
| OPS-002 | Confirm each owner has Render access for their surface. | Deploy owner | Access check screenshot or confirmation. |
| OPS-003 | Confirm admin operators can sign into the admin app. | Campaign ops owner | Test operator session recorded. |
| OPS-004 | Confirm operator roles map to admin route permissions. | API owner | Non-admin rejection and admin success verified. |
| OPS-005 | Confirm finance/payment owner can view Korapay dashboard. | Payments owner | Dashboard access confirmed. |
| OPS-006 | Confirm media owner can view Cloudinary media library. | Media owner | Dashboard access confirmed. |
| OPS-007 | Confirm support owner has the production support inbox or support channel. | Support owner | Inbox/channel URL posted in launch notes. |
| OPS-008 | Confirm rollback owner can trigger Render rollback for API, web, admin, and worker. | Rollback owner | Dry-run plan acknowledged. |
| OPS-009 | Confirm launch channel exists and includes all owner slots. | Deploy owner | Channel link captured. |
| OPS-010 | Confirm incident channel exists and is separate from ordinary launch chatter. | Support owner | Channel link captured. |

## Phase 1 - Production Environment

Local/code-complete evidence for this phase is the strict rollout check output,
expected commit SHA, migration dry-run output, production env review, and backup
reference. External blockers are Render service access, production data service
access, GitHub deploy provenance, Korapay live env values, and Cloudinary live
env values.

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-011 | Run managed ads rollout preflight for API. | API owner | Passing command output. |
| OPS-012 | Run managed ads rollout preflight for worker. | Worker owner | Passing command output. |
| OPS-013 | Run managed ads rollout preflight for web. | Deploy owner | Passing command output. |
| OPS-014 | Run managed ads rollout preflight for admin. | Deploy owner | Passing command output. |
| OPS-015 | Confirm `NODE_ENV=production` on API and worker. | API owner | Render env value confirmed. |
| OPS-016 | Confirm `DATABASE_URL` and `REDIS_URL` point to production services. | API owner | Render env value confirmed without leaking secrets. |
| OPS-017 | Confirm `STORAGE_PROVIDER=cloudinary`. | Media owner | Render env value confirmed. |
| OPS-018 | Confirm `MEDIA_UPLOAD_ALLOW_MOCK_STORAGE` is unset or false. | Media owner | Render env value confirmed. |
| OPS-019 | Confirm `PAYMENT_PROVIDER=live`. | Payments owner | Render env value confirmed. |
| OPS-020 | Confirm `NEXT_PUBLIC_SHOW_DATA_SOURCE_BADGE` is unset or false. | Deploy owner | Web/admin env confirmed. |
| OPS-021 | Confirm trusted auth header flags are false unless a trusted proxy boundary is live. | API owner | Preflight output captured. |
| OPS-022 | Confirm no production wallet credits are seeded. | Payments owner | Seed/config review noted. |
| OPS-023 | Confirm production database backup exists before deploy. | Deploy owner | Backup/export reference captured. |
| OPS-024 | Confirm migration dry run has passed on disposable Postgres. | API owner | Dry-run output captured. |
| OPS-025 | Confirm deployed commit SHA matches expected launch commit. | Deploy owner | Commit SHA posted. |

## Phase 2 - Admin Operations Setup

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-026 | Create the default campaign review operator roster. | Campaign ops owner | Roster posted. |
| OPS-027 | Create assignment rules for operator, designer, finance, and reviewer roles. | Campaign ops owner | Rules posted in runbook. |
| OPS-028 | Define unassigned queue SLA for new briefs. | Campaign ops owner | SLA threshold posted. |
| OPS-029 | Define payment follow-up SLA for unpaid invoices. | Payments owner | SLA threshold posted. |
| OPS-030 | Define report publication SLA after campaign completion. | Campaign ops owner | SLA threshold posted. |
| OPS-031 | Confirm admin review queue defaults to unassigned or needs-action work. | Campaign ops owner | Screenshot or route check. |
| OPS-032 | Confirm admin can claim or assign a campaign. | Campaign ops owner | Test action recorded. |
| OPS-033 | Confirm admin can post internal-only notes. | Campaign ops owner | Test note hidden from client. |
| OPS-034 | Confirm admin can post client-visible timeline updates. | Campaign ops owner | Test update visible to client. |
| OPS-035 | Confirm admin can change every allowed campaign status. | Campaign ops owner | Status matrix checked. |
| OPS-036 | Confirm destructive status changes require deliberate confirmation in UI. | Campaign ops owner | UI check recorded. |
| OPS-037 | Confirm admin activity log records writes. | API owner | Audit entry IDs captured. |
| OPS-038 | Confirm bulk admin actions have limits and clear failure behavior. | Campaign ops owner | Manual test result. |
| OPS-039 | Confirm missing campaign detail IDs render a styled empty state. | Campaign ops owner | Route check captured. |
| OPS-040 | Confirm mobile admin queue has card fallback and no horizontal scroll. | Campaign ops owner | Mobile screenshot. |

## Phase 3 - Client Flow Setup

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-041 | Confirm public signup/login works on production web. | API owner | Test account created. |
| OPS-042 | Confirm business profile can be completed. | Support owner | Test profile ID captured. |
| OPS-043 | Confirm incomplete business profile blocks campaign submission. | Support owner | UI check captured. |
| OPS-044 | Confirm campaign intake creates a draft or submitted campaign in production DB. | API owner | Campaign ID captured. |
| OPS-045 | Confirm client sees post-submission confirmation and campaign detail. | Support owner | Screenshot captured. |
| OPS-046 | Confirm client campaign list never shows raw IDs or internal terms. | Support owner | UI check captured. |
| OPS-047 | Confirm client timeline shows only client-safe history and notes. | API owner | Client/admin comparison captured. |
| OPS-048 | Confirm client reports list only published reports. | API owner | Unpublished report hidden. |
| OPS-049 | Confirm client billing shows campaign-linked invoice context. | Payments owner | Invoice screenshot. |
| OPS-050 | Confirm mobile bottom navigation does not obscure final page content. | Support owner | Mobile screenshots. |

## Phase 4 - Manual Launch Accounts

This phase cannot be closed from the local codebase alone. It requires Meta,
TikTok, Instagram/Facebook page, and external Ads Manager access evidence from
the campaign operations owner.

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-051 | Confirm TikTok Ads Manager account access for operators. | Campaign ops owner | Access confirmed. |
| OPS-052 | Confirm Meta Business/Ads Manager account access for operators. | Campaign ops owner | Access confirmed. |
| OPS-053 | Confirm Instagram/Facebook page access for placements that need page context. | Campaign ops owner | Access confirmed. |
| OPS-054 | Confirm naming convention for external campaigns. | Campaign ops owner | Naming pattern posted. |
| OPS-055 | Confirm UTM/link tagging convention. | Campaign ops owner | Tagging pattern posted. |
| OPS-056 | Confirm spend cap policy per campaign before launch. | Payments owner | Policy posted. |
| OPS-057 | Confirm proof capture standard for each platform. | Media owner | Proof examples posted. |
| OPS-058 | Confirm external platform policy rejection escalation path. | Campaign ops owner | Escalation path posted. |
| OPS-059 | Confirm manual placement URL format and required fields. | Campaign ops owner | Test placement saved. |
| OPS-060 | Confirm operator cannot mark a campaign live before proof/link policy is satisfied. | Campaign ops owner | Manual checklist result. |

## Phase 5 - Payments And Reconciliation

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-061 | Create a Korapay payment intent from production web. | Payments owner | Reference captured. |
| OPS-062 | Complete a small live or approved sandbox payment. | Payments owner | Provider status captured. |
| OPS-063 | Confirm webhook credits wallet once. | Payments owner | Ledger entry captured. |
| OPS-064 | Repeat webhook/verify and confirm no duplicate credit. | Payments owner | Idempotency result captured. |
| OPS-065 | Confirm invoice payment links payment intent to invoice and campaign. | Payments owner | Invoice/payment IDs captured. |
| OPS-066 | Confirm budget hold can be created from funded wallet. | Payments owner | Hold ID captured. |
| OPS-067 | Confirm budget hold release restores available wallet balance. | Payments owner | Balance before/after captured. |
| OPS-068 | Confirm budget hold capture creates spend/debit trail. | Payments owner | Ledger entry captured. |
| OPS-069 | Confirm insufficient balance returns a clear error. | Payments owner | Error response captured. |
| OPS-070 | Confirm refund/manual reversal playbook exists for failed launches. | Payments owner | Playbook link captured. |

## Phase 6 - Media And Report Evidence

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-071 | Upload a valid image asset through production web. | Media owner | Asset ID and Cloudinary public ID captured. |
| OPS-072 | Upload a valid video asset through production web. | Media owner | Asset ID and Cloudinary public ID captured. |
| OPS-073 | Attempt oversized upload and confirm client-side and API rejection. | Media owner | Error screenshot/response. |
| OPS-074 | Attempt unsupported MIME type and confirm rejection. | Media owner | Error screenshot/response. |
| OPS-075 | Confirm Cloudinary completion rejects invalid signatures. | Media owner | API test or manual response captured. |
| OPS-076 | Confirm screenshot/proof assets can be marked client-visible. | Campaign ops owner | Proof item captured. |
| OPS-077 | Confirm private proof assets are not visible to client unless marked visible. | API owner | Client/admin comparison captured. |
| OPS-078 | Confirm report builder accepts metrics, summary, proofs, and next steps. | Campaign ops owner | Draft report ID captured. |
| OPS-079 | Confirm report preview is reviewed before publish. | Campaign ops owner | Reviewer approval captured. |
| OPS-080 | Confirm published report appears to client and triggers notification path if enabled. | Support owner | Client screenshot. |

## Phase 7 - Notifications And Support

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-081 | Confirm in-app notification list loads for client. | Support owner | Route screenshot. |
| OPS-082 | Confirm in-app notification list loads for admin, if applicable. | Support owner | Route screenshot. |
| OPS-083 | Confirm support inbox/channel route for new campaign questions. | Support owner | Channel URL posted. |
| OPS-084 | Create canned response for brief received. | Support owner | Template saved. |
| OPS-085 | Create canned response for invoice due. | Support owner | Template saved. |
| OPS-086 | Create canned response for campaign live. | Support owner | Template saved. |
| OPS-087 | Create canned response for report published. | Support owner | Template saved. |
| OPS-088 | Create incident response for payment mismatch. | Support owner | Template saved. |
| OPS-089 | Create incident response for external ad rejection. | Support owner | Template saved. |
| OPS-090 | Confirm WhatsApp notification path is disabled unless provider is configured. | Support owner | Env/config checked. |

## Phase 8 - Monitoring And Alerts

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-091 | Confirm Render API health alert. | API owner | Alert name captured. |
| OPS-092 | Confirm Render worker restart alert. | Worker owner | Alert name captured. |
| OPS-093 | Confirm Postgres capacity alert. | Deploy owner | Alert name captured. |
| OPS-094 | Confirm Redis capacity/connection alert. | Worker owner | Alert name captured. |
| OPS-095 | Confirm payment mismatch alert or manual daily reconciliation reminder. | Payments owner | Alert/reminder captured. |
| OPS-096 | Confirm queue depth alert or manual queue check cadence. | Worker owner | Alert/reminder captured. |
| OPS-097 | Confirm failed upload alert or manual media error review cadence. | Media owner | Alert/reminder captured. |
| OPS-098 | Confirm 5xx API error review cadence. | API owner | Dashboard/log filter captured. |
| OPS-099 | Confirm deploy failure notification reaches launch channel. | Deploy owner | Test alert captured. |
| OPS-100 | Confirm incident owner can page or contact all other owner slots. | Support owner | Contact path confirmed. |

## Phase 9 - Go/No-Go And Rollback

| ID | Task | Owner Slot | Evidence |
| --- | --- | --- | --- |
| OPS-101 | Run one complete production smoke campaign from signup to report publish. | Deploy owner | Smoke campaign ID captured. |
| OPS-102 | Confirm no client-facing screen shows demo/fallback/raw error markers. | Support owner | UI audit and screenshots. |
| OPS-103 | Confirm admin screens are styled and usable on desktop. | Campaign ops owner | Screenshots captured. |
| OPS-104 | Confirm client surfaces are usable at 375px mobile width. | Support owner | Screenshots captured. |
| OPS-105 | Confirm rollback target commit/deploy is known. | Rollback owner | Rollback target posted. |
| OPS-106 | Confirm rollback order for web, admin, API, and worker. | Rollback owner | Order posted. |
| OPS-107 | Confirm data reconciliation plan after rollback. | Payments owner | Plan posted. |
| OPS-108 | Confirm customer messaging plan for rollback or delayed launches. | Support owner | Template posted. |
| OPS-109 | Confirm final go/no-go signoff from every owner slot. | Deploy owner | Signoff thread captured. |
| OPS-110 | Freeze production config changes during launch window unless approved by deploy owner. | Deploy owner | Freeze notice posted. |

## Daily Operating Cadence

| Time Window | Task | Primary Owner |
| --- | --- | --- |
| Start of day | Review new briefs, unassigned campaigns, overdue invoices, failed payments, failed uploads, queue depth, and open support items. | Campaign ops owner |
| Midday | Reconcile launched campaigns against external Ads Manager status, spend caps, proofs, and client-visible timeline updates. | Campaign ops owner |
| End of day | Publish eligible reports, close completed campaigns, reconcile wallet/payment deltas, and post ops summary. | Deploy owner |
| Incident | Open incident channel, assign incident commander, freeze risky writes if needed, communicate client impact, then execute rollback or repair. | Support owner |

## Launch Notes Template

```text
Date:
Commit:
Deploy owner:
API owner:
Worker owner:
Payments owner:
Media owner:
Campaign ops owner:
Support owner:
Rollback owner:

Preflight:
- API:
- Worker:
- Web:
- Admin:

Smoke campaign:
- Workspace:
- Campaign:
- Invoice:
- Payment:
- Media asset:
- Manual placement:
- Report:

Known risks:
- 

Go/no-go:
- Deploy:
- API:
- Worker:
- Payments:
- Media:
- Campaign ops:
- Support:
- Rollback:
```
