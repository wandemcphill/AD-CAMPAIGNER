import { describe, expect, it, vi } from "vitest";

import { VouchersService } from "./vouchers.service";
import type { PrismaService } from "../prisma.service";

const EPIN_PRODUCT = {
  id: "airtime-epin-voucher",
  name: "Airtime EPIN Voucher",
  handler: "PROVIDER_EPIN",
  providerServiceId: "airtime-epin",
  denominationsMinor: [10_000, 20_000, 50_000]
};

const CREDIT_PRODUCT = {
  id: "campaign-credit",
  name: "Campaign Credit",
  handler: "WALLET_CREDIT",
  providerServiceId: null,
  denominationsMinor: [500_000]
};

function buildDb(product: Record<string, unknown> | null = EPIN_PRODUCT) {
  const auditRows: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const db = {
    voucherProduct: {
      findUnique: vi.fn(() => Promise.resolve(product)),
      findMany: vi.fn(() => Promise.resolve([product].filter(Boolean))),
      update: vi.fn((args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return Promise.resolve({ ...product, ...args.data });
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
  return new VouchersService(
    { client: db } as unknown as PrismaService,
    { dispatch: vi.fn() } as never,
    { buyAirtimeEpin: vi.fn() } as never
  );
}

const CONTEXT = { userId: "admin_1", workspaceId: "ws_1" } as never;

describe("adminSetDenominations", () => {
  it("stores a sorted, de-duplicated set and records the change", async () => {
    const { auditRows, db, updates } = buildDb();

    await buildService(db).adminSetDenominations("airtime-epin-voucher", [50_000, 10_000, 10_000], CONTEXT);

    expect(updates[0]).toMatchObject({ denominationsMinor: [10_000, 50_000] });
    expect(auditRows[0]).toMatchObject({
      action: "voucher_product.denominations_updated",
      entityType: "VoucherProduct"
    });
    expect(auditRows[0]?.["metadata"]).toMatchObject({ next: [10_000, 50_000] });
  });

  it("rejects a denomination the EPIN providers do not mint", async () => {
    const { db, updates } = buildDb();

    await expect(
      buildService(db).adminSetDenominations("airtime-epin-voucher", [30_000], CONTEXT)
    ).rejects.toThrow(/only mint/i);
    expect(updates).toHaveLength(0);
  });

  it("rejects a negative or fractional denomination", async () => {
    const { db } = buildDb();
    const service = buildService(db);

    await expect(
      service.adminSetDenominations("airtime-epin-voucher", [-100], CONTEXT)
    ).rejects.toThrow(/positive whole/i);
    await expect(
      service.adminSetDenominations("airtime-epin-voucher", [1.5], CONTEXT)
    ).rejects.toThrow(/positive whole/i);
  });

  it("rejects an empty list — a product with no denomination is unsellable", async () => {
    const { db } = buildDb();

    await expect(
      buildService(db).adminSetDenominations("airtime-epin-voucher", [], CONTEXT)
    ).rejects.toThrow(/at least one/i);
  });

  it("requires exactly one denomination for a wallet-credit voucher", async () => {
    const { db, updates } = buildDb(CREDIT_PRODUCT);

    await expect(
      buildService(db).adminSetDenominations("campaign-credit", [100_000, 200_000], CONTEXT)
    ).rejects.toThrow(/exactly one denomination/i);
    expect(updates).toHaveLength(0);
  });

  it("accepts a single denomination for a wallet-credit voucher", async () => {
    const { db, updates } = buildDb(CREDIT_PRODUCT);

    await buildService(db).adminSetDenominations("campaign-credit", [250_000], CONTEXT);

    expect(updates[0]).toMatchObject({ denominationsMinor: [250_000] });
  });

  it("404s an unknown product", async () => {
    const { db } = buildDb(null);

    await expect(
      buildService(db).adminSetDenominations("nope", [10_000], CONTEXT)
    ).rejects.toThrow(/not found/i);
  });
});

describe("listProducts", () => {
  it("publishes the valueMinor enum from the configured denominations", async () => {
    const { db } = buildDb({
      ...EPIN_PRODUCT,
      denominationsMinor: [10_000, 20_000],
      inputSchema: {
        type: "object",
        properties: { network: { type: "string" }, valueMinor: { type: "number" } }
      }
    });
    const service = buildService(db);
    // seedProducts runs first; give it the calls it needs.
    (service as unknown as { seedProducts: () => Promise<void> }).seedProducts = () =>
      Promise.resolve();

    const products = await service.listProducts();
    const schema = products[0]?.inputSchema as Record<string, unknown>;
    const properties = schema["properties"] as Record<string, unknown>;
    const valueMinor = properties["valueMinor"] as { enum?: number[] };

    expect(valueMinor.enum).toEqual([10_000, 20_000]);
  });
});
