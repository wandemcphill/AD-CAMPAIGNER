# FlipTrybe Voucher Engine — v2.1 Addendum: Product Catalog Integration
**Status:** Draft for engineering review
**Supersedes:** v2 Addendum §2 (data model) and the routing-table mechanism in v2 §2.2–2.3. v2 §§0, 1, 3, 4, 5, 6, 7 carry forward as noted below — either unchanged or with the specific amendments called out inline. v1 §§2–4, 7 (lifecycle, user flows, API surface) remain unchanged and still apply as written.

---

## 0. What changed and why (v2 → v2.1)
v2 generalized the voucher engine from two hardcoded products into an open `voucher_type` enum with a redemption routing table. That solved "adding a new type shouldn't mean shipping a new product," but it still forced every new type — and especially every new SMM/third-party service — into the vouchers table itself.

This revision decouples that further: **the voucher no longer encodes what it redeems into. It points at a `product_id` in a centralized product catalog**, and the catalog record carries all type-specific behavior (handler, provider, input requirements, wallet target). This resolves two things v2 left unresolved:
- **Granular SMM packaging.** v2's `promotion_credit` type was one generic wallet credit. Real SMM packaging wants specific, sellable SKUs – "10,000 TikTok Views," "500 Instagram Followers" — each with its own provider mapping and input validation, without a schema migration per SKU.
- **Metadata-driven redemption UI.** Input fields, validation, placeholder text, and branding come from the product's config at render time, instead of being hardcoded per type in the frontend.

**The v2 §5 constraint is unchanged and still load-bearing:** the product is fixed at issuance. Nothing here reopens "buyer picks later" or "holder chooses at redemption." A voucher is minted against one `product_id` and redeems to exactly that product. This revision changes *where* the redemption target is defined (a catalog row instead of an enum branch) — not *when* it's fixed.

---

## 1. The product catalog
`voucher_type` (v2 §1) and the redemption routing table (v2 §2.2) are replaced by a `products` table. Each row is one sellable, redeemable thing.

| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique product identifier |
| `name` | String | e.g., "1,000 TikTok Views," "MTN N500 Airtime," "Campaign Credit" |
| `category` | Enum | `campaign` \| `telecom` \| `smm` \| `creator` \| `gift` |
| `handler` | Enum | `wallet_credit` \| `vtu_topup` \| `smm_order` \| `external_api` |
| `provider` | String | e.g., `mshare`, `vtpass`, `smm_lite` (null for internal wallets) |
| `provider_service_id` | String | SKU/ID used by the external supplier's API |
| `input_schema` | JSONB | JSON Schema defining required redemption-time inputs (target URL, phone number, network, etc.) |
| `target_wallet_type` | Enum (nullable) | `campaign` \| `creator` \| `promotion` \| `user` \| `marketplace` — set only when `handler = wallet_credit` |
| `active` | Boolean | Soft-disables the product from new purchases without deleting history |

Example `input_schema`, TikTok Views product:
```json
{
"type": "object",
"properties": {
"url": {
"type": "string",
"format": "uri",
"pattern": "^https:\/\/(www\.)?tiktok\.com\/.*$"
}
},
"required": ["url"]
}
```

The v2 §1 voucher-type table becomes a reference mapping, not a schema: each row there now corresponds to one or more `products` rows under the matching `category` / `target_wallet_type`. `campaign_credit` → `category = campaign`, `airtime`/`data` → `category = telecom`, etc. Adding a new SMM SKU is now a catalog insert, not an enum change — a smaller unit of work than v2 already achieved.

---

## 2. The vouchers table (updated again)
| Field | v2 | v2.1 |
|---|---|---|
| `voucher_type` | open enum (v2 §2.1) | *(removed)* |
| — | — | `product_id` (UUID, FK → `products.id`) — replaces `voucher_type` and `redemption_destination`'s wallet-routing role |
| `redemption_destination` | phone number, or `{wallet_type, wallet_id}` | superseded by `product_id` + `redemption_input` below; retained only for phone-number-style destinations captured at purchase, if that flow is kept |
| `redemption_input` | *(new)* | JSONB — user-supplied inputs at redemption, validated against `product.input_schema` |
| `status` | `sealed` \| `revealed` \| `redeemed` | `sealed` \| `revealed` \| `fulfillment_pending` \| `redeemed` \| `failed` — adds the two intermediate states needed for async/third-party fulfillment |

`voucher_claim_tokens` and first-claim-wins logic (v1 §5.2–5.3, confirmed unchanged in v2 §2.1) are unaffected — they key off `voucher_id` and don't inspect `product_id` or type.

---

## 3. Redemption flow with error handling
v2 §2.3's table lookup becomes a product lookup, and the flow gains the intermediate states needed because SMM/VTU providers fail in ways internal wallet credits don't (rate limits, timeouts, downstream 5xx, invalid recipient).

