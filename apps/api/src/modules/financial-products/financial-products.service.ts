import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";

import { Prisma, type DatabaseClient, type ProviderDomain } from "@fliptrybe/database";
import { calculateAvailableBalance, runChargeSaga } from "@fliptrybe/payments";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";
import {
  classifyFallbackSafety,
  createFincraRemittanceProvider,
  createInflowVirtualAccountProvider,
  createMapleradVirtualCardProvider,
  createPayscribeVirtualAccountProvider,
  createPayscribeVirtualCardProvider,
  createSudoVirtualCardProvider,
  createSwapprRemittanceProvider,
  createSwapprVirtualAccountProvider,
  createYativoRemittanceProvider,
  type RemittanceProvider,
  type VirtualAccountProvider,
  type VirtualCardProvider
} from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import { PricingRuleService, type PricingRuleFilter } from "../providers/pricing-rule.service";
import { ProviderRouterService } from "../providers/provider-router.service";
import { FinancialReconciliationService } from "./financial-reconciliation.service";
import { RemittanceBeneficiaryService } from "./remittance-beneficiary.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type {
  CreateVirtualAccountDto,
  FundVirtualCardDto,
  IssueVirtualCardDto,
  RemittanceQuoteDto,
  RequestWalletWithdrawalDto,
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
 * How long one of our remittance quotes stays usable.
 *
 * A provider's own expiresAt is honoured when it is shorter, but never when it
 * is longer: for an unlocked (indicative) quote the provider is making no
 * commitment at all, so a generous expiry on their side is not a reason for us
 * to hold a price. Whichever comes first wins.
 */
const REMITTANCE_QUOTE_TTL_MS = 15 * 60 * 1000;

/**
 * Two different spellings of "which provider" reach the build*Adapter factories
 * below, and they are not the same string:
 *
 *  - ProviderRouterService.select() returns `ProviderConfig.name`. That column is
 *    globally `@unique`, so a vendor serving two domains needs two rows with
 *    distinct names — hence "swappr-virtual-account" and "swappr-remittance".
 *  - getAccount()/closeAccount()/getCard() re-derive an adapter from the
 *    `providerName` persisted on the VirtualAccount/VirtualCard row, which was
 *    written from the adapter's own `.name` — the bare vendor ("swappr").
 *
 * Mapping the config-row spellings back to a vendor key lets both forms resolve.
 * This is an explicit table rather than suffix-stripping so that an unrecognised
 * row still falls through to the factories' `default:` and fails loudly, instead
 * of being silently coerced into some vendor it happens to share a prefix with.
 *
 * Add a row here whenever seed-financial-products.ts adds a ProviderConfig row.
 */
const VENDOR_BY_PROVIDER_CONFIG_NAME: Record<string, string> = {
  "swappr-virtual-account": "swappr",
  "swappr-remittance": "swappr",
  "payscribe-virtual-account": "payscribe",
  "payscribe-virtual-card": "payscribe",
  "yativo-remittance": "yativo",
  "fincra-remittance": "fincra",
  "sudo-virtual-card": "sudo",
  "maplerad-virtual-card": "maplerad",
  "inflow-virtual-account": "inflow"
};

