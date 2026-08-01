# FlipTrybe Trust Engine — Product Requirements Document

**Status:** Phase 0 — Design. Not implemented.
**Owner:** Platform / Trust & Safety
**Version:** 0.1

---

## 1. Purpose

The Trust Engine is a **platform-owned verification service** that validates every
user-submitted digital asset *before* it reaches any external provider, wallet
credit, or payout.

It exists because FlipTrybe is an orchestration business, not a regulated one. We
delegate regulated activity (card redemption, FX, settlement) to partners. What we
own — and what partners will not do for us — is **the quality of what we hand them**.

Sogo's onboarding condition (prove we prevent invalid submissions before gift-card
sell API access is granted) is the *trigger*, not the *requirement*. The requirement
is that FlipTrybe never forwards garbage, fraud, or duplicates to any partner, ever,
for any asset class.

### 1.1 The one-sentence contract

> Given an arbitrary user-submitted digital asset, the Trust Engine returns a
> deterministic, auditable, explainable verdict — `ACCEPT`, `REVIEW`, or `REJECT` —
> together with machine-readable reasons and a human-readable message, without any
> knowledge of which provider (if any) will ultimately receive it.

The final clause is the architectural core. The Trust Engine must be *provider-blind*.

---

## 2. Scope

### 2.1 In scope

| Capability | Phase |
|---|---|
| Asset intake, file safety, normalisation | 2 |
| Content classification (is this even a gift card?) | 3 |
| OCR / text extraction | 4 |
| Image quality assessment | 5 |
| Brand-specific rule validation | 6 |
| Duplicate & near-duplicate detection | 7 |
| E-code / serial format validation | 8 |
| Fraud scoring (submission-level) | 9 |
| Trust scoring (actor-level) | 10 |
| Verdict arbitration & moderation queue | 9–10 |
| Handoff contract to Provider Router | 11 |
| Admin review surface | 13 |
| Analytics & exports | 14 |

### 2.2 Explicitly out of scope (non-goals)

The Trust Engine **does not**:

1. **Talk to providers.** Not Sogo, not Cardtonic, not anyone. It emits a validated
   `AssetSubmission` and stops. Provider selection, submission, retry, callbacks and
   settlement belong to the Provider Router and the owning domain service.
2. **Move money.** No ledger writes, no wallet holds, no payouts. It has no access to
   `LedgerEntry`. The calling domain service decides what a verdict is worth.
3. **Price anything.** Rates, markups, FX and payout calculation stay in
   `DigitalValueService` / `FxService`.
4. **Own the user relationship.** No notifications, no emails. It emits events; the
   notification service decides.
5. **Decide business policy.** It computes scores and applies *configured* thresholds.
   It does not hardcode "reject below 40". Ops owns thresholds.
6. **Replace KYC.** Identity verification (`KycTier`, `KycStatus`) is a separate
   concern that the Trust Engine *reads* as a signal but never writes.
7. **Guarantee the card has value.** Only the provider can confirm redeemable balance.
   The Trust Engine asserts *plausibility and integrity*, never *value*.

Point 7 must be communicated to Sogo explicitly. Over-promising here is how this
relationship breaks.

---

## 3. Goals

### 3.1 Primary

| # | Goal | Measure |
|---|---|---|
| G1 | Block invalid submissions before they reach a provider | ≥95% of non-gift-card uploads (selfies, cars, screenshots, random objects) rejected at intake |
| G2 | Never silently reject a valid submission | Every `REJECT` carries a reason code + user-facing remedy; false-reject rate <2% measured against moderator overturns |
| G3 | Provider independence | Adding provider #2 requires **zero** changes to any file under the Trust Engine package |
| G4 | Asset-class independence | Adding "Airtime PIN" as an asset class requires new *configuration + a validator plugin*, not new pipeline code |
| G5 | Full auditability | Every verdict reconstructible from stored evidence, including which config version produced it |
| G6 | Explainability | A moderator can answer "why was this rejected?" in one screen without reading code |

### 3.2 Secondary

