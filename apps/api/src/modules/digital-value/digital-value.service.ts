import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';

import { Prisma, type DatabaseClient } from '@fliptrybe/database';
import { calculateAvailableBalance } from '@fliptrybe/payments';
import type { CurrencyCode, LedgerEntry } from '@fliptrybe/types';
import {
  createReloadlyGiftCardAdapter,
  createMockGiftCardSellProvider,
  createMockGiftCardPurchaseAdapter,
  createMockAirtimeCashoutAdapter,
  type GiftCardSellProvider,
  type GiftCardPurchaseProvider,
  type AirtimeCashoutProvider
} from '@fliptrybe/providers';

import { PrismaService } from '../prisma.service';
import { QueueProducerService } from '../queue-producer.service';
import { FxService } from '../fx/fx.service';
import { featureFlags } from '@fliptrybe/feature-flags';
import type { AuthenticatedRequestContext } from '../request-context';
import type {
  GiftCardSellRateDto,
  GiftCardSubmitDto,
  GiftCardBuyQuoteDto,
  GiftCardPurchaseDto,
  AirtimeCashoutRequestOtpDto,
  AirtimeCashoutVerifyOtpDto,
  AirtimeCashoutQuoteDto,
  AirtimeCashoutInitiateDto
} from './digital-value.dtos';

type DbClient = DatabaseClient | Prisma.TransactionClient;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

