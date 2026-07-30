# Client Campaign Controls

Client controls let workspace users manage a Fliptrybe-operated campaign without direct Meta or TikTok access. The API keeps platform execution behind the ops desk while recording every client command in status history, audit logs, events, and operator notifications.

## Status Architecture

Canonical campaign statuses remain the Prisma `CampaignStatus` enum:

`DRAFT -> PENDING_REVIEW -> APPROVED -> CREATIVE_IN_PROGRESS -> QUEUED -> RUNNING/ACTIVE -> COMPLETED`

Client control transitions:

- Pause Campaign: `RUNNING` or `ACTIVE` -> `PAUSED`
- Resume Campaign: `PAUSED` -> `RUNNING`
- Request Changes: `PENDING_REVIEW`, `APPROVED`, `CREATIVE_IN_PROGRESS`, `QUEUED`, `RUNNING`, `ACTIVE`, or `PAUSED` -> `CHANGES_REQUESTED`
- Stop Campaign: non-terminal campaign -> `CANCELLED`
- Increase Budget: budget increases, status unchanged
- Decrease Budget: budget decreases, status unchanged, but never below recorded spend

Terminal statuses are `COMPLETED`, `CANCELLED`, `FAILED`, and `REJECTED`.

## API Surface

Client command endpoints:

- `POST /v1/campaigns/:id/actions/pause`
- `POST /v1/campaigns/:id/actions/resume`
- `POST /v1/campaigns/:id/actions/request-changes`
- `POST /v1/campaigns/:id/actions/increase-budget`
- `POST /v1/campaigns/:id/actions/decrease-budget`
- `POST /v1/campaigns/:id/actions/stop`

Read endpoints:

- `GET /v1/campaigns/:id/audit`
- `GET /v1/campaigns/:id/ledger`
- `GET /v1/campaigns/:id/budget-summary`
- `GET /v1/campaigns/:id/budget`
- `GET /v1/campaigns/:id/spend-breakdown`

Command endpoints require authenticated workspace context plus `campaign:manage`.

## Notifications And Audit

Each command writes:

- `CampaignStatusHistory` for status-changing actions
- `AuditLog` metadata with actor, action, previous value, new value, and reason
- `EventOutbox` records such as `CampaignPaused`, `CampaignResumed`, `CampaignBudgetModified`, and `CampaignTerminated`
- In-app notifications targeted to active `OPERATOR` assignments, falling back to a campaign-ops broadcast when no operator is assigned

The client campaign response includes `assignedOperator`, `remainingBudget`, and `budgetSummary` for the control panel.
