# Managed Ads Launch Phase Tracker

Use this tracker for daily launch standups. Keep the full task inventory in
`docs/MANAGED_ADS_PRODUCTION_TASKS.md` as the source of truth, but report from
this file so the team can see what is locally complete, what still needs
external access, and what evidence is missing.

## Status Key

| Status | Meaning |
| --- | --- |
| Not started | No owner has begun evidence collection. |
| In progress | Owner is actively collecting evidence or resolving blockers. |
| Local complete | Code, config, or repo-side checks are complete; external proof may still be needed. |
| External blocked | Waiting on dashboard credentials, provider account access, approval, or live provider state. |
| Evidence captured | Required proof is posted in the launch notes or incident channel. |
| Go | Phase is signed off for launch. |
| No-go | Phase blocks launch until the named owner clears it. |

## Phase Board

| Phase | Task IDs | Primary Owners | Launch Gate | Local/Code-Complete Evidence | External Blockers To Clear |
| --- | --- | --- | --- | --- | --- |
| 0. Access and ownership | OPS-001 - OPS-010 | Deploy owner, Support owner, Campaign ops owner | Every owner slot has a named human, backup, channel, and escalation path. | Owner map filled in; launch and incident channels created; admin route permission checks recorded. | Render access, GitHub auth or repo access for release owners, Korapay dashboard access, Cloudinary dashboard access. |
| 1. Production environment | OPS-011 - OPS-025 | Deploy owner, API owner, Worker owner, Media owner, Payments owner | Production services are on the expected commit with strict preflight evidence. | Rollout checks pass for API, worker, web, and admin; production env review has no demo/mock flags; backup and migration dry run are recorded. | Render service/env access, production Postgres/Redis access, GitHub deploy auth, Korapay live env values, Cloudinary live env values. |
| 2. Admin operations setup | OPS-026 - OPS-040 | Campaign ops owner, API owner | Operators can safely triage, assign, update, and audit campaign work. | Admin queue, permissions, status matrix, notes, audit log, empty states, and mobile checks are verified. | Production admin credentials for named operators; launch roster approval from operations lead. |
| 3. Client flow setup | OPS-041 - OPS-050 | API owner, Support owner, Payments owner | A real client can submit and review campaign state without internal leakage. | Signup/login, business profile, intake, campaign detail, billing context, reports visibility, and mobile checks are recorded. | Approved launch client account, verified contact details, production billing contact. |
| 4. Manual launch accounts | OPS-051 - OPS-060 | Campaign ops owner, Payments owner, Media owner | External campaign launch process is usable before any client spend is at risk. | Naming, UTM, spend cap, proof standard, placement field, and live-before-proof policy are documented. | Meta Business/Ads Manager access, TikTok Ads Manager access, Instagram/Facebook page access, ad policy escalation path. |
| 5. Payments and reconciliation | OPS-061 - OPS-070 | Payments owner | Money state reconciles exactly once from provider event to customer-visible wallet/invoice state. | Payment intent, webhook idempotency, invoice link, budget hold, capture/release, insufficient balance, and reversal playbook evidence are captured. | Korapay live or approved sandbox access, webhook endpoint access, treasury/bank details, finance approver availability. |
| 6. Media and report evidence | OPS-071 - OPS-080 | Media owner, Campaign ops owner, API owner, Support owner | Media, proofs, and reports can be created, reviewed, published, and hidden correctly. | Image/video uploads, rejected upload cases, proof visibility, report draft/preview/publish checks are recorded. | Cloudinary dashboard access, upload preset/secrets, proof assets from real external launches if required. |
| 7. Notifications and support | OPS-081 - OPS-090 | Support owner | Customers and operators have a staffed path for normal questions and incidents. | Notification routes, support channel, support macros, incident templates, and disabled-provider checks are captured. | Support inbox access, customer comms approval, WhatsApp/provider access if enabled. |
| 8. Monitoring and alerts | OPS-091 - OPS-100 | API owner, Worker owner, Deploy owner, Payments owner, Media owner, Support owner | Owners can see failures quickly and know who responds. | Alert names, log filters, queue/payment/media review cadence, deploy notification test, and owner contact path are recorded. | Render alert configuration, Postgres/Redis dashboard access, Korapay/payment alert source, Cloudinary usage/error views. |
| 9. Go/no-go and rollback | OPS-101 - OPS-110 | Deploy owner, Rollback owner, Payments owner, Support owner, Campaign ops owner | Full smoke is complete, rollback is known, and every owner signs off. | Smoke campaign IDs, UI audit screenshots, rollback target/order, reconciliation plan, customer messaging plan, signoff thread, and config freeze notice are captured. | Render rollback permissions, GitHub deploy provenance, payment reconciliation approval, customer comms approval. |

