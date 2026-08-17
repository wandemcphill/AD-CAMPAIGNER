/* eslint-disable @typescript-eslint/unbound-method -- expect(mock.method) is the vitest pattern used in API service tests. */
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { InvoicesService } from "./invoices.service";

const ctx = { userId: "user_1", workspaceId: "workspace_1" };

function buildService(db: Record<string, unknown>) {
  return new InvoicesService({ client: db } as unknown as PrismaService);
}

describe("InvoicesService currency handling", () => {
  it("creates USD invoices explicitly", async () => {
    const db = {
      invoice: {
        count: vi.fn(() => Promise.resolve(0)),
        create: vi.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: "inv_1",
            number: "INV-0001",
            status: "DRAFT",
            customerName: args.data.customerName,
            customerEmail: args.data.customerEmail,
            currency: args.data.currency,
            subtotalMinor: args.data.subtotalMinor,
            totalMinor: args.data.totalMinor,
            amountPaidMinor: 0,
            notes: args.data.notes,
            issuedAt: null,
            dueAt: args.data.dueAt,
            paidAt: null,
            createdAt: new Date("2026-08-17T00:00:00.000Z"),
            lineItems: [
              {
                id: "line_1",
                description: "Consulting",
                quantity: 2,
                unitPriceMinor: 1500,
                amountMinor: 3000
              }
            ]
          })
        )
      }
    };
    const service = buildService(db);

    const invoice = await service.create(ctx, {
      customerName: "Acme Inc.",
      currency: "usd",
      lineItems: [{ description: "Consulting", quantity: 2, unitPriceMinor: 1500 }]
    });

    expect(invoice.currency).toBe("USD");
    expect(invoice.totalMinor).toBe(3000);
    expect(db.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: "USD" })
      })
    );
  });

  it("rejects unsupported invoice currencies before persistence", async () => {
    const db = {
      invoice: {
        count: vi.fn(),
        create: vi.fn()
      }
    };
    const service = buildService(db);

    await expect(
      service.create(ctx, {
        customerName: "Acme Inc.",
        currency: "EUR",
        lineItems: [{ description: "Consulting", quantity: 1, unitPriceMinor: 1500 }]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.invoice.count).not.toHaveBeenCalled();
    expect(db.invoice.create).not.toHaveBeenCalled();
  });

  it("passes USD invoice amount and customer name to the payment gateway", async () => {
    const db = {
      invoice: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "inv_1",
            workspaceId: "workspace_1",
            status: "SENT",
            customerName: "Acme Inc.",
            customerEmail: "billing@acme.test",
            totalMinor: 2500,
            currency: "USD",
            paymentReference: null
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      }
    };
    const service = buildService(db);
    const createPaymentIntent = vi.fn(() =>
      Promise.resolve({
        gateway: "KORAPAY",
        providerReference: "kpy_1",
        checkoutUrl: "https://checkout.test/kpy_1"
      })
    );
    (service as unknown as { paymentGateway: { createPaymentIntent: typeof createPaymentIntent } }).paymentGateway = {
      createPaymentIntent
    };

    await service.initiatePayment("inv_1", {}, undefined);

    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: { amountMinor: 2500, currency: "USD" },
        customerEmail: "billing@acme.test",
        customerName: "Acme Inc."
      })
    );
  });
});
