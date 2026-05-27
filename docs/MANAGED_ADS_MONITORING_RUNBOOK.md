# Managed Ads Monitoring And Support Runbook

Use this runbook for Phase 7 support readiness and Phase 8 monitoring evidence.
It covers the production alerts, manual cadences, escalation paths, and incident
templates operators need when an external dashboard or human action is required.

This document does not replace the phase inventory in
`docs/MANAGED_ADS_PRODUCTION_TASKS.md` or the launch board in
`docs/MANAGED_ADS_LAUNCH_TRACKER.md`. It gives owners the practical operating
steps and copy/paste templates for remaining support and monitoring tasks.

## Operating Rules

- Every alert must route to a channel watched by the primary owner and backup.
- Every alert must have an acknowledgement in the incident or launch channel.
- If an automated alert is unavailable, use the manual cadence in this runbook
  until the dashboard alert is created.
- Do not paste secrets, full database URLs, API keys, webhook secrets, or live
  customer payment details into launch notes or incident channels.
- Record evidence links, screenshots, log filter names, alert names, dashboard
  URLs, or manual review notes in the launch evidence packet.
- For money, media, or customer-visible state, escalate even if the root cause
  is still unknown.

## Evidence Separation

Local/code evidence is proof that can be collected from the repository, deployed
app behavior, logs, command output, or app-owned data without needing provider
dashboard authority.

External dashboard evidence is proof that requires Render, Postgres, Redis,
Korapay, Cloudinary, support tooling, or paging/dashboard access.

| Area | Local/code evidence | External dashboard evidence |
| --- | --- | --- |
| API 5xx | Saved API log filter name, sample request ID, affected route, timestamp, local/deployed smoke output. | Render service metrics, alert name, error-rate dashboard screenshot, deploy correlation. |
| Worker restarts | Worker logs showing restart time, enabled queues, failed job IDs, retry/dead-letter notes. | Render worker restart alert, service events, crash/restart graph. |
| Queue depth | Queue depth command output or admin queue counts if available, stuck job IDs, queue owner note. | Redis/queue dashboard depth, Redis connection/latency metrics, alert name. |
| Postgres | Migration/preflight output, app DB error logs, backup/export reference, affected query/route notes. | Postgres CPU/storage/connections dashboard, backup status, capacity alert name. |
| Redis | Worker/API Redis error logs, queue retry/dead-letter evidence, feature flag state for producers/workers. | Redis memory/eviction/connection dashboard, capacity alert name, provider incident status. |
| Korapay/payment mismatch | Invoice ID, payment intent ID, wallet ledger entry, webhook processing log, reconciliation sheet row. | Korapay transaction status, settlement view, webhook delivery status, provider reference screenshot. |
| Cloudinary/upload failures | Upload intent/completion logs, asset ID, validation error, rejected MIME/size evidence, client/admin screenshot. | Cloudinary error/usage view, asset public ID, quota/billing alert, upload preset status. |
| Deploy failure | Commit SHA, CI status, rollout check output, Render deploy ref copied from logs if visible. | Render failed deploy event, deploy failure alert, rollback control availability. |
| Support escalation | Support channel URL, macro/template saved, incident acknowledgement, owner handoff note. | Support inbox/ticket view, paging/on-call acknowledgement, customer comms approval. |

## Alert And Cadence Registry

Replace bracketed placeholders with the real alert name, dashboard URL, and
channel before launch. If the dashboard does not support the exact threshold,
record the closest equivalent and the manual review cadence.

