# FlipTrybe — Backend/Frontend Parity Matrix

Generated from source: every `@Get/@Post/@Patch/@Put/@Delete` in `apps/api/src/**/*.controller*.ts`, cross-referenced against every API-path string literal in `apps/web/app` and `apps/admin/app`.

This is the spec for reaching full parity. It supersedes the Stitch mockups as the source of truth for *what must exist*; the mockups govern only *how it looks*.

## Headline

| | Count |
|---|---|
| API endpoints | **354** |
| Wired — exact path match | 298 |
| Wired — via dynamic dispatch | 20 |
| **Unwired — no frontend caller** | **36** |
| Frontend routes (web) | 112 (35 redirect shims) |
| Frontend routes (admin) | 34 |

**10% of the backend has no frontend caller.** That figure is the parity gap.

---

## 1. Client API coverage by domain

| Domain | Endpoints | Wired | Unwired | Owning route | Flag |
|---|---|---|---|---|---|
| Campaigns `/campaigns` | 34 | 32 | **2** | /os/campaigns |  |
| Digital Access `/digital-access` | 6 | 4 | **2** | /os/digital-access |  |
| Growth services `/growth` | 6 | 4 | **2** | /os/growth |  |
| Provider webhooks (inbound) `/api/webhooks` | 2 | 0 | **2** | (server-to-server) |  |
| Trust Engine `/trust-engine` | 2 | 0 | **2** | — none | ⚠️ trustEngine — OFF |
| Provider webhooks (inbound) `/webhooks` | 2 | 0 | **2** | (server-to-server) |  |
| Financial products `/financial-products` | 13 | 12 | **1** | /os/financial-products | ⚠️ virtualAccounts / virtualCards / remittance — ALL OFF |
| Rewards `/rewards` | 10 | 9 | **1** | /os/rewards |  |
| Auth `/auth` | 9 | 8 | **1** | /login, /register |  |
| FX settlement `/v1/settlements` | 6 | 5 | **1** | — none |  |
| Media upload `/media` | 4 | 3 | **1** | /os/library |  |
| Support tickets `/support/tickets` | 4 | 3 | **1** | /os/support |  |
| Live viewers `/live` | 2 | 1 | **1** | — none |  |
| Referrals `/referrals` | 1 | 0 | **1** | — none |  |
| Number webhooks (inbound) `/webhooks/numbers` | 1 | 0 | **1** | (server-to-server) |  |
| VTU / airtime / data / bills `/vtu` | 19 | 19 | 0 | /os/airtime, /os/utilities |  |
| Gift cards `/digital-value` | 10 | 10 | 0 | /os/digital-value |  |
| Virtual numbers `/virtual-numbers` | 8 | 8 | 0 | /os/numbers |  |
| Telecom / intl top-up `/telecom` | 7 | 7 | 0 | /os/telecom |  |
| Guest checkout `/guest` | 6 | 6 | 0 | /guest |  |
| Team `/teams` | 6 | 6 | 0 | /os/team |  |
| Vouchers `/vouchers` | 6 | 6 | 0 | /os/vouchers |  |
| Crypto `/crypto` | 5 | 5 | 0 | /os/crypto |  |
| Personas `/personas` | 5 | 5 | 0 | /os/personas |  |
| Ad accounts + KYC `/ad-accounts` | 5 | 5 | 0 | — none | ⚠️ kycVerification — OFF (KYC route only) |
| Notifications `/notifications` | 5 | 5 | 0 | /os/notifications |  |
| Webhooks `/developer/webhooks` | 5 | 5 | 0 | /os/settings/integrations |  |
| Automation `/automation/workflows` | 4 | 4 | 0 | /os/automation |  |
| SMM (legacy surface) `/smm` | 4 | 4 | 0 | — none |  |
| 2FA `/security/two-factor` | 4 | 4 | 0 | /os/settings/security |  |
| API keys `/developer/api-keys` | 3 | 3 | 0 | /os/settings/api |  |
| Marketplace applications `/marketplace/applications` | 3 | 3 | 0 | /os/marketplace/applications |  |
| Company profiles `/company-profiles` | 3 | 3 | 0 | — none |  |
| Invoices `/invoices` | 3 | 3 | 0 | — none |  |
| RMB `/rmb` | 3 | 3 | 0 | /os/rmb |  |
| Marketplace `/marketplace` | 2 | 2 | 0 | /os/marketplace |  |
| workspace `/workspace` | 2 | 2 | 0 | ? |  |
| Client profile `/client-profile` | 2 | 2 | 0 | — none |  |
| Payments `/payments` | 2 | 2 | 0 | /os/wallet |  |
| Wallet `/wallet` | 2 | 2 | 0 | /os/wallet |  |
| Analytics `/analytics` | 2 | 2 | 0 | /os/analytics |  |
| Reward claim `/claim` | 2 | 2 | 0 | /claim/[token] |  |
| FX rates `/v1/fx` | 1 | 1 | 0 | — none |  |
| (root) `/(root)` | 1 | 1 | 0 | ? |  |
| Health `/health` | 1 | 1 | 0 | (infra) |  |
| Organizations `/organizations` | 1 | 1 | 0 | — none |  |
| Destination catalog `/destinations` | 1 | 1 | 0 | (used by campaigns) |  |
| Search `/search` | 1 | 1 | 0 | /os/search |  |
| Audit `/audit` | 1 | 1 | 0 | /os/campaigns/[id] |  |

