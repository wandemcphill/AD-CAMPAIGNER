# FX Provider Architecture

**Status**: Commit `237a67d` — Foundation implemented, provider pending, settlement pending

## Overview

FlipTrybe's FX system manages multi-currency rate updates and quote locking for diaspora payouts (NGN ↔ USD/GBP/EUR). This document describes the architecture, what's been implemented, what's mocked, and what's waiting.

---

## Architecture Principles

1. **Provider Abstraction** — `FxProvider` interface allows swapping providers without code changes
2. **Rate Cache** — Scheduled fetches prevent live API hammering; cache feeds customer quotes
3. **Manual Fallback** — Admin-set rates are always available as a backstop (existing system intact)
4. **Rate Locking** — Quotes lock a rate for a customer transaction; rates don't change mid-quote
5. **Audit Trail** — Every rate change (manual, provider, fallback) is recorded
6. **Graduated Degradation** — If provider fails, use cached rate; if cache stale, use manual; bootstrap fallback never fails

---

## Data Models

### FxRate (existing, unchanged)

Manual rates set by admin. Fields:
- `baseCurrency`, `quoteCurrency` (usually "USD" → "NGN")
- `rateMicros` — rate as integer (e.g., 1450 × 10^6 = 1.45M)
- `bufferBps` — admin spread (basis points)
- `source` — "MANUAL" | "CBN" | "PROVIDER_FEED"
- `effectiveFrom`, `effectiveTo` — time windowing (soft delete)
- `setByUserId` — audit trail
- Indexes on (baseCurrency, quoteCurrency, effectiveFrom)

### FxRateCache (new)

Latest successful provider rates. Fields:
- `baseCurrency`, `quoteCurrency`, `providerName` (unique trio)
- `providerRateMicros` — raw rate from provider
- `providerTimestamp` — when provider sourced it
- `validationStatus` — "VALID" | others (failure tracking)
- `age_seconds` — staleness (computed, updated on refresh)
- `lastUpdatedAt` — when we cached it
- `lastSuccessAt` — last successful fetch (for fallback ordering)
- Indexes on (baseCurrency, quoteCurrency, lastSuccessAt)

