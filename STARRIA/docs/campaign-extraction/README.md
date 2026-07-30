# campaign-core Extraction — STARRIA

> Extracted from: **FlipTrybe Ad Campaigner** (monorepo at `ADS CAMPAIGNER/`)
> Extracted to: **`STARRIA/packages/campaign-core`**
> Date: 2026-06-16
> Author: Omotunde Oni

---

## Contents

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | This overview |
| [source-analysis.md](./source-analysis.md) | Deep-dive into every source module and what was extracted |
| [package-design.md](./package-design.md) | Architecture of `@starria/campaign-core` |
| [starria-mapping.md](./starria-mapping.md) | How each STARRIA use case maps to campaign-core |
| [migration-guide.md](./migration-guide.md) | Step-by-step guide for consuming campaign-core |

---

## Executive Summary

The FlipTrybe Ad Campaigner contains a battle-tested managed advertising
platform.  All application-specific coupling (NestJS, Prisma, BullMQ,
Korapay, FlipTrybe auth) has been stripped away, and the underlying domain
logic has been recast as framework-agnostic TypeScript interfaces and types.

The result is **`@starria/campaign-core`** — a single internal package that
any STARRIA service or application can depend on to:

- Create and lifecycle-manage promotional campaigns
- Track budgets via a double-entry ledger with budget holds
- Define audience targeting and multi-channel placements
- Schedule promotions with timezone awareness
- Record impressions, clicks, conversions, and spend
- Drive an operator queue (promotion engine) for managed campaigns

### STARRIA Use Cases Covered

| Use Case | Promotable Kind | Default Objective |
|----------|-----------------|-------------------|
| Promote Videos | `VIDEO` | `ENGAGEMENT` |
| Promote Events | `EVENT` | `TRAFFIC` |
| Promote AI Movies | `AI_MOVIE` | `AWARENESS` |
| Promote Live Sessions | `LIVE_SESSION` | `LIVE_VIEWERS` |
| Promote Arenas | `ARENA` | `FOLLOWERS` |

---

## Package Structure

```
STARRIA/packages/campaign-core/
├── package.json
└── src/
    ├── index.ts               — public barrel export
    ├── types.ts               — all domain types and enums
    ├── interfaces.ts          — service contracts (ICampaignService, IBudgetService, …)
    └── starria-adapters.ts    — STARRIA content → PromotableContent converters
```
