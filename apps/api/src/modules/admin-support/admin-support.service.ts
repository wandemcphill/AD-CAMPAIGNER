import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

@Injectable()
export class AdminSupportService {
  constructor(private readonly db: PrismaService) {}

  async overview() {
    const [statuses, priorities, oldestOpen, recent] = await Promise.all([
      this.db.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.supportTicket.groupBy({ by: ["priority"], _count: { _all: true } }),
      this.db.supportTicket.findFirst({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, subject: true, priority: true, status: true, createdAt: true }
      }),
      this.db.supportTicket.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, subject: true, priority: true, status: true, workspaceId: true, createdAt: true, updatedAt: true }
      })
    ]);

    const status = Object.fromEntries(statuses.map((row) => [row.status, row._count._all]));
    const priority = Object.fromEntries(priorities.map((row) => [row.priority, row._count._all]));

    return {
      totals: {
        open: status.OPEN ?? 0,
        inProgress: status.IN_PROGRESS ?? 0,
        resolved: status.RESOLVED ?? 0,
        closed: status.CLOSED ?? 0,
        urgentOpen: (priority.URGENT ?? 0) - 0
      },
      oldestOpen,
      recent
    };
  }
}
