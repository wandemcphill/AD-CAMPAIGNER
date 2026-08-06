# 11 — Admin Portal

**Status:** Deepened v1.0. Every dashboard below reads from systems already defined elsewhere (`02`'s unified registry, the Ledger addendum, `08`'s audit log) rather than owning its own data — this document specifies the views and the intervention actions, not new data stores.

## Purpose

How humans operate and intervene in a system that's otherwise fully automated.

## 1. Provider Dashboard

```text
BridgeCard    🟢    Latency 240ms    Success 99.4%
SwervPay      🟡    Latency 890ms    Success 97.1%
```

Pure read view over the Provider Registry's `health` block (`02` §2, `03` §2 populated entries). No logic of its own.

## 2. Routing Dashboard

```text
Today's USD Cards
  BridgeCard   87%
  SwervPay     13%
```

**Decision:** v1 shows current-day snapshot only, sourced by aggregating routing-decision log entries (`04` §6's audit trail) over the current day — no historical trending store needed yet, since a dedicated analytics/warehouse layer isn't specified anywhere in this handbook (flagged as a gap, not solved here). If historical trending becomes a real need, that's a separate analytics-infrastructure decision, not an Admin Portal feature to build ahead of the data existing.

This dashboard is also where the priority-order/weighting config from `04` §3 and §6 is edited — every edit writes to the operational audit log (`08` §4).

## 3. Health Dashboard

```text
Failures
Rate Limits
Webhook Delays
```

Pulls from the same `health` block as §1, plus the rate-limit signal described in `08` §7. **Decision:** when a provider is automatically marked `suspended` (`05` §5 lifecycle), this dashboard must show *why* — the specific threshold that was crossed (e.g., "success rate fell below 95% over 15 min") — not just the resulting status. An ops person needs the reason to judge whether to wait for auto-recovery or escalate.

## 4. Margin Dashboard

```text
Revenue
Provider Cost
Profit
```

Reads from the Provider Registry's `commercial` block (`02` §2). Access-controlled per `08` §9's role table — restricted to Finance/Ops and the Chief Solutions Architect role, not general engineering access, matching the same access boundary flagged in `03` §6.

## 5. Manual intervention tools

```text
Retry
Refund
Reconcile
Re-route
```

Every action here is a real, audited operation against the Ledger and/or a live provider call — not a UI button wired to nothing.

| Action | What it does | Ledger effect | Approval (`08` §9) |
|---|---|---|---|
| Retry | Re-attempts a failed/stalled saga step (`02` §6) using the same idempotency key | New Ledger entry only if the retried step actually changes state | Single-approval (Ops/Reliability) |
| Reconcile | Manually triggers a reconciliation cycle for a specific resource (Ledger addendum §1.4) outside the normal schedule | Correction entry if drift is found, per addendum §1.3 tiering | Single-approval (Ops/Reliability) |
| Refund | Initiates a compensating funds movement back to the user | New Ledger entry, references the original entry it corrects | **Dual-approval** (Backend Lead + one other) — this moves real money and is irreversible once executed |
| Re-route | Manually forces a resource's affinity (`04` §4) to a different provider — an explicit override of the hold-and-flag default | New `ProviderMapping` entry, old one retained for history | **Dual-approval** — this is exactly the kind of silent-migration risk `04` §4 warns against automating; a human doing it deliberately, with two sign-offs, is the intended escape hatch |

**Decision on dual-approval:** Refund and Re-route require two distinct people to approve before execution, since both are direct, hard-to-reverse financial interventions. Retry and Reconcile are lower-risk (idempotent or read-heavy) and only need single-approval. This distinction should be enforced in the tool itself, not left as a process convention — the UI should not allow a single person to execute a dual-approval action alone.

> **AMENDED 2026-08-06.** Refund's dual-approval gate is implemented: `ApprovalsService` (`apps/api/src/modules/approvals`) backed by an `ApprovalRequest` table. `request()` creates a pending approval; `decide()` enforces in code (not just UI convention) that the deciding user is not the requester — `ForbiddenException` if they match, which is exactly the "enforced in the tool itself" requirement this section asks for. `execute()` runs the gated action once approved and records `EXECUTED`/`EXECUTION_FAILED`. Currently wired into Digital Access's `updateRequestStatus` — a refund-triggering transition returns `{ pending: true, approvalRequestId }` instead of executing inline. **Not yet wired**: VTU's `adminResolveOrder` (the other real refund/reversal call site) and Re-route (`04` §4's resource-affinity override) don't go through this gate yet — same mechanism, just not connected to those two call sites.

## 6. Feature flag console

Writes directly to the Provider Registry's `feature_flag_override` field (`02` §2) — this is the resolution to the "two systems that can disagree" risk flagged in the original skeleton. There is no separate feature-flag data store; this console is a UI over one field in the registry.

```text
Disable SwervPay (Emergency)  →  sets feature_flag_override: "disabled"
                                   Routing Engine (`04` §2) hard-filters it out
                                   on the very next routing decision — no
                                   deploy, no propagation delay
```

> **AMENDED 2026-08-06.** Implemented, with one naming correction: there is no field literally called `feature_flag_override` in the repo's registry. `ProviderConfig.status` (`HEALTHY | DEGRADED | DOWN | DISABLED`) is that field — it's already the hard gate `scoreCandidate()`/`selectProviders()` check (`packages/providers/src/router.ts`), so this section's "no separate feature-flag data store" claim holds exactly as written, just against the actual column name. The emergency-disable action is `POST /admin/providers/:domain/:name/disable` (and `/enable`), `ProvidersService.setProviderStatus()` (`apps/api/src/modules/providers`) — writes `ProviderConfig.status = DISABLED`, plus a distinct `AuditLog` entry (`provider.emergency_disable`) recording the previous status and an optional reason, matching §5's "every edit writes to the operational audit log" requirement above.
>
> Also amends `02` §2's related note: `packages/feature-flags` is a separate, static object of ~25 *product* toggles (`vtu`, `giftCardSell`, `virtualAccounts`, ...) — a different, legitimate mechanism for turning whole verticals on/off, not a duplicate of this provider-level kill-switch. The two aren't in tension; they answer different questions ("is this product live at all" vs. "is this specific provider healthy enough to route to right now").

## Resolved (was open in skeleton)

- Dual-approval requirements → explicit table, §5.
- Feature flag console mechanism → single field on the unified registry, §6.

## Remaining open questions

- [ ] Historical trending / analytics data source (§2) — genuinely unaddressed anywhere in this handbook; needs its own scoping decision (dedicated analytics store vs. folding into `07`) before v1's Routing Dashboard can show anything beyond a current-day snapshot.
