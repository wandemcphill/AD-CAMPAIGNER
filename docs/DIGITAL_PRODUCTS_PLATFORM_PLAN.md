# Digital Products Platform — Implementation Plan

**Status:** Proposed — awaiting build approval
**Date:** 30 July 2026
**Scope:** International SMS Numbers + VTU (Airtime & Data), built together on shared provider infrastructure

---

## 1. Why one plan for two products

International SMS Numbers and VTU are different products with different lifecycles, but they are the same *shape* of system:

```
catalog → quote (provider cost + FX + margin) → wallet debit + ledger entry
        → route to provider → fulfil → confirm → reverse on failure
        → admin observes cost/revenue/margin
```

Roughly 60% of the work is that shared spine. Building them sequentially means building it twice and diverging. This plan builds the spine once (Phase 0), then hangs both verticals off it.

**Decisions already taken:**

| Decision | Choice |
|---|---|
| Namespace | Rename dormant `Otp*` infra to neutral `Provider*` / `NumberProvider*` |
| Frontend surface | `/os` only. New **Digital Products** nav group |
| Admin surface | Extend standalone `apps/admin` |
| Number providers | **SMSPool + 5SIM + SMSPVA**, all three at launch |
| FX rate | Admin-settable, versioned, guardrailed |
| US number pricing | Full duration ladder; 30d thin at ~₦34,000 (23%), 90/180/360d amortised |
| UK hero SKU | 360-day, ~₦12,000/year |
| Build order | Both verticals in one pass (Option B) |
| Bills / cable TV | Designed into the adapter interface, **deferred to Phase 5** |

---

## 2. Current-state findings

### 2.1 Dormant OTP infrastructure exists

`packages/database/prisma/schema.prisma:1315-1477` contains a complete OTP marketplace: `OtpService`, `OtpProviderConfig`, `OtpOrder`, `OtpMessage`, `OtpProviderHealth`, `OtpWalletCharge`, `OtpRoutingAttempt`, `OtpPricingRule`.

`packages/providers/src/index.ts` contains a working `OtpProviderAdapter` interface plus four adapters: TextVerified, 5sim, sms-man, and an sms-activate-compatible driver.

**It is wired to nothing.** No API module, no service class, no worker queue, no UI, no seed data. `git ls-files | grep -i otp` returns one file — the migration. `ENABLE_OTP_MODULE=false`.

This is an asset, not a liability: the provider abstraction, pricing-rule shape, health model and routing-attempt audit are all reusable. What is wrong is the *domain model* — `OtpOrder` describes a short-lived verification, not a rented number instance.

### 2.2 VTU is not implemented

Contrary to earlier assumption, there is no VTU integration:

| Artefact | Reality |
|---|---|
| `apps/api/src/modules/vouchers/vouchers.service.ts:30` | Seed row `handler: "VTU_TOPUP", provider: "vtu"`. Nothing dispatches on `VTU_TOPUP`. |
| `apps/web/app/os/airtime/page.tsx` | Static mock. `DATA_BUNDLES`, `AIRTIME_AMOUNTS`, `RECENT`, `FAVORITES` are hardcoded arrays. |
| `apps/web/app/admin/providers/page.tsx:19` | `MOCK_PROVIDERS` array with a hardcoded "Airtime / healthy / 280ms" entry. |

No adapter, no order model, no catalog, no queue. VTU is greenfield.

### 2.3 Reusable infrastructure

| Concern | Where | Reuse |
|---|---|---|
| Wallet + ledger | `Wallet`, `LedgerEntry` (`CREDIT/DEBIT/HOLD/RELEASE/REVERSAL`, unique `idempotencyKey`) | Direct |
| Charge/refund pattern | `DigitalAccessWalletCharge` + `DigitalAccessHubService.refundRequest` | Copy shape |
| Vertical-slice template | `apps/api/src/modules/digital-access/digital-access.service.ts` (1736 lines) | Copy structure |
| Queues | `apps/worker/src/queues.ts` — BullMQ, per-queue concurrency/retry/backoff, flag-gated | Add 2 queues |
| Events | `packages/events` — typed `PlatformEvent` union + `EventOutbox` | Extend |
| Notifications | `Notification` + `NotificationPreference`, typed content builders | Extend |
| Audit | `AuditLog` (workspace/actor/action/entity) | Direct |
| Permissions | `packages/types` — `campaign:create`, `admin:access`, `analytics:read`, `audit:read` | Direct |

**Constraint to respect:** migration `20260604170000_financial_integrity_guards` adds `CHECK ("amountMinor" > 0)` on `LedgerEntry`. Refunds are separate positive `REVERSAL` entries, never negative amounts.

---

## 3. Shared foundation (Phase 0)

### 3.1 Provider registry — replaces `Otp*` infra

```prisma
enum ProviderDomain { VIRTUAL_NUMBER VTU }
enum ProviderTier   { PREMIUM BUDGET }
enum ProviderStatus { HEALTHY DEGRADED DOWN DISABLED }

model ProviderConfig {
  id                  String         @id @default(uuid())
  name                String         @unique     // "smspool", "clubkonnect"
  domain              ProviderDomain
  tier                ProviderTier   @default(BUDGET)
  status              ProviderStatus @default(DISABLED)
  priority            Int            @default(100)
  enabledCountries    String[]       @default([])  // numbers: ["US","GB","CA"]
  enabledNetworks     String[]       @default([])  // vtu: ["MTN","GLO"]
  enabledProductTypes String[]       @default([])  // ["airtime","data","number_rental"]
  credentialsRef      String?                      // env var NAME, never the secret
  metadata            Json           @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([domain, status, priority])
}

model ProviderHealth {
  id             String         @id @default(uuid())
  providerName   String
  domain         ProviderDomain
  status         ProviderStatus
  latencyMs      Int
  successRateBps Int
  balanceMinor   Int?
  currency       String?
  reason         String?
  checkedAt      DateTime       @default(now())

  @@index([providerName, checkedAt])
  @@index([domain, status, checkedAt])
}

model ProviderRoutingAttempt {
  id           String         @id @default(uuid())
  domain       ProviderDomain
  orderType    String                       // "number_purchase" | "vtu_airtime" | ...
  orderId      String
  providerName String
  score        Int
  status       String                       // SELECTED | SKIPPED | FAILED
  reason       String?
  createdAt    DateTime       @default(now())

  @@index([orderType, orderId, createdAt])
  @@index([providerName, status, createdAt])
}
```

