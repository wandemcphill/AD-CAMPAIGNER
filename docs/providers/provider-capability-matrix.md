# Provider Capability Matrix — Fincra vs Swappr

Generated 2026-08-08 from a dedicated verification sprint. Every row is
classified using exactly one of:

- **LIVE VERIFIED** — a real sandbox API call was made this session and its
  response was inspected.
- **SANDBOX VERIFIED** — verified live in an earlier session (still holds).
- **DOCUMENTED ONLY** — confirmed in official docs, not exercised live.
- **BLOCKED** — cannot be verified right now (credentials, dashboard config,
  or code not wired).
- **NOT SUPPORTED** — the provider does not offer this.
- **UNKNOWN** — neither documented nor testable from what's available.

"Documentation mentions it" is never treated as "supported" on its own.

| Capability | Fincra | Swappr | Evidence | Status |
|---|---|---|---|---|
| **NGN wallet / balances** | ₦1,000 test balance, `GET /wallets?businessID=` | ₦50,000 test balance, `GET /v1/wallets` | Both read live this session/last session | **LIVE VERIFIED** (both) |
| **NGN virtual account — merchant-level** | `POST /profile/virtual-accounts/requests` created a real VA (`status:"approved"`, instant) | Admin/Technest-provisioned only — **no merchant create API** | Fincra: live create this session. Swappr: confirmed no endpoint exists (prior audit) | Fincra **LIVE VERIFIED**; Swappr **NOT SUPPORTED** (by design) |
| **NGN virtual account — customer-specific** | Not a separate capability — the one create call takes `KYCInformation` per holder but is merchant-scoped | `POST /v1/customers/{id}/virtual_accounts` exists for **international** VIBANs, gated on KYC-verified customer; no separate NGN customer-VA call documented | Docs only, not created live | Fincra: **DOCUMENTED ONLY** (single merchant-scoped model); Swappr: **DOCUMENTED ONLY**, not built |
| **Account verification / name enquiry** | `POST /core/accounts/resolve` reachable (200) but returned `data: null` for the test account tried; `GET /core/banks` fully works | `POST /v1/name-enquiry` resolved a real name (`SHERIFAT BOLANLE IYANDA`) for the same test account | Both live this/last session | Fincra: **LIVE VERIFIED (partial — banks yes, resolve unclear)**; Swappr: **LIVE VERIFIED (full)** |
| **NGN payout** | `POST /disbursements/payouts` → `200`, settled to `"successful"`, balance dropped exactly as expected | `POST /v1/payouts` → `201`, settled to `"paid"`, balance dropped exactly as expected | Both live, this session (Fincra) / last session (Swappr) | **LIVE VERIFIED** (both) — but **Fincra has no code adapter wired**, see routing doc |
| **Payout status lookup** | `GET /disbursements/payouts/reference/{ref}` — full object returned | `GET /v1/payouts/{id}` — full object returned | Both live | **LIVE VERIFIED** (both) |
| **Payout idempotency** | `customerReference` reuse → **`422 DUPLICATE_CUSTOMER_REFERENCE`**, same for identical or different body — **rejects, does not replay** | `Idempotency-Key` reuse → **`200` identical cached object** on same body, **`409 idempotency_key_conflict`** on different body — **true replay semantics** | Both live-tested with same-key/same-body and same-key/different-body | **LIVE VERIFIED** (both) — **materially different models**, see below |
| **FX rates (indicative)** | N/A — Fincra's quote endpoint is locked, not indicative | `GET /v1/rates` — indicative, 60s cache, no lock | Fincra doesn't have a separate indicative-only endpoint; Swappr live-tested | Swappr **LIVE VERIFIED**; Fincra **NOT SUPPORTED** (has something stronger instead) |
| **Locked FX quotes** | `POST /quotes/generate` → real `reference` + `expireAt` ~30s, confirmed rate/fee/amounts | **Not supported** — no quote-lock concept exists | Fincra live this session; Swappr's absence confirmed last session via docs (`GET /v1/rates` explicitly "indicative") | Fincra **LIVE VERIFIED**; Swappr **NOT SUPPORTED** |
| **Conversions (wallet↔wallet)** | `POST /quotes/generate` (`transactionType:"conversion"`) live-tested for the quote step; the follow-up `POST /reference/initiate-currency-conversion` execution was **not** called this sprint | `POST /v1/conversions` documented, not called live | Fincra quote step live; execution untested for both | **DOCUMENTED ONLY** (both, execution step) |
| **Webhooks — enabled** | `enableWebhook: false` on the dashboard; **no API to enable it** (dashboard-only, confirmed from docs) | Requires `POST /v1/webhook_endpoints` registration; not yet registered | Fincra: confirmed via `GET /profile/business/me` + docs. Swappr: confirmed via docs, not yet called | **BLOCKED** (both — for different reasons) |
| **Webhook signatures** | `signature` header, HMAC-SHA512 over JSON body — matches existing `verifyFincraWebhook()` | `X-Swappr-Signature: t=…,v1=…`, HMAC-SHA256 over `t.rawBody` — matches existing `verifySwapprWebhook()` | Both confirmed from docs; **neither validated against a real delivered event** | **DOCUMENTED ONLY** (both) |
| **Reconciliation support** | `RemittanceTransfer` + new `FinancialReconciliationException` model apply to any provider once an adapter is wired | Same | Code exists, generic | **IMPLEMENTED BUT UNVERIFIED** (both, pending real webhook + real ambiguous failure) |
| **Fees (NGN payout)** | `fee: 0` observed on all three test payouts (sandbox may not reflect real fees) | `fee_minor` field present in payout response, `"0"` observed once | Both live, sandbox only | **LIVE VERIFIED (sandbox only — not representative of production pricing)** |
| **Supported currencies** | 21 currency wallets provisioned in sandbox (NGN, GBP, USD, EUR, CAD, GHS, KES, XOF, + stablecoins + more, several at 0 balance) | NGN confirmed live; GBP/USD/EUR/CAD payout recipient shapes documented but **not coded** in the adapter (NGN-only implemented) | Fincra: live wallet list. Swappr: partial | Fincra **LIVE VERIFIED (breadth)**; Swappr **DOCUMENTED ONLY (breadth)**, **LIVE VERIFIED (NGN only)** |
| **Production readiness** | Not assessed — sandbox only, webhooks blocked, no code adapter | Sandbox NGN payout proven; **IP allowlist currently blocking this environment** | — | **NOT PRODUCTION READY** (both) |
| **IP restrictions** | None observed this session (all calls succeeded without an allowlist error) | **Actively enforced** — `403 ip_not_allowed` encountered mid-session-2, blocking further testing | Live evidence both ways | Fincra: **LIVE VERIFIED (no restriction observed)**; Swappr: **LIVE VERIFIED (restriction confirmed, currently blocking)** |
| **Startup suitability** | Self-serve dashboard, merchant-level VA is simple, locked quotes reduce FX risk, sandbox has real test balances across many currencies out of the box | Self-serve, real payout proven, but idempotency model uses a stricter/harsher lock (VA is admin-provisioned, IP allowlist adds ops overhead) | Qualitative, based on the above | — (not a binary verdict; see routing doc) |

