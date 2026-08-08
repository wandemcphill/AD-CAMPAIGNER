import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

import {
  Prisma,
  type DatabaseClient,
  type GuestTransaction,
  type GuestPaymentStatus,
  type GuestFulfilmentStatus
} from "@fliptrybe/database";
import {
  createClubKonnectAdapter,
  createKorapayPaymentGateway,
  createMockPaymentGateway,
  type PaymentGatewayAdapter,
  type VtuProviderAdapter,
  type VtuNetwork
} from "@fliptrybe/providers";

import type { CurrencyCode } from "@fliptrybe/types";

import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { VtuService } from "../vtu/vtu.service";
import type { AdminGuestTransactionQueryDto, GuestCheckoutDto } from "./guest-checkout.dtos";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// Same 2% wholesale markup used by the authenticated VTU flow (vtu.service.ts) —
// guest checkout resells the same wholesale product, keep pricing consistent.
const MARKUP_BPS = 200;

// Fraud controls. Deliberately conservative for an unauthenticated flow — a
// registered account can request higher limits through the wallet/VTU path instead.
const MAX_TRANSACTION_AMOUNT_MINOR = 5_000_000; // NGN 50,000
const MAX_DAILY_AMOUNT_MINOR_PER_CONTACT = 10_000_000; // NGN 100,000
const MAX_DAILY_TRANSACTIONS_PER_CONTACT = 10;
const MAX_HOURLY_TRANSACTIONS_PER_IP = 15;
const DUPLICATE_REQUEST_WINDOW_MS = 60_000;

const VTU_NETWORKS: VtuNetwork[] = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];

function applyMarkup(costMinor: number): number {
  return Math.ceil(costMinor * (1 + MARKUP_BPS / 10_000));
}

function mask(value: string): string {
  if (value.length <= 6) return `${value.slice(0, 2)}****`;
  return `${value.slice(0, 4)}****${value.slice(-3)}`;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeAmount(input: unknown, fallback?: number): number {
  const value = input === undefined ? fallback : input;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new BadRequestException("Amount must be a positive minor-unit integer.");
  }
  return amount;
}

function getGuestPaymentGateway(): PaymentGatewayAdapter {
  const korapaySecret = process.env.KORAPAY_SECRET_KEY;
  if (process.env.PAYMENT_PROVIDER === "live" && korapaySecret) {
    return createKorapayPaymentGateway({
      publicKey: process.env.KORAPAY_PUBLIC_KEY,
      secretKey: korapaySecret,
      encryptionKey: process.env.KORAPAY_ENCRYPTION_KEY,
      baseUrl: process.env.KORAPAY_BASE_URL,
      defaultRedirectUrl: process.env.KORAPAY_REDIRECT_URL ?? process.env.APP_URL,
      defaultWebhookUrl:
        process.env.KORAPAY_WEBHOOK_URL ??
        `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay-guest`
    });
  }
  return createMockPaymentGateway();
}

