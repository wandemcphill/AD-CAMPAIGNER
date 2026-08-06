# 01 — Product Vision

**Status:** Deepened v1.0. §1 and §4 contain a recommended default (target market, mission) marked clearly — confirm with product/business leadership before treating as final; everything else follows from decisions already locked in `02`/`07`.

## Purpose

Answers "why are we building this," and states clearly what FlipTrybe is not, so later documents inherit constraints instead of re-deriving them.

## 1. What FlipTrybe is

FlipTrybe is an embedded financial marketplace and orchestration platform. It owns user experience, product design, business logic, routing, analytics, pricing, provider selection, and the marketplace surface. It never takes custody of funds and never performs a regulated activity directly when a licensed partner can perform it instead.

**The customer problem (recommended default — confirm before final):** the provider mix already assembled (heavy NGN/Nigeria coverage, USD/GBP/EUR account support, Africa-specific remittance and stablecoin rails) points at a specific underserved user: people who move money and identity across African and Western financial systems — diaspora, remote-working freelancers and creators paid in foreign currency, and small businesses trading across borders. This group is poorly served two ways: traditional local banks rarely offer real multi-currency accounts or competitive FX, and single-provider fintechs are fragile — a card network restriction, a provider outage, or a corridor shutdown takes the whole product down with it. FlipTrybe's answer is redundancy by design: the same account, card, or transfer capability is backed by more than one licensed provider, so an outage or restriction on one degrades service rather than breaking it.

## 2. What FlipTrybe explicitly is not

- **Not a bank** — holds no banking license; account and wallet balances are always custodied by a licensed partner, never by FlipTrybe (`07` §1, `Wallet.balance` is Ledger-derived, never a FlipTrybe-held balance).
- **Not a money transmitter** — funds movement between currencies/jurisdictions is executed by licensed remittance/FX providers; FlipTrybe routes and orchestrates the request, it does not itself move money.
- **Not an EMI** — never issues e-money in its own name; every "account" a user sees maps to a real account at a licensed e-money or banking partner (`07` §1, `ProviderMapping`).
- **Not an IMTO** — cross-border transfers are executed by licensed IMTO/remittance partners; FlipTrybe's Remittance product is a routing and UX layer over them.
- **Not a cryptocurrency exchange** — stablecoin on/off-ramp and settlement is performed by licensed partners (BVNK, Bridge.xyz, Yellow Card); FlipTrybe never custodies crypto assets itself.
- **Not a payment processor** — card issuing and payment execution happen at the provider (BridgeCard, SwervPay, Fyatu); FlipTrybe never touches raw card data beyond what's necessary to pass through to a provider (`07` §5, PCI-scoped fields are never stored).

## 3. Long-term mission

**Recommended default:** become the default financial and digital-services layer for globally-mobile people connected to Africa — starting with accounts, cards, remittance, and stablecoin settlement, and expanding into the Future Expansion catalog (gift cards, eSIM, virtual numbers, VPN, airtime, utility bills, streaming, cloud credits — `06` §6) using the same Provider Adapter + Routing Engine pattern once the core financial products are stable (`12`). The mission is not "be a bank" — it's "be the layer that makes using many financial and digital-service providers feel like using one."

## 4. Who this is for

| Segment | Pain point today | What FlipTrybe changes |
|---|---|---|
| Personal | Local banks rarely offer real multi-currency accounts; foreign cards are hard to get and expensive to fund | A USD/GBP/EUR account and card that's actually usable day-to-day, backed by a provider that stays up even if a competitor's single rail doesn't |
| Freelancer | Gets paid in foreign currency via platforms with high fees and slow, limited local cash-out | Receive in USD/GBP/EUR, convert or spend directly, without routing through a single fragile payout provider |
| Creator | Similar to Freelancer, but with more irregular/multi-platform payout timing | Same rails, tuned for irregular inflows rather than assuming a steady salary-like pattern |
| Business | Cross-border vendor/contractor payments and multi-currency balances are slow to set up with traditional business banking | Faster onboarding via provider-hosted KYB (`08` §1), business account types with the same redundancy guarantees as personal accounts |

## 5. Non-negotiables

Carried into every other document without re-litigation:

- No provider names or IDs surface above the adapter layer (`05`, `07` §2, `10`).
- Every provider is replaceable without touching Flutter or core business logic (`02`, `04`, `05`).
- FlipTrybe never stores a balance it didn't derive from a provider observation (`07` §3, and the Ledger addendum).
- Regulated activity is always delegated, never performed in-house (`08`).

## 6. Regulatory posture

FlipTrybe holds no money-transmission, EMI, or IMTO license because it performs no regulated activity directly — every regulated function (custody, issuance, KYC/KYB decisioning, cross-border settlement) is performed by a licensed partner under that partner's own license and regulatory obligations. This is a one-line summary; full reasoning, per-jurisdiction detail, and required legal sign-off live in `08`. Nothing in this handbook should be read as legal advice — the regulatory posture stated here needs confirmation from actual counsel in each target jurisdiction before it's treated as settled.

## Resolved (was open in skeleton)

- Target market / primary geography → Africa-connected diaspora, freelancers, creators, and businesses (recommended default, §1/§4 — confirm with leadership).
- Regulatory posture statement placement → one line here, full detail in `08` (§6).
