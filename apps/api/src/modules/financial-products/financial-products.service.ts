import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";

import { Prisma, type DatabaseClient } from "@fliptrybe/database";
import { calculateAvailableBalance, runChargeSaga } from "@fliptrybe/payments";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";
import {
  createPayscribeVirtualCardProvider,
  createSwapprRemittanceProvider,
  createSwapprVirtualAccountProvider,
  createYativoRemittanceProvider,
  type RemittanceProvider,
  type VirtualAccountProvider,
  type VirtualCardProvider
} from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import { ProviderRouterService } from "../providers/provider-router.service";
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
 * Phase E — accounts, cards, remittance. No real provider is CONTRACTED yet:
 * there are no live API credentials for Swappr (virtual accounts + remittance),
 * Payscribe (virtual cards), or Yativo (remittance fallback) in this environment.
 * Provider selection goes through ProviderRouterService (ProviderConfig-driven,
 * same domain-agnostic router used by vtu/virtual-numbers/etc) so these verticals
 * are ready to flip live the moment credentials + verified endpoint shapes exist —
 * see packages/providers/src/financial-products.ts for the adapter caveats. When
 * no ProviderConfig row is enabled for a domain, methods that need a provider
 * throw ServiceUnavailableException rather than silently falling back to a mock.
 */