function verifyGuestKorapaySignature(input: { body: unknown; signature?: string | undefined }): boolean {
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

interface RequestContext {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

interface StoredGuestMetadata {
  input?: {
    bundleId?: string;
    meterType?: "PREPAID" | "POSTPAID";
    packageCode?: string;
  };
}

function storedMetadata(transaction: Pick<GuestTransaction, "metadata">): StoredGuestMetadata {
  return (transaction.metadata ?? {}) as StoredGuestMetadata;
}

@Injectable()
export class GuestCheckoutService {
  private readonly logger = new Logger(GuestCheckoutService.name);
  private readonly paymentGateway = getGuestPaymentGateway();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly vtu?: VtuService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  private buildFulfilmentAdapter(): VtuProviderAdapter {
    return createClubKonnectAdapter({
      userId: process.env["CLUBKONNECT_USER_ID"] ?? "",
      apiKey: process.env["CLUBKONNECT_API_KEY"] ?? "",
      ...((process.env["CLUBKONNECT_BASE_URL"] ?? process.env["CLUBKONNECT_API_URL"])
        ? { baseUrl: process.env["CLUBKONNECT_BASE_URL"] ?? process.env["CLUBKONNECT_API_URL"] }
        : {}),
      ...(process.env["CLUBKONNECT_CALLBACK_URL"] ? { callbackUrl: process.env["CLUBKONNECT_CALLBACK_URL"] } : {})
    });
  }

  // ─── Fraud / abuse controls ───────────────────────────────────────────────

  private async assertNotThrottled(email: string, phone: string | undefined, ip: string | undefined) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000);

    const contactWhere: Prisma.GuestTransactionWhereInput = {
      createdAt: { gte: since24h },
      OR: [{ email }, ...(phone ? [{ phone }] : [])]
    };
    const contactTxns = await this.db.guestTransaction.findMany({
      where: contactWhere,
      select: { amountMinor: true }
    });
    if (contactTxns.length >= MAX_DAILY_TRANSACTIONS_PER_CONTACT) {
      throw new BadRequestException("Daily guest transaction limit reached for this email/phone.");
    }
    const dailyTotal = contactTxns.reduce((sum, t) => sum + t.amountMinor, 0);
    if (dailyTotal >= MAX_DAILY_AMOUNT_MINOR_PER_CONTACT) {
      throw new BadRequestException("Daily guest spending limit reached for this email/phone.");
    }

    if (ip) {
      const ipCount = await this.db.guestTransaction.count({
        where: { requestIpAddress: ip, createdAt: { gte: sinceHour } }
      });
      if (ipCount >= MAX_HOURLY_TRANSACTIONS_PER_IP) {
        throw new BadRequestException("Too many guest checkout attempts from this network. Try again later.");
      }
    }
  }

  private async findRecentDuplicate(idempotencyKey: string) {
    return this.db.guestTransaction.findUnique({ where: { idempotencyKey } });
  }

  // ─── Checkout ─────────────────────────────────────────────────────────────

  async checkout(input: GuestCheckoutDto, context: RequestContext) {
    if (!input.productType) throw new BadRequestException("productType is required.");
    if (!input.email || !isEmail(input.email)) throw new BadRequestException("A valid email is required.");

    const { beneficiaryPlain, beneficiaryMasked, provider, amountMinor } = await this.resolveProduct(input);
    if (amountMinor > MAX_TRANSACTION_AMOUNT_MINOR) {
      throw new BadRequestException("Amount exceeds the maximum allowed for guest checkout.");
    }

    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `guest:${input.productType}:${input.email}:${beneficiaryPlain}:${amountMinor}:${Math.floor(Date.now() / DUPLICATE_REQUEST_WINDOW_MS)}`;

    const existing = await this.findRecentDuplicate(idempotencyKey);
    if (existing) {
      return this.toReceiptSummary(existing, { idempotent: true });
    }

    await this.assertNotThrottled(input.email, input.phone, context.ipAddress);

    const reference = uid("guest");
    const transaction = await this.db.guestTransaction.create({
      data: {
        reference,
        idempotencyKey,
        email: input.email,
        phone: input.phone ?? null,
        productType: input.productType,
        provider,
        beneficiaryMasked,
        beneficiaryEncrypted: beneficiaryPlain,
        amountMinor,
        currency: input.currency ?? "NGN",
        requestIpAddress: context.ipAddress ?? null,
        requestUserAgent: context.userAgent ?? null,
        metadata: { input: this.redactMetadataInput(input) }
      }
    });

    return this.toReceiptSummary(transaction, { idempotent: false });
  }

  // AIRTIME/ELECTRICITY/BETTING are open-amount products (the guest picks how much to
  // fund) — the client-supplied amount is trusted, same as the authenticated VTU flow.
  // DATA/CABLE/EDUCATION are fixed-price catalog products — pricing is always resolved
  // server-side from the VTU catalog tables, never trusted from the request body, since
  // an unauthenticated caller could otherwise buy a real bundle for an arbitrary amount.
  private async resolveProduct(input: GuestCheckoutDto): Promise<{
    beneficiaryPlain: string;
    beneficiaryMasked: string;
    provider: string;
    amountMinor: number;
  }> {
    switch (input.productType) {
      case "AIRTIME": {
        if (!input.network || !input.msisdn) throw new BadRequestException("network and msisdn are required.");
        if (!VTU_NETWORKS.includes(input.network as VtuNetwork)) {
          throw new BadRequestException("Unsupported network.");
        }
        return {
          beneficiaryPlain: input.msisdn,
          beneficiaryMasked: mask(input.msisdn),
          provider: input.network,
          amountMinor: applyMarkup(normalizeAmount(input.amountMinor))
        };
      }
      case "DATA": {
        if (!input.network || !input.msisdn || !input.bundleId) {
          throw new BadRequestException("network, msisdn and bundleId are required.");
        }
        if (!VTU_NETWORKS.includes(input.network as VtuNetwork)) {
          throw new BadRequestException("Unsupported network.");
        }
        const plans = (await this.vtu?.listDataPlans(input.network as VtuNetwork)) ?? [];
        const plan = plans.find((p) => p.providerPlanId === input.bundleId);
        if (!plan) throw new BadRequestException("Data bundle not found or unavailable.");
        return {
          beneficiaryPlain: input.msisdn,
          beneficiaryMasked: mask(input.msisdn),
          provider: input.network,
          amountMinor: applyMarkup(plan.costMinor)
        };
      }
      case "ELECTRICITY": {
        if (!input.disco || !input.meterNumber) throw new BadRequestException("disco and meterNumber are required.");
        return {
          beneficiaryPlain: input.meterNumber,
          beneficiaryMasked: mask(input.meterNumber),
          provider: input.disco,
          amountMinor: applyMarkup(normalizeAmount(input.amountMinor))
        };
      }
      case "CABLE": {
        if (!input.cableProvider || !input.smartCardNumber || !input.packageCode) {
          throw new BadRequestException("cableProvider, smartCardNumber and packageCode are required.");
        }
        const packages = (await this.vtu?.listCablePackages(input.cableProvider)) ?? [];
        const pkg = packages.find((p) => p.packageCode === input.packageCode);
        if (!pkg) throw new BadRequestException("Cable package not found or unavailable.");
        return {
          beneficiaryPlain: input.smartCardNumber,
          beneficiaryMasked: mask(input.smartCardNumber),
          provider: input.cableProvider,
          amountMinor: applyMarkup(pkg.costMinor)
        };
      }
      case "BETTING": {
        if (!input.bookmaker || !input.customerId) throw new BadRequestException("bookmaker and customerId are required.");
        return {
          beneficiaryPlain: input.customerId,
          beneficiaryMasked: mask(input.customerId),
          provider: input.bookmaker,
          amountMinor: applyMarkup(normalizeAmount(input.amountMinor))
        };
      }
      case "EDUCATION": {
        if (!input.examType) throw new BadRequestException("examType is required.");
        const plans = (await this.vtu?.listEducationPlans()) ?? [];
        const plan = plans.find((p) => p.productCode === input.examType);
        if (!plan) throw new BadRequestException("Exam PIN product not found or unavailable.");
        return {
          beneficiaryPlain: input.phone ?? "n/a",
          beneficiaryMasked: input.phone ? mask(input.phone) : "n/a",
          provider: input.examType,
          // listEducationPlans() already applies the wholesale markup.
          amountMinor: plan.costMinor
        };
      }
      default:
        throw new BadRequestException("Unsupported productType.");
    }
  }

  private redactMetadataInput(input: GuestCheckoutDto) {
    return {
      productType: input.productType,
      network: input.network,
      bundleId: input.bundleId,
      disco: input.disco,
      meterType: input.meterType,
      cableProvider: input.cableProvider,
      packageCode: input.packageCode,
      bookmaker: input.bookmaker,
      examType: input.examType,
      currency: input.currency
    };
  }

  // ─── Payment ──────────────────────────────────────────────────────────────

  async initiatePayment(reference: string, redirectUrl: string | undefined, context: RequestContext) {
    const transaction = await this.requireTransaction(reference);
    if (transaction.paymentStatus === "PAID") {
      return this.toReceiptSummary(transaction, { idempotent: true });
    }

    const webhookUrl =
      process.env.NODE_ENV === "production"
        ? undefined
        : `${process.env.API_URL ?? "http://localhost:4000"}/api/webhooks/korapay-guest`;

    const intent = await this.paymentGateway.createPaymentIntent({
      amount: { amountMinor: transaction.amountMinor, currency: transaction.currency as CurrencyCode },
      workspaceId: `guest:${transaction.reference}`,
      customerEmail: transaction.email,
      ...(redirectUrl ? { redirectUrl } : {}),
      ...(webhookUrl ? { webhookUrl } : {})
    });

    const updated = await this.db.guestTransaction.update({
      where: { id: transaction.id },
      data: {
        paymentProvider: intent.gateway,
        paymentReference: intent.providerReference ?? null,
        paymentMethod: "card",
        requestIpAddress: transaction.requestIpAddress ?? context.ipAddress ?? null,
        requestUserAgent: transaction.requestUserAgent ?? context.userAgent ?? null
      }
    });

    return {
      reference: updated.reference,
      checkoutUrl: intent.checkoutUrl,
      paymentReference: intent.providerReference,
      status: updated.paymentStatus
    };
  }

  // ─── Webhook ──────────────────────────────────────────────────────────────

  async handleKorapayWebhook(body: unknown, signature: string | undefined) {
    if (!verifyGuestKorapaySignature({ body, signature })) {
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

    const eventBody: KorapayWebhookBody = typeof body === "object" && body !== null ? (body) : {};
    const data = typeof eventBody.data === "object" && eventBody.data !== null ? eventBody.data : {};
    const paymentReference = data.reference ?? data.payment_reference;
    if (!paymentReference || typeof paymentReference !== "string") {
      throw new BadRequestException("Webhook is missing a payment reference.");
    }

    const eventId = typeof eventBody.event === "string" ? eventBody.event : typeof data.id === "string" ? data.id : paymentReference;
    const replayKey = `guest-checkout:webhook:${eventId}:${paymentReference}`;
    const existingReceipt = await this.db.eventOutbox.findUnique?.({ where: { idempotencyKey: replayKey } });
    if (existingReceipt?.processedAt) {
      return { accepted: true, duplicate: true, reference: paymentReference };
    }
    await this.db.eventOutbox.upsert?.({
      where: { idempotencyKey: replayKey },
      update: {},
      create: {
        workspaceId: null,
        name: "GuestCheckoutWebhookReceived",
        entityType: "GuestTransaction",
        entityId: paymentReference,
        payload: { paymentReference, status: typeof data.status === "string" ? data.status : null },
        idempotencyKey: replayKey
      }
    });

    const transaction = await this.db.guestTransaction.findFirst({ where: { paymentReference } });
    if (!transaction) {
      return { accepted: true, matched: false, reference: paymentReference };
    }

    // Never trust the frontend/webhook payload status alone for a paid transaction —
    // re-verify against the gateway before fulfilling.
    const verified = await this.paymentGateway.verifyPayment(paymentReference);

    if (verified.status === "COMPLETED" && transaction.paymentStatus !== "PAID") {
      await this.db.guestTransaction.update({
        where: { id: transaction.id },
        data: { paymentStatus: "PAID" }
      });
      await this.fulfil(transaction.id);
    } else if (verified.status === "FAILED") {
      await this.db.guestTransaction.update({
        where: { id: transaction.id },
        data: { paymentStatus: "FAILED", failureReason: "Payment failed at gateway." }
      });
      await this.emailFailureNotification(transaction.id);
    }

    await this.db.eventOutbox.update?.({
      where: { idempotencyKey: replayKey },
      data: { status: "PROCESSED", processedAt: new Date() }
    });

    return { accepted: true, matched: true, reference: paymentReference };
  }

  // ─── Fulfilment ───────────────────────────────────────────────────────────

  private async fulfil(transactionId: string) {
    const transaction = await this.db.guestTransaction.findUniqueOrThrow({ where: { id: transactionId } });
    if (transaction.fulfilmentStatus === "DELIVERED") return transaction;

    await this.db.guestTransaction.update({
      where: { id: transaction.id },
      data: { fulfilmentStatus: "PROCESSING", attemptCount: { increment: 1 } }
    });

    const adapter = this.buildFulfilmentAdapter();
    const beneficiary = transaction.beneficiaryEncrypted;
    const amountMinor = transaction.amountMinor;
    const meta = storedMetadata(transaction);

    try {
      let result: { providerReference: string; status: string; failureReason?: string };

      switch (transaction.productType) {
        case "AIRTIME":
          result = await adapter.purchaseAirtime({
            network: transaction.provider as VtuNetwork,
            msisdn: beneficiary,
            faceValueMinor: amountMinor,
            reference: transaction.reference
          });
          break;
        case "DATA":
          result = await adapter.purchaseData({
            network: transaction.provider as VtuNetwork,
            msisdn: beneficiary,
            providerPlanId: meta.input?.bundleId ?? "",
            reference: transaction.reference
          });
          break;
        case "ELECTRICITY":
          result = await (adapter.purchaseElectricity?.({
            disco: transaction.provider,
            meterNumber: beneficiary,
            meterType: meta.input?.meterType ?? "PREPAID",
            amountMinor,
            phoneNumber: transaction.phone ?? "",
            reference: transaction.reference
          }) ?? Promise.reject(new Error("Electricity purchases are not supported by this provider.")));
          break;
        case "CABLE":
          result = await (adapter.purchaseCable?.({
            provider: transaction.provider,
            packageCode: meta.input?.packageCode ?? "",
            smartCardNumber: beneficiary,
            phoneNumber: transaction.phone ?? "",
            reference: transaction.reference
          }) ?? Promise.reject(new Error("Cable purchases are not supported by this provider.")));
          break;
        case "BETTING":
          result = await (adapter.purchaseBetFunding?.({
            bettingCompany: transaction.provider,
            customerId: beneficiary,
            amountMinor,
            reference: transaction.reference
          }) ?? Promise.reject(new Error("Betting funding is not supported by this provider.")));
          break;
        case "EDUCATION":
          result = await (adapter.purchaseEducation?.({
            examType: transaction.provider,
            phoneNumber: transaction.phone ?? "",
            reference: transaction.reference
          }) ?? Promise.reject(new Error("Exam PIN purchases are not supported by this provider.")));
          break;
        default:
          throw new Error("Unsupported product type.");
      }

      const status = result.status === "DELIVERED" || result.status === "SUBMITTED" ? "DELIVERED" : "FAILED";
      const updated = await this.db.guestTransaction.update({
        where: { id: transaction.id },
        data: {
          fulfilmentStatus: status,
          providerReference: result.providerReference,
          failureReason: status === "FAILED" ? (result.failureReason ?? "Provider declined the order.") : null
        }
      });

      if (status === "DELIVERED") {
        await this.emailReceipt(updated.id);
      } else {
        await this.emailFailureNotification(updated.id);
      }
      return updated;
    } catch (err) {
      this.logger.error(`Guest fulfilment failed for ${transaction.reference}`, err as Error);
      const updated = await this.db.guestTransaction.update({
        where: { id: transaction.id },
        data: {
          fulfilmentStatus: "FAILED",
          failureReason: err instanceof Error ? err.message : "Fulfilment error"
        }
      });
      await this.emailFailureNotification(updated.id);
      return updated;
    }
  }

  async retryFulfilment(reference: string) {
    const transaction = await this.requireTransaction(reference);
    if (transaction.paymentStatus !== "PAID") {
      throw new BadRequestException("Cannot fulfil a transaction that has not been paid.");
    }
    if (transaction.fulfilmentStatus === "DELIVERED") {
      return this.toReceiptSummary(transaction, { idempotent: true });
    }
    const updated = await this.fulfil(transaction.id);
    return this.toReceiptSummary(updated, { idempotent: false });
  }

  // ─── Receipt / status ───────────────────────────────────────────────────────

  async getStatus(reference: string) {
    const transaction = await this.requireTransaction(reference);
    return {
      reference: transaction.reference,
      paymentStatus: transaction.paymentStatus,
      fulfilmentStatus: transaction.fulfilmentStatus,
      updatedAt: transaction.updatedAt
    };
  }

  async getReceipt(reference: string) {
    const transaction = await this.requireTransaction(reference);
    return this.toReceiptSummary(transaction, { idempotent: false });
  }

  private async requireTransaction(reference: string) {
    const transaction = await this.db.guestTransaction.findUnique({ where: { reference } });
    if (!transaction) throw new NotFoundException("Guest transaction was not found.");
    return transaction;
  }

  private toReceiptSummary(transaction: GuestTransaction, opts: { idempotent: boolean }) {
    return {
      idempotent: opts.idempotent,
      reference: transaction.reference,
      email: transaction.email,
      productType: transaction.productType,
      provider: transaction.provider,
      beneficiary: transaction.beneficiaryMasked,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      paymentStatus: transaction.paymentStatus,
      fulfilmentStatus: transaction.fulfilmentStatus,
      paymentMethod: transaction.paymentMethod,
      providerReference: transaction.providerReference,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    };
  }

  private async emailReceipt(transactionId: string) {
    const transaction = await this.db.guestTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction) return;
    try {
      await this.notifications.send({
        guestEmail: transaction.email,
        ...(transaction.phone ? { guestPhone: transaction.phone } : {}),
        channels: transaction.phone ? ["EMAIL", "SMS"] : ["EMAIL"],
        template: "transaction_receipt",
        vars: {
          first_name: "there",
          amount: (transaction.amountMinor / 100).toFixed(2),
          currency: transaction.currency,
          transaction_id: transaction.id,
          reference: transaction.reference,
          status: transaction.fulfilmentStatus,
          service: transaction.productType,
          date: transaction.createdAt.toISOString()
        },
        idempotencyKey: `guest_receipt:${transaction.id}`
      });
      await this.db.guestTransaction.update({ where: { id: transactionId }, data: { receiptEmailedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Failed to email receipt for ${transaction.reference}: ${(err as Error).message}`);
    }
  }

  private async emailFailureNotification(transactionId: string) {
    const transaction = await this.db.guestTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction) return;
    try {
      await this.notifications.send({
        guestEmail: transaction.email,
        channels: ["EMAIL"],
        template: "payment_failed",
        vars: {
          first_name: "there",
          amount: (transaction.amountMinor / 100).toFixed(2),
          currency: transaction.currency,
          transaction_id: transaction.id,
          reference: transaction.reference,
          status: transaction.failureReason ?? "Unknown error",
          service: transaction.productType,
          date: transaction.createdAt.toISOString()
        },
        idempotencyKey: `guest_failure:${transaction.id}`
      });
    } catch (err) {
      this.logger.warn(`Failed to email failure notice for ${transaction.reference}: ${(err as Error).message}`);
    }
  }

  // ─── Returning-guest lookup ─────────────────────────────────────────────────

  async lookupReturningGuest(emailOrPhone: string) {
    const previous = await this.db.guestTransaction.findFirst({
      where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] },
      orderBy: { createdAt: "desc" }
    });
    return { returning: Boolean(previous), lastPurchaseAt: previous?.createdAt ?? null };
  }

  // ─── Guest-to-account migration ─────────────────────────────────────────────

  async migrateToUser(emailOrPhone: string, userId: string) {
    const result = await this.db.guestTransaction.updateMany({
      where: {
        OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
        migratedToUserId: null
      },
      data: { migratedToUserId: userId, migratedAt: new Date() }
    });
    return { migratedCount: result.count };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  async adminList(query: AdminGuestTransactionQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));

    const where: Prisma.GuestTransactionWhereInput = {
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as GuestPaymentStatus } : {}),
      ...(query.fulfilmentStatus ? { fulfilmentStatus: query.fulfilmentStatus as GuestFulfilmentStatus } : {}),
      ...(query.email ? { email: query.email } : {}),
      ...(query.phone ? { phone: query.phone } : {}),
      ...(query.reference ? { reference: query.reference } : {}),
      ...(query.providerReference ? { providerReference: query.providerReference } : {})
    };

    const [items, total] = await Promise.all([
      this.db.guestTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.db.guestTransaction.count({ where })
    ]);

    return { items, total, page, pageSize };
  }

  async adminExportCsv(query: AdminGuestTransactionQueryDto): Promise<string> {
    const { items } = await this.adminList({ ...query, pageSize: 1000 });
    const header = [
      "reference",
      "email",
      "phone",
      "productType",
      "provider",
      "amountMinor",
      "currency",
      "paymentStatus",
      "fulfilmentStatus",
      "providerReference",
      "createdAt"
    ];
    const rows = items.map((t: GuestTransaction) =>
      [
        t.reference,
        t.email,
        t.phone ?? "",
        t.productType,
        t.provider,
        t.amountMinor,
        t.currency,
        t.paymentStatus,
        t.fulfilmentStatus,
        t.providerReference ?? "",
        t.createdAt.toISOString()
      ]
        .map((v: unknown) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    return [header.join(","), ...rows].join("\n");
  }
}
