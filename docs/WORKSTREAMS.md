# Execution Workstreams

The master thread owns architecture governance, dependency control, integration reviews, QA coordination, performance checks, and merge readiness.

## 13 Threads And 52 Specialist Roles

1. Infrastructure: DevOps, Monitoring, Backup, Security Infra.
2. Frontend Systems: Design System, Dashboard UX, Mobile UX, Motion, Accessibility.
3. Auth And Organizations: Auth Security, RBAC, Session, Workspace.
4. Payments And Wallet: Gateway Integration, Wallet, Ledger, Fraud Detection, Payout.
5. Campaign Engine: Meta Ads, TikTok Ads, Campaign Builder, Targeting, Campaign Analytics.
6. Destination And Live Systems: Destination Engine, TikTok Live, Instagram Live, Facebook Live, Livestream Analytics.
7. SMM Engine: Supplier Integration, Fulfillment, Queue Optimization, Reliability.
8. AI Engine: Prompt Engineering, Ad Copy, Audience Intelligence, AI Workflow.
9. Analytics And BI: BI, Metrics, Dashboard Analytics, Realtime Analytics.
10. Admin And Governance: Governance, Moderation, Commission Engine, Audit.
11. Support And Notifications: Notification, Support CRM, Ticketing, Websocket Messaging.
12. Media And Search: Media Optimization, Video Processing, Search, Filtering.
13. QA And Security: QA, Security Audit, Load Testing, Regression Testing.

## Merge Standard

Every meaningful slice should pass typecheck, lint, tests, Prisma validation, provider contract tests, and a quick UX review before being considered merge-ready.

## Managed Ads MVP Frontend Phases

This sprint runs the managed marketplace UI in bounded phases so client, admin, shared theme, and QA work can move in parallel without blocking on TikTok or Meta APIs.

### Phase 1: Workstream Split

- Parent thread owns integration, validation, merge safety, and production copy gates.
- Client campaign lane owns `/campaigns`, `/campaigns/new`, campaign detail, and performance snapshots.
- Client trust lane owns billing, reports, profile, notifications, and workspace status.
- Admin ops lane owns `/campaign-ops`, review queue, campaign detail, reports, and activity.
- Shared systems lane owns Studio/Clay tokens, reusable UI primitives, OTP, Digital Access, and audit guards.

### Phase 2: Client Managed Marketplace Flow

- Campaign filters and cards use canonical human status labels.
- Review-only campaigns explain why actions are temporarily locked.
- Mobile campaign creation stays above the bottom nav.
- Billing and reports avoid gateway/status-code language and keep money/report states tied to campaign service context.

### Phase 3: Admin Operations Flow

- Queue and detail surfaces use operator-oriented status labels and SLA language.
- Admin errors are sanitized into operational retry guidance.
- Destructive/review actions stay deliberate and copy-led.
- Report rows distinguish missing metrics from published report state.

### Phase 4: Shared Theme And Adjacent Services

- Studio remains the default theme and Clay remains toggleable.
- Client/admin/OTP/Digital Access use the same token contract.
- Debug and local-data labels stay behind explicit debug flags.
- `pnpm ui:audit` scans required UX routes and production-facing blocked copy.

### Phase 5: Release Validation

- Run focused package checks for `@fliptrybe/ui`, `@fliptrybe/web`, and `@fliptrybe/admin`.
- Run static export builds for web and admin with isolated `NEXT_DIST_DIR`.
- Run `pnpm ui:audit` and `git diff --check`.
- Run browser/mobile smoke where local tooling is available; otherwise use static export plus route smoke as the fallback.
