# Virtual Numbers Operations Runbook

**Last Updated:** 2026-07-31  
**Version:** 1.0  
**On-Call:** See escalation matrix at end of document

## Table of Contents

1. [Overview](#overview)
2. [Operational Dashboards](#operational-dashboards)
3. [Common Procedures](#common-procedures)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Incident Response](#incident-response)
6. [Provider Management](#provider-management)
7. [Emergency Procedures](#emergency-procedures)
8. [Escalation Matrix](#escalation-matrix)

## Overview

The Virtual Numbers system allows FlipTrybe customers to purchase international SMS rental numbers from providers (SMSPool, 5SIM, SMSPVA). The system manages:

- **Purchase flow**: Customer purchases number → charge wallet → provision from provider
- **Lifecycle**: Active → Expiring (3d) → Expired → Released
- **Failover**: Automatic fallback to backup providers on outage
- **Margins**: 35% markup enforced via guardrails (10% minimum acceptable)
- **Limits**: Per-workspace monthly spending caps

### Key Contacts

- **SMSPool**: team@smspool.net | API: [docs.smspool.net](https://docs.smspool.net)
- **5SIM**: support@5sim.net | API: [5sim.net/docs](https://5sim.net/docs)
- **SMSPVA**: [smspva.com/en/support](https://smspva.com/en/support)

## Operational Dashboards

### Admin → Digital Products

Access via: `/admin/app/digital-products`

**Tabs:**

| Tab | Purpose | Key Metrics |
|-----|---------|-------------|
| Numbers | Active inventory | Status breakdown, expiry alerts |
| Orders | Purchase history | Fulfillment rate, failure reasons |
| Providers | Provider health | Latency, success rate, last check |
| **Margins** | Profitability | Avg margin, variance from target, provider-level breakdown |
| **Reconciliation** | Cost validation | Provider balance vs declared costs, discrepancies >5% flagged |
| **Purchase Limits** | Spending caps | Per-workspace monthly limits, utilization % |
| FX Rate | Exchange rate | Current rate, buffer %, change history |

### Accessing Data

```bash
# Margin analytics (last 30 days)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.fliptrybe.local/admin/digital-products/margin-analytics?days=30

# Reconciliation records (flagged for investigation)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.fliptrybe.local/admin/digital-products/reconciliation?status=INVESTIGATION

# Purchase limits across workspaces
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.fliptrybe.local/admin/digital-products/purchase-limits
```

## Common Procedures

### Setting FX Rate

**When:** Daily, when naira-USD rate changes > 0.5%  
**Who:** Finance  
**Impact:** All number purchases re-quoted; guardrail checks sell-below-cost

**Steps:**

1. Check current rate on CBN/FMDQ
2. Go to Admin → Digital Products → FX Rate
3. Enter new rate (₦/USD) in input field
4. Optional: Add note (e.g., "CBN 31 Jul, +2% buffer")
5. Click "Set rate"
6. If change >10%, confirm when prompted
7. _Guardrail check runs automatically_
8. Verify in History tab

**Troubleshooting:**

- **"Rate outside allowed band"** → Check FX_NGN_MIN/FX_NGN_MAX env vars
- **"Sell-below-cost guardrail triggered"** → One or more products would margin <10% at new rate. Review margin analytics to decide: (a) adjust rate, (b) override with confirmation

### Releasing an Expired Number

**When:** Number status = EXPIRED, but provider release task has stalled  
**Who:** Support or Finance  
**Impact:** Frees unused resource; may need to notify customer

**Steps:**

1. Admin → Digital Products → Numbers tab
2. Find number by E.164 or status filter
3. If status = EXPIRED: click "Force release"
4. System calls provider + marks status = RELEASED
5. If provider call fails, local state still updates (number will not display as active)
6. Verify status changed to RELEASED

### Renewing a Number

**Via Admin API (batch renewal):**

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.fliptrybe.local/virtual-numbers/numbers/{numberId}/renew \
  -d '{
    "durationDays": 30
  }'
```

**Response includes:**
- `sameNumber: true/false` (provider guarantee)
- New `expiresAt` timestamp
- Wallet charge recorded

### Setting Purchase Limit

**When:** New workspace onboarded, or spending cap needs adjustment  
**Who:** Finance  
**Impact:** Blocks purchases if cumulative monthly spending exceeds limit

**Steps:**

1. Admin → Digital Products → Purchase Limits
2. Enter amount in NGN (e.g., 500000 for ₦500k/month)
3. Click "Set Limit"
4. Appears in Active Limits table
5. Workspace cannot exceed limit; attempts return 403

**To remove limit:** Set to 0 (or contact ops to delete limit record)

### Investigating Margin Variance

**When:** Margin analytics shows orders >5% below target (3500 bps)  
**Who:** Finance or Risk  
**Impact:** May indicate FX rate is high, or provider cost increased

**Steps:**

1. Admin → Digital Products → Margins
2. Check provider breakdown and recent orders
3. For affected provider: click order → check FX rate applied
4. Compare provider cost (USD) vs current market
5. **If provider cost increased:** contact provider for explanation
6. **If FX rate is high:** review upcoming rate change
7. **If systematic:** may need to adjust markup % or review provider selection

### Responding to Reconciliation Discrepancy

**When:** Reconciliation shows status = INVESTIGATION (>5% variance)  
**Who:** Finance  
**Impact:** Tracks provider accounting integrity; large discrepancies = fraud risk

**Steps:**

1. Admin → Digital Products → Reconciliation
2. Find flagged record (RED badge)
3. Note: Provider balance, declared cost, discrepancy %
4. **Actions:**
   - **Provider balance too high**: Check if we under-reported costs (audit orders)
   - **Provider balance too low**: Check if provider charged more (contact provider)
   - **Large difference**: Escalate to Finance lead for investigation
5. Once resolved: Update record with review notes + status → RESOLVED

## Monitoring & Alerts

### Automated Health Checks

**Frequency:** Every 2 hours (configurable)  
**Data stored:** `ProviderHealth` table

```
SELECT 
  providerName, 
  status, 
  latencyMs, 
  checkedAt 
FROM ProviderHealth 
WHERE domain = 'VIRTUAL_NUMBER' 
ORDER BY checkedAt DESC 
LIMIT 3;
```

### Alert Thresholds

| Condition | Alert Level | Action |
|-----------|------------|--------|
| Provider DOWN for >2h | CRITICAL | Page on-call, failover status |
| Margin <10% on any order | WARNING | Review FX rate |
| Reconciliation >5% variance | WARNING | Queue for Finance review |
| Purchase limit usage >80% | INFO | Notify workspace owner |

### Key Queries

```sql
-- Count active numbers by provider
SELECT providerName, COUNT(*) as count
FROM VirtualNumber 
WHERE status IN ('ACTIVE', 'EXPIRING')
GROUP BY providerName;

-- Revenue from numbers (30d)
SELECT 
  SUM(sellMinorNgn - costMinorNgn) / 100.0 as marginNgn,
  COUNT(*) as orders
FROM VirtualNumberMarginAnalytics
WHERE createdAt > NOW() - INTERVAL '30 days';

-- Workspaces exceeding limits
SELECT w.name, l.spentMinor, l.limitMinor
FROM VirtualNumberPurchaseLimit l
JOIN Workspace w ON l.workspaceId = w.id
WHERE l.spentMinor > l.limitMinor;
```

## Incident Response

### Provider Outage (DOWN status)

**Definition:** Provider can't be reached or returns errors for >15min  
**Impact:** Customers can't purchase from that provider; fallback to backups

**Response:**

```
t=0m  : Provider health check fails; status = DOWN
        → Check ProviderHealth.reason for details
        
t=1m  : Verify by testing manually:
        curl https://api.smspool.net/api/check/balance \
          -H "Authorization: Bearer $API_KEY"
        
t=5m  : If down, contact provider support immediately
        → SMSPool: status.smspool.net
        → 5SIM: support@5sim.net (chat)
        → SMSPVA: smspva.com support ticket
        
t=10m : Run failover drill: node apps/worker/virtual-numbers-failover-drill.ts
        → Confirms backup providers are available
        → Report results to Slack #ops
        
t=20m : If provider still down:
        → Check Admin → Purchase Limits
        → Consider reducing limits for new purchases
        → Notify affected customers (auto-generated)
        
t=1h+ : If ongoing, escalate to Provider Manager
        → May need to disable provider in routing
        → Re-run drill with reduced providers
```

### High Margin Variance Detected

**Definition:** >10% of orders below target margin  
**Impact:** Revenue leak; potential FX rate issue

**Response:**

```
t=0   : Alert triggers (automated)
        
t=5m  : Check Margins dashboard → By Provider
        → Identify affected provider(s)
        
t=10m : Check FX rate in history
        → If recent change >3%: likely culprit
        → Check provider cost in adjacent order
        
t=15m : Root cause analysis:
        Case A: FX rate is high
          → Adjust if within bands, document
          
        Case B: Provider cost increased
          → Contact provider for explanation
          → Check if they increased pricing
          
        Case C: Systematic (many orders affected)
          → Check if MARKUP_BPS constant drifted
          → Verify margin calculation in code
          
t=30m : Update margin forecast if needed
        → If margin stays <10%: consider raising prices
```

### Reconciliation Discrepancy >10%

**Definition:** Provider balance ≠ declared costs by >10%  
**Impact:** Accounting integrity; fraud detection

**Response:**

```
t=0   : Alert triggers; status = INVESTIGATION
        
t=5m  : Gather data:
        - Provider name, period, balance, declared cost
        - Recent orders count, avg order value
        - FX rate applied during period
        
t=15m : Audit trail:
        SELECT * FROM VirtualNumberOrder
        WHERE providerName = '$PROVIDER'
        AND status = 'FULFILLED'
        AND createdAt BETWEEN $START AND $END;
        
        → Sum supplierCostMinor
        → Compare to provider balance (convert USD)
        
t=30m : If difference remains unexplained:
        Case A: Balance too high
          → Check if provider invoiced us for less
          → May indicate data entry error at provider
          
        Case B: Balance too low
          → Check if provider charged fees/interest
          → Verify no duplicate charges
          
        Case C: Neither (rounding errors, currency conversion)
          → Document and mark RESOLVED
          
t=45m : Contact provider Finance if difference >1000 USD
        → Request reconciliation statement
        → File dispute if necessary
```

## Provider Management

### Provider Priority Order (Routing)

**Current order** (checked in sequence on purchase):

1. SMSPool (primary; best latency)
2. 5SIM (backup; broader coverage)
3. SMSPVA (fallback; manual processing)

**To change:**

Edit `VirtualNumberProduct.preferredProviders` array in database:

```sql
UPDATE VirtualNumberProduct
SET preferredProviders = ARRAY['5sim', 'smspool', 'smspva']
WHERE countryCode = 'GB';
```

Then run:

```bash
npm run prisma:generate
```

### Adding a New Provider

1. **Develop adapter** in `packages/providers/src/index.ts`
2. **Implement interface:** `VirtualNumberProviderAdapter`
3. **Add factory:** `createNewProviderAdapter(config)`
4. **Wire in service:** `VirtualNumbersService.buildAdapter()`
5. **Add to health check:** `adminProviderHealth()` method
6. **Test failover:** Run drill with new provider
7. **Deploy & monitor:** Roll out to small % of products first

### Health Check Tuning

```ts
// apps/worker/src/virtual-numbers-processor.ts
// Adjust thresholds:

// Provider considered DEGRADED if latency > 500ms:
const LATENCY_DEGRADED_MS = 500;

// Provider considered DOWN if success rate < 70%:
const SUCCESS_RATE_MIN_BPS = 7_000; // 70%
```

## Emergency Procedures

### Rollback FX Rate

If incorrect rate causes widespread margin issues:

```bash
# Get previous rate
SELECT * FROM FxRate 
WHERE baseCurrency = 'USD' AND quoteCurrency = 'NGN'
ORDER BY effectiveFrom DESC LIMIT 2;

# In Admin UI: FX Rate tab → History → re-enter previous rate
```

### Disable Purchase Temporarily

If system compromised or under attack:

```bash
# Temporarily raise purchase limit to 0 for all workspaces
UPDATE VirtualNumberPurchaseLimit
SET limitMinor = 0
WHERE periodType = 'MONTH' AND periodEnd > NOW();

# Alternatively, take provider offline
UPDATE VirtualNumberProduct SET active = false;
```

### Revert to Safe Provider

If primary provider is compromised:

```bash
UPDATE VirtualNumberProduct
SET preferredProviders = ARRAY['smspva'];
-- Force all purchases to go through fallback

-- Then:
npm run prisma:generate && npm run build && npm run deploy
```

## Escalation Matrix

| Scenario | On-Call | Backup | Finance Lead | VP Engineering |
|----------|---------|--------|--------------|-----------------|
| Provider DOWN >2h | Page | — | Notify | If >$10k/day revenue lost |
| Margin <5% | Notify | — | **Escalate** | If systemic |
| Data integrity issue | Notify | Escalate | Escalate | **Escalate** |
| Incident >1h duration | — | Page | Notify | **Escalate** |

**On-Call:** Virtual Numbers ops rotation (Slack: #fliptrybe-oncall)  
**Finance Lead:** (Slack handle: @finance-lead)  
**VP Engineering:** (Slack handle: @eng-vp)

---

## Appendix: Quick Reference

```bash
# Check provider health live
curl -X GET -H "Authorization: Bearer $TOKEN" \
  https://api.fliptrybe.local/admin/digital-products/providers/health | jq

# Run failover drill
node apps/worker/dist/virtual-numbers-failover-drill.js

# View provider costs (last 7d avg)
psql $DATABASE_URL -c "
SELECT providerName, 
       AVG(costMinorUsd) / 100.0 as avgCostUsd,
       COUNT(*) as orders
FROM VirtualNumberMarginAnalytics
WHERE createdAt > NOW() - INTERVAL '7 days'
GROUP BY providerName;"

# Check for orphaned numbers (expired but not released)
psql $DATABASE_URL -c "
SELECT id, e164, expiresAt, status
FROM VirtualNumber
WHERE status = 'EXPIRED' AND releasedAt IS NULL
AND expiresAt < NOW() - INTERVAL '1 day';"
```

---

**Document Version:** 1.0  
**Last Reviewed:** 2026-07-31  
**Next Review:** 2026-08-31  
**Owner:** Ops Lead
