import { describe, expect, it, vi } from "vitest";

import { PlatformService } from "./platform.service";
import type { PrismaService } from "./prisma.service";

const CONTEXT = { userId: "admin_1", workspaceId: "ws_1", role: "OWNER" } as never;

function buildDb() {
  const auditRows: Record<string, unknown>[] = [];

  const db = {
    auditLog: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        auditRows.push(args.data);
        return Promise.resolve({ id: `al_${auditRows.length}`, ...args.data });
      }),
      findMany: vi.fn(() =>
        Promise.resolve(
          auditRows.map((row, index) => ({
            id: `al_${index + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...row
          }))
        )
      )
    }
  };

  return { auditRows, db };
}

function buildService(db: unknown) {
  return new PlatformService({ client: db } as unknown as PrismaService, {
    dispatch: vi.fn(),
    enqueue: vi.fn()
  } as never);
}

// recordAuditLog is private but is the single funnel every growth money event
// goes through (capture, release, refund), so it is exercised directly here.
function record(service: PlatformService, action: string, entityId: string) {
  (
    service as unknown as {
      recordAuditLog: (input: Record<string, unknown>) => void;
    }
  ).recordAuditLog({
    workspaceId: "ws_1",
    actorUserId: "admin_1",
    action,
    entityType: "GrowthOrder",
    entityId,
    metadata: { amountMinor: 250_000 }
  });
}

describe("growth money events are durably audited", () => {
  it("persists a refund to the AuditLog table, not just memory", async () => {
    const { auditRows, db } = buildDb();
    const service = buildService(db);

    record(service, "growth.refund_recorded", "gro_1");

    // Fire-and-forget write — let the microtask queue drain.
    await Promise.resolve();

    expect(db.auditLog.create).toHaveBeenCalled();
    expect(auditRows[0]).toMatchObject({
      action: "growth.refund_recorded",
      entityType: "GrowthOrder",
      entityId: "gro_1",
      workspaceId: "ws_1",
      actorUserId: "admin_1"
    });
  });

  it("surfaces persisted rows through the audit read path", async () => {
    const { db } = buildDb();
    const service = buildService(db);

    record(service, "growth.refund_recorded", "gro_1");
    await Promise.resolve();

    const logs = await service.listAuditLogsFromStore(CONTEXT);

    expect(logs.some((log) => log.entityId === "gro_1")).toBe(true);
  });

  it("does not double-report an event held in both stores", async () => {
    const { db } = buildDb();
    const service = buildService(db);

    record(service, "growth.refund_recorded", "gro_1");
    await Promise.resolve();

    const logs = await service.listAuditLogsFromStore(CONTEXT);
    const matching = logs.filter(
      (log) => log.entityId === "gro_1" && log.action === "growth.refund_recorded"
    );

    expect(matching).toHaveLength(1);
  });

  it("still records in memory when the audit table write fails", async () => {
    const { db } = buildDb();
    db.auditLog.create.mockImplementationOnce(() => Promise.reject(new Error("db down")));
    const service = buildService(db);

    expect(() => record(service, "growth.refund_recorded", "gro_2")).not.toThrow();
    await Promise.resolve();

    expect(service.listAuditLogs(CONTEXT).some((log) => log.entityId === "gro_2")).toBe(true);
  });
});
