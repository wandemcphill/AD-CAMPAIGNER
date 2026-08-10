# Financial Routing Decision — Fincra vs Swappr

Status as of 2026-08-08 (session 3). This document exists specifically to
answer the routing question posed at the end of the last session, using the
evidence gathered in `provider-capability-matrix.md`.

## The actual current blocker (more fundamental than economics)

**Fincra has no code adapter implementing the `RemittanceProvider` interface.**

`apps/api/src/modules/financial-products/financial-products.service.ts`'s
`buildRemittanceAdapter(providerName)` only has cases for `"swappr"` and
`"yativo"`. The existing Fincra code
(`createFincraSettlementProvider`/`createFincraFxProvider` in
`packages/providers/src/index.ts`) implements **different interfaces**
(`SettlementProvider`/`FxProvider`) consumed by the separate `apps/api/src/modules/fx/`
module — not `RemittanceProvider`, and not reachable from
`financial-products.service.ts` at all.

**This means the Fincra-vs-Swappr routing question is currently moot at the
code level** — Fincra cannot be selected by `ProviderRouterService` for the
`REMITTANCE` domain today regardless of how good its sandbox evidence looks,
because nothing implements the interface the router expects. Writing that
adapter is real, non-trivial work (mapping `RemittanceProvider.sendTransfer`
onto `POST /disbursements/payouts`, handling the `customerReference`
duplicate-rejection idempotency model correctly, deciding how/whether to wire
the genuinely-locked quote flow) — it has **not** been done this session,
consistent with the instruction not to switch production routing yet.

## Routing decision

Per the instruction, the options were:

1. FINCRA PRIMARY
2. SWAPPR PRIMARY
3. FINCRA + SWAPPR ROUTING BY CAPABILITY
4. KEEP BOTH DISABLED UNTIL FURTHER EVIDENCE

**Recommendation: (4) KEEP BOTH DISABLED, with a specific next step — not (3)
yet.** Evidence does not yet support (3) as an implementable decision, because
"route by capability" presumes both providers have adapters to route *to*.
Only Swappr does. The evidence gathered *does* point toward a future (3):

- Fincra's **locked quote** is a real advantage Swappr structurally cannot
  match (`supportsLockedQuotes: false` is Swappr's honest, permanent
  declaration — not a gap to close).
- Swappr's **NGN payout path is code-complete and proven** (adapter exists,
  live-verified twice across two sessions, including idempotency and balance
  reconciliation).
- Fincra's **NGN payout API is proven** but has **no adapter** and a
  **materially different idempotency model** that the current
  ambiguous-failure code (`financial-products.service.ts`'s
  `classifyFallbackSafety` integration) has not been exercised against.

So the evidence-supported shape *for later* is closer to option 3
(Fincra for locked-quote FX / cross-currency, Swappr for NGN payout where
already proven) — but declaring that now would be choosing an architecture
ahead of the adapter that would implement it, which is exactly the
"optimizing for the appearance of completion" the instructions warn against.

**Both remain disabled.** No feature flag or `ProviderConfig`/
`ProviderCapabilityGrant` row was flipped to enabled this session.

## Whether Fincra should become primary

**Not yet — not because of any newly discovered problem with Fincra, but
because "primary" presumes a working adapter, which does not exist.** Once an
adapter exists and is sandbox-verified end-to-end (including a real webhook
delivery, which is currently blocked on a dashboard setting only you can
change), the locked-quote advantage is a strong argument for Fincra handling
the FX/cross-currency leg specifically.

## Whether Swappr should remain fallback

**Swappr should remain the only enabled-when-ready path for NGN payouts for
now**, because it is the only one with a working, tested adapter — but it is
currently **operationally blocked** in this environment by its IP allowlist
(`403 ip_not_allowed`), which is a deployment/infra concern, not a code or
compliance one. "Fallback" language should probably become "primary until
Fincra has a real adapter", not "fallback to a proven path when the
untested one fails" — there is nothing to fall back *from* yet.

## What would change this recommendation

1. A `FincraRemittanceProvider` adapter is written and unit-tested against
   the documented shapes confirmed this sprint (§D/§C of `fincra.md`).
2. It is sandbox-verified: payout create → status → idempotency-conflict
   handling (accounting for Fincra's reject-not-replay model) →
   ambiguous-failure path exercised.
3. Fincra webhooks are enabled on the dashboard (your action — see `fincra.md` §F)
   and at least one real event is received and verified against
   `verifyFincraWebhook()`.
4. Swappr's IP allowlist is fixed for this environment (or a static-egress
   proxy is in place for whichever environment actually runs production
   traffic).
5. `ProviderCapabilityGrant` rows exist for both providers with their real
   gates (§I below) and the router is changed to actually read them.

## §I — Provider capability registry enforcement (design, not yet built)