**Migration note:** `OtpProviderConfig`, `OtpProviderHealth`, `OtpRoutingAttempt` and `OtpPricingRule` are dropped and replaced. No production data exists behind them (`ENABLE_OTP_MODULE=false`, zero call sites), so this is a clean drop-and-create, not a data migration. `OtpOrder`, `OtpMessage`, `OtpService` and `OtpWalletCharge` are also dropped — superseded by the `VirtualNumber*` models below.

### 3.2 FX rate — admin-settable

```prisma
enum FxRateSource { MANUAL CBN PROVIDER_FEED }

model FxRate {
  id            String       @id @default(uuid())
  baseCurrency  String       @default("USD")
  quoteCurrency String       @default("NGN")
  rateMicros    BigInt                      // 1450.25 -> 1_450_250_000
  bufferBps     Int          @default(0)    // cushion applied on top of raw rate
  source        FxRateSource @default(MANUAL)
  effectiveFrom DateTime     @default(now())
  effectiveTo   DateTime?                   // null = currently active
  setByUserId   String?
  note          String?                     // "parallel + 3%, 30 Jul"
  createdAt     DateTime     @default(now())

  @@index([baseCurrency, quoteCurrency, effectiveFrom])
}
```

The active rate is the row with `effectiveTo IS NULL`. Setting a new rate closes the previous one — the table is append-only history.

**Every order snapshots `fxRateId` + `fxRateMicrosApplied` at quote time.** Never recomputed. This is what makes margin analysis reconstructable months later.

**Guardrails (all enforced server-side, not just in the UI):**

| Guardrail | Behaviour |
|---|---|
| Absolute bounds | `FX_NGN_MIN` / `FX_NGN_MAX` env band. Outside → reject. |
| Large-change confirm | >10% delta from active rate requires explicit `confirmLargeChange: true` |
| Sell-below-cost check | Re-price every active SKU against current provider cost; refuse if any falls below `minimumMarginMinor`. Return the offending SKUs. |
| Staleness | Quotes refuse to issue on a rate older than `FX_MAX_AGE_HOURS`. Never silently sell at a stale rate. |
| Audit | Every change writes `AuditLog` action `fx_rate.updated` with old → new and actor. |

Optional daily job that *proposes* a rate from a feed but never applies it without an operator.

**Costing assumption:** ₦1,450/USD (parallel ₦1,408 + buffer; CBN ₦1,365 as of 28 Jul 2026). The existing `OtpPricingRule.usdToNgnRate` default of **1600 is stale by ~15%** and is removed.

### 3.3 Pricing rules — scoped, most-specific-wins

```prisma
model PricingRule {
  id                 String         @id @default(uuid())
  domain             ProviderDomain
  // scope — all nullable; NULL = wildcard
  countryCode        String?
  network            String?        // MTN | GLO | AIRTEL | 9MOBILE
  productType        String?        // airtime | data | number_rental
  providerName       String?
  durationDays       Int?
  // economics
  markupBps          Int            @default(0)   // what we add
  discountBps        Int            @default(0)   // what the provider gives us (VTU)
  minimumMarginMinor Int            @default(0)
  platformFeeMinor   Int            @default(0)
  customerCurrency   String         @default("NGN")
  active             Boolean        @default(true)
  specificity        Int            @default(0)   // computed; higher wins
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([domain, active, specificity])
}
```

Resolution walks rules matching the request, ordered by `specificity` descending, first match wins. `specificity` is computed on write as the count of non-null scope fields, so `country+duration+provider` beats `country+duration` beats `country`.

```
customer_price = (provider_cost_usd × fx_rate × (1 + buffer_bps/10000)) × (1 + markup_bps/10000)
                 + platform_fee_minor
customer_price = max(customer_price, provider_cost_ngn + minimum_margin_minor)
```

For VTU where cost is already NGN, the FX term is skipped and `discountBps` reduces `provider_cost`.

**Provider prices are never seeded.** They are read live from each adapter at quote time. Grey-market pricing moves without notice and providers die without notice — see SMS-Activate, shut down 29 Dec 2025.

### 3.4 Router core

New module `packages/providers/src/router.ts`, generalising the existing `createRoutedSmmSupplier` pattern:

```ts
export interface RoutingCandidate {
  providerName: string;
  score: number;
  costMinor: number;
  available: boolean;
  reason?: string;
}

export interface RouterInput {
  domain: ProviderDomain;
  scope: { countryCode?: string; network?: string; productType: string; durationDays?: number };
}

// score = priority weight × health weight × inverse-cost weight × availability
// every candidate considered is written to ProviderRoutingAttempt
export function selectProvider(input: RouterInput, configs: ProviderConfig[],
                               health: ProviderHealth[]): RoutingCandidate[];
```

The router returns an *ordered list*, not a single choice — fulfilment walks it on failure. Every candidate evaluated, selected or skipped, is recorded.

---

## 4. Vertical A — International SMS Numbers

### 4.1 Positioning constraints (from brief)

- Never marketed as "OTP bypass" or account-verification bypass.
- Never promise universal compatibility. Compatibility is displayed as evidence, never guarantee.
- SMS receive only. **No** dialer, VoIP calling, call history, forwarding, SIP/PBX, voicemail, or voice recording.

### 4.2 Schema

