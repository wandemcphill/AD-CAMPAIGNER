# Growth Services Marketplace

## Architecture

Growth Services converts the existing SMM supplier layer into a customer-facing marketplace.

- Customer API: `GET /v1/growth/services`, `GET /v1/growth/catalog`, `POST /v1/growth/orders`, `GET /v1/growth/orders`, `GET /v1/growth/orders/:id`, `GET /v1/growth/risk-report`.
- Admin API: `GET /v1/admin/growth/overview`, `GET /v1/admin/growth/services`, `PATCH /v1/admin/growth/services/:code`, `GET /v1/admin/growth/orders`, `PATCH /v1/admin/growth/orders/:id`, `POST /v1/admin/growth/orders/:id/override`, `GET /v1/admin/growth/supplier-audit`, `GET /v1/admin/growth/risk-report`.
- Service rules live in `@fliptrybe/service-smm` as `defaultGrowthServicesCatalog`.
- Runtime state lives in `PlatformService`, matching the current SMM in-memory foundation.
- Supplier fulfillment still flows through `SmmSupplierAdapter`, routed by `createRoutedSmmSupplier`.
- Customer UI lives at `/growth-services`.
- Admin UI lives at `/growth-services` in the admin app.

## Supplier Audit

Supported supplier modes:

- `mock-smm` for local and non-live environments.
- Live PerfectPanel-compatible suppliers when `SMM_PROVIDER=live`: `smdpanel`, `smmraja`, `justanotherpanel`, and `peakerr`.

Supplier configuration is read from existing environment variables and service maps:

- `SMDPANEL_API_KEY`, `SMDPANEL_SERVICE_MAP`
- `SMMRAJA_API_KEY`, `SMMRAJA_SERVICE_MAP`
- `JAP_API_KEY`, `JAP_SERVICE_MAP`
- `PEAKERR_API_KEY`, `PEAKERR_SERVICE_MAP`

Pricing model:

- Suppliers quote per order from per-1,000 rate cards.
- Customer price applies service-specific markup, platform fee, and minimum margin floor.
- Admin can update service margin bps, max quantity, ETA, enabled state, and preferred supplier.

Reliability model:

- Supplier health is measured via quote probes.
- Health states are `healthy`, `degraded`, or `down`.
- The admin supplier audit combines provider configuration, service map coverage, routing role, and health.

## Catalog

Implemented customer services:

- TikTok Views
- TikTok Likes
- TikTok Followers
- Instagram Followers
- Instagram Likes
- YouTube Views
- YouTube Subscribers
- Telegram Members
- Website Traffic

Website Traffic is seeded as disabled because traffic quality and analytics contamination risk are materially higher.

## Order Lifecycle

Growth lifecycle statuses:

- `PENDING`: held for admin review or manual routing.
- `SUBMITTED`: accepted by supplier.
- `IN_PROGRESS`: supplier reports processing or partial delivery.
- `COMPLETED`: supplier reports complete delivery.
- `FAILED`: supplier submission or manual fulfillment failed.
- `REFUNDED`: admin marked refunded, or supplier cancellation maps to refund state.

Customer transparency fields:

- Order status
- Quantity ordered
- Quantity delivered
- Expected completion
- Destination URL
- Amount paid

## Admin Controls

Admin controls include:

- Service enable/disable
- Margin bps management
- Max quantity management
- Expected completion text
- Preferred supplier routing
- Supplier audit view
- Manual order status override
- Manual delivered quantity override
- Manual supplier reference assignment
- Admin note and failure reason fields

## Risk Report

Policy references checked June 4, 2026:

- YouTube states that artificial increases to views, likes, comments, or other metrics can violate its fake engagement policy and may lead to content/channel action: https://support.google.com/youtube/answer/3399767
- Meta has documented fake likes and shares as spammy inauthentic activity that artificially inflates engagement and violates spam policies: https://about.fb.com/news/2018/10/removing-inauthentic-activity/
- TikTok Community Guidelines prohibit the trade or marketing of services that artificially increase engagement or deceive recommendation systems: https://www.tiktok.com/community-guidelines/en/integrity-authenticity/
- Telegram Terms of Service prohibit using the service to spam or scam users: https://telegram.org/tos
- Google Analytics excludes known bot traffic where possible: https://support.google.com/analytics/answer/9888366
- Google Ads defines invalid traffic to include interactions not caused by genuine user interest, including automated tools, bots, spiders, crawlers, or deceptive software: https://support.google.com/google-ads/answer/11182074

Service risk summary:

| Service             | Platform Policy | Account | Refund | Reputation | Notes                                                                |
| ------------------- | --------------- | ------- | ------ | ---------- | -------------------------------------------------------------------- |
| TikTok Views        | High            | Medium  | Medium | High       | Views may be filtered or reviewed.                                   |
| TikTok Likes        | High            | High    | Medium | High       | Like drops and account integrity checks are likely dispute drivers.  |
| TikTok Followers    | Critical        | High    | High   | High       | Follower services carry the strongest fake-growth exposure.          |
| Instagram Followers | Critical        | High    | High   | High       | Instagram guidance directly calls out artificial followers.          |
| Instagram Likes     | High            | High    | Medium | High       | Artificial likes can be removed and harm trust.                      |
| YouTube Views       | Critical        | High    | High   | High       | YouTube policy directly covers artificial views.                     |
| YouTube Subscribers | Critical        | High    | High   | High       | YouTube policy directly covers artificial subscribers.               |
| Telegram Members    | High            | Medium  | Medium | High       | Member adds can trigger spam reports or moderation.                  |
| Website Traffic     | High            | Medium  | High   | High       | Bot or low-quality traffic can distort analytics and ad attribution. |

Operational mitigations:

- Keep high-risk services capped by default.
- Disable services when supplier health degrades.
- Require public destination URLs.
- Hold manual-review routes in `PENDING`.
- Show risk summaries before order submission.
- Track delivered quantity using supplier `remains` when available.
- Keep website traffic disabled until source quality, bot filtering, and analytics exclusions are approved.