`ProviderCapabilityGrant` (added last session) already models the gate ladder
requested: `documented → implemented → sandboxVerified → kybApproved →
complianceApproved → productionApproved → enabled`, all defaulting to
`false`. What's still missing, and deliberately not built this session
(schema/data changes only, no behavior change, per "do not enable production
capabilities automatically"):

- **No rows have been seeded.** The table exists; nothing has been inserted
  for Fincra or Swappr yet. Seeding rows for capabilities that are only
  `documented: true` / `sandboxVerified: true` (per the matrix above) with
  every other gate `false` would be the correct next step — it makes the
  current, real state queryable without granting anything.
- **`ProviderRouterService.select()` does not consult `ProviderCapabilityGrant`
  at all.** It currently ranks only on `ProviderConfig.status`/`priority` and
  `ProviderHealth`. Making the grant table authoritative means adding a check
  — a candidate is only `available` if the specific `FinancialCapability` it's
  being asked to serve has `enabled: true` on its grant row — **in addition
  to** the existing health/status checks, not instead of them. This is a
  `packages/providers/src/router.ts` change (`selectProviders`) and has not
  been made — flagged as required, not done, to avoid rushing a change to
  shared routing logic in the same pass as the audit.

## §L — No-blind-failover invariant (implemented and tested)

This was implemented in the previous session and is unchanged/re-confirmed
this session:

- `classifyFallbackSafety()` — `packages/providers/src/contract.ts`, 9 unit
  tests in `fallback-safety.test.ts`.
- `sendRemittance()`'s ambiguous-failure branch —
  `apps/api/src/modules/financial-products/financial-products.service.ts` —
  now has a **deterministic integration test**
  (`financial-products.service.test.ts`, new this session) proving: a
  provider timeout → `RECONCILIATION_REQUIRED` (never `FAILED`) → exactly one
  `sendTransfer` call (no second/fallback provider invoked) → a
  `FinancialReconciliationException` opened. A definitive pre-acceptance
  rejection (`400`) correctly still becomes `FAILED` with no exception opened.

This invariant is provider-agnostic — it will apply to a future Fincra
adapter exactly as it applies to Swappr today, with no special-casing needed.

## Update (2026-08-10) — both §I gaps closed

Both blockers named in §I above are now resolved at the code level. Neither
changes what's *enabled* in production — both remain off.

1. **`createFincraRemittanceProvider` now exists**
   (`packages/providers/src/financial-products.ts`), implementing
   `RemittanceProvider` against the live-verified sandbox endpoints from the
   2026-08-10 verification sprint (`POST /quotes/generate`,
   `POST /disbursements/payouts`,
   `GET /disbursements/payouts/reference/{ref}`). It declares
   `supportsLockedQuotes: true` (live-confirmed) and
   `supportsBeneficiaries: false` (unverified). `sendTransfer` requires an
   `idempotencyKey` and documents Fincra's reject-not-replay 422 behavior on a
   reused `customerReference` rather than papering over it. Wired into
   `financial-products.service.ts`'s `buildRemittanceAdapter` under
   `case "fincra"`, reading `FINCRA_API_KEY`/`FINCRA_BUSINESS_ID`/
   `FINCRA_BASE_URL`/`FINCRA_WEBHOOK_ENCRYPTION_KEY`. A `fincra-remittance`
   `ProviderConfig` row was added to `seed-financial-products.ts` —
   `status: "DISABLED"`, same as every other row there. 16 new unit tests in
   `financial-products.test.ts`.

2. **`ProviderRouterService.select()` now consults `ProviderCapabilityGrant`.**
   `apps/api/src/modules/providers/provider-router.service.ts` adds a hard
   gate: a provider is only routable if it holds an `enabled: true`
   `ProviderCapabilityGrant` row for that domain, in addition to the existing
   `ProviderConfig`/`ProviderHealth` checks. `NO_CANDIDATE`
   `ProviderRoutingAttempt` rows now distinguish "no ProviderConfig" from
   "configured but ungranted" in their `reason` text. A seed script,
   `packages/database/prisma/seed-provider-capability-grants.ts`
   (`pnpm --filter @fliptrybe/database seed:provider-capability-grants`),
   grants rows for all five financial-products `ProviderConfig` entries
   (swappr-virtual-account, swappr-remittance, payscribe-virtual-card,
   yativo-remittance, fincra-remittance) — every row seeded with
   `enabled: false`, matching each capability's real, currently-unverified or
   sandbox-only status; `fincra-remittance` is the only row with
   `sandboxVerified: true`. **This gate applies to every domain
   `ProviderRouterService` serves, not just financial-products** — it was the
   only real caller of `selectProviders()` at the time of this change (vtu/
   virtual-numbers/etc. use separate routing services), so nothing else was
   affected, but any future caller must seed a grant row or its routing will
   silently return `NO_CANDIDATE`.
   `provider-router.service.test.ts` (new) unit-tests the gate directly with
   a mocked Prisma client.

Since every `ProviderConfig` row for financial-products is still
`status: "DISABLED"` and every `ProviderCapabilityGrant` row is still
`enabled: false`, **routing behavior in production is unchanged** — this is
the adapter/gate infrastructure the routing decision above was blocked on,
not a decision to enable anything.
