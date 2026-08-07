import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GuestTransaction } from "@fliptrybe/database";
import type { PrismaService } from "../prisma.service";
import type { VtuService } from "../vtu/vtu.service";
import { GuestCheckoutService } from "./guest-checkout.service";

function makeFakeVtu(overrides: Partial<VtuService> = {}) {
  return {
    listDataPlans: vi.fn(() => Promise.resolve([{ providerPlanId: "1000", costMinor: 41000 }])),
    listCablePackages: vi.fn(() => Promise.resolve([{ packageCode: "dstv-padi", costMinor: 440000 }])),
    listEducationPlans: vi.fn(() => Promise.resolve([{ productCode: "waecdirect", costMinor: 545700 }])),
    ...overrides
  } as unknown as VtuService;
}

type FakeTransaction = GuestTransaction;

function makeFakePrisma(seed: FakeTransaction[] = []) {
  const store: FakeTransaction[] = seed;

  const guestTransaction = {
    findMany: vi.fn((args: { where?: { email?: string; OR?: Array<{ email?: string; phone?: string }> } }) => {
      const where = args?.where;
      const matches = store.filter((t) => {
        if (where?.OR) {
          return where.OR.some((cond) => (cond.email && t.email === cond.email) || (cond.phone && t.phone === cond.phone));
        }
        if (where?.email) return t.email === where.email;
        return true;
      });
      return Promise.resolve(matches);
    }),
    count: vi.fn(() => Promise.resolve(0)),
    findUnique: vi.fn((args: { where: { idempotencyKey?: string; reference?: string; id?: string } }) => {
      const where = args.where;
      if (where.idempotencyKey) return Promise.resolve(store.find((t) => t.idempotencyKey === where.idempotencyKey) ?? null);
      if (where.reference) return Promise.resolve(store.find((t) => t.reference === where.reference) ?? null);
      if (where.id) return Promise.resolve(store.find((t) => t.id === where.id) ?? null);
      return Promise.resolve(null);
    }),
    findFirst: vi.fn((args: { where: { paymentReference?: string } }) => {
      if (args.where.paymentReference) {
        return Promise.resolve(store.find((t) => t.paymentReference === args.where.paymentReference) ?? null);
      }
      return Promise.resolve(store[0] ?? null);
    }),
    findUniqueOrThrow: vi.fn((args: { where: { id: string } }) => {
      const found = store.find((t) => t.id === args.where.id);
      if (!found) throw new Error("not found");
      return Promise.resolve(found);
    }),
    create: vi.fn((args: { data: Partial<FakeTransaction> }) => {
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
      } as FakeTransaction;
      store.push(record);
      return Promise.resolve(record);
    }),
    update: vi.fn((args: { where: { id: string }; data: Partial<FakeTransaction> }) => {
      const record = store.find((t) => t.id === args.where.id);
      if (!record) throw new Error("not found");
      Object.assign(record, args.data);
      return Promise.resolve(record);
    }),
    updateMany: vi.fn(() => Promise.resolve({ count: 0 }))
  };

  const eventOutbox = {
    findUnique: vi.fn(() => Promise.resolve(null)),
    upsert: vi.fn(() => Promise.resolve({})),
    update: vi.fn(() => Promise.resolve({}))
  };

  return { prisma: { client: { guestTransaction, eventOutbox } } as unknown as PrismaService, store };
}

