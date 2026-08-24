# MEGA 3: Provider + Financial Reliability

## Completion scope

MEGA 3 establishes one reliability contract for every external provider operation. It does not pretend that a provider timeout is a failed transaction, and it does not allow blind retries of money-moving requests.

### Guardrails now available in `@fliptrybe/payments`

- deterministic, persisted idempotency keys for provider requests
- positive safe-integer money validation before provider calls
- explicit provider failure classification
- timeout classification as `unknown_delivery`, never automatically retryable
- explicit retry classification for transient HTTP responses
- client/provider rejection classification for 4xx failures
- operator-review classification for unknown/configuration failures
- existing charge saga retained for debit → provider execution → compensation/hold

## Provider operation matrix

| Operation | Retry policy | Timeout policy | Financial rule |
| --- | --- | --- | --- |
| Remittance | retry only explicit transient failure | reconcile first | never double-debit |
| RMB / China payment | retry only explicit transient failure | reconcile first | idempotent order + ledger |
| USDT / USDC buy/sell | retry only explicit transient failure | reconcile first | quote/order identity preserved |
| Gift card buy/sell | retry only explicit transient failure | reconcile first | unknown delivery held |
| Virtual card | retry only explicit transient failure | reconcile first | resource creation idempotent |
| Travel | retry safe quote/search operations | booking timeout reconciles | booking identity preserved |
| Growth | retry only supplier-safe operations | supplier delivery reconciles | reservation/capture/refund remains idempotent |

## Hard rule

A network timeout is **not proof of non-delivery**. The customer-facing state must remain pending/processing until reconciliation establishes the provider outcome. A compensating refund is only safe when the provider contract proves that the external operation did not happen.

## Production evidence still external

Code-level reliability can be tested in CI. Live provider credentials, dashboard evidence, webhook delivery, settlement, and production reconciliation remain environment/provider evidence gates. Those must be certified in Render/provider dashboards before declaring the corresponding production operation live.
