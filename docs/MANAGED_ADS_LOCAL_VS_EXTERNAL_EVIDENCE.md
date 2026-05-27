# Managed Ads Local Vs External Evidence

Use this matrix with `corepack pnpm ops:evidence` and the launch tracker when
the team needs to separate repo-runnable proof from evidence that must stay
`External blocked` until a named human with credentials captures it. Do not put
secrets, tokens, database URLs, payment keys, upload signatures, or dashboard
session details in evidence variables.

## Evidence Status Values

Recommended phase and task status values:

| Status | Use When |
| --- | --- |
| `missing` | No task-level evidence has been collected. |
| `not-started` | No phase-level evidence has been collected. |
| `in-progress` | Owner is actively running local checks or gathering proof. |
| `local-complete` | Repo-runnable checks, local app behavior, or non-secret config review is complete. |
| `external-blocked` | The remaining evidence requires provider credentials, production dashboards, approvals, or live account state. |
| `evidence-captured` | Required proof has been posted to the launch notes or evidence packet. |
| `go` | Phase owner accepts the evidence for launch. |
| `no-go` | Phase blocks launch until the named blocker clears. |

Recommended no-secret variables for the evidence script:

| Variable | Suggested Values |
| --- | --- |
| `OPS_PHASE_0_STATUS` - `OPS_PHASE_9_STATUS` | One status value from the table above. |
| `OPS_PHASE_0_EVIDENCE` - `OPS_PHASE_9_EVIDENCE` | Launch-note URL, ticket URL, doc anchor, screenshot bundle URL, or `external-blocked:<system>`. |
| `OPS_001_STATUS` - `OPS_110_STATUS` | Optional task-level status using the same status values. |
| `OPS_001_EVIDENCE` - `OPS_110_EVIDENCE` | Optional task-level non-secret evidence pointer or `external-blocked:<system>`. |
| `OPS_EXTERNAL_BLOCKERS` | Comma-separated systems such as `render,github,korapay,cloudinary,meta,tiktok,support-inbox`. |
| `OPS_LAUNCH_NOTES_URL` | Canonical launch evidence thread or notes document. |
| `OPS_OWNER_ROSTER_URL` | Owner roster with escalation handles. |

## Classification Matrix

