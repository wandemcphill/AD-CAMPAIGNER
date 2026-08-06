import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type { GiftCardPurchaseStatus } from '@fliptrybe/database';
import { PrismaService } from '../prisma.service';
import { QueueProducerService } from '../queue-producer.service';

@Injectable()
export class ProviderWebhooksService {
  private readonly logger = new Logger(ProviderWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueProducer: QueueProducerService
  ) {}

  /**
   * Verify HMAC-SHA256 signature for Sogo webhooks
   * Sogo uses: HMAC-SHA256(payload + ":" + timestamp, secret)
   */
  verifySogoSignature(
    payload: string,
    timestamp: string,
    signature: string,
    secret: string
  ): boolean {
    const dataToSign = `${payload}:${timestamp}`;
    const digest = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
    return this.secureCompare(digest, signature);
  }

  /**
   * Verify HMAC-SHA256 signature for Reloadly webhooks
   * Reloadly uses: HMAC-SHA256(payload + ":" + timestamp, secret) in hex
   */
  verifyReloadlySignature(payload: string, timestamp: string, signature: string, secret: string): boolean {
    const dataToSign = `${payload}:${timestamp}`;
    const digest = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
    return this.secureCompare(digest, signature);
  }

  /**
   * Handle Sogo gift card transaction webhook
   */
  async handleSogoWebhook(
    payload: unknown,
    rawPayload: string,
    signature: string,
    timestamp: string,
    secret: string
  ): Promise<void> {
    if (!timestamp) {
      throw new UnauthorizedException('Missing Sogo webhook timestamp');
    }

    if (!this.verifySogoSignature(rawPayload, timestamp, signature, secret)) {
      throw new UnauthorizedException('Invalid Sogo webhook signature');
    }

    const event = payload as Record<string, unknown>;
    const eventType = typeof event.type === 'string' ? event.type : 'unknown';
    this.logger.debug(`Sogo webhook received: ${eventType}`);

    switch (eventType) {
      case 'transaction.completed':
        await this.handleSogoTransactionCompleted(event);
        break;
      case 'transaction.failed':
        await this.handleSogoTransactionFailed(event);
        break;
      case 'transaction.refunded':
        await this.handleSogoTransactionRefunded(event);
        break;
      default:
        this.logger.warn(`Unhandled Sogo event type: ${eventType}`);
    }
  }

  /**
   * Handle Reloadly gift card transaction webhook
   */
  async handleReloadlyWebhook(
    payload: unknown,
    rawPayload: string,
    timestamp: string,
    signature: string,
    secret: string
  ): Promise<void> {
    if (!timestamp) {
      throw new UnauthorizedException('Missing Reloadly webhook timestamp');
    }

    if (!this.verifyReloadlySignature(rawPayload, timestamp, signature, secret)) {
      throw new UnauthorizedException('Invalid Reloadly webhook signature');
    }

    const event = payload as Record<string, unknown>;
    const eventType = typeof event.type === 'string' ? event.type : 'unknown';
    this.logger.debug(`Reloadly webhook received: ${eventType}`);

    switch (eventType) {
      case 'giftcard_transaction.status':
        await this.handleReloadlyTransactionStatus(event);
        break;
      default:
        this.logger.warn(`Unhandled Reloadly event type: ${eventType}`);
    }
  }

  private async handleSogoTransactionCompleted(event: Record<string, unknown>): Promise<void> {
    const data = (event.data ?? {}) as Record<string, unknown>;
    const transactionType = data.type as string | undefined;

    if (transactionType === 'crypto_sell') {
      await this.handleSogoCryptoCompleted(data);
      return;
    }
    if (transactionType === 'rmb_buy') {
      await this.handleSogoRmbCompleted(data);
      return;
    }

    const reference = (event.reference ?? event.id ?? event.transactionId) as string | undefined;
    if (!reference) {
      throw new BadRequestException('Missing reference in Sogo webhook');
    }

    this.logger.log(`Processing Sogo transaction completed: ${reference}`);

    const existing = await this.prisma.client.giftCardSellTransaction.findFirst({
      where: { providerTransactionId: reference, providerName: 'SOGO' }
    });
    if (!existing) {
      throw new BadRequestException(`Unknown Sogo transaction reference: ${reference}`);
    }

    const transaction = await this.prisma.client.giftCardSellTransaction.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    await this.queueProducer.enqueueDigitalValueProcessing(transaction.id, 'GIFT_CARD_SELL');
  }

