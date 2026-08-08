# FlipTrybe Financial Infrastructure

## Regulatory disclaimer

FlipTrybe's intended model is to rely on appropriately regulated third-party financial infrastructure providers for regulated financial activities. Final licensing, regulatory, contractual, agency, and compliance requirements must be confirmed for each product, jurisdiction, and provider arrangement before production launch.

---

## Architecture

```
Customer
   │
FlipTrybe Interface (web / mobile)
   │
Financial Router (ProviderRouterService + CapabilityRouter)
   │
   ├── VIRTUAL ACCOUNTS  → VirtualAccountProvider (Swappr / mock)
   ├── VIRTUAL CARDS     → VirtualCardProvider (Payscribe / mock)
   └── REMITTANCE        → RemittanceProvider (Yativo / Swappr / mock)
```

FlipTrybe is the orchestration / software layer. The provider performs the regulated financial activity.

---

## Provider capability matrix

| Provider  | VA | Cards | KYC | Remittance | Collection | Payout | Sandbox | Status |
|-----------|----|----|-----|----|----|-----|---------|--------|
| Swappr    | ✓* | — | — | ✓* | — | — | Unknown | No public docs — adapter code-complete but unverified |
| Payscribe | — | ✓* | — | — | — | — | Unknown | No public docs — adapter code-complete but unverified |
| Yativo    | — | — | — | ✓ | — | ✓ | Yes | Docs verified (docs.yativo.com). Beneficiary-ID gap (pre-registration required) |
| Mock      | ✓ | ✓ | ✓ | ✓ | — | — | Built-in | Development/test only |

`*` = adapter implemented but provider docs not publicly available — production use requires credentials + docs verification.

---

## Virtual Accounts

**Provider**: Swappr (unverified) / Mock (dev)  
**Currencies**: NGN (others pending provider confirmation)  
**Countries**: NG

### Creation flow
1. Customer requests virtual account via `POST /api/financial-products/virtual-account`
2. `FinancialProductsService.createVirtualAccount()` selects provider via `ProviderRouterService`
3. Provider creates account; details stored in `VirtualAccount`
4. `VirtualAccountCreated` event emitted

### Inbound credit (webhook flow)
1. Provider sends webhook to `/api/webhooks/financial/:provider`
2. Signature verified; raw event stored in `ProviderWebhookEvent`
3. `FinancialProductsWebhookService.handle()` dispatched
4. `handleVirtualAccountCredit()` finds `VirtualAccount` by `providerAccountId`
5. Idempotency check on `VirtualAccountCredit.providerEventId`
6. DB transaction: `LedgerEntry` (CREDIT) + `VirtualAccountCredit` created atomically
7. `VirtualAccountCredited` event emitted

### Models
- `VirtualAccount` — account details + provider reference
- `VirtualAccountCredit` — per-credit audit record with ledger linkage

---

## Virtual Cards

**Provider**: Payscribe (unverified) / Mock (dev)  
**Card types**: VISA / MASTERCARD  
**Currencies**: USD (others pending provider confirmation)

### Lifecycle states
`REQUESTED → ACTIVE → FROZEN ↔ ACTIVE → TERMINATED`

### Funding
Card funding follows the provider's model. The current abstraction calls `VirtualCardProvider.fundCard()`. A `VirtualCardWalletCharge` records the workspace wallet debit.

### Models
- `VirtualCard` — card details, status, provider reference
- `VirtualCardWalletCharge` — wallet debit record per funding event

---

## Remittance

**Providers**: Yativo (docs verified, gap: beneficiary pre-registration) / Swappr (unverified) / Mock (dev)

### Supported corridors (pending provider verification)
All corridors are created DISABLED by default. Admin enables after provider KYB and compliance sign-off.

| From | To | Collection | FX | Payout |
|------|-----|----|----|--------|
| UK (GBP) | Nigeria (NGN) | UK-compatible provider | Provider | Nigerian bank |
| US (USD) | Nigeria (NGN) | US-compatible provider | Provider | Nigerian bank |
| UK (GBP) | Ghana (GHS) | UK-compatible provider | Provider | Bank / MoMo |
| US (USD) | Ghana (GHS) | US-compatible provider | Provider | Bank / MoMo |
| UK (GBP) | Liberia (LRD) | UK-compatible provider | Provider | Supported rail |
| US (USD) | Liberia (LRD) | US-compatible provider | Provider | Supported rail |

### Quote flow
1. `GET /api/financial-products/remittance/quote` with sourceAmount + corridor
2. `RemittanceProvider.getQuote()` returns locked `RemittanceQuote` with `expiresAt`
3. Frontend displays transparent breakdown: sendAmount / fee / FX rate / receiveAmount
4. Quote must not be reused after `expiresAt` — request a new one