```prisma
enum NumberCapability          { SMS }        // VOICE deliberately absent
enum NumberRentalKind          { TEMPORARY STANDARD EXTENDED LONG_TERM }
enum VirtualNumberStatus       { RESERVED PROVISIONING ACTIVE EXPIRING EXPIRED
                                 RELEASED FAILED SUSPENDED }
enum VirtualNumberOrderKind    { PURCHASE RENEWAL }
enum VirtualNumberOrderStatus  { QUOTED CHARGED PROVISIONING FULFILLED FAILED
                                 REFUNDED CANCELLED }
enum NumberCompatibilityLevel  { TESTED_WORKING LIKELY_WORKS VARIES NOT_SUPPORTED UNKNOWN }

model NumberCountry {
  isoCode    String  @id            // "US"
  name       String
  dialPrefix String
  flagEmoji  String
  enabled    Boolean @default(false)
  sortOrder  Int     @default(100)
}

model VirtualNumberProduct {
  id                 String            @id @default(uuid())
  countryCode        String
  capability         NumberCapability  @default(SMS)
  rentalKind         NumberRentalKind
  durationDays       Int
  displayName        String
  active             Boolean           @default(false)
  preferredProviders String[]          @default([])   // routing hint, not a binding
  metadata           Json              @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([countryCode, capability, durationDays])
  @@index([countryCode, active])
}

model VirtualNumber {                   // the allocated service INSTANCE
  id                String              @id @default(uuid())
  workspaceId       String
  userId            String?
  productId         String
  providerName      String
  providerNumberId  String
  e164              String              // full number; visible to owner only
  countryCode       String
  status            VirtualNumberStatus @default(RESERVED)
  provisionedAt     DateTime?
  activatedAt       DateTime?
  expiresAt         DateTime?
  expiryWarnedAt    DateTime?
  releasedAt        DateTime?
  renewalCount      Int                 @default(0)
  messageCount      Int                 @default(0)
  lastMessageAt     DateTime?
  lastPolledAt      DateTime?           // message-ingestion cursor
  supplierCostMinor Int                 @default(0)
  supplierCurrency  String              @default("USD")
  metadata          Json                @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([providerName, providerNumberId])
  @@index([workspaceId, status, expiresAt])
  @@index([status, expiresAt])          // drives the lifecycle sweep
}

model VirtualNumberMessage {            // belongs to the INSTANCE, not the product
  id                 String    @id @default(uuid())
  virtualNumberId    String
  providerMessageId  String?
  senderRaw          String?
  senderMasked       String
  bodyEncrypted      String
  bodyRedacted       String
  receivedAt         DateTime
  providerReceivedAt DateTime?
  providerStatus     String?
  retainUntil        DateTime            // enforced by retention_purge job
  metadata           Json      @default("{}")
  createdAt DateTime @default(now())

  @@unique([virtualNumberId, providerMessageId])
  @@index([virtualNumberId, receivedAt])
  @@index([retainUntil])
}

model VirtualNumberOrder {
  id                  String                  @id @default(uuid())
  workspaceId         String
  userId              String?
  productId           String
  virtualNumberId     String?
  kind                VirtualNumberOrderKind
  status              VirtualNumberOrderStatus @default(QUOTED)
  amountMinor         Int
  currency            String                  @default("NGN")
  supplierCostMinor   Int                     @default(0)
  supplierCurrency    String                  @default("USD")
  fxRateId            String?
  fxRateMicrosApplied BigInt?
  providerName        String?
  providerReference   String?
  idempotencyKey      String                  @unique
  riskScore           Int                     @default(0)
  attestationAccepted Boolean                 @default(false)
  requestIpAddress    String?
  requestUserAgent    String?
  requestDeviceId     String?
  attemptCount        Int                     @default(0)
  failureReason       String?
  metadata            Json                    @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId, status, createdAt])
  @@index([providerName, providerReference])
}

model VirtualNumberWalletCharge {        // mirrors DigitalAccessWalletCharge exactly
  id                  String   @id @default(uuid())
  workspaceId         String
  walletId            String
  orderId             String
  idempotencyKey      String   @unique
  amountMinor         Int
  currency            String   @default("NGN")
  status              String   @default("CHARGED")   // CHARGED | REFUNDED | FAILED
  debitLedgerEntryId  String?
  refundLedgerEntryId String?
  metadata            Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([workspaceId, orderId])
  @@index([walletId, createdAt])
}

model NumberCompatibility {
  id             String                    @id @default(uuid())
  serviceKey     String                    // "telegram", "whatsapp", "google"
  countryCode    String?
  providerName   String?
  numberType     String?                   // "non_voip" | "voip" | "mobile"
  level          NumberCompatibilityLevel  @default(UNKNOWN)
  successRateBps Int?
  sampleSize     Int                       @default(0)
  lastTestedAt   DateTime?
  evidence       String?
  blocked        Boolean                   @default(false)  // hard-block at purchase
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([serviceKey, countryCode, providerName, numberType])
}
```

### 4.3 Provider adapter contract

```ts
export interface VirtualNumberProviderAdapter {
  readonly name: string;
  readonly tier: ProviderTier;
  listCountries(): Promise<NumberCountryAvailability[]>;
  searchNumbers(input: { country: string; capability: "sms"; durationDays: number }):
    Promise<NumberOffer[]>;                       // MUST include wholesale cost
  reserveNumber(offer: NumberOffer): Promise<{ reservationId: string; expiresAt: string }>;
  provisionNumber(input: { reservationId?: string; offer: NumberOffer }):
    Promise<{ providerNumberId: string; e164: string; expiresAt: string }>;
  getNumberStatus(providerNumberId: string): Promise<ProviderNumberSnapshot>;
  getMessages(providerNumberId: string, since?: string): Promise<ProviderInboundMessage[]>;
  renewNumber(providerNumberId: string, durationDays: number):
    Promise<{ expiresAt: string; sameNumber: boolean }>;   // sameNumber is load-bearing
  releaseNumber(providerNumberId: string): Promise<{ released: boolean }>;
  getBalance(): Promise<ProviderBalance>;
  checkHealth(): Promise<ProviderHealthSnapshot>;
}
```

`renewNumber().sameNumber` must be surfaced to the user. If a provider cannot guarantee retention, the renewal UI says so before the user pays.

**Adapters to build:**

| Provider | Status | Coverage | Payment |
|---|---|---|---|
| **SMSPool** | New | US $18/mo, CA $20/mo, UK $55/360d. Non-VoIP. Auto-renew supported. | Visa/MC (Stripe) + 80+ crypto |
| **5SIM** | Adapt existing `createFiveSimOtpProvider` | 153 countries, rentals 1h–1mo | **Card top-up works from Nigeria** (NG + ZA are the only two supported countries) + crypto |
| **SMSPVA** | New | 60+ regions incl. Germany. Rentals days/weeks/months. Rental API: `getcountries`, `getdata` (weekly/monthly pricing), order state | Crypto + card |

