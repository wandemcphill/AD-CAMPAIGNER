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

interface ResendConfig {
  apiKey?: string;
  from?: string;
  fetcher?: typeof fetch;
}

interface ResendEmailResponse {
  data?: { id?: string };
  error?: { message?: string; name?: string };
}

function createResendEmailAdapter(
  config: ResendConfig,
  idempotencyKey: string
): NotificationProviderAdapter {
  return {
    name: "resend",
    isConfigured() {
      return Boolean(config.apiKey && config.from);
    },
    async send(input) {
      if (!config.apiKey || !config.from) {
        throw new Error("Resend Email is not configured (missing RESEND_API_KEY or RESEND_FROM_EMAIL).");
      }

      const response = await (config.fetcher ?? fetch)("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.slice(0, 256)
        },
        body: JSON.stringify({
          from: config.from,
          to: [input.to],
          subject: input.title,
          html: input.body
        })
      });

      let payload: ResendEmailResponse = {};
      try {
        payload = (await response.json()) as ResendEmailResponse;
      } catch {
        // Preserve the transport status as the useful diagnostic when the
        // provider returns non-JSON content.
      }

      if (!response.ok || payload.error) {
        throw new Error(
          `Resend Email send failed (HTTP ${response.status}): ${
            payload.error?.message ?? payload.error?.name ?? JSON.stringify(payload)
          }`
        );
      }

      const messageId = payload.data?.id;
      if (!messageId) {
        throw new Error("Resend Email send failed: provider returned no message id.");
      }

      return {
        id: messageId,
        accepted: true,
        providerStatus: "sent",
        raw: payload
      };
    }
  };
}

function createUnavailableProductionProvider(name: string): NotificationProviderAdapter {
  return {
    name,
    isConfigured: () => false,
    async send() {
      throw new Error(`${name} notification provider is not configured for production.`);
    }
  };
}

// EMAIL_PROVIDER can override only the email transport, allowing Resend to
// coexist with Termii for SMS/WhatsApp. When omitted, email keeps following
// NOTIFICATION_PROVIDER for backwards compatibility.
function adapterForChannel(
  channel: "EMAIL" | "SMS" | "WHATSAPP",
  idempotencyKey: string
): NotificationProviderAdapter {
  const provider = (
    channel === "EMAIL"
      ? process.env.EMAIL_PROVIDER ?? process.env.NOTIFICATION_PROVIDER
      : process.env.NOTIFICATION_PROVIDER
  )?.trim().toLowerCase();

  if (channel === "EMAIL" && (provider === "resend" || provider === "live")) {
    // "live" is retained as a backwards-compatible production value, but the
    // actual email transport remains Resend when its credentials are present.
    return createResendEmailAdapter(
      {
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM
      },
      idempotencyKey
    );
  }

  const useTermii = (provider === "termii" || provider === "live") && Boolean(process.env.TERMII_API_KEY);

  if (!useTermii) {
    if ((process.env.NODE_ENV || "").trim().toLowerCase() === "production") {
      return createUnavailableProductionProvider(provider || "notification");
    }
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

  const idempotencyKey = `${notification.idempotencyKey}:${channel}`;
  const adapter = adapterForChannel(channel, idempotencyKey);

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
