import type { Job } from "bullmq";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";
import {
  createTermiiEmailAdapter,
  createTermiiSmsAdapter,
  createTermiiWhatsappAdapter,
  createMockNotificationProvider,
  type NotificationProviderAdapter
} from "@fliptrybe/providers";

import type { NotificationJob } from "./queues";

let dbSingleton: DatabaseClient | undefined;

function getDb(): DatabaseClient {
  if (!dbSingleton) dbSingleton = createPrismaClient();
  return dbSingleton;
}

// The mock adapter reports every send as accepted. Running it in production
// would silently discard real password resets and security alerts while
// recording them as SENT (see NotificationDeliveryAttempt), so it is gated
// behind the same ALLOW_MOCK_PROVIDERS escape hatch platform.service.ts uses
// for every other provider — the API's legacyMockProvidersAllowed().
function mockNotificationsAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PROVIDERS === "true";
}

// "live" is the one canonical provider sentinel — PAYMENT_PROVIDER,
// ADS_PROVIDER, and SMM_PROVIDER in render.yaml all use it, and it's the only
// value packages/config/src/index.ts's NOTIFICATION_PROVIDER schema accepts
// besides "mock"/"sandbox". "termii" was never a schema-valid value and no
// deployed environment sets it — it was this file's own unvalidated,
// out-of-band check, and the mismatch with the "live" every real deploy
// actually sends is what let the mock provider run in production unnoticed
// (see the production-sealing report, F-01). Anything other than exactly
// "live" must fall through to the mock/PENDING_CONFIGURATION path below,
// never select Termii.
//
// Returns undefined when no live transport is configured and the mock is not
// permitted — the caller records that as PENDING_CONFIGURATION rather than
// fabricating a delivery.
function adapterForChannel(
  channel: "EMAIL" | "SMS" | "WHATSAPP"
): NotificationProviderAdapter | undefined {
  const liveRequested = process.env.NOTIFICATION_PROVIDER === "live";

  if (!liveRequested || !process.env.TERMII_API_KEY) {
    return mockNotificationsAllowed() ? createMockNotificationProvider() : undefined;
  }

  const termiiConfig = {
    apiKey: process.env.TERMII_API_KEY,
    ...(process.env.TERMII_BASE_URL ? { baseUrl: process.env.TERMII_BASE_URL } : {}),
    ...(process.env.TERMII_SMS_SENDER_ID ? { smsSenderId: process.env.TERMII_SMS_SENDER_ID } : {}),
    ...(process.env.TERMII_EMAIL_CONFIGURATION_ID
      ? { emailConfigurationId: process.env.TERMII_EMAIL_CONFIGURATION_ID }
      : {}),
    ...(process.env.TERMII_WHATSAPP_CONFIGURATION_ID
      ? { whatsappConfigurationId: process.env.TERMII_WHATSAPP_CONFIGURATION_ID }
      : {})
  };

  if (channel === "EMAIL") return createTermiiEmailAdapter(termiiConfig);
  if (channel === "WHATSAPP") return createTermiiWhatsappAdapter(termiiConfig);
  return createTermiiSmsAdapter(termiiConfig);
}

export async function processNotificationDispatchJob(
  job: Job<NotificationJob>
): Promise<{ notificationId: string; channel: string; outcome: string }> {
  const db = getDb();
  const { notificationId, channel } = job.data;

  if (channel === "IN_APP" || channel === "WEBSOCKET") {
    // Neither is dispatched externally — IN_APP is delivered by row creation,
    // WEBSOCKET goes through the realtime gateway, not this queue.
    return { notificationId, channel, outcome: "skipped:not_externally_dispatched" };
  }

  const notification = await db.notification.findUnique({
    where: { id: notificationId },
    include: { recipient: true }
  });
  if (!notification) {
    return { notificationId, channel, outcome: "skipped:notification_not_found" };
  }

  const to =
    channel === "EMAIL"
      ? notification.guestEmail ?? notification.recipient?.email
      : notification.guestPhone ?? notification.recipient?.phone;

  if (!to) {
    await db.notificationDeliveryAttempt.create({
      data: {
        notificationId,
        channel,
        provider: "none",
        status: "FAILED",
        errorMessage: `No ${channel === "EMAIL" ? "email" : "phone"} destination on file for this recipient.`
      }
    });
    await db.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED", failedAt: new Date(), errorCode: "no_destination" }
    });
    return { notificationId, channel, outcome: "failed:no_destination" };
  }

  const adapter = adapterForChannel(channel);

  if (!adapter || !adapter.isConfigured()) {
    // Credentials/configuration genuinely absent, or (in production, with
    // ALLOW_MOCK_PROVIDERS unset) no live provider requested and the mock is
    // not permitted to stand in. Either way: record as pending, not a
    // fabricated success — the Notification row stays QUEUED so it reads as
    // visibly undelivered. A later retry, once configured, can still succeed.
    await db.notificationDeliveryAttempt.create({
      data: {
        notificationId,
        channel,
        provider: adapter?.name ?? "none",
        status: "PENDING_CONFIGURATION",
        errorMessage: adapter
          ? `${adapter.name} is not configured for this channel.`
          : "No live notification provider is configured, and the mock provider is not permitted in production."
      }
    });
    return { notificationId, channel, outcome: "pending:provider_not_configured" };
  }

  try {
    const result = await adapter.send({
      channel,
      to,
      title: notification.title,
      body: notification.body
    });

    await db.notificationDeliveryAttempt.create({
      data: {
        notificationId,
        channel,
        provider: adapter.name,
        status: result.accepted ? "SENT" : "FAILED",
        providerMessageId: result.id,
        response: (result.raw ?? {}) as never
      }
    });

    await db.notification.update({
      where: { id: notificationId },
      data: result.accepted
        ? {
            status: "SENT",
            provider: adapter.name,
            providerMessageId: result.id,
            deliveredAt: new Date()
          }
        : { status: "FAILED", failedAt: new Date(), provider: adapter.name, errorCode: "not_accepted" }
    });

    return { notificationId, channel, outcome: result.accepted ? "sent" : "failed:not_accepted" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db.notificationDeliveryAttempt.create({
      data: {
        notificationId,
        channel,
        provider: adapter.name,
        status: "FAILED",
        errorMessage: message
      }
    });

    // BullMQ retries this job per the "notifications" queue's retry policy
    // (attempts: 6, exponential backoff) — only mark the Notification row
    // FAILED once every attempt is exhausted, so it doesn't read as a
    // terminal failure mid-retry.
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await db.notification.update({
        where: { id: notificationId },
        data: { status: "FAILED", failedAt: new Date(), errorCode: "provider_error" }
      });
    }

    throw err;
  }
}