**Adapters to remove:** `createSmsActivateCompatibleOtpProvider` — SMS-Activate shut down 29 Dec 2025. Keep the API *dialect* as a reusable shape (several survivors clone it) but do not ship it pointing at a dead host. `createTextVerifiedOtpProvider` and `createSmsManOtpProvider` are retained but excluded from the rental router (verification-oriented, not rental).

### 4.4 Country & SKU ladder at launch

| Country | Provider | Status |
|---|---|---|
| 🇬🇧 UK | SMSPool | Enabled — hero SKU |
| 🇺🇸 US | SMSPool | Enabled — full ladder |
| 🇨🇦 Canada | SMSPool | Enabled |
| 🇩🇪 Germany | SMSPVA | Enabled if inventory confirmed at integration |
| 🇦🇺 Australia | — | **Disabled at launch.** No confirmed long-term rental inventory across the three providers. Enable via `NumberCountry.enabled` when found. |

Indicative pricing at ₦1,450/USD — **all figures to be re-derived from live provider APIs before launch**:

| SKU | Cost | Sell | Margin |
|---|---|---|---|
| UK 360 days | ₦6,640 | **₦12,000** | 45% |
| US 30 days | ₦26,100 | **₦34,000** | 23% |
| US 90 / 180 / 360 days | amortised | per pricing rule | target 30–40% |
| Canada 30 days | ₦29,000 | ₦50,000 | 42% |
| 5SIM short rentals (1h–1mo) | ₦200–1,900 | ₦2,500–4,000 | varies |

### 4.5 Lifecycle

```
RESERVED → PROVISIONING → ACTIVE → EXPIRING → EXPIRED → RELEASED
                ↓                      ↓
              FAILED                RENEWED → ACTIVE
```

`SUSPENDED` is an admin/abuse action reachable from `ACTIVE`.

**Purchase flow, per brief §13:**

```
quote (live provider cost + FX + margin)
  → wallet debit + LedgerEntry DEBIT, same transaction, idempotent on key
  → enqueue provision job
  → adapter provisionNumber()
      success → VirtualNumber ACTIVE, order FULFILLED, notify
      failure → log ProviderRoutingAttempt, try next candidate
      all exhausted → LedgerEntry REVERSAL + charge REFUNDED + order FAILED + notify + ops case
```

The customer is never left charged for a number that does not exist. Lifted from `DigitalAccessHubService.refundRequest`.

**Message ingestion — both paths, idempotent on `(virtualNumberId, providerMessageId)`:**
- Webhook `POST /webhooks/numbers/:provider` with signature verification, for providers that push.
- Polling sweep driven by `VirtualNumber.lastPolledAt`, for providers that do not.

Both call the same ingest function so they can run concurrently without duplicating messages.

**Expiry:** warn at T-3d and T-1d (`expiryWarnedAt` prevents duplicates), mark `EXPIRING`, then `EXPIRED`, then release at provider and mark `RELEASED`. Once released the number must not display as active anywhere.

---

## 5. Vertical B — VTU (Airtime & Data)

### 5.1 Schema

```prisma
enum VtuProductType { AIRTIME DATA }
enum VtuNetwork     { MTN GLO AIRTEL NINE_MOBILE }
enum VtuPlanType    { SME CG GIFTING CORPORATE }
enum VtuOrderStatus { QUOTED CHARGED SUBMITTED DELIVERED FAILED
                      AMBIGUOUS REVERSED REFUNDED }

model VtuDataPlan {                     // catalog, synced from provider — never hand-seeded
  id             String      @id @default(uuid())
  providerName   String
  providerPlanId String
  network        VtuNetwork
  planType       VtuPlanType
  displayName    String
  sizeMb         Int
  validityDays   Int
  costMinor      Int                    // provider cost, NGN
  currency       String      @default("NGN")
  active         Boolean     @default(true)
  lastSyncedAt   DateTime    @default(now())

  @@unique([providerName, providerPlanId])
  @@index([network, planType, active])
}

model VtuOrder {
  id                String         @id @default(uuid())
  workspaceId       String
  userId            String?
  productType       VtuProductType
  network           VtuNetwork
  msisdnMasked      String                        // "0803****567" for display
  msisdnEncrypted   String                        // full number, encrypted at rest
  planId            String?                       // DATA only
  faceValueMinor    Int?                          // AIRTIME only
  amountMinor       Int                           // charged to customer
  costMinor         Int                           // provider cost after discount
  currency          String         @default("NGN")
  providerName      String?
  providerReference String?                       // provider-FORMAT reference — see 5.7
  status            VtuOrderStatus @default(QUOTED)
  idempotencyKey    String         @unique        // OURS. Never sent to a provider.
  attemptCount      Int            @default(0)
  failureReason     String?
  reconciledAt      DateTime?
  requestIpAddress  String?
  requestUserAgent  String?
  requestDeviceId   String?
  metadata          Json           @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId, status, createdAt])
  @@index([providerName, providerReference])
  @@index([status, createdAt])          // drives reconciliation sweep
}

model VtuProviderRoute {               // see 5.3 — routing table, not code
  id          String         @id @default(uuid())
  productType VtuProductType
  network     VtuNetwork?
  provider    String
  priority    Int
  active      Boolean        @default(true)
  note        String?
  updatedAt   DateTime       @updatedAt
  updatedBy   String?

  @@index([productType, network, active, priority])
}

model VtuWalletCharge {                 // identical shape to VirtualNumberWalletCharge
  id                  String   @id @default(uuid())
  workspaceId         String
  walletId            String
  orderId             String
  idempotencyKey      String   @unique
  amountMinor         Int
  currency            String   @default("NGN")
  status              String   @default("CHARGED")
  debitLedgerEntryId  String?
  refundLedgerEntryId String?
  metadata            Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([workspaceId, orderId])
  @@index([walletId, createdAt])
}
```

### 5.2 Provider adapter contract

