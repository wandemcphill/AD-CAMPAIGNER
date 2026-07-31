# Remaining Setup Tasks

**Status**: Reward Engine + TikTok webhook are code-complete. FX provider architecture is code-complete with mock provider. Below are operational/integration tasks.

---

## 1. TikTok Webhook Setup (Reward Engine)

**Status**: Code complete. Webhook handler at `POST /v1/rewards/webhooks/tiktok` is HMAC-verified and wired.

**Action**: Set up in Render + TikTok Console

### 1a. Render Environment Variables

In Render dashboard → Environment:

```
TIKTOK_WEBHOOK_SECRET=<your-webhook-secret>
```

**How to get the secret**:
- Go to TikTok Developer Console
- Your app → Event subscriptions
- Copy the "Event Signature Secret" (shown once during creation)
- Paste into Render

### 1b. Register Webhook in TikTok Developer Console

1. Log in → Your app → Settings → Event subscriptions
2. Click "Create subscription" or "Add event"
3. Webhook URL: `https://ft-campaigner-api-fra.onrender.com/v1/rewards/webhooks/tiktok`
4. Event: `video.publish.completed`
5. Signature method: `HMAC_SHA256`
6. Save & verify

**Verify**: TikTok will send a verification request. Our handler responds with `200 OK` if HMAC is valid.

### 1c. Test

Publish a video from a creator linked to a FlipTrybe reward campaign:
- Video published
- TikTok sends webhook to our URL
- Our handler matches `videoId` in webhook to `TIKTOK_VIDEO_PUBLISH` pending tasks
- Auto-verifies the task (sets `verified=true`, `verifiedAt=now()`)
- Task progresses to QUALIFY state

**Logs to check** (Render):
```
[FxService] Webhook received: video.publish.completed
[RewardService] Matched task: <task_id> for video <video_id>
[RewardService] Task auto-verified: TIKTOK_VIDEO_PUBLISH
```

---

## 2. FX Provider Integration (Choose & Implement)

**Status**: Architecture complete. Mock provider works. Real provider pending.

**Action**: Pick a provider and implement.

### 2a. Provider Decision

See `docs/FX_PROVIDER_ARCHITECTURE.md` § "Provider Selection Decision Tree"

**Recommended**: **Wise API** for MVP
- ✅ Settles money (diaspora payouts are the goal)
- ✅ Rates locked per quote (what our system expects)
- ✅ NGN + USD/GBP/EUR pairs
- ✅ Nigerian company support
- ⏱️ Effort: 3-4 days

**Alternative**: **Fixer.io + manual settlement**
- ✅ Rates only, cheap
- ❌ Doesn't settle; requires separate payout processor
- ⏱️ Effort: 2 days for Fixer + 5 days for settlement processor

### 2b. Implement Real Provider

Once chosen, create `packages/providers/src/wise-fx-provider.ts` (example):

```typescript
import type { FxProvider, FxRate } from './index.js';

export class WiseExchangeRateProvider implements FxProvider {
  name = "wise-fx";
  
  constructor(private readonly apiKey: string) {}
  
  async getRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate> {
    const response = await fetch(
      `https://api.wise.com/v1/rates?source=${baseCurrency}&target=${quoteCurrency}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );
    const data = await response.json();
    // Map Wise response to FxRate interface
    return {
      baseCurrency,
      quoteCurrency,
      rateMicros: BigInt(Math.round(data.rate * 1_000_000)),
      timestamp: new Date(),
      provider: "wise-fx"
    };
  }
  
  // ... implement other methods
}
```

### 2c. Wire Into FxService

In `apps/api/src/modules/fx/fx.service.ts`:

```typescript
export class FxService implements OnModuleInit {
  private fxProvider: FxProvider;

  constructor(private readonly prismaService: PrismaService) {
    // Swap this line to use Wise:
    this.fxProvider = new WiseExchangeRateProvider(process.env.WISE_API_KEY!);
    // this.fxProvider = createMockFxProvider(); // Keep mock as fallback
  }
  
