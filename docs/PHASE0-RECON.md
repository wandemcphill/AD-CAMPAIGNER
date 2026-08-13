# Phase 0 — Repository & Architecture Reconnaissance

Status: **discovery only, no implementation performed**
Scope: inputs for the FlipTrybe customer-experience restructuring program.

---

## 0. Blocking finding: this program is already in flight in a second session

Commit `39c0a87` ("Restructure customer UX: nav IA, command-centre home, auth
boundary, 18+ age gate") already executed material parts of this brief:

| Brief phase | Status | Where |
|---|---|---|
| Phase 4 — navigation IA | **DONE** | `apps/web/app/os/shell.tsx` — flat ~40-item sidebar collapsed to Home/Growth/Money/Services/Marketplace/Rewards + Account group |
| Phase 5 — home command centre | **DONE** | `apps/web/app/os/page.tsx` — wallet band + cross-domain quick actions |
| Phase 6/17 — customer/admin security boundary | **DONE** | AI config, API keys and webhook GETs moved from `analytics:read` to `admin:access` |
| 18+ age gate | **DONE** | `age.guard.ts`, `User.dateOfBirth`, applied to financial-products + campaign creation |
| Phase 10 — Money workspace | **IN PROGRESS, UNCOMMITTED** | `apps/web/app/os/money/`, `apps/api/src/modules/invoices/`, `schema.prisma`, `feature-flags` all dirty in the working tree right now |

Any implementation started now against `os/shell.tsx`, `os/money/**`,
`modules/invoices/**`, `schema.prisma` or `feature-flags` will collide with
uncommitted concurrent work.

---

## 1. Financial products are OFF by default, under an explicit governance rule

`packages/feature-flags/src/index.ts`:

```
virtualAccounts:    false
virtualCards:       false
remittance:         false
walletWithdrawals:  false
kycVerification:    false
kybVerification:    false
```

The file carries a standing instruction:

> Financial products default to DISABLED until each provider integration is
> sandbox-verified end-to-end … **Do not flip these defaults on from code** —
> enable them per-environment via `FEATURE_*` env after sign-off … the flag only
> opens the API surface: a request still needs an ENABLED `ProviderConfig` row
> for its domain or it fails with 503.

**Consequence for the brief.** The brief asks that financial products be "one of
the strongest sections of the site", featuring multi-currency accounts, virtual
cards and remittance corridors. The brief *also* mandates (rules 13, 15, 44, and
non-negotiable rule 13) that product claims match actual supported capability and
that nothing be presented as live when it is not.

These two requirements are in direct tension **today**. The homepage may present
these products, but must label them per their real state (early access / coming
soon / selected markets) unless and until the flags are enabled per environment
with ProviderConfig rows seeded. This is a product decision, not a coding one —
see "Decisions required" below.

## 2. Multi-currency: schema-capable, not live

- `Wallet` is keyed `@@unique([workspaceId, currency])` — the data model
  genuinely supports one wallet per currency per workspace.
- `calculateAvailableBalance` (`packages/payments/src/index.ts:36`) **throws** on
  mixed-currency entries, and defaults to `NGN`.
- ~40 `currency` columns across the schema default to `"NGN"`; the USD defaults
  are confined to gift-card / digital-value models.
- Commit `39c0a87` describes the new home band as "real **single-currency**
  Available/Held balances".

**Verdict:** NGN is the live wallet currency. USD/GBP/EUR multi-currency balances
are *not* live and must not be presented as if they were.

## 3. Guest checkout is already a strong first-class product

`apps/api/src/modules/guest-checkout/` + `GuestProductType`:

```
AIRTIME  DATA  ELECTRICITY  CABLE  BETTING  EDUCATION
```

Already implemented: `@Public()` checkout/payment/status/receipt/returning
routes, idempotency keys with duplicate short-circuit
(`findRecentDuplicate`), throttling by email/phone/IP (`assertNotThrottled`),
receipt summaries, returning-customer lookup, and guest→account migration
(`migrate`).

**Gaps vs the brief:** gift cards and international top-up are **not** in
`GuestProductType`. The brief lists them as guest services. Adding them is real
backend work, not a UI change.

## 4. Route duplication is the largest structural debt

Legacy top-level routes and their `/os/*` twins **both exist as real pages**:

```
/campaigns          /os/campaigns
/wallet             /os/wallet
/marketplace        /os/marketplace
/settings/*         /os/settings/*        (11 pages each)
/vouchers           /os/vouchers
/notifications      /os/notifications
/reports            /os/reports
/team               /os/team
/studio             /os/studio
/personas           /os/personas
/library            /os/library
/search             /os/search
/profile            /os/profile
/digital-access/*   /os/digital-access/*
/growth-services/*  /os/growth/*
/developer          /os/settings/api
```

The canonical route map (`fliptrybe_route_map_canonical_vs_legacy.json`) says
legacy routes should be **301/307 redirects** to `/os`. They are currently
duplicate implementations. This is ~30 routes of drift and the single highest-value
cleanup available.

## 5. Backend capability inventory (condensed)

| Domain | Backend | Flag | Notes |
|---|---|---|---|
| Wallet / ledger | **Real** | — | NGN only, `LedgerEntry` + idempotency |
| Airtime / Data | **Real** | `vtu` on | Multi-provider router, 6+ adapters onboarded |
| Electricity / Cable / Education / Betting | **Real** | on | via VTU provider router |
| Guest checkout | **Real** | `guestCheckout` on | 6 product types, see §3 |
| Gift cards (buy/sell) | **Real** | on | account-only, not guest |
| Crypto sell / RMB | present | on | not audited this pass |
| Virtual accounts | adapters complete | **OFF** | needs sandbox sign-off + ProviderConfig |
| Virtual cards | adapters complete | **OFF** | same |
| Remittance | adapters complete | **OFF** | corridors not verified live |
| FX | module exists (`modules/fx`) | — | rate cache + Fincra provider implemented |
| KYC / KYB | **OFF** | OFF | gating exists; flows not enabled |
| Invoices / Payment links | **being built now** | on | concurrent session, uncommitted |
| Ad campaigns (Meta/Google/TikTok) | **MOCK placement** | — | SMM + payments are real; ad placement is not |
| Rewards | **Real** | on | gated controllers + worker queue |
| Marketplace | **Real** | — | creators/agencies/applications |

**The ad-placement point matters for the brief's Growth section:** the brief wants
Growth positioned on Meta/Google/TikTok advertising. Ad *placement* is currently a
mock adapter; SMM/growth-services and payments are real.

## 6. Security posture

- `AuthorizationGuard` fails closed; `admin:access` resolves solely from
  `isPlatformAdmin`.
- `AgeGuard` fails closed on null/<18, applied to financial-products + campaign creation.
- `FeatureFlagGuard` present (`RequireFeature`).
- The three known customer-facing leaks (AI provider/system prompt config, API
  key metadata, webhook metadata via `analytics:read`) were **already fixed** in
  `39c0a87`.
- Remaining brief item: the brief asks that API-key generation not sit in customer
  settings at all. Today `/os/settings/api` still exists as a customer route,
  gated on `isPlatformAdmin` at the link level and `admin:access` at the API.
  Decide: move to a real Developer surface, or to Admin.

---

## Decisions required before implementation

1. **Concurrency.** How is work divided with the other live session? Overlapping
   files today: `os/shell.tsx`, `os/money/**`, `modules/invoices/**`,
   `schema.prisma`, `feature-flags`.
2. **Financial-product truthfulness.** Flags are off and code forbids enabling
   from code. Does the homepage present these as *coming soon / early access*, or
   is there sign-off to enable specific flags per environment first?
3. **Multi-currency.** NGN is the only live wallet currency. Present USD/GBP/EUR
   as roadmap, or scope real multi-currency wallet work?
4. **Remittance corridors.** Which corridors are genuinely supported? Brief rule
   15 forbids showing unsupported corridors.
5. **Guest gift cards / international top-up.** Not in `GuestProductType`. Add
   backend support, or drop from the guest story?
6. **Artificial-engagement SMM.** Brief §15 says de-emphasise publicly. SMM is a
   real revenue path today. Confirm: remove from public positioning only, keep
   backend + in-app?
