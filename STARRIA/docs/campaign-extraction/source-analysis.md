# Source Analysis — FlipTrybe Ad Campaigner

## 1. Project Architecture

The source is a **Turborepo pnpm monorepo** with four runnable apps and
ten-plus shared packages:

```
apps/
  admin/     — Next.js admin ops dashboard (campaign-ops pages)
  web/       — Next.js client-facing campaign management
  api/       — NestJS REST API
  worker/    — BullMQ background job processor
packages/
  types/     — shared TypeScript types
  database/  — Prisma schema + migrations
  analytics/ — analytics utilities
  payments/  — payment processing
  ...
```

---

## 2. Campaign Creation

**Source file:** `apps/api/src/modules/managed-ads.service.ts` (~lines 673–744)

**What it does:**
1. Validates budget (must be positive integer minor units)
2. Parses `startsAt` / `endsAt` ISO strings
3. Normalises objective and destination kind
4. Creates `Campaign` row in DRAFT status via Prisma
5. Creates a `Destination` row (1:1 with Campaign)
6. Inserts initial `CampaignStatusHistory` entry
7. Emits audit log & internal event

**Extracted as:**
- `ICampaignService.create()` in `interfaces.ts`
- `CreateCampaignInput` type in `interfaces.ts`
- `Campaign` entity type in `types.ts`

**App-specific pieces removed:**
- Prisma ORM calls → interface boundary
- NestJS `@Injectable()` decorator
- FlipTrybe workspace / auth context object
- Hard-coded `provider: "MANUAL"` default

---

## 3. Budgeting

**Source files:**
- `apps/api/src/modules/managed-ads.service.ts` lines 883–897, 1102–1115, 1442–1674
- `packages/database/prisma/schema.prisma` — `CampaignBudgetHold`, `CampaignLedgerEntry`

**What it does:**

The source implements a **double-entry ledger** with budget hold semantics:

| Operation | Ledger kind |
|-----------|-------------|
| Wallet top-up | CREDIT |
| Budget allocation | HOLD |
| Hold release | RELEASE |
| Hold capture → spend | DEBIT |
| Refund | CREDIT + REVERSAL |

Budget holds allow the system to reserve funds while an ad is in-flight
and only commit the spend once delivery is confirmed.

**Extracted as:**
- `IBudgetService` interface (hold/release/capture, increase/decrease, summary, ledger)
- `BudgetHold`, `CampaignLedgerEntry`, `CampaignBudgetSummary` types
- `LedgerEntryType`, `LedgerEntryKind`, `BudgetHoldStatus` enums

**App-specific pieces removed:**
- Prisma transaction blocks
- Korapay wallet service coupling
- FlipTrybe invoice payment flow
- NestJS event emitter calls

---

## 4. Targeting

**Source file:** `apps/api/src/modules/managed-ads.service.ts` lines 703–711, 263–287

**What it does:**

Targeting is stored as a JSON blob on the Campaign record:

```json
{
  "country": "NG",
  "cities": ["Lagos", "Abuja"],
  "platforms": ["tiktok", "instagram"],
  "notes": "focus on 18–35 age group"
}
```

Platform inference maps human-readable channel names to the 18
`DestinationKind` enum values (TikTok profiles, Instagram reels, etc.).

**Extracted as:**
- `AudienceTargeting` interface — countries, cities, platforms, ageRange, interests, notes
- `ITargetingService` — get, update, validate
- Platform inference logic → `defaultTargeting()` in `starria-adapters.ts`

**App-specific pieces removed:**
- `DestinationKind` enum collapsed into `PlacementChannel` (platform-agnostic)
- FlipTrybe-specific destination types (`FLIPTRYBE_STORE`) removed
- Raw JSON Prisma storage → typed interface

---

## 5. Scheduling

**Source files:**
- Campaign model: `startsAt`, `endsAt`, `timezone` fields
- `apps/admin/app/campaign-ops/api.ts` lines 302–314
- `LivePromotion` model for real-time live scheduling

**What it does:**

Campaigns have a flight window (`startsAt`→`endsAt`) with a timezone tag.
The `LivePromotion` extension adds:
- `expectedStartAt` — when the live stream is expected to begin
- `actualStartedAt` / `actualEndedAt` — for real-time tracking
- `realtimeBoostEnabled` — flag to activate real-time viewer boosts

**Extracted as:**
- `CampaignSchedule` type — startsAt, endsAt, timezone, liveExpectedStartAt
- `ISchedulingService` — get, update, getUpcoming, getOverdue
- `defaultSchedule()` adapter in `starria-adapters.ts`

