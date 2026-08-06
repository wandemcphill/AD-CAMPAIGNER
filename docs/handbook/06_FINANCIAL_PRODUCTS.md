# 06 — Financial Products

**Status:** Deepened v1.0. Full state machines and an exhaustive multi-step-operation list, built against the `SagaCoordinator` pattern and hold-and-flag default decided in `02` §6.

> **AMENDED 2026-08-06.** §1 Global Accounts, §3 Virtual Cards, and §4 Remittance now have a real (mock-backed) implementation — `apps/api/src/modules/financial-products`, `packages/providers/src/financial-products.ts`. The saga/hold-and-flag pattern this document specifies is implemented as written: card issuance and remittance sends run through `runChargeSaga` with `hold_and_flag`, matching this document's own reasoning (a provider failure after debit is ambiguous — the resource may have been issued/sent despite a client-side timeout). **No real provider is contracted for any of §1/§3/§4** — see `03`'s amendment for the actual diligence blocker. §2 Wallets and §5 Stablecoin remain entirely unbuilt. §6's Future Expansion products (Gift Cards, Virtual Numbers, VTU/Airtime, Utility Bills) are, contrary to this document's original sequencing, the ones that are actually live — see `12`'s resequenced roadmap.

## Purpose

Defines every user-facing feature: what it does, every state it can be in, and — critically — which operations are multi-step and therefore need saga design per `02` §6. This document is the exhaustive source list `02` deferred to.

## 1. Global Accounts

- Types: Personal, Freelancer, Creator, Business
- Currencies (live): NGN, USD, GBP, EUR — future: CAD, AUD, AED, USDT, USDC
- Providers: Payceler, Swan (primary) → Nium (fallback) — `03`

**State machine:**
```text
requested → (KYC pending, per `08` §1) → active → suspended → closed
                                             │
                                             └─▶ closed (with non-zero balance:
                                                  see multi-step note below)
```

**Multi-step operation — closing an account with a live balance:**
```text
Step 1: initiate_close        idempotent — safe to retry
Step 2: settle_remaining_balance (to preferred_settlement destination, `07` §4)
Step 3: close_at_provider
```
Default policy: do not close at the provider (Step 3) until Step 2 is confirmed via the Ledger — closing first and settling after risks the settlement having nowhere confirmed to land. Failure after Step 2 but before Step 3: hold-and-flag, account stays `active` with a `pending_close` sub-state rather than appearing closed while money is still in motion.

## 2. Wallets

- Providers: SwervPay (primary) → BridgeCard (fallback) — `03`
- Capabilities: balance (derived, `07` §3), funding, withdrawal, transaction history

**State machine:**
```text
active → frozen → active
active → closed
```

Funding sources: bank transfer, card-funded top-up, or internal transfer from another FlipTrybe product (routed through `PaymentService`, `02` §7). Withdrawal destinations: bank account (external) or another FlipTrybe Wallet/Account.

No multi-step saga needed for a single funding/withdrawal operation — each is a single provider call. The exception is card-funded top-up, which is genuinely two steps (charge the funding card, then credit the wallet) and is covered under Virtual Cards below since the funding-card operation lives there.

## 3. Virtual Cards

- Providers: BridgeCard (primary) → SwervPay (fallback); Fyatu (enterprise) — `03`
- Capabilities: create, freeze, unfreeze, top-up, terminate, spending controls, merchant lock (provider-dependent), single-use (provider-dependent)

**State machine:**
```text
draft → created_unfunded → active → frozen → active
                              │                 │
                              └─────────────────┴─▶ terminated
```

**Multi-step operation — create and fund (worked in `02` §6, restated here as the canonical source):**
```text
Step 1: create_card       compensating action: terminate_card (safe, no funds moved)
Step 2: fund_card          on failure after Step 1: hold in created_unfunded,
                             flagged to Admin Portal (`11` §5), NOT auto-terminated
```

**Multi-step operation — terminate with remaining balance:**
```text
Step 1: initiate_terminate
Step 2: refund_remaining_balance (to source Wallet/Account)
Step 3: terminate_at_provider
```
Same ordering logic as Global Account closure (§1) — refund before provider-side termination, hold-and-flag on partial failure rather than risk stranding funds.

## 4. Remittance

- Providers: Payceler (primary) → Technest (fallback) → Nium (global) — `03`
- Capabilities: quote, FX, transfer, track, cancel (provider permitting)

**State machine:** `quoted → locked → debited → payout_initiated → completed`, with `failed` and `held_for_review` reachable from any state after `debited`.

**Multi-step operation — full transfer (this is the highest-stakes saga in the product catalog, per `02` §6):**
```text
Step 1: quote               idempotent, expires after N minutes (configurable per corridor)
Step 2: lock_fx_rate         compensating action: release_lock (safe)
Step 3: debit_source          compensating action: refund_source, BUT if refund itself
                                fails: hold-and-flag, do not auto-retry
Step 4: initiate_payout        on failure after Step 3: hold-and-flag, never
                                 auto-retry payout with the same idempotency key
                                 without confirming Step 3's debit is still valid
                                 against the Ledger
```

**Quote expiry mid-flow:** if `expires_at` (`07` §1, `FXQuote`) passes between Step 1 and Step 2, the saga must re-quote rather than proceed with a stale rate — this is a hard stop, not a warning, since proceeding would settle the user at a rate they didn't agree to.

## 5. Stablecoin Settlement

- Providers: BVNK (primary), Bridge.xyz (secondary), Yellow Card (Africa-regional — see `03` §2/`04` open question on country-based override) — `03`
- Capabilities: fiat→USDT, fiat→USDC, stablecoin payout, stablecoin wallet, fiat withdrawal

**State machine:** `initiated → provider_processing → settled`, with `held_for_review` reachable at any point given this product's elevated AML sensitivity (`08` §2/§8).

**Multi-step operation — fiat to stablecoin:**
```text
Step 1: debit_fiat_source    compensating action: refund_source
Step 2: mint_or_transfer_stablecoin   on failure after Step 1: hold-and-flag —
                                        same policy as Remittance Step 3/4, this
                                        is real money in motion
```

No multi-step saga is meaningfully different from Remittance's pattern here — reuse the same `SagaCoordinator` step definitions rather than inventing a separate pattern for this product.

## 6. Future products (not in v1 scope — tracked here so `12` can sequence them)

Gift Cards, eSIM, Virtual Numbers, VPN, AI, Airtime, Utility Bills, Streaming, Cloud Credits — each must fit the same Provider Adapter + Routing Engine pattern (`02`). No dedicated document until one is scheduled in `12`. Most of these are likely **single-step** operations (unlike the four products above) since they're typically "pay provider, receive digital good" rather than multi-party funds movement — worth confirming per-product when each is actually scoped, but this is a reasonable working assumption that simplifies their saga design relative to Remittance/Stablecoin.

## Resolved (was open in skeleton)

- Full state machines per product → §1–§5.
- Exhaustive multi-step operation list → every saga above, feeding directly into `02` §6's pattern.

## Remaining open questions

- [ ] Quote expiry window (§4) — exact `N` minutes per corridor needs a product/ops decision, likely varies by corridor volatility.
- [ ] Future products' single-step assumption (§6) — confirm per-product once each is actually scoped in a later phase (`12`), don't treat as guaranteed.
