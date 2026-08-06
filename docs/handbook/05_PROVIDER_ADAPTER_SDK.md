# 05 — Provider Adapter SDK

**Status:** Deepened v1.0. The code-level contract itself was already fully specified in the Ledger/Webhook/Adapter addendum — that content is now folded in below as this document's permanent home, with the surrounding onboarding/testing/lifecycle material filled in.

> **AMENDED 2026-08-06 (repo convergence).** §1's runtime assumption is confirmed: Node.js/TypeScript, NestJS. §1's single `execute(operation)` dispatcher was deliberately **not** adopted — see the note directly below §1. §6's directory structure was **not** adopted either — see the note below §6. Everything else in this document (§2 canonical events, §3 error contract, §4 capability negotiation, §5 lifecycle, §7 onboarding checklist, §8 conformance testing) matches the implementation as built.

## Purpose

Defines the interface every provider integration implements. This is the layer where Golden Rules 2 and 3 (no provider names/IDs above this layer) are actually enforced in code, not just policy.

## 1. Interface contract

```typescript
interface ProviderAdapter {
  readonly providerId: string;
  readonly interfaceVersion: string;   // e.g. "1.2"

  healthCheck(): Promise<ProviderHealth>;
  getCapabilities(): ProviderCapabilities;

  execute(operation: AdapterOperation): Promise<AdapterResult>;

  normalizeWebhook(rawPayload: unknown, headers: Record<string, string>): CanonicalEvent;
  verifyWebhookSignature(rawPayload: unknown, headers: Record<string, string>): boolean;
}

interface AdapterOperation {
  type: string;
  fliptrybeResourceId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

interface AdapterResult {
  status: "success" | "pending" | "failed";
  providerReference: string;
  normalizedPayload: Record<string, unknown>;
  rawResponse: unknown;   // scrubbed of PCI-scoped fields per `07` §5 before persistence
}
```

**Runtime assumption:** the pseudocode above and the directory conventions below assume a Node.js/TypeScript backend. This is a reasonable default given the interface was already sketched in TypeScript in the base spec, but it's an assumption, not a confirmed decision — flag with the Backend Lead/DevOps Lead before treating it as settled (see Open Questions).

> **AMENDED 2026-08-06.** Runtime confirmed: NestJS on Node.js/TypeScript (`apps/api`).
>
> The single `execute(operation: AdapterOperation)` dispatcher above was **not adopted**. It's untyped by construction — `payload: Record<string, unknown>` erases exactly the compile-time safety a real implementation needs. The repo instead gives every domain (VTU, Virtual Numbers, Gift Cards, Airtime Cashout, Crypto, RMB, Virtual Accounts, Virtual Cards, Remittance) its own strongly-typed adapter interface (`VtuProviderAdapter`, `VirtualNumberProviderAdapter`, ...), each extending a shared `ProviderAdapterBase`:
>
> ```typescript
> interface ProviderAdapterBase {
>   readonly name: string;              // matches ProviderConfig.name
>   readonly interfaceVersion: string;
>   readonly domain: ProviderDomain;
>   getCapabilities(): ProviderCapabilities;
>   checkHealth(): Promise<ProviderHealthSnapshot>;
>   verifyWebhookSignature?(raw: unknown, headers: Record<string, string>): boolean;
>   normalizeWebhook?(raw: unknown, headers: Record<string, string>): CanonicalEvent;
> }
> ```
>
> (`packages/providers/src/contract.ts`.) Every domain interface still has its own strongly-typed operations (e.g. `VtuProviderAdapter.buyAirtime(input: BuyAirtimeInput): Promise<VtuSubmitResult>`) — those are unchanged from what an `execute()`-based adapter would need to do, just typed per-operation instead of stringly-typed through one dispatcher. §2 (canonical events), §3 (error codes), §4 (capabilities/versioning), and §8 (conformance suite) all target this base contract and are otherwise implemented as written.

## 2. Canonical event shape

```json
{
  "event_type": "wallet.credited",
  "provider": "swervpay",
  "provider_event_id": "evt_002913",
  "resource_id": "wal_4471",
  "sequence_number": 3,
  "occurred_at": "2026-08-04T09:11:58Z",
  "payload": { }
}
```

Event type naming is FlipTrybe's own taxonomy, not the provider's — adapters own this translation. This is the concrete enforcement point for Golden Rules 2/3 on the inbound (webhook) side, mirroring what §1's `AdapterResult` does on the outbound (call) side.

## 3. Error contract

```typescript
type AdapterErrorCode =
  | "insufficient_funds"
  | "provider_unavailable"
  | "invalid_request"
  | "resource_not_found"
  | "rate_limited"
  | "compliance_hold"
  | "unknown_provider_error";

interface AdapterError {
  code: AdapterErrorCode;
  providerRawCode?: string;   // retained for debugging, never surfaced above adapter layer
  retryable: boolean;
  message: string;
}
```

