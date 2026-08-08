# Anchor & Maplerad — Strategic Fallback BaaS Providers

Status: **NOT IMPLEMENTED. Deliberately so.**

Both are designated in the provider research as *strategic fallback / future
BaaS infrastructure*, explicitly **not** to be activated blindly (governance
§11). No credentials or documentation were supplied.

Per §11 the correct state is:

```
adapter exists       → NO (nothing to implement against yet)
capabilities         → known-from-research only, none declared in code
enabled              → false
```

No speculative adapter has been written, because writing one would require
inventing endpoints, request bodies, and webhook shapes — which §11 and §47
forbid.

## Anchor — known from research only

Nigerian Banking-as-a-Service. Research suggests NGN accounts, transfers, and
card issuing. **None of this is confirmed against official API documentation.**

## Maplerad — known from research only

Pan-African BaaS. Research suggests virtual accounts, cards, and cross-border
payouts. **None of this is confirmed against official API documentation.**

## How these get activated later

The provider abstraction is already capability-based, so adding either later
requires **no business-logic change**:

1. Obtain official docs + sandbox credentials.
2. Implement the existing interface for the relevant domain
   (`VirtualAccountProvider` / `VirtualCardProvider` / `RemittanceProvider`) —
   do not create parallel interfaces.
3. Insert `ProviderCapabilityGrant` rows with every gate `false`.
4. Sandbox-verify each capability, flipping `sandboxVerified` per capability.
5. Obtain KYB + compliance approval, flip those gates.
6. Only then set `enabled` / `productionApproved`.

## Classification

**NOT IMPLEMENTED** — intentional. Blocked by credentials and documentation.