  // Rest of service unchanged
}
```

### 2d. Env Vars

```
WISE_API_KEY=<your-wise-api-token>
```

### 2e. Test

1. Restart API
2. Check logs for successful rate cache refresh every 5 min
3. GET `/admin/digital-products/fx/health` → should show Wise rates, not mock rates
4. Create a quote: POST `/v1/fx/quotes` → should use Wise rates

---

## 3. Settlement Instructions (After Provider)

**Status**: Not yet started. Dependent on real provider choice.

**Action**: Implement settlement flow.

### 3a. Design Settlement Models

```typescript
// Pseudo-schema

model SettlementInstruction {
  id: string;
  quoteId: string; // FK to FxQuote (locked rate)
  customerId: string;
  partnerId: string; // Recipient of funds
  
  // Amount side
  sourceAmountMinor: bigint;
  sourceCurrency: string; // Usually "NGN"
  sourceFormat: "KOBO" | "NAIRA"; // How customer paid
  
  // Result side
  targetAmountMinor: bigint;
  targetCurrency: string; // Where sending (USD/GBP/EUR)
  targetFormat: "MINOR_UNITS"; // How provider expects it
  
  // FX details (locked at quote time)
  fxRateMicros: bigint;
  spreadBps: number;
  feesMinor: bigint;
  netMinor: bigint; // What partner actually gets
  
  // Payout details
  bankName?: string;
  accountNumber?: string;
  accountCurrency?: string;
  swiftCode?: string;
  
  // Execution
  status: "PENDING" | "IN_PROGRESS" | "SETTLED" | "FAILED";
  providerReference?: string; // Wise transfer ID, etc.
  executedAt?: Date;
  errorReason?: string;
  
  // Audit
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}
```

### 3b. Create Settlement Job

```typescript
// apps/worker/src/settlement-processor.ts

@Injectable()
export class SettlementProcessorJob {
  async processSettlements() {
    // 1. Find new FxQuotes with status=USED
    const quotes = await this.db.fxQuote.findMany({
      where: { status: "USED", usedAt: { lte: new Date(Date.now() - 5000) } }
    });
    
    for (const quote of quotes) {
      // 2. Fetch customer bank details
      const customer = await this.db.user.findUnique({...});
      
      // 3. Create SettlementInstruction
      const instruction = await this.db.settlementInstruction.create({...});
      
      // 4. Call Wise API (or provider)
      const transfer = await this.wiseService.createTransfer({
        amount: quote.resultAmountMinor,
        currency: quote.quoteCurrency,
        bankDetails: customer.bankDetails,
        idempotencyKey: instruction.id
      });
      
      // 5. Record provider reference
      await this.db.settlementInstruction.update({
        where: { id: instruction.id },
        data: { providerReference: transfer.id, status: "IN_PROGRESS" }
      });
    }
  }
}
```

### 3c. Webhook Reconciliation

Wise (and other providers) send webhooks when transfer completes:

```typescript
// apps/api/src/modules/webhooks/wise-settlement-webhook.ts

