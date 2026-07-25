# FlipTrybe — Phase 1 Build Plan

> Status: planning. Derived from a codebase audit on 2026-07-25. This is the concierge-first,
> risk-gated MVP that turns the existing managed-ads platform into the three-engine architecture.

## 1. Thesis (one paragraph)

FlipTrybe is the easiest way for an African SME to buy advertising. The customer buys **simplicity
and trust, not automation** — "I paid ₦25,000 and customers started messaging me." Automation is an
internal concern that grows behind an unchanged customer experience. Ads placement starts **concierge
(human-in-the-loop)** and graduates to API automation **gated by risk, not by customer type**.

## 2. Three account types (KYC from everyone, scaled to risk)

| Type | Whose ad account | Who funds | KYC tier | Launch behavior | For |
|------|------------------|-----------|----------|-----------------|-----|
| **Connected** | User's own (OAuth) | User | Light | Auto (their account) | Freelancers, pros, some companies |
| **Managed (shared pool)** | FlipTrybe shared infra; user has a Naira wallet | FlipTrybe | Standard | Auto if GREEN, else human | Mass-market small sellers |
| **Dedicated (create-on-behalf)** | Real account FlipTrybe provisions for them | FlipTrybe | Enhanced | Same rule, stricter thresholds | High-spend / companies |

Automation logic is **identical** across types — only the destination ad account and the risk
thresholds change. Dedicated accounts give companies blast-radius isolation from the shared pool.

## 3. Differentiated experiences per tier (the "3 dashboards")

- **Studio (Managed, mass-market sellers):** one-screen flow — *what do you want more of → paste link →
  city → budget → pay → launch*. Everything else invisible.
- **Pro (Connected, freelancers/agencies):** multi-client workspaces, per-client approval links,
  campaign templates / **SOPs-playbooks**, duplicate campaigns, bulk ops, unified reporting, markup/margin.
- **Company / Enterprise (Dedicated):** full campaign controls (create / pause / cancel / resume),
  granular **spend controls** (daily caps, budget holds), **creative controls** (versions, approval,
  brand assets), multiple campaign types & objectives, team roles/permissions, deeper analytics, and a
  first-class **AI campaign assistant**.
- **Ops (internal, admin app):** the concierge queue — review, risk triage, manual launch, reporting.

## 4. World-class AI assistant (honest status)

Desired: a top-notch AI assistant, especially for companies — recommend platform mix, allocate budget,
generate ad copy/creative suggestions, pick audiences, monitor and advise. **Current state: the AI
provider is a mock** (`createMockAiProvider`, `AI_PROVIDER=mock`); an `ai-brain` client stub exists.
So this is a real build (Phase 1/2), not a wiring change. Phase-1 schema is designed to support it
(the 3-layer data exhaust feeds recommendations); the assistant itself is scoped, not assumed free.

## 5. Three engines, mapped to the codebase

### Campaign Engine — collect goal/audience/budget/link → normalized spec
- **Exists:** `Campaign` / `Destination` / `LivePromotion` models; `managed-ads.service.createCampaign`;
  web `apps/web/app/campaigns/new`; quoting via `AdsProviderAdapter.quoteCampaign`.
- **Gaps:** the simple one-screen wizard (current flow is ops-shaped); a platform-agnostic `CampaignSpec`;
  confirm targeting captures city/age/gender/interests (`Campaign.targetAudience` Json today).

### Risk Engine — score advertiser + campaign → auto / human / reject
- **Exists as pattern:** `assessSmmOrderFraud` / `assessOtpFraud` return `{ score, action: ALLOW|REVIEW|BLOCK }`
  and already route ALLOW→auto, REVIEW→human, BLOCK→reject in SMM/OTP. Digital-access stores `riskScore`.
- **Gap:** `assessCampaignRisk` (content category green/yellow/red + advertiser KYC/history + account-type
  thresholds), wired to queue routing.

### Execution Engine — normalized spec → platform API; track status
- **Exists:** `AdsProviderAdapter` interface (the connector seam); the **manual** connector is fully built
  (`ManualAdPlacement` + `createManualPlacement` + `addManualMetric` + ops dashboard). `createMockAdsProvider`
  is the placeholder auto connector.
- **Gaps:** grow `AdsProviderAdapter` to ad-set/creative/ad + status polling; `CampaignSpec → Meta payload`
  mapper (used **now** to pre-fill the human's manual placement — the "spec sheet"); `createMetaAdsProvider`
  against the Marketing API (**gated on Meta API approval**).

## 6. Net-new pieces

- **AdAccount abstraction + tiered KYC** — financial core exists (`Wallet`/`LedgerEntry`/`PaymentIntent`/
  budget holds); the account-type layer does not. Added in step 1 (below).
- **Layer-3 instrumentation** — Layers 1–2 exist (`CampaignReport`, `CampaignSpendEntry`, `AnalyticsMetric`,
  manual metrics). Business-outcome capture is new (`CampaignOutcome` + one-tap WhatsApp "👍/👎 run again?").

## 7. Payment

Korapay wired (`createKorapayPaymentGateway` + webhook). Add `createPaystackPaymentGateway` (same
`PaymentGatewayAdapter`) + gateway failover. **Meta funds in Naira directly** (no USD cards / no Kora
Issuing / no PCI-DSS for a Meta-first v1). USD virtual cards (Kora Issuing) only needed later for
TikTok/Google — and their acceptance for ad-spend MCCs must be confirmed with Kora before committing.

## 8. Step 1 — schema foundation (this change)

New enums: `AdAccountType`, `AdAccountStatus`, `AdPlatform`, `KycTier`, `KycStatus`,
`CampaignRiskAction`, `CampaignOutcomeSource`.
New models: `AdAccount`, `CampaignRiskAssessment`, `CampaignOutcome`.
`Campaign` gains `adAccountId`, `riskAction`, `riskScore` (+ relations & indexes); `Wallet` and
`Workspace` gain `adAccounts` back-relations. Actor references (`connectedByUserId`, `assessedByUserId`,
`capturedByUserId`) are stored as user-id strings (no FK relation) to keep the change contained.

To apply (requires a working install — see note): `pnpm prisma:generate` then
`prisma migrate dev --name add_ad_accounts_risk_outcomes`.

## 9. Build order (Phase 1)

1. **Migrations** — `AdAccount` + account types + risk fields + Layer-3 outcome (this step).
2. **Risk Engine** — `assessCampaignRisk` (reuse SMM pattern) + queue routing.
3. **Campaign Engine** — one-screen wizard → `CampaignSpec`.
4. **Execution (manual-first)** — `CampaignSpec → Meta payload` prefill into the existing ops queue.
5. **Payment** — Paystack adapter + failover; Meta-Naira funding.
6. **Instrumentation** — `CampaignOutcome` capture + one-tap prompt.
7. **Company controls & AI assistant** — full create/pause/cancel/spend/creative controls surfaced per
   tier; AI assistant (replace mock) fed by the data exhaust.
8. **Parallel external clock** — Meta Marketing API approval → `createMetaAdsProvider` → GREEN auto-launch
   for Connected (Type 1) first, then GREEN Managed.

Items 1–7 need nothing external. Only item 8 waits on Meta.

## 10. Not now

TikTok / Google connectors, Kora Issuing / USD cards / PCI-DSS, telecom & bank distribution,
cross-platform ML optimization, autonomous budget reallocation.

## Note on environment

Local `node_modules` is currently incomplete (vitest/prisma binaries missing); `pnpm install` is
required before `prisma generate` / `migrate` / tests can run.
