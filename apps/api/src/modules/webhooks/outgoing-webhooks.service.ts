import { createHmac, randomBytes } from "node:crypto";
import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

export const SUPPORTED_WEBHOOK_EVENTS = [
  "campaign.created",
  "campaign.launched",
  "campaign.paused",
  "campaign.completed",
  "voucher.redeemed",
  "order.completed",
  "order.failed",
  "payment.completed"
];

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

@Injectable()
export class OutgoingWebhooksService {
  private readonly logger = new Logger(OutgoingWebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async list(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    const subs = await this.db.outgoingWebhookSubscription.findMany({
      where: { workspaceId: scope.workspaceId },
      orderBy: { createdAt: "desc" }
    });

    return subs.map((sub: any) => ({
      id: sub.id,
      targetUrl: sub.targetUrl,
      events: sub.events,
      isActive: sub.isActive,
      createdAt: sub.createdAt,
      // Only shown once, at creation.
      signingSecretPreview: `${String(sub.signingSecret).slice(0, 8)}…`
    }));
  }

  async create(
    input: { targetUrl: string; events: string[] },
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireScope(context);

    if (!input.targetUrl || !isValidUrl(input.targetUrl)) {
      throw new BadRequestException("A valid target URL is required.");
    }
    const events = (input.events ?? []).filter((e) => SUPPORTED_WEBHOOK_EVENTS.includes(e));
    if (events.length === 0) {
      throw new BadRequestException("At least one valid event must be selected.");
    }

    const signingSecret = `whsec_${randomBytes(24).toString("base64url")}`;

    const sub = await this.db.outgoingWebhookSubscription.create({
      data: {
        workspaceId: scope.workspaceId,
        createdByUserId: scope.userId,
        targetUrl: input.targetUrl,
        events,
        signingSecret
      }
    });

    return {
      id: sub.id,
      targetUrl: sub.targetUrl,
      events: sub.events,
      isActive: sub.isActive,
      createdAt: sub.createdAt,
      // Only ever returned in full at creation time.
      signingSecret
    };
  }

  async revoke(id: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    const sub = await this.db.outgoingWebhookSubscription.findFirst({
      where: { id, workspaceId: scope.workspaceId }
    });
    if (!sub) {
      throw new NotFoundException("Webhook subscription was not found.");
    }

    await this.db.outgoingWebhookSubscription.update({
      where: { id: sub.id },
      data: { isActive: false }
    });

    return { ok: true };
  }

  async deliveries(id: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    const sub = await this.db.outgoingWebhookSubscription.findFirst({
      where: { id, workspaceId: scope.workspaceId }
    });
    if (!sub) {
      throw new NotFoundException("Webhook subscription was not found.");
    }

    return this.db.outgoingWebhookDelivery.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  /**
   * Fire-and-forget dispatch to every active subscription for this workspace that
   * subscribes to `eventName`. Failures are logged to OutgoingWebhookDelivery and
   * never thrown — a slow or broken customer endpoint must never break the
   * FlipTrybe operation that triggered the event.
   */
  async dispatchEvent(workspaceId: string, eventName: string, payload: Record<string, unknown>) {
    let subscriptions: any[] = [];
    try {
      subscriptions = await this.db.outgoingWebhookSubscription.findMany({
        where: { workspaceId, isActive: true, events: { has: eventName } }
      });
    } catch (error) {
      this.logger.warn(`Could not load webhook subscriptions for ${eventName}: ${String(error)}`);
      return;
    }

    await Promise.all(subscriptions.map((sub) => this.deliverOne(sub, eventName, payload)));
  }

  private async deliverOne(
    subscription: { id: string; targetUrl: string; signingSecret: string },
    eventName: string,
    payload: Record<string, unknown>
  ) {
    const body = JSON.stringify({ event: eventName, data: payload, sentAt: new Date().toISOString() });
    const signature = createHmac("sha256", subscription.signingSecret).update(body).digest("hex");

    const delivery = await this.db.outgoingWebhookDelivery.create({
      data: {
        subscriptionId: subscription.id,
        eventName,
        payload: payload as any,
        status: "PENDING",
        attempts: 1,
        lastAttemptAt: new Date()
      }
    });

    try {
      const response = await fetch(subscription.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FlipTrybe-Event": eventName,
          "X-FlipTrybe-Signature": signature
        },
        body,
        signal: AbortSignal.timeout(10_000)
      });

      await this.db.outgoingWebhookDelivery.update({
        where: { id: delivery.id },
        data: { status: response.ok ? "DELIVERED" : "FAILED", responseStatus: response.status }
      });
    } catch (error) {
      this.logger.warn(`Webhook delivery failed for ${subscription.id}/${eventName}: ${String(error)}`);
      await this.db.outgoingWebhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED" }
      });
    }
  }
}
