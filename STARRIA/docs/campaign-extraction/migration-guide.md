# Migration Guide — Consuming `@starria/campaign-core`

This guide walks through integrating `@starria/campaign-core` into a new
STARRIA service or an existing app being migrated from the FlipTrybe
Campaigner codebase.

---

## Step 1 — Add the dependency

In your `package.json` (or pnpm workspace):

```json
{
  "dependencies": {
    "@starria/campaign-core": "workspace:*"
  }
}
```

---

## Step 2 — Implement the service interfaces

`@starria/campaign-core` ships interfaces, not implementations.  You need
to provide an implementation in your service layer.  The minimal surface
to get started is `ICampaignService` + `ILifecycleService`.

**Example — NestJS / Prisma implementation skeleton:**

```typescript
// campaign.service.ts
import {
  ICampaignService,
  CreateCampaignInput,
  Campaign,
  CampaignFilters,
  PaginatedResult,
  PaginationParams,
} from "@starria/campaign-core"
import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class CampaignService implements ICampaignService {
  constructor(private readonly db: PrismaService) {}

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const row = await this.db.campaign.create({
      data: {
        workspaceId: input.workspaceId,
        creatorUserId: input.creatorUserId,
        name: input.name,
        objective: input.objective,
        status: "DRAFT",
        budgetMinor: input.budget.totalMinor,
        currency: input.budget.currency,
        targetAudience: input.targeting as any,
        startsAt: new Date(input.schedule.startsAt),
        endsAt: input.schedule.endsAt ? new Date(input.schedule.endsAt) : null,
        timezone: input.schedule.timezone,
        metadata: {
          contentId: input.content.contentId,
          contentKind: input.content.kind,
          contentUrl: input.content.url,
          contentTitle: input.content.title,
          ...(input.metadata ?? {}),
        },
      },
    })
    return this.toEntity(row)
  }

  // … getById, update, list, delete …

  private toEntity(row: any): Campaign {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      creatorUserId: row.creatorUserId,
      name: row.name,
      objective: row.objective,
      status: row.status,
      content: {
        contentId: row.metadata.contentId,
        kind: row.metadata.contentKind,
        title: row.metadata.contentTitle,
        url: row.metadata.contentUrl,
        workspaceId: row.workspaceId,
      },
      budget: { totalMinor: row.budgetMinor, currency: row.currency },
      targeting: row.targetAudience ?? {},
      schedule: { startsAt: row.startsAt.toISOString(), endsAt: row.endsAt?.toISOString(), timezone: row.timezone },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      metadata: row.metadata,
    }
  }
}
```

---

## Step 3 — Wire up content adapters

Before creating a campaign, convert your STARRIA content entity to
`PromotableContent` using the provided adapters:

```typescript
import { videoToPromotable, defaultObjective, defaultTargeting, defaultSchedule } from "@starria/campaign-core"

// In your VideoPromotionUseCase or API handler:
const content = videoToPromotable(myVideo)

await campaignService.create({
  workspaceId: req.workspaceId,
  creatorUserId: req.userId,
  name: `Boost: ${myVideo.title}`,
  objective: defaultObjective("VIDEO"),
  content,
  budget: { totalMinor: req.budgetMinor, currency: "NGN" },
  targeting: { ...defaultTargeting("VIDEO"), ...req.targetingOverrides },
  schedule: defaultSchedule(content, req.timezone),
})
```

---

## Step 4 — Implement tracking interfaces (optional, progressive)

Start with manual/batch tracking and upgrade to real-time as needed:

### Batch impression tracking (simple)

```typescript
class BatchImpressionTracker implements IImpressionTracker {
  async record(event: ImpressionEvent) {
    await db.impressionLog.create({ data: event })
  }
  async recordBatch(events: ImpressionEvent[]) {
    await db.impressionLog.createMany({ data: events })
  }
  async getCount(campaignId: string, from?: string, to?: string) {
    return db.impressionLog.count({
      where: { campaignId, occurredAt: { gte: from, lte: to } }
    })
  }
}
```

### Real-time pixel tracking (advanced)

Emit to a queue (Redis/Kafka), aggregate in a worker, flush to the DB on
a schedule.  The `IImpressionTracker` interface is identical — only the
implementation changes.

---

## Step 5 — Migrate from FlipTrybe Campaigner

If migrating an existing app that used the FlipTrybe source directly:

| FlipTrybe source | campaign-core equivalent |
|------------------|--------------------------|
| `managed-ads.service.createCampaign()` | `ICampaignService.create()` |
| `managed-ads.service.startCampaign()` | `ILifecycleService.start()` |
| `managed-ads.service.createBudgetHold()` | `IBudgetService.createHold()` |
| `managed-ads.service.captureBudgetHold()` | `IBudgetService.captureHold()` |
| `managed-ads.service.addManualMetric()` | `IAnalyticsService.addMetric()` |
| `managed-ads.service.createManualPlacement()` | `IDeliveryService.createPlacement()` |
| `managed-ads.service.createReport()` | `IReportingService.create()` |
| `managed-ads.service.getAdminOverview()` | `IPromotionEngine.getQueueSummary()` |
| `ManualAdPlacementChannel` enum | `PlacementChannel` union |
| `DestinationKind` enum | `PlacementChannel` union + `PromotableContent.url` |
| `CampaignObjective` enum | `CampaignObjective` union (identical values) |
| `CampaignStatus` enum | `CampaignStatus` union (identical values) |
| `AuthenticatedRequestContext` | Split into `workspaceId` + `actorId` params |

---

## Schema Notes

`@starria/campaign-core` is persistence-agnostic.  If you are using
Prisma, you can reuse the FlipTrybe schema as-is and map to the interfaces
in a service layer (see Step 2 above).

The key schema fields needed to back the core types:

```prisma
model Campaign {
  id            String   @id @default(uuid())
  workspaceId   String
  creatorUserId String
  name          String
  objective     String   // CampaignObjective
  status        String   // CampaignStatus
  budgetMinor   Int
  currency      String   @default("NGN")
  targetAudience Json
  startsAt      DateTime
  endsAt        DateTime?
  timezone      String   @default("UTC")
  metadata      Json     // stores contentId, contentKind, contentUrl, contentTitle
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

The `content` field on the `Campaign` interface is reconstructed from
`metadata` rather than a separate table — this keeps the schema minimal
and avoids a polymorphic join for every content type.

---

## Testing Strategy

Because all behaviour lives behind interfaces, unit tests can use simple
in-memory implementations:

```typescript
class InMemoryCampaignService implements ICampaignService {
  private store = new Map<string, Campaign>()

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const campaign: Campaign = { id: crypto.randomUUID(), status: "DRAFT", ...buildCampaign(input) }
    this.store.set(campaign.id, campaign)
    return campaign
  }
  async getById(id: string) { return this.store.get(id) ?? null }
  // …
}
```

This pattern makes all campaign logic testable without a database.