  // Crypto sell has no debit — funds only ever move via this CREDIT, so the
  // idempotencyKey (derived from the Sogo transaction id) is the only guard
  // against double-crediting on a webhook retry.
  private async handleSogoCryptoCompleted(data: Record<string, unknown>): Promise<void> {
    const providerReference = data.reference as string | undefined;
    const txHash = (data.tx_hash ?? null) as string | null;
    const amountRaw = data.amount as number | undefined;
    if (!providerReference || amountRaw === undefined) {
      throw new BadRequestException('Missing reference/amount in Sogo crypto webhook');
    }

    const existing = await this.prisma.client.cryptoSellTransaction.findFirst({
      where: { providerName: 'sogo', providerReference }
    });
    if (!existing) {
      this.logger.warn(`Unknown Sogo crypto transaction reference: ${providerReference}`);
      return;
    }
    if (existing.status === 'completed') {
      this.logger.debug(`Sogo crypto transaction ${providerReference} already completed; skipping`);
      return;
    }

    const amountMinor = Math.round(amountRaw * 100);
    const idemKey = `crypto_credit_${existing.id}`;

    const ledgerEntry = await this.prisma.client.ledgerEntry.create({
      data: {
        walletId: existing.walletId,
        kind: 'CREDIT',
        amountMinor,
        currency: existing.currency,
        reference: idemKey,
        description: `Crypto sell credit${txHash ? ` (${txHash})` : ''}`,
        idempotencyKey: idemKey,
        sourceType: 'CryptoSellTransaction',
        sourceId: existing.id
      }
    });

    await this.prisma.client.cryptoSellTransaction.update({
      where: { id: existing.id },
      data: {
        status: 'completed',
        amountMinor,
        ...(txHash ? { txHash } : {}),
        creditLedgerEntryId: ledgerEntry.id
      }
    });
  }

  private async handleSogoRmbCompleted(data: Record<string, unknown>): Promise<void> {
    const providerReference = data.reference as string | undefined;
    if (!providerReference) {
      throw new BadRequestException('Missing reference in Sogo RMB webhook');
    }

    const updated = await this.prisma.client.rmbOrder.updateMany({
      where: { providerReference },
      data: { status: 'COMPLETED' }
    });
    if (updated.count === 0) {
      this.logger.warn(`Unknown Sogo RMB order reference: ${providerReference}`);
    }
  }

  private async handleSogoRmbRefunded(data: Record<string, unknown>): Promise<void> {
    const providerReference = data.reference as string | undefined;
    if (!providerReference) {
      throw new BadRequestException('Missing reference in Sogo RMB refund webhook');
    }

    const order = await this.prisma.client.rmbOrder.findFirst({ where: { providerReference } });
    if (!order) {
      this.logger.warn(`Unknown Sogo RMB order reference for refund: ${providerReference}`);
      return;
    }
    if (order.status === 'REFUNDED') return;

    const idemKey = `rmb_refund_${order.id}`;
    const ledgerEntry = await this.prisma.client.ledgerEntry.create({
      data: {
        walletId: order.walletId,
        kind: 'REVERSAL',
        amountMinor: order.ngnAmountMinor,
        currency: 'NGN',
        reference: idemKey,
        description: `RMB order refund → ${order.recipientName}`,
        idempotencyKey: idemKey,
        sourceType: 'RmbOrder',
        sourceId: order.id
      }
    });

    await this.prisma.client.rmbOrder.update({
      where: { id: order.id },
      data: { status: 'REFUNDED', refundLedgerEntryId: ledgerEntry.id }
    });
  }

  private async handleSogoTransactionRefunded(event: Record<string, unknown>): Promise<void> {
    const data = (event.data ?? {}) as Record<string, unknown>;
    if (data.type === 'rmb_buy') {
      await this.handleSogoRmbRefunded(data);
    } else {
      this.logger.warn(`Unhandled Sogo refund for transaction type: ${String(data.type)}`);
    }
  }

  private async handleSogoTransactionFailed(event: Record<string, unknown>): Promise<void> {
    const reference = (event.reference ?? event.id ?? event.transactionId) as string | undefined;
    if (!reference) {
      throw new BadRequestException('Missing reference in Sogo webhook');
    }

    this.logger.log(`Processing Sogo transaction failed: ${reference}`);

    const existing = await this.prisma.client.giftCardSellTransaction.findFirst({
      where: { providerTransactionId: reference, providerName: 'SOGO' }
    });
    if (!existing) {
      throw new BadRequestException(`Unknown Sogo transaction reference: ${reference}`);
    }

    const transaction = await this.prisma.client.giftCardSellTransaction.update({
      where: { id: existing.id },
      data: { status: 'FAILED' }
    });

    await this.queueProducer.enqueueDigitalValueProcessing(transaction.id, 'GIFT_CARD_SELL');
  }

  private async handleReloadlyTransactionStatus(event: Record<string, unknown>): Promise<void> {
    const transactionId = event.transactionId as string | undefined;
    if (!transactionId) {
      throw new BadRequestException('Missing transactionId in Reloadly webhook');
    }

    const status = event.status as string | undefined;
    this.logger.log(`Processing Reloadly transaction status: ${transactionId} = ${status}`);

    // Map Reloadly status to our GiftCardPurchaseStatus enum
    const statusMap: Record<string, GiftCardPurchaseStatus> = {
      SUCCESSFUL: 'FULFILLED',
      PENDING: 'PURCHASING',
      FAILED: 'FAILED'
    };

    const mappedStatus = statusMap[status ?? ''];
    if (!mappedStatus) {
      this.logger.warn(`Unmapped Reloadly status "${status}" for transaction ${transactionId}; skipping update`);
      return;
    }

    await this.prisma.client.giftCardPurchaseTransaction.updateMany({
      where: { supplierTransactionId: transactionId },
      data: { status: mappedStatus }
    });

    // Dispatch downstream processing job
    await this.queueProducer.enqueueDigitalValueProcessing(transactionId, 'GIFT_CARD_BUY');
  }

  private secureCompare(expected: string, actual: string | undefined): boolean {
    if (!actual) return false;

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(actual, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