## 2. Admin API coverage by domain

| Domain | Endpoints | Wired | Unwired |
|---|---|---|---|
| `/admin/campaign-ops` | 17 | 14 | **3** |
| `/admin/settlements` | 11 | 8 | **3** |
| `/admin/providers` | 8 | 6 | **2** |
| `/admin` | 4 | 2 | **2** |
| `/admin/vtu` | 10 | 9 | **1** |
| `/admin/growth` | 8 | 7 | **1** |
| `/admin/digital-value` | 4 | 3 | **1** |
| `/admin/guest-checkout` | 3 | 2 | **1** |
| `/admin/webhooks/incoming` | 3 | 2 | **1** |
| `/admin/digital-access` | 15 | 15 | 0 |
| `/admin/digital-products` | 11 | 11 | 0 |
| `/admin/marketplace` | 7 | 7 | 0 |
| `/admin/rewards` | 6 | 6 | 0 |
| `/admin/digital-products/fx` | 5 | 5 | 0 |
| `/admin/support/tickets` | 3 | 3 | 0 |
| `/admin/crypto` | 1 | 1 | 0 |
| `/admin/rmb` | 1 | 1 | 0 |

---

## 3. The work list — every unwired endpoint

Each row is a screen or control that does not exist yet. Grouped by domain, ordered by size.

### `/admin/settlements` — admin/settlements (3 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/settlements/:id` | — |
| GET | `/admin/settlements/beneficiaries/:id` | — |
| POST | `/admin/settlements/webhook/:provider` | — |

### `/admin/campaign-ops` — admin/campaign-ops (3 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/campaign-ops/campaigns` | — |
| GET | `/admin/campaign-ops/campaigns/:id` | — |
| GET | `/admin/campaign-ops/campaigns/:id/activity` | — |

### `/digital-access` — Digital Access (2 unwired)
Owning route: /os/digital-access

| Method | Path | Permission |
|---|---|---|
| GET | `/digital-access/requests/:id` | — |
| GET | `/digital-access/services/:slug` | _public_ |

### `/api/webhooks` — Provider webhooks (inbound) (2 unwired)
Owning route: (server-to-server)

| Method | Path | Permission |
|---|---|---|
| POST | `/api/webhooks/korapay` | _public_ |
| POST | `/api/webhooks/korapay-guest` | _public_ |

### `/campaigns` — Campaigns (2 unwired)
Owning route: /os/campaigns

| Method | Path | Permission |
|---|---|---|
| GET | `/campaigns/:id/budget` | audit:read |
| GET | `/campaigns/:id/timeline` | campaign:manage |

### `/growth` — Growth services (2 unwired)
Owning route: /os/growth

| Method | Path | Permission |
|---|---|---|
| GET | `/growth/orders/:id` | — |
| GET | `/growth/risk-report` | _public_ |

### `/admin` — admin (2 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/ai/suggestions` | — |
| POST | `/admin/ai/suggestions` | — |

### `/admin/providers` — admin/providers (2 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| POST | `/admin/providers/:domain/:name/disable` | — |
| POST | `/admin/providers/:domain/:name/enable` | — |

### `/trust-engine` — Trust Engine (2 unwired)
> ⚠️ trustEngine — OFF
Owning route: — none

| Method | Path | Permission |
|---|---|---|
| POST | `/trust-engine/submissions` | analytics:read |
| GET | `/trust-engine/submissions/:submissionId` | campaign:create |

### `/webhooks` — Provider webhooks (inbound) (2 unwired)
Owning route: (server-to-server)

| Method | Path | Permission |
|---|---|---|
| POST | `/webhooks/reloadly` | — |
| POST | `/webhooks/sogo` | _public_ |

### `/admin/digital-value` — admin/digital-value (1 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/digital-value/gift-cards/sell/flagged` | admin:access |

### `/financial-products` — Financial products (1 unwired)
> ⚠️ virtualAccounts / virtualCards / remittance — ALL OFF
Owning route: /os/financial-products

| Method | Path | Permission |
|---|---|---|
| GET | `/financial-products/accounts/:id` | analytics:read |

### `/v1/settlements` — FX settlement (1 unwired)
Owning route: — none

| Method | Path | Permission |
|---|---|---|
| GET | `/v1/settlements/:id` | — |

### `/admin/guest-checkout` — admin/guest-checkout (1 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/guest-checkout/transactions/export` | — |

### `/auth` — Auth (1 unwired)
Owning route: /login, /register

| Method | Path | Permission |
|---|---|---|
| POST | `/auth/exchange` | — |

### `/live` — Live viewers (1 unwired)
Owning route: — none

| Method | Path | Permission |
|---|---|---|
| POST | `/live/boosts` | — |

