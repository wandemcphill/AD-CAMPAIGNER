// Price-locking quote service.
// Creates a VtuQuote record that freezes the provider, cost, and customer price
// for a configurable TTL. Payment must be confirmed before the quote expires; after
// expiry the caller must request a fresh quote rather than silently re-pricing.

import { Injectable, BadRequestException } from "@nestjs/common";
import type { DatabaseClient } from "@fliptrybe/database";
import { PrismaService } from "../prisma.service";
import { PricingRuleService } from "../providers/pricing-rule.service";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// Quote TTL in milliseconds — 15 minutes by default.
const QUOTE_TTL_MS = 15 * 60 * 1000;
// Default minimum margin in basis points (200 = 2%).
const DEFAULT_MIN_MARGIN_BPS = 200;

export interface QuoteRequest {
  productType: string;
  network?: string;
  canonicalSkuId?: string;
  providerName: string;
  providerSku: string;
  costMinor: number;
  currency?: string;
}

export interface QuoteResult {
  quoteId: string;
  providerName: string;
  providerSku: string;
  costMinor: number;
  customerPriceMinor: number;
  markupMinor: number;
  markupBps: number;
  currency: string;
  expiresAt: Date;
}

@Injectable()
export class VtuQuoteService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly pricingRules: PricingRuleService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  /**
   * Create a price-locked quote for the given procurement.
   * Enforces minimum margin and, when configured, an admin-defined canonical SKU selling price.
   */
  async createQuote(request: QuoteRequest): Promise<QuoteResult> {
    const currency = request.currency ?? "NGN";

    let minMarginBps = DEFAULT_MIN_MARGIN_BPS;
    let sellingPriceOverrideMinor: number | null = null;

    if (request.canonicalSkuId) {
      const sku = await this.db.vtuCanonicalSku.findUnique({
        where: { id: request.canonicalSkuId },
        select: { minMarginBps: true, sellingPriceMinor: true }
      });
      if (sku) {
        minMarginBps = sku.minMarginBps;
        sellingPriceOverrideMinor = sku.sellingPriceMinor ?? null;
      }
    }

    const markupBps = await this.pricingRules.resolveMarkupBps(
      "VTU",
      {
        productType: request.productType,
        providerName: request.providerName,
        ...(request.network ? { network: request.network } : {})
      },
      minMarginBps
    );

    let customerPriceMinor = Math.ceil(request.costMinor * (1 + markupBps / 10_000));

    if (sellingPriceOverrideMinor !== null) {
      const floorPriceMinor = Math.ceil(
        request.costMinor * (1 + minMarginBps / 10_000)
      );
      if (sellingPriceOverrideMinor < floorPriceMinor) {
        throw new BadRequestException(
          `Configured selling price ₦${(sellingPriceOverrideMinor / 100).toFixed(2)} is below the minimum protected price ₦${(floorPriceMinor / 100).toFixed(2)} for this provider cost.`
        );
      }
      customerPriceMinor = sellingPriceOverrideMinor;
    }

    const markupMinor = customerPriceMinor - request.costMinor;
    const effectiveMarkupBps = request.costMinor > 0
      ? Math.floor((markupMinor * 10_000) / request.costMinor)
      : 0;

    // Never sell below cost + the canonical SKU's configured floor.
    if (effectiveMarkupBps < minMarginBps) {
      throw new BadRequestException(
        `Margin protection: effective markup ${effectiveMarkupBps} bps is below the minimum ${minMarginBps} bps for this product.`
      );
    }

    const quoteId = uid("vquote");
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);

    await this.db.vtuQuote.create({
      data: {
        id: quoteId,
        canonicalSkuId: request.canonicalSkuId ?? null,
        providerName: request.providerName,
        providerSku: request.providerSku,
        productType: request.productType,
        network: request.network ?? null,
        costMinor: request.costMinor,
        customerPriceMinor,
        markupMinor,
        markupBps: effectiveMarkupBps,
        currency,
        expiresAt
      }
    });

    return {
      quoteId,
      providerName: request.providerName,
      providerSku: request.providerSku,
      costMinor: request.costMinor,
      customerPriceMinor,
      markupMinor,
      markupBps: effectiveMarkupBps,
      currency,
      expiresAt
    };
  }

  /**
   * Validate and consume a quote (mark it as used by an order).
   * Throws if the quote is expired or already consumed.
   * Returns the frozen pricing from the quote.
   */
  async consumeQuote(quoteId: string, orderId: string): Promise<QuoteResult> {
    const quote = await this.db.vtuQuote.findUnique({ where: { id: quoteId } });

    if (!quote) throw new BadRequestException("Quote not found.");
    if (quote.usedAt) throw new BadRequestException("Quote has already been used.");
    if (quote.expiresAt < new Date()) {
      throw new BadRequestException(
        "Price quote has expired. Please request a new quote to proceed."
      );
    }

    await this.db.vtuQuote.update({
      where: { id: quoteId },
      data: { usedAt: new Date(), orderId }
    });

    return {
      quoteId: quote.id,
      providerName: quote.providerName,
      providerSku: quote.providerSku,
      costMinor: quote.costMinor,
      customerPriceMinor: quote.customerPriceMinor,
      markupMinor: quote.markupMinor,
      markupBps: quote.markupBps,
      currency: quote.currency,
      expiresAt: quote.expiresAt
    };
  }

  /**
   * Look up an unconsumed quote without consuming it.
   * Useful for displaying price details to the customer before payment.
   */
  async getQuote(quoteId: string): Promise<QuoteResult | null> {
    const quote = await this.db.vtuQuote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.usedAt) return null;
    return {
      quoteId: quote.id,
      providerName: quote.providerName,
      providerSku: quote.providerSku,
      costMinor: quote.costMinor,
      customerPriceMinor: quote.customerPriceMinor,
      markupMinor: quote.markupMinor,
      markupBps: quote.markupBps,
      currency: quote.currency,
      expiresAt: quote.expiresAt
    };
  }
}
