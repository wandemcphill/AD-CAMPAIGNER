# FLIPTRYBE ADS CAMPAIGNER

Global growth campaign operating system for ads, livestream promotion, social growth, SMM fulfillment, payments, analytics, and AI-assisted campaign operations.

## Workspace

- `apps/web` - user growth dashboard
- `apps/admin` - operations and governance dashboard
- `apps/api` - NestJS API surface
- `apps/worker` - BullMQ background processors
- `packages/*` - shared UI, domain contracts, config, auth, events, adapters, database, and utilities
- `services/*` - bounded domain service contracts for future extraction
- `infrastructure/*` - Docker, monitoring, backup, and nginx foundations
- `tests/*` - integration, contract, and e2e test foundations

## Local Bootstrap

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate
pnpm install
pnpm verify
```

Docker files are included, but Docker Desktop must be installed locally before compose workflows can run.

## Deployment

Render Blueprint deployment is configured in [`render.yaml`](render.yaml). It provisions the API, web dashboard, admin dashboard, worker, PostgreSQL, and Redis-compatible Render Key Value.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the GitHub-to-Render deployment flow.
