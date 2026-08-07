import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GuestTransaction } from "@fliptrybe/database";
import type { PrismaService } from "../prisma.service";
import { GuestCheckoutService } from "./guest-checkout.service";

/**
 * End-to-end (no real DB / no real network) coverage of the full guest flow:
 * checkout -> payment intent -> webhook -> fulfilment -> receipt. Exercises the real
 * GuestCheckoutService methods in sequence against a single in-memory Prisma fake, and
 * stubs `fetch` for the ClubKonnect adapter instead of mocking any GuestCheckoutService
 * internals — this is what actually proves the pieces integrate, not just each unit.
 */

function makeInMemoryPrisma() {
  const store: GuestTransaction[] = [];
  const outbox = new Map<string, { processedAt: Date | null }>();

  interface GuestTransactionWhere {
    requestIpAddress?: string;
    createdAt?: unknown;
    OR?: Array<{ email?: string; phone?: string }>;
    paymentStatus?: string;
    fulfilmentStatus?: string;
    email?: string;
    phone?: string;
    reference?: string;
    providerReference?: string;
  }

  function matches(t: GuestTransaction, where?: GuestTransactionWhere): boolean {
    if (!where) return true;
    if (where.OR) return where.OR.some((c) => (c.email && t.email === c.email) || (c.phone && t.phone === c.phone));
    if (where.requestIpAddress && t.requestIpAddress !== where.requestIpAddress) return false;
    if (where.paymentStatus && t.paymentStatus !== where.paymentStatus) return false;
    if (where.fulfilmentStatus && t.fulfilmentStatus !== where.fulfilmentStatus) return false;
    if (where.email && t.email !== where.email) return false;
    if (where.phone && t.phone !== where.phone) return false;
    if (where.reference && t.reference !== where.reference) return false;
    if (where.providerReference && t.providerReference !== where.providerReference) return false;
    return true;
  }

  const guestTransaction = {
    findMany: vi.fn((args: { where?: GuestTransactionWhere }) => Promise.resolve(store.filter((t) => matches(t, args?.where)))),
    count: vi.fn((args: { where?: GuestTransactionWhere }) => Promise.resolve(store.filter((t) => matches(t, args?.where)).length)),
    findUnique: vi.fn((args: { where: { idempotencyKey?: string; reference?: string; id?: string } }) => {
      const w = args.where;
      if (w.idempotencyKey) return Promise.resolve(store.find((t) => t.idempotencyKey === w.idempotencyKey) ?? null);
      if (w.reference) return Promise.resolve(store.find((t) => t.reference === w.reference) ?? null);
      if (w.id) return Promise.resolve(store.find((t) => t.id === w.id) ?? null);
      return Promise.resolve(null);
    }),
    findFirst: vi.fn((args: { where: { paymentReference?: string } }) =>
      Promise.resolve(store.find((t) => t.paymentReference === args.where.paymentReference) ?? null)
    ),
    findUniqueOrThrow: vi.fn((args: { where: { id: string } }) => {
      const found = store.find((t) => t.id === args.where.id);
      if (!found) throw new Error("not found");
      return Promise.resolve(found);
    }),
    create: vi.fn((args: { data: Partial<GuestTransaction> }) => {
      const record = {
        id: `id_${store.length + 1}`,
        paymentStatus: "PENDING",
        fulfilmentStatus: "PENDING",
        attemptCount: 0,
        providerReference: null,
        failureReason: null,
        paymentReference: null,
        paymentProvider: null,
        paymentMethod: null,
        receiptEmailedAt: null,
        migratedToUserId: null,
        migratedAt: null,
        requestIpAddress: null,
        requestUserAgent: null,
        phone: null,
        currency: "NGN",
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data
      } as GuestTransaction;
      store.push(record);
      return Promise.resolve(record);
    }),
    update: vi.fn((args: { where: { id: string }; data: Record<string, unknown> }) => {
      const record = store.find((t) => t.id === args.where.id);
      if (!record) throw new Error("not found");
      Object.assign(record, args.data);
      return Promise.resolve(record);
    }),
    updateMany: vi.fn(() => Promise.resolve({ count: 0 }))
  };

  const eventOutbox = {
    findUnique: vi.fn((args: { where: { idempotencyKey: string } }) =>
      Promise.resolve(outbox.get(args.where.idempotencyKey) ?? null)
    ),
    upsert: vi.fn((args: { where: { idempotencyKey: string } }) => {
      if (!outbox.has(args.where.idempotencyKey)) outbox.set(args.where.idempotencyKey, { processedAt: null });
      return Promise.resolve(outbox.get(args.where.idempotencyKey));
    }),
    update: vi.fn((args: { where: { idempotencyKey: string }; data: { processedAt?: Date } }) => {
      const row = outbox.get(args.where.idempotencyKey);
      if (row) row.processedAt = args.data.processedAt ?? new Date();
      return Promise.resolve(row);
    })
  };

  return { prisma: { client: { guestTransaction, eventOutbox } } as unknown as PrismaService, store };
}

function paymentReferenceOf(payment: unknown): string {
  const value = (payment as { paymentReference?: unknown } | undefined)?.paymentReference;
  return typeof value === "string" ? value : "";
}