@Injectable()
export class DigitalValueService {
  private readonly logger = new Logger(DigitalValueService.name);
  private giftCardSellProvider: GiftCardSellProvider | null = null;
  private giftCardBuyProvider: GiftCardPurchaseProvider | null = null;
  private airtimeCashoutProvider: AirtimeCashoutProvider | null = null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queue: QueueProducerService,
    private readonly fx: FxService
  ) {
    this.initializeProviders();
  }

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  private initializeProviders() {
    if (featureFlags.giftCardSell) {
      this.giftCardSellProvider =
        process.env['SOGO_API_KEY'] && process.env['SOGO_API_BASE_URL']
          ? this.buildSogoAdapter()
          : createMockGiftCardSellProvider('sogo-mock');
    } else {
      this.giftCardSellProvider = createMockGiftCardSellProvider();
    }

    if (featureFlags.giftCardBuy) {
      this.giftCardBuyProvider =
        process.env['RELOADLY_CLIENT_ID'] && process.env['RELOADLY_CLIENT_SECRET']
          ? createReloadlyGiftCardAdapter({
              clientId: process.env['RELOADLY_CLIENT_ID'],
              clientSecret: process.env['RELOADLY_CLIENT_SECRET'],
              sandbox: process.env['RELOADLY_SANDBOX'] === 'true'
            })
          : createMockGiftCardPurchaseAdapter('reloadly-mock');
    } else {
      this.giftCardBuyProvider = createMockGiftCardPurchaseAdapter();
    }

    if (featureFlags.airtimeCashout) {
      this.airtimeCashoutProvider =
        process.env['AIRTIMETOCASH_API_KEY'] && process.env['AIRTIMETOCASH_BASE_URL']
          ? this.buildAirtimeToCashAdapter()
          : createMockAirtimeCashoutAdapter('airtimetocash-mock');
    } else {
      this.airtimeCashoutProvider = createMockAirtimeCashoutAdapter();
    }
  }

  private buildSogoAdapter(): GiftCardSellProvider {
    throw new BadRequestException('Sogo adapter not yet implemented');
  }

  private buildAirtimeToCashAdapter(): AirtimeCashoutProvider {
    throw new BadRequestException('AirtimeToCash adapter not yet implemented');
  }

  private async getWallet(workspaceId: string, db: DbClient = this.db) {
    const wallet = await db.wallet.findFirst({ where: { workspaceId, currency: 'NGN' } });
    if (!wallet) throw new NotFoundException('Wallet not found.');
    return wallet;
  }

  // ─── Gift Card Sell ────────────────────────────────────────────────────────────

  async getGiftCardSellRate(ctx: AuthenticatedRequestContext, dto: GiftCardSellRateDto) {
    if (!this.giftCardSellProvider) {
      throw new BadRequestException('Gift card selling is not available.');
    }

    const rate = await this.giftCardSellProvider.getRate(dto.brand, dto.region, dto.denomination);
    const feeNgn = Math.ceil((rate.rateMinor * 0.02) / 100);
    const payoutNgn = Math.floor((rate.rateMinor - feeNgn) / 100);

    const quote = await this.db.giftCardSellQuote.create({
      data: {
        id: uid('gcq'),
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        brand: dto.brand as any,
        region: dto.region as any,
        denomination: dto.denomination,
        currency: rate.currency,
        providerRate: rate.rateMinor.toString(),
        providerRateTimestamp: rate.rateTimestamp,
        fliptrybeMarkupBps: 200,
        fliptrybeFeeBps: 0,
        quotedCustomerPayoutNgn: payoutNgn,
        expiresAt: new Date(Date.now() + 60 * 1000)
      }
    });

    return {
      quoteId: quote.id,
      brand: dto.brand,
      region: dto.region,
      denomination: dto.denomination,
      estimatedPayoutNgn: payoutNgn,
      feeNgn,
      finalPayoutNgn: payoutNgn,
      rateTimestamp: rate.rateTimestamp
    };
  }

  async submitGiftCardSell(ctx: AuthenticatedRequestContext, dto: GiftCardSubmitDto) {
    if (!this.giftCardSellProvider) {
      throw new BadRequestException('Gift card selling is not available.');
    }

    const transactionId = uid('gcs');
    const idempotencyKey = `gift_card_sell_${transactionId}`;

    const transaction = await this.db.giftCardSellTransaction.create({
      data: {
        id: transactionId,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        brand: dto.brand as any,
        region: dto.region as any,
        denomination: dto.denomination,
        currency: 'USD',
        providerName: this.giftCardSellProvider.name,
        status: 'SUBMITTED' as any,
        cardInfoRequired: Object.keys(dto.cardInfo),
        idempotencyKey,
        metadata: { cardInfo: dto.cardInfo }
      }
    });

    try {
      const result = await this.giftCardSellProvider.submitCard({
        reference: transaction.id,
        brand: dto.brand,
        region: dto.region,
        denomination: dto.denomination,
        cardInfo: dto.cardInfo
      });

      await this.db.giftCardSellTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PROCESSING' as any,
          providerTransactionId: result.providerReference
        }
      });

      await this.queue.enqueueDigitalValueProcessing(transaction.id, 'GIFT_CARD_SELL');
    } catch (err) {
      this.logger.error(`Gift card sell submission error: ${String(err)}`);
      await this.db.giftCardSellTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' as any }
      });
    }

    return {
      transactionId: transaction.id,
      status: 'SUBMITTED',
      message: 'Gift card submitted for processing'
    };
  }

  // ─── Gift Card Buy ────────────────────────────────────────────────────────────

  async getGiftCardProducts(ctx: AuthenticatedRequestContext, filters?: any) {
    if (!this.giftCardBuyProvider) {
      throw new BadRequestException('Gift card purchase is not available.');
    }

    const products = await this.giftCardBuyProvider.getProducts(filters);
    return products.map((p) => ({
      productId: p.productId,
      brand: p.brand,
      region: p.region,
      country: p.country,
      denomination: p.denomination,
      currency: p.currency,
      priceNgn: Math.ceil((p.retailPrice * 100) / 0.95),
      available: p.available
    }));
  }

  async getGiftCardBuyQuote(ctx: AuthenticatedRequestContext, dto: GiftCardBuyQuoteDto) {
    if (!this.giftCardBuyProvider) {
      throw new BadRequestException('Gift card purchase is not available.');
    }

    const product = await this.giftCardBuyProvider.getProduct(dto.productId);
    const priceData = await this.giftCardBuyProvider.getPrice(dto.productId, dto.quantity);

    const costNgn = Math.ceil((product.retailPrice * 100) / 0.95) * dto.quantity;
    const marginBps = 200;
    const marginNgn = Math.ceil(costNgn * (marginBps / 10000));
    const totalNgn = costNgn + marginNgn;

    const quote = await this.db.giftCardPurchaseQuote.create({
      data: {
        id: uid('gcpq'),
        workspaceId: ctx.workspaceId,
        brand: product.brand as any,
        region: product.region as any,
        denomination: product.denomination,
        supplierName: this.giftCardBuyProvider.name,
        supplierCostNgn: costNgn,
        fliptrybeMarkupBps: marginBps,
        fliptrybeMarginNgn: marginNgn,
        customerPriceNgn: totalNgn,
        landedCostNgn: costNgn,
        expiresAt: new Date(Date.now() + 60 * 1000)
      }
    });

    return {
      quoteId: quote.id,
      quotedAt: quote.createdAt,
      expiresAt: quote.expiresAt,
      productBrand: product.brand,
      productRegion: product.region,
      denomination: product.denomination,
      quantity: dto.quantity,
      supplierCostNgn: costNgn,
      fliptrybeMarginNgn: marginNgn,
      totalPriceNgn: totalNgn
    };
  }

  async purchaseGiftCard(ctx: AuthenticatedRequestContext, dto: GiftCardPurchaseDto) {
    if (!this.giftCardBuyProvider) {
      throw new BadRequestException('Gift card purchase is not available.');
    }

    const quote = await this.db.giftCardPurchaseQuote.findUnique({
      where: { id: dto.quoteId }
    });

    if (!quote || quote.expiresAt < new Date()) {
      throw new BadRequestException('Quote expired or not found.');
    }

    const transactionId = uid('gcp');
    const idempotencyKey = `gift_card_purchase_${transactionId}`;

    const transaction = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(ctx.workspaceId, tx);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as any[];
      const available = calculateAvailableBalance(entries.map((e) => ({...e})));

      if (available.amountMinor < quote.customerPriceNgn) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(quote.customerPriceNgn / 100).toFixed(2)}.`
        );
      }

      const ledgerId = uid('led');
      const chargeId = uid('gpc');

      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          id: ledgerId,
          walletId: wallet.id,
          kind: 'DEBIT',
          amountMinor: quote.customerPriceNgn,
          currency: 'NGN',
          reference: idempotencyKey,
          description: `Gift Card Purchase: ${quote.brand} ${quote.denomination}`,
          idempotencyKey,
          sourceType: 'GiftCardWalletCharge',
          sourceId: chargeId
        }
      });

      const charge = await tx.giftCardWalletCharge.create({
        data: {
          id: chargeId,
          workspaceId: ctx.workspaceId,
          walletId: wallet.id,
          transactionId,
          idempotencyKey,
          amountMinor: quote.customerPriceNgn,
          currency: 'NGN',
          status: 'CHARGED',
          debitLedgerEntryId: ledgerEntry.id
        }
      });

      const newTransaction = await tx.giftCardPurchaseTransaction.create({
        data: {
          id: transactionId,
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          quoteId: dto.quoteId,
          brand: quote.brand,
          region: quote.region,
          denomination: quote.denomination,
          supplierName: quote.supplierName,
          supplierProductId: quote.id,
          supplierCostNgn: quote.supplierCostNgn,
          fliptrybeMarkupBps: quote.fliptrybeMarkupBps,
          fliptrybeMarginNgn: quote.fliptrybeMarginNgn,
          customerPriceNgn: quote.customerPriceNgn,
          status: 'PAYMENT_CONFIRMED' as any,
          idempotencyKey,
          walletId: wallet.id,
          ledgerEntryId: ledgerEntry.id,
          chargeId: charge.id,
          paymentConfirmedAt: new Date()
        }
      });

      return newTransaction;
    });

    try {
      const result = await this.giftCardBuyProvider.purchase({
        reference: transaction.id,
        productId: quote.id,
        quantity: 1,
        recipient: {
          email: dto.recipientEmail,
          phone: dto.recipientPhone
        }
      });

      await this.db.giftCardPurchaseTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PURCHASING' as any,
          supplierOrderId: result.supplierOrderId
        }
      });

      await this.queue.enqueueDigitalValueProcessing(transaction.id, 'GIFT_CARD_BUY');
    } catch (err) {
      this.logger.error(`Gift card purchase error: ${String(err)}`);
      await this.db.giftCardPurchaseTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' as any }
      });
    }

    return {
      transactionId: transaction.id,
      status: 'PAYMENT_CONFIRMED',
      message: 'Gift card payment confirmed, processing order'
    };
  }

  // ─── Airtime Cashout ──────────────────────────────────────────────────────────

  async getAirtimeNetworks() {
    if (!this.airtimeCashoutProvider) {
      throw new BadRequestException('Airtime cashout is not available.');
    }

    const networks = await this.airtimeCashoutProvider.getSupportedNetworks();
    return { networks };
  }

  async requestAirtimeOtp(ctx: AuthenticatedRequestContext, dto: AirtimeCashoutRequestOtpDto) {
    if (!this.airtimeCashoutProvider) {
      throw new BadRequestException('Airtime cashout is not available.');
    }

    const result = await this.airtimeCashoutProvider.requestOtp(dto.phone, dto.network);

    return {
      sessionId: result.sessionId,
      message: result.message
    };
  }

  async verifyAirtimeOtp(ctx: AuthenticatedRequestContext, dto: AirtimeCashoutVerifyOtpDto) {
    if (!this.airtimeCashoutProvider) {
      throw new BadRequestException('Airtime cashout is not available.');
    }

    const result = await this.airtimeCashoutProvider.verifyOtp(dto);

    if (!result.verified) {
      throw new BadRequestException('OTP verification failed.');
    }

    return {
      verified: true,
      airtimeBalanceNgn: result.airtimeBalance,
      sessionId: result.sessionId
    };
  }

  async getAirtimeCashoutQuote(ctx: AuthenticatedRequestContext, dto: AirtimeCashoutQuoteDto) {
    if (!this.airtimeCashoutProvider) {
      throw new BadRequestException('Airtime cashout is not available.');
    }

    const quoteData = await this.airtimeCashoutProvider.getQuote({
      phone: dto.phone,
      network: dto.network,
      amountMinor: dto.amountMinor
    });

    const quote = await this.db.airtimeCashoutQuote.create({
      data: {
        id: uid('acq'),
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        network: dto.network,
        phoneNumber: dto.phone,
        phoneNumberMasked: dto.phone.slice(0, 4) + '****' + dto.phone.slice(-3),
        requestedAmountNgn: dto.amountMinor,
        providerFeeNgn: quoteData.feeMinor,
        providerPayoutNgn: quoteData.payoutMinor,
        fliptrybeFeeMicroNgn: Math.ceil(quoteData.payoutMinor * 0.02),
        customerPayoutNgn: quoteData.payoutMinor,
        expiresAt: new Date(Date.now() + 60 * 1000)
      }
    });

    return {
      quoteId: quote.id,
      amountNgn: dto.amountMinor,
      feeNgn: quoteData.feeMinor,
      payoutNgn: quoteData.payoutMinor,
      expiresAt: quote.expiresAt
    };
  }

  async initiateAirtimeCashout(ctx: AuthenticatedRequestContext, dto: AirtimeCashoutInitiateDto) {
    if (!this.airtimeCashoutProvider) {
      throw new BadRequestException('Airtime cashout is not available.');
    }

    const transactionId = uid('act');
    const idempotencyKey = `airtime_cashout_${transactionId}`;

    const transaction = await this.db.airtimeCashoutTransaction.create({
      data: {
        id: transactionId,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        network: dto.network,
        phoneNumber: dto.phone,
        phoneNumberMasked: dto.phone.slice(0, 4) + '****' + dto.phone.slice(-3),
        providerName: this.airtimeCashoutProvider.name,
        requestedAmountNgn: dto.amountMinor,
        providerFeeNgn: 0,
        providerPayoutNgn: dto.amountMinor,
        fliptrybeFeeMicroNgn: 0,
        customerPayoutNgn: dto.amountMinor,
        status: 'OTP_VERIFIED' as any,
        sessionId: dto.sessionId,
        idempotencyKey
      }
    });

    try {
      const result = await this.airtimeCashoutProvider.initiateCashout({
        reference: transaction.id,
        phone: dto.phone,
        network: dto.network,
        amountMinor: dto.amountMinor,
        sessionId: dto.sessionId,
        pin: dto.pin
      });

      await this.db.airtimeCashoutTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PROCESSING' as any,
          providerTransactionId: result.providerReference
        }
      });

      await this.queue.enqueueDigitalValueProcessing(transaction.id, 'AIRTIME_CASHOUT');
    } catch (err) {
      this.logger.error(`Airtime cashout initiation error: ${String(err)}`);
      await this.db.airtimeCashoutTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' as any }
      });
    }

    return {
      transactionId: transaction.id,
      status: 'PROCESSING',
      message: 'Airtime cashout initiated'
    };
  }
}
