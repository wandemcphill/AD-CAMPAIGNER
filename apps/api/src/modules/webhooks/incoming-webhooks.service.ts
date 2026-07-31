import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

@Injectable()
export class IncomingWebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async list(query: { status?: string; name?: string } = {}) {
    return this.db.eventOutbox.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.name ? { name: query.name } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async detail(id: string) {
    const event = await this.db.eventOutbox.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException("Webhook event was not found.");
    }

    return event;
  }
}