### Transfer state machine
```
QUOTED → CHARGED → PROCESSING → COMPLETED
                              ↘ FAILED
                              ↘ DISPUTED
```

### Idempotency
Every transfer has a unique `idempotencyKey`. Provider call is wrapped with idempotency so a network retry cannot create two transfers. If provider status is PROCESSING, no second call is made — status is polled.

### Partial failure
Collection succeeded + payout failed → `DISPUTED` state → manual review in admin.

### Models
- `RemittanceTransfer` — full transfer record with quote fields inlined
- `RemittanceWalletCharge` — wallet debit for the source amount
- `RemittanceBeneficiary` — saved payout recipients (customer-facing)
- `RemittanceCorridor` — enabled corridors with provider routing and limits

---

## KYC / KYB

### Customer KYC
- Managed by `KycService`
- Provider-hosted verification preferred (no raw documents stored by FlipTrybe)
- FlipTrybe stores: `KycVerification` (providerReference, status, level, timestamps)
- Levels: LIGHT / STANDARD / ENHANCED

### FlipTrybe KYB (provider onboarding)
- Separate from customer KYC
- `KybApplication` model tracks FlipTrybe's own business verification with each provider
- Must be APPROVED before the provider can be enabled for production traffic

### Adapter
`KycProviderAdapter` interface in `packages/providers/src/financial-products.ts`
Mock implementation available for dev/test. Real providers (Smile ID / Dojah / Youverify) to be integrated after KYB approval with a chosen KYC partner.

### KYC flag
`kycVerification: false` in feature-flags — enable after provider contract is in place.

---

## Webhooks

### Inbound (provider → FlipTrybe)
Endpoint pattern: `POST /api/webhooks/financial/:provider`

Each provider must have a dedicated signature-verification function:
- Fincra: `verifyFincraWebhook(body, signature, key)` — HMAC-SHA512 (implemented)
- Swappr / Payscribe / Yativo: pending docs verification

Flow:
1. Raw body stored in `ProviderWebhookEvent` (idempotent on `providerEventId`)
2. `signatureValid` flag set
3. `FinancialProductsWebhookService.handle()` dispatched
4. `processed = true` after successful handling

Security: replay protection via `providerEventId` uniqueness. Same event arriving multiple times produces one outcome.

---

## Ledger

Uses existing `LedgerEntry` (CREDIT | DEBIT | HOLD | RELEASE | REVERSAL) + `Wallet` per workspace/currency.

Financial products add entries with `sourceType = "VIRTUAL_ACCOUNT" | "VIRTUAL_CARD" | "REMITTANCE"`.

The ledger records what happened. It is NOT a customer money balance — customer funds are held by the provider.

---

## Money conventions

All amounts in minor units (pence, cents, kobo, pesewa). Currency stored as ISO code. `money()` helper enforces integer constraint. Never use floating-point for money calculations.

---

## Environment variables

```
# Swappr — virtual accounts + remittance (unverified, no public docs)
SWAPPR_API_KEY=
SWAPPR_BASE_URL=

# Payscribe — virtual cards (unverified, no public docs)
PAYSCRIBE_API_KEY=
PAYSCRIBE_BASE_URL=

# Yativo — remittance (docs verified: docs.yativo.com)
YATIVO_CLIENT_ID=
YATIVO_CLIENT_SECRET=
YATIVO_BASE_URL=https://api.yativo.com

# KYC provider (to be selected — Smile ID / Dojah / Youverify / Mono)
KYC_PROVIDER_API_KEY=
KYC_PROVIDER_BASE_URL=
KYC_PROVIDER_WEBHOOK_SECRET=
```

---

## Production activation steps

For each provider, in order:

1. Create provider account
2. Complete FlipTrybe KYB / business verification
3. Obtain sandbox credentials
4. Configure adapter (see `packages/providers/src/financial-products.ts`)
5. Run sandbox tests (see `financial-products.test.ts`)
6. Complete production compliance requirements
7. Obtain production credentials
8. Run controlled live transaction
9. Enable ProviderConfig row in database
10. Enable relevant corridor(s) in `RemittanceCorridor` table

---

## Known blockers

| Blocker | Area | Action required |
|---------|------|-----------------|
| Swappr — no public API docs | VA + Remittance | Contact Swappr for partner/private API docs |
| Payscribe — no public API docs | Cards | Contact Payscribe for partner/private API docs |
| Yativo — beneficiary pre-registration gap | Remittance | Determine if inline beneficiary creation is available; update adapter |
| KYC provider — not contracted | KYC | Select and contract a KYC/identity provider (Smile ID, Dojah, Youverify) |
| All providers — no credentials | All | Complete KYB with each provider before production |
| Corridors — all DISABLED | Remittance | Enable individually after provider + compliance sign-off |
| `kycVerification` flag | KYC | Set to `true` after provider contract is signed |
