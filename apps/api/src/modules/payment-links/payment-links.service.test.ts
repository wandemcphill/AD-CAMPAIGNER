import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationsService, SendNotificationInput } from "../notifications/notifications.service";
import type { PrismaService } from "../prisma.service";
import { PaymentLinksService } from "./payment-links.service";

type FakeLink = {
  id: string;
  workspaceId: string;
  reference: string;
  title: string;
  description: string | null;
  amountMinor: number | null;
  currency: string;
  status: "ACTIVE" | "DISABLED";
  collectCustomerInfo: boolean;
  timesPaid: number;
  totalCollectedMinor: number;
  expiresAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type FakePayment = {
  id: string;
  paymentLinkId: string;
  reference: string;
  amountMinor: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED";
  payerEmail: string | null;
  payerName: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeFakePrisma(
  linkSeed: Partial<FakeLink> = {},
  opts: { ownerUserId?: string | null } = {}
) {
  const links: FakeLink[] = [
    {
      id: "link_1",
      workspaceId: "ws_1",
      reference: "plk_test",
      title: "Test invoice",
      description: null,
      amountMinor: 100000,
      currency: "NGN",
      status: "ACTIVE",
      collectCustomerInfo: false,
      timesPaid: 0,
      totalCollectedMinor: 0,
      expiresAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...linkSeed
    }
  ];
  const payments: FakePayment[] = [];

  const paymentLink = {
    findFirst: (args: { where: { reference?: string; id?: string } }) => {
      const where = args.where;
      return Promise.resolve(
        links.find((l) => (where.reference ? l.reference === where.reference : l.id === where.id)) ?? null
      );
    },
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(links.find((l) => l.id === args.where.id) ?? null),
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const link = links.find((l) => l.id === args.where.id);
      if (!link) throw new Error("not found");
      for (const [key, value] of Object.entries(args.data)) {
        if (value && typeof value === "object" && "increment" in (value as Record<string, unknown>)) {
          const target = link as unknown as Record<string, number>;
          target[key] = (target[key] ?? 0) + (value as { increment: number }).increment;
        } else {
          (link as unknown as Record<string, unknown>)[key] = value;
        }
      }
      return Promise.resolve(link);
    }
  };

  // One workspace/organization pair matching links[0]'s workspaceId, and one
  // OWNER team member for it -- unless opts.ownerUserId is explicitly null,
  // which simulates the "no OWNER team member" edge case.
  const workspace = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(
        args.where.id === "ws_1" ? { id: "ws_1", organizationId: "org_1", name: "Test Workspace" } : null
      )
  };

  const ownerUserId = opts.ownerUserId === undefined ? "user_owner_1" : opts.ownerUserId;
  const teamMember = {
    findFirst: (args: { where: { organizationId?: string; role?: string } }) =>
      Promise.resolve(
        ownerUserId && args.where.organizationId === "org_1" && args.where.role === "OWNER"
          ? { id: "tm_1", userId: ownerUserId, organizationId: "org_1", role: "OWNER" }
          : null
      )
  };

  const paymentLinkPayment = {
    create: (args: { data: Partial<FakePayment> }) => {
      const record: FakePayment = {
        id: `pay_${payments.length + 1}`,
        status: "PENDING",
        payerEmail: null,
        payerName: null,
        paymentProvider: null,
        paymentReference: null,
        failureReason: null,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data
      } as FakePayment;
      payments.push(record);
      return Promise.resolve(record);
    },
    findFirst: (args: { where: { paymentReference?: string } }) =>
      Promise.resolve(payments.find((p) => p.paymentReference === args.where.paymentReference) ?? null),
    update: (args: { where: { id: string }; data: Partial<FakePayment> }) => {
      const record = payments.find((p) => p.id === args.where.id);
      if (!record) throw new Error("not found");
      Object.assign(record, args.data);
      return Promise.resolve(record);
    }
  };

  const eventOutbox = {
    findUnique: () => Promise.resolve(null as { processedAt: Date | null } | null),
    upsert: () => Promise.resolve({}),
    update: () => Promise.resolve({})
  };

  type FakeClient = {
    paymentLink: typeof paymentLink;
    paymentLinkPayment: typeof paymentLinkPayment;
    eventOutbox: typeof eventOutbox;
    workspace: typeof workspace;
    teamMember: typeof teamMember;
    $transaction: (fn: (tx: FakeClient) => Promise<unknown>) => Promise<unknown>;
  };

  const client: FakeClient = {
    paymentLink,
    paymentLinkPayment,
    eventOutbox,
    workspace,
    teamMember,
    $transaction: async (fn) => fn(client)
  };

  return { prisma: { client } as unknown as PrismaService, links, payments };
}