/** Accepts either a ProviderConfig row name or a bare adapter name. */
function vendorKey(providerName: string): string {
  return VENDOR_BY_PROVIDER_CONFIG_NAME[providerName] ?? providerName;
}

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
    private readonly providerRouter: ProviderRouterService,
    private readonly reconciliation: FinancialReconciliationService,
    private readonly beneficiaries?: RemittanceBeneficiaryService,
    private readonly pricingRules?: PricingRuleService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Markup ─────────────────────────────────────────────────────────────────

  /**
   * FlipTrybe's cut on a financial-product sale, resolved from PricingRule the
   * same way VtuService.applyMarkup does.
   *
   * The fallback is 0 bps, deliberately unlike VTU's 2%. These verticals have
   * always run at exactly cost, so defaulting to a non-zero markup would
   * reprice every live transfer the moment this deploys. An admin opts in by
   * creating a PricingRule for the domain — which, until now, silently did
   * nothing because this service never consulted the rules at all.
   *
   * Returns whole minor units, rounded up, so a markup can never round away to
   * nothing on a small order.
   */
  private async resolveMarginMinor(
    domain: ProviderDomain,
    costMinor: number,
    filter: PricingRuleFilter
  ): Promise<number> {
    if (!this.pricingRules) return 0;
    const bps = await this.pricingRules.resolveMarkupBps(domain, filter, 0);
    if (bps <= 0) return 0;
    return Math.ceil((costMinor * bps) / 10_000);
  }

  // ─── Adapter factories ──────────────────────────────────────────────────────

  private buildAccountAdapter(providerName: string): VirtualAccountProvider {
    switch (vendorKey(providerName)) {
      case "swappr":
        return createSwapprVirtualAccountProvider({
          apiKey: process.env["SWAPPR_API_KEY"] ?? "",
          ...(process.env["SWAPPR_BASE_URL"] ? { baseUrl: process.env["SWAPPR_BASE_URL"] } : {})
        });
      case "inflow":
        // Written and tested but previously imported nowhere, same as the two
        // card issuers. baseUrl defaults to production — set INFLOW_BASE_URL to
        // https://sandbox.inflowafrica.com/api for testing.
        return createInflowVirtualAccountProvider({
          apiKey: process.env["INFLOW_API_KEY"] ?? "",
          ...(process.env["INFLOW_BASE_URL"] ? { baseUrl: process.env["INFLOW_BASE_URL"] } : {})
        });
      case "payscribe":
        // Payscribe NGN virtual accounts (documented adapter). Not production-
        // ready until sandbox-verified — keep the ProviderConfig row DISABLED.
        return createPayscribeVirtualAccountProvider({
          apiKey: process.env["PAYSCRIBE_API_KEY"] ?? "",
          ...(process.env["PAYSCRIBE_BASE_URL"] ? { baseUrl: process.env["PAYSCRIBE_BASE_URL"] } : {}),
          ...(process.env["PAYSCRIBE_WEBHOOK_SECRET"]
            ? { webhookSecret: process.env["PAYSCRIBE_WEBHOOK_SECRET"] }
            : {})
        });
      default:
        throw new ServiceUnavailableException(
          `No virtual account provider adapter is implemented for "${providerName}".`
        );
    }
  }

  private buildCardAdapter(providerName: string): VirtualCardProvider {
    switch (vendorKey(providerName)) {
      // Sudo and Maplerad are the two card issuers with confirmed live sandbox
      // testing (see the adapter headers in packages/providers). Their adapters
      // were written and tested but imported nowhere, so the only reachable
      // issuer was Payscribe — which is itself not sandbox-verified. Both are
      // wired here; which one actually serves traffic is still decided by the
      // ProviderConfig row and its capability grant, not by this switch.
      case "sudo":
        return createSudoVirtualCardProvider({
          apiKey: process.env["SUDO_API_KEY"] ?? "",
          ...(process.env["SUDO_BASE_URL"] ? { baseUrl: process.env["SUDO_BASE_URL"] } : {}),
          // Required for fundCard(): Sudo's transfer endpoint needs an explicit
          // debit source, which the VirtualCardProvider interface does not carry.
          ...(process.env["SUDO_FUNDING_ACCOUNT_ID"]
            ? { fundingAccountId: process.env["SUDO_FUNDING_ACCOUNT_ID"] }
            : {})
        });
      case "maplerad":
        return createMapleradVirtualCardProvider({
          apiKey: process.env["MAPLERAD_API_KEY"] ?? "",
          ...(process.env["MAPLERAD_BASE_URL"] ? { baseUrl: process.env["MAPLERAD_BASE_URL"] } : {})
        });
      case "payscribe":
        return createPayscribeVirtualCardProvider({
          apiKey: process.env["PAYSCRIBE_API_KEY"] ?? "",
          ...(process.env["PAYSCRIBE_BASE_URL"] ? { baseUrl: process.env["PAYSCRIBE_BASE_URL"] } : {}),
          ...(process.env["PAYSCRIBE_WEBHOOK_SECRET"]
            ? { webhookSecret: process.env["PAYSCRIBE_WEBHOOK_SECRET"] }
            : {})
        });
      default:
        throw new ServiceUnavailableException(
          `No virtual card provider adapter is implemented for "${providerName}".`
        );
    }
  }

  private buildRemittanceAdapter(providerName: string): RemittanceProvider {
    switch (vendorKey(providerName)) {
      case "swappr":
        return createSwapprRemittanceProvider({
          apiKey: process.env["SWAPPR_API_KEY"] ?? "",
          ...(process.env["SWAPPR_BASE_URL"] ? { baseUrl: process.env["SWAPPR_BASE_URL"] } : {}),
          ...(process.env["SWAPPR_WEBHOOK_SECRET"]
            ? { webhookSecret: process.env["SWAPPR_WEBHOOK_SECRET"] }
            : {})
        });
      case "yativo":
        return createYativoRemittanceProvider({
          apiKey: process.env["YATIVO_API_KEY"] ?? "",
          accountId: process.env["YATIVO_ACCOUNT_ID"] ?? "",
          ...(process.env["YATIVO_BASE_URL"] ? { baseUrl: process.env["YATIVO_BASE_URL"] } : {})
        });
      case "fincra":
        return createFincraRemittanceProvider({
          apiKey: process.env["FINCRA_API_KEY"] ?? "",
          businessId: process.env["FINCRA_BUSINESS_ID"] ?? "",
          ...(process.env["FINCRA_BASE_URL"] ? { baseUrl: process.env["FINCRA_BASE_URL"] } : {}),
          ...(process.env["FINCRA_WEBHOOK_ENCRYPTION_KEY"]
            ? { webhookEncryptionKey: process.env["FINCRA_WEBHOOK_ENCRYPTION_KEY"] }
            : {})
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

  // FALLBACK SAFETY INVARIANT: a provider is selected exactly once per
  // transferId, before the saga runs. If the provider call in `execute()`
  // times out or errors, runChargeSaga's default failure policy is
  // "hold_and_flag" — it does NOT re-select a different provider and retry
  // the send. That would risk a duplicate payout when the first provider's
  // state is merely unknown (PROCESSING/timeout) rather than confirmed
  // failed. A provider is only ever swapped for a NEW transferId (a fresh
  // customer action), never mid-flight for an existing one. Ambiguous
  // provider states surface as "needs ops review" (see sendRemittance below)
  // for manual reconciliation, not automatic retry-elsewhere.
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

  // NO MARKUP HERE, deliberately. VIRTUAL_ACCOUNT is a valid PricingRule domain,
  // but issuing an account moves no money — there is no wallet debit to mark up.
  // Earning on this vertical means introducing a charge (a creation fee, a
  // per-credit commission on inbound funding, or a monthly rent), and which of
  // those to levy is a pricing decision, not a wiring gap. Until that decision is
  // made, a VIRTUAL_ACCOUNT pricing rule still has nothing to apply to.

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

    // The customer is debited funding + markup; only the funding reaches the
    // card. dto.fundingAmountMinor stays the amount the card is loaded with, so
    // a markup never quietly shrinks the balance the customer asked for.
    const marginMinor = await this.resolveMarginMinor("VIRTUAL_CARD", dto.fundingAmountMinor, {
      productType: "NGN_CARD",
      providerName: cardProvider.name
    });
    const totalDebitMinor = dto.fundingAmountMinor + marginMinor;

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

          if (available.amountMinor < totalDebitMinor) {
            throw new ForbiddenException(
              `Insufficient balance. Required ₦${(totalDebitMinor / 100).toFixed(2)}.`
            );
          }

          const ledgerEntry = await tx.ledgerEntry.create({
            data: {
              walletId: wallet.id,
              kind: "DEBIT",
              amountMinor: totalDebitMinor,
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
              amountMinor: totalDebitMinor,
              costMinor: dto.fundingAmountMinor,
              marginMinor,
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
            amountMinor: totalDebitMinor,
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

    // Same split as issueCard: dto.amountMinor is what lands on the card, the
    // markup rides on top of the wallet debit.
    const marginMinor = await this.resolveMarginMinor("VIRTUAL_CARD", dto.amountMinor, {
      productType: "NGN_CARD",
      providerName: card.providerName
    });
    const totalDebitMinor = dto.amountMinor + marginMinor;

    const outcome = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(ctx.workspaceId, tx);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < totalDebitMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(totalDebitMinor / 100).toFixed(2)}.`
        );
      }

      const idempotencyKey = `virtual_card_topup_${uid("t")}`;
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          kind: "DEBIT",
          amountMinor: totalDebitMinor,
          currency: card.currency,
          reference: idempotencyKey,
          description: `Virtual card top-up: ${card.last4}`,
          idempotencyKey,
          sourceType: "VirtualCardWalletCharge",
          sourceId: card.id
        }
      });

      // A top-up produced only a ledger entry before, which left its margin with
      // nowhere to be recorded. It gets a charge row of its own now — distinct
      // from the issuance charge that terminateCard refunds against, which is
      // still found by card.chargeId.
      await tx.virtualCardWalletCharge.create({
        data: {
          workspaceId: ctx.workspaceId,
          walletId: wallet.id,
          cardId: card.id,
          idempotencyKey,
          amountMinor: totalDebitMinor,
          costMinor: dto.amountMinor,
          marginMinor,
          currency: card.currency,
          status: "CHARGED",
          debitLedgerEntryId: ledgerEntry.id
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

  /**
   * Quotes a transfer AND persists what we quoted.
   *
   * The `quoteId` handed back is our RemittanceQuote row id, not the provider's
   * — the provider's is kept alongside it and forwarded only to providers that
   * honour locked quotes. sendRemittance reads every amount back off this row,
   * so the numbers the customer agreed to are the numbers that get charged.
   */
  async getRemittanceQuote(ctx: AuthenticatedRequestContext, dto: RemittanceQuoteDto) {
    const remittanceProvider = await this.selectRemittanceAdapter(uid("rtq"));
    const quote = await remittanceProvider.getQuote({
      sourceCurrency: dto.sourceCurrency,
      destinationCurrency: dto.destinationCurrency,
      sourceAmountMinor: dto.sourceAmountMinor
    });

    // Markup is resolved once, here, and frozen onto the row. Repricing after a
    // quote is issued must not change what an already-quoted customer pays.
    // No countryCode in the filter: PricingRule.countryCode means a country, and
    // the only geography known at quote time is the destination CURRENCY — the
    // recipient's country does not arrive until send. Corridor-specific pricing
    // would need its own dimension; a rule left country-agnostic still matches.
    const marginMinor = await this.resolveMarginMinor("REMITTANCE", quote.sourceAmountMinor, {
      productType: "BANK_TRANSFER",
      providerName: remittanceProvider.name
    });

    const row = await this.db.remittanceQuote.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        providerName: remittanceProvider.name,
        providerQuoteId: quote.quoteId,
        sourceCurrency: quote.sourceCurrency,
        sourceAmountMinor: quote.sourceAmountMinor + marginMinor,
        costMinor: quote.sourceAmountMinor,
        marginMinor,
        destinationCurrency: quote.destinationCurrency,
        destinationAmountMinor: quote.destinationAmountMinor,
        feeMinor: quote.feeMinor,
        rate: quote.rate,
        isLocked: quote.isLocked,
        expiresAt: this.remittanceQuoteExpiry(quote.expiresAt)
      }
    });

    // Same shape the client already consumes, with sourceAmountMinor now being
    // the full debit (provider leg + our markup) rather than the provider leg
    // alone — so what the customer is shown is what leaves their wallet.
    return {
      quoteId: row.id,
      sourceAmountMinor: row.sourceAmountMinor,
      sourceCurrency: row.sourceCurrency,
      destinationAmountMinor: row.destinationAmountMinor,
      destinationCurrency: row.destinationCurrency,
      feeMinor: row.feeMinor,
      rate: row.rate,
      expiresAt: row.expiresAt.toISOString(),
      isLocked: row.isLocked
    };
  }

  /** Provider expiry if it is sooner than ours; our TTL otherwise. */
  private remittanceQuoteExpiry(providerExpiresAt: string): Date {
    const ours = new Date(Date.now() + REMITTANCE_QUOTE_TTL_MS);
    const theirs = new Date(providerExpiresAt);
    if (Number.isNaN(theirs.getTime())) return ours;
    return theirs < ours ? theirs : ours;
  }

  /**
   * Loads, validates and consumes a quote in one step.
   *
   * Ownership failures are reported as not-found rather than forbidden so a
   * foreign quote id cannot be probed — the same reasoning as FxService.useQuote.
   * The claim itself is a conditional update on status, which is what makes it
   * single-use: two concurrent sends both pass the reads above, and exactly one
   * of them gets count === 1 back.
   */
  private async consumeRemittanceQuote(
    ctx: AuthenticatedRequestContext,
    quoteId: string,
    transferId: string
  ) {
    const quote = await this.db.remittanceQuote.findUnique({ where: { id: quoteId } });

    if (!quote || quote.workspaceId !== ctx.workspaceId) {
      throw new NotFoundException(`Quote ${quoteId} not found.`);
    }

    if (quote.status !== "ACTIVE") {
      throw new BadRequestException(
        `Quote is ${quote.status} and cannot be used again. Request a new quote.`
      );
    }

    if (quote.expiresAt < new Date()) {
      await this.db.remittanceQuote.updateMany({
        where: { id: quoteId, status: "ACTIVE" },
        data: { status: "EXPIRED" }
      });
      throw new BadRequestException("Quote has expired. Request a new quote.");
    }

    const claimed = await this.db.remittanceQuote.updateMany({
      where: { id: quoteId, status: "ACTIVE" },
      data: { status: "USED", usedAt: new Date(), transferId }
    });

    if (claimed.count !== 1) {
      throw new BadRequestException("Quote has already been used. Request a new quote.");
    }

    return quote;
  }

  async sendRemittance(ctx: AuthenticatedRequestContext, dto: SendRemittanceDto) {
    const transferId = uid("rt");
    const idempotencyKey = `remittance_${transferId}`;

    // Validate and consume the quote BEFORE anything is charged. Everything
    // below reads from `quote`, never from `dto` — the request body carries the
    // recipient and the quote id, and no amounts at all.
    const quote = await this.consumeRemittanceQuote(ctx, dto.quoteId, transferId);

    // Rebuild the adapter that issued the quote rather than re-routing. Routing
    // again here could hand the transfer to a different provider than the one
    // whose price the customer accepted — and would make a locked quote id
    // meaningless, since it is only valid at the provider that minted it.
    const remittanceProvider = this.buildRemittanceAdapter(quote.providerName);

    const outcome = await runChargeSaga({
      debit: async () => {
        const transfer = await this.db.$transaction(async (tx) => {
          const wallet = await this.getWallet(ctx.workspaceId, tx);
          const entries = (await tx.ledgerEntry.findMany({
            where: { walletId: wallet.id }
          })) as DbLedgerEntryRow[];
          const available = calculateAvailableBalance(entries.map(toTypedEntry));

          if (available.amountMinor < quote.sourceAmountMinor) {
            throw new ForbiddenException(
              `Insufficient balance. Required ₦${(quote.sourceAmountMinor / 100).toFixed(2)}.`
            );
          }

          const ledgerEntry = await tx.ledgerEntry.create({
            data: {
              walletId: wallet.id,
              kind: "DEBIT",
              amountMinor: quote.sourceAmountMinor,
              currency: quote.sourceCurrency,
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
              amountMinor: quote.sourceAmountMinor,
              currency: quote.sourceCurrency,
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
              quoteId: quote.id,
              providerQuoteId: quote.providerQuoteId,
              recipientName: dto.recipientName,
              recipientAccountNumber: dto.recipientAccountNumber,
              recipientBankCode: dto.recipientBankCode,
              recipientCountry: dto.recipientCountry,
              sourceAmountMinor: quote.sourceAmountMinor,
              costMinor: quote.costMinor,
              marginMinor: quote.marginMinor,
              sourceCurrency: quote.sourceCurrency,
              destinationAmountMinor: quote.destinationAmountMinor,
              destinationCurrency: quote.destinationCurrency,
              feeMinor: quote.feeMinor,
              quotedRate: quote.rate,
              // Whether this quote was actually locked is a property of the
              // PROVIDER, not of what the customer was shown — never assume a
              // lock a provider (e.g. Swappr) never made.
              isLockedQuote: remittanceProvider.remittanceCapabilities.supportsLockedQuotes,
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
          // Reuse the same idempotencyKey the debit step already committed —
          // a saga retry of execute() must not be able to create a second
          // provider-side payout for the same logical FlipTrybe transaction.
          idempotencyKey,
          // The provider's own leg, NOT the customer's debit — the difference
          // between the two is our margin and must not be sent onward.
          amountMinor: quote.costMinor,
          sourceCurrency: quote.sourceCurrency,
          destinationCurrency: quote.destinationCurrency,
          // Only forward a quoteId to providers that can actually honour one —
          // Swappr has no server-side quote object to receive it. It is the
          // PROVIDER's id, not ours; ours means nothing to them.
          ...(remittanceProvider.remittanceCapabilities.supportsLockedQuotes
            ? { quoteId: quote.providerQuoteId }
            : {}),
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
            status: result.status,
            ...(result.executedRate !== undefined ? { executedRate: result.executedRate } : {}),
            ...(result.executedDestinationAmountMinor !== undefined
              ? { executedDestinationAmountMinor: result.executedDestinationAmountMinor }
              : {}),
            ...(result.executedFeeMinor !== undefined
              ? { executedFeeMinor: result.executedFeeMinor }
              : {})
          }
        });
      },

      compensate: async () => {}
    });

    if (outcome.status !== "completed") {
      // FINANCIAL SAFETY (governance §15/§16): the provider call failed, but a
      // failure here does NOT mean the payout did not happen. A timeout, a 5xx,
      // or a dropped connection all leave the provider's state UNKNOWN. We must
      // NOT mark this FAILED, must NOT auto-retry, and must NOT re-route it to
      // a fallback provider — any of those can double-pay a real customer.
      //
      // Classify how the call failed, then move the transfer into an explicit
      // ambiguous state and open a reconciliation exception.
      const err = outcome.error;
      const httpStatus =
        err instanceof Error && "status" in err && typeof (err as { status?: unknown }).status === "number"
          ? ((err as { status: number }).status)
          : undefined;
      const noResponse =
        err instanceof Error &&
        /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|network/i.test(err.message);

      const safety = classifyFallbackSafety({
        mutatesMoney: true,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        ...(noResponse ? { noResponse: true } : {})
      });

      const nextStatus =
        safety === "SAFE_TO_RETRY"
          ? // The provider definitively rejected this before accepting it, so
            // no provider-side payout exists. FAILED is genuinely accurate.
            ("FAILED" as const)
          : ("RECONCILIATION_REQUIRED" as const);

      await this.db.remittanceTransfer.update({
        where: { id: transferId },
        data: { status: nextStatus }
      });

      if (safety === "PROVIDER_TRANSACTION_MAY_EXIST") {
        await this.reconciliation.openException({
          workspaceId: ctx.workspaceId,
          resourceType: "RemittanceTransfer",
          resourceId: transferId,
          domain: "REMITTANCE",
          providerName: remittanceProvider.name,
          kind: "AMBIGUOUS_PROVIDER_RESULT",
          internalStatus: nextStatus,
          // The provider's leg, not the customer's debit — this figure gets
          // compared against the provider's own record of the payout, and our
          // markup never appears there.
          internalAmountMinor: quote.costMinor,
          internalCurrency: quote.sourceCurrency,
          idempotencyKey,
          detail:
            `Provider call did not return a confirmed result. The payout MAY have been ` +
            `executed. Do not retry or re-route until reconciled against ` +
            `${remittanceProvider.name}. Underlying error: ${String(outcome.error)}`
        });
      }

      this.logger.error(
        `Remittance ${transferId} ended ${nextStatus} (fallbackSafety=${safety}): ${String(outcome.error)}`
      );

      throw new BadRequestException(
        safety === "SAFE_TO_RETRY"
          ? "Transfer could not be submitted to the provider and was not sent."
          : "Transfer was charged but could not be confirmed with the provider. It is under review — please do not retry."
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

  // ─── Wallet Withdrawal ──────────────────────────────────────────────────────
  //
  // Payout of the workspace's own NGN wallet balance to its own bank account.
  // Bank-only, same-currency (NGN) — reuses the Swappr NGN payout adapter via
  // the same RemittanceProvider interface used by sendRemittance, but the
  // ledger discipline is HOLD -> (RELEASE+DEBIT | RELEASE | left HOLD) rather
  // than sendRemittance's straight DEBIT, because a withdrawal is our own
  // money leaving, not a third-party recipient's, and getting the amount
  // wrong here is a direct loss to FlipTrybe, not just a customer dispute.
  //
  // Outcome handling mirrors sendRemittance's ambiguous-failure discipline
  // exactly (see the long FINANCIAL SAFETY comment on that method): a
  // provider call that times out or errors without a definitive rejection
  // leaves the HOLD in place and opens a reconciliation exception instead of
  // guessing FAILED or COMPLETED.
  async requestWithdrawal(ctx: AuthenticatedRequestContext, dto: RequestWalletWithdrawalDto) {
    let recipientName: string;
    let recipientAccountNumber: string;
    let recipientBankCode: string;
    let beneficiaryId: string | undefined;

    if (dto.beneficiaryId) {
      if (!this.beneficiaries) {
        throw new ServiceUnavailableException("Beneficiary lookup is not available.");
      }
      const beneficiary = await this.beneficiaries.getById(dto.beneficiaryId, ctx.workspaceId);
      if (beneficiary.currency !== "NGN" || beneficiary.payoutMethod !== "BANK_ACCOUNT") {
        throw new BadRequestException(
          "Only NGN bank-account beneficiaries are supported for wallet withdrawal in this pass."
        );
      }
      if (!beneficiary.accountNumber || !beneficiary.bankCode) {
        throw new BadRequestException("Beneficiary is missing account number or bank code.");
      }
      recipientName = beneficiary.recipientName;
      recipientAccountNumber = beneficiary.accountNumber;
      recipientBankCode = beneficiary.bankCode;
      beneficiaryId = beneficiary.id;
    } else if (dto.recipientName && dto.recipientAccountNumber && dto.recipientBankCode) {
      recipientName = dto.recipientName;
      recipientAccountNumber = dto.recipientAccountNumber;
      recipientBankCode = dto.recipientBankCode;
    } else {
      throw new BadRequestException(
        "Provide either beneficiaryId or all of recipientName/recipientAccountNumber/recipientBankCode."
      );
    }

    const currency = "NGN";
    const withdrawalId = uid("wd");
    const idempotencyKey = `wallet_withdrawal_${withdrawalId}`;
    const remittanceProvider = await this.selectRemittanceAdapter(withdrawalId);

    if (!remittanceProvider.remittanceCapabilities.supportsPayouts) {
      throw new ServiceUnavailableException(
        `Provider "${remittanceProvider.name}" does not support payouts.`
      );
    }

    const outcome = await runChargeSaga({
      debit: async () => {
        const withdrawal = await this.db.$transaction(async (tx) => {
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

          const holdEntry = await tx.ledgerEntry.create({
            data: {
              walletId: wallet.id,
              kind: "HOLD",
              amountMinor: dto.amountMinor,
              currency,
              reference: idempotencyKey,
              description: `Wallet withdrawal hold: ${recipientName}`,
              idempotencyKey,
              sourceType: "WalletWithdrawal",
              sourceId: withdrawalId
            }
          });

          return tx.walletWithdrawal.create({
            data: {
              id: withdrawalId,
              workspaceId: ctx.workspaceId,
              userId: ctx.userId,
              walletId: wallet.id,
              providerName: remittanceProvider.name,
              beneficiaryId: beneficiaryId ?? null,
              recipientName,
              recipientAccountNumber,
              recipientBankCode,
              amountMinor: dto.amountMinor,
              currency,
              status: "HOLD",
              idempotencyKey,
              holdLedgerEntryId: holdEntry.id
            }
          });
        });

        return {
          order: withdrawal,
          charge: {
            chargeId: withdrawal.id,
            walletId: withdrawal.walletId,
            amountMinor: withdrawal.amountMinor,
            currency: withdrawal.currency as CurrencyCode,
            debitLedgerEntryId: withdrawal.holdLedgerEntryId
          }
        };
      },

      execute: async (withdrawal) => {
        const result = await remittanceProvider.sendTransfer({
          reference: withdrawalId,
          // Reuse the same idempotencyKey the HOLD step already committed — a
          // saga retry of execute() must not be able to create a second
          // provider-side payout for the same logical withdrawal.
          idempotencyKey,
          amountMinor: dto.amountMinor,
          sourceCurrency: currency,
          destinationCurrency: currency,
          recipient: {
            name: recipientName,
            accountNumber: recipientAccountNumber,
            bankCode: recipientBankCode,
            country: "NG"
          }
        });

        if (result.status === "COMPLETED") {
          return this.db.$transaction(async (tx) => {
            const releaseEntry = await tx.ledgerEntry.create({
              data: {
                walletId: withdrawal.walletId,
                kind: "RELEASE",
                amountMinor: dto.amountMinor,
                currency,
                reference: `${idempotencyKey}_release`,
                description: `Wallet withdrawal hold release: ${recipientName}`,
                idempotencyKey: `${idempotencyKey}_release`,
                sourceType: "WalletWithdrawal",
                sourceId: withdrawalId
              }
            });
            const debitEntry = await tx.ledgerEntry.create({
              data: {
                walletId: withdrawal.walletId,
                kind: "DEBIT",
                amountMinor: dto.amountMinor,
                currency,
                reference: `${idempotencyKey}_debit`,
                description: `Wallet withdrawal to ${recipientName}`,
                idempotencyKey: `${idempotencyKey}_debit`,
                sourceType: "WalletWithdrawal",
                sourceId: withdrawalId
              }
            });
            return tx.walletWithdrawal.update({
              where: { id: withdrawal.id },
              data: {
                status: "COMPLETED",
                providerReference: result.providerReference,
                releaseLedgerEntryId: releaseEntry.id,
                debitLedgerEntryId: debitEntry.id,
                ...(result.executedFeeMinor !== undefined ? { feeMinor: result.executedFeeMinor } : {})
              }
            });
          });
        }

        if (result.status === "FAILED") {
          return this.db.$transaction(async (tx) => {
            const releaseEntry = await tx.ledgerEntry.create({
              data: {
                walletId: withdrawal.walletId,
                kind: "RELEASE",
                amountMinor: dto.amountMinor,
                currency,
                reference: `${idempotencyKey}_release`,
                description: `Wallet withdrawal hold release (provider failed): ${recipientName}`,
                idempotencyKey: `${idempotencyKey}_release`,
                sourceType: "WalletWithdrawal",
                sourceId: withdrawalId
              }
            });
            return tx.walletWithdrawal.update({
              where: { id: withdrawal.id },
              data: {
                status: "FAILED",
                providerReference: result.providerReference,
                releaseLedgerEntryId: releaseEntry.id,
                failureReason: "Provider reported payout failure"
              }
            });
          });
        }

        // PROCESSING — provider accepted but hasn't confirmed. This is a
        // genuine intermediate state (not an error): leave the HOLD in place
        // and record PROCESSING; getTransferStatus/webhook/reconciliation
        // must resolve it to COMPLETED or FAILED later. Never guessed here.
        return this.db.walletWithdrawal.update({
          where: { id: withdrawal.id },
          data: { status: "PROCESSING", providerReference: result.providerReference }
        });
      },

      compensate: async () => {}
    });

    if (outcome.status !== "completed") {
      // FINANCIAL SAFETY: identical discipline to sendRemittance — a thrown
      // error from execute() (as opposed to a returned FAILED/PROCESSING
      // result, handled above) means the provider call itself didn't
      // complete cleanly. We do not know whether Swappr executed the payout.
      // Never mark FAILED, never auto-retry, never re-route to a fallback
      // provider — leave the HOLD in place and open a reconciliation
      // exception for manual resolution.
      const err = outcome.error;
      const httpStatus =
        err instanceof Error && "status" in err && typeof (err as { status?: unknown }).status === "number"
          ? (err as { status: number }).status
          : undefined;
      const noResponse =
        err instanceof Error &&
        /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|network/i.test(err.message);

      const safety = classifyFallbackSafety({
        mutatesMoney: true,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        ...(noResponse ? { noResponse: true } : {})
      });

      if (safety === "SAFE_TO_RETRY") {
        // The provider definitively rejected the request before accepting
        // it — no provider-side payout exists. Safe to release the hold.
        await this.db.$transaction(async (tx) => {
          const releaseEntry = await tx.ledgerEntry.create({
            data: {
              walletId: (await this.getWallet(ctx.workspaceId, tx)).id,
              kind: "RELEASE",
              amountMinor: dto.amountMinor,
              currency,
              reference: `${idempotencyKey}_release`,
              description: `Wallet withdrawal hold release (rejected before acceptance): ${recipientName}`,
              idempotencyKey: `${idempotencyKey}_release`,
              sourceType: "WalletWithdrawal",
              sourceId: withdrawalId
            }
          });
          await tx.walletWithdrawal.update({
            where: { id: withdrawalId },
            data: {
              status: "FAILED",
              releaseLedgerEntryId: releaseEntry.id,
              failureReason: String(err instanceof Error ? err.message : err)
            }
          });
        });

        this.logger.error(`Wallet withdrawal ${withdrawalId} FAILED (rejected before acceptance): ${String(err)}`);
        throw new BadRequestException("Withdrawal could not be submitted to the provider and was not sent.");
      }

      // PROVIDER_TRANSACTION_MAY_EXIST — leave the HOLD in place, do NOT
      // release, do NOT debit, do NOT retry.
      await this.db.walletWithdrawal.update({
        where: { id: withdrawalId },
        data: { status: "RECONCILIATION_REQUIRED" }
      });

      await this.reconciliation.openException({
        workspaceId: ctx.workspaceId,
        resourceType: "WalletWithdrawal",
        resourceId: withdrawalId,
        domain: "REMITTANCE",
        providerName: remittanceProvider.name,
        kind: "AMBIGUOUS_PROVIDER_RESULT",
        internalStatus: "RECONCILIATION_REQUIRED",
        internalAmountMinor: dto.amountMinor,
        internalCurrency: currency,
        idempotencyKey,
        detail:
          `Provider call did not return a confirmed result. The payout MAY have been ` +
          `executed. Wallet balance remains HELD (not released, not debited) until this is ` +
          `reconciled against ${remittanceProvider.name}. Underlying error: ${String(outcome.error)}`
      });

      this.logger.error(
        `Wallet withdrawal ${withdrawalId} ended RECONCILIATION_REQUIRED: ${String(outcome.error)}`
      );

      throw new BadRequestException(
        "Withdrawal was placed on hold but could not be confirmed with the provider. It is under review — please do not retry."
      );
    }

    return outcome.result;
  }

  async listWithdrawals(ctx: AuthenticatedRequestContext) {
    return this.db.walletWithdrawal.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }
}
