# 03 — Provider Strategy

**Status:** Deepened v1.0. Structural fields (purpose, priority, products, currencies) are populated from decisions already made; commercial-specific figures (fee schedules, measured SLA%, exact contract terms) are marked **TBD** rather than invented — populate those from actual commercial agreements and live health data, not this document.

## Purpose

Documents every provider FlipTrybe integrates with, referencing the unified Provider Registry defined in `02` §2 as the live, machine-readable counterpart to this document's human-readable narrative. This document explains *why* each provider is there; the registry tracks *current state*.

## 1. Provider entry template

```text
[Provider Name]

Purpose:              [product area]
Priority:             [1 = primary, 2 = fallback, 3 = enterprise/niche]
Products it backs:    [list]
Supported countries:  [list — TBD where not yet confirmed]
Supported currencies: [list]
Onboarding model:     [provider-hosted / FlipTrybe-collected+forwarded / hybrid]
KYC/KYB model:        [per `08` §1]
Webhook events:       [list — feeds `05` adapter's normalizeWebhook mapping]
Reliability profile:  [idempotency / ordering / signature scheme — feeds registry `reliability` block, `02` §2]
Strengths:
Weaknesses:
Known limitations:    [rate limits, unsupported features, regional gaps]
Commercial terms:     TBD — see §6 on access control for this field
Contract/compliance:  [DPA status, audit rights, SLA terms] — TBD
```

