# `@starria/campaign-core` — Package Design

## Design Principles

1. **Zero runtime dependencies** — pure types and interfaces; no ORM, no
   HTTP client, no framework.  Each consuming service brings its own
   persistence and transport layers.

2. **Interface-first** — all behaviour is expressed as TypeScript interfaces
   (`I*Service`).  Implementations live outside this package.  This makes
   campaign-core independently testable and swappable.

3. **Minor-unit money** — all monetary amounts are plain `number` integers
   in the smallest currency unit (kobo for NGN, cents for USD).  No floats
   in the domain layer.

4. **Immutable enums** — enums are union string literals, not TypeScript
   `enum`.  This makes them tree-shakeable and avoids reverse-mapping bugs.

5. **Content-kind polymorphism** — the `PromotableContent` interface is the
   single entry point for all promotable things.  Adapters in
   `starria-adapters.ts` convert STARRIA domain objects to this shape.

---

## Module Map

```
src/types.ts
│
│  Core value types ──────────────────────────────────────────────────┐
│  Money, CurrencyCode                                                 │
│  PromotableContent, PromotableKind, OBJECTIVE_AFFINITY               │
│  CampaignObjective, CampaignStatus                                   │
│  AudienceTargeting, CampaignSchedule, CampaignBudget                 │
│  BudgetHold, CampaignLedgerEntry, CampaignBudgetSummary              │
│  AdPlacement, PlacementChannel, PlacementStatus                      │
│  CampaignMetric, CampaignReport, AnalyticsOverview                   │
│  ImpressionEvent, ClickEvent                                         │
│  PromotionSignal, PromotionQueueSummary                              │
│  Campaign (composite entity)                                         │
│  CampaignStatusEvent, CampaignAssignment, CampaignNote               │
└──────────────────────────────────────────────────────────────────────┘

src/interfaces.ts
│
│  Service contracts ──────────────────────────────────────────────────┐
│  ICampaignService      — CRUD for Campaign                           │
│  ILifecycleService     — state machine transitions                   │
│  IBudgetService        — ledger, holds, summaries                    │
│  ITargetingService     — audience targeting                          │
│  ISchedulingService    — flight windows, upcoming/overdue queries    │
│  IDeliveryService      — placements per channel                      │
│  IAnalyticsService     — metrics, overviews                          │
│  IImpressionTracker    — impression event ingestion                  │
│  IClickTracker         — click event ingestion                       │
│  IReportingService     — periodic reports                            │
│  IPromotionEngine      — ops signals and queue management            │
│  INotesService         — campaign notes                              │
│  IAssignmentService    — operator assignment                         │
└──────────────────────────────────────────────────────────────────────┘

src/starria-adapters.ts
│
│  STARRIA-specific helpers ───────────────────────────────────────────┐
│  videoToPromotable()         StarriaVideo → PromotableContent        │
│  eventToPromotable()         StarriaEvent → PromotableContent        │
│  aiMovieToPromotable()       StarriaAiMovie → PromotableContent      │
│  liveSessionToPromotable()   StarriaLiveSession → PromotableContent  │
│  arenaToPromotable()         StarriaArena → PromotableContent        │
│  defaultObjective()          best objective for a kind               │
│  defaultTargeting()          pre-filled targeting per kind           │
│  defaultSchedule()           smart schedule from content metadata    │
│  supportedObjectives()       list valid objectives for a kind        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Campaign Status Machine

```
                    ┌─────────────────────────────────────────────┐
                    │                    DRAFT                     │
                    └────────────────────┬────────────────────────┘
                                         │ submit()
                    ┌────────────────────▼────────────────────────┐
                    │               PENDING_REVIEW                 │
                    └──────────┬──────────────────────────────────┘
               approve()       │          requestChanges()
                    ┌──────────▼──────┐   ┌──────────────────────┐
                    │    APPROVED     │   │  CHANGES_REQUESTED   │
                    └──────────┬──────┘   └──────────────────────┘
                               │ (assign creative)
            ┌──────────────────▼───────────────────────┐
            │            CREATIVE_IN_PROGRESS           │
            └──────────────────┬───────────────────────┘
                               │ queue()
            ┌──────────────────▼───────────────────────┐
            │                  QUEUED                   │
            └──────────────────┬───────────────────────┘
                               │ start()
            ┌──────────────────▼───────────────────────┐
            │     ACTIVE / RUNNING ◄────── resume()     │
            └──────────────────┬───────────────────────┘
                    │ pause()  │                  │ complete()
                    ▼          │                  ▼
                  PAUSED       │              COMPLETED
                               │ cancel()
                               ▼
                           CANCELLED
```

Any transition can move to `FAILED` on unrecoverable system error.
`REJECTED` is a terminal state reachable from `PENDING_REVIEW`.

---

## Budget Hold Lifecycle

```
createHold()
    │
    ▼
  ACTIVE ──── releaseHold() ──► RELEASED
    │
    ├── captureHold() ──────────► CAPTURED
    │
    └── (expiresAt passed) ────► EXPIRED
```

---

## Key Design Decisions

### Why `PromotableContent` instead of union type?

A union type (`Video | Event | ...`) forces every consumer to pattern-match
on all variants.  A single `PromotableContent` with a `kind` discriminant
lets consumers that don't care about content differences work generically,
while adapters narrow the type for consumers that do.

### Why interfaces instead of abstract classes?

STARRIA services will likely use different ORMs or even REST calls to back
some of these interfaces.  Abstract classes force a class hierarchy;
interfaces allow structural typing and are compatible with plain objects,
Proxies, and dependency-injection tokens.

### Why keep `liveViewers` in `AddMetricInput` but not in `AnalyticsOverview`?

Live viewer counts are ephemeral (peak during a live session).  They are
recorded as a raw metric via `addMetric()` and the implementation can
surface them in the overview at `liveViewers?: number` (optional).  This
avoids a hard dependency on live infrastructure from the analytics shape.

### `IN_APP` placement channel

STARRIA's own feed/recommendation surface is modelled as the `IN_APP`
channel.  This allows STARRIA to run internal cross-promotions (e.g.
promoting an Arena inside the video feed) using the same campaign
infrastructure as external paid channels.
