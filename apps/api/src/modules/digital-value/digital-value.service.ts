/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit
} from '@nestjs/common';

import { Prisma, type DatabaseClient } from '@fliptrybe/database';
import { calculateAvailableBalance, runChargeSaga } from '@fliptrybe/payments';
import type { LedgerEntry } from '@fliptrybe/types';
import {
  createReloadlyGiftCardAdapter,
  createSogoGiftCardAdapter,
  createAirtimeToCashAdapter,
  createIACafeAirtimeCashoutAdapter,
  createMockAirtimeCashoutAdapter,
  type GiftCardSellProvider,
  type GiftCardPurchaseProvider,
  type AirtimeCashoutProvider
} from '@fliptrybe/providers';

import { PrismaService } from '../prisma.service';
import { PricingRuleService, type PricingRuleFilter } from '../providers/pricing-rule.service';
import { QueueProducerService } from '../queue-producer.service';
import { FxService } from '../fx/fx.service';
import { ApprovalsService } from '../approvals/approvals.service';
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
import {
  validateGiftCardECode,
  hashGiftCardCode,
  computeGiftCardFraudScore,
  isKnownGiftCardBrand,
  isKnownGiftCardRegion,
  FRAUD_REVIEW_THRESHOLD
} from './gift-card-validation';

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

// Fallbacks when no PricingRule (domain=GIFT_CARD) matches. These are the
// values that were hardcoded inline before; admin-overridable via /admin/providers.
const GIFT_CARD_BUY_MARGIN_BPS = 200;
const GIFT_CARD_SELL_FEE_BPS = 200;

@Injectable()
export class DigitalValueService implements OnModuleInit {
  private readonly logger = new Logger(DigitalValueService.name);

