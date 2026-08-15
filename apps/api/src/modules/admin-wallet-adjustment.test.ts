import { describe, expect, it, vi } from "vitest";

import { ManagedAdsService } from "./managed-ads.service";
import type { PrismaService } from "./prisma.service";

const CONTEXT = { userId: "admin_1", workspaceId: "ws_admin", role: "OWNER" } as never;

function buildDb(existingEntries: Array<Record<string, unknown>> = []) {
  const ledgerCreates: Record<string, unknown>[] = [];
  const auditRows: Record<string, unknown>[] = [];

  const tx = {
    wallet: {
      upsert: vi.fn(() =>
        Promise.resolve({ id: "wallet_1", workspaceId: "ws_target", currency: "NGN" })
      )
    },
    ledgerEntry: {
      findMany: vi.fn(() => Promise.resolve(existingEntries)),
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        ledgerCreates.push(args.data);
        return Promise.resolve({ id: "le_1", ...args.data });
      })
    },
    auditLog: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        auditRows.push(args.data);
        return Promise.resolve({});
      })
    }
  };

  const db = {
    ...tx,
    workspace: {
      findUnique: vi.fn(
        (): Promise<{ id: string; name: string } | null> =>
          Promise.resolve({ id: "ws_target", name: "Target" })
      )
    },
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx))
  };

  return { auditRows, db, ledgerCreates };
}

function buildService(db: unknown) {
  return new ManagedAdsService({ client: db } as unknown as PrismaService, {
    dispatch: vi.fn(),
    enqueue: vi.fn()
  } as never);
}

const validInput = {
  workspaceId: "ws_target",
  direction: "CREDIT" as const,
  amountMinor: 50_000,
  reason: "Goodwill credit for failed order"
};

describe("adminAdjustWallet", () => {
  it("writes a positive CREDIT entry rather than a signed amount", async () => {
    const { db, ledgerCreates } = buildDb();

    await buildService(db).adminAdjustWallet(CONTEXT, validInput);

    expect(ledgerCreates[0]).toMatchObject({ kind: "CREDIT", amountMinor: 50_000 });
    expect(ledgerCreates[0]?.["amountMinor"]).toBeGreaterThan(0);
  });

  it("rejects a negative or zero amount", async () => {
    const { db } = buildDb();
    const service = buildService(db);

    await expect(service.adminAdjustWallet(CONTEXT, { ...validInput, amountMinor: -1 })).rejects.toThrow();
    await expect(service.adminAdjustWallet(CONTEXT, { ...validInput, amountMinor: 0 })).rejects.toThrow();
  });

  it("requires a reason", async () => {
    const { db, ledgerCreates } = buildDb();

    await expect(
      buildService(db).adminAdjustWallet(CONTEXT, { ...validInput, reason: "  " })
    ).rejects.toThrow(/reason is required/i);
    expect(ledgerCreates).toHaveLength(0);
  });

  it("rejects an unknown direction", async () => {
    const { db } = buildDb();

    await expect(
      buildService(db).adminAdjustWallet(CONTEXT, { ...validInput, direction: "REVERSAL" as never })
    ).rejects.toThrow(/CREDIT or DEBIT/);
  });

  it("refuses to debit a wallet below its available balance", async () => {
    const { db, ledgerCreates } = buildDb([
      { id: "le_0", kind: "CREDIT", amountMinor: 1_000, currency: "NGN" }
    ]);

    await expect(
      buildService(db).adminAdjustWallet(CONTEXT, {
        ...validInput,
        direction: "DEBIT",
        amountMinor: 5_000
      })
    ).rejects.toThrow(/insufficient/i);
    expect(ledgerCreates).toHaveLength(0);
  });

  it("allows a debit within the available balance", async () => {
    const { db, ledgerCreates } = buildDb([
      { id: "le_0", kind: "CREDIT", amountMinor: 10_000, currency: "NGN" }
    ]);

    await buildService(db).adminAdjustWallet(CONTEXT, {
      ...validInput,
      direction: "DEBIT",
      amountMinor: 5_000
    });

    expect(ledgerCreates[0]).toMatchObject({ kind: "DEBIT", amountMinor: 5_000 });
  });

  it("rejects an unknown workspace before touching any wallet", async () => {
    const { db, ledgerCreates } = buildDb();
    db.workspace.findUnique = vi.fn(() => Promise.resolve(null));

    await expect(buildService(db).adminAdjustWallet(CONTEXT, validInput)).rejects.toThrow(/not found/i);
    expect(ledgerCreates).toHaveLength(0);
  });

  it("records the operator, the reason and the target workspace", async () => {
    const { auditRows, db } = buildDb();

    await buildService(db).adminAdjustWallet(CONTEXT, validInput);

    expect(auditRows[0]).toMatchObject({
      action: "wallet.adjustment_credit",
      actorUserId: "admin_1",
      entityType: "LedgerEntry"
    });
    expect(auditRows[0]?.["metadata"]).toMatchObject({
      reason: validInput.reason,
      targetWorkspaceId: "ws_target"
    });
  });

  it("carries the caller's idempotency key so a retry cannot double-pay", async () => {
    const { db, ledgerCreates } = buildDb();

    await buildService(db).adminAdjustWallet(CONTEXT, {
      ...validInput,
      idempotencyKey: "adj_abc123"
    });

    expect(ledgerCreates[0]?.["idempotencyKey"]).toBe("adj_abc123");
  });
});
