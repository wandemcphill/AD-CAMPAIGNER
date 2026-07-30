# STARRIA Use-Case → campaign-core Mapping

Each section shows:
1. What a creator/admin wants to do
2. Which campaign-core concepts are involved
3. A minimal code example using the adapters

---

## 1. Promote a Video

**Goal:** A creator wants to boost a short video to get more views and
new followers.

**campaign-core concepts:**
- `PromotableKind: VIDEO`
- Default objective: `ENGAGEMENT`
- Supported objectives: AWARENESS, ENGAGEMENT, TRAFFIC, FOLLOWERS
- Channels: TikTok, Instagram (default)
- Budget holds used to reserve spend before placement goes live

```typescript
import {
  videoToPromotable,
  defaultObjective,
  defaultTargeting,
  defaultSchedule,
} from "@starria/campaign-core"

const content = videoToPromotable({
  id: "vid_abc123",
  workspaceId: "ws_xyz",
  title: "My viral moment",
  url: "https://starria.app/videos/vid_abc123",
  genre: "comedy",
})

const draft = await campaignService.create({
  workspaceId: "ws_xyz",
  creatorUserId: "user_123",
  name: "Video Boost — My viral moment",
  objective: defaultObjective("VIDEO"),   // "ENGAGEMENT"
  content,
  budget: { totalMinor: 5_000_00, currency: "NGN" },  // ₦5,000
  targeting: defaultTargeting("VIDEO"),
  schedule: defaultSchedule(content),
})
```

---

## 2. Promote an Event

**Goal:** An event organiser wants to drive ticket sales / RSVPs for an
upcoming concert.

**campaign-core concepts:**
- `PromotableKind: EVENT`
- Default objective: `TRAFFIC`
- `schedule.endsAt` auto-set from `event.endsAt` (no point running ads after the event)
- Channels: Instagram, Facebook, Twitter/X

```typescript
import { eventToPromotable, defaultSchedule } from "@starria/campaign-core"

const content = eventToPromotable({
  id: "evt_456",
  workspaceId: "ws_xyz",
  title: "Afrobeats Night Lagos",
  url: "https://starria.app/events/evt_456",
  startsAt: "2026-07-04T19:00:00+01:00",
  endsAt:   "2026-07-04T23:00:00+01:00",
  venue: "Eko Hotel, Lagos",
  isVirtual: false,
})

// schedule.endsAt = event.endsAt automatically
const schedule = defaultSchedule(content, "Africa/Lagos")

await campaignService.create({
  ...
  objective: "TRAFFIC",
  content,
  schedule,
  budget: { totalMinor: 20_000_00, currency: "NGN" },
})
```

---

## 3. Promote an AI Movie

**Goal:** A studio wants to raise awareness of their AI-generated movie
release.

**campaign-core concepts:**
- `PromotableKind: AI_MOVIE`
- Default objective: `AWARENESS` (reach / impressions focus)
- CPM (cost-per-mille impressions) is the key delivery KPI
- Analytics: `impressions` is primary, `clicks` secondary

```typescript
import { aiMovieToPromotable } from "@starria/campaign-core"

const content = aiMovieToPromotable({
  id: "mov_789",
  workspaceId: "ws_studio",
  title: "Echoes of Lagos",
  url: "https://starria.app/movies/mov_789",
  genre: "sci-fi",
  releaseDate: "2026-08-01",
})

await campaignService.create({
  ...
  objective: "AWARENESS",
  content,
  budget: { totalMinor: 100_000_00, currency: "NGN" },
  targeting: {
    countries: ["NG", "GH", "KE"],
    platforms: ["TIKTOK", "INSTAGRAM", "YOUTUBE"],
    ageRange: { min: 16, max: 45 },
  },
  schedule: { startsAt: "2026-07-25T00:00:00Z", endsAt: "2026-08-01T23:59:59Z", timezone: "Africa/Lagos" },
})
```

---

## 4. Promote a Live Session

**Goal:** A host wants to maximise concurrent viewers for an upcoming
live stream.

**campaign-core concepts:**
- `PromotableKind: LIVE_SESSION`
- Default objective: `LIVE_VIEWERS`
- `Campaign.realtimeBoostEnabled: true` — triggers real-time budget
  release as the live session progresses