## Key qualitative differences discovered

1. **Idempotency semantics are opposite in a way that matters for the
   ambiguous-failure design.** Swappr's `Idempotency-Key` genuinely replays
   the original outcome — a client that lost the response can safely retry
   with the same key and get the answer back directly. **Fincra's
   `customerReference` only tells you a duplicate was attempted (`422`); it
   does not hand back the original payout.** A caller must then separately
   discover the original `reference` to poll status — and there is **no
   documented "look up payout by customerReference" endpoint**, only
   look-up-by-`reference`. This is a real gap for the reconciliation flow and
   must be accounted for in any Fincra adapter (§K of the routing doc).

2. **Fincra's quote is genuinely locked (confirmed real); Swappr's is
   genuinely not.** This is the one place research and now live evidence
   agree cleanly.

3. **Sandbox does not validate a fabricated NGN account number for either
   provider's payout endpoint in the same way** — Fincra's sandbox accepted a
   payout to `0000000000` and settled it `"successful"`. This means
   **beneficiary-validation safety cannot be fully verified from sandbox for
   Fincra**; it must be treated as unverified for production until confirmed
   another way.

4. **Fincra has no code adapter implementing `RemittanceProvider` today.**
   Everything in this matrix is evidence about Fincra's *API*, not about
   FlipTrybe's *integration* — see `docs/providers/financial-routing.md` for
   why this is the actual current blocker, independent of which provider's
   economics are better.
