import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@fliptrybe/database";
import {
  createKorapayPaymentGateway,
  createMockPaymentGateway,
  type PaymentGatewayAdapter
} from "@fliptrybe/providers";
import type { CurrencyCode } from "@fliptrybe/types";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { CreatePaymentLinkDto, PayPaymentLinkDto } from "./payment-links.dtos";

type PaymentLink = Prisma.PaymentLinkGetPayload<Record<string, never>>;
type PaymentLinkPayment = Prisma.PaymentLinkPaymentGetPayload<Record<string, never>>;

// Same pattern as guest-checkout.service.ts's getGuestPaymentGateway(): live Korapay
// when configured for live mode, mock otherwise. Kept as a standalone factory (not a
// DI-wired module) to mirror that established convention in this codebase.
function getPaymentLinkGateway(): PaymentGatewayAdapter {
  const korapaySecret = process.env.KORAPAY_SECRET_KEY;
  if (process.env.PAYMENT_PROVIDER === "live" && korapaySecret) {
    return createKorapayPaymentGateway({
      publicKey: process.env.KORAPAY_PUBLIC_KEY,
      secretKey: korapaySecret,
      encryptionKey: process.env.KORAPAY_ENCRYPTION_KEY,
      baseUrl: process.env.KORAPAY_BASE_URL,
      defaultRedirectUrl: process.env.KORAPAY_REDIRECT_URL ?? process.env.APP_URL,
      defaultWebhookUrl:
        process.env.KORAPAY_WEBHOOK_URL_PAYMENT_LINK ??
        `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay-payment-link`
    });
  }
  return createMockPaymentGateway();
}

function verifyPaymentLinkKorapaySignature(input: { body: unknown; signature?: string | undefined }): boolean {
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

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

function requireWorkspaceId(context: AuthenticatedRequestContext) {
  const workspaceId = context.workspaceId;
  if (!workspaceId) {
    throw new BadRequestException("A workspace is required.");
  }
  return workspaceId;
}

@Injectable()
export class PaymentLinksService {
  private readonly logger = new Logger(PaymentLinksService.name);
  private readonly paymentGateway = getPaymentLinkGateway();

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

  // ─── Payment ──────────────────────────────────────────────────────────────

  async initiatePayment(reference: string, input: PayPaymentLinkDto, redirectUrl: string | undefined) {
    const link = await this.db.paymentLink.findFirst({ where: { reference, deletedAt: null } });
    const expired = link?.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;
    if (!link || link.status !== "ACTIVE" || expired) {
      throw new NotFoundException("This payment link is no longer available.");
    }

    let amountMinor = link.amountMinor;
    if (amountMinor === null) {
      const value = Number(input.amountMinor);
      if (!Number.isInteger(value) || value <= 0) {
        throw new BadRequestException("This payment link requires a positive amountMinor.");
      }
      amountMinor = value;
    }

    if (link.collectCustomerInfo && !input.payerEmail) {
      throw new BadRequestException("This payment link requires a payer email.");
    }

    const payerEmail = input.payerEmail?.trim() || "payer@fliptrybe.link";
    const paymentReference = `plkp_${randomBytes(9).toString("base64url")}`;

    const webhookUrl =
      process.env.NODE_ENV === "production"
        ? undefined
        : `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay-payment-link`;

    const intent = await this.paymentGateway.createPaymentIntent({
      amount: { amountMinor, currency: link.currency as CurrencyCode },
      workspaceId: `payment-link:${link.workspaceId}`,
      customerEmail: payerEmail,
      ...(redirectUrl ? { redirectUrl } : {}),
      ...(webhookUrl ? { webhookUrl } : {})
    });

    const payment = await this.db.paymentLinkPayment.create({
      data: {
        paymentLinkId: link.id,
        reference: paymentReference,
        amountMinor,
        currency: link.currency,
        status: "PENDING",
        payerEmail: input.payerEmail?.trim() || null,
        payerName: input.payerName?.trim() || null,
        paymentProvider: intent.gateway,
        paymentReference: intent.providerReference ?? null
      }
    });

    return {
      reference: payment.reference,
      checkoutUrl: intent.checkoutUrl,
      status: payment.status
    };
  }

  // ─── Webhook ──────────────────────────────────────────────────────────────

  async handleKorapayWebhook(body: unknown, signature: string | undefined) {
    if (!verifyPaymentLinkKorapaySignature({ body, signature })) {
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
    const replayKey = `payment-link:webhook:${eventId}:${providerReference}`;

    // Idempotent: a replayed webhook for an event we've already fully processed is a no-op.
    const existingReceipt = await this.db.eventOutbox.findUnique?.({ where: { idempotencyKey: replayKey } });
    if (existingReceipt?.processedAt) {
      return { accepted: true, duplicate: true, reference: providerReference };
    }
    await this.db.eventOutbox.upsert?.({
      where: { idempotencyKey: replayKey },
      update: {},
      create: {
        workspaceId: null,
        name: "PaymentLinkWebhookReceived",
        entityType: "PaymentLinkPayment",
        entityId: providerReference,
        payload: { providerReference, status: typeof data.status === "string" ? data.status : null },
        idempotencyKey: replayKey
      }
    });

    const payment = await this.db.paymentLinkPayment.findFirst({ where: { paymentReference: providerReference } });
    if (!payment) {
      return { accepted: true, matched: false, reference: providerReference };
    }

    // Never trust the webhook payload status alone — re-verify against the gateway
    // before crediting the link (same rule as guest-checkout's handleKorapayWebhook).
    const verified = await this.paymentGateway.verifyPayment(providerReference);

    if (verified.status === "COMPLETED" && payment.status !== "PAID") {
      await this.db.$transaction(async (tx) => {
        await tx.paymentLinkPayment.update({
          where: { id: payment.id },
          data: { status: "PAID", paidAt: new Date() }
        });
        await tx.paymentLink.update({
          where: { id: payment.paymentLinkId },
          data: {
            timesPaid: { increment: 1 },
            totalCollectedMinor: { increment: payment.amountMinor }
          }
        });
      });
    } else if (verified.status === "FAILED" && payment.status !== "PAID") {
      await this.db.paymentLinkPayment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "Payment failed at gateway." }
      });
    }

    await this.db.eventOutbox.update?.({
      where: { idempotencyKey: replayKey },
      data: { status: "PROCESSED", processedAt: new Date() }
    });

    return { accepted: true, matched: true, reference: providerReference };
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