| Monitor | Owner | Alert name placeholder | Suggested trigger | Manual cadence if no alert | First action |
| --- | --- | --- | --- | --- | --- |
| API health and 5xx | API owner | `managed-ads-prod-api-5xx-rate` | API health check fails twice, or 5xx rate is above 2% for 10 minutes, or 5+ 5xx responses in 5 minutes. | Check API health, Render logs, and saved 5xx filter at start of day, midday, end of day, and after deploy. | Acknowledge, identify affected route/request IDs, compare with deploy timeline, escalate if clients are blocked. |
| Worker restarts | Worker owner | `managed-ads-prod-worker-restart-loop` | More than 2 restarts in 10 minutes, crash loop, or worker unavailable for 5 minutes. | Check worker Render events and logs at start of day, midday, end of day, and after deploy. | Acknowledge, pause risky queue producers if needed, capture failed job IDs, escalate to deploy owner. |
| Queue depth | Worker owner | `managed-ads-prod-queue-depth` | Any launch-critical queue grows for 15 minutes, exceeds the agreed queue-specific threshold, or has dead-letter growth. | Check queue depth every 2 hours during launch week and before end-of-day signoff. | Acknowledge, identify queue and oldest job age, pause producers if needed, assign recovery owner. |
| Postgres capacity/errors | Deploy owner | `managed-ads-prod-postgres-capacity` | Storage, CPU, memory, or connections above 80%; backup failure; repeated DB connection errors. | Check Postgres dashboard daily before traffic window and after deploy. | Acknowledge, capture metric, check app DB errors, freeze risky writes if data integrity may be affected. |
| Redis capacity/connectivity | Worker owner | `managed-ads-prod-redis-capacity` | Memory or connections above 80%, evictions, connection failures, or queue command timeouts. | Check Redis dashboard daily, after deploy, and whenever queue depth changes unexpectedly. | Acknowledge, capture metric, inspect worker/API Redis errors, pause producers if jobs cannot be persisted safely. |
| Korapay/payment mismatch | Payments owner | `managed-ads-prod-payment-mismatch` | Missing webhook after provider success, duplicate credit, amount mismatch, failed refund, unsettled charge, or manual adjustment. | Reconcile payments at start of day, midday, end of day, and after every launch test payment. | Acknowledge, freeze affected invoice/wallet changes, compare Korapay reference to invoice and ledger state. |
| Cloudinary/upload failures | Media owner | `managed-ads-prod-cloudinary-upload-failures` | 3+ failed uploads in 15 minutes, Cloudinary error spike, quota/billing warning, or upload completion signature failures. | Review upload errors at start of day, midday, end of day, and after the first real customer upload. | Acknowledge, capture asset/upload IDs, confirm whether clients are blocked, switch to approved media fallback if needed. |
| Deploy failure | Deploy owner | `managed-ads-prod-deploy-failed` | Any failed/canceled production deploy for API, worker, web, or admin. | Check deploy status before and after each launch-window deployment. | Acknowledge, post failed service and commit, decide retry vs rollback, notify owners if deployed state changed. |
| Support escalation | Support owner | `managed-ads-prod-support-escalation` | Launch support item unassigned for 15 minutes, incident unacknowledged for 10 minutes, or customer-facing impact without approved comms. | Review support inbox/channel every hour during launch week and before end-of-day signoff. | Acknowledge, assign owner, choose customer-safe update template, escalate to incident commander if impact is unclear. |

## Dashboard Setup Checklist

```text
Managed Ads monitoring setup
- API 5xx alert name:
- API 5xx saved log filter/dashboard:
- Worker restart alert name:
- Worker log filter/dashboard:
- Queue depth alert name or manual cadence:
- Queue depth dashboard/source:
- Postgres capacity alert name:
- Postgres dashboard/source:
- Redis capacity alert name:
- Redis dashboard/source:
- Korapay/payment mismatch alert or reminder:
- Payment reconciliation sheet/dashboard:
- Cloudinary upload failure alert or reminder:
- Cloudinary dashboard/source:
- Deploy failure notification:
- Support escalation notification:
- Alert channel:
- Incident channel:
- Owner roster link:
- Last test alert time:
- Test alert acknowledged by:
- Open dashboard blockers:
```

## Daily Review Checklist

Copy this into the launch notes every operating day during the first launch
week, and continue until the deploy owner closes Phase 8.

```text
Managed Ads daily monitoring review
Date:
Review owner:

API
- API health checked:
- 5xx filter checked:
- New 5xx/request IDs:
- Slow or failing campaign routes:
- Action needed:

Worker and queues
- Worker service status:
- Worker restarts:
- Queue depth by queue:
- Oldest stuck job:
- Dead-letter/retry notes:
- Action needed:

Postgres and Redis
- Postgres capacity/connections:
- Postgres backup/export status:
- Redis capacity/connections:
- Redis evictions/timeouts:
- Action needed:

Payments
- Korapay dashboard reviewed:
- New payment references:
- Invoice/wallet mismatches:
- Duplicate webhook/verify concerns:
- Refund/reversal concerns:
- Action needed:

Media
- Cloudinary usage/errors reviewed:
- Failed uploads:
- Rejected MIME/size/signature checks:
- Customer upload blockers:
- Action needed:

Deploy and support
- Failed deploy notifications:
- New production deploys:
- Support inbox/channel reviewed:
- Open customer escalations:
- Incident channel clear: yes / no
- Action needed:

Summary
- Incidents opened:
- Incidents resolved:
- Open risks:
- Next review time:
- Signoff:
```

## Escalation Matrix

| Severity | Use when | Required acknowledgement | Escalate to | Customer comms |
| --- | --- | --- | --- | --- |
| SEV-1 | Payments, wallet ledger, customer data, uploads, admin actions, or reports are broadly wrong or blocked. | Incident commander within 10 minutes. | Deploy owner, API owner, affected domain owner, support owner, customer comms owner. | Required within the approved customer update window. |
| SEV-2 | One production surface or launch-critical workflow is degraded, but a manual workaround exists. | Domain owner within 15 minutes. | Domain owner backup, support owner, deploy owner if deploy or rollback may be needed. | Required if any customer is waiting or sees incorrect state. |
| SEV-3 | Internal-only alert, single failed job/upload/payment attempt, or dashboard warning with no customer impact yet. | Domain owner by next review cadence. | Domain owner backup if unresolved by the next cadence. | Usually not required; support owner decides. |

