# Bridgecard — Card Fallback Provider Status

Status: **NOT IMPLEMENTED. No credentials, no documentation reviewed.**

Designated in the provider research as **secondary/fallback card
infrastructure** behind Sudo. No adapter exists and none should be written
until official documentation and credentials are available.

## Known from research only

- Nigerian card-issuing provider.
- Intended role: fallback when Sudo is unavailable or a capability/pricing
  difference makes it preferable.

## Unconfirmed (must not be guessed)

Authentication, base URLs, card issuing/lifecycle/funding endpoints, cardholder
KYC requirements, webhook events and signature scheme, supported currencies,
fees, limits.

## Routing safety note (§48)

Bridgecard is a **fallback**, and card fallback is the most dangerous kind:

- Falling back for a **card creation** that timed out risks issuing two cards.
- Falling back for a **card authorization** already accepted by Sudo is never
  permitted — an authorization is bound to its issuer.

Any Bridgecard fallback must therefore be gated on
`classifyFallbackSafety(...) === "SAFE_TO_RETRY"`
(`packages/providers/src/contract.ts`).

## Required before implementation

1. Bridgecard sandbox credentials + official API docs.
2. Implement the existing `VirtualCardProvider` interface (do not create a new one).
3. Sandbox-verify the full card lifecycle before enabling any grant row.

## Classification

**NOT IMPLEMENTED** — blocked by credentials and documentation.
