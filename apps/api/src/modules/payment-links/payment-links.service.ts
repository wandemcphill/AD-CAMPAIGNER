import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { CreatePaymentLinkDto } from "./payment-links.dtos";

type PaymentLink = Prisma.PaymentLinkGetPayload<Record<string, never>>;

function requireWorkspaceId(context: AuthenticatedRequestContext) {
  const workspaceId = context.workspaceId;
  if (!workspaceId) {
    throw new BadRequestException("A workspace is required.");
  }
  return workspaceId;
}

@Injectable()
export class PaymentLinksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async list(context: AuthenticatedRequestContext) {
    const workspaceId = requireWorkspaceId(context);
    const links = await this.db.paymentLink.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    return links.map(serializePaymentLink);
  }

  async get(context: AuthenticatedRequestContext, id: string) {
    const workspaceId = requireWorkspaceId(context);
    const link = await this.db.paymentLink.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!link) {
      throw new NotFoundException("Payment link not found.");
    }
    return serializePaymentLink(link);
  }

  async create(context: AuthenticatedRequestContext, input: CreatePaymentLinkDto) {
    const workspaceId = requireWorkspaceId(context);

    const title = input.title?.trim();
    if (!title) {
      throw new BadRequestException("A title is required.");
    }

    let amountMinor: number | null = null;
    if (input.amountMinor !== undefined && input.amountMinor !== null) {
      const value = Number(input.amountMinor);
      if (!Number.isInteger(value) || value <= 0) {
        throw new BadRequestException("Amount must be a positive whole number of minor units, or omitted for a payer-set amount.");
      }
      amountMinor = value;
    }

    let expiresAt: Date | null = null;
    if (input.expiresAt) {
      const parsed = new Date(input.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException("Expiry date is invalid.");
      }
      expiresAt = parsed;
    }

    const reference = `plk_${randomBytes(9).toString("base64url")}`;

    const link = await this.db.paymentLink.create({
      data: {
        workspaceId,
        reference,
        title,
        description: input.description?.trim() || null,
        amountMinor,
        currency: input.currency?.trim() || "NGN",
        collectCustomerInfo: Boolean(input.collectCustomerInfo),
        status: "ACTIVE",
        expiresAt
      }
    });
    return serializePaymentLink(link);
  }

  // Payer-facing resolver for a shared link. Returns only what a payer needs and
  // treats disabled/expired links as not found so their details stay private.
  async resolvePublic(reference: string) {
    const link = await this.db.paymentLink.findFirst({
      where: { reference, deletedAt: null }
    });
    const expired = link?.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;
    if (!link || link.status !== "ACTIVE" || expired) {
      throw new NotFoundException("This payment link is no longer available.");
    }
    return {
      reference: link.reference,
      title: link.title,
      description: link.description,
      amountMinor: link.amountMinor,
      currency: link.currency,
      collectCustomerInfo: link.collectCustomerInfo
    };
  }

  async disable(context: AuthenticatedRequestContext, id: string) {
    const workspaceId = requireWorkspaceId(context);
    const link = await this.db.paymentLink.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!link) {
      throw new NotFoundException("Payment link not found.");
    }
    const updated = await this.db.paymentLink.update({
      where: { id },
      data: { status: "DISABLED" }
    });
    return serializePaymentLink(updated);
  }
}

function serializePaymentLink(link: PaymentLink) {
  return {
    id: link.id,
    reference: link.reference,
    title: link.title,
    description: link.description,
    amountMinor: link.amountMinor,
    currency: link.currency,
    status: link.status,
    collectCustomerInfo: link.collectCustomerInfo,
    timesPaid: link.timesPaid,
    totalCollectedMinor: link.totalCollectedMinor,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    createdAt: link.createdAt?.toISOString() ?? null
  };
}
