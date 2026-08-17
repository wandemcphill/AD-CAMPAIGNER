/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest asymmetric matchers are typed as any. */
import { BadRequestException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { InvoicesService } from "./invoices.service";

const ctx = { userId: "user_1", workspaceId: "workspace_1" };

function buildService(db: Record<string, unknown>) {
  return new InvoicesService({ client: db } as unknown as PrismaService);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

  it("routes USD invoice checkout through Payscribe in live mode", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "live");
    vi.stubEnv("PAYSCRIBE_API_KEY", "ps_sk_live_test");
    vi.stubEnv("PAYSCRIBE_BASE_URL", "https://sandbox.payscribe.ng/api/v1");
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: true,
            message: {
              details: {
                id: "link_1",
                ref: "psc_ref_1",
                url: "https://pay.payscribe.ng/link_1",
                status: "active"
              }
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    vi.stubGlobal("fetch", fetcher);

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

    const result = await service.initiatePayment("inv_1", {}, undefined);

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sandbox.payscribe.ng/api/v1/links/");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer ps_sk_live_test");
    expect(JSON.parse(init.body as string)).toMatchObject({
      currency: "USD",
      amount: 2500,
      customer: { name: "Acme Inc.", email: "billing@acme.test" }
    });
    expect(db.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentProvider: "PAYSCRIBE", paymentReference: "psc_ref_1" })
      })
    );
    expect(result.checkoutUrl).toBe("https://pay.payscribe.ng/link_1");
  });

  it("marks a Payscribe-paid invoice from a signed webhook", async () => {
    vi.stubEnv("PAYSCRIBE_WEBHOOK_SECRET", "secret");
    const rawBody = JSON.stringify({
      event: "payment_link.paid",
      ref: "psc_ref_1",
      amount: 2500,
      currency: "USD"
    });
    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", "secret").update(rawBody).digest("hex");
    const eventOutboxFindUnique = vi.fn(() => Promise.resolve(null));
    const db = {
      eventOutbox: {
        findUnique: eventOutboxFindUnique,
        upsert: vi.fn(() => Promise.resolve({})),
        update: vi.fn(() => Promise.resolve({}))
      },
      invoice: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "inv_1",
            workspaceId: "workspace_1",
            status: "SENT",
            totalMinor: 2500,
            currency: "USD",
            paymentReference: "psc_ref_1"
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      }
    };
    const service = buildService(db);

    await service.handlePayscribeWebhook(JSON.parse(rawBody), rawBody, { signature });

    expect(db.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv_1" },
      data: {
        status: "PAID",
        paidAt: expect.any(Date),
        amountPaidMinor: 2500,
        paidVia: "payscribe"
      }
    });
  });
});
