/* Hand-rolled Prisma doubles are intentionally loose here. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it, vi } from "vitest";

import { FinancialReconciliationService } from "./financial-reconciliation.service";
import type { PrismaService } from "../prisma.service";

const EXCEPTION = {
  id: "exc_1",
  workspaceId: "ws_1",
  resourceType: "RemittanceTransfer",
  resourceId: "rt_1",
  kind: "AMBIGUOUS_PROVIDER_RESULT",
  providerName: "fincra",
  status: "OPEN"
};

function buildDb(existing: Record<string, unknown> | null = EXCEPTION) {
  const auditRows: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const db = {
    financialReconciliationException: {
      findMany: vi.fn(() => Promise.resolve([EXCEPTION])),
      groupBy: vi.fn(() => Promise.resolve([{ status: "OPEN", _count: { _all: 3 } }])),
      findUnique: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn((args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return Promise.resolve({ ...EXCEPTION, ...args.data });
      })
    },
    auditLog: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        auditRows.push(args.data);
        return Promise.resolve({});
      })
    }
  };

  return { auditRows, db, updates };
}

function buildService(db: unknown) {
  return new FinancialReconciliationService({ client: db } as unknown as PrismaService);
}

describe("FinancialReconciliationService.list", () => {
  it("defaults to the actionable queue rather than the full history", async () => {
    const { db } = buildDb();

    await buildService(db).list();

    expect(db.financialReconciliationException.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["OPEN", "INVESTIGATING"] } })
      })
    );
  });

  it("can surface closed exceptions when asked", async () => {
    const { db } = buildDb();

    await buildService(db).list({ status: "RESOLVED" });

    expect(db.financialReconciliationException.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "RESOLVED" }) })
    );
  });

  it("caps the page size", async () => {
    const { db } = buildDb();

    await buildService(db).list({ limit: 10_000 });

    expect(db.financialReconciliationException.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    );
  });
});

describe("FinancialReconciliationService.setStatus", () => {
  it("closes an exception and records who closed it and why", async () => {
    const { auditRows, db, updates } = buildDb();

    await buildService(db).setStatus("exc_1", "RESOLVED", "admin_1", "Provider confirmed settled");

    expect(updates[0]).toMatchObject({
      status: "RESOLVED",
      resolvedByUserId: "admin_1",
      resolutionNote: "Provider confirmed settled"
    });
    expect(updates[0]?.["resolvedAt"]).toBeInstanceOf(Date);
    expect(auditRows[0]).toMatchObject({
      action: "financial_reconciliation.resolved",
      entityType: "FinancialReconciliationException",
      entityId: "exc_1"
    });
    expect(auditRows[0]?.["metadata"]).toMatchObject({ previousStatus: "OPEN" });
  });

  it("clears resolvedAt when an exception is reopened for investigation", async () => {
    const { db, updates } = buildDb({ ...EXCEPTION, status: "RESOLVED" });

    await buildService(db).setStatus("exc_1", "INVESTIGATING", "admin_1", "Reopening, amounts differ");

    expect(updates[0]).toMatchObject({ status: "INVESTIGATING", resolvedAt: null });
  });

  it("requires a note", async () => {
    const { db, updates } = buildDb();

    await expect(
      buildService(db).setStatus("exc_1", "RESOLVED", "admin_1", " ")
    ).rejects.toThrow(/note is required/i);
    expect(updates).toHaveLength(0);
  });

  it("rejects an unknown status", async () => {
    const { db, updates } = buildDb();

    await expect(
      buildService(db).setStatus("exc_1", "CLOSED" as never, "admin_1", "note here")
    ).rejects.toThrow(/status must be one of/i);
    expect(updates).toHaveLength(0);
  });

  it("404s an unknown exception", async () => {
    const { db } = buildDb(null);

    await expect(
      buildService(db).setStatus("nope", "RESOLVED", "admin_1", "note here")
    ).rejects.toThrow(/not found/i);
  });
});
