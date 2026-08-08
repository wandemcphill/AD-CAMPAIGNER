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

// NOTIFICATION_PROVIDER=mock (or unset with no TERMII_API_KEY) uses the mock
// adapter so dev/test environments never attempt a real Termii call. Set
// NOTIFICATION_PROVIDER=termii with the TERMII_* vars populated to go live.
function adapterForChannel(channel: "EMAIL" | "SMS" | "WHATSAPP"): NotificationProviderAdapter {
  const useTermii =
    process.env.NOTIFICATION_PROVIDER === "termii" && Boolean(process.env.TERMII_API_KEY);

  if (!useTermii) {
    return createMockNotificationProvider();
  }

  const termiiConfig = {
    apiKey: process.env.TERMII_API_KEY!,
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

  if (!adapter.isConfigured()) {
    // Credentials/configuration genuinely absent — record as pending, not a
    // fabricated success. A later retry (once configured) can still succeed.
    await db.notificationDeliveryAttempt.create({
      data: {
        notificationId,
        channel,
        provider: adapter.name,
        status: "PENDING_CONFIGURATION",
        errorMessage: `${adapter.name} is not configured for this channel.`
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