```
POST /vouchers/:id/redeem { pin, user_input }
↓
1. Validate PIN, check voucher.status == 'revealed'
2. Lock voucher row to prevent race conditions
↓
3. Load product via product_id
4. Validate user_input against product.input_schema
↓
5. Transition status → 'fulfillment_pending' (persist input, release lock quickly)
↓
6. Execute handler per product.handler

aidapping wallet_credit → credit target_wallet_type balance → status = 'redeemed'

‒ smm_order / vtu_topup → dispatch to provider (optionally via background job)
success → status = 'redeemed'
failure → status = 'failed'; log error payload; flag for admin retry or refund
```

On failure, two handling strategies — pick one per product or globally, not yet decided:
- **Option A — automated rollback.** Revert to `revealed` so the user can correct input (broken link, private account) and retry.
- **Option B — support queue.** Set `failed` and generate an ops-dashboard task for manual review or refund to the user's wallet.
This is now an open decision — see §9 item 6.

---

## 4. Visual design
Unchanged from v2 §3 in every respect except the badge/accent source: it now reads from `product.category` (or an explicit per-product badge override, if individual SMM SKUs need distinct labels) rather than `voucher_type`. Same template, same PIN label, same transfer-rights line, same share-image rules — no new design work per product beyond a badge and a color, same as v2 promised for types.

---

## 5. Campaign vs. Promotion separation (unchanged)
v2 §4's reasoning and conclusion carry forward exactly: Campaign Credit funds real ad spend via official platform APIs; Promotion Credit funds SMM/SMD panel services that commonly violate those same platforms' terms. Under the catalog model this separation is enforced by `target_wallet_type` (`campaign` vs `promotion`, distinct ledgers) plus, at the `provider` field, distinct provider integrations per product — but the actual firewall is still the org/infrastructure decision v2 flagged: keeping platform-facing ad accounts entirely separate from panel-serving infrastructure. That's not something the catalog schema can enforce on its own, and it's still worth flagging to whoever owns the platform relationships before this ships.

---

## 6. Fixed at issuance (unchanged, restated for the catalog model)
v2 §5's constraint holds without modification: no "buyer picks later," no "holder chooses at redemption." Under this revision, that means **`product_id` is fixed at issuance** — the same regulatory reasoning applies (a voucher whose destination is chosen after purchase, especially if transferable pre-reveal, starts to resemble general-purpose stored value rather than a fixed-purpose credit or licensed resale). "Open-choice redemption" remains a separate, larger decision requiring its own legal review if it's ever raised — the catalog model does not change that calculus and shouldn't be read as reopening it.

---

## 7. Ledger and auditing (new)
v2 didn't need this section because every v2 type was either wallet-backed or a pure resale (airtime/data, no ledger). Direct-delivery catalog products (SMM, and any future non-wallet `external_api` handler) introduce a case v2's ledger model didn't cover: a voucher that's consumed without any user-facing wallet transaction.
- **Wallet-backed products** (`handler = wallet_credit`): unchanged from v2 – ledger increases by the voucher's intrinsic value on redemption.
- **Direct-delivery products:
- *On purchase:* cash received; record revenue and an unredeemed-voucher liability.
- *On redemption:* voucher consumed; platform incurs a cost from the third-party provider (SMM API charge, etc.).
- *Recommendation:* log an internal ledger entry per redemption tying fulfillment cost to liability clearance for that `voucher_id`, even though no customer wallet is touched. Otherwise COGS and liability clearance for this category have no audit trail.

---

## 8. Downstream of the voucher (carried over from v2 §6, unchanged)
Still not in scope for the voucher/catalog engine itself, still adjacent enough to track here:
1. Pooled-budget structure for Campaign Wallet spend across three ad platforms – separate regulatory review (pooled funds / payment aggregation).
2. Three-way reconciliation: Campaign Wallet balance, committed-but-unspent amounts, actual platform billing.
3. Ad account segmentation – one shared account per platform is a single point of failure.
4. AI-generated creative compliance screening before creative reaches any platform's API.
5. Cross-platform metrics normalization (reach/engagement/conversion across Meta/TikTok/Google).

None of these block the catalog/voucher engine build; they block confidently launching pooled Campaign Wallet spend, a separate milestone.

---

## 9. Open decisions
Carried over from v2 §7, plus two new ones surfaced by this revision:
1. Anonymous-claim holding period.
2. Purchaser cancel/revoke before claim.
3. Rate limiting on `/claim/:token`.
4. Airtime/data destination: locked at purchase vs. chosen at reveal.
5. Wallet ledger schema/migration — still needs concrete design despite the separation principle being settled.
6. **(New)** Failure-handling strategy for direct-delivery redemptions — automated rollback to `revealed` (Option A) vs. support-queue with manual refund (Option B), per §3. May differ by product category.
7. **(New)** Background-worker/job layer for async third-party fulfillment (SMM/VTU dispatch, retry policy, timeout handling) — the main new engineering surface this revision introduces; not yet designed.