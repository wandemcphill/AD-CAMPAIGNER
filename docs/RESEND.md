# Resend production contract

AD-CAMPAIGNER uses the shared FlipTrybe Ltd Resend account for transactional email.

## Render environment

Set these on the API/worker services:

```text
NOTIFICATION_PROVIDER=live
RESEND_API_KEY=<shared FlipTrybe Resend API key>
RESEND_FROM_EMAIL=Ads Campaigner <noreply@fliptrybe.xyz>
```

`NOTIFICATION_PROVIDER=live` keeps Termii as the live SMS/WhatsApp transport. Email is routed independently through Resend by the worker. `EMAIL_PROVIDER=resend` may also be set explicitly, but is not required when `NOTIFICATION_PROVIDER=live` is used.

## Delivery rules

- Resend is server-side only. Never expose the API key to the web client.
- The persisted notification idempotency key is passed to Resend as `Idempotency-Key`.
- BullMQ retries transient provider failures; a notification is only marked terminally failed after the final retry.
- Missing production provider credentials produce `PENDING_CONFIGURATION`, never a fabricated successful delivery.
- SMS and WhatsApp remain on the existing Termii path.

## Sender identity

The sender must use a domain verified in the same Resend account. The exact sender address may be changed without changing application code by updating `RESEND_FROM_EMAIL`.