- Latency: p95 end-to-end verdict ≤ 8s for a single-image submission; p95 intake
  acknowledgement ≤ 800ms.
- Cost: per-submission external inference cost capped and configurable; pipeline
  short-circuits on cheap checks before expensive ones (see §4.2 of the architecture doc).
- Zero secret leakage: card PINs and e-codes never appear in logs, metadata JSON,
  analytics, or error messages.

---

## 4. Stakeholders

| Stakeholder | Interest | What they need from this system |
|---|---|---|
| **Sellers (end users)** | Get paid fast, understand rejections | Fast verdict, plain-English remedy, no false rejects |
| **Sogo & future providers** | Low invalid-submission rate | Demonstrable pre-screening; auditable stats |
| **Ops / Moderators** | Manage the grey zone | Review queue, evidence in one place, override with reason |
| **Trust & Safety** | Detect organised fraud | Cross-actor signals, velocity, duplicate rings |
| **Finance** | No payouts on worthless assets | Verdict gate before any hold or credit |
| **Engineering** | Not rewriting this in 6 months | Stable interfaces, plugin model, strong types |
| **Compliance** | Defensible decisions, data minimisation | Audit log, retention policy, secret handling |

---

## 5. Constraints

### 5.1 Technical

- **Must fit the existing monorepo.** NestJS module in `apps/api`, domain logic in a
  `services/trust-engine` bounded context, shared types in `@fliptrybe/types`,
  adapters in `@fliptrybe/providers`. No new runtime service.
- **Must reuse existing tables** where they already model the concept:
  `MediaAsset` (uploads, checksum), `AuditLog`, `ProviderConfig`, `ProviderHealth`,
  `ProviderRoutingAttempt`. Forking these is rejected — see ADR-002.
- **Money is minor units, integers.** Inherited from `packages/payments`.
- **Feature-flagged.** New flags `trustEngine`, `trustEngineAdmin` gate API routes and
  worker queue registration, per CLAUDE.md.
- **BullMQ for async work.** New queue `trust-engine` declared in all three exports of
  `apps/worker/src/queues.ts`.
- **`exactOptionalPropertyTypes` is on.** Recent commits show this; all optional fields
  need conditional spreads.

### 5.2 Product / operational

- The current gift-card sell path is **feature-flagged off** (`giftCardSell: false`)
  and provider-mocked. The Trust Engine can therefore be built and hardened *before*
  live traffic — a genuine advantage that should not be squandered by shipping it
  half-wired.
- ML/CV capability is not currently in the stack. Classification, OCR and quality
  scoring require an external inference provider. This is an adapter, not a
  dependency — see ADR-004.
- Nigerian mobile reality: submissions arrive from low-end Android over poor
  connectivity. Large uploads and long synchronous waits are hostile. Intake must
  acknowledge fast and validate async.

### 5.3 Legal / data

- Gift card codes are bearer instruments. Possession = value. Treated as **secrets**,
  encrypted at rest, never logged, redacted in every read path except an explicitly
  audited moderator reveal.
- Uploaded images may incidentally contain PII. Retention is time-bounded and
  configurable; perceptual hashes outlive the images so duplicate detection survives
  image deletion.

---

## 6. Acceptance criteria

Phase 0 is accepted when the PRD, architecture, database design, API spec and
configuration model are reviewed and the open decisions in §8 are resolved.

The **programme** is accepted when all of the following hold:

| # | Criterion | Verification |
|---|---|---|
| A1 | A selfie, a car photo, a screenshot, a random object and a blank image are all rejected with distinct reason codes | Fixture corpus test, Phase 3/5 |
| A2 | A cropped/partial gift card is rejected with `PARTIAL_CARD_VISIBLE` | Fixture corpus test, Phase 5 |
| A3 | A truncated e-code is rejected with `ECODE_LENGTH_INVALID` without ever being sent to a provider | Unit test, Phase 8 |
| A4 | Re-uploading the same image returns `DUPLICATE_EXACT`; a re-crop/re-compress returns `DUPLICATE_NEAR` | Integration test, Phase 7 |
| A5 | Adding a second provider requires no diff inside `services/trust-engine` | Reviewed diff, Phase 11 |
| A6 | Adding a new brand requires only a `BrandRuleSet` row | Integration test, Phase 6 |
| A7 | Adding a new asset class requires a validator plugin + config, no pipeline edit | Integration test, Phase 16 |
| A8 | No card code appears in any log line, metadata blob, analytics row or error payload | Automated scan in `pnpm verify` |
| A9 | Every verdict replays to the same result given the same evidence + config version | Determinism test, Phase 15 |
| A10 | Provider outage degrades to queue, never to silent accept | Failure-injection test, Phase 15 |
| A11 | `pnpm verify` passes | CI |

