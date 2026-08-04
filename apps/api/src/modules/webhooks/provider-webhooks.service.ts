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
