/**
 * @starria/campaign-core — STARRIA-specific adapters
 *
 * Maps STARRIA content entities to the generic PromotableContent shape,
 * and provides default targeting / objective profiles per content kind.
 */

import type {
  PromotableContent,
  PromotableKind,
  CampaignObjective,
  AudienceTargeting,
  CampaignSchedule,
} from "./types"
import { OBJECTIVE_AFFINITY } from "./types"

// ─── Content Adapters ─────────────────────────────────────────────────────────

export interface StarriaVideo {
  id: string
  workspaceId: string
  title: string
  url: string
  durationSeconds?: number
  genre?: string
}

export interface StarriaEvent {
  id: string
  workspaceId: string
  title: string
  url: string
  startsAt: string
  endsAt: string
  venue?: string
  isVirtual?: boolean
}

export interface StarriaAiMovie {
  id: string
  workspaceId: string
  title: string
  url: string
  genre?: string
  releaseDate?: string
}

export interface StarriaLiveSession {
  id: string
  workspaceId: string
  title: string
  url: string
  expectedStartAt: string
  host: string
  topicTags?: string[]
}

export interface StarriaArena {
  id: string
  workspaceId: string
  title: string
  url: string
  category?: string
  memberCount?: number
}

export function videoToPromotable(v: StarriaVideo): PromotableContent {
  return {
    contentId: v.id,
    kind: "VIDEO",
    title: v.title,
    url: v.url,
    workspaceId: v.workspaceId,
    metadata: { durationSeconds: v.durationSeconds, genre: v.genre },
  }
}

export function eventToPromotable(e: StarriaEvent): PromotableContent {
  return {
    contentId: e.id,
    kind: "EVENT",
    title: e.title,
    url: e.url,
    workspaceId: e.workspaceId,
    metadata: { startsAt: e.startsAt, endsAt: e.endsAt, venue: e.venue, isVirtual: e.isVirtual },
  }
}

export function aiMovieToPromotable(m: StarriaAiMovie): PromotableContent {
  return {
    contentId: m.id,
    kind: "AI_MOVIE",
    title: m.title,
    url: m.url,
    workspaceId: m.workspaceId,
    metadata: { genre: m.genre, releaseDate: m.releaseDate },
  }
}

export function liveSessionToPromotable(s: StarriaLiveSession): PromotableContent {
  return {
    contentId: s.id,
    kind: "LIVE_SESSION",
    title: s.title,
    url: s.url,
    workspaceId: s.workspaceId,
    metadata: { expectedStartAt: s.expectedStartAt, host: s.host, topicTags: s.topicTags },
  }
}

export function arenaToPromotable(a: StarriaArena): PromotableContent {
  return {
    contentId: a.id,
    kind: "ARENA",
    title: a.title,
    url: a.url,
    workspaceId: a.workspaceId,
    metadata: { category: a.category, memberCount: a.memberCount },
  }
}

// ─── Default Profiles ─────────────────────────────────────────────────────────
// Sensible defaults to pre-fill campaign creation forms in the STARRIA UI.

export function defaultObjective(kind: PromotableKind): CampaignObjective {
  const map: Record<PromotableKind, CampaignObjective> = {
    VIDEO:        "ENGAGEMENT",
    EVENT:        "TRAFFIC",
    AI_MOVIE:     "AWARENESS",
    LIVE_SESSION: "LIVE_VIEWERS",
    ARENA:        "FOLLOWERS",
  }
  return map[kind]
}

export function defaultTargeting(kind: PromotableKind): AudienceTargeting {
  const base: AudienceTargeting = { countries: ["NG"], platforms: ["TIKTOK", "INSTAGRAM"] }
  if (kind === "LIVE_SESSION") return { ...base, platforms: ["TIKTOK", "INSTAGRAM", "FACEBOOK"] }
  if (kind === "EVENT") return { ...base, platforms: ["INSTAGRAM", "FACEBOOK", "TWITTER_X"] }
  if (kind === "ARENA") return { ...base, platforms: ["TIKTOK", "INSTAGRAM", "IN_APP"] }
  return base
}

/**
 * Build a default schedule for a piece of promotable content.
 * For events, the campaign ends when the event ends.
 * For live sessions, the campaign ends when the live is expected to start.
 */
export function defaultSchedule(content: PromotableContent, timezone = "Africa/Lagos"): CampaignSchedule {
  if (content.kind === "EVENT") {
    return {
      startsAt: new Date(Date.now()).toISOString(),
      endsAt: (content.metadata as StarriaEvent | undefined)?.endsAt,
      timezone,
    }
  }
  if (content.kind === "LIVE_SESSION") {
    const liveStart = (content.metadata as StarriaLiveSession | undefined)?.expectedStartAt
    return {
      startsAt: new Date(Date.now()).toISOString(),
      endsAt: liveStart,
      timezone,
      liveExpectedStartAt: liveStart,
    }
  }
  return { startsAt: new Date(Date.now()).toISOString(), timezone }
}

export function supportedObjectives(kind: PromotableKind): CampaignObjective[] {
  return OBJECTIVE_AFFINITY[kind]
}
