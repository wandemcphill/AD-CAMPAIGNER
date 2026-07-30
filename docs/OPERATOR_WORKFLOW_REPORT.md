# Operator Workflow Report

This report documents the production campaign operations workflow for the managed ads operator center.

## Current Audit

| Area | Current source | Production posture |
| --- | --- | --- |
| Assignments | `CampaignAssignment` with active assignee, role, due date, and metadata priority. | Used to derive the Assigned workflow stage and assigned campaign dashboard widget. |
| Notes | `CampaignNote` with `INTERNAL` and `CLIENT_VISIBLE` visibility. | Internal notes stay in ops context; client-visible notes drive timeline updates and auditability. |
| Placements | `ManualAdPlacement` with channel, provider, external IDs, URL, status, budget, spend, dates, and metadata. | Hardened so operators must record platform, ad account, placement URL, launch date, spend, and notes. |
| Metrics | `CampaignSpendEntry` and `AnalyticsMetric`. | Spend entries are the allocation ledger; manual performance metrics feed report drafts and budget alerts. |
| Reports | `CampaignReport` with period, status, summary, spend, performance metrics, and screenshots. | Expanded to daily updates, weekly reports, and final reports, with publication guardrails. |

## Canonical Workflow

1. Campaign Submitted
2. Review
3. Approved
4. Assigned
5. Creative Review
6. Platform Launch
7. Optimization
8. Reporting
9. Completion

The admin API keeps the existing database campaign enum stable and derives operator workflow states from campaign status plus assignments, placements, and reports.

## Dashboard Widgets

The Campaign Operations Hub now exposes:

| Widget | Signal |
| --- | --- |
| Assigned Campaigns | Active campaigns with a named operator. |
| Pending Reviews | Submitted/review-stage briefs waiting for an ops decision. |
| Budget Alerts | Campaigns at or above 85% allocation or flagged by spend guardrails. |
| Campaign Health | Optimizing, reporting, or completed campaigns. |
| Reporting Queue | Daily, weekly, and final reports that are building or ready to publish. |

## Validation Rules

| Rule | Enforcement |
| --- | --- |
| Reporting before launch is blocked. | `createReport` and `publishReport` require a launched placement or launched campaign status. |
| Completion without report is blocked. | Admin completion requires at least one published client report. |
| Spend exceeding allocation is blocked. | Placement spend and manual metric spend are checked against campaign budget before recording. |
| Placement records must be complete. | Platform, ad account, placement URL, launch date, spend, and notes are required. |

## Reporting System

Operators can create:

| Report type | Use |
| --- | --- |
| Daily Update | Short performance/status update during active optimization. |
| Weekly Report | Periodic performance report with metrics and summary. |
| Final Report | Completion-ready client report before closure. |

Reports remain internal as drafts until published. Published reports become client-visible and unlock completion.
