import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@fliptrybe/database";
import {
  createKorapayPaymentGateway,
  createMockPaymentGateway,
  type PaymentGatewayAdapter
} from "@fliptrybe/providers";
import type { CurrencyCode } from "@fliptrybe/types";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { CreateInvoiceDto, InvoiceLineItemInput, PayInvoiceDto } from "./invoices.dtos";

type InvoiceWithLineItems = Prisma.InvoiceGetPayload<{ include: { lineItems: true } }>;

// Same pattern as payment-links.service.ts's getPaymentLinkGateway(): live Korapay when
// configured for live mode, mock otherwise.
function getInvoiceGateway(): PaymentGatewayAdapter {
  const korapaySecret = process.env.KORAPAY_SECRET_KEY;
  if (process.env.PAYMENT_PROVIDER === "live" && korapaySecret) {
    return createKorapayPaymentGateway({
      publicKey: process.env.KORAPAY_PUBLIC_KEY,
      secretKey: korapaySecret,
      encryptionKey: process.env.KORAPAY_ENCRYPTION_KEY,
      baseUrl: process.env.KORAPAY_BASE_URL,
      defaultRedirectUrl: process.env.KORAPAY_REDIRECT_URL ?? process.env.APP_URL,
      defaultWebhookUrl:
        process.env.KORAPAY_WEBHOOK_URL_INVOICE ??
        `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay-invoice`
    });
  }
  return createMockPaymentGateway();
}

function verifyInvoiceKorapaySignature(input: { body: unknown; signature?: string | undefined }): boolean {
  const signingSecret = process.env.KORAPAY_WEBHOOK_SECRET ?? process.env.KORAPAY_SECRET_KEY;
  if (!signingSecret) {
    return process.env.NODE_ENV !== "production";
  }
  if (!input.signature) return false;

  const body = typeof input.body === "object" && input.body !== null ? (input.body as Record<string, unknown>) : {};
  const signedPayload = JSON.stringify(body.data ?? {});
  const expected = Buffer.from(createHmac("sha256", signingSecret).update(signedPayload).digest("hex"));
  const actual = Buffer.from(input.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function requireWorkspaceId(context: AuthenticatedRequestContext) {
  const workspaceId = context.workspaceId;
  if (!workspaceId) {
    throw new BadRequestException("A workspace is required.");
  }
  return workspaceId;
}

function sanitizeLineItems(items: InvoiceLineItemInput[] | undefined) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestException("An invoice needs at least one line item.");
  }
  return items.map((item) => {
    const description = item.description?.trim();
    const quantity = Number(item.quantity);
    const unitPriceMinor = Number(item.unitPriceMinor);
    if (!description) {
      throw new BadRequestException("Each line item needs a description.");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException("Line item quantity must be a positive whole number.");
    }
    if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
      throw new BadRequestException("Line item price must be a non-negative whole number of minor units.");
    }
    return {
      description,
      quantity,
      unitPriceMinor,
      amountMinor: quantity * unitPriceMinor
    };
  });
}