```ts
export interface VtuProviderAdapter {
  readonly name: string;

  // --- reference generation: each provider dictates its own format (see 5.7) ---
  buildReference(order: { id: string; createdAt: Date }): string;

  // --- phase 1: airtime + data ---
  listDataPlans(network?: VtuNetwork): Promise<VtuPlanOffer[]>;   // cost included
  getAirtimeDiscountBps(network: VtuNetwork): Promise<number>;
  purchaseAirtime(input: { network; msisdn; faceValueMinor; reference }):
    Promise<VtuSubmitResult>;
  purchaseData(input: { network; msisdn; providerPlanId; reference }):
    Promise<VtuSubmitResult>;
  getOrderStatus(reference: string): Promise<VtuOrderSnapshot>;
  getBalance(): Promise<ProviderBalance>;
  checkHealth(): Promise<ProviderHealthSnapshot>;

  // --- designed now, NOT shipped in phase 1 (see 5.9) ---
  validateMeter?(input: { disco: string; meterNumber: string; meterType: "PREPAID" | "POSTPAID" }):
    Promise<{ valid: boolean; customerName?: string; address?: string; minAmountMinor?: number }>;
  purchaseElectricity?(input: { disco; meterNumber; meterType; amountMinor; reference }):
    Promise<VtuSubmitResult & { token?: string; units?: string }>;
  purchaseCable?(input: { provider; smartCardNumber; packageCode; reference }):
    Promise<VtuSubmitResult>;
}
```

Bills methods are optional on the interface so phase-1 adapters compile without them. Designing them in now costs nothing; retrofitting a pre-charge validation step into a fulfilment pipeline built without one does not.

**Adapters to build:**

| Provider | Role | Terms | Integration shape |
|---|---|---|---|
| **ClubKonnect** | Airtime base (MTN/Airtel), data failover | **Rate unresolved** — 5% API / 6% top reseller (secondary source) vs 7–8% on their consumer buy page. Blocking test, see 5.8 | HTTPS **GET only**; `UserID`+`APIKey` **in the query string**; JSON string responses; query by `OrderID` or `RequestID`; `CallBackURL` supported; 2FA + IP whitelist. **No sandbox.** Also covers cable, electricity, betting, recharge-card printing, Smile data, WAEC/JAMB e-PINs |
| **MobileNig** | Airtime for GLO / 9mobile | GLO premium **7.5%**, 9mobile premium **6%**, standard 2% | Published rate card |
| **CheapDataHub** | Data primary | MTN SME 1GB ₦228; airtime MTN 2.5% / GLO 4% / Airtel 1% / 9mobile 2.5% | Payvessel wallet funding, published plan IDs |
| **eBills Africa** | Airtime failover | 3% airtime, 10% data, ₦0 service fees | JWT auth (`/jwt-auth/v1/token`, 7-day expiry, latest-token-only) + optional IP whitelist |
| **VTpass** | **Sandbox / CI target**; bills provider when phase 3 lands | ~3% airtime, ~4.5% data; Discos 0.5–1.7% | Headers `api-key` + `public-key` (GET) / `secret-key` (POST). Keys shown **once**. Separate sandbox + live accounts and keys. Endpoints: `service-categories`, `services`, `service-variations`, `pay`, `requery`. **Time-derived `request_id`** — see 5.7. All 12 Discos + DSTV/GOTV/Startimes/Showmax |
| **SMEDATA** | Data third failover | MTN SME ~₦245–250 | Basic auth via URL token, Paystack funding |

### 5.3 Multi-provider routing table

**The routing table lives in the database, not in code.** Providers are swapped, re-ordered, or disabled by updating rows — no deploy required.

```prisma
model VtuProviderRoute {
  id          String     @id @default(uuid())
  productType VtuProductType          // AIRTIME | DATA
  network     VtuNetwork?             // null = any network
  provider    String                  // adapter name: "clubkonnect" | "vtpass" | …
  priority    Int                     // lower = preferred; 1 is first tried
  active      Boolean    @default(true)
  note        String?                 // "cheapest MTN Sep-2026" — why this is here
  updatedAt   DateTime   @updatedAt
  updatedBy   String?                 // admin userId

  @@index([productType, network, active, priority])
}
```

The router reads this table at order time, tries `priority 1` first, falls back to `priority 2` on failure, and records every attempt in `ProviderRoutingAttempt`. Adding a third provider (e.g. Reloadly, Shago) is one migration row and a new adapter — the router is unchanged.

**Launch routing rows (provisional on blocking tests in 5.8):**

| productType | network | provider | priority | note |
|---|---|---|---|---|
| AIRTIME | MTN | clubkonnect | 1 | best flat rate if ≥7% |
| AIRTIME | MTN | ebills | 2 | fallback |
| AIRTIME | AIRTEL | clubkonnect | 1 | |
| AIRTIME | AIRTEL | ebills | 2 | fallback |
| AIRTIME | GLO | mobilenig | 1 | 7.5% premium |
| AIRTIME | GLO | clubkonnect | 2 | fallback |
| AIRTIME | NINE_MOBILE | mobilenig | 1 | 6% premium |
| AIRTIME | NINE_MOBILE | clubkonnect | 2 | fallback |
| DATA | *(null)* | cheapdatahub | 1 | ₦228/GB |
| DATA | *(null)* | clubkonnect | 2 | |
| DATA | *(null)* | smedata | 3 | last resort |

**These rows collapse automatically when test results land:**
- If ClubKonnect API airtime is ≥7% flat → delete the MobileNig rows; ClubKonnect covers all networks at priority 1.
- If ClubKonnect data is genuinely ₦210/GB flat → swap it to priority 1 above CheapDataHub.
- No code changes. No deploy. One admin SQL update or admin-panel row edit.

**Admin panel toggle.** The `VtuProviderRoute` table is exposed in the admin VTU page as an editable grid: flip `active`, drag to reorder `priority`, add a `note`. Mutations write `AuditLog action: vtu_route.updated` with before/after state and actor.

**Rate monitor.** A `provider_health` job (see §6) records each provider's effective wallet balance. A separate `rate_check` task (Phase 2) calls each adapter's live plan/rate endpoint daily and stores results in `ProviderHealth.metadata` — this surfaces cost drift in the admin overview before it bites margin. No automated switching; human reviews the dashboard and updates rows.

