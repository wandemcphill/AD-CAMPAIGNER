import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { Prisma, type DatabaseClient } from "@fliptrybe/database";
import { calculateAvailableBalance, runChargeSaga } from "@fliptrybe/payments";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";
import {
  createMockRemittanceProvider,
  createMockVirtualAccountProvider,
  createMockVirtualCardProvider,
  type RemittanceProvider,
  type VirtualAccountProvider,
  type VirtualCardProvider
} from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type {
  CreateVirtualAccountDto,
  FundVirtualCardDto,
  IssueVirtualCardDto,
  RemittanceQuoteDto,
  SendRemittanceDto
} from "./financial-products.dtos";

type DbClient = DatabaseClient | Prisma.TransactionClient;
type DbLedgerEntryRow = {
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
};

function toTypedEntry(e: DbLedgerEntryRow): LedgerEntry {
  return {
    id: e.id,
    walletId: e.walletId,
    kind: e.kind as LedgerEntry["kind"],
    amount: { amountMinor: e.amountMinor, currency: e.currency as LedgerEntry["amount"]["currency"] },
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

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

/**
 * Phase E — accounts, cards, remittance. No real provider is contracted yet
 * (business-side diligence over BridgeCard/SwervPay/Payceler/Nium/Swan/BVNK is the
 * actual blocker, not code — see the convergence plan). Every operation here runs
 * against a mock adapter so the API surface, saga wiring, and schema are exercised
 * now and a real adapter can be dropped in later without touching anything above
 * this layer.
 */
@Injectable()
export class FinancialProductsService {
  private readonly logger = new Logger(FinancialProductsService.name);
  private readonly accountProvider: VirtualAccountProvider = createMockVirtualAccountProvider();
  private readonly cardProvider: VirtualCardProvider = createMockVirtualCardProvider();
  private readonly remittanceProvider: RemittanceProvider = createMockRemittanceProvider();

  constructor(private readonly prismaService: PrismaService) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  private async getWallet(workspaceId: string, db: DbClient = this.db) {
    const wallet = await db.wallet.findFirst({ where: { workspaceId, currency: "NGN" } });
    if (!wallet) throw new NotFoundException("Wallet not found.");
    return wallet;
  }

  // ─── Virtual Accounts ───────────────────────────────────────────────────────

  async createAccount(ctx: AuthenticatedRequestContext, dto: CreateVirtualAccountDto) {
    const currency = dto.currency ?? "NGN";
    const reference = uid("va");

    const details = await this.accountProvider.createAccount({
      reference,
      accountName: dto.accountName,
      currency
    });

    return this.db.virtualAccount.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        providerName: this.accountProvider.name,
        providerAccountId: details.providerAccountId,
        accountNumber: details.accountNumber,
        bankName: details.bankName,
        bankCode: details.bankCode,
        accountName: details.accountName,
        currency
      }
    });
  }

  async listAccounts(ctx: AuthenticatedRequestContext) {
    return this.db.virtualAccount.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }

  async getAccount(ctx: AuthenticatedRequestContext, id: string) {
    const account = await this.db.virtualAccount.findFirst({
      where: { id, workspaceId: ctx.workspaceId }
    });
    if (!account) throw new NotFoundException("Virtual account not found.");

    const live = await this.accountProvider.getAccount(account.providerAccountId);
    return { ...account, balanceMinor: live.balanceMinor };
  }

  async closeAccount(ctx: AuthenticatedRequestContext, id: string) {
    const account = await this.db.virtualAccount.findFirst({
      where: { id, workspaceId: ctx.workspaceId }
    });
    if (!account) throw new NotFoundException("Virtual account not found.");
    if (account.status === "CLOSED") return account;

    await this.accountProvider.closeAccount(account.providerAccountId);
    return this.db.virtualAccount.update({
      where: { id: account.id },
      data: { status: "CLOSED", closedAt: new Date() }
    });
  }

  // ─── Virtual Cards ──────────────────────────────────────────────────────────

  async issueCard(ctx: AuthenticatedRequestContext, dto: IssueVirtualCardDto) {
    const currency = dto.currency ?? "NGN";
    const cardId = uid("vc");
    const idempotencyKey = `virtual_card_${cardId}`;

    // hold_and_flag (default): a provider failure after we've already debited is
    // ambiguous — the card may have been issued on their side despite a timeout on
    // ours. Ops resolves it rather than us guessing whether to auto-reverse.
    const outcome = await runChargeSaga({
      debit: async () => {
        const card = await this.db.$transaction(async (tx) => {
          const wallet = await this.getWallet(ctx.workspaceId, tx);
          const entries = (await tx.ledgerEntry.findMany({
            where: { walletId: wallet.id }
          })) as DbLedgerEntryRow[];
          const available = calculateAvailableBalance(entries.map(toTypedEntry));

          if (available.amountMinor < dto.fundingAmountMinor) {
            throw new ForbiddenException(
              `Insufficient balance. Required ₦${(dto.fundingAmountMinor / 100).toFixed(2)}.`
            );
          }

          const ledgerEntry = await tx.ledgerEntry.create({
            data: {
              walletId: wallet.id,
              kind: "DEBIT",
              amountMinor: dto.fundingAmountMinor,
              currency,
              reference: idempotencyKey,
              description: `Virtual card funding: ${dto.cardholderName}`,
              idempotencyKey,
              sourceType: "VirtualCardWalletCharge",
              sourceId: cardId
            }
          });

          const charge = await tx.virtualCardWalletCharge.create({
            data: {
              workspaceId: ctx.workspaceId,
              walletId: wallet.id,
              cardId,
              idempotencyKey,
              amountMinor: dto.fundingAmountMinor,
              currency,
              status: "CHARGED",
              debitLedgerEntryId: ledgerEntry.id
            }
          });

          return this.db.virtualCard.create({
            data: {
              id: cardId,
              workspaceId: ctx.workspaceId,
              userId: ctx.userId,
              providerName: this.cardProvider.name,
              providerCardId: "", // filled in by execute() once the provider confirms
              last4: "0000",
              expiryMonth: 1,
              expiryYear: new Date().getFullYear() + 1,
              brand: "VISA",
              currency,
              idempotencyKey,
              walletId: wallet.id,
              ledgerEntryId: ledgerEntry.id,
              chargeId: charge.id
            }
          });
        });

        return {
          order: card,
          charge: {
            chargeId: card.chargeId!,
            walletId: card.walletId!,
            amountMinor: dto.fundingAmountMinor,
            currency: currency as CurrencyCode,
            debitLedgerEntryId: card.ledgerEntryId
          }
        };
      },

      execute: async (card) => {
        const details = await this.cardProvider.issueCard({
          reference: cardId,
          cardholderName: dto.cardholderName,
          currency,
          fundingAmountMinor: dto.fundingAmountMinor
        });

        return this.db.virtualCard.update({
          where: { id: card.id },
          data: {
            providerCardId: details.providerCardId,
            last4: details.last4,
            expiryMonth: details.expiryMonth,
            expiryYear: details.expiryYear,
            brand: details.brand,
            status: "ACTIVE"
          }
        });
      },

      compensate: async () => {}
    });

    if (outcome.status !== "completed") {
      this.logger.error(`Card issuance ${cardId} needs ops review: ${String(outcome.error)}`);
      throw new BadRequestException(
        "Card funding was charged but issuance could not be confirmed. This has been flagged for review."
      );
    }

    return outcome.result;
  }

  async listCards(ctx: AuthenticatedRequestContext) {
    return this.db.virtualCard.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }

  private async getOwnedCard(ctx: AuthenticatedRequestContext, id: string) {
    const card = await this.db.virtualCard.findFirst({
      where: { id, workspaceId: ctx.workspaceId }
    });
    if (!card) throw new NotFoundException("Virtual card not found.");
    return card;
  }

  async fundCard(ctx: AuthenticatedRequestContext, id: string, dto: FundVirtualCardDto) {
    const card = await this.getOwnedCard(ctx, id);
    if (card.status !== "ACTIVE") {
      throw new BadRequestException("Only an active card can be funded.");
    }

    const outcome = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(ctx.workspaceId, tx);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < dto.amountMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(dto.amountMinor / 100).toFixed(2)}.`
        );
      }

      const idempotencyKey = `virtual_card_topup_${uid("t")}`;
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          kind: "DEBIT",
          amountMinor: dto.amountMinor,
          currency: card.currency,
          reference: idempotencyKey,
          description: `Virtual card top-up: ${card.last4}`,
          idempotencyKey,
          sourceType: "VirtualCard",
          sourceId: card.id
        }
      });

      return this.cardProvider.fundCard({
        providerCardId: card.providerCardId,
        amountMinor: dto.amountMinor,
        reference: idempotencyKey
      });
    });

    return outcome;
  }

  async freezeCard(ctx: AuthenticatedRequestContext, id: string) {
    const card = await this.getOwnedCard(ctx, id);
    await this.cardProvider.freezeCard(card.providerCardId);
    return this.db.virtualCard.update({ where: { id: card.id }, data: { status: "FROZEN" } });
  }

  async unfreezeCard(ctx: AuthenticatedRequestContext, id: string) {
    const card = await this.getOwnedCard(ctx, id);
    await this.cardProvider.unfreezeCard(card.providerCardId);
    return this.db.virtualCard.update({ where: { id: card.id }, data: { status: "ACTIVE" } });
  }

  async terminateCard(ctx: AuthenticatedRequestContext, id: string) {
    const card = await this.getOwnedCard(ctx, id);
    if (card.status === "TERMINATED") return card;

    const result = await this.cardProvider.terminateCard(card.providerCardId);

    return this.db.$transaction(async (tx) => {
      if (result.refundableMinor > 0 && card.walletId) {
        const idempotencyKey = `virtual_card_refund_${card.id}`;
        const reversal = await tx.ledgerEntry.create({
          data: {
            walletId: card.walletId,
            kind: "REVERSAL",
            amountMinor: result.refundableMinor,
            currency: card.currency,
            reference: idempotencyKey,
            description: `Virtual card termination refund: ${card.last4}`,
            idempotencyKey,
            sourceType: "VirtualCard",
            sourceId: card.id
          }
        });

        if (card.chargeId) {
          await tx.virtualCardWalletCharge.update({
            where: { id: card.chargeId },
            data: { status: "REFUNDED", refundLedgerEntryId: reversal.id }
          });
        }
      }

      return tx.virtualCard.update({
        where: { id: card.id },
        data: { status: "TERMINATED", terminatedAt: new Date() }
      });
    });
  }

  // ─── Remittance ─────────────────────────────────────────────────────────────

  async getRemittanceQuote(dto: RemittanceQuoteDto) {
    return this.remittanceProvider.getQuote({
      sourceCurrency: dto.sourceCurrency,
      destinationCurrency: dto.destinationCurrency,
      sourceAmountMinor: dto.sourceAmountMinor
    });
  }

  async sendRemittance(ctx: AuthenticatedRequestContext, dto: SendRemittanceDto) {
    const transferId = uid("rt");
    const idempotencyKey = `remittance_${transferId}`;

    const outcome = await runChargeSaga({
      debit: async () => {
        const transfer = await this.db.$transaction(async (tx) => {
          const wallet = await this.getWallet(ctx.workspaceId, tx);
          const entries = (await tx.ledgerEntry.findMany({
            where: { walletId: wallet.id }
          })) as DbLedgerEntryRow[];
          const available = calculateAvailableBalance(entries.map(toTypedEntry));

          if (available.amountMinor < dto.sourceAmountMinor) {
            throw new ForbiddenException(
              `Insufficient balance. Required ₦${(dto.sourceAmountMinor / 100).toFixed(2)}.`
            );
          }

          const ledgerEntry = await tx.ledgerEntry.create({
            data: {
              walletId: wallet.id,
              kind: "DEBIT",
              amountMinor: dto.sourceAmountMinor,
              currency: dto.sourceCurrency,
              reference: idempotencyKey,
              description: `Remittance to ${dto.recipientName}`,
              idempotencyKey,
              sourceType: "RemittanceWalletCharge",
              sourceId: transferId
            }
          });

          const charge = await tx.remittanceWalletCharge.create({
            data: {
              workspaceId: ctx.workspaceId,
              walletId: wallet.id,
              transferId,
              idempotencyKey,
              amountMinor: dto.sourceAmountMinor,
              currency: dto.sourceCurrency,
              status: "CHARGED",
              debitLedgerEntryId: ledgerEntry.id
            }
          });

          return tx.remittanceTransfer.create({
            data: {
              id: transferId,
              workspaceId: ctx.workspaceId,
              userId: ctx.userId,
              providerName: this.remittanceProvider.name,
              quoteId: dto.quoteId,
              recipientName: dto.recipientName,
              recipientAccountNumber: dto.recipientAccountNumber,
              recipientBankCode: dto.recipientBankCode,
              recipientCountry: dto.recipientCountry,
              sourceAmountMinor: dto.sourceAmountMinor,
              sourceCurrency: dto.sourceCurrency,
              destinationAmountMinor: dto.destinationAmountMinor,
              destinationCurrency: dto.destinationCurrency,
              feeMinor: dto.feeMinor,
              status: "CHARGED",
              idempotencyKey,
              walletId: wallet.id,
              ledgerEntryId: ledgerEntry.id,
              chargeId: charge.id
            }
          });
        });

        return {
          order: transfer,
          charge: {
            chargeId: transfer.chargeId!,
            walletId: transfer.walletId!,
            amountMinor: transfer.sourceAmountMinor,
            currency: transfer.sourceCurrency as CurrencyCode,
            debitLedgerEntryId: transfer.ledgerEntryId
          }
        };
      },

      execute: async (transfer) => {
        const result = await this.remittanceProvider.sendTransfer({
          reference: transferId,
          quoteId: dto.quoteId,
          recipient: {
            name: dto.recipientName,
            accountNumber: dto.recipientAccountNumber,
            bankCode: dto.recipientBankCode,
            country: dto.recipientCountry
          }
        });

        return this.db.remittanceTransfer.update({
          where: { id: transfer.id },
          data: {
            providerReference: result.providerReference,
            status: result.status
          }
        });
      },

      compensate: async () => {}
    });

    if (outcome.status !== "completed") {
      this.logger.error(`Remittance ${transferId} needs ops review: ${String(outcome.error)}`);
      throw new BadRequestException(
        "Transfer was charged but could not be confirmed with the provider. This has been flagged for review."
      );
    }

    return outcome.result;
  }

  async listRemittanceTransfers(ctx: AuthenticatedRequestContext) {
    return this.db.remittanceTransfer.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }
}