@Injectable()
export class InvoicesService {
  private readonly paymentGateway = getInvoiceGateway();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async list(context: AuthenticatedRequestContext) {
    const workspaceId = requireWorkspaceId(context);
    const invoices = await this.db.invoice.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { lineItems: true }
    });
    return invoices.map(serializeInvoice);
  }

  async get(context: AuthenticatedRequestContext, id: string) {
    const workspaceId = requireWorkspaceId(context);
    const invoice = await this.db.invoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { lineItems: true }
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }
    return serializeInvoice(invoice);
  }

  async create(context: AuthenticatedRequestContext, input: CreateInvoiceDto) {
    const workspaceId = requireWorkspaceId(context);

    const customerName = input.customerName?.trim();
    if (!customerName) {
      throw new BadRequestException("A customer name is required.");
    }
    const lineItems = sanitizeLineItems(input.lineItems);
    const subtotalMinor = lineItems.reduce((sum, item) => sum + item.amountMinor, 0);
    const currency = input.currency?.trim() || "NGN";

    let dueAt: Date | null = null;
    if (input.dueAt) {
      const parsed = new Date(input.dueAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException("Due date is invalid.");
      }
      dueAt = parsed;
    }

    // Per-workspace sequential number. The @@unique([workspaceId, number]) is the
    // backstop against the rare concurrent-create race.
    const count = await this.db.invoice.count({ where: { workspaceId } });
    const number = `INV-${String(count + 1).padStart(4, "0")}`;

    const invoice = await this.db.invoice.create({
      data: {
        workspaceId,
        number,
        status: "DRAFT",
        customerName,
        customerEmail: input.customerEmail?.trim() || null,
        currency,
        subtotalMinor,
        totalMinor: subtotalMinor,
        notes: input.notes?.trim() || null,
        dueAt,
        lineItems: { create: lineItems }
      },
      include: { lineItems: true }
    });
    return serializeInvoice(invoice);
  }

  async send(context: AuthenticatedRequestContext, id: string) {
    const workspaceId = requireWorkspaceId(context);
    const invoice = await this.db.invoice.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }
    if (invoice.status !== "DRAFT") {
      throw new BadRequestException("Only draft invoices can be sent.");
    }
    const updated = await this.db.invoice.update({
      where: { id },
      data: { status: "SENT", issuedAt: new Date() },
      include: { lineItems: true }
    });
    return serializeInvoice(updated);
  }

  async markPaid(context: AuthenticatedRequestContext, id: string) {
    const workspaceId = requireWorkspaceId(context);
    const invoice = await this.db.invoice.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }
    if (invoice.status === "PAID") {
      const alreadyPaid = await this.db.invoice.findFirst({ where: { id }, include: { lineItems: true } });
      if (!alreadyPaid) {
        throw new NotFoundException("Invoice not found.");
      }
      return serializeInvoice(alreadyPaid);
    }
    if (invoice.status === "VOID") {
      throw new BadRequestException("A void invoice cannot be marked paid.");
    }
    const updated = await this.db.invoice.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date(), amountPaidMinor: invoice.totalMinor, paidVia: "manual" },
      include: { lineItems: true }
    });
    await this.db.auditLog.create({
      data: {
        workspaceId,
        actorUserId: context.userId,
        action: "invoice.marked_paid_manually",
        entityType: "Invoice",
        entityId: id,
        metadata: { amountMinor: invoice.totalMinor, currency: invoice.currency }
      }
    });
    return serializeInvoice(updated);
  }

  // ─── Public payment ─────────────────────────────────────────────────────

  // Payer-facing resolver for a shared invoice link. Unauthenticated; returns only
  // what a payer needs, and treats a deleted invoice as not found.
  async resolvePublic(id: string) {
    const invoice = await this.db.invoice.findFirst({ where: { id, deletedAt: null }, include: { lineItems: true } });
    if (!invoice || invoice.status === "DRAFT") {
      throw new NotFoundException("This invoice is not available.");
    }
    return serializeInvoice(invoice);
  }

  async initiatePayment(id: string, input: PayInvoiceDto, redirectUrl: string | undefined) {
    const invoice = await this.db.invoice.findFirst({ where: { id, deletedAt: null } });
    if (!invoice || invoice.status === "DRAFT") {
      throw new NotFoundException("This invoice is not available.");
    }
    if (invoice.status === "VOID") {
      throw new BadRequestException("A void invoice cannot be paid.");
    }
    if (invoice.status === "PAID") {
      return { reference: invoice.paymentReference, checkoutUrl: null, status: invoice.status, idempotent: true };
    }

    const payerEmail = input.payerEmail?.trim() || invoice.customerEmail || "payer@fliptrybe.link";
    const paymentReference = `invp_${invoice.id}_${Date.now().toString(36)}`;

    const webhookUrl =
      process.env.NODE_ENV === "production"
        ? undefined
        : `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay-invoice`;

    const intent = await this.paymentGateway.createPaymentIntent({
      amount: { amountMinor: invoice.totalMinor, currency: invoice.currency as CurrencyCode },
      workspaceId: `invoice:${invoice.workspaceId}`,
      customerEmail: payerEmail,
      ...(redirectUrl ? { redirectUrl } : {}),
      ...(webhookUrl ? { webhookUrl } : {})
    });

    await this.db.invoice.update({
      where: { id: invoice.id },
      data: { paymentProvider: intent.gateway, paymentReference: intent.providerReference ?? paymentReference }
    });

    return {
      reference: intent.providerReference ?? paymentReference,
      checkoutUrl: intent.checkoutUrl,
      status: invoice.status
    };
  }

  // ─── Webhook ─────────────────────────────────────────────────────────────

  async handleKorapayWebhook(body: unknown, signature: string | undefined) {
    if (!verifyInvoiceKorapaySignature({ body, signature })) {
      throw new BadRequestException("Invalid webhook signature.");
    }

    interface KorapayWebhookBody {
      event?: unknown;
      data?: {
        reference?: unknown;
        payment_reference?: unknown;
        status?: unknown;
        id?: unknown;
      };
    }

    const eventBody: KorapayWebhookBody = typeof body === "object" && body !== null ? body : {};
    const data = typeof eventBody.data === "object" && eventBody.data !== null ? eventBody.data : {};
    const providerReference = data.reference ?? data.payment_reference;
    if (!providerReference || typeof providerReference !== "string") {
      throw new BadRequestException("Webhook is missing a payment reference.");
    }

    const eventId =
      typeof eventBody.event === "string" ? eventBody.event : typeof data.id === "string" ? data.id : providerReference;
    const replayKey = `invoice:webhook:${eventId}:${providerReference}`;

    // Idempotent: a replayed webhook for an event we've already fully processed is a no-op.
    const existingReceipt = await this.db.eventOutbox.findUnique({ where: { idempotencyKey: replayKey } });
    if (existingReceipt?.processedAt) {
      return { accepted: true, duplicate: true, reference: providerReference };
    }
    await this.db.eventOutbox.upsert({
      where: { idempotencyKey: replayKey },
      update: {},
      create: {
        workspaceId: null,
        name: "InvoiceWebhookReceived",
        entityType: "Invoice",
        entityId: providerReference,
        payload: { providerReference, status: typeof data.status === "string" ? data.status : null },
        idempotencyKey: replayKey
      }
    });

    const invoice = await this.db.invoice.findFirst({ where: { paymentReference: providerReference } });
    if (!invoice) {
      return { accepted: true, matched: false, reference: providerReference };
    }

    // Never trust the webhook payload status alone — re-verify against the gateway
    // before marking the invoice paid (same rule as guest-checkout/payment-links).
    const verified = await this.paymentGateway.verifyPayment(providerReference);

    if (verified.status === "COMPLETED" && invoice.status !== "PAID") {
      await this.db.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", paidAt: new Date(), amountPaidMinor: invoice.totalMinor, paidVia: "online" }
      });
    }

    await this.db.eventOutbox.update({
      where: { idempotencyKey: replayKey },
      data: { status: "PROCESSED", processedAt: new Date() }
    });

    return { accepted: true, matched: true, reference: providerReference };
  }

  async void(context: AuthenticatedRequestContext, id: string) {
    const workspaceId = requireWorkspaceId(context);
    const invoice = await this.db.invoice.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }
    if (invoice.status === "PAID") {
      throw new BadRequestException("A paid invoice cannot be voided.");
    }
    const updated = await this.db.invoice.update({
      where: { id },
      data: { status: "VOID", voidedAt: new Date() },
      include: { lineItems: true }
    });
    return serializeInvoice(updated);
  }
}

function serializeInvoice(invoice: InvoiceWithLineItems) {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    currency: invoice.currency,
    subtotalMinor: invoice.subtotalMinor,
    totalMinor: invoice.totalMinor,
    amountPaidMinor: invoice.amountPaidMinor,
    notes: invoice.notes,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt?.toISOString() ?? null,
    lineItems: invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      amountMinor: item.amountMinor
    }))
  };
}