**App-specific pieces removed:**
- `LivePromotion` Prisma model collapsed into `CampaignSchedule.liveExpectedStartAt`
- Real-time boost state moved to `Campaign.realtimeBoostEnabled`

---

## 6. Delivery

**Source files:**
- `apps/api/src/modules/managed-ads.service.ts` lines 1863–1957
- `ManualAdPlacement` Prisma model

**What it does:**

Delivery in the source is exclusively **managed / manual**.  An operator
creates a `ManualAdPlacement` record for each channel where the ad is
placed (TikTok ad account, Instagram boosted post, etc.).  Each placement
records:
- Channel, external IDs, destination URL
- Budget allocated and actual spend
- Impressions, clicks, conversions
- Flight dates

Spend entries are created per placement and linked to the financial ledger.

**Extracted as:**
- `AdPlacement` type — channel, status, budget, spend, metrics, metadata
- `PlacementChannel` enum — TIKTOK, INSTAGRAM, FACEBOOK, WHATSAPP, YOUTUBE, GOOGLE, TWITTER_X, SNAPCHAT, IN_APP, OTHER
- `IDeliveryService` interface — create, update, list, pause, complete, cancel

**App-specific pieces removed:**
- Prisma create/update calls
- NestJS auth context
- Spend-ledger coupling (left as implementation detail for consuming service)
- Hard-coded "MANUAL" provider assumption (open via `placement.provider`)

---

## 7. Analytics

**Source files:**
- `services/analytics/src/index.ts`
- `apps/api/src/modules/managed-ads.service.ts` lines 1959–2021
- `apps/api/src/modules/platform.controllers.ts` lines 614–629

**What it does:**

Metrics are stored as `CampaignReport` rows (per period) and as granular
`CampaignSpendEntry` records.  The overview endpoint aggregates across all
reports for a campaign and computes derived KPIs (CTR, CPM, CPC, ROAS).

**Extracted as:**
- `AnalyticsOverview` type — totals + derived KPIs + trend array
- `CampaignMetric` type — name/value + dimensions + source
- `IAnalyticsService` — getOverview, addMetric, listMetrics, getWorkspaceOverview
- `AddMetricInput` — impressions, clicks, conversions, spendMinor, liveViewers

---

## 8. Impression Tracking

**Source files:**
- `ManualAdPlacement.impressions` (Int field, default 0)
- `CampaignReport.impressions` (Int field)
- Aggregated via `addManualMetric()` and `createReport()`

**What it does:**

Impressions flow in through three paths:
1. Operator manually entering numbers from an ad platform dashboard
2. Placement creation (bulk import)
3. Periodic report submission

There is no real-time pixel/SDK tracking in the source — it is all
manual/batch.

**Extracted as:**
- `ImpressionEvent` type — campaignId, placementId, viewerId, platform, countryCode
- `IImpressionTracker` interface — record, recordBatch, getCount
- Designed to support both manual batch and real-time SDK modes

---

## 9. Click Tracking

**Source files:** Same paths as impression tracking; clicks stored in
`ManualAdPlacement.clicks` and `CampaignReport.clicks`.

**Extracted as:**
- `ClickEvent` type — campaignId, clickerId, destinationUrl, platform
- `IClickTracker` interface — record, recordBatch, getCount, getCTR

---

## 10. Promotion Engine

**Source files:**
- `apps/api/src/modules/managed-ads.service.ts` lines 1676–1780 (`getAdminOverview`)
- `apps/admin/app/campaign-ops/page.tsx`, `queue/page.tsx`

**What it does:**

The promotion engine is the ops dashboard brain.  It scans all campaigns
and emits categorised signals:

| Signal | Condition |
|--------|-----------|
| `BUDGET_ALERT` | spend ≥ 85% of budget |
| `UNASSIGNED` | no operator assigned |
| `PENDING_REVIEW` | status = PENDING_REVIEW |
| `LAUNCH_PREP` | status ∈ {APPROVED, CREATIVE_IN_PROGRESS, QUEUED} |
| `LIVE_ACTIVE` | status ∈ {ACTIVE, RUNNING, PAUSED} |
| `REPORTING_READY` | status = COMPLETED, no final report |

**Extracted as:**
- `PromotionSignal` type — kind, severity, detail
- `PromotionQueueSummary` type — counts + full signal array
- `IPromotionEngine` interface — getQueueSummary, getActionableItems, scoreContent
- `EXPIRING_SOON` signal added for STARRIA (campaigns ending within 24h)