@Post("/wise/settlement")
async handleWiseSettlementWebhook(@Body() body: any) {
  const transfer = body; // Wise transfer event
  
  const instruction = await this.db.settlementInstruction.findUnique({
    where: { providerReference: transfer.id }
  });
  
  if (transfer.status === "COMPLETED") {
    await this.db.settlementInstruction.update({
      where: { id: instruction.id },
      data: { status: "SETTLED", executedAt: new Date() }
    });
  } else if (transfer.status === "FAILED") {
    await this.db.settlementInstruction.update({
      where: { id: instruction.id },
      data: { status: "FAILED", errorReason: transfer.error }
    });
  }
}
```

### 3d. Integration Test

1. Create FxQuote (locks rate)
2. Mark quote as USED
3. Settlement job runs
4. Wise API called
5. SettlementInstruction created with PENDING status
6. Wise webhook arrives (simulated or real)
7. Status updated to SETTLED
8. Partner receives funds

---

## 4. Feature Flag Status

Current flags (all now enabled):

```typescript
// packages/feature-flags/src/index.ts
export const featureFlags = {
  rewards: true,           // Reward engine live
  rewardsAdmin: true,      // Admin reward management
  digitalAccess: true,     // VTU module live
  digitalAccessAdmin: true, // Admin VTU management
  liveProviderIntegrations: false, // Ads still mocked
  // ... others
};
```

**Note**: Reward engine requires `rewards: true` + `rewardsAdmin: true` to be enabled (already are).

---

## 5. Deployment Checklist

Before shipping to production:

- [ ] Render env vars set (TIKTOK_WEBHOOK_SECRET, WISE_API_KEY if using Wise)
- [ ] TikTok webhook URL registered in developer console
- [ ] Test TikTok webhook verification (TikTok sends a test event)
- [ ] Real FX provider integrated + tested (not mock)
- [ ] Settlement flow tested end-to-end (quote → settled)
- [ ] Alerts configured (provider down, rate spike, settlement failure)
- [ ] Rate sanity checks validated (bad rates are rejected)
- [ ] Quote locking validated (rate doesn't change mid-transaction)
- [ ] Admin dashboard tested (health, history, refresh endpoints)
- [ ] Fallback behavior tested (provider down → manual rate)

---

## 6. Uncommitted Changes (Not Our Work)

The git status shows other devs have uncommitted work:

```
 M apps/web/app/os/marketplace/agencies/page.tsx
 M apps/web/app/os/marketplace/creators/page.tsx
 M apps/web/app/os/marketplace/page.tsx
 M apps/web/app/os/marketplace/applications/
 M apps/admin/app/marketplace/
 ? apps/web/app/os/marketplace/agencies/apply/
 ? apps/web/app/os/marketplace/creators/apply/
 ? apps/web/app/os/marketplace/applications/
```

These are **not our work**. They are:
- Marketplace applications flow (parallel developer)
- Virtual numbers processor updates (parallel developer)
- Webhook service changes (parallel developer)
- Security / settings pages (parallel developer)

**Action**: Leave these untouched. Other devs will merge when ready.

---

## 7. Commit Summary

**This session** (2026-07-31):

1. ✅ **237a67d** — FX provider architecture (rates, quotes, scheduled refresh)
   - FxProvider interface + mock implementation
   - Rate cache with validation + TTL
   - Quote locking with expiry
   - Scheduled 5-min refresh job
   - Admin endpoints (set rate, health, refresh)
   - Customer quote endpoint

**Previous** (from session notes):

2. ✅ **b54cd9f** — Reward Engine + TikTok webhook
   - Task→Verify→Qualify→Reward→Fulfill pipeline
   - TikTok `video.publish.completed` webhook
   - Automatic task verification on video publish
   - All typechecks passing

---

## 8. Open Questions

**Q: Can we ship reward engine without the TikTok webhook working?**  
A: Yes. The webhook auto-verifies tasks, but admins can manually verify via dashboard. Less frictionless, but functional.

**Q: Do we need settlement before launch?**  
A: No. Settlement is Phase 2. Phase 1 is rate management (done) + quote locking (done). Settlement is how payouts actually move money.

**Q: What if Wise pricing is too high?**  
A: Implement fallback to CBN rates + different settlement processor (Stripe, manual bank transfer). Architecture supports provider swaps.

**Q: How do we handle NGN→USD→GBP cross-pairs?**  
A: Calculated via USD as hub: NGN→USD rate + USD→GBP rate. Handled in quote logic (not yet implemented, but planned).

---

## Summary

| Task | Status | Effort | Blocker |
|------|--------|--------|---------|
| TikTok webhook (code) | ✅ Done | — | Set TIKTOK_WEBHOOK_SECRET + register URL |
| FX rate cache (code) | ✅ Done | — | Pick real provider |
| FX rate caching (real provider) | ⏳ Waiting | 3-4 days | Provider decision (Wise recommended) |
| Settlement instructions (design) | ⏳ Waiting | 5-7 days | Provider API integration |
| Settlement processor (code) | ⏳ Waiting | 5-7 days | Settlement design + provider |
| Feature flags | ✅ Enabled | — | Already enabled |
| Alerts & monitoring | ⏳ Future | 2-3 days | Not MVP-blocking |

**Critical path to MVP payout**: Real provider → settlement flow → test end-to-end. ~10 days.