| Phase | OPS IDs | Repo-Runnable / Local Checks | External / Human Checks That Stay Blocked Without Credentials | Suggested Evidence Script Values |
| --- | --- | --- | --- | --- |
| 0. Access and ownership | OPS-001 - OPS-010 | Owner roster URL, launch and incident channel references, admin route permission checks, rollback responsibility doc. | Render access for owners, GitHub/repo access, Korapay dashboard access, Cloudinary dashboard access, support inbox access, real operator admin login. | `OPS_PHASE_0_STATUS=local-complete` once roster/routes/channels are documented; use `external-blocked:render,github,korapay,cloudinary,support-inbox` until access proof is captured. |
| 1. Production environment | OPS-011 - OPS-025 | Rollout/preflight command output for API, worker, web, admin; strict env policy review without values; no demo/mock flag checks; migration dry-run output; expected commit SHA. | Render service/env dashboard confirmation, production Postgres/Redis target confirmation, GitHub deploy provenance, production backup/export reference, Korapay live mode, Cloudinary live storage config. | `OPS_PHASE_1_STATUS=local-complete` after preflight/dry-run/commit proof; use `external-blocked:render,postgres,redis,github,korapay,cloudinary` for dashboard-only proof. |
| 2. Admin operations setup | OPS-026 - OPS-040 | Roster/rules/SLA docs, admin queue route checks, allowed status matrix, notes visibility checks, audit-log IDs from a test environment, empty-state and mobile screenshots. | Production admin credentials for named operators, operations-lead approval of roster/rules, production write checks by real operators. | `OPS_PHASE_2_STATUS=local-complete` when local/admin test evidence is posted; use `external-blocked:admin-credentials,ops-approval` for production operator proof. |
| 3. Client flow setup | OPS-041 - OPS-050 | Signup/login flow in allowed environment, business profile completion, incomplete-profile gate, intake draft/submitted campaign ID, client-safe campaign/timeline/report visibility checks, mobile screenshots. | Approved production client account, verified launch contact details, production billing contact validation, any live customer-facing confirmation. | `OPS_PHASE_3_STATUS=local-complete` after app-flow screenshots/IDs; use `external-blocked:client-account,billing-contact` until approved production account evidence exists. |
| 4. Manual launch accounts | OPS-051 - OPS-060 | Naming convention, UTM/link tagging convention, spend cap policy, proof capture standard, policy escalation doc, placement URL field format, live-before-proof checklist behavior. | TikTok Ads Manager access, Meta Business/Ads Manager access, Instagram/Facebook page access, ad account/page context, real platform policy escalation path, external proof examples from launch accounts. | This phase usually remains `OPS_PHASE_4_STATUS=external-blocked` without ad-platform credentials; set evidence to `external-blocked:meta,tiktok,pages`. |
| 5. Payments and reconciliation | OPS-061 - OPS-070 | Payment intent flow in approved non-live mode, webhook/idempotency tests, invoice-to-campaign link, wallet hold/release/capture behavior, insufficient balance error, refund/reversal playbook link. | Korapay live or approved sandbox dashboard status, webhook endpoint access, provider transaction reference, treasury/bank details, finance approver signoff, real reconciliation proof. | `OPS_PHASE_5_STATUS=local-complete` after local/sandbox-safe money-state tests; use `external-blocked:korapay,webhook,finance-approval` for provider and approval proof. |
| 6. Media and report evidence | OPS-071 - OPS-080 | Image/video upload behavior in configured environment, oversized and unsupported MIME rejection, invalid signature rejection, proof visibility checks, report draft/preview/publish flow, client published-report screenshot. | Cloudinary dashboard/library access, production upload preset/secrets confirmation, provider asset public IDs, proof assets from real external launches if required. | `OPS_PHASE_6_STATUS=local-complete` after validation/proof/report checks; use `external-blocked:cloudinary,external-proof-assets` for dashboard or real-launch proof. |
| 7. Notifications and support | OPS-081 - OPS-090 | In-app notification route screenshots, support channel route/reference, canned response docs, incident templates, disabled-provider config evidence for WhatsApp when not configured. | Support inbox access, customer comms approval, WhatsApp/provider account access if enabled, proof that staffed humans receive and can answer live messages. | `OPS_PHASE_7_STATUS=local-complete` after routes/templates/provider-disabled proof; use `external-blocked:support-inbox,customer-comms,whatsapp` for live channel proof. |
| 8. Monitoring and alerts | OPS-091 - OPS-100 | Alert inventory names, log filter names, manual review cadence docs, deploy notification test plan, owner contact/page path, local/API health and worker log evidence where available. | Render alert configuration, Postgres/Redis capacity dashboards, Korapay/payment alert source, Cloudinary usage/error views, provider incident/alert routing, actual page/contact test. | `OPS_PHASE_8_STATUS=local-complete` after runbook/filter/cadence proof; use `external-blocked:render,postgres,redis,korapay,cloudinary,paging` for dashboard alert proof. |
| 9. Go/no-go and rollback | OPS-101 - OPS-110 | Smoke checklist and IDs from allowed environment, UI audit screenshots, rollback target/order docs, reconciliation plan, customer messaging template, config freeze notice, signoff thread template. | Render rollback permission, GitHub deploy provenance, production smoke on live services, payment reconciliation approval, customer comms approval, final owner signoff. | `OPS_PHASE_9_STATUS=local-complete` after docs/templates/non-live smoke proof; use `external-blocked:render,github,payment-approval,customer-comms,owner-signoff` until final human approvals land. |

## Task-Level Notes

For OPS-001 through OPS-110, prefer task-level overrides only when a phase is
mixed. Example: Phase 5 can have `OPS_064_STATUS=local-complete` for
duplicate webhook idempotency while `OPS_062_STATUS=external-blocked`
waits for Korapay live or approved sandbox payment evidence.

Keep evidence values as pointers, not payloads. A good value is a launch-note
anchor, ticket, screenshot bundle, command transcript location, or
`external-blocked:<system>`. A bad value is a secret, token, raw connection
string, private payment payload, provider signature, or dashboard cookie.
