import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";

import { calculateAvailableBalance } from "@fliptrybe/payments";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";
import {
  createSogoRmbAdapter,
  SogoRmbProviderError,
  type RmbBuyProvider
} from "@fliptrybe/providers";
import type { RmbOrderStatus } from "@fliptrybe/database";
import { featureFlags } from "@fliptrybe/feature-flags";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { CreateRmbOrderDto } from "./rmb.dtos";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

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
export class RmbService {
  private readonly logger = new Logger(RmbService.name);
  private readonly provider: RmbBuyProvider;

  constructor(private readonly prismaService: PrismaService) {
    const apiKey = process.env["SOGO_SECRET_KEY"] ?? process.env["SOGO_API_KEY"] ?? "";
    this.provider = createSogoRmbAdapter({
      apiKey,
      sandbox: process.env["SOGO_SANDBOX"] === "true",
      ...(process.env["SOGO_BASE_URL"] ? { baseUrl: process.env["SOGO_BASE_URL"] } : {})
    });
  }

  private assertProviderConfigured() {
    const apiKey = process.env["SOGO_SECRET_KEY"] ?? process.env["SOGO_API_KEY"];
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "RMB is temporarily unavailable because the Sogo secret key is not configured."
      );
    }
  }

  private get db() {
    return this.prismaService.client;
  }

  async getRates() {
    if (!featureFlags.rmbBuy) {
      throw new BadRequestException("RMB buy is not yet available.");
    }
    this.assertProviderConfigured();
    return this.provider.getRates();
  }

  private async getWallet(workspaceId: string) {
    return this.db.wallet.upsert({
      where: { workspaceId_currency: { workspaceId, currency: "NGN" } },
      update: {},
      create: { workspaceId, currency: "NGN" }
    });
  }

  async createOrder(ctx: AuthenticatedRequestContext, dto: CreateRmbOrderDto) {
    if (!featureFlags.rmbBuy) {
      throw new BadRequestException("RMB buy is not yet available.");
    }
    this.assertProviderConfigured();

    if (!dto.rmbAmount || dto.rmbAmount <= 0) {
      throw new BadRequestException("rmbAmount must be a positive number.");
    }
    if (!dto.recipientName.trim()) {
      throw new BadRequestException("recipientName is required.");
    }
    if (!dto.description || dto.description.trim().length < 5) {
      throw new BadRequestException("description must be at least 5 characters.");
    }

    if (dto.channel === "alipay" || dto.channel === "wechat") {
      if (!dto.accountType) {
        throw new BadRequestException(`${dto.channel} account type is required.`);
      }
      if (!dto.qrCodeUrl) {
        throw new BadRequestException("A recipient QR code is required for Alipay and WeChat orders.");
      }
    } else if (!dto.recipientBankName || !dto.recipientBankAccountNumber) {
      throw new BadRequestException(
        "recipientBankName and recipientBankAccountNumber are required for bank transfers."
      );
    }

    const existingByKey = await this.db.rmbOrder.findUnique({
      where: { idempotencyKey: dto.idempotencyKey }
    });
    if (existingByKey) {
      if (existingByKey.workspaceId !== ctx.workspaceId) {
        throw new BadRequestException("Idempotency key was already used for another scope.");
      }
      return existingByKey;
    }

    const rates = await this.provider.getRates();
    const channelRates = rates.channels.find((c) => c.channel === dto.channel);
    if (!channelRates || !channelRates.isAvailable) {
      throw new BadRequestException(`RMB channel ${dto.channel} is not currently available.`);
    }

    const tierSource =
      dto.accountType && channelRates.accountTypes.length > 0
        ? channelRates.accountTypes.find((a) => a.type === dto.accountType && a.isAvailable)?.rates
        : channelRates.rates;
    const tier = (tierSource ?? channelRates.rates).find(
      (t) => dto.rmbAmount >= t.minRmb && (t.maxRmb === null || dto.rmbAmount <= t.maxRmb)
    );
    if (!tier) {
      throw new BadRequestException("No matching rate tier for this amount.");
    }

    const ngnAmountMinor = Math.round(dto.rmbAmount * tier.ngnPerRmb * 100);
    const orderId = uid("rmb");

    const order = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(ctx.workspaceId);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < ngnAmountMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(ngnAmountMinor / 100).toFixed(2)}.`
        );
      }

      const ledgerId = uid("led");
      const idemKey = `rmb_debit_${orderId}`;
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          id: ledgerId,
          walletId: wallet.id,
          kind: "DEBIT",
          amountMinor: ngnAmountMinor,
          currency: "NGN",
          reference: idemKey,
          description: `RMB buy ¥${dto.rmbAmount} (${dto.channel}) → ${dto.recipientName}`,
          idempotencyKey: idemKey,
          sourceType: "RmbOrder",
          sourceId: orderId
        }
      });

      return tx.rmbOrder.create({
        data: {
          id: orderId,
          workspaceId: ctx.workspaceId,
          walletId: wallet.id,
          providerName: this.provider.name,
          channel: dto.channel.toUpperCase() as never,
          ...(dto.accountType ? { accountType: dto.accountType } : {}),
          rmbAmount: dto.rmbAmount,
          ngnAmountMinor,
          exchangeRate: tier.ngnPerRmb,
          recipientName: dto.recipientName,
          ...(dto.recipientIdentifier ? { recipientIdentifier: dto.recipientIdentifier } : {}),
          ...(dto.recipientBankName ? { recipientBankName: dto.recipientBankName } : {}),
          ...(dto.recipientBankAccountNumber
            ? { recipientBankAccount: dto.recipientBankAccountNumber }
            : {}),
          ...(dto.qrCodeUrl ? { qrCodeUrl: dto.qrCodeUrl } : {}),
          description: dto.description,
          status: "PROCESSING",
          idempotencyKey: dto.idempotencyKey,
          debitLedgerEntryId: ledgerEntry.id
        }
      });
    });

    try {
      const result = await this.provider.submitOrder({
        channel: dto.channel,
        ...(dto.accountType ? { accountType: dto.accountType } : {}),
        rmbAmount: dto.rmbAmount,
        recipientName: dto.recipientName,
        ...(dto.recipientIdentifier ? { recipientIdentifier: dto.recipientIdentifier } : {}),
        ...(dto.recipientBankName ? { recipientBankName: dto.recipientBankName } : {}),
        ...(dto.recipientBankAccountNumber
          ? { recipientBankAccountNumber: dto.recipientBankAccountNumber }
          : {}),
        ...(dto.qrCodeUrl ? { qrCodeUrl: dto.qrCodeUrl } : {}),
        description: dto.description,
        idempotencyKey: dto.idempotencyKey
      });

      return this.db.rmbOrder.update({
        where: { id: order.id },
        data: { providerReference: result.providerReference }
      });
    } catch (err) {
      this.logger.error(`RMB submit error for ${order.id}: ${String(err)}`);

      // A deterministic client/configuration rejection cannot have created a
      // provider transaction. Reverse our local debit immediately. Network
      // errors, 429s and 5xx responses remain PROCESSING because the provider
      // outcome is ambiguous and must be reconciled before retrying.
      if (
        err instanceof SogoRmbProviderError &&
        err.statusCode >= 400 &&
        err.statusCode < 500 &&
        err.statusCode !== 409 &&
        err.statusCode !== 429
      ) {
        const refundKey = `rmb_cancel_${order.id}`;
        await this.db.$transaction(async (tx) => {
          const existingRefund = await tx.ledgerEntry.findUnique({
            where: { idempotencyKey: refundKey }
          });
          const refundEntry =
            existingRefund ??
            (await tx.ledgerEntry.create({
              data: {
                id: uid("led"),
                walletId: order.walletId,
                kind: "REVERSAL",
                amountMinor: order.ngnAmountMinor,
                currency: "NGN",
                reference: refundKey,
                description: `RMB order cancelled before provider acceptance → ${order.recipientName}`,
                idempotencyKey: refundKey,
                sourceType: "RmbOrder",
                sourceId: order.id
              }
            }));
          await tx.rmbOrder.update({
            where: { id: order.id },
            data: { status: "CANCELLED", refundLedgerEntryId: refundEntry.id }
          });
        });
        return this.db.rmbOrder.findUniqueOrThrow({ where: { id: order.id } });
      }

      return order;
    }
  }

  async listOrders(ctx: AuthenticatedRequestContext) {
    return this.db.rmbOrder.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async adminListOrders(workspaceId?: string, status?: string) {
    return this.db.rmbOrder.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        ...(status ? { status: status as RmbOrderStatus } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }
}