### `/referrals` — Referrals (1 unwired)
Owning route: — none

| Method | Path | Permission |
|---|---|---|
| POST | `/referrals/accounts` | admin:access |

### `/media` — Media upload (1 unwired)
Owning route: /os/library

| Method | Path | Permission |
|---|---|---|
| POST | `/media/uploads` | campaign:manage |

### `/admin/growth` — admin/growth (1 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| POST | `/admin/growth/orders/:id/override` | admin:access, payment:manage |

### `/rewards` — Rewards (1 unwired)
Owning route: /os/rewards

| Method | Path | Permission |
|---|---|---|
| POST | `/rewards/webhooks/tiktok` | — |

### `/support/tickets` — Support tickets (1 unwired)
Owning route: /os/support

| Method | Path | Permission |
|---|---|---|
| GET | `/support/tickets/:id` | — |

### `/webhooks/numbers` — Number webhooks (inbound) (1 unwired)
Owning route: (server-to-server)

| Method | Path | Permission |
|---|---|---|
| POST | `/webhooks/numbers/:provider` | — |

### `/admin/vtu` — admin/vtu (1 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/vtu/providers/:providerName/balance` | — |

### `/admin/webhooks/incoming` — admin/webhooks/incoming (1 unwired)
Owning route: ?

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/webhooks/incoming/:id` | — |

---

## 4. Screens that call nothing

Non-redirect routes where neither the page nor anything it imports (2 hops) calls the API. Marketing/legal pages are expected here; app screens are not.

| Route | File |
|---|---|
| `/` | apps/web/app/page.tsx |
| `/admin` | apps/web/app/admin/page.tsx |
| `/admin/analytics` | apps/web/app/admin/analytics/page.tsx |
| `/admin/orders` | apps/web/app/admin/orders/page.tsx |
| `/admin/payments` | apps/web/app/admin/payments/page.tsx |
| `/admin/products` | apps/web/app/admin/products/page.tsx |
| `/admin/providers` | apps/web/app/admin/providers/page.tsx |
| `/admin/users` | apps/web/app/admin/users/page.tsx |
| `/os/settings/ai` | apps/web/app/os/settings/ai/page.tsx |
| `/os/settings/wallet` | apps/web/app/os/settings/wallet/page.tsx |
| `/privacy` | apps/web/app/privacy/page.tsx |
| `/terms` | apps/web/app/terms/page.tsx |
| `/welcome` | apps/web/app/welcome/page.tsx |

## 4b. Screens rendering hardcoded mock data

These render invented values. Each is a screen that looks finished and is not.

| Route | File |
|---|---|
| `/admin/orders` | apps/web/app/admin/orders/page.tsx |
| `/admin/payments` | apps/web/app/admin/payments/page.tsx |
| `/admin/products` | apps/web/app/admin/products/page.tsx |
| `/admin/providers` | apps/web/app/admin/providers/page.tsx |
| `/admin/users` | apps/web/app/admin/users/page.tsx |

## 5. Redirect shims (compatibility layer — do not delete)

`/billing` · `/campaigns` · `/campaigns/[id]` · `/campaigns/[id]/financial-history` · `/campaigns/analytics` · `/campaigns/new` · `/digital-access` · `/digital-access/requests` · `/digital-access/requests/[id]` · `/digital-access/services` · `/growth-services` · `/growth-services/orders` · `/growth-services/services` · `/notifications` · `/onboarding` · `/os/data` · `/os/settings` · `/os/settings/api` · `/profile` · `/reports` · `/settings` · `/settings/ai` · `/settings/api` · `/settings/integrations` · `/settings/notifications` · `/settings/profile` · `/settings/security` · `/settings/security/trusted-devices` · `/settings/security/two-factor` · `/settings/team` · `/settings/wallet` · `/settings/workspace` · `/studio` · `/vouchers` · `/wallet`

### Verified by hand

- `/os/settings/api` renders `MOCK_KEYS` while `/developer/api-keys` exposes 3 real endpoints. The screen is a facade over a working API.
- `/os/settings/workspace` hardcodes `useState("FlipTrybe Studio")`, `"fliptrybe-studio"`, `"Africa/Lagos"`. It cannot save.
- `/forgot-password` has three submit handlers (`handleQuestions`, `handlePin`, `handleReset`) and makes no API call. **Password reset is non-functional end to end.**
- `/admin/*` in `apps/web` is 7 mock screens duplicating `apps/admin`, gated on session presence only — no `isPlatformAdmin` check.

---

## 6. Method and limitations

- **Wired** means a matching path string was found in the frontend. It does **not** prove the call is reachable from the UI, sends correct params, or handles errors. Treat as an upper bound on real parity.
- **Dynamic** means the frontend builds the path from a variable (e.g. `` `/campaigns/${id}/actions/${action}` ``), so every literal under that prefix counts as reachable. Nothing statically proves which ones actually are.
- Endpoints defined outside a `*.controller*.ts` file are not counted.
- Server-to-server webhook receivers are listed as unwired and should stay that way — they are called by providers, not the UI.