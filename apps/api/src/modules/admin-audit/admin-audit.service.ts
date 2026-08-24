import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

@Injectable()
export class AdminAuditService {
  constructor(private readonly db: PrismaService) {}

  async list(query: { limit?: number; action?: string; entityType?: string; actorUserId?: string }) {
    const limit = Math.min(500, Math.max(1, query.limit ?? 200));
    const rows = await this.db.auditLog.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      target: `${row.entityType}:${row.entityId}`,
      entityType: row.entityType,
      entityId: row.entityId,
      timestamp: row.createdAt.toISOString(),
      metadata: row.metadata,
      severity: this.severity(row.action),
      description: this.description(row.action, row.entityType, row.entityId)
    }));
  }

  private severity(action: string) {
    const normalized = action.toLowerCase();
    if (
      normalized.includes("disable") ||
      normalized.includes("revoke") ||
      normalized.includes("failed") ||
      normalized.includes("blocked") ||
      normalized.includes("suspend") ||
      normalized.includes("risk")
    ) {
      return "danger" as const;
    }
    if (
      normalized.includes("enable") ||
      normalized.includes("approve") ||
      normalized.includes("resolve") ||
      normalized.includes("complete")
    ) {
      return "success" as const;
    }
    return "info" as const;
  }

  private description(action: string, entityType: string, entityId: string) {
    return `${action} · ${entityType}:${entityId}`;
  }
}
