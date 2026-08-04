import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

import { Prisma, type DatabaseClient } from "@fliptrybe/database";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";
import {
  createFiveSimRentalAdapter,
  createMockVirtualNumberAdapter,
  createSmsPoolAdapter,
  createSmsPvaAdapter,
  type NumberOffer,
  type VirtualNumberProviderAdapter
} from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";
import { FxService } from "../fx/fx.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { PurchaseNumberDto, RenewNumberDto } from "./virtual-numbers.dtos";

type DbClient = DatabaseClient | Prisma.TransactionClient;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// 35% margin over wholesale — numbers carry higher margin than VTU per the plan's
// indicative pricing (23-45% across SKUs).
const MARKUP_BPS = 3_500;

function applyMarkup(costMinorUsd: number): number {
  return Math.ceil(costMinorUsd * (1 + MARKUP_BPS / 10_000));
}

function usdMinorToNgnMinor(usdMinor: number, rateMicros: bigint): number {
  return Math.ceil((usdMinor * Number(rateMicros)) / 1_000_000);
}

interface DbLedgerEntryRow {
  id: string;
  walletId: string;
  kind: string;
  amountMinor: number;
  currency: string;
  reference: string;
  description: string;
  idempotencyKey: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toTypedEntry(e: DbLedgerEntryRow): LedgerEntry {
  return {
    id: e.id,
    walletId: e.walletId,
    kind: e.kind as LedgerEntry["kind"],
    amount: { amountMinor: e.amountMinor, currency: e.currency as CurrencyCode },
    reference: e.reference,
    description: e.description,
    ...(e.idempotencyKey ? { idempotencyKey: e.idempotencyKey } : {}),
    ...(e.sourceType ? { sourceType: e.sourceType } : {}),
    ...(e.sourceId ? { sourceId: e.sourceId } : {}),
    metadata: {},
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString()
  };
}

@Injectable()
export class VirtualNumbersService {
  private readonly logger = new Logger(VirtualNumbersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queue: QueueProducerService,
    private readonly fx: FxService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Adapter factory ────────────────────────────────────────────────────────

  private buildAdapter(providerName: string): VirtualNumberProviderAdapter {
    switch (providerName) {
      case "smspool":
        return createSmsPoolAdapter({
          apiKey: process.env["SMSPOOL_API_KEY"] ?? "",
          ...(process.env["SMSPOOL_BASE_URL"] ? { baseUrl: process.env["SMSPOOL_BASE_URL"] } : {})
        });
      case "5sim":
        return createFiveSimRentalAdapter({
          apiToken: process.env["FIVESIM_API_TOKEN"] ?? process.env["FIVESIM_API_KEY"] ?? "",
          ...((process.env["FIVESIM_BASE_URL"] ?? process.env["FIVESIM_API_URL"])
            ? { baseUrl: process.env["FIVESIM_BASE_URL"] ?? process.env["FIVESIM_API_URL"] }
            : {})
        });
      case "smspva":
        return createSmsPvaAdapter({
          apiKey: process.env["SMSPVA_API_KEY"] ?? "",
          ...(process.env["SMSPVA_BASE_URL"] ? { baseUrl: process.env["SMSPVA_BASE_URL"] } : {})
        });
      default:
        return createMockVirtualNumberAdapter(providerName);
    }
  }

  // ─── Provider routing ────────────────────────────────────────────────────────
  // VirtualNumberProduct.preferredProviders is an ordered hint, not a binding — skip
  // any provider whose latest VIRTUAL_NUMBER health reads DOWN/DISABLED.

  private async candidateProviders(
    preferredProviders: string[],
    db: DbClient = this.db
  ): Promise<string[]> {
    if (preferredProviders.length === 0) return [];

    const healthRows = await db.providerHealth.findMany({
      where: { providerName: { in: preferredProviders }, domain: "VIRTUAL_NUMBER" },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });
    const latestStatus = new Map(healthRows.map((h) => [h.providerName, h.status]));

    return preferredProviders.filter((name) => {
      const status = latestStatus.get(name);
      return status !== "DOWN" && status !== "DISABLED";
    });
  }

  // ─── Hardening & limits ──────────────────────────────────────────────────────

  private async checkPurchaseLimits(ctx: AuthenticatedRequestContext) {
    const now = new Date();

    const limit = await this.db.virtualNumberPurchaseLimit.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        periodType: "MONTH",
        periodStart: { lte: now },
        periodEnd: { gte: now }
      }
    });

