# Vertical Enablement Runbook

How to take a money-moving vertical from "deployed but dark" to "live", for
airtime/data, utilities (bills), SMM growth services, virtual accounts, virtual
cards, and remittance.

Nothing here requires a code change. Every switch is a Render environment
variable or a database row.

## The three gates

A customer request only succeeds when **all three** are satisfied. They fail in
distinguishable ways, which is how you diagnose a dark vertical:

| Gate | Set where | Failure mode |
| --- | --- | --- |
| 1. Feature flag | `FEATURE_*` env var on the API **and** worker | `503 Feature "x" is not enabled` — and the sidebar link is hidden |
| 2. Provider credentials | provider env vars on API + worker | `503 ...provider is not configured`, or provider auth errors in logs |
| 3. `ProviderConfig` row `status = ENABLED` | database | `503 No <domain> provider is currently configured. Contact support.` |

Gate 1 opens the API surface. Gate 3 is what actually selects an adapter. Turning
on a flag without an enabled `ProviderConfig` row produces a 503, never a bad
charge — that ordering is deliberate.

## Gate 1 — feature flags

`packages/feature-flags` resolves each flag at process start from
`FEATURE_<FLAG_NAME_IN_UPPER_SNAKE_CASE>`, falling back to the code default.

```
virtualAccounts    -> FEATURE_VIRTUAL_ACCOUNTS
walletWithdrawals  -> FEATURE_WALLET_WITHDRAWALS
billsElectricity   -> FEATURE_BILLS_ELECTRICITY
```

Accepted values: `true|1|yes|on` and `false|0|no|off` (case-insensitive). A blank
or unrecognised value leaves the code default in place, so an empty Render
variable can never silently disable a live vertical.

Two rules:

- **Set the same flags on the API service and the worker service.** Worker queues
  register behind the same flags the API enforces; a mismatch means jobs are
  enqueued but never processed.
- **Changing a flag requires a service restart**, since flags resolve once at
  process start.

The web app does not read these variables. It fetches the resolved set from
`GET /v1/platform/feature-flags` and hides navigation and screens for anything
that is off — which is why the sidebar shrinks when a flag is off, rather than
linking to a 503.

### Flag defaults

Default ON: `vtu`, `billsElectricity`, `billsCable`, `billsBetting`,
`billsEducation`, `telecomGateway`, `guestCheckout`, `digitalAccess`,
`virtualNumbers`, `giftCardSell`, `giftCardBuy`, `cryptoSell`, `rmbBuy`,
`rewards`, `support`.

Default OFF (financial products — require sandbox sign-off first):
`virtualAccounts`, `virtualCards`, `remittance`, `walletWithdrawals`,
`kycVerification`, `kybVerification`, `liveProviderIntegrations`, `trustEngine`.

## Gate 2 — provider credentials

All are `sync: false` in `render.yaml`, meaning Render prompts for them rather
than storing them in the repo. Set them on **both** the API and worker services.

| Vertical | Variables |
| --- | --- |
| Airtime / data / bills | `VTPASS_API_KEY`, `VTPASS_PUBLIC_KEY`, `VTPASS_SECRET_KEY`; `CLUBKONNECT_USER_ID`, `CLUBKONNECT_API_KEY`; `EBILLS_API_KEY`; optional: `INLOMAX_*`, `ISQUAREDATA_*`, `SWIFTLINK_*`, `TOPUPWIZARD_*`, `VTUGATE_*` |
| International top-up | `RELOADLY_CLIENT_ID`, `RELOADLY_CLIENT_SECRET` |
| SMM growth services | `SMDPANEL_API_KEY`, `SMMRAJA_API_KEY`, `JAP_API_KEY`, `PEAKERR_API_KEY` (+ matching `*_SERVICE_MAP`) |
| Virtual accounts | `SWAPPR_API_KEY`, `SWAPPR_WEBHOOK_SECRET` and/or `PAYSCRIBE_API_KEY`, `PAYSCRIBE_WEBHOOK_SECRET` |
| Virtual cards | `PAYSCRIBE_API_KEY`, `PAYSCRIBE_WEBHOOK_SECRET` |
| Remittance | `FINCRA_API_KEY`, `FINCRA_BUSINESS_ID`, `FINCRA_WEBHOOK_ENCRYPTION_KEY`; fallbacks `SWAPPR_*`, `YATIVO_API_KEY` + `YATIVO_ACCOUNT_ID` |
| Wallet funding (all verticals) | `KORAPAY_SECRET_KEY`, `KORAPAY_PUBLIC_KEY`, `KORAPAY_ENCRYPTION_KEY`, `KORAPAY_WEBHOOK_SECRET` |

### Webhook callbacks

Register these in each provider's dashboard. Without them, a virtual-account
deposit never becomes wallet balance and a remittance transfer never leaves
`PROCESSING` — the API has no other way to learn the outcome.

```
https://<api-host>/v1/webhooks/financial/swappr
https://<api-host>/v1/webhooks/financial/payscribe
https://<api-host>/v1/webhooks/financial/fincra
https://<api-host>/api/webhooks/korapay        # note: no /v1 — excluded from the global prefix
https://<api-host>/v1/webhooks/sogo
https://<api-host>/v1/webhooks/reloadly
```

Each endpoint verifies the provider's signature before any state change, records
every delivery (accepted or rejected) as a `ProviderWebhookEvent`, and is
idempotent across retries. A burst of rejected deliveries in that table almost
always means a wrong or unset webhook secret.

## Gate 3 — enable the ProviderConfig row

`ProviderRouterService.select()` returns no candidate unless an `ENABLED`
`ProviderConfig` row exists for the domain, so this is the real switch.

Rows are created by the seeds, which run on every API deploy
(`preDeployCommand` in `render.yaml`) and are idempotent:

```
seed:digital-access  seed:vtu  seed:virtual-numbers
seed:financial-products  seed:provider-capability-grants  seed:marketplace
```

Every financial-products row is seeded `DISABLED` on purpose. Enable one through
the admin API once its sandbox verification has signed off:

```
PATCH /v1/admin/providers/registry/:id     { "status": "ENABLED" }
POST  /v1/admin/providers/:domain/:name/enable
```

## Order of operations for a new vertical

1. Set provider credentials on API + worker; redeploy.
2. Register the webhook URL in the provider dashboard and confirm a test
   delivery lands with `signatureValid = true` in `ProviderWebhookEvent`.
3. Enable the `ProviderConfig` row for that domain.
4. Set the `FEATURE_*` flag to `true` on API + worker; restart.
5. Run `pnpm smoke:deployed` and confirm the vertical's screens and endpoints
   are in the pass list.
6. Put one small real transaction through end to end and confirm the ledger
   entry, the provider's own dashboard, and the reconciliation record agree.

Reverse the order to switch a vertical off: flag first, then the
`ProviderConfig` row. Webhook endpoints stay registered regardless of the flags
so anything already in flight can still settle.
