# 08 — Security & Compliance

**Status:** Deepened v1.0. Built directly on `07` §5's data classification table, as sequenced in `12`. Nothing financial gets built without following this document.

**Important caveat, stated once here and inherited everywhere:** this document is an engineering specification, not legal advice. AML program design, licensing posture, and regulatory obligations require actual compliance/legal counsel review in every target jurisdiction before any of this is treated as sufficient on its own.

## 1. KYC / KYB

- FlipTrybe never performs regulated identity verification directly. Flow: User → provider-hosted KYC → webhook → FlipTrybe stores only verification status, timestamps, provider reference IDs (`07` §1, `User.kyc_status` / `kyc_provider_reference`).
- **Conflicting KYC status across providers:** if a user's account provider reports `verified` but a card provider on the same account requires separate verification, **decision:** FlipTrybe tracks KYC status per `ProviderMapping`, not a single global status on `User`. `User.kyc_status` becomes a derived summary (e.g., "verified with at least one provider" vs. "verified with all providers this account touches") rather than a single source of truth — this avoids the false confidence of one green checkmark masking a provider-specific gap.
- **KYB (Business accounts):** provider-hosted, same pattern, but typically requires more documents (incorporation, beneficial ownership) and a longer provider-side turnaround — `06` §1's Business account state machine should show a distinct `kyb_pending` sub-state rather than reusing the generic `requested` state, given the meaningfully longer expected wait.

## 2. AML

**Decision:** FlipTrybe runs a thin cross-provider monitoring layer that supplements — never replaces — each provider's own AML program. Rationale: a user can touch multiple providers in one session (fund a SwervPay wallet, then top up a BridgeCard card, then send a Payceler remittance) and no single provider sees that full pattern. This layer:

- Subscribes to the Event Bus (`02` §2) for every confirmed Ledger-writing event.
- Evaluates velocity and aggregate-exposure rules per user across all providers (e.g., total outbound value across all products in a rolling 24h window), not per-provider.
- On a rule match, sets the relevant resource's status to `held_for_review` (already a defined state in `06` §4/§5) rather than blocking silently — surfaced to the Admin Portal (`11` §5) for human review.

This is explicitly a supplementary layer, not a replacement for provider-level AML — FlipTrybe does not have the underlying identity data providers do (per the KYC delegation in §1), so it can only add cross-provider pattern detection, not decisioning.

## 3. Webhook security

Every webhook passes signature verification before entering the Event Bus (full mechanics: Webhook Idempotency & Ordering addendum). Per-provider signature scheme is documented in that provider's `reliability.webhook_signature` field in the Provider Registry (`02` §2 / `05` §4).

## 4. Audit logs

**Decision:** two distinct logs, not one:

- **The Ledger** (addendum) is the audit log for financial facts — what happened to money, when, sourced from where. Already append-only and immutable by design.
- **Operational audit log** — separate store for non-financial-fact events: routing config changes (`04` §6), admin manual interventions (`11` §5), permission grants (§9 below), feature flag changes. Retention: minimum 3 years (align with typical financial recordkeeping norms — confirm exact requirement per jurisdiction with counsel, this is a placeholder default not a confirmed regulatory minimum).

## 5. Encryption — derived from `07` §5

- PII fields (`User.legal_name`, `email`, `phone`, `Transfer.destination` recipient details) — encrypted at rest.
- `ProviderMapping.provider_reference_id` and `User.kyc_provider_reference` — encrypted at rest, adapter-layer access only (`07` §2).
- PCI-scoped fields (full PAN, CVV) — **never stored**, pass-through only; `AdapterResult.rawResponse` (`05` §1) must be scrubbed of these fields before any persistence, including transient debug logging beyond a bounded 24–48h retention window in a separate access-restricted store (`07` §5).
- Key management: recommend a managed KMS (cloud-provider-native or a dedicated secrets platform) rather than self-managed key storage — DevOps Lead decision on specific vendor, not an architectural constraint this document needs to fix.

## 6. Secrets management

Provider API keys/credentials stored in a vault service, not environment variables or source control. **Decision:** rotation policy of 90 days by default, shorter for any credential with direct funds-movement authority (e.g., a provider key that can initiate payouts) — recommend 30 days for that subset, confirm against each provider's own rotation support. Access scoped per adapter — the BridgeCard adapter's credentials are not readable by any service outside `providers/bridgecard/` (`05` §6), enforced the same way as the `ProviderMapping` access control in `07` §2.

## 7. Rate limiting

Two directions:

- **Inbound (protecting FlipTrybe's API from abuse):** standard per-user/per-IP rate limiting at the API Gateway (`02` §1).
- **Outbound (respecting provider rate limits):** each adapter tracks its own provider's rate limit consumption and surfaces `rate_limited` as a defined `AdapterErrorCode` (`05` §3) rather than letting a burst of FlipTrybe-side requests trip a provider's limit unpredictably. A provider approaching its rate limit should be reflected as a signal in the Provider Registry's `health` block (`02` §2) so the Routing Engine (`04`) can deprioritize it before it starts failing outright.

## 8. Fraud detection

Same layer as AML (§2) — a single cross-provider monitoring service evaluating both fraud and AML rules against the same Event Bus feed, since the two overlap heavily in practice (unusual velocity is a signal for both) and building two separate systems against the same data would be redundant.

## 9. Permissions

**Decision — role table (starting point, refine as the team grows):**

| Role | Can view PII | Can trigger manual interventions (`11` §5) | Can change routing config (`04` §6) | Can view commercial terms (`03` §6) |
|---|---|---|---|---|
| Support agent | Limited (own-ticket scope only) | No | No | No |
| Ops / Reliability | No (not needed for their function) | Yes, single-approval for low-risk (retry, reconcile) | No | No |
| Backend Lead | No | Yes, including high-risk (refund, re-route) with dual-approval (`11` §5) | Yes | No |
| Chief Solutions Architect | No | Yes, dual-approval | Yes | Yes |
| Finance/ops | No | No | No | Yes |

Every permission grant/change is written to the operational audit log (§4).

## Resolved (was open in skeleton)

- Cross-provider AML/fraud visibility → thin supplementary layer over the Event Bus, §2/§8.
- Audit log design → split Ledger (financial fact) vs. operational audit log, §4.
- Permissions → starting role table, §9.

## Remaining open questions

- [ ] Regulatory review of this entire document against actual counsel input for the jurisdiction(s) named in `01` — flagged as necessary, not yet done, and shouldn't be treated as done on the basis of this document alone.
- [ ] Exact audit-log retention period (§4) — placeholder default given, needs jurisdiction-specific confirmation.
- [ ] Role table (§9) is a starting point — refine once the actual team roster and org structure exist.