function buildService(
  prisma: PrismaService,
  notifications: Partial<NotificationsService> = { send: vi.fn(() => Promise.resolve([])) }
) {
  return new PaymentLinksService(prisma, notifications as NotificationsService);
}

describe("PaymentLinksService payments", () => {
  beforeEach(() => {
    process.env.PAYMENT_PROVIDER = "";
    process.env.NODE_ENV = "test";
  });

  it("initiates a payment intent via the mock gateway and returns a checkoutUrl", async () => {
    const { prisma } = makeFakePrisma();
    const service = buildService(prisma);

    const result = await service.initiatePayment("plk_test", {}, undefined);

    expect(result.reference).toBeTruthy();
    expect(result.status).toBe("PENDING");
  });

  it("throws NotFoundException for a disabled link", async () => {
    const { prisma } = makeFakePrisma({ status: "DISABLED" });
    const service = buildService(prisma);

    await expect(service.initiatePayment("plk_test", {}, undefined)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("requires an explicit amount for payer-set-amount links", async () => {
    const { prisma } = makeFakePrisma({ amountMinor: null });
    const service = buildService(prisma);

    await expect(service.initiatePayment("plk_test", {}, undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a webhook with an invalid signature in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.KORAPAY_WEBHOOK_SECRET = "test-secret";
    const { prisma } = makeFakePrisma();
    const service = buildService(prisma);

    await expect(
      service.handleKorapayWebhook({ data: { reference: "ref_1", status: "success" } }, "bad-signature")
    ).rejects.toBeInstanceOf(BadRequestException);

    process.env.NODE_ENV = "test";
    delete process.env.KORAPAY_WEBHOOK_SECRET;
  });

  it("credits the link and marks the payment PAID exactly once, even if the webhook is replayed", async () => {
    const { prisma, links, payments } = makeFakePrisma();
    const send = vi.fn((_input: SendNotificationInput) => Promise.resolve([]));
    const service = buildService(prisma, { send });

    const intent = await service.initiatePayment("plk_test", {}, undefined);
    const payment = payments.find((p) => p.reference === intent.reference)!;
    // Mock gateway always reports COMPLETED for verifyPayment.
    const providerReference = payment.paymentReference!;

    const first = await service.handleKorapayWebhook(
      { event: "charge.success", data: { reference: providerReference, status: "success" } },
      undefined
    );
    expect(first.matched).toBe(true);

    // The owner should be notified exactly once for the real payment.
    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0]?.[0];
    expect(call?.workspaceId).toBe("ws_1");
    expect(call?.userId).toBe("user_owner_1");
    expect(call?.channels).toEqual(["IN_APP", "EMAIL"]);
    expect(call?.template).toBe("payment_link_paid");
    expect(call?.vars).toMatchObject({ service: "Test invoice", currency: "NGN", amount: "1000.00" });

    // Replay the identical webhook — must be a no-op, not a double-credit or a
    // second notification.
    const outbox = (prisma.client as unknown as { eventOutbox: { findUnique: () => Promise<unknown> } }).eventOutbox;
    outbox.findUnique = () => Promise.resolve({ processedAt: new Date() });

    const second = await service.handleKorapayWebhook(
      { event: "charge.success", data: { reference: providerReference, status: "success" } },
      undefined
    );
    expect(second.duplicate).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);

    expect(links[0]!.timesPaid).toBe(1);
    expect(links[0]!.totalCollectedMinor).toBe(100000);
    expect(payments.find((p) => p.reference === intent.reference)!.status).toBe("PAID");
  });

  it("does not notify, and does not throw, when the workspace has no OWNER team member", async () => {
    const { prisma, payments } = makeFakePrisma({}, { ownerUserId: null });
    const send = vi.fn((_input: SendNotificationInput) => Promise.resolve([]));
    const service = buildService(prisma, { send });

    const intent = await service.initiatePayment("plk_test", {}, undefined);
    const payment = payments.find((p) => p.reference === intent.reference)!;

    const result = await service.handleKorapayWebhook(
      { event: "charge.success", data: { reference: payment.paymentReference!, status: "success" } },
      undefined
    );

    expect(result.matched).toBe(true);
    expect(send).not.toHaveBeenCalled();
    // The payment itself must still succeed -- a missing OWNER row is an
    // operator data problem, not a reason to fail the customer's payment.
    expect(payments.find((p) => p.reference === intent.reference)!.status).toBe("PAID");
  });
});