function stubClubKonnectFetch(outcome: "success" | "failure") {
  const response =
    outcome === "success"
      ? { statuscode: 200, status: "ORDER_COMPLETED", orderid: "CK123" }
      : { statuscode: 400, status: "ORDER_ERROR", remark: "Insufficient provider balance" };

  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(response))
      })
    )
  );
}

describe("GuestCheckoutService integration: checkout -> payment -> webhook -> fulfilment", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "";
    delete process.env.KORAPAY_WEBHOOK_SECRET;
    process.env.CLUBKONNECT_USER_ID = "test-user";
    process.env.CLUBKONNECT_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("takes a guest airtime purchase from checkout through to a delivered, receipted transaction", async () => {
    stubClubKonnectFetch("success");
    const { prisma } = makeInMemoryPrisma();
    const service = new GuestCheckoutService(prisma);

    const created = await service.checkout(
      { productType: "AIRTIME", email: "guest@example.com", network: "MTN", msisdn: "08011112222", amountMinor: 50000 },
      { ipAddress: "1.2.3.4" }
    );
    expect(created.paymentStatus).toBe("PENDING");
    expect(created.fulfilmentStatus).toBe("PENDING");

    const payment = await service.initiatePayment(created.reference, undefined, {});
    const paymentReference = paymentReferenceOf(payment);
    expect(paymentReference).toBeTruthy();

    // The mock payment gateway always reports COMPLETED, so the webhook should mark the
    // transaction PAID and drive fulfilment through to DELIVERED in one call.
    const webhookResult = await service.handleKorapayWebhook(
      { event: "charge.success", data: { reference: paymentReference, status: "success" } },
      undefined
    );
    expect(webhookResult).toMatchObject({ accepted: true, matched: true });

    const receipt = await service.getReceipt(created.reference);
    expect(receipt.paymentStatus).toBe("PAID");
    expect(receipt.fulfilmentStatus).toBe("DELIVERED");
    expect(receipt.providerReference).toBe(created.reference);

    const status = await service.getStatus(created.reference);
    expect(status.paymentStatus).toBe("PAID");
    expect(status.fulfilmentStatus).toBe("DELIVERED");
  });

  it("marks fulfilment FAILED when the provider declines, and recovers it via admin retry", async () => {
    stubClubKonnectFetch("failure");
    const { prisma } = makeInMemoryPrisma();
    const service = new GuestCheckoutService(prisma);

    const created = await service.checkout(
      { productType: "AIRTIME", email: "guest2@example.com", network: "MTN", msisdn: "08011112222", amountMinor: 50000 },
      {}
    );
    const payment = await service.initiatePayment(created.reference, undefined, {});

    await service.handleKorapayWebhook(
      { data: { reference: paymentReferenceOf(payment), status: "success" } },
      undefined
    );

    const afterFailure = await service.getReceipt(created.reference);
    expect(afterFailure.paymentStatus).toBe("PAID");
    expect(afterFailure.fulfilmentStatus).toBe("FAILED");

    // Operator fixes the provider outage, then retries — same reference, no new charge.
    stubClubKonnectFetch("success");
    const retried = await service.retryFulfilment(created.reference);
    expect(retried.fulfilmentStatus).toBe("DELIVERED");
  });

  it("does not double-fulfil when the same webhook event is replayed", async () => {
    stubClubKonnectFetch("success");
    const { prisma } = makeInMemoryPrisma();
    const service = new GuestCheckoutService(prisma);

    const created = await service.checkout(
      { productType: "AIRTIME", email: "guest3@example.com", network: "MTN", msisdn: "08011112222", amountMinor: 50000 },
      {}
    );
    const payment = await service.initiatePayment(created.reference, undefined, {});
    const webhookBody = { event: "charge.success", data: { reference: paymentReferenceOf(payment), status: "success" } };

    const first = await service.handleKorapayWebhook(webhookBody, undefined);
    const second = await service.handleKorapayWebhook(webhookBody, undefined);

    expect(first).toMatchObject({ accepted: true });
    expect((first as { duplicate?: boolean }).duplicate).toBeFalsy();
    expect(second).toMatchObject({ accepted: true, duplicate: true });

    const receipt = await service.getReceipt(created.reference);
    expect(receipt.fulfilmentStatus).toBe("DELIVERED");
  });

  it("surfaces a paid-but-unfulfilled transaction to the admin retry queue and clears it on success", async () => {
    stubClubKonnectFetch("failure");
    const { prisma } = makeInMemoryPrisma();
    const service = new GuestCheckoutService(prisma);

    const created = await service.checkout(
      { productType: "AIRTIME", email: "guest4@example.com", network: "MTN", msisdn: "08011112222", amountMinor: 50000 },
      {}
    );
    const payment = await service.initiatePayment(created.reference, undefined, {});
    await service.handleKorapayWebhook({ data: { reference: paymentReferenceOf(payment), status: "success" } }, undefined);

    const failedList = await service.adminList({ fulfilmentStatus: "FAILED" });
    expect(failedList.items.map((t) => t.reference)).toContain(created.reference);

    stubClubKonnectFetch("success");
    await service.retryFulfilment(created.reference);

    const clearedList = await service.adminList({ fulfilmentStatus: "FAILED" });
    expect(clearedList.items.map((t) => t.reference)).not.toContain(created.reference);
  });
});