@Injectable()
export class FinancialProductsService {
  private readonly logger = new Logger(FinancialProductsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly providerRouter: ProviderRouterService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Adapter factories ──────────────────────────────────────────────────────

  private buildAccountAdapter(providerName: string): VirtualAccountProvider {
    switch (providerName) {
      case "swappr":
        return createSwapprVirtualAccountProvider({
          apiKey: process.env["SWAPPR_API_KEY"] ?? "",
          ...(process.env["SWAPPR_BASE_URL"] ? { baseUrl: process.env["SWAPPR_BASE_URL"] } : {})
        });
      default:
        throw new ServiceUnavailableException(
          `No virtual account provider adapter is implemented for "${providerName}".`
        );
    }
  }

  private buildCardAdapter(providerName: string): VirtualCardProvider {
    switch (providerName) {
      case "payscribe":
        return createPayscribeVirtualCardProvider({
          apiKey: process.env["PAYSCRIBE_API_KEY"] ?? "",
          ...(process.env["PAYSCRIBE_BASE_URL"] ? { baseUrl: process.env["PAYSCRIBE_BASE_URL"] } : {})
        });
      default:
        throw new ServiceUnavailableException(
          `No virtual card provider adapter is implemented for "${providerName}".`
        );
    }
  }

  private buildRemittanceAdapter(providerName: string): RemittanceProvider {
    switch (providerName) {
      case "swappr":
        return createSwapprRemittanceProvider({
          apiKey: process.env["SWAPPR_API_KEY"] ?? "",
          ...(process.env["SWAPPR_BASE_URL"] ? { baseUrl: process.env["SWAPPR_BASE_URL"] } : {})
        });
      case "yativo":
        return createYativoRemittanceProvider({
          apiKey: process.env["YATIVO_API_KEY"] ?? "",
          accountId: process.env["YATIVO_ACCOUNT_ID"] ?? "",
          ...(process.env["YATIVO_BASE_URL"] ? { baseUrl: process.env["YATIVO_BASE_URL"] } : {})
        });
      default:
        throw new ServiceUnavailableException(
          `No remittance provider adapter is implemented for "${providerName}".`
        );
    }
  }

  // ─── Provider routing ───────────────────────────────────────────────────────

  private async selectAccountAdapter(orderId: string): Promise<VirtualAccountProvider> {
    const selection = await this.providerRouter.select(
      "VIRTUAL_ACCOUNT",
      { productType: "NGN_ACCOUNT" },
      "VirtualAccount",
      orderId
    );
    if (!selection) {
      throw new ServiceUnavailableException(
        "No virtual account provider is currently configured. Contact support."
      );
    }
    return this.buildAccountAdapter(selection.providerName);
  }

  private async selectCardAdapter(orderId: string): Promise<VirtualCardProvider> {
    const selection = await this.providerRouter.select(
      "VIRTUAL_CARD",
      { productType: "NGN_CARD" },
      "VirtualCard",
      orderId
    );
    if (!selection) {
      throw new ServiceUnavailableException(
        "No virtual card provider is currently configured. Contact support."
      );
    }
    return this.buildCardAdapter(selection.providerName);
  }

  private async selectRemittanceAdapter(orderId: string): Promise<RemittanceProvider> {
    const selection = await this.providerRouter.select(
      "REMITTANCE",
      { productType: "BANK_TRANSFER" },
      "Remittance",
      orderId
    );
    if (!selection) {
      throw new ServiceUnavailableException(
        "No remittance provider is currently configured. Contact support."
      );
    }
    return this.buildRemittanceAdapter(selection.providerName);
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
    const accountProvider = await this.selectAccountAdapter(reference);

    const details = await accountProvider.createAccount({
      reference,
      accountName: dto.accountName,
      currency
    });

    return this.db.virtualAccount.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        providerName: accountProvider.name,
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

    const accountProvider = this.buildAccountAdapter(account.providerName);
    const live = await accountProvider.getAccount(account.providerAccountId);
    return { ...account, balanceMinor: live.balanceMinor };
  }

  async closeAccount(ctx: AuthenticatedRequestContext, id: string) {
    const account = await this.db.virtualAccount.findFirst({
      where: { id, workspaceId: ctx.workspaceId }
    });
    if (!account) throw new NotFoundException("Virtual account not found.");
    if (account.status === "CLOSED") return account;

    const accountProvider = this.buildAccountAdapter(account.providerName);
    await accountProvider.closeAccount(account.providerAccountId);
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
    const cardProvider = await this.selectCardAdapter(cardId);

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
              providerName: cardProvider.name,
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
        const details = await cardProvider.issueCard({
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

      const cardProvider = this.buildCardAdapter(card.providerName);
      return cardProvider.fundCard({
        providerCardId: card.providerCardId,
        amountMinor: dto.amountMinor,
        reference: idempotencyKey
      });
    });

    return outcome;
  }

  async freezeCard(ctx: AuthenticatedRequestContext, id: string) {
    const card = await this.getOwnedCard(ctx, id);
    const cardProvider = this.buildCardAdapter(card.providerName);
    await cardProvider.freezeCard(card.providerCardId);
    return this.db.virtualCard.update({ where: { id: card.id }, data: { status: "FROZEN" } });
  }

  async unfreezeCard(ctx: AuthenticatedRequestContext, id: string) {
    const card = await this.getOwnedCard(ctx, id);
    const cardProvider = this.buildCardAdapter(card.providerName);
    await cardProvider.unfreezeCard(card.providerCardId);
    return this.db.virtualCard.update({ where: { id: card.id }, data: { status: "ACTIVE" } });
  }

  async terminateCard(ctx: AuthenticatedRequestContext, id: string) {
    const card = await this.getOwnedCard(ctx, id);
    if (card.status === "TERMINATED") return card;

    const cardProvider = this.buildCardAdapter(card.providerName);
    const result = await cardProvider.terminateCard(card.providerCardId);

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
    const remittanceProvider = await this.selectRemittanceAdapter(uid("rtq"));
    return remittanceProvider.getQuote({
      sourceCurrency: dto.sourceCurrency,
      destinationCurrency: dto.destinationCurrency,
      sourceAmountMinor: dto.sourceAmountMinor
    });
  }

  async sendRemittance(ctx: AuthenticatedRequestContext, dto: SendRemittanceDto) {
    const transferId = uid("rt");
    const idempotencyKey = `remittance_${transferId}`;
    const remittanceProvider = await this.selectRemittanceAdapter(transferId);

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
              providerName: remittanceProvider.name,
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
        const result = await remittanceProvider.sendTransfer({
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
