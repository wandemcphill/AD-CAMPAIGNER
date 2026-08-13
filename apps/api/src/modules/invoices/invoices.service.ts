import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { CreateInvoiceDto, InvoiceLineItemInput } from "./invoices.dtos";

type DbClient = Record<string, any>;

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db(): DbClient {
    return this.prisma.client as unknown as DbClient;
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
      return serializeInvoice(await this.db.invoice.findFirst({ where: { id }, include: { lineItems: true } }));
    }
    if (invoice.status === "VOID") {
      throw new BadRequestException("A void invoice cannot be marked paid.");
    }
    const updated = await this.db.invoice.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date(), amountPaidMinor: invoice.totalMinor },
      include: { lineItems: true }
    });
    return serializeInvoice(updated);
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

function serializeInvoice(invoice: any) {
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
    lineItems: (invoice.lineItems ?? []).map((item: any) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      amountMinor: item.amountMinor
    }))
  };
}
