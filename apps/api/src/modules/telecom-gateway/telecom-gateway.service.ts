import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type { Prisma, DatabaseClient } from "@fliptrybe/database";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";
import { featureFlags } from "@fliptrybe/feature-flags";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import { PhoneNumberService } from "./phone-number.service";
import { TelecomRoutingService } from "./telecom-routing.service";
import { TelecomCatalogService } from "./telecom-catalog.service";
import { TelecomHealthService } from "./telecom-health.service";
import type {
  BuyTelecomAirtimeDto,
  BuyTelecomDataDto,
  TelecomOrderQueryDto
} from "./telecom-gateway.dtos";

type DbClient = DatabaseClient | Prisma.TransactionClient;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// 2% margin over wholesale — same convention as VtuService.
const MARKUP_BPS = 200;

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

function maskMsisdn(msisdn: string): string {
  return msisdn.slice(0, 4) + "****" + msisdn.slice(-3);
}

/**
 * The single entry point for global airtime/data. Every caller — controller,
 * future eSIM/utility-bill verticals — goes through detect() -> listProducts()
 * -> buyAirtime()/buyData(). None of them ever see a provider name; that lives
 * entirely inside TelecomRoutingService.
 */
@Injectable()
export class TelecomGatewayService {
  private readonly logger = new Logger(TelecomGatewayService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly phoneNumbers: PhoneNumberService,
    private readonly routing: TelecomRoutingService,
    private readonly catalog: TelecomCatalogService,
    private readonly health: TelecomHealthService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  private assertEnabled() {
    if (!featureFlags.telecomGateway) {
      throw new BadRequestException("Telecom gateway is not yet available.");
    }
  }

  // ─── Detection + routing ─────────────────────────────────────────────────

  async detectNumber(rawPhoneNumber: string) {
    this.assertEnabled();
    const detected = this.phoneNumbers.detect(rawPhoneNumber);
    const route = this.routing.resolveRoute(detected.countryIso);
    const operators = await this.catalog.getOperators(detected.countryIso);
    return { ...detected, provider: route.provider, operators };
  }

  async listProducts(countryIso: string, operatorId: string) {
    this.assertEnabled();
    const [airtime, data] = await Promise.all([
      this.catalog.getAirtimeProducts(countryIso, operatorId),
      this.catalog.getDataBundles(countryIso, operatorId)
    ]);
    return { airtime, data };
  }

  async listProviderHealth() {
    const results = await Promise.all(
      this.routing.listKnownProviders().map(async (name) => {
        const adapter = this.routing.buildAdapter(name);
        return this.health.check(adapter, true);
      })
    );
    return results;
  }

  // ─── Wallet helpers (mirrors VtuService — same wallet, same ledger) ────────
  // Payment source seam: today the wallet debit below IS the confirmed payment.
  // When non-wallet checkout sources (card/USDT/bank transfer) land, they publish
  // a "payment succeeded" event and this debit is replaced by a no-op verification
  // against that event — buyAirtime/buyData's shape does not need to change.

  private async getWallet(workspaceId: string, currency: string, db: DbClient = this.db) {
    return db.wallet.upsert({
      where: { workspaceId_currency: { workspaceId, currency } },
      update: {},
      create: { workspaceId, currency }
    });
  }

  private async debitWallet(
    walletId: string,
    amountMinor: number,
    currency: string,
    description: string,
    orderId: string,
    db: DbClient
  ) {
    const ledgerId = uid("led");
    const idemKey = `telecom_debit_${orderId}`;

    return db.ledgerEntry.create({
      data: {
        id: ledgerId,
        walletId,
        kind: "DEBIT",
        amountMinor,
        currency,
        reference: idemKey,
        description,
        idempotencyKey: idemKey,
        sourceType: "TelecomOrder",
        sourceId: orderId
      }
    });
  }

  private async reverseCharge(orderId: string) {
    const order = await this.db.telecomOrder.findUnique({ where: { id: orderId } });
    if (!order?.debitLedgerEntryId) return;

    const original = await this.db.ledgerEntry.findUnique({ where: { id: order.debitLedgerEntryId } });
    if (!original) return;

    const idemKey = `telecom_reversal_${orderId}`;
    await this.db.ledgerEntry.create({
      data: {
        id: uid("led"),
        walletId: original.walletId,
        kind: "REVERSAL",
        amountMinor: original.amountMinor,
        currency: original.currency,
        reference: idemKey,
        description: `Reversal: Telecom order ${orderId}`,
        idempotencyKey: idemKey,
        sourceType: "TelecomOrder",
        sourceId: orderId
      }
    });
  }

  // ─── Airtime purchase ───────────────────────────────────────────────────────

  async buyAirtime(ctx: AuthenticatedRequestContext, dto: BuyTelecomAirtimeDto) {
    this.assertEnabled();
    const { workspaceId } = ctx;

    if (!dto.paymentConfirmed) {
      throw new ForbiddenException("Payment must be confirmed before the telecom gateway fulfils an order.");
    }
    if (!Number.isInteger(dto.amountMinor) || dto.amountMinor <= 0) {
      throw new BadRequestException("amountMinor must be a positive integer.");
    }

    const detected = this.phoneNumbers.detect(dto.phoneNumber);
    const adapter = await this.routing.selectAdapter(detected.countryIso);

    const products = await this.catalog.getAirtimeProducts(detected.countryIso, dto.operatorId);
    const product = products[0];
    if (!product) throw new BadRequestException("This operator does not support airtime top-ups.");
    if (dto.amountMinor < product.minAmountMinor || dto.amountMinor > product.maxAmountMinor) {
      throw new BadRequestException(
        `Amount must be between ${product.minAmountMinor / 100} and ${product.maxAmountMinor / 100} ${product.currency}.`
      );
    }

    const discountBps = product.discountBps ?? 0;
    const wholesaleCost = Math.ceil(dto.amountMinor * (1 - discountBps / 10_000));
    const chargeMinor = Math.ceil(wholesaleCost * (1 + MARKUP_BPS / 10_000));

    const orderId = uid("tel");
    const reference = `TG${orderId.replace(/-/g, "").slice(0, 18).toUpperCase()}`;
    const msisdnMasked = maskMsisdn(detected.msisdn);

    const order = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(workspaceId, product.currency, tx);
      const entries = (await tx.ledgerEntry.findMany({ where: { walletId: wallet.id } })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < chargeMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ${(chargeMinor / 100).toFixed(2)} ${product.currency}.`
        );
      }

      const newOrder = await tx.telecomOrder.create({
        data: {
          id: orderId,
          workspaceId,
          productType: "AIRTIME",
          countryIso: detected.countryIso,
          operatorId: dto.operatorId,
          msisdnMasked,
          msisdnEncrypted: detected.msisdn,
          amountMinor: chargeMinor,
          costMinor: wholesaleCost,
          currency: product.currency,
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `telecom_order_${orderId}`
        }
      });

      const ledgerEntry = await this.debitWallet(
        wallet.id,
        chargeMinor,
        product.currency,
        `Airtime ${detected.countryIso} ${(dto.amountMinor / 100).toFixed(2)} ${product.currency} → ${msisdnMasked}`,
        orderId,
        tx
      );

      return tx.telecomOrder.update({
        where: { id: newOrder.id },
        data: { debitLedgerEntryId: ledgerEntry.id }
      });
    });

    try {
      const result = await adapter.purchaseAirtime({
        operatorId: dto.operatorId,
        msisdn: detected.msisdn,
        amountMinor: dto.amountMinor,
        reference
      });

      const finalStatus =
        result.status === "DELIVERED" ? "DELIVERED" : result.status === "SUBMITTED" ? "SUBMITTED" : "AMBIGUOUS";

      await this.db.telecomOrder.update({
        where: { id: order.id },
        data: {
          status: finalStatus,
          providerReference: result.providerReference,
          ...(result.failureReason ? { failureReason: result.failureReason } : {})
        }
      });

      return this.db.telecomOrder.findUniqueOrThrow({ where: { id: order.id } });
    } catch (err) {
      this.logger.error(`Telecom airtime submit error for ${order.id}: ${String(err)}`);
      await this.db.telecomOrder.update({ where: { id: order.id }, data: { status: "AMBIGUOUS" } });
      return this.db.telecomOrder.findUniqueOrThrow({ where: { id: order.id } });
    }
  }

  // ─── Data purchase ───────────────────────────────────────────────────────────

  async buyData(ctx: AuthenticatedRequestContext, dto: BuyTelecomDataDto) {
    this.assertEnabled();
    const { workspaceId } = ctx;

    if (!dto.paymentConfirmed) {
      throw new ForbiddenException("Payment must be confirmed before the telecom gateway fulfils an order.");
    }

    const detected = this.phoneNumbers.detect(dto.phoneNumber);
    const adapter = await this.routing.selectAdapter(detected.countryIso);

    const bundles = await this.catalog.getDataBundles(detected.countryIso, dto.operatorId);
    const bundle = bundles.find((b) => b.bundleId === dto.bundleId);
    if (!bundle) throw new BadRequestException("Data bundle not found or unavailable for this operator.");

    const chargeMinor = Math.ceil(bundle.costMinor * (1 + MARKUP_BPS / 10_000));
    const orderId = uid("tel");
    const reference = `TG${orderId.replace(/-/g, "").slice(0, 18).toUpperCase()}`;
    const msisdnMasked = maskMsisdn(detected.msisdn);

    const order = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(workspaceId, bundle.currency, tx);
      const entries = (await tx.ledgerEntry.findMany({ where: { walletId: wallet.id } })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < chargeMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ${(chargeMinor / 100).toFixed(2)} ${bundle.currency}.`
        );
      }

      const newOrder = await tx.telecomOrder.create({
        data: {
          id: orderId,
          workspaceId,
          productType: "DATA",
          countryIso: detected.countryIso,
          operatorId: dto.operatorId,
          bundleId: dto.bundleId,
          msisdnMasked,
          msisdnEncrypted: detected.msisdn,
          amountMinor: chargeMinor,
          costMinor: bundle.costMinor,
          currency: bundle.currency,
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `telecom_order_${orderId}`
        }
      });

      const ledgerEntry = await this.debitWallet(
        wallet.id,
        chargeMinor,
        bundle.currency,
        `Data ${bundle.displayName} → ${msisdnMasked}`,
        orderId,
        tx
      );

      return tx.telecomOrder.update({
        where: { id: newOrder.id },
        data: { debitLedgerEntryId: ledgerEntry.id }
      });
    });

    try {
      const result = await adapter.purchaseData({
        operatorId: dto.operatorId,
        msisdn: detected.msisdn,
        bundleId: dto.bundleId,
        reference
      });

      const finalStatus =
        result.status === "DELIVERED" ? "DELIVERED" : result.status === "SUBMITTED" ? "SUBMITTED" : "AMBIGUOUS";

      await this.db.telecomOrder.update({
        where: { id: order.id },
        data: {
          status: finalStatus,
          providerReference: result.providerReference,
          ...(result.failureReason ? { failureReason: result.failureReason } : {})
        }
      });

      return this.db.telecomOrder.findUniqueOrThrow({ where: { id: order.id } });
    } catch (err) {
      this.logger.error(`Telecom data submit error for ${order.id}: ${String(err)}`);
      await this.db.telecomOrder.update({ where: { id: order.id }, data: { status: "AMBIGUOUS" } });
      return this.db.telecomOrder.findUniqueOrThrow({ where: { id: order.id } });
    }
  }

  // ─── Transaction status + refunds ───────────────────────────────────────────

  async getOrderStatus(ctx: AuthenticatedRequestContext, orderId: string) {
    const order = await this.db.telecomOrder.findFirst({
      where: { id: orderId, workspaceId: ctx.workspaceId }
    });
    if (!order) throw new BadRequestException("Telecom order not found.");
    if (!order.providerReference || order.status === "DELIVERED" || order.status === "FAILED") {
      return order;
    }

    const adapter = this.routing.buildAdapter(order.providerName);
    const status = await adapter.checkTransaction(order.providerReference);

    if (status.status !== "AMBIGUOUS" && status.status !== order.status) {
      const finalStatus = status.status === "DELIVERED" ? "DELIVERED" : status.status === "FAILED" ? "REVERSED" : "SUBMITTED";
      if (finalStatus === "REVERSED") await this.reverseCharge(order.id);

      return this.db.telecomOrder.update({
        where: { id: order.id },
        data: { status: finalStatus, ...(status.failureReason ? { failureReason: status.failureReason } : {}) }
      });
    }

    return order;
  }

  async listOrders(ctx: AuthenticatedRequestContext, query: TelecomOrderQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const where = {
      workspaceId: ctx.workspaceId,
      ...(query.countryIso ? { countryIso: query.countryIso.toUpperCase() } : {}),
      ...(query.status ? { status: query.status as never } : {})
    };

    const [orders, total] = await Promise.all([
      this.db.telecomOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      this.db.telecomOrder.count({ where })
    ]);

    return { orders, total, page, limit };
  }
}
