import { describe, expect, it } from "vitest";

import { PlatformService } from "../../../apps/api/src/modules/platform.service";
import { PrismaService } from "../../../apps/api/src/modules/prisma.service";
import { NotificationsService } from "../../../apps/api/src/modules/notifications/notifications.service";
import type { QueueProducerService } from "../../../apps/api/src/modules/queue-producer.service";
import type { AuthenticatedRequestContext } from "../../../apps/api/src/modules/request-context";
import type { DatabaseClient } from "@fliptrybe/database";

const workspace: AuthenticatedRequestContext = {
  workspaceId: "workspace_integration",
  userId: "user_integration"
};

/**
 * In-memory stand-in for the tables this flow touches. A growth order is now
 * persisted and wallet-charged (it used to be pure in-memory state), so the
 * flow needs a wallet, a ledger, a growth-order table and a `$transaction` that
 * just runs its callback. Everything stays in process — vitest.config.ts sets a
 * placeholder DATABASE_URL that no real client could connect to.
 */
function createInMemoryClient() {
  const wallets: Record<string, unknown>[] = [];
  const ledgerEntries: Record<string, unknown>[] = [];
  const growthOrders: Record<string, unknown>[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const db: Record<string, any> = {
    wallet: {
      upsert: async ({ where, create }: any) => {
        const key = where.workspaceId_currency;
        let row = wallets.find(
          (item: any) => item.workspaceId === key.workspaceId && item.currency === key.currency
        );
        if (!row) {
          row = {
            id: nextId("wallet"),
            workspaceId: create.workspaceId,
            currency: create.currency,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          wallets.push(row);
        }
        return row;
      },
      findFirst: async ({ where }: any) =>
        wallets.find(
          (item: any) => item.workspaceId === where.workspaceId && item.currency === where.currency
        ) ?? null
    },
    ledgerEntry: {
      upsert: async ({ where, create }: any) => {
        if (where.idempotencyKey) {
          const existing = ledgerEntries.find(
            (item: any) => item.idempotencyKey === where.idempotencyKey
          );
          if (existing) return existing;
        }
        const row = { id: nextId("ledger"), createdAt: new Date(), updatedAt: new Date(), ...create };
        ledgerEntries.push(row);
        return row;
      },
      create: async ({ data }: any) => {
        const row = { id: nextId("ledger"), createdAt: new Date(), updatedAt: new Date(), ...data };
        ledgerEntries.push(row);
        return row;
      },
      findMany: async () => ledgerEntries
    },
    growthOrder: {
      create: async ({ data }: any) => {
        const row = {
          quantityDelivered: 0,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data
        };
        growthOrders.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row: any = growthOrders.find((item: any) => item.id === where.id);
        if (!row) throw new Error(`growthOrder.update: no row with id ${String(where.id)}`);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      findUnique: async ({ where }: any) => {
        if (where.idempotencyKey) {
          return (
            growthOrders.find((item: any) => item.idempotencyKey === where.idempotencyKey) ?? null
          );
        }
        return growthOrders.find((item: any) => item.id === where.id) ?? null;
      },
      findFirst: async () => null,
      findMany: async () => growthOrders
    },
    // No admin has overridden any catalog entry — what a fresh database returns.
    growthServiceOverride: {
      findMany: async () => []
    },
    $transaction: async (fn: (tx: Record<string, any>) => Promise<unknown>) => fn(db),
    $disconnect: async () => {}
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return db;
}

/** Credits the workspace wallet so the growth order has funds to charge. */
async function fundWallet(db: ReturnType<typeof createInMemoryClient>, amountMinor: number) {
  const wallet = await db.wallet.upsert({
    where: { workspaceId_currency: { workspaceId: workspace.workspaceId, currency: "NGN" } },
    update: {},
    create: { workspaceId: workspace.workspaceId, currency: "NGN" }
  });
  await db.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      kind: "CREDIT",
      amountMinor,
      currency: "NGN",
      reference: "integration_test_funding",
      description: "Integration test wallet funding",
      sourceType: "Test",
      sourceId: "seed"
    }
  });
}

describe("core API service flow", () => {
  it("runs campaign, SMM, analytics, and support foundations", async () => {
    const db = createInMemoryClient();
    await fundWallet(db, 10_000_000);

    const prisma = new PrismaService(db as unknown as DatabaseClient);
    const notifications = new NotificationsService(prisma, {} as unknown as QueueProducerService);
    const service = new PlatformService(prisma, notifications);
    const campaign = await service.createCampaign(workspace, { destinationKind: "TIKTOK_LIVE" });
    const growth = await service.createGrowthOrder(workspace, {
      serviceCode: "tiktok-views",
      quantity: 100,
      destinationUrl: "https://www.tiktok.com/@fliptrybe/video/integration",
      idempotencyKey: "integration-test-growth-order"
    });
    const ticket = service.createSupportTicket(workspace, { subject: "Need review" });
    const { metrics } = await service.getAnalyticsOverview(workspace);

    expect(campaign.status).toBe("QUEUED");
    expect(growth.order.status).toBeDefined();
    expect(ticket.status).toBe("OPEN");
    expect(metrics).toHaveLength(4);
  });
});