**A10 is the one that protects the business.** The default on every failure — inference
down, OCR timeout, config missing, unknown brand — is `REVIEW`, never `ACCEPT`.
Fail-closed is non-negotiable and is asserted by test, not by convention.

---

## 7. Future roadmap

The pipeline is defined over a generic `AssetSubmission`, not a gift card. Asset
classes are configuration + a validator plugin.

| Wave | Asset class | New work required |
|---|---|---|
| 1 | Gift card image | Full pipeline (Phases 2–8) |
| 1 | Gift card e-code | Intake (text) + Phase 8 only |
| 2 | Recharge voucher / Airtime PIN | Format ruleset + brand config |
| 2 | Digital coupon / promo code | Format ruleset |
| 3 | Lottery ticket | New classifier label + quality profile |
| 3 | KYC document | New classifier label; reuses quality + duplicate + fraud |
| 4 | Creative assets (ads) | Reuses classification + quality; different verdict policy |

Wave 4 is worth noting: FlipTrybe already moderates ad creatives
(`services/moderation`). Long term the Trust Engine subsumes that, which is a second
independent justification for the generic abstraction.

---

## 8. Open decisions requiring sign-off

These change the shape of the build and are flagged now rather than discovered in
Phase 9. Each has a recommendation.

**D1 — Submission model: generic or gift-card-specific?**
The brief lists `GiftCardSubmission`. The same brief demands that adding asset classes
requires no redesign. These conflict.
*Recommendation:* one `AssetSubmission` table with a discriminating `assetClass` and a
typed per-class profile row. Rejecting this means a rewrite at wave 2.

**D2 — Inference provider for classification/OCR.**
Options: cloud vision API (fast, per-call cost, data leaves NG), self-hosted model
(no per-call cost, ops burden), or hybrid (cheap local heuristics first, cloud only on
ambiguity). *Recommendation:* hybrid, behind an `AssetInferenceAdapter` interface so
the choice is reversible. Needs a cost ceiling from you.

**D3 — Where does the verdict gate sit?**
Either `DigitalValueService` calls the Trust Engine inline, or submission becomes a
two-step flow (`create submission` → `poll/subscribe` → `confirm sell`).
*Recommendation:* two-step. Inline blocks a mobile client on an 8s pipeline and makes
A10 hard to honour. This changes the mobile contract, so it needs your agreement.

**D4 — Retention.** How long do we keep submitted card images? Proposal: 90 days for
accepted, 180 for rejected/disputed, hashes retained indefinitely. Needs a compliance
answer, not an engineering one.

**D5 — Existing plaintext `cardInfo` defect.** Fix in place now, or as part of Phase 2
intake? *Recommendation:* now, separately — it is a live defect independent of this
programme.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Over-rejection drives sellers away | Revenue, reputation | `REVIEW` band + moderator overturn metric as a first-class KPI (G2) |
| Inference provider cost scales with abuse | Margin | Cheap checks short-circuit before expensive ones; per-actor rate limits keyed on trust score |
| Sogo expects value-verification, not integrity-verification | Relationship | State the boundary in §2.2(7) explicitly during onboarding |
| Fraud adapts faster than config | Losses | Config is versioned and hot-editable by ops without deploy |
| Trust Engine becomes a dumping ground | Maintainability | Non-goals in §2.2 are enforced at review; no ledger or provider imports permitted in the package |