    if (limit && limit.spentMinor > limit.limitMinor) {
      const spent = (limit.spentMinor / 100).toFixed(2);
      const cap = (limit.limitMinor / 100).toFixed(2);
      throw new ForbiddenException(
        `Monthly virtual numbers spending limit exceeded: ₦${spent} spent of ₦${cap} cap.`
      );
    }
  }

  private async trackMarginAnalytics(
    orderId: string,
    countryCode: string,
    providerName: string,
    costMinorUsd: number,
    chargeMinorNgn: number,
    rate: { rateMicros: bigint }
  ) {
    const EXPECTED_MARGIN_BPS = 3_500;

    function usdMinorToNgnMinor(usdMinor: number, rateMicros: bigint): number {
      return Math.ceil((usdMinor * Number(rateMicros)) / 1_000_000);
    }

    const costMinorNgn = usdMinorToNgnMinor(costMinorUsd, rate.rateMicros);
    const marginMinorNgn = chargeMinorNgn - costMinorNgn;
    const marginBps = costMinorNgn > 0 ? Math.round((marginMinorNgn / costMinorNgn) * 10_000) : 0;
    const marginVarianceBps = marginBps - EXPECTED_MARGIN_BPS;

    await this.db.virtualNumberMarginAnalytics.create({
      data: {
        orderId,
        countryCode,
        providerName,
        costMinorUsd,
        costMinorNgn,
        sellMinorNgn: chargeMinorNgn,
        marginMinorNgn,
        marginBps,
        marginVarianceBps,
        fxRateMicrosApplied: rate.rateMicros
      }
    });
  }

  // ─── Wallet helpers ──────────────────────────────────────────────────────────

  private async getWallet(workspaceId: string, db: DbClient = this.db) {
    const wallet = await db.wallet.findFirst({ where: { workspaceId, currency: "NGN" } });
    if (!wallet) throw new NotFoundException("Wallet not found.");
    return wallet;
  }

  private async debitWallet(
    walletId: string,
    workspaceId: string,
    amountMinor: number,
    description: string,
    orderId: string,
    db: DbClient
  ) {
    const chargeId = uid("vnwc");
    const ledgerId = uid("led");
    const idemKey = `vn_debit_${orderId}`;

    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        id: ledgerId,
        walletId,
        kind: "DEBIT",
        amountMinor,
        currency: "NGN",
        reference: idemKey,
        description,
        idempotencyKey: idemKey,
        sourceType: "VirtualNumberWalletCharge",
        sourceId: chargeId
      }
    });

    const charge = await db.virtualNumberWalletCharge.create({
      data: {
        id: chargeId,
        workspaceId,
        walletId,
        orderId,
        idempotencyKey: idemKey,
        amountMinor,
        currency: "NGN",
        status: "CHARGED",
        debitLedgerEntryId: ledgerEntry.id
      }
    });

    return { charge, ledgerEntry };
  }

  private async reverseCharge(orderId: string, reason: string, db: DbClient) {
    const charge = await db.virtualNumberWalletCharge.findFirst({
      where: { orderId, status: "CHARGED" }
    });
    if (!charge) return;

    const ledgerId = uid("led");
    const idemKey = `vn_reversal_${orderId}`;

    const reversalEntry = await db.ledgerEntry.create({
      data: {
        id: ledgerId,
        walletId: charge.walletId,
        kind: "REVERSAL",
        amountMinor: charge.amountMinor,
        currency: "NGN",
        reference: idemKey,
        description: reason,
        idempotencyKey: idemKey,
        sourceType: "VirtualNumberWalletCharge",
        sourceId: charge.id
      }
    });

    await db.virtualNumberWalletCharge.update({
      where: { id: charge.id },
      data: { status: "REFUNDED", refundLedgerEntryId: reversalEntry.id }
    });
  }

  // ─── Catalog ─────────────────────────────────────────────────────────────────

  async listCountries() {
    return this.db.numberCountry.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" }
    });
  }

  async listProducts(countryCode: string) {
    const products = await this.db.virtualNumberProduct.findMany({
      where: { countryCode, active: true },
      orderBy: { durationDays: "asc" }
    });

    // Browsing the catalog must not hard-fail on a stale FX rate — only an actual
    // purchase enforces that guardrail. Fall back to the bootstrap rate for display.
    const rate = await this.fx.getActiveRate().catch(() => ({ rateMicros: 1_450_000_000n }));

    return products.map((p) => ({
      ...p,
      // Wholesale cost isn't stored on the product (it's fetched live from the
      // provider at purchase time); metadata.referenceCostMinorUsd is a cached
      // catalog-sync value used only for display estimates here.
      estimatedPriceMinorNgn: usdMinorToNgnMinor(
        applyMarkup(Number((p.metadata as Record<string, unknown>)?.["referenceCostMinorUsd"] ?? 0)),
        rate.rateMicros
      )
    }));
  }

  // ─── Purchase ────────────────────────────────────────────────────────────────

  async purchaseNumber(ctx: AuthenticatedRequestContext, dto: PurchaseNumberDto) {
    const product = await this.db.virtualNumberProduct.findUnique({
      where: { id: dto.productId }
    });
    if (!product || !product.active) {
      throw new NotFoundException("This number product is not available.");
    }

    const candidates = await this.candidateProviders(product.preferredProviders);
    if (candidates.length === 0) {
      throw new BadRequestException(
        `No healthy provider is configured for ${product.displayName}.`
      );
    }

    // Fetched once per purchase attempt — throws if the active rate is missing/stale,
    // which is exactly the guardrail: never quote off a stale rate.
    const rate = await this.fx.getActiveRate();

    // Check purchase limits before proceeding
    await this.checkPurchaseLimits(ctx);

    const orderId = uid("vno");
    const idempotencyKey = `vn_order_${orderId}`;

    // Try candidates in preference order; each attempt is independent so a mid-flight
    // failure at one provider doesn't leave the order in a partial state.
    let lastError: unknown;
    for (const providerName of candidates) {
      const adapter = this.buildAdapter(providerName);

      try {
        const offers = await adapter.searchNumbers({
          country: product.countryCode,
          durationDays: product.durationDays
        });
        const offer = offers[0];
        if (!offer) {
          lastError = new Error(`${providerName} has no inventory for ${product.displayName}`);
          continue;
        }

        const chargeMinor = usdMinorToNgnMinor(applyMarkup(offer.costMinorUsd), rate.rateMicros);

        return await this.chargeAndProvision(
          ctx,
          orderId,
          idempotencyKey,
          product,
          offer,
          adapter,
          chargeMinor,
          rate
        );
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `Virtual number purchase failed at ${providerName}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    throw new BadRequestException(
      `All providers failed to fulfil this number. ${lastError instanceof Error ? lastError.message : ""}`.trim()
    );
  }

  private async chargeAndProvision(
    ctx: AuthenticatedRequestContext,
    orderId: string,
    idempotencyKey: string,
    product: { id: string; countryCode: string; displayName: string; durationDays: number },
    offer: NumberOffer,
    adapter: VirtualNumberProviderAdapter,
    chargeMinor: number,
    rate: { rateMicros: bigint; fxRateId: string | null }
  ) {
    const { workspaceId } = ctx;

    const order = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(workspaceId, tx);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < chargeMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(chargeMinor / 100).toFixed(2)}.`
        );
      }

      const newOrder = await tx.virtualNumberOrder.create({
        data: {
          id: orderId,
          workspaceId,
          userId: ctx.userId,
          productId: product.id,
          kind: "PURCHASE",
          status: "CHARGED",
          amountMinor: chargeMinor,
          currency: "NGN",
          supplierCostMinor: offer.costMinorUsd,
          supplierCurrency: "USD",
          fxRateId: rate.fxRateId,
          fxRateMicrosApplied: rate.rateMicros,
          providerName: adapter.name,
          idempotencyKey
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `${product.displayName} — ${offer.countryCode} number`,
        orderId,
        tx
      );

      return newOrder;
    });

    try {
      const reservation = await adapter.reserveNumber(offer);
      const provisioned = await adapter.provisionNumber({
        reservationId: reservation.reservationId,
        offer
      });

      const numberId = uid("vn");
      const number = await this.db.virtualNumber.create({
        data: {
          id: numberId,
          workspaceId,
          userId: ctx.userId,
          productId: product.id,
          providerName: adapter.name,
          providerNumberId: provisioned.providerNumberId,
          e164: provisioned.e164,
          countryCode: product.countryCode,
          status: "ACTIVE",
          provisionedAt: new Date(),
          activatedAt: new Date(),
          expiresAt: new Date(provisioned.expiresAt),
          supplierCostMinor: offer.costMinorUsd,
          supplierCurrency: "USD"
        }
      });

      await this.db.virtualNumberOrder.update({
        where: { id: order.id },
        data: { status: "FULFILLED", virtualNumberId: number.id, providerReference: provisioned.providerNumberId }
      });

      // Track margin analytics for reporting
      await this.trackMarginAnalytics(
        order.id,
        product.countryCode,
        adapter.name,
        offer.costMinorUsd,
        chargeMinor,
        rate
      );

      return this.db.virtualNumberOrder.findUniqueOrThrow({ where: { id: order.id } });
    } catch (err) {
      // Provisioning is synchronously confirmable (unlike VTU's telco submit), so a
      // failure here is auto-reversed — the customer is never left charged for a
      // number that does not exist.
      this.logger.error(`Provisioning failed for order ${order.id}: ${String(err)}`);

      await this.db.$transaction(async (tx) => {
        await this.reverseCharge(order.id, `Provisioning failed: ${String(err)}`, tx);
        await tx.virtualNumberOrder.update({
          where: { id: order.id },
          data: { status: "FAILED", failureReason: err instanceof Error ? err.message : String(err) }
        });
      });

      throw new BadRequestException("Could not provision this number. Your wallet was not charged.");
    }
  }

  // ─── My numbers ──────────────────────────────────────────────────────────────

  async listMyNumbers(
    ctx: AuthenticatedRequestContext,
    query: { page?: number; limit?: number; status?: string }
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const where = {
      workspaceId: ctx.workspaceId,
      ...(query.status ? { status: query.status as never } : {})
    };

    const [numbers, total] = await Promise.all([
      this.db.virtualNumber.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.virtualNumber.count({ where })
    ]);

    return { numbers, total, page, limit };
  }

  async getNumber(ctx: AuthenticatedRequestContext, id: string) {
    const number = await this.db.virtualNumber.findFirst({
      where: { id, workspaceId: ctx.workspaceId }
    });
    if (!number) throw new NotFoundException("Number not found.");
    return number;
  }

  async listMessages(
    ctx: AuthenticatedRequestContext,
    numberId: string,
    query: { page?: number; limit?: number }
  ) {
    await this.getNumber(ctx, numberId);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));

    const [messages, total] = await Promise.all([
      this.db.virtualNumberMessage.findMany({
        where: { virtualNumberId: numberId },
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.virtualNumberMessage.count({ where: { virtualNumberId: numberId } })
    ]);

    return { messages, total, page, limit };
  }

  // ─── Renewal ─────────────────────────────────────────────────────────────────

  async renewNumber(ctx: AuthenticatedRequestContext, numberId: string, dto: RenewNumberDto) {
    const number = await this.getNumber(ctx, numberId);
    if (number.status !== "ACTIVE" && number.status !== "EXPIRING") {
      throw new BadRequestException("Only active or expiring numbers can be renewed.");
    }

    const adapter = this.buildAdapter(number.providerName);
    const product = await this.db.virtualNumberProduct.findUnique({
      where: { id: number.productId }
    });
    if (!product) throw new NotFoundException("Original product no longer exists.");

    const offers = await adapter.searchNumbers({
      country: number.countryCode,
      durationDays: dto.durationDays
    });
    const offer = offers[0];
    if (!offer) throw new BadRequestException("No renewal inventory available right now.");

    const rate = await this.fx.getActiveRate();
    const chargeMinor = usdMinorToNgnMinor(applyMarkup(offer.costMinorUsd), rate.rateMicros);
    const orderId = uid("vno");
    const idempotencyKey = `vn_order_${orderId}`;

    const order = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(ctx.workspaceId, tx);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < chargeMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(chargeMinor / 100).toFixed(2)}.`
        );
      }

      const newOrder = await tx.virtualNumberOrder.create({
        data: {
          id: orderId,
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          productId: product.id,
          virtualNumberId: number.id,
          kind: "RENEWAL",
          status: "CHARGED",
          amountMinor: chargeMinor,
          currency: "NGN",
          supplierCostMinor: offer.costMinorUsd,
          supplierCurrency: "USD",
          fxRateId: rate.fxRateId,
          fxRateMicrosApplied: rate.rateMicros,
          providerName: adapter.name,
          idempotencyKey
        }
      });

      await this.debitWallet(
        wallet.id,
        ctx.workspaceId,
        chargeMinor,
        `Renew ${number.e164} (+${dto.durationDays}d)`,
        orderId,
        tx
      );

      return newOrder;
    });

    try {
      const result = await adapter.renewNumber(number.providerNumberId, dto.durationDays);

      if (!result.sameNumber) {
        // Provider can't guarantee the same number on renewal — treat as a hard
        // failure and reverse rather than silently swap the customer's number.
        throw new Error(`${adapter.name} cannot guarantee the same number on renewal`);
      }

      await this.db.virtualNumber.update({
        where: { id: number.id },
        data: {
          expiresAt: new Date(result.expiresAt),
          status: "ACTIVE",
          renewalCount: { increment: 1 }
        }
      });

      await this.db.virtualNumberOrder.update({
        where: { id: order.id },
        data: { status: "FULFILLED" }
      });

      // Track margin analytics for renewal
      await this.trackMarginAnalytics(
        order.id,
        number.countryCode,
        adapter.name,
        offer.costMinorUsd,
        chargeMinor,
        rate
      );

      return { order: await this.db.virtualNumberOrder.findUniqueOrThrow({ where: { id: order.id } }), sameNumber: true };
    } catch (err) {
      this.logger.error(`Renewal failed for order ${order.id}: ${String(err)}`);

      await this.db.$transaction(async (tx) => {
        await this.reverseCharge(order.id, `Renewal failed: ${String(err)}`, tx);
        await tx.virtualNumberOrder.update({
          where: { id: order.id },
          data: { status: "FAILED", failureReason: err instanceof Error ? err.message : String(err) }
        });
      });

      throw new BadRequestException("Could not renew this number. Your wallet was not charged.");
    }
  }

  // ─── Release ─────────────────────────────────────────────────────────────────

  async releaseNumber(ctx: AuthenticatedRequestContext, numberId: string) {
    const number = await this.getNumber(ctx, numberId);
    if (number.status === "RELEASED") return number;

    const adapter = this.buildAdapter(number.providerName);

    try {
      await adapter.releaseNumber(number.providerNumberId);
    } catch (err) {
      this.logger.warn(`Provider release failed for ${number.id}, releasing locally anyway: ${String(err)}`);
    }

    return this.db.virtualNumber.update({
      where: { id: number.id },
      data: { status: "RELEASED", releasedAt: new Date() }
    });
  }

  // ─── Webhook / message ingestion — idempotent on (virtualNumberId, providerMessageId) ───

  async ingestMessage(input: {
    providerName: string;
    providerNumberId: string;
    providerMessageId?: string;
    senderRaw?: string;
    body: string;
    receivedAt: string;
  }) {
    const number = await this.db.virtualNumber.findUnique({
      where: { providerName_providerNumberId: { providerName: input.providerName, providerNumberId: input.providerNumberId } }
    });
    if (!number) {
      this.logger.warn(`Inbound message for unknown number ${input.providerName}:${input.providerNumberId}`);
      return { ingested: false };
    }

    const senderMasked = input.senderRaw
      ? input.senderRaw.length <= 4
        ? "****"
        : `${input.senderRaw.slice(0, 2)}****${input.senderRaw.slice(-2)}`
      : "Unknown";

    try {
      await this.db.virtualNumberMessage.create({
        data: {
          id: uid("vnm"),
          virtualNumberId: number.id,
          providerMessageId: input.providerMessageId ?? null,
          senderRaw: input.senderRaw ?? null,
          senderMasked,
          bodyEncrypted: input.body, // encrypt-at-rest in Phase 4
          bodyRedacted: input.body.replace(/\d{4,}/g, "****"),
          receivedAt: new Date(input.receivedAt),
          retainUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    } catch (err) {
      // Unique constraint on (virtualNumberId, providerMessageId) — duplicate delivery
      // from webhook + poll racing is expected and not an error.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ingested: false, reason: "duplicate" };
      }
      throw err;
    }

    await this.db.virtualNumber.update({
      where: { id: number.id },
      data: { messageCount: { increment: 1 }, lastMessageAt: new Date() }
    });

    return { ingested: true };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  async adminListNumbers(query: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));
    const where = query.status ? { status: query.status as never } : {};

    const [numbers, total] = await Promise.all([
      this.db.virtualNumber.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.virtualNumber.count({ where })
    ]);

    return { numbers, total, page, limit };
  }

  async adminListOrders(query: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));
    const where = query.status ? { status: query.status as never } : {};

    const [orders, total] = await Promise.all([
      this.db.virtualNumberOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.virtualNumberOrder.count({ where })
    ]);

    return { orders, total, page, limit };
  }

  async adminRetryOrder(orderId: string, adminUserId: string) {
    const order = await this.db.virtualNumberOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found.");
    if (order.status !== "FAILED") {
      throw new BadRequestException("Only FAILED orders can be retried.");
    }

    // The original charge was already reversed when the order failed — a retry is a
    // fresh purchase attempt on behalf of the same workspace, not a resume of the old
    // order. This mirrors what the customer would see if they clicked "buy" again.
    const retryCtx: AuthenticatedRequestContext = {
      userId: order.userId ?? adminUserId,
      workspaceId: order.workspaceId
    };

    const result = await this.purchaseNumber(retryCtx, { productId: order.productId });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        action: "VIRTUAL_NUMBER_ORDER_RETRIED",
        actorUserId: adminUserId,
        entityType: "VirtualNumberOrder",
        entityId: orderId,
        metadata: { newOrderId: result.id }
      }
    });

    return result;
  }

  async adminForceRelease(numberId: string, adminUserId: string) {
    const number = await this.db.virtualNumber.findUnique({ where: { id: numberId } });
    if (!number) throw new NotFoundException("Number not found.");

    const adapter = this.buildAdapter(number.providerName);
    try {
      await adapter.releaseNumber(number.providerNumberId);
    } catch (err) {
      this.logger.warn(`Admin force-release: provider call failed for ${numberId}, releasing locally anyway: ${String(err)}`);
    }

    const updated = await this.db.virtualNumber.update({
      where: { id: numberId },
      data: { status: "RELEASED", releasedAt: new Date() }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        action: "VIRTUAL_NUMBER_FORCE_RELEASED",
        actorUserId: adminUserId,
        entityType: "VirtualNumber",
        entityId: numberId,
        metadata: {}
      }
    });

    return updated;
  }

  async adminProviderHealth() {
    const providers = ["smspool", "5sim", "smspva"];
    const rows = await this.db.providerHealth.findMany({
      where: { providerName: { in: providers }, domain: "VIRTUAL_NUMBER" },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });
    return providers.map(
      (name) => rows.find((r) => r.providerName === name) ?? { providerName: name, status: "DISABLED" as const }
    );
  }

  // ─── Admin dashboards ─────────────────────────────────────────────────────────

  async adminMarginAnalytics(query: { days?: number; limit?: number; orderBy?: string }) {
    const days = Math.max(1, Math.min(90, query.days ?? 30));
    const limit = Math.min(500, Math.max(1, query.limit ?? 100));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const analytics = await this.db.virtualNumberMarginAnalytics.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    // Calculate summary statistics
    const totalOrders = analytics.length;
    const avgMarginBps = totalOrders > 0 ? Math.round(analytics.reduce((sum, a) => sum + a.marginBps, 0) / totalOrders) : 0;
    const minMarginBps = totalOrders > 0 ? Math.min(...analytics.map((a) => a.marginBps)) : 0;
    const maxMarginBps = totalOrders > 0 ? Math.max(...analytics.map((a) => a.marginBps)) : 0;
    const belowTargetCount = analytics.filter((a) => a.marginBps < 3500).length;

    // Group by provider for provider-level insights
    const byProvider = new Map<string, typeof analytics>();
    for (const a of analytics) {
      const list = byProvider.get(a.providerName) ?? [];
      list.push(a);
      byProvider.set(a.providerName, list);
    }

    const providerStats = Array.from(byProvider.entries()).map(([provider, records]) => ({
      provider,
      count: records.length,
      avgMarginBps: Math.round(records.reduce((sum, r) => sum + r.marginBps, 0) / records.length),
      avgVarianceBps: Math.round(records.reduce((sum, r) => sum + r.marginVarianceBps, 0) / records.length)
    }));

    return {
      summary: {
        period: `${days} days`,
        totalOrders,
        avgMarginBps,
        minMarginBps,
        maxMarginBps,
        belowTargetCount,
        expectedMarginBps: MARKUP_BPS
      },
      providerStats,
      orders: analytics.map((a) => ({
        orderId: a.orderId,
        country: a.countryCode,
        provider: a.providerName,
        costUsd: a.costMinorUsd,
        costNgn: a.costMinorNgn,
        sellNgn: a.sellMinorNgn,
        marginBps: a.marginBps,
        varianceBps: a.marginVarianceBps,
        createdAt: a.createdAt.toISOString()
      }))
    };
  }

  async adminReconciliation(query: { status?: string; days?: number; limit?: number }) {
    const days = Math.max(1, Math.min(90, query.days ?? 30));
    const limit = Math.min(200, Math.max(1, query.limit ?? 50));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const reconciliations = await this.db.virtualNumberReconciliation.findMany({
      where: {
        reportPeriodStart: { gte: since },
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: { reportPeriodEnd: "desc" },
      take: limit
    });

    const totalByStatus = new Map<string, number>();
    for (const r of reconciliations) {
      totalByStatus.set(r.status, (totalByStatus.get(r.status) ?? 0) + 1);
    }

    return {
      summary: {
        period: `${days} days`,
        total: reconciliations.length,
        byStatus: Object.fromEntries(totalByStatus),
        investigationCount: reconciliations.filter((r) => r.status === "INVESTIGATION").length
      },
      records: reconciliations.map((r) => ({
        id: r.id,
        provider: r.providerName,
        period: `${r.reportPeriodStart.toISOString().split("T")[0]} to ${r.reportPeriodEnd.toISOString().split("T")[0]}`,
        providerBalance: r.providerBalanceMinor,
        declaredCost: r.declaredCostMinor,
        discrepancy: r.discrepancyMinor,
        discrepancyBps: r.discrepancyBps,
        status: r.status,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt?.toISOString(),
        notes: r.notes
      }))
    };
  }

  async adminPurchaseLimits(query: { workspaceId?: string }) {
    const where = query.workspaceId ? { workspaceId: query.workspaceId } : {};
    const limits = await this.db.virtualNumberPurchaseLimit.findMany({
      where,
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { periodEnd: "desc" },
      take: 100
    });

    return limits.map((l) => ({
      id: l.id,
      workspace: l.workspace.name,
      workspaceId: l.workspaceId,
      userId: l.userId,
      period: l.periodType,
      limitMinor: l.limitMinor,
      spentMinor: l.spentMinor,
      available: l.limitMinor - l.spentMinor,
      utilizationBps: l.limitMinor > 0 ? Math.round((l.spentMinor / l.limitMinor) * 10_000) : 0,
      periodStart: l.periodStart.toISOString(),
      periodEnd: l.periodEnd.toISOString()
    }));
  }

  async adminSetPurchaseLimit(data: { workspaceId: string; limitMinor: number; periodType?: string }) {
    const periodType = data.periodType ?? "MONTH";
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Remove old limit for this workspace and period
    await this.db.virtualNumberPurchaseLimit.deleteMany({
      where: {
        workspaceId: data.workspaceId,
        periodType,
        periodStart: { lte: now },
        periodEnd: { gte: now }
      }
    });

    // Create new limit
    const limit = await this.db.virtualNumberPurchaseLimit.create({
      data: {
        id: uid("vnpl"),
        workspaceId: data.workspaceId,
        periodType,
        limitMinor: data.limitMinor,
        periodStart: monthStart,
        periodEnd: monthEnd
      }
    });

    return {
      id: limit.id,
      workspaceId: limit.workspaceId,
      period: limit.periodType,
      limitMinor: limit.limitMinor,
      spentMinor: limit.spentMinor,
      periodStart: limit.periodStart.toISOString(),
      periodEnd: limit.periodEnd.toISOString()
    };
  }
}