**Lifecycle**: 
- Scheduled job fetches every 5 min → validates → upserts cache
- On stale/invalid, retains previous valid row (doesn't delete)
- Admin can force refresh via POST `/admin/digital-products/fx/refresh`

### FxQuote (new)

Locked rates for a customer transaction. Fields:
- `baseCurrency`, `quoteCurrency`
- `sourceAmountMinor` — customer's input amount (in minor units: cents/kobo)
- `providerRateMicros` — live rate used for quote
- `spreadBps` — fixed spread applied (default 150bp = 1.5%)
- `bufferBps` — fixed buffer applied (default 100bp = 1%)
- `customerRateMicros` — provider rate + spread + buffer (what customer sees)
- `resultAmountMinor` — calculated output amount
- `status` — "ACTIVE" | "EXPIRED" | "USED" | "CANCELLED"
- `expiresAt` — quote validity window (default 60 sec)
- `usedAt` — when quote consumed for settlement
- `transactionId` — link to payment/settlement record
- Indexes on (baseCurrency, quoteCurrency, expiresAt, status) and (transactionId)

**Lifecycle**:
1. Customer requests quote → `createQuote()` → new FxQuote record, status=ACTIVE
2. Capture rate at quote time → locked until expiry
3. Customer confirms → `useQuote(quoteId, transactionId)` → status=USED, usedAt=now
4. Settlement processor reads FxQuote to get locked rate (never changes mid-transaction)

---

## API Endpoints

### Admin Rate Management

```
POST /admin/digital-products/fx
{
  "rate": 1550.50,          // Decimal NGN per USD
  "bufferBps": 100,         // Optional spread buffer
  "note": "Market adjustment",
  "confirmLargeChange": true // If rate changes >10%
}
→ FxRate
```

```
GET /admin/digital-products/fx
→ FxRate (current active rate)
```

```
GET /admin/digital-products/fx/history
→ FxRate[] (last 20 rates)
```

### Provider Cache Management

```
POST /admin/digital-products/fx/refresh
{
  "baseCurrency": "USD",              // Optional, default "USD"
  "quoteCurrencies": ["NGN", "GBP"],  // Optional, default all
  "forceRefresh": true                // Bypass sanity checks
}
→ null (fires async)
```

```
GET /admin/digital-products/fx/health
→ FxHealthDto
{
  "provider": "mock-fx" | "wise" | ...,
  "healthy": true | false,
  "cacheStatus": {
    "pairs": [
      {
        "baseCurrency": "USD",
        "quoteCurrency": "NGN",
        "providerName": "mock-fx",
        "providerRateMicros": 1550000000n,
        "customerRateMicros": 1569975000n,  // With spread+buffer
        "ageSeconds": 45,
        "validationStatus": "VALID",
        "isFresh": true
      }
      // ... other pairs
    ],
    "lastRefreshAt": Date
  },
  "fallbackStatus": {
    "usingFallback": false,
    "manualRateAge": 1440  // minutes since admin set it
  }
}
```

### Customer Quoting

```
POST /v1/fx/quotes
{
  "baseCurrency": "USD",
  "quoteCurrency": "NGN",
  "sourceAmountMinor": 10000,          // $100
  "quoteExpirySeconds": 60             // Optional, default 60
}
→ FxQuoteResponseDto
{
  "quoteId": "fxq_abc123",
  "baseCurrency": "USD",
  "quoteCurrency": "NGN",
  "sourceAmountMinor": 10000,
  "providerRateMicros": 1550000000n,
  "customerRateMicros": 1569975000n,   // After spread+buffer
  "spreadBps": 150,
  "resultAmountMinor": 1569975,        // ₦15,699.75
  "expiresAt": Date,
  "status": "ACTIVE"
}
```

Internal use (not exposed):
```
POST /v1/fx/quotes/:quoteId/use
{ "transactionId": "txn_xyz" }
→ void (marks quote USED, locks it)
```

---

## Rate Resolution Logic

When a component (e.g., VTU service) needs a rate:

```typescript
const rate = await fxService.getActiveRate("USD", "NGN");
// Returns: { rateMicros, fxRateId, isBootstrap, usingFallback }
```

Resolution order:
1. Check cache (`FxRateCache`) — if <5 min old and VALID, return it
2. Check manual rate (`FxRate` with effectiveTo=null)
   - If <72 hours old, return it (with bufferBps applied)
   - If >72 hours old, throw error (admin action required)
3. Bootstrap fallback (`BOOTSTRAP_RATE_MICROS = 1450000000n`) — never fails, but flags `isBootstrap: true`

Each step records whether the source was live provider, manual, or bootstrap.

---

## Rate Validation

Every provider rate undergoes validation before caching:

1. **Null checks** — baseCurrency, quoteCurrency must exist
2. **Positivity** — rateMicros > 0
3. **Staleness** — provider timestamp < 1 hour old
4. **Sanity** — rate change < 50% from previous cache (prevents provider API errors)

On validation failure:
- Log warning
- Do NOT upsert cache
- Keep previous valid row (fallback remains available)
- Alert admin (future: Slack/email integration)

---

## Scheduled Refresh Job

```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async scheduleRefreshRateCache()
```

Runs every 5 minutes:
1. Fetch rates from `FxProvider` for all supported pairs
2. Validate each rate
3. Upsert into `FxRateCache`
4. Log success/failure per pair

Guard: `cacheRefreshInProgress` flag prevents overlapping runs.

---

## Supported Currency Pairs (Initial)

```
USD → NGN (base → quote)
USD → GBP
USD → EUR
GBP → NGN (cross-pair, calculated)
EUR → NGN
```

Prices stored with 6 decimal places (micros); internal calcs use integer arithmetic (no float drift).

---

## Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| `FX_NGN_MIN` | 500 | Minimum allowed manual rate |
| `FX_NGN_MAX` | 5000 | Maximum allowed manual rate |
| `FX_MAX_AGE_HOURS` | 72 | Fail if manual rate older than this |
| (Scheduled job) | 5 min | Rate cache refresh frequency |
| (Quote expiry) | 60 sec | Quote validity window |
| (Spread) | 150 bp | Default customer spread (1.5%) |
| (Buffer) | 100 bp | Default customer buffer (1%) |

---

## Status: What's Implemented / Mocked / Pending

### ✅ IMPLEMENTED

- [x] `FxProvider` interface + `createMockFxProvider()`
- [x] `FxRateCache` model + queries
- [x] `FxQuote` model + quote lifecycle (create, use, expire)
- [x] Rate validation (null, positive, staleness, sanity)
- [x] Scheduled cache refresh job (@Cron)
- [x] Rate resolution with fallback chain
- [x] Admin endpoints (set rate, view history, view health)
- [x] Customer quote endpoint (create locked quote)
- [x] Audit trail (FxRate.setByUserId + auditLog records)
- [x] Health dashboard (provider status + cache age + fallback reason)
- [x] Error handling (stale rates, failed provider, validation errors)

### 🔄 MOCKED (Working, Not Real)

- **Mock FX Provider** — Hardcoded rates for USD/NGN/GBP/EUR (included in `createMockFxProvider()`)
  - Rates: ₦1,550/USD, £0.79/USD, €0.92/USD, etc.
  - No API calls; instant responses
  - Use for dev/staging when no real provider is wired
  - Can be swapped later by changing `FxService.fxProvider` initialization

### ⏳ WAITING FOR

1. **Real FX Provider Selection**
   - Requirements: NGN+USD/GBP/EUR pairs, real-time or periodic rates, Nigerian company legal support, settlement capability
   - Candidates: Wise API, Fixer.io + settlement processor, CBN rates + Stripe Connect, etc.
   - Decision: See "Provider Selection" section below
   - Effort: 3-5 days to integrate once chosen

2. **Settlement Instruction Generation**
   - Accept `FxQuote` + customer bank details
   - Calculate final settlement amount (quote result + fees)
   - Create payout instruction
   - Partner with Wise / Stripe / CBN as settlement processor
   - Models needed: `Settlement`, `SettlementLine`, `SettlementPayout`
   - Effort: 5-7 days (depends on processor API)

3. **Rate Spread Tiering**
   - Higher-volume partners get lower spreads
   - Need `PartnerFxSpreadTier` model
   - Future: Dynamic pricing based on volume/risk

4. **Multi-Currency Holding**
   - Partners accumulate NGN, USD, GBP, EUR separately
   - Settle on different cadences per currency
   - Need `WalletBalance` per currency per partner
   - Not yet designed

---

## Provider Selection Decision Tree

### Tier 1: Real-Time Market Rates

**Fixer.io** (if you need live rates)
- ✅ NGN + all major pairs
- ✅ 1-2 minute freshness
- ✅ Generous free tier (100 calls/month)
- ❌ Does NOT settle money (rates-only)
- → Use for rate feed into manual settlement or Stripe

**Wise (TransferWise) API**
- ✅ NGN + USD/GBP/EUR pairs  
- ✅ Settlement via Wise payouts (real diaspora use case)
- ✅ Rates locked in quote (quote API)
- ❌ Requires Wise Business account (onboarding)
- ✅ **Recommended for MVP** — rate + settlement in one provider
- Effort: 3-4 days (well-documented API)

### Tier 2: Central Bank + Settlement Processor

**CBN rates + Stripe Connect**
- ✅ Nigerian official rates (regulatory compliance)
- ✅ Stripe can settle to NGN accounts
- ❌ CBN rates update once daily (less competitive)
- ✅ Stripe is mature but higher fees (~2%)
- → Good for regulatory but not competitive pricing

**CBN rates + Wise settlement**
- ✅ Best of both (official rates + cheap settlement)
- ❌ Requires plumbing two services
- → Possible but more complex

### Tier 3: Fallback / Manual

- Keep existing manual rate system
- Admin sets rates + spread
- No auto-updates; no real-time competition
- Works but not sustainable (requires operational diligence)

---

## Recommended Next Steps

### Phase 1 (Week 1: Provider Integration)

**Choose provider**: Recommend **Wise API** for MVP
- Real settlement capability (diaspora payouts)
- Rates locked per quote (what we need)
- Easier integration than 2-service setup
- Nigerian support (important for compliance)

**Implement provider**:
1. Fetch Wise API client library
2. Create `WiseExchangeRateProvider` class (implements `FxProvider`)
3. Call `wise.getRate()` → map to our `FxRate` interface
4. Test rate caching (should work unchanged)
5. Swap `FxService.fxProvider = new WiseExchangeRateProvider(config)`

**Test**:
- Verify cached rates are updated every 5 min
- Verify quote locking works
- Verify fallback to manual rate when Wise is down

### Phase 2 (Week 2: Settlement Instructions)

**Design settlement flow**:
1. Customer accepts quote (FxQuote.ACTIVE → USED)
2. Settlement job watches for USED quotes
3. Fetch payout details from customer record
4. Call provider settlement API (e.g., Wise.createTransfer)
5. Record settlement instruction + status
6. Webhook confirmation → mark as settled

**Models**:
```
SettlementInstruction {
  id, quoteId, customerId, paymentMethod,
  sourceAmount, sourceMinor, sourceCurrency,
  targetAmount, targetMinor, targetCurrency,
  fxRate (locked from quote), fees, net,
  status (PENDING, IN_PROGRESS, SETTLED, FAILED),
  providerReference, providerStatus,
  createdAt, settledAt
}

SettlementPayout {
  id, instructionId,
  bankName, accountNumber, accountName,
  routingCode, swiftCode,
  status, error, metadata
}
```

**Wire BullMQ job**:
- `SettlementJob` — watches FxQuote.status=USED
- Calls provider settlement API
- Handles retries, reconciliation, webhooks

**Effort**: 5-7 days (depends on settlement API complexity)

### Phase 3 (Future: Optimizations)

- [x] Rate spread tiering (partners with higher volume pay less)
- [x] Multi-currency holding (separate wallets per currency)
- [x] Batch settlements (group transfers, negotiate bulk rates)
- [x] Forex hedging (lock rate for future payouts)

---

## Monitoring & Alerts

**Admin Dashboard** (GET `/admin/digital-products/fx/health`):
- ✅ Provider health (healthy? last update time?)
- ✅ Cache age per pair (is it fresh?)
- ✅ Fallback status (are we using manual rates?)
- ✅ Manual rate age (do we need admin action?)

**Future Alerts** (not yet wired):
- [ ] Provider down > 30 min → Slack to ops
- [ ] Rate spike > 5% → Email to CFO
- [ ] No successful cache refresh > 6 hours → Page on-call
- [ ] Settlement failed → Email to finance team

---

## Testing Checklist

- [ ] Rate cache updates every 5 min (check logs)
- [ ] Quote locks a rate (same rate in quote + settlement)
- [ ] Fallback works when cache is stale
- [ ] Manual rate overrides cached rate (if needed)
- [ ] Validation rejects bad rates (negative, too stale, 50% jump)
- [ ] Quote expiry works (quote rejected after expiration)
- [ ] Health endpoint reflects true state
- [ ] Audit trail records all manual rate changes

---

## Files Changed

| File | Changes |
|------|---------|
| `packages/database/prisma/schema.prisma` | +2 models (FxRateCache, FxQuote), +1 enum (FxQuoteStatus) |
| `packages/providers/src/index.ts` | +FxProvider interface, +createMockFxProvider() |
| `apps/api/src/modules/fx/fx.service.ts` | Complete rewrite: cache mgmt, quote locking, scheduled job |
| `apps/api/src/modules/fx/fx.controller.ts` | +2 new endpoints (refresh, health), +FxQuoteController |
| `apps/api/src/modules/fx/fx.dtos.ts` | +5 new DTOs (RefreshRates, FxQuote*, FxHealth*) |
| `apps/api/src/modules/fx/fx.module.ts` | +FxQuoteController, exports unchanged |
| `apps/api/src/modules/app.module.ts` | +ScheduleModule.forRoot() for @Cron |
| `package.json` | +@nestjs/schedule dependency |

---

## Commit

**237a67d** — "Implement FX provider abstraction with rate caching, quoting, and scheduled refresh"

---

## Questions?

- **"Can we use a different provider?"** — Yes, implement `FxProvider` interface and swap in `FxService` constructor
- **"What if provider is down?"** — Falls back to cached rate (5 min old), then manual rate, then bootstrap (logged as fallback)
- **"How are rates locked?"** — `FxQuote` record holds locked rate + customer calc; settlement uses quote rate, never recalculates
- **"Can admin override a rate?"** — Yes, `POST /admin/digital-products/fx` sets a manual rate (historical rates remain for audit)
- **"How do we prevent customer facing stale rates?"** — `getActiveRate()` throws if manual rate >72h old; cache is refreshed every 5 min
