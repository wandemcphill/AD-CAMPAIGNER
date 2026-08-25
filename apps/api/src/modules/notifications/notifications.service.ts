import { Injectable, Logger } from "@nestjs/common";

import { Prisma } from "@fliptrybe/database";
import {
  defaultOperationalEventName,
  renderNotificationTemplate,
  type NotificationTemplateName,
  type NotificationTemplateVars,
  type OperationalEventKind
} from "@fliptrybe/notifications";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";

export interface SendNotificationInput {
  workspaceId?: string;
  userId?: string;
  guestEmail?: string;
  guestPhone?: string;
  emailOverride?: string;
  phoneOverride?: string;
  channels: NotificationChannel[];
  template?: NotificationTemplateName;
  vars?: NotificationTemplateVars;
  content?: { title: string; body: string };
  category?: string;
  /** Stable event name used to scope NotificationPreference rows. */
  eventName?: string;
  /** Operational event names are the preferred vocabulary for new callers. */
  operationalEvent?: OperationalEventKind;
  priority?: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  idempotencyKey: string;
  /** Security/system notifications can bypass marketing-style opt-outs. */
  mandatory?: boolean;
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
    const eventName = input.operationalEvent
      ? defaultOperationalEventName(input.operationalEvent)
      : input.eventName ?? input.category ?? "transactional";

    for (const channel of input.channels) {
      results.push(await this.sendOneChannel(channel, input, rendered, eventName));
    }

    return results;
  }

  private async sendOneChannel(
    channel: NotificationChannel,
    input: SendNotificationInput,
    rendered: { subject: string; emailBody: string; smsBody: string },
    eventName: string
  ): Promise<SendNotificationResult> {
    if (channel === "IN_APP" && !input.workspaceId) {
      return { channel, outcome: "skipped_no_destination" };
    }

    const destination = await this.resolveDestination(channel, input);
    if (channel !== "IN_APP" && !destination) {
      this.logger.warn(`No destination resolvable for ${channel} (event=${eventName}); skipping.`);
      return { channel, outcome: "skipped_no_destination" };
    }

    if (
      channel !== "IN_APP" &&
      input.userId &&
      !input.mandatory &&
      (await this.isOptedOut(input.workspaceId, input.userId, eventName, channel))
    ) {
      return { channel, outcome: "skipped_opted_out" };
    }

    const { title, body } =
      channel === "EMAIL"
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
          status: channel === "IN_APP" ? "DELIVERED" : "QUEUED",
          ...(channel === "IN_APP" ? { deliveredAt: new Date() } : {}),
          metadata: {
            eventName,
            operationalEvent: input.operationalEvent ?? null,
            mandatory: input.mandatory ?? false
          }
        }
      });

      if (channel !== "IN_APP") {
        await this.queueProducer.enqueueNotificationDispatch(notification.id, channel);
      }

      return { channel, outcome: "created", notificationId: notification.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
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

    if (input.phoneOverride) return input.phoneOverride;
    if (input.guestPhone) return input.guestPhone;
    if (input.userId) {
      const user = await this.db.user.findUnique({ where: { id: input.userId } });
      return user?.phone ?? undefined;
    }
    return undefined;
  }

  private async isOptedOut(
    workspaceId: string | undefined,
    userId: string,
    eventName: string,
    channel: NotificationChannel
  ): Promise<boolean> {
    if (channel === "IN_APP") return false;

    const pref = await this.db.notificationPreference.findFirst({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        userId,
        eventName
      }
    });

    if (!pref) return channel === "WHATSAPP";
    if (channel === "EMAIL") return !pref.email;
    if (channel === "SMS") return !pref.sms;
    if (channel === "WHATSAPP") return !pref.whatsapp;
    return false;
  }
}
