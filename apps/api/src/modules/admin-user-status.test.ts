/* Test doubles (hand-rolled Prisma clients, vi.fn() spies) are untyped by
   design — same disable block platform.service.test.ts uses. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it, vi } from "vitest";

import { PlatformService } from "./platform.service";
import type { PrismaService } from "./prisma.service";

const OPERATOR = { userId: "admin_1", workspaceId: "ws_admin" };

function buildDb(user: Record<string, unknown> | null) {
  const auditRows: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const db = {
    user: {
      findUnique: vi.fn(() => Promise.resolve(user)),
      update: vi.fn((args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return Promise.resolve({ id: "user_2", username: "target", ...args.data });
      }),
      findMany: vi.fn(() => Promise.resolve([]))
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
  return new PlatformService({ client: db } as unknown as PrismaService, {
    dispatch: vi.fn(),
    enqueue: vi.fn()
  } as never);
}

const target = {
  id: "user_2",
  status: "ACTIVE",
  isPlatformAdmin: false,
  username: "target"
};

describe("adminSetUserStatus", () => {
  it("suspends an ordinary account and records why", async () => {
    const { auditRows, db, updates } = buildDb(target);

    await buildService(db).adminSetUserStatus("user_2", "SUSPENDED", "Chargeback fraud", OPERATOR);

    expect(updates[0]).toMatchObject({ status: "SUSPENDED" });
    expect(auditRows[0]).toMatchObject({
      action: "user.suspended",
      actorUserId: "admin_1",
      entityType: "User"
    });
    expect(auditRows[0]?.["metadata"]).toMatchObject({
      reason: "Chargeback fraud",
      previousStatus: "ACTIVE"
    });
  });

  it("requires a reason", async () => {
    const { db, updates } = buildDb(target);

    await expect(
      buildService(db).adminSetUserStatus("user_2", "SUSPENDED", "  ", OPERATOR)
    ).rejects.toThrow(/reason is required/i);
    expect(updates).toHaveLength(0);
  });

  it("refuses to suspend the operator's own account", async () => {
    const { db, updates } = buildDb({ ...target, id: "admin_1" });

    await expect(
      buildService(db).adminSetUserStatus("admin_1", "SUSPENDED", "mistake", OPERATOR)
    ).rejects.toThrow(/your own account/i);
    expect(updates).toHaveLength(0);
  });

  it("refuses to suspend another platform admin", async () => {
    const { db, updates } = buildDb({ ...target, isPlatformAdmin: true });

    await expect(
      buildService(db).adminSetUserStatus("user_2", "SUSPENDED", "disagreement", OPERATOR)
    ).rejects.toThrow(/PLATFORM_ADMIN_USERNAMES/);
    expect(updates).toHaveLength(0);
  });

  it("allows reactivating a platform admin", async () => {
    const { db, updates } = buildDb({
      ...target,
      isPlatformAdmin: true,
      status: "SUSPENDED"
    });

    await buildService(db).adminSetUserStatus("user_2", "ACTIVE", "restored", OPERATOR);

    expect(updates[0]).toMatchObject({ status: "ACTIVE" });
  });

  it("rejects DELETED — deletion is not a moderation action", async () => {
    const { db, updates } = buildDb(target);

    await expect(
      buildService(db).adminSetUserStatus("user_2", "DELETED" as never, "cleanup", OPERATOR)
    ).rejects.toThrow(/ACTIVE or SUSPENDED/);
    expect(updates).toHaveLength(0);
  });

  it("404s an unknown user", async () => {
    const { db } = buildDb(null);

    await expect(
      buildService(db).adminSetUserStatus("nope", "SUSPENDED", "reason here", OPERATOR)
    ).rejects.toThrow(/not found/i);
  });
});

describe("adminSearchUsers", () => {
  it("caps the page size", async () => {
    const { db } = buildDb(target);

    const result = await buildService(db).adminSearchUsers({ limit: 5_000 });

    expect(result.limit).toBe(100);
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it("excludes soft-deleted accounts", async () => {
    const { db } = buildDb(target);

    await buildService(db).adminSearchUsers({ q: "ada" });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    );
  });
});
