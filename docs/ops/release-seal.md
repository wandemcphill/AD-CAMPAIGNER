# Production Release Seal

The production-sealing line uses three gates before a release is considered ready:

1. `pnpm prisma:generate` bootstraps the generated Prisma client.
2. `pnpm ops:release` runs repository verification and the Render Blueprint safety gate, producing an evidence packet under `artifacts/release-readiness/`.
3. The GitHub Release Readiness workflow runs those checks against the exact release-candidate commit and uploads the packet as an artifact.

The Render Blueprint keeps staged OTP/automation, SMSActivate compatibility, virtual cards, trusted auth headers, and live FX refresh disabled by default until their rollout evidence exists. The Korapay webhook URL is explicitly declared in the Blueprint.

This document records the release contract; it does not mutate the live Render environment.
