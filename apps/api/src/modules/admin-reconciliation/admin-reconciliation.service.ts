import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

const STATUS_VALUES = ["OPEN", "INVESTIGATING", "RESOLVED", "WONT_FIX"] as const;
type ReconciliationStatus = (typeof STATUS_VALUES)[number];

@Injectable()
export class AdminReconciliationService {
  constructor(private readonly db: PrismaService) {}

  async list(status?: ReconciliationStatus) {
    const [exceptions, grouped] = await Promise.all([
      this.db.financialReconciliationException.findMany({
        where: status ? { status } : { status: { in: ["OPEN", "INVESTIGATING"] } },
        orderBy: { createdAt: "desc" },
        take: 200
      }),
      this.db.financialReconciliationException.groupBy({
        by: ["status"],
        _count: { _all: true }
      })
    ]);

    return {
      exceptions,
      counts: Object.fromEntries(grouped.map((row) => [row.status, row._count._all]))
    };
  }

  async get(id: string) {
    const row = await this.db.financialReconciliationException.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Reconciliation exception not found");
    return row;
  }

  async update(id: string, status: ReconciliationStatus, note: string, actorUserId?: string) {
    const existing = await this.db.financialReconciliationException.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Reconciliation exception not found");

    const trimmed = note.trim();
    if (trimmed.length < 3) {
      throw new BadRequestException("A reconciliation note of at least 3 characters is required.");
    }

    const resolved = status === "RESOLVED" || status === "WONT_FIX";
    return this.db.financialReconciliationException.update({
      where: { id },
      data: {
        status,
        resolutionNote: trimmed,
        ...(resolved
          ? { resolvedAt: new Date(), ...(actorUserId ? { resolvedByUserId: actorUserId } : {}) }
          : { resolvedAt: null, resolvedByUserId: null })
      }
    });
  }
}