Services above the adapter layer branch only on `AdapterErrorCode` — this is what `10` §3's error-to-UI mapping and `09`'s API error responses build on directly.

## 4. Capability negotiation & versioning

```json
{
  "provider": "bridgecard",
  "interface_version": "1.2",
  "capabilities": { "cards": { "supported": true, "single_use": false, "merchant_lock": false } },
  "reliability": { "idempotency": "strong", "ordering": "sequence", "webhook_signature": "hmac_sha256" }
}
```

This is the block that feeds directly into the unified Provider Registry defined in `02` §2 — `capabilities`, `interface_version`, and `reliability` are written at adapter registration time (deploy-time), while `health` and `commercial` are written by other processes as described there.

Versioning rule: `interfaceVersion` versions the *adapter contract*, not the provider's own API version. A breaking change to the base `ProviderAdapter` interface increments the major version; the Routing Engine refuses to register an adapter whose major version doesn't match what orchestration services expect, preventing a partially-migrated adapter from silently misbehaving in production.

## 5. Adapter lifecycle

```text
registered → health_checking → active
                                  │
                                  ├─▶ degraded (health check failing intermittently)
                                  │        └─▶ active (recovered)
                                  │
                                  └─▶ suspended (health check failing consistently,
                                                  Routing Engine excludes automatically)
                                           └─▶ deprecated (manual, per `03` §4 —
                                                            never triggered by health alone)
```

`suspended` maps directly onto the registry's `health.status` field (`02` §2); `deprecated` maps onto `feature_flag_override` — both states live in the same registry, not a separate adapter-internal status.

## 6. Directory structure — decision

```text
providers/
  bridgecard/
    client.ts          — raw HTTP client for BridgeCard's API
    adapter.ts          — implements ProviderAdapter
    mapper.ts            — provider payload ↔ canonical shape (§1, §2)
    webhook_handler.ts    — signature verification + normalizeWebhook
    simulator.ts          — mock server for this provider, used by QA (§7)
  swervpay/
  payceler/
  nium/
  swan/
  bvnk/
  bridge_xyz/
  yellow_card/
  technest/
  fyatu/
```

**Decision:** simulators are co-located with their adapter (`simulator.ts` per provider) rather than a separate testing-only package, so a provider's simulator and its real client stay in sync as the same engineer typically owns both, and so a new adapter is genuinely incomplete — not just untested — until its simulator exists.

> **AMENDED 2026-08-06.** This per-provider-directory layout was **not adopted**. The repo organizes by domain-file instead: `packages/providers/src/<domain>.ts` (`vtu.ts`, `virtual-numbers.ts`, `gift-cards.ts`, `airtime-cashout.ts`, `crypto.ts`, `rmb.ts`, `financial-products.ts`), with every provider in that domain — real and mock — as sibling `create<Provider>Adapter()` factory functions in the same file. `mock<Domain>Adapter()` plays the role §6's `simulator.ts` describes: a same-file, always-in-sync fake used both by unit tests and as the runtime fallback when a real provider's credentials aren't configured (see `02` §2's amendment). The onboarding checklist in §7 and the conformance suite in §8 apply unchanged — they target the adapter interface, not the file layout.

## 7. Onboarding checklist for a new provider adapter

- [ ] Capabilities declared in the Provider Registry (currencies, products, features) — §4
- [ ] `reliability` block filled in honestly, not defaulted to the strongest values — §4
- [ ] Error mapping covers all documented provider error codes, with a deliberate fallback to `unknown_provider_error` for anything unmapped (never silently swallowed)
- [ ] Webhook signature verification implemented and tested against the provider's sandbox
- [ ] `simulator.ts` built — used both by this checklist's own testing and by QA's broader test suite (§8)
- [ ] Health check implemented and wired into the registry's `health` field
- [ ] Adapter passes the shared conformance test suite (§8)
- [ ] Entry added/updated in `03_PROVIDER_STRATEGY.md`

## 8. Adapter conformance testing

Every adapter must pass a shared test suite asserting interface compliance regardless of provider — for example: calling `execute()` with an operation type the adapter's declared capabilities say it doesn't support must return a well-formed `AdapterError` with code `invalid_request`, never a thrown exception; a webhook with an invalid signature must be rejected by `verifyWebhookSignature()` before `normalizeWebhook()` is ever called; a duplicate `idempotencyKey` passed to `execute()` twice must not produce two provider-side operations (verified against the simulator, §6, not the live provider). This suite is what keeps Golden Rule 4 ("every provider is replaceable") from silently rotting as adapters accumulate — it should run in CI against every adapter on every change, not just at onboarding time.

## Resolved (was open in skeleton)

- Provider simulator location → co-located per adapter, §6.
- Onboarding checklist → concrete list, §7.

## Remaining open questions

- [x] Backend language/runtime (§1 assumption: Node.js/TypeScript) — **confirmed 2026-08-06**: NestJS on Node.js/TypeScript.