Rationale: airtime discount is per-network and volume-tiered. MTN is structurally the worst margin on every platform (1.5–3%) because MTN controls dealer margins tightly; GLO and 9mobile pay materially more. ClubKonnect's flat rate beats every per-network MTN figure found; MobileNig's premium tiers add ~1.5–2.5 points on GLO/9mobile.

Revisit MobileVTU once monthly funding exceeds ₦5M — their top volume tier (MTN 3% / GLO 5% / 9mobile 4% / Airtel 3%) plus negotiation may beat ClubKonnect outright. Swapping them in is one routing-table update.

### 5.4 Indicative consumer pricing

| SKU | Cost | Sell | Margin | vs market |
|---|---|---|---|---|
| MTN SME 1GB | ₦228 | **₦290** | 21% | undercuts typical ₦350–500 |
| 9mobile 1GB | ₦140 | **₦200** | 30% | very aggressive |
| GLO 500MB | ₦225 | **₦280** | 20% | competitive |
| ₦1,000 airtime (MTN) | ₦950 | **₦990** | ₦40 | 1% user discount |
| ₦1,000 airtime (GLO) | ₦925 | **₦980** | ₦55 | 2% user discount |

### 5.5 Hard constraint: wallet-funded only

**Airtime and data are spendable from wallet balance only. Never a card charge per transaction.**

At 3% on MTN, a ₦1,000 top-up earns ₦30 gross. A single Korapay fee erases it entirely — the transaction becomes net-negative. The user tops up the wallet once (one payment fee, amortised over many purchases), then spends from balance. This is a product rule enforced at the API layer, not a UI suggestion.

Data carries the margin (20–30%); airtime is a retention product priced at a visible 1–2% user discount that costs almost nothing but reads as generous.

### 5.6 Critical: VTU is not idempotent-safe

A network timeout on a top-up submission does **not** tell you whether the credit landed. Blind retry double-spends real money.

**Rules:**
1. Always send a `providerReference` the provider echoes back, generated in that provider's required format (see 5.7) and persisted on the order **before** the submit call.
2. On timeout, **never retry the submit** — poll `getOrderStatus(reference)`. This applies equally to ClubKonnect's GET-based purchases: HTTP semantics say GET is safe to retry, but a timed-out top-up may already have vended.
3. If the provider cannot resolve the reference within the reconciliation window, mark the order `AMBIGUOUS` — not `FAILED`.
4. **Never auto-reverse an `AMBIGUOUS` order.** It goes to an ops queue for human resolution against the provider's own transaction log.
5. Only `FAILED` (provider-confirmed) auto-reverses via `LedgerEntry REVERSAL`.

This is the single highest-risk area of the VTU build and the reason a reconciliation job is mandatory, not optional.

### 5.7 References, credentials and provider-specific constraints

**`idempotencyKey` and `providerReference` are two different things and must not be conflated.**

| | `idempotencyKey` | `providerReference` |
|---|---|---|
| Owner | Us | Format dictated by the provider |
| Purpose | Deduplicate the customer's request across retries of *our* API | Identify the transaction when querying *the provider* |
| Lifetime | Stable for the logical order, forever | Stable for the logical order, forever — but regenerated per provider on failover |
| Sent to provider | **Never** | Always |

The trap: **VTpass requires `request_id` in unix format `YYYYMMDDHHII`** — today's date plus current hour and minute, minimum 12 characters, first 12 numeric and date-based. That is time-derived, so it cannot double as an idempotency key. Two orders from one user in the same minute collide on prefix, and a retry an hour later would produce a *different* reference for the same logical order — destroying the ability to requery it.

Hence: generate `providerReference` once via `adapter.buildReference(order)`, persist it on `VtuOrder` **before** submitting, and reuse that exact value for every subsequent `getOrderStatus()` call. On failover to a different provider, generate a new reference in the new provider's format and record the previous one in `metadata` — never reuse a reference across providers.

**ClubKonnect credential handling.** `UserID` and `APIKey` travel as **query-string parameters**, not headers. A leaked URL is a leaked API key. Therefore:

- Server-side only. The adapter must never be reachable from the browser.
- Server IP whitelisting enabled at ClubKonnect from day one, before the first live transaction.
- URL scrubbing is mandatory before anything reaches a log line, error tracker, APM trace, or `ProviderRoutingAttempt.reason`. Redact `APIKey` and `UserID` at the HTTP-client layer so no call site can leak them by omission.
- 2FA enabled on the ClubKonnect account itself.

**No ClubKonnect sandbox.** Every integration test spends real naira. Build and test the adapter contract against the VTpass sandbox first, then validate ClubKonnect with a small funded account using minimum denominations. Budget for a handful of real ₦100 transactions during development, and never point automated CI at ClubKonnect.

### 5.8 Blocking pre-integration tests

These must be resolved with funded accounts **before** adapters are written, because each one determines what gets built:

| # | Question | How to resolve | What it decides |
|---|---|---|---|
| 1 | Is ClubKonnect's **API-tier** airtime discount 5% or 7–8%? | One funded account, single ₦100 MTN top-up, compare wallet debit to face value | Whether per-network airtime routing (and the MobileNig adapter) is built at all |
| 2 | Is ClubKonnect's data really **₦210/GB flat across all four networks**? | Pull the live data endpoint per network with a funded account | Whether ClubKonnect or CheapDataHub is data primary |
| 3 | Do CheapDataHub's ₦228 and Pairgate's ₦225 hold at API tier? | Funded account, live plan list | Data primary/failover ordering |
| 4 | Does SMSPool have UK/US/CA rental inventory at the quoted prices? | Funded account, `searchNumbers()` per country | Whether the UK-360d hero SKU is real |
| 5 | Does SMSPVA have German rental inventory? | Funded account, rental `getdata` | Whether Germany ships enabled |

On #1 and #2 specifically: the figures currently circulating come from ClubKonnect's **consumer-facing buy page**, which is a different rate card from the API reseller tier. And ₦210 uniform across MTN, Glo, Airtel and 9mobile contradicts how SME/CG channels are priced everywhere else — MobileNig's published card has MTN SME 1GB at ₦600 against 9mobile SME 1GB at ₦140. Treat the flat figure as a display convention until a funded API call proves otherwise.

