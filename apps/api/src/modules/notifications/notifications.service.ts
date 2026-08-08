import { Injectable, Logger } from "@nestjs/common";

import { Prisma } from "@fliptrybe/database";
import {
  renderNotificationTemplate,
  type NotificationTemplateName,
  type NotificationTemplateVars
} from "@fliptrybe/notifications";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";

export interface SendNotificationInput {
  // Authenticated recipient: requires workspaceId. userId resolves the
  // destination address (email/phone) from the User row when not overridden.
  workspaceId?: string;
  userId?: string;

  // Guest recipient (guest-checkout etc): no workspace/user, contact info is
  // supplied directly by the caller since it came from the checkout form.
  guestEmail?: string;
  guestPhone?: string;

  // Explicit destination override — takes precedence over resolving from userId.
  emailOverride?: string;
  phoneOverride?: string;

  channels: NotificationChannel[];

  // Either a predefined template (rendered per-channel with vars — for
  // customer-facing multi-channel sends), or direct content for internal/
  // IN_APP-only notifications that don't fit the templated-vars shape.
  template?: NotificationTemplateName;
  vars?: NotificationTemplateVars;
  content?: { title: string; body: string };

  category?: string;
  priority?: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;

  // Base idempotency key — the service suffixes it per channel so a caller can
  // request multiple channels from one logical event without colliding.
  idempotencyKey: string;
}

export interface SendNotificationResult {
  channel: NotificationChannel;
  outcome: "created" | "duplicate" | "skipped_no_destination" | "skipped_opted_out";
  notificationId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueProducer: QueueProducerService
  ) {}

  private get db() {
    return this.prismaService.client;
  }

  async send(input: SendNotificationInput): Promise<SendNotificationResult[]> {
    if (!input.workspaceId && !input.guestEmail && !input.guestPhone) {
      throw new Error(
        "NotificationService.send requires either workspaceId (authenticated) or guestEmail/guestPhone (guest)."
      );
    }
    if (!input.template && !input.content) {
      throw new Error("NotificationService.send requires either a template or direct content.");
    }

    const rendered = input.template
      ? renderNotificationTemplate(input.template, input.vars ?? {})
      : { subject: input.content!.title, emailBody: input.content!.body, smsBody: input.content!.body };
    const results: SendNotificationResult[] = [];

    for (const channel of input.channels) {
      results.push(await this.sendOneChannel(channel, input, rendered));
    }

    return results;
  }

  private async sendOneChannel(
    channel: NotificationChannel,
    input: SendNotificationInput,
    rendered: { subject: string; emailBody: string; smsBody: string }
  ): Promise<SendNotificationResult> {
    if (channel === "IN_APP" && !input.workspaceId) {
      // Guests have no in-app surface to render into.
      return { channel, outcome: "skipped_no_destination" };
    }

    const destination = await this.resolveDestination(channel, input);
    if (channel !== "IN_APP" && !destination) {
      this.logger.warn(
        `No destination resolvable for ${channel} (template=${input.template}); skipping.`
      );
      return { channel, outcome: "skipped_no_destination" };
    }

    if (channel !== "IN_APP" && input.userId && (await this.isOptedOut(input.userId, channel))) {
      return { channel, outcome: "skipped_opted_out" };
    }

    const { title, body } = channel === "EMAIL"
      ? { title: rendered.subject, body: rendered.emailBody }
      : { title: rendered.subject, body: rendered.smsBody };

    const idempotencyKey = `${input.idempotencyKey}:${channel}`;

    try {
      const notification = await this.db.notification.create({
        data: {
          ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
          ...(input.userId ? { recipientUserId: input.userId } : {}),
          ...(input.guestEmail ? { guestEmail: input.guestEmail } : {}),
          ...(input.guestPhone ? { guestPhone: input.guestPhone } : {}),
          channel,
          category: input.category ?? "transactional",
          priority: input.priority ?? "normal",
          title,
          body,
          ...(input.actionUrl ? { actionUrl: input.actionUrl } : {}),
          ...(input.entityType ? { entityType: input.entityType } : {}),
          ...(input.entityId ? { entityId: input.entityId } : {}),
          idempotencyKey,
          // IN_APP delivery IS creating the row — nothing further to dispatch.
          status: channel === "IN_APP" ? "DELIVERED" : "QUEUED",
          ...(channel === "IN_APP" ? { deliveredAt: new Date() } : {})
        }
      });

      if (channel !== "IN_APP") {
        await this.queueProducer.enqueueNotificationDispatch(notification.id, channel);
      }

      return { channel, outcome: "created", notificationId: notification.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Already sent for this idempotency key — not an error, just a duplicate request.
        return { channel, outcome: "duplicate" };
      }
      throw err;
    }
  }

  private async resolveDestination(
    channel: NotificationChannel,
    input: SendNotificationInput
  ): Promise<string | undefined> {
    if (channel === "IN_APP") return undefined;

    if (channel === "EMAIL") {
      if (input.emailOverride) return input.emailOverride;
      if (input.guestEmail) return input.guestEmail;
      if (input.userId) {
        const user = await this.db.user.findUnique({ where: { id: input.userId } });
        return user?.email ?? undefined;
      }
      return undefined;
    }

    // SMS / WHATSAPP
    if (input.phoneOverride) return input.phoneOverride;
    if (input.guestPhone) return input.guestPhone;
    if (input.userId) {
      const user = await this.db.user.findUnique({ where: { id: input.userId } });
      return user?.phone ?? undefined;
    }
    return undefined;
  }

  private async isOptedOut(userId: string, channel: NotificationChannel): Promise<boolean> {
    if (channel === "IN_APP") return false;

    const pref = await this.db.notificationPreference.findFirst({ where: { userId } });
    if (!pref) return false; // defaults (email/sms true, whatsapp false) apply — no row means "use defaults"

    if (channel === "EMAIL") return !pref.email;
    if (channel === "SMS") return !pref.sms;
    if (channel === "WHATSAPP") return !pref.whatsapp;
    return false;
  }
}
