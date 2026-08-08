# Sudo Africa — Card Provider Integration Status

Status: **BLOCKED BY CREDENTIALS. No adapter implemented.**

Designated in the provider research as **primary card infrastructure** (virtual
cards, and physical cards where approved). No credentials were supplied, so per
the no-guessed-API rule nothing has been implemented.

## What is known

- Docs entry point: `https://docs.sudo.africa/`, full index at `https://docs.sudo.africa/llms.txt`.
- Sandbox signup: `https://app.sudo.africa`.
- Documentation states it covers "authentication, request structure" and "financial products (accounts, cards, payments, etc.)".

## What is NOT known (must not be guessed)

Every one of these is unconfirmed and therefore unimplementable:

- Authentication method and header name
- Base URLs (sandbox vs production)
- Card creation / issuing endpoint and request body
- Card lifecycle endpoints (freeze / unfreeze / terminate)
- Card funding mechanism
- Customer/cardholder creation prerequisites and KYC tier
- Card transaction webhook events and **signature verification scheme**
- Supported currencies and card types (VISA/Mastercard, USD/NGN)
- Fees, limits, MCC controls

## Required before implementation

1. Sudo sandbox account + API credentials.
2. Fetch `https://docs.sudo.africa/llms.txt` and map every endpoint above.
3. Implement `VirtualCardProvider` against the documented shapes only.
4. Sandbox-verify: auth → customer create → card create → status → freeze/unfreeze → terminate → transaction webhook.

## Existing card adapter context

The repo already has a `VirtualCardProvider` interface
(`packages/providers/src/financial-products.ts`) with a mock plus a
documentation-mapped Payscribe adapter. A Sudo adapter should implement the
**same interface** — do not create a parallel card abstraction.

Note the interface already carries `providerCustomerId` and `brand` on
`issueCard()`, added for Payscribe; Sudo will likely need the same, so no
interface change is expected.

## Routing intent (§53) — not yet configured

```
VIRTUAL CARD:  1. Sudo   2. Bridgecard (fallback)
PHYSICAL CARD: 1. Sudo   2. Bridgecard (fallback)
```

Fallback must respect §48: a card **authorization** that has already occurred
must never be re-routed to another provider.

## Classification

**BLOCKED BY CREDENTIALS** — capability known from research, API implementation
pending official documentation + credentials.