### 5.9 Bills and cable TV — designed, not shipped

Electricity and cable TV are **out of scope for phase 1** but the adapter interface accommodates them (5.2) so the fulfilment pipeline does not need reshaping later.

Two properties make them genuinely different from airtime and data:

1. **Electricity requires validation before charge.** `validateMeter()` → display the registered customer name and address → user confirms → *then* debit. A token bought against a mistyped meter number credits a stranger's account and is not recoverable. Airtime and data have no equivalent step, so the purchase flow must branch.
2. **Failure is worse.** A failed data top-up is an annoyance; a failed electricity token means the customer's power stays off. The `AMBIGUOUS` resolution queue and a defined ops SLA become launch requirements for bills, not phase-4 hardening.

Margins are thin and near-uniform industry-wide (VTpass publishes 0.5% Eko to 1.7% Aba) because every aggregator sources from the same Disco backends. Provider selection here is therefore **on Disco coverage and token-generation uptime, not on rate** — VTpass covers all 12 major Discos (IKEDC, EKEDC, AEDC, KEDCO, PHED, JED, IBEDC, KAEDCO, EEDC, BEDC, ABA, YEDC) plus DSTV, GOTV, Startimes and Showmax, the widest coverage found. ClubKonnect also covers cable and electricity and would serve as failover.

### 5.10 Catalog sync

Daily `plan_catalog_sync` job per data provider: pull `listDataPlans()`, upsert `VtuDataPlan` on `(providerName, providerPlanId)`, mark absent plans `active: false`, stamp `lastSyncedAt`. Alert if a provider returns zero plans (SME channels break periodically when MTN tightens enforcement) so the router can demote rather than strand orders.

Consumer prices are always computed from synced cost + `PricingRule` at request time. No price literals anywhere in the frontend — replacing the hardcoded arrays currently in `apps/web/app/os/airtime/page.tsx`.

---

## 6. Worker queues

Two new queues in `apps/worker/src/queues.ts`, following the existing `queueRuntimePolicies` + feature-flag-gating pattern.

**`virtual-numbers`**

| Job | Purpose |
|---|---|
| `provision` | Walk router candidates, provision, reverse on exhaustion |
| `poll_messages` | Pull inbound SMS for providers without webhooks |
| `lifecycle_sweep` | ACTIVE → EXPIRING → EXPIRED transitions |
| `expiry_warning` | T-3d and T-1d notifications |
| `release` | Release expired numbers at provider |
| `reconcile` | Provider charges vs ledger |
| `retention_purge` | Delete messages past `retainUntil` |
| `provider_health` | Periodic `checkHealth()` + balance |

**`vtu-fulfilment`**

| Job | Purpose |
|---|---|
| `submit` | Submit top-up with our reference |
| `poll_status` | Resolve submitted/timed-out orders by reference |
| `reconcile` | Sweep `AMBIGUOUS` orders, surface to ops |
| `plan_catalog_sync` | Daily data plan refresh |
| `provider_health` | Health + wallet balance per provider |

Low balance at any provider raises an admin alert — a provider running dry is the most common cause of mass fulfilment failure.

---

## 7. API surface (`apps/api`)

Two new NestJS modules following the `digital-access` module structure.

**`/virtual-numbers`** (user)
```
GET  /countries                        enabled countries + from-price
GET  /products?country=US              SKUs with live computed price
POST /orders                           quote + charge + enqueue provision  [campaign:create]
GET  /numbers                          my numbers
GET  /numbers/:id                      detail
GET  /numbers/:id/messages             inbox (paginated)
POST /numbers/:id/renew                renewal, surfaces sameNumber
POST /numbers/:id/release              early release
GET  /compatibility?service=telegram   evidence, never a guarantee
```

**`/vtu`** (user)
```
GET  /networks
GET  /plans?network=MTN                synced catalog + computed price
POST /orders/airtime                   wallet-funded only
POST /orders/data                      wallet-funded only
GET  /orders                           history
GET  /orders/:id
```

**`/admin/digital-products`** (`admin:access`)
```
GET/POST/PATCH  /fx                    FX rate card with guardrails
GET/POST/PATCH  /pricing-rules
GET/POST/PATCH  /providers             config, enable/disable, routing preview
GET             /providers/health
GET             /numbers               active/expired/failed
POST            /numbers/:id/retry
POST            /numbers/:id/release
GET             /vtu/orders            incl. AMBIGUOUS queue
POST            /vtu/orders/:id/resolve
GET             /overview              metrics per brief §18
```

**`/webhooks/numbers/:provider`** — `@Public()`, signature-verified, idempotent.

---

## 8. Frontend (`/os` only)

New nav group in `apps/web/app/os/shell.tsx`, inserted between Growth and Finance. **"Airtime & Data" moves out of Finance** into it:

```ts
{
  title: "Digital Products",
  items: [
    { label: "International Numbers", href: "/os/numbers",  icon: Globe },
    { label: "My Numbers",            href: "/os/numbers/mine", icon: Smartphone },
    { label: "Airtime",               href: "/os/airtime",  icon: Phone },
    { label: "Data",                  href: "/os/data",     icon: Wifi },
  ],
}
```

Finance retains Wallet and Vouchers.

**Routes:**

```
/os/numbers                    country grid — flag, name, "From ₦X", [View Numbers]
/os/numbers/[country]          SKU list — number preview, SMS ✓, duration, price
/os/numbers/checkout           confirm → wallet → provisioning state
/os/numbers/mine               My Numbers — country, number, status, expiry, SMS count
/os/numbers/mine/[id]          SMS inbox — lightweight message list
/os/numbers/mine/[id]/manage   renew / release / compatibility
/os/airtime                    replaces the current mock; network → amount → confirm
/os/data                       network → plan → confirm
```

**Design direction (brief §21):** clean, premium, utility-simple. Flags, country names, duration, price, status, message count, expiry. No telecom terminology — no DID, SIP, VoIP, carrier routing, provisioning jargon in user-facing copy. The inbox is a lightweight message list, not a messaging app.