## Daily Standup View

| Date | Phase | Status | Owner | Evidence Link | Blocker | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | 0. Access and ownership | Not started | Deploy owner |  |  | Assign named humans and backups. |
| YYYY-MM-DD | 1. Production environment | Not started | Deploy owner |  |  | Run strict rollout checks and capture commit SHA. |
| YYYY-MM-DD | 2. Admin operations setup | Not started | Campaign ops owner |  |  | Verify roster, roles, queue, notes, and audit behavior. |
| YYYY-MM-DD | 3. Client flow setup | Not started | Support owner |  |  | Run client intake and visibility checks. |
| YYYY-MM-DD | 4. Manual launch accounts | Not started | Campaign ops owner |  |  | Confirm Meta/TikTok/page access and proof policy. |
| YYYY-MM-DD | 5. Payments and reconciliation | Not started | Payments owner |  |  | Run payment, webhook, wallet, invoice, and hold checks. |
| YYYY-MM-DD | 6. Media and report evidence | Not started | Media owner |  |  | Verify Cloudinary uploads, proofs, and report publishing. |
| YYYY-MM-DD | 7. Notifications and support | Not started | Support owner |  |  | Confirm support channels and launch macros. |
| YYYY-MM-DD | 8. Monitoring and alerts | Not started | API owner |  |  | Capture alert names and acknowledgement path. |
| YYYY-MM-DD | 9. Go/no-go and rollback | Not started | Deploy owner |  |  | Run smoke campaign and collect owner signoff. |

## External Credential Checklist

| System | Needed By | Required Evidence | Blocks |
| --- | --- | --- | --- |
| Render | Deploy owner, API owner, Worker owner, Rollback owner | Service access confirmed, env values reviewed without exposing secrets, deploy/rollback permissions confirmed. | Phases 0, 1, 8, 9 |
| GitHub auth/repo access | Deploy owner, Rollback owner, API owner | Launch commit SHA is known, release owner can inspect CI/deploy provenance, rollback target commit is recorded. | Phases 0, 1, 9 |
| Korapay | Payments owner | Dashboard access confirmed, live or approved sandbox payment evidence, webhook and reconciliation proof captured. | Phases 0, 1, 5, 9 |
| Cloudinary | Media owner | Dashboard access confirmed, production upload preset/secrets verified, image/video/proof asset IDs captured. | Phases 0, 1, 6, 8 |
| Meta Business/Ads Manager | Campaign ops owner | Operator access confirmed, page/ad account context confirmed, proof capture standard accepted. | Phase 4 |
| TikTok Ads Manager | Campaign ops owner | Operator access confirmed, account policy escalation path known, proof capture standard accepted. | Phase 4 |
| Support inbox/channel | Support owner | Inbox/channel URL posted, staffing and escalation path confirmed. | Phases 0, 7, 9 |

## Launch Evidence Packet

Before the final go/no-go call, collect these links in the launch notes:

- Owner roster and escalation handles.
- Current launch commit SHA and Render service deploy references.
- Rollout check output for API, worker, web, and admin.
- Deployed smoke result with campaign, invoice, payment, media, placement, and report IDs.
- Korapay reconciliation evidence and duplicate webhook/idempotency result.
- Cloudinary upload/proof evidence for image, video, rejected size, and rejected MIME cases.
- Meta/TikTok/page access confirmation and external proof capture examples.
- Monitoring alert names or manual review cadence for API, worker, payment, queue, and media failures.
- Rollback target, rollback order, reconciliation plan, and customer messaging template.
- Owner signoff thread using `go`, `go with risk`, or `no-go`.