| Failure area | Primary owner | Backup/escalation | Immediate decision owner |
| --- | --- | --- | --- |
| API 5xx or health | API owner | Deploy owner | Incident commander if client flow is blocked. |
| Worker restarts | Worker owner | Deploy owner | Incident commander if jobs or reports are delayed. |
| Queue depth | Worker owner | Campaign ops owner | Incident commander if backlog affects customer commitments. |
| Postgres | Deploy owner | API owner | Incident commander for data integrity risk. |
| Redis | Worker owner | Deploy owner | Incident commander if queue durability is uncertain. |
| Korapay/payment mismatch | Payments owner | Finance approver, API owner | Incident commander for customer-visible or ledger impact. |
| Cloudinary/upload failures | Media owner | API owner, support owner | Incident commander if uploads are blocked. |
| Deploy failure | Deploy owner | Rollback owner | Deploy owner unless production state changed; then incident commander. |
| Support escalation | Support owner | Customer comms owner | Incident commander if customer impact is unclear or growing. |

## Incident Acknowledgement Template

Use this as the first reply in the alert or incident channel.

```text
Incident acknowledgement
- Incident ID:
- Severity: SEV-1 / SEV-2 / SEV-3
- Alert/source:
- Acknowledged by:
- Acknowledged at:
- Primary owner:
- Backup owner:
- Affected surface:
- Customer impact known now:
- Immediate containment:
- Next update due:
- Evidence thread/link:
```

## Incident Update Template

```text
Incident update
- Incident ID:
- Time:
- Current status:
- Customer impact:
- Evidence collected:
- Actions taken:
- Decisions needed:
- Next owner:
- Next update due:
```

## Incident Resolution Template

```text
Incident resolved
- Incident ID:
- Resolved at:
- Resolved by:
- Root cause summary:
- Customer impact:
- Data/payment/media reconciliation completed:
- Customer comms sent: yes / no / not needed
- Evidence links:
- Follow-up tasks:
- Monitoring change needed:
```

## Payment Mismatch Template

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
- Mismatch type: missing webhook / duplicate credit / amount mismatch / unsettled charge / failed refund / manual adjustment
- Immediate containment:
- Finance approver:
- Customer comms needed: yes / no
- Resolution:
- Follow-up prevention task:
```

## Upload Failure Template

```text
Cloudinary/upload incident
- Severity:
- Detected by:
- Detected at:
- Workspace:
- Campaign:
- Asset/upload ID:
- Cloudinary public ID if known:
- Upload step: intent / direct upload / completion / preview / report proof
- Failure type: provider error / quota / invalid signature / rejected MIME / rejected size / CDN delivery / unknown
- Customer impact:
- Immediate workaround:
- Media owner:
- Support update needed: yes / no
- Resolution:
- Follow-up prevention task:
```

## Queue Or Worker Template

```text
Worker or queue incident
- Severity:
- Detected by:
- Detected at:
- Worker service:
- Queue:
- Queue depth:
- Oldest job age:
- Failed job IDs:
- Restart count:
- Producers paused: yes / no
- Customer impact:
- Recovery owner:
- Recovery action:
- Resolution:
- Follow-up prevention task:
```

## API 5xx Template

```text
API 5xx incident
- Severity:
- Detected by:
- Detected at:
- Route or endpoint:
- Request IDs:
- Status codes:
- Started after deploy: yes / no / unknown
- Affected customers/workspaces:
- Immediate containment:
- API owner:
- Deploy owner needed: yes / no
- Customer comms needed: yes / no
- Resolution:
- Follow-up prevention task:
```

## Deploy Failure Template

```text
Deploy failure incident
- Severity:
- Detected by:
- Detected at:
- Service: API / worker / web / admin
- Failed deploy reference:
- Commit SHA:
- Previous healthy deploy:
- Production state changed: yes / no / unknown
- Retry or rollback decision:
- Decision owner:
- Rollback owner needed: yes / no
- Customer impact:
- Resolution:
- Follow-up prevention task:
```

## Support Escalation Template

```text
Support escalation
- Severity:
- Raised by:
- Raised at:
- Customer/workspace:
- Campaign:
- Support ticket/channel:
- Customer-safe summary:
- Current owner:
- Needed owner or approver:
- Next customer update due:
- Approved macro/template:
- Resolution:
- Follow-up prevention task:
```

## Customer-Safe Incident Macro

```text
Subject: We are checking an issue affecting your campaign

Hi {{client_name}},

We are investigating an issue that may affect {{campaign_name}}:
{{customer_safe_summary}}.

Our team is working on it now. We will send the next update by
{{next_update_time}}.
```

## Customer-Safe Resolution Macro

```text
Subject: Campaign issue resolved

Hi {{client_name}},

The issue affecting {{campaign_name}} has been resolved. {{resolution_summary}}

Your campaign status has been updated in Fliptrybe. If any timing, budget, or
reporting detail changed, we have noted it on the campaign timeline.
```