  // `undefined` = not yet resolved; `null` = resolved and unconfigured.
  // These are built lazily rather than in the constructor: this service is an
  // eager singleton in an always-imported module, so a missing SOGO/Reloadly
  // credential used to abort Nest's bootstrap and take the whole API down with
  // it. A missing credential must degrade exactly one vertical — every call
  // site already guards on null and throws "not available".
  private sellProviderResolved: GiftCardSellProvider | null | undefined;
  private buyProviderResolved: GiftCardPurchaseProvider | null | undefined;
  private cashoutProviderResolved: AirtimeCashoutProvider | null | undefined;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queue: QueueProducerService,
    private readonly fx: FxService,
    private readonly approvals: ApprovalsService,
    private readonly pricingRules: PricingRuleService
  ) {}

  // Resolve every provider once at startup so an unconfigured vertical shows up
  // in the deploy logs immediately, rather than on the first customer request.
  // Resolution never throws, so this cannot block boot.
  onModuleInit() {
    const unavailable = [
      this.giftCardSellProvider ? null : "gift card sell (SOGO_API_KEY)",
      this.giftCardBuyProvider ? null : "gift card buy (RELOADLY_CLIENT_ID/SECRET)",
      this.airtimeCashoutProvider ? null : "airtime cashout"
    ].filter((entry): entry is string => entry !== null);

    if (unavailable.length > 0) {
      this.logger.warn(
        `Digital value providers unavailable — these endpoints will return 400 until configured: ${unavailable.join(", ")}`
      );
    }
  }

  private get giftCardSellProvider(): GiftCardSellProvider | null {
    if (this.sellProviderResolved === undefined) {
      this.sellProviderResolved = this.buildSogoAdapter();
    }
    return this.sellProviderResolved;
  }

  private get giftCardBuyProvider(): GiftCardPurchaseProvider | null {
    if (this.buyProviderResolved === undefined) {
      this.buyProviderResolved = this.buildReloadlyAdapter();
    }
    return this.buyProviderResolved;
  }

  private get airtimeCashoutProvider(): AirtimeCashoutProvider | null {
    if (this.cashoutProviderResolved === undefined) {
      this.cashoutProviderResolved = featureFlags.airtimeCashout
        ? this.buildAirtimeCashoutProvider()
        : createMockAirtimeCashoutAdapter();
    }
    return this.cashoutProviderResolved;
  }

  // A PricingRule row (domain=GIFT_CARD) overrides these fallbacks when one
  // matches. Buy and sell are separate productTypes so an operator can price
  // the two sides independently.
  private async giftCardBuyMarginBps(filter: PricingRuleFilter = {}): Promise<number> {
    return this.pricingRules.resolveMarkupBps(
      "GIFT_CARD",
      { productType: "BUY", ...filter },
      GIFT_CARD_BUY_MARGIN_BPS
    );
  }

  private async giftCardSellFeeBps(filter: PricingRuleFilter = {}): Promise<number> {
    return this.pricingRules.resolveMarkupBps(
      "GIFT_CARD",
      { productType: "SELL", ...filter },
      GIFT_CARD_SELL_FEE_BPS
    );
  }

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // Single-provider slot (one active airtime-cashout provider at a time), matching
  // the existing pattern in this module — not the multi-provider router the VTU
  // module uses, which this domain doesn't need yet. Selection:
  //   1. AIRTIME_CASHOUT_PROVIDER=iacafe|airtimetocash - explicit override
  //   2. else IACAFE_API_KEY set - default to IACafe A2C (newer integration)
  //   3. else AIRTIMETOCASH_API_KEY set - legacy airtimetocash.com adapter
  //   4. else - mock
  private buildAirtimeCashoutProvider(): AirtimeCashoutProvider {
    const explicit = process.env['AIRTIME_CASHOUT_PROVIDER']?.toLowerCase();

    if (explicit === 'iacafe') return this.buildIACafeAirtimeCashoutAdapter();
    if (explicit === 'airtimetocash') return this.buildAirtimeToCashAdapter();

    if (process.env['IACAFE_API_KEY']) return this.buildIACafeAirtimeCashoutAdapter();
    if (process.env['AIRTIMETOCASH_API_KEY']) return this.buildAirtimeToCashAdapter();

    return createMockAirtimeCashoutAdapter('airtimecashout-mock');
  }

  private buildIACafeAirtimeCashoutAdapter(): AirtimeCashoutProvider {
    return createIACafeAirtimeCashoutAdapter({
      apiKey: process.env['IACAFE_API_KEY'] || '',
      ...(process.env['IACAFE_BASE_URL'] ? { baseUrl: process.env['IACAFE_BASE_URL'] } : {})
    });
  }

  // Returns null (never throws) when unconfigured: gift card selling is then
  // reported unavailable per-request instead of taking the API down at boot.
  // There is deliberately no mock fallback — an unconfigured vertical must be
  // visibly off, not quietly fake.
  private buildSogoAdapter(): GiftCardSellProvider | null {
    const sogoApiKey = process.env['SOGO_API_KEY'] ?? process.env['SOGO_SECRET_KEY'];
    if (!sogoApiKey) return null;
    return createSogoGiftCardAdapter({
      apiKey: sogoApiKey,
      sandbox: process.env['SOGO_SANDBOX'] === 'true',
      ...(process.env['SOGO_BASE_URL'] ? { baseUrl: process.env['SOGO_BASE_URL'] } : {})
    });
  }

  // Null-when-unconfigured, for the same reason as buildSogoAdapter above.
  private buildReloadlyAdapter(): GiftCardPurchaseProvider | null {
    const reloadlyClientId =
      process.env['RELOADLY_CLIENT_ID'] ?? process.env['RELOADLY_API_CLIENT_ID'];
    const reloadlyClientSecret =
      process.env['RELOADLY_CLIENT_SECRET'] ??
      process.env['RELOADLY_API_CLIENT_KEY'] ??
      process.env['RELOADLY_API_CLIENT_SECRET'];

    if (!reloadlyClientId || !reloadlyClientSecret) return null;

    return createReloadlyGiftCardAdapter({
      clientId: reloadlyClientId,
      clientSecret: reloadlyClientSecret,
      sandbox: process.env['RELOADLY_SANDBOX'] === 'true',
      // RELOADLY_GIFTCARDS_BASE_URL wins over the generic RELOADLY_BASE_URL:
      // the generic one is set to the top-ups host (topups.reloadly.com) for the
      // telecom gateway, and gift cards live on a different host entirely
      // (giftcards.reloadly.com). Preferring the generic var pointed every gift
      // card call at the top-ups API.
      ...((process.env['RELOADLY_GIFTCARDS_BASE_URL'] ?? process.env['RELOADLY_BASE_URL'])
        ? { baseUrl: process.env['RELOADLY_GIFTCARDS_BASE_URL'] ?? process.env['RELOADLY_BASE_URL'] }
        : {})
    });
  }

  private buildAirtimeToCashAdapter(): AirtimeCashoutProvider {
    return createAirtimeToCashAdapter({
      apiKey: process.env['AIRTIMETOCASH_API_KEY'] || ''
    });
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
    const feeBps = await this.giftCardSellFeeBps({
      ...(dto.region ? { countryCode: String(dto.region) } : {}),
      providerName: this.giftCardSellProvider.name
    });
    const feeNgn = Math.ceil((rate.rateMinor * (feeBps / 10_000)) / 100);
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
        fliptrybeMarkupBps: feeBps,
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

    const quote = await this.db.giftCardSellQuote.findUnique({
      where: { id: dto.quoteId ?? '' }
    });
    const providerRate = quote?.providerRate ?? new Prisma.Decimal(0);
    const providerRateTimestamp = quote?.providerRateTimestamp ?? new Date();
    const quotedCustomerPayoutNgn = quote?.quotedCustomerPayoutNgn ?? 0;
    const transactionId = uid('gcs');
    const idempotencyKey = `gift_card_sell_${transactionId}`;

    // ─── Validation gate ─────────────────────────────────────────────────────
    // Format/duplicate failures are hard rejects — never sent to SOGO. Fraud
    // scoring routes ambiguous-but-not-provably-invalid submissions to manual
    // review instead of auto-submitting. Every outcome is persisted for audit.
    const ecodeResult = validateGiftCardECode(
      dto.brand,
      dto.region,
      dto.denomination,
      dto.cardInfo?.cardCode
    );
    const cardCodeHash = ecodeResult.normalizedCode ? hashGiftCardCode(ecodeResult.normalizedCode) : null;
    // Fallback enum values so a rejected-submission audit row can always be persisted,
    // even when the claimed brand/region isn't one FlipTrybe recognizes.
    const dbBrand = (isKnownGiftCardBrand(dto.brand) ? dto.brand : 'OTHER') as any;
    const dbRegion = (isKnownGiftCardRegion(dto.region) ? dto.region : 'GLOBAL') as any;

    const baseTransactionData = {
      id: transactionId,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      region: dbRegion,
      denomination: dto.denomination,
      currency: 'USD',
      providerName: this.giftCardSellProvider.name,
      providerRate,
      providerRateTimestamp,
      providerPayoutNgn: quotedCustomerPayoutNgn,
      fliptrybeFeeMicro: 0,
      fliptrybeCommissionNgn: 0,
      quotedCustomerPayoutNgn,
      ...(quote ? { quoteId: quote.id } : {}),
      cardInfoRequired: dto.cardInfo ? Object.keys(dto.cardInfo) : [],
      idempotencyKey,
      cardCodeHash
    };

    if (!ecodeResult.valid) {
      const transaction = await this.db.giftCardSellTransaction.create({
        data: {
          ...baseTransactionData,
          brand: dbBrand,
          status: 'REJECTED' as any,
          validationStatus: 'REJECTED',
          validationReasons: ecodeResult.reasons,
          metadata: { claimedBrand: dto.brand, ...(quote ? { quoteId: quote.id } : {}) }
        }
      });

      await this.logValidationAudit(ctx, transaction.id, 'gift_card_sell.rejected_validation', ecodeResult.reasons);

      throw new BadRequestException(
        `Gift card submission rejected: ${ecodeResult.reasons.join(', ')}`
      );
    }

    const duplicate = cardCodeHash
      ? await this.db.giftCardSellTransaction.findFirst({
          where: { cardCodeHash, status: { notIn: ['REJECTED', 'FAILED', 'CANCELLED'] } }
        })
      : null;

    if (duplicate) {
      const transaction = await this.db.giftCardSellTransaction.create({
        data: {
          ...baseTransactionData,
          brand: dbBrand,
          status: 'REJECTED' as any,
          validationStatus: 'REJECTED',
          validationReasons: ['ECODE_DUPLICATE']
        }
      });

      await this.logValidationAudit(ctx, transaction.id, 'gift_card_sell.rejected_duplicate', ['ECODE_DUPLICATE']);

      throw new BadRequestException('This gift card code has already been submitted.');
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [recentSubmissionCount, workspace] = await Promise.all([
      this.db.giftCardSellTransaction.count({
        where: { userId: ctx.userId, createdAt: { gte: tenMinutesAgo } }
      }),
      this.db.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { createdAt: true } })
    ]);
    const workspaceAgeHours = workspace
      ? (Date.now() - workspace.createdAt.getTime()) / (1000 * 60 * 60)
      : 0;

    const fraud = computeGiftCardFraudScore({
      denomination: dto.denomination,
      currency: dto.cardInfo.currency,
      brand: dto.brand,
      region: dto.region,
      recentSubmissionCount,
      workspaceAgeHours
    });
    const flagged = fraud.score >= FRAUD_REVIEW_THRESHOLD;

    const transaction = await this.db.giftCardSellTransaction.create({
      data: {
        ...baseTransactionData,
        brand: dbBrand,
        status: (flagged ? 'FLAGGED_FOR_REVIEW' : 'SUBMITTED') as any,
        validationStatus: flagged ? 'FLAGGED' : 'PASSED',
        validationReasons: fraud.reasons,
        fraudScore: fraud.score,
        metadata: {
          cardInfo: { currency: dto.cardInfo.currency, cardType: dto.cardInfo.cardType ?? 'ecode' },
          ...(quote ? { quoteId: quote.id } : {})
        }
      }
    });

    if (flagged) {
      const approval = await this.approvals.request({
        workspaceId: ctx.workspaceId,
        action: 'digital_value.gift_card_sell.review',
        entityType: 'GiftCardSellTransaction',
        entityId: transaction.id,
        reason: fraud.reasons.join('; ') || 'Fraud score threshold exceeded',
        payload: {
          fraudScore: fraud.score,
          brand: dto.brand,
          region: dto.region,
          denomination: dto.denomination
        },
        requestedByUserId: ctx.userId
      });

      await this.db.giftCardSellTransaction.update({
        where: { id: transaction.id },
        data: { approvalRequestId: approval.id }
      });

      await this.queue.enqueueGiftCardSellOpsReview(transaction.id);

      return {
        transactionId: transaction.id,
        status: 'FLAGGED_FOR_REVIEW',
        message:
          'This submission needs manual review before it can be processed. We will notify you once it is resolved.'
      };
    }

    try {
      const result = await this.giftCardSellProvider.submitCard({
        reference: transaction.id,
        brand: dto.brand,
        region: dto.region,
        denomination: dto.denomination,
        cardInfo: {
          currency: dto.cardInfo.currency,
          cardCode: ecodeResult.normalizedCode,
          cardType: dto.cardInfo.cardType ?? 'ecode'
        }
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

  /** Admin action: after an ops reviewer approves a flagged submission, actually submit it to SOGO. */
  async executeApprovedGiftCardSell(approvalId: string, decidedByUserId: string, note?: string) {
    if (!this.giftCardSellProvider) {
      throw new BadRequestException('Gift card selling is not available.');
    }

    const transaction = await this.db.giftCardSellTransaction.findFirst({
      where: { approvalRequestId: approvalId }
    });
    if (!transaction) {
      throw new NotFoundException('No gift card sell transaction is linked to this approval.');
    }
    if (transaction.status !== 'FLAGGED_FOR_REVIEW') {
      throw new BadRequestException(`Transaction is ${transaction.status}, not awaiting review.`);
    }

    const metadata = (transaction.metadata ?? {}) as { cardInfo?: Record<string, string> };
    const cardInfo = metadata.cardInfo;
    if (!cardInfo?.currency) {
      throw new BadRequestException('Original submission payload is missing; cannot resubmit.');
    }

    await this.approvals.decide(approvalId, { decidedByUserId, approve: true, ...(note ? { note } : {}) });

    // The raw code was never persisted (only its hash) — ops approval means "let this
    // transaction proceed," but we no longer have the code to forward to SOGO. The
    // submitter must resubmit once notified of the approval.
    await this.approvals.execute(approvalId, () =>
      this.db.giftCardSellTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'APPROVED' as any,
          validationStatus: 'APPROVED_PENDING_RESUBMISSION'
        }
      })
    );

    return {
      transactionId: transaction.id,
      status: 'APPROVED',
      message: 'Submission approved. Ask the customer to resubmit the code to complete the sale.'
    };
  }

  async rejectFlaggedGiftCardSell(approvalId: string, decidedByUserId: string, note?: string) {
    const transaction = await this.db.giftCardSellTransaction.findFirst({
      where: { approvalRequestId: approvalId }
    });
    if (!transaction) {
      throw new NotFoundException('No gift card sell transaction is linked to this approval.');
    }

    await this.approvals.decide(approvalId, { decidedByUserId, approve: false, ...(note ? { note } : {}) });

    await this.db.giftCardSellTransaction.update({
      where: { id: transaction.id },
      data: { status: 'REJECTED' as any, validationStatus: 'REJECTED_BY_OPS' }
    });

    return { transactionId: transaction.id, status: 'REJECTED' };
  }

  async listFlaggedGiftCardSells(workspaceId?: string) {
    return this.db.giftCardSellTransaction.findMany({
      where: {
        status: 'FLAGGED_FOR_REVIEW' as any,
        ...(workspaceId ? { workspaceId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  async adminListGiftCardSellTransactions(workspaceId?: string, status?: string) {
    return this.db.giftCardSellTransaction.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        ...(status ? { status: status as any } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  async adminListAirtimeCashoutTransactions(workspaceId?: string, status?: string) {
    return this.db.airtimeCashoutTransaction.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        ...(status ? { status: status as any } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  private async logValidationAudit(
    ctx: AuthenticatedRequestContext,
    transactionId: string,
    action: string,
    reasons: string[]
  ) {
    await this.db.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorUserId: ctx.userId,
        action,
        entityType: 'GiftCardSellTransaction',
        entityId: transactionId,
        metadata: { reasons }
      }
    });
  }

  // ─── Gift Card Buy ────────────────────────────────────────────────────────────

  async getGiftCardProducts(ctx: AuthenticatedRequestContext, filters?: any) {
    if (!this.giftCardBuyProvider) {
      throw new BadRequestException('Gift card purchase is not available.');
    }

    const products = await this.giftCardBuyProvider.getProducts(filters);
    void this.cacheGiftCardCatalog(products);

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

  // Best-effort admin-visibility cache of the live provider catalog — never
  // blocks or fails the actual buy-side response above.
  private async cacheGiftCardCatalog(
    products: Array<{ brand: string; region: string; currency: string; denomination: number; available: boolean }>
  ): Promise<void> {
    const byBrandRegion = new Map<
      string,
      { brand: string; region: string; currency: string; denominations: Set<number>; active: boolean }
    >();

    for (const p of products) {
      const key = `${p.brand}:${p.region}`;
      const entry = byBrandRegion.get(key) ?? {
        brand: p.brand,
        region: p.region,
        currency: p.currency,
        denominations: new Set<number>(),
        active: false
      };
      entry.denominations.add(p.denomination);
      entry.active = entry.active || p.available;
      byBrandRegion.set(key, entry);
    }

    try {
      await Promise.all(
        [...byBrandRegion.values()].map((entry) => {
          const denominations = [...entry.denominations].sort((a, b) => a - b);
          return this.db.giftCardProduct.upsert({
            where: { brand_region: { brand: entry.brand as any, region: entry.region as any } },
            update: {
              currencyCode: entry.currency,
              minDenomination: denominations[0]!,
              maxDenomination: denominations[denominations.length - 1]!,
              denominations,
              active: entry.active
            },
            create: {
              brand: entry.brand as any,
              region: entry.region as any,
              currencyCode: entry.currency,
              minDenomination: denominations[0]!,
              maxDenomination: denominations[denominations.length - 1]!,
              denominations,
              active: entry.active
            }
          });
        })
      );
    } catch (err) {
      this.logger.warn(`Could not cache gift card catalog: ${String(err)}`);
    }
  }

  async getGiftCardBuyQuote(ctx: AuthenticatedRequestContext, dto: GiftCardBuyQuoteDto) {
    if (!this.giftCardBuyProvider) {
      throw new BadRequestException('Gift card purchase is not available.');
    }

    const product = await this.giftCardBuyProvider.getProduct(dto.productId);
    const priceData = await this.giftCardBuyProvider.getPrice(dto.productId, dto.quantity);

    const costNgn = Math.ceil((product.retailPrice * 100) / 0.95) * dto.quantity;
    const marginBps = await this.giftCardBuyMarginBps({
      ...(product.region ? { countryCode: String(product.region) } : {}),
      providerName: this.giftCardBuyProvider.name
    });
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

    const outcome = await runChargeSaga({
      // hold_and_flag (default): the supplier may have already fulfilled the order
      // even if our request timed out — auto-reversing here risks double-crediting
      // a gift card the customer already received. Ops resolves ambiguous cases.
      debit: async () => {
        const transaction = await this.db.$transaction(async (tx) => {
          const wallet = await this.getWallet(ctx.workspaceId, tx);
          const entries = (await tx.ledgerEntry.findMany({
            where: { walletId: wallet.id }
          })) as DbLedgerEntryRow[];
          const available = calculateAvailableBalance(entries.map(toTypedEntry));

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

        return {
          order: transaction,
          charge: {
            chargeId: transaction.chargeId as string,
            walletId: transaction.walletId as string,
            amountMinor: quote.customerPriceNgn,
            currency: 'NGN',
            debitLedgerEntryId: transaction.ledgerEntryId
          }
        };
      },

      execute: async (transaction) => {
        const result = await this.giftCardBuyProvider!.purchase({
          reference: transaction.id,
          productId: quote.id,
          quantity: 1,
          recipient: {
            ...(dto.recipientEmail ? { email: dto.recipientEmail } : {}),
            ...(dto.recipientPhone ? { phone: dto.recipientPhone } : {})
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
        return result;
      },

      // No-op: hold_and_flag is the failure policy here (see the note above debit),
      // so compensate is never invoked, but SagaSteps requires it be provided.
      compensate: async () => {}
    });

    if (outcome.status === 'held') {
      this.logger.error(
        `Gift card purchase ${transactionId} needs ops review: ${String(outcome.error)}`
      );
      await this.db.giftCardPurchaseTransaction.update({
        where: { id: transactionId },
        data: { status: 'DISPUTED' as any }
      });
      await this.db.giftCardWalletCharge.updateMany({
        where: { transactionId },
        data: { status: 'AMBIGUOUS' }
      });
    }

    return {
      transactionId,
      status: outcome.status === 'held' ? 'DISPUTED' : 'PAYMENT_CONFIRMED',
      message:
        outcome.status === 'held'
          ? 'Gift card payment was charged but the order could not be confirmed. This has been flagged for review.'
          : 'Gift card payment confirmed, processing order'
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
        ...(dto.sessionId ? { sessionId: dto.sessionId } : {}),
        ...(dto.pin ? { pin: dto.pin } : {})
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
