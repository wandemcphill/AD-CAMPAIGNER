import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

@Injectable()
export class AdminWebhookOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async overview() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      pendingOutbox,
      failedOutbox,
      recentOutbox,
      invalidProviderSignatures,
      providerEvents24h,
      activeSubscriptions,
      failedDeliveries24h
    ] = await Promise.all([
      this.db.eventOutbox.count({ where: { status: "PENDING" } }),
      this.db.eventOutbox.count({ where: { status: "FAILED" } }),
      this.db.eventOutbox.count({ where: { createdAt: { gte: since } } }),
      this.db.providerWebhookEvent.count({ where: { createdAt: { gte: since }, signatureValid: false } }),
      this.db.providerWebhookEvent.count({ where: { createdAt: { gte: since } } }),
      this.db.outgoingWebhookSubscription.count({ where: { isActive: true } }),
      this.db.outgoingWebhookDelivery.count({ where: { createdAt: { gte: since }, status: "FAILED" } })
    ]);

    const [failedEvents, invalidEvents, failedDeliveries] = await Promise.all([
      this.db.eventOutbox.findMany({ where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.db.providerWebhookEvent.findMany({ where: { signatureValid: false }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.db.outgoingWebhookDelivery.findMany({ where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 50 })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        pendingOutbox,
        failedOutbox,
        events24h: recentOutbox,
        invalidProviderSignatures24h: invalidProviderSignatures,
        providerEvents24h,
        activeSubscriptions,
        failedDeliveries24h
      },
      failedEvents,
      invalidEvents,
      failedDeliveries
    };
  }
}