- `schedule.liveExpectedStartAt` — ads should peak right before go-live
- Budget hold captured progressively as viewers join

```typescript
import { liveSessionToPromotable, defaultSchedule } from "@starria/campaign-core"

const content = liveSessionToPromotable({
  id: "live_321",
  workspaceId: "ws_creator",
  title: "Finance Q&A with Chidi",
  url: "https://starria.app/live/live_321",
  expectedStartAt: "2026-06-20T20:00:00+01:00",
  host: "chidi_okonkwo",
  topicTags: ["finance", "investing"],
})

await campaignService.create({
  ...
  objective: "LIVE_VIEWERS",
  content,
  realtimeBoostEnabled: true,
  schedule: defaultSchedule(content, "Africa/Lagos"),
  // schedule.liveExpectedStartAt = "2026-06-20T20:00:00+01:00"
  // schedule.endsAt = same (campaign ends when live starts, boost already deployed)
  budget: { totalMinor: 15_000_00, currency: "NGN" },
  targeting: { countries: ["NG"], platforms: ["TIKTOK", "INSTAGRAM", "FACEBOOK"] },
})
```

**Real-time tracking** — during the live, emit impression and viewer events:

```typescript
await impressionTracker.record({
  campaignId: campaign.id,
  contentId: "live_321",
  viewerId: "anon",
  platform: "TIKTOK",
  countryCode: "NG",
  occurredAt: new Date().toISOString(),
})

await analyticsService.addMetric(campaign.id, {
  metricName: "live_viewers",
  value: 1247,
  source: "SDK",
  recordedForDate: new Date().toISOString(),
}, "system")
```

---

## 5. Promote an Arena

**Goal:** A community manager wants to grow membership of a STARRIA Arena
(topic community).

**campaign-core concepts:**
- `PromotableKind: ARENA`
- Default objective: `FOLLOWERS` (arena joins / follows)
- `IN_APP` channel — STARRIA can place cross-promotion banners inside its
  own video feed or discovery page without an external ad spend
- External channels supplement internal promotions

```typescript
import { arenaToPromotable, defaultTargeting } from "@starria/campaign-core"

const content = arenaToPromotable({
  id: "arena_654",
  workspaceId: "ws_community",
  title: "Tech Builders Lagos",
  url: "https://starria.app/arenas/arena_654",
  category: "technology",
  memberCount: 3400,
})

const campaign = await campaignService.create({
  ...
  objective: "FOLLOWERS",
  content,
  budget: { totalMinor: 8_000_00, currency: "NGN" },
  targeting: defaultTargeting("ARENA"),
  // defaultTargeting("ARENA") → { countries: ["NG"], platforms: ["TIKTOK","INSTAGRAM","IN_APP"] }
  schedule: { startsAt: new Date().toISOString(), timezone: "Africa/Lagos" },
})

// Create an internal in-app placement (zero external spend)
await deliveryService.createPlacement({
  campaignId: campaign.id,
  channel: "IN_APP",
  destinationUrl: content.url,
  budgetMinor: 0,
  metadata: { adAccountId: "starria-internal", clientVisible: false },
}, "system")

// Create a TikTok paid placement
await deliveryService.createPlacement({
  campaignId: campaign.id,
  channel: "TIKTOK",
  destinationUrl: content.url,
  budgetMinor: 8_000_00,
  provider: "tiktok-ads",
  metadata: { adAccountId: "TT_ACCT_xyz" },
}, actorId)
```

---

## Promotion Engine — Ops Dashboard

All five use cases share the same ops queue.  The promotion engine signals
tell operators which campaigns need attention right now:

```typescript
const summary = await promotionEngine.getQueueSummary("ws_xyz")
// {
//   pendingReviews: 2,
//   launchPreparation: 4,
//   budgetAlerts: 1,
//   reportingQueue: 3,
//   unassigned: 1,
//   signals: [
//     { kind: "BUDGET_ALERT", campaignId: "…", severity: "WARNING", detail: "87% of budget spent" },
//     { kind: "LIVE_ACTIVE",  campaignId: "…", severity: "INFO",    detail: "Live session running" },
//     …
//   ]
// }
```