**Mobile (brief §22):** Digital Products → International Numbers → Country → Number → Purchase → My Number → Inbox. Inbox reachable in ≤3 taps from the mobile nav; consider adding My Numbers to `MOBILE_NAV` once shipped.

Existing `packages/ui/src/components.tsx` already provides `SelectCard`, `TabBar`, `KpiCard`, `StatusDot`, `Table`, `AlertBanner`, `ProvisionStep`, `Drawer` — `ProvisionStep` in particular fits the provisioning progress state.

---

## 9. Admin (`apps/admin`)

New `apps/admin/app/digital-products/` section, mirroring the existing `digital-access` structure (`page.tsx`, `api.ts`, `data.ts`, `components.tsx`, `use-*-data.ts`).

| Page | Contents |
|---|---|
| `/fx` | Active rate, who set it, when. "Propose new rate" form showing recomputed price of **every SKU side by side** before commit. Guardrail violations block the save with the offending SKUs named. |
| `/pricing` | Pricing rules by scope; per-(provider, network, productType) `discountBps` so negotiated tiers update without a deploy |
| `/providers` | Health, balance, latency, success rate. Enable/disable per country/network. Routing preview: "US + SMS + 30d → which provider wins and why" |
| `/numbers` | Active / expiring / expired / failed. Retry provisioning, force release, inspect messages (redacted), reconcile provider charges |
| `/vtu` | Orders, **AMBIGUOUS resolution queue**, catalog sync status, per-provider success rate |
| `/overview` | Brief §18 metrics: active numbers by country, SMS received, provider cost, revenue, gross margin |

---

## 10. Abuse, privacy, compliance

**Purchase controls (brief §23):** account-level purchase limits, rate limiting per workspace/IP/device, risk scoring on `VirtualNumberOrder.riskScore` (reusing the fields already modelled), attestation checkbox, audit trail on every purchase and release, admin audit logging.

**Financial-services hard block.** Long-rental numbers pointed at banks and financial institutions are the highest-abuse and highest-chargeback surface. `NumberCompatibility.blocked = true` for financial-service keys, enforced at purchase and displayed honestly, rather than discovering the problem in disputes.

**SMS body privacy.** Message bodies are the most sensitive data the platform will hold. Encrypted at rest (`bodyEncrypted`) with a separately stored redacted preview (`bodyRedacted`) — the pattern the existing `OtpMessage` already used. Admin surfaces show the redacted form only. `retainUntil` makes retention enforceable by a job rather than by policy prose.

**MSISDN privacy.** VTU recipient numbers encrypted at rest, masked in all list views.

**Positioning.** No marketing copy anywhere describes the product as OTP bypass, verification bypass, or guaranteed-compatible. Compatibility is presented as tested evidence with sample size and last-tested date.

---

## 11. Build order

**Phase 0 — Foundation**
Drop `Otp*` models; create `ProviderConfig`, `ProviderHealth`, `ProviderRoutingAttempt`, `FxRate`, `PricingRule`. Router core in `packages/providers/src/router.ts`. Admin FX card with all four guardrails. Feature flags: `virtualNumbers`, `virtualNumbersAdmin`, `vtu`, `vtuAdmin`.

**Phase 1 — VTU vertical**
`VtuProviderRoute` migration + router that reads it. Adapters: VTpass (sandbox first, for CI), ClubKonnect, MobileNig, CheapDataHub, eBills, SMEDATA. `VtuDataPlan` + catalog sync. `VtuOrder` + wallet charge + reversal. `vtu-fulfilment` queue including the AMBIGUOUS path. Replace the mock `/os/airtime`; add `/os/data`. Admin VTU pages including routing-table editor with audit log. Seed routing rows from blocking test results (5.8).

*Ships first because it validates the shared spine — wallet debit, routing, reversal, reconciliation — against a product with high transaction volume and low per-transaction risk.*

**Phase 2 — Virtual Numbers vertical**
Adapters: SMSPool, 5SIM (adapt existing), SMSPVA. `NumberCountry` + `VirtualNumberProduct` catalog. Order → charge → provision → reverse. `virtual-numbers` queue. Webhook + polling ingestion. `/os/numbers/*`. Admin numbers pages. All three providers live together.

**Phase 3 — Lifecycle & renewal**
Expiry warnings, expire/release sweep, renewal with `sameNumber` disclosure, `NumberCompatibility` seeded from internal testing, retention purge.

**Phase 4 — Hardening**
Abuse controls, purchase limits, reconciliation reports, margin analytics, provider failover drills, ops runbook.

**Phase 5 — Bills & cable (deferred)**
Implement the optional adapter methods from 5.2. Electricity requires the validate-before-charge branch in the purchase flow and a defined ops SLA on the `AMBIGUOUS` queue before launch. VTpass primary on coverage, ClubKonnect failover. See 5.9.

**Gate:** the blocking tests in 5.8 must be resolved before Phase 1 adapter work begins. They are cheap — a few funded accounts and a handful of minimum-denomination transactions — and each one changes what gets built.

---

## 12. Open items

1. **Provider accounts.** Funded accounts needed for SMSPool, 5SIM, SMSPVA, ClubKonnect, MobileNig, CheapDataHub. **VTpass sandbox is free** (`sandbox.vtpass.com/register`) and unblocks Phase 0/1 development immediately with no funding.
2. **Blocking tests in 5.8** gate Phase 1. Resolve before writing adapters.
3. **Australia.** No confirmed long-term rental inventory across the three chosen number providers. Ships disabled.
4. **Germany.** Depends on SMSPVA inventory confirmation at integration.
5. **Every price in this document is provisional.** Airtime discount percentages are the most reliable (published rate cards). Data prices are least reliable — several vendor sites blocked automated fetching, "cheapest" pages are marketing surfaces, and SME supply is volatile. Number rental prices come partly from secondary sources. Where a figure came from a consumer-facing page rather than an API-tier rate card it is flagged as such in 5.8. **Open funded test accounts and pull real prices from each provider's API before committing to any consumer price.**
6. **VTU volume tiers** are negotiated per account. The public rates here are floors, not ceilings.
7. **Bills/cable scope.** Designed into the interface (5.2, 5.9), deferred to Phase 5. Confirm whether this stays deferred or moves forward once VTU volume is known.
