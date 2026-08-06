# 10 — Frontend Specification

**Status:** Deepened v1.0, **rewritten 2026-08-06 for Next.js** (repo convergence). The original v1.0 targeted Flutter as the sole client; that decision is reversed — see below. This document's *contracts* (§2 pending-state pattern, §3 error mapping, §4 offline stance) are unchanged in substance from the original Flutter version; only the client framing and §5 (state management) changed.

## Client decision: Next.js first, Flutter later

The client is **Next.js** (`apps/web` — user-facing Growth OS, `/os/*` routes; `apps/admin` — ops/governance dashboard), with the API kept client-agnostic so a Flutter mobile client can be added later without backend changes. This reverses the original v1.0 assumption that Flutter was the (implied sole) client. The reasoning:

- The web surface is what's actually built and shipping today (`apps/web/app/os/*`).
- Nothing in `02`–`09` is Flutter-specific in practice — the response envelope (`09` §1), error taxonomy (`05` §3), and adapter contract (`05` §1) are all transport/client-agnostic by design. This document's job is to restate the same contracts for a second client's actual patterns, not to re-derive them.
- A Flutter client, if and when it's built, consumes the identical API surface this document describes — the backend does not change to support it.

## Purpose

Defines what the Next.js client is allowed to know. It never sees BridgeCard, SwervPay, or Payceler (or, in the repo's actual providers, VTPass, ClubKonnect, Reloadly, SmsPool, etc.) — it calls FlipTrybe's own service layer and nothing else.

## 1. Client-side service layer

```text
apps/web/app/os/* (React Server/Client Components)

↓

Per-domain API client modules — e.g. apps/web/app/os/utilities/vtu-api.ts

↓

FlipTrybe API (`09`)
```

Each domain gets a thin client module matching one backend module (e.g. `vtu-api.ts` calls only `/v1/vtu/*` endpoints), mirroring the original v1.0's `CardService`/`WalletService`/`TransferService` split — just as plain fetch-wrapper modules colocated with their route rather than a Flutter-style service class. No component constructs a request shaped around a specific provider's quirks; that translation already happened server-side (`05`).

## 2. Pending-state UI pattern — one implementation, reused everywhere

Since every mutating endpoint returns the same two-level envelope (`09` §1: `active | pending | failed` at the top level, product-specific detail in `data.status`), the client implements exactly **one** pending-state component, reused across every vertical:

```text
Envelope status == "active"  →  show the resolved resource state immediately
Envelope status == "pending" →  show a generic "in progress" state, keyed to
                                  data.status for product-specific copy (e.g.
                                  "created_unfunded" vs. "payout_initiated"
                                  get different sub-copy, same visual pattern)
                                  → poll GET /resource/{id} on an interval, OR
                                  → update on a realtime event (existing
                                  Socket.IO gateway, apps/api's realtime.gateway.ts)
Envelope status == "failed"  →  show the mapped error (§3 below)
```

Building this once, rather than a bespoke loading state per screen, is the direct payoff of the backend's grace-window decision (`02` §5, implemented as `withGraceWindow()` in `apps/api/src/modules/grace-window.ts`) — it's worth the up-front component work rather than letting each product team improvise its own pending UI. The realtime path already exists in this repo (`realtime.gateway.ts`) — prefer it over polling where a screen is already subscribed.

## 3. Error-to-UI mapping

| `AdapterErrorCode` | User-facing treatment |
|---|---|
| `insufficient_funds` | Specific, actionable — "You don't have enough balance for this," with a clear path to fund |
| `provider_unavailable` | Generic, reassuring, retry-oriented — "This is temporarily unavailable, try again shortly" — never names or implies a specific provider |
| `invalid_request` | Should rarely reach a user in practice (implies a client bug); generic fallback error with a support contact path |
| `resource_not_found` | Treat as a navigation/state bug on the client (e.g., stale local cache) rather than surfacing raw to the user — refresh and retry silently once before showing anything |
| `rate_limited` | Same visual treatment as `provider_unavailable` — the distinction is not meaningful to a user |
| `compliance_hold` | Careful, non-alarming copy — "This is under review," with a support path; never implies wrongdoing, since this can trigger from routine AML rules (`08` §2), not just genuine fraud |
| `unknown_provider_error` | Same as `invalid_request`'s fallback treatment |

`insufficient_funds` and `compliance_hold` are the only two codes that need genuinely distinct, carefully written copy — everything else can share one or two generic treatments, which keeps the mapping maintainable as more error codes are added later.

## 4. Offline / degraded connectivity behavior — decision

Given the target market described in `01` (connectivity reliability is plausibly a real product concern, not an edge case), **decision:** read operations (balances, transaction history, card status) are cached locally and shown with a clear "last updated" timestamp when offline, rather than blocked entirely — this is safe because all such data is Ledger-derived and read-only (`07` §3). Write operations (create card, initiate transfer) require a live connection and are never queued locally for later submission — silently queuing a financial mutation risks the user forgetting it's pending, or submitting it twice across a reconnect. If a write is submitted and the connection drops before a response arrives, the client should treat the operation's outcome as genuinely unknown and prompt the user to check status on reconnect, rather than assume success or failure.

This stance is unchanged from the original Flutter-targeted version — it's about the write-outcome-ambiguity problem, not the client platform. A web client on a flaky mobile connection has the same failure mode a native mobile client does.

## 5. State management — decision

**Void.** The original v1.0 recommended Riverpod (Flutter-specific state management) — not applicable to a Next.js client. State management for `apps/web` follows whatever this repo's existing Next.js conventions already are (React Server Components + client-side fetch/cache patterns already in use elsewhere in `apps/web/app/os/*`) — this document does not prescribe a library, since that's an existing settled decision elsewhere in the codebase, not something this handbook needs to re-litigate.

If a Flutter client is built later, its state management library is a fresh decision at that time, made against whatever this document's contracts (§2–§4) are by then — not inherited from this section.

## 6. Design system

Out of scope for this handbook — recommend a separate design-token/component repo rather than folding UI design decisions into the Financial OS documentation set. This document only defines what data the client has access to and how it's structured (§1–§4), not visual design.

## Resolved (was open in skeleton)

- Pending-state UI pattern → one generic component keyed to the two-level envelope, §2.
- Error-to-UI mapping → table, §3.
- Offline behavior → read cached with staleness indicator, write never queued offline, §4.
- Client platform → **Next.js first** (2026-08-06), reversing the original Flutter-only assumption. Flutter remains a possible later second client against the same API.

## Remaining open questions

- [x] State management library (§5) — **void**; Riverpod was Flutter-specific and doesn't apply to the Next.js client that's actually being built. Not re-opened for Next.js since it's an existing repo convention, not a fresh decision.
- [ ] Push notification transport — deferred to `02`'s open question (DevOps Lead decision). For the web client this is largely moot today since `realtime.gateway.ts` (Socket.IO) already covers the push-update case §2 describes; revisit only if a Flutter client is actually built and needs a mobile push transport.