> **AMENDED 2026-08-06 (repo convergence).** None of the providers listed in §2 below (Payceler, Swan, Nium, SwervPay, BridgeCard, Fyatu, Technest, BVNK, Bridge.xyz, Yellow Card) are integrated in the repo as of this date — they describe the account/card/remittance/stablecoin vertical, which is Phase E per the resequenced `12`, and is genuinely blocked on the provider diligence this document already flags as TBD throughout. §2 is left as-written below since it's aspirational and still the intended target list for that vertical, not because it reflects current state.
>
> The providers actually integrated in the repo, none of which appear in §2 below because they back the digital-products vertical (`06`'s Future Expansion category, resequenced to Phase D — done, not future) rather than core banking:
>
> | Provider | Domain | Status |
> |---|---|---|
> | ClubKonnect (Nellobyte) | VTU (airtime, data, electricity, cable, betting, education) | Primary, real API, funded production account |
> | VTPass | VTU | Fallback |
> | MobileNig, CheapDataHub, SmeData, eBills | VTU | Additional fallbacks |
> | SMSPool, 5sim, SmsPva | Virtual Numbers | All three live |
> | Reloadly | Gift Cards (buy) | Live |
> | SOGO | Gift Cards (sell) | Live |
> | AirtimeToCash (Nellobyte) | Airtime Cashout | Live |
> | Korapay, Paystack | Payments (wallet funding) | Live |
> | Fincra | FX settlement | Recommended primary per separate provider evaluation (Flutterwave backup; Wise ruled out for Nigerian entities) — not yet integrated in code |
>
> This document's §3 (selection criteria), §4 (deprecation process), and §6 (commercial-terms access control) apply equally to both the aspirational Phase E list and the actual digital-products list above — nothing about those sections is specific to core banking.

## 2. Provider entries

### Payceler — Global Accounts (primary), Remittance (primary)
```text
Priority:              1 (Accounts), 1 (Remittance)
Products:              Global Accounts, Remittance
Currencies:             NGN, USD, GBP, EUR
Onboarding:             Provider-hosted (assumed — confirm)
KYC model:              Provider-hosted
Strengths:              Broad currency coverage in one provider for both accounts and remittance
Weaknesses:              TBD — populate after integration/diligence
Known limitations:      TBD
```

### Swan — Global Accounts (primary)
```text
Priority:               1 (Accounts)
Products:               Global Accounts
Currencies:              EUR-centric (confirm exact scope — Swan is a European BaaS provider; verify against actual target-market fit given `01`'s Africa-connected focus)
Onboarding:              Provider-hosted
Strengths:               Strong EU regulatory standing
Weaknesses:               TBD
```

### Nium — Global Accounts (fallback), Remittance (global)
```text
Priority:                2 (Accounts fallback), 1 (Remittance, global reach)
Products:                Global Accounts, Remittance
Currencies:               Broad multi-currency (Nium has wide corridor coverage — confirm exact list)
Strengths:                Wide global corridor coverage, useful as the "when nothing else covers this country" option
Weaknesses:                Likely higher cost than regional specialists — TBD, confirm against commercial terms
```

### SwervPay — Wallets (primary)
```text
Priority:                 1 (Wallets)
Products:                 Wallets
Currencies:                NGN-centric (confirm)
Strengths:                 Primary wallet rail
Weaknesses:                 TBD
Known limitations:          TBD
```

### BridgeCard — Wallets (fallback), Virtual Cards (primary)
```text
Priority:                  2 (Wallets), 1 (Cards)
Products:                  Wallets, Virtual Cards
Currencies:                 USD, NGN
Strengths:                  Primary card issuing rail
Weaknesses:                  TBD
Known limitations:           Merchant lock / single-use support — confirm current capability (registry `02` §2 tracks live status)
```

### Fyatu — Virtual Cards (enterprise)
```text
Priority:                   3 (Cards, enterprise tier)
Products:                   Virtual Cards
Use case:                    Enterprise/Business account card issuing — confirm whether this is a distinct tier or a fallback for Business-type accounts specifically
```

### Technest — Remittance (fallback)
```text
Priority:                    2 (Remittance fallback)
Products:                    Remittance
Strengths:                   TBD
Weaknesses:                   TBD
```

### BVNK — Stablecoin Settlement (primary)
```text
Priority:                     1 (Stablecoins)
Products:                     Stablecoin Settlement
Capabilities:                  Fiat↔USDT, Fiat↔USDC
Compliance note:               Stablecoin on/off-ramp is the highest AML-sensitivity product area (`08` §2/§8) — this provider's own AML program should be documented here once diligence is complete
```

### Bridge.xyz — Stablecoin Settlement (secondary)
```text
Priority:                      2 (Stablecoins)
Products:                      Stablecoin Settlement
```

### Yellow Card — Stablecoin Settlement (Africa-specific)
```text
Priority:                      Regional specialist — likely primary for African corridors specifically even if BVNK is global primary; confirm routing rule (may need a country-based override rather than a flat priority order — flag for `04`)
Products:                      Stablecoin Settlement
```

## 3. Selection criteria for adding a new provider

A candidate provider should be evaluated against:

- **Regulatory standing** in the target markets defined in `01` — valid license, in good standing, willing to provide compliance documentation.
- **API reliability** — measured or vendor-reported uptime SLA.
- **Webhook reliability** — does it support idempotency keys and/or sequence numbers (feeds directly into the adapter's `reliability` block, `02` §2 / `05`)? A provider with no ordering signal at all is not disqualifying but should be weighted down in routing (`04`) and reconciled more frequently (Ledger addendum).
- **Settlement speed** — relevant most for Remittance and Stablecoin products where speed is a user-facing differentiator.
- **Commercial terms** — see §6 access-control note.
- **Willingness to be white-labeled** — a provider that resists having its identity hidden from end users, or that bakes provider-specific UX assumptions into its API in ways that resist adapter-layer translation, is a red flag against the entire architecture in `02` and should weigh heavily against selection even if other criteria are strong.

## 4. Provider deprecation process

```text
Decision to deprecate (Chief Solutions Architect + Backend Lead sign-off)

↓

Registry: set feature_flag_override = "deprecating" (new resources stop routing here, `02` §2 / `04`)

↓

Existing resources on this provider: migration plan per resource type
  — some (e.g., a Wallet) may be migrable to a new provider
  — some (e.g., an active Card with a live PAN) may need to run to natural
    termination/expiry rather than forced migration, given `07` §5's PCI
    handling — a card migration would mean provisioning a genuinely new
    card, not moving data

↓

Notice period to any affected users (product decision, not purely technical)

↓

Adapter marked "deprecated" in `05` lifecycle once zero resources reference it

↓

Historical Ledger and ProviderMapping records retained per `08` audit
retention policy — deprecating a provider never deletes its historical trail
```

## 5. Concentration risk

| Product | Primary | Fallback | Fallback production-tested? |
|---|---|---|---|
| Global Accounts | Payceler / Swan | Nium | TBD — confirm fallback has real production traffic, not just configuration |
| Wallets | SwervPay | BridgeCard | TBD |
| Virtual Cards | BridgeCard | SwervPay (Fyatu for enterprise) | TBD |
| Remittance | Payceler | Technest → Nium (global) | TBD |
| Stablecoin | BVNK | Bridge.xyz / Yellow Card (regional) | TBD |

This table should not stay all-TBD for long — an untested fallback is not really a fallback, it's an assumption. Recommend a standing exercise (tied to `11`'s Health Dashboard) that periodically forces a small percentage of live traffic through each fallback to keep it genuinely production-ready, rather than discovering it's broken during an actual primary-provider outage.

## 6. Commercial terms — access control decision

**Decision:** commercial terms (fee schedules, margin) are tracked in the Provider Registry's `commercial` field (`02` §2), which is access-restricted per `08` §9 — not stored inline in this narrative document, which should stay readable by any engineer. This document references that the data exists and where, without reproducing sensitive figures here.

## Resolved (was open in skeleton)

- Commercial terms placement → live in the registry's access-controlled `commercial` field, not this document, §6.
- Review cadence → tie to `11`'s Health Dashboard and the fallback-testing exercise in §5 (recommended, not yet formally scheduled).

## Remaining open questions

- [ ] Every field marked TBD above needs populating from actual provider diligence/contracts — this document's structure is complete, its data is not.
- [ ] Yellow Card's country-based override vs. flat priority (§2) — flag for `04` deepening if not already resolved there.