describe("GuestCheckoutService", () => {
  beforeEach(() => {
    process.env.PAYMENT_PROVIDER = "";
    process.env.NODE_ENV = "test";
  });

  it("rejects checkout without a valid email", async () => {
    const { prisma } = makeFakePrisma();
    const service = new GuestCheckoutService(prisma);

    await expect(
      service.checkout(
        { productType: "AIRTIME", email: "not-an-email", network: "MTN", msisdn: "08011112222", amountMinor: 50000 },
        {}
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an unsupported network", async () => {
    const { prisma } = makeFakePrisma();
    const service = new GuestCheckoutService(prisma);

    await expect(
      service.checkout(
        {
          productType: "AIRTIME",
          email: "guest@example.com",
          network: "UNKNOWN",
          msisdn: "08011112222",
          amountMinor: 50000
        },
        {}
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a pending guest transaction with masked beneficiary and marked-up amount", async () => {
    const { prisma } = makeFakePrisma();
    const service = new GuestCheckoutService(prisma);

    const result = await service.checkout(
      {
        productType: "AIRTIME",
        email: "guest@example.com",
        network: "MTN",
        msisdn: "08011112222",
        amountMinor: 50000
      },
      { ipAddress: "1.2.3.4" }
    );

    expect(result.idempotent).toBe(false);
    expect(result.paymentStatus).toBe("PENDING");
    expect(result.beneficiary).toBe("0801****222");
    expect(result.amountMinor).toBe(51000); // 2% markup over 50000
  });

  it("replays an identical rapid duplicate request as idempotent instead of double-creating", async () => {
    const { prisma } = makeFakePrisma();
    const service = new GuestCheckoutService(prisma);
    const input = {
      productType: "AIRTIME" as const,
      email: "guest@example.com",
      network: "MTN",
      msisdn: "08011112222",
      amountMinor: 50000,
      idempotencyKey: "fixed-key-1"
    };

    const first = await service.checkout(input, {});
    const second = await service.checkout(input, {});

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.reference).toBe(first.reference);
  });

  it("enforces the max daily transaction count per contact", async () => {
    const seed: FakeTransaction[] = Array.from({ length: 10 }, (_, i) => ({
      id: `seed_${i}`,
      reference: `seed_ref_${i}`,
      idempotencyKey: `seed_idem_${i}`,
      email: "guest@example.com",
      phone: null,
      productType: "AIRTIME",
      provider: "MTN",
      beneficiaryMasked: "0801****222",
      beneficiaryEncrypted: "08011112222",
      amountMinor: 1000,
      currency: "NGN",
      paymentMethod: null,
      paymentProvider: null,
      paymentReference: null,
      paymentStatus: "PENDING",
      fulfilmentStatus: "PENDING",
      providerReference: null,
      failureReason: null,
      attemptCount: 0,
      requestIpAddress: null,
      requestUserAgent: null,
      receiptEmailedAt: null,
      migratedToUserId: null,
      migratedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    const { prisma } = makeFakePrisma(seed);
    const service = new GuestCheckoutService(prisma);

    await expect(
      service.checkout(
        {
          productType: "AIRTIME",
          email: "guest@example.com",
          network: "MTN",
          msisdn: "08011112222",
          amountMinor: 50000
        },
        {}
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException for an unknown reference on status lookup", async () => {
    const { prisma } = makeFakePrisma();
    const service = new GuestCheckoutService(prisma);

    await expect(service.getStatus("does-not-exist")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a webhook with an invalid signature in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.KORAPAY_WEBHOOK_SECRET = "test-secret";
    const { prisma } = makeFakePrisma();
    const service = new GuestCheckoutService(prisma);

    await expect(
      service.handleKorapayWebhook({ data: { reference: "ref_1", status: "success" } }, "bad-signature")
    ).rejects.toBeInstanceOf(BadRequestException);

    process.env.NODE_ENV = "test";
    delete process.env.KORAPAY_WEBHOOK_SECRET;
  });

  it("rejects retrying fulfilment on an unpaid transaction", async () => {
    const seed: FakeTransaction[] = [
      {
        id: "id_1",
        reference: "guest_1",
        idempotencyKey: "idem_1",
        email: "guest@example.com",
        phone: null,
        productType: "AIRTIME",
        provider: "MTN",
        beneficiaryMasked: "0801****222",
        beneficiaryEncrypted: "08011112222",
        amountMinor: 51000,
        currency: "NGN",
        paymentMethod: null,
        paymentProvider: null,
        paymentReference: null,
        paymentStatus: "PENDING",
        fulfilmentStatus: "PENDING",
        providerReference: null,
        failureReason: null,
        attemptCount: 0,
        requestIpAddress: null,
        requestUserAgent: null,
        receiptEmailedAt: null,
        migratedToUserId: null,
        migratedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    const { prisma } = makeFakePrisma(seed);
    const service = new GuestCheckoutService(prisma);

    await expect(service.retryFulfilment("guest_1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prices a DATA purchase from the VTU catalog instead of trusting the client amount", async () => {
    const { prisma } = makeFakePrisma();
    const vtu = makeFakeVtu();
    const service = new GuestCheckoutService(prisma, vtu);

    const result = await service.checkout(
      {
        productType: "DATA",
        email: "guest@example.com",
        network: "MTN",
        msisdn: "08011112222",
        bundleId: "1000",
        amountMinor: 1 // attacker-supplied lowball amount — must be ignored
      },
      {}
    );

    expect(result.amountMinor).toBe(41820); // 2% markup over the catalog's 41000
  });

  it("rejects a DATA purchase for a bundle that is not in the catalog", async () => {
    const { prisma } = makeFakePrisma();
    const vtu = makeFakeVtu();
    const service = new GuestCheckoutService(prisma, vtu);

    await expect(
      service.checkout(
        {
          productType: "DATA",
          email: "guest@example.com",
          network: "MTN",
          msisdn: "08011112222",
          bundleId: "does-not-exist"
        },
        {}
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prices a CABLE purchase from the VTU catalog", async () => {
    const { prisma } = makeFakePrisma();
    const vtu = makeFakeVtu();
    const service = new GuestCheckoutService(prisma, vtu);

    const result = await service.checkout(
      {
        productType: "CABLE",
        email: "guest@example.com",
        cableProvider: "dstv",
        smartCardNumber: "1234567890",
        packageCode: "dstv-padi"
      },
      {}
    );

    expect(result.amountMinor).toBe(448800); // 2% markup over the catalog's 440000
  });

  it("prices an EDUCATION purchase from the VTU catalog without double-applying markup", async () => {
    const { prisma } = makeFakePrisma();
    const vtu = makeFakeVtu();
    const service = new GuestCheckoutService(prisma, vtu);

    const result = await service.checkout(
      {
        productType: "EDUCATION",
        email: "guest@example.com",
        examType: "waecdirect",
        phone: "08011112222"
      },
      {}
    );

    expect(result.amountMinor).toBe(545700); // already marked up by listEducationPlans()
  });
});
