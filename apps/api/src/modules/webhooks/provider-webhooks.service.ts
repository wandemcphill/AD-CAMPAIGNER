import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
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
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  /**
   * Verify HMAC-SHA256 signature for Reloadly webhooks
   * Reloadly uses: HMAC-SHA256(payload, secret) in base64
   */
  verifyReloadlySignature(payload: string, signature: string, secret: string): boolean {
    const digest = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }

  /**
   * Handle Sogo gift card transaction webhook
   */
  async handleSogoWebhook(
    payload: unknown,
    signature: string,
    timestamp: string,
    secret: string
  ): Promise<void> {
    // Verify signature
    const payloadString = JSON.stringify(payload);
    if (!this.verifySogoSignature(payloadString, timestamp, signature, secret)) {
      throw new UnauthorizedException('Invalid Sogo webhook signature');
    }

    const event = payload as Record<string, unknown>;
    this.logger.debug(`Sogo webhook received: ${event.type}`);

    switch (event.type) {
      case 'transaction.completed':
        await this.handleSogoTransactionCompleted(event);
        break;
      case 'transaction.failed':
        await this.handleSogoTransactionFailed(event);
        break;
      default:
        this.logger.warn(`Unhandled Sogo event type: ${event.type}`);
    }
  }

  /**
   * Handle Reloadly gift card transaction webhook
   */
  async handleReloadlyWebhook(
    payload: unknown,
    signature: string,
    secret: string
  ): Promise<void> {
    // Verify signature
    const payloadString = JSON.stringify(payload);
    if (!this.verifyReloadlySignature(payloadString, signature, secret)) {
      throw new UnauthorizedException('Invalid Reloadly webhook signature');
    }

    const event = payload as Record<string, unknown>;
    this.logger.debug(`Reloadly webhook received: ${event.type}`);

    switch (event.type) {
      case 'giftcard_transaction.status':
        await this.handleReloadlyTransactionStatus(event);
        break;
      default:
        this.logger.warn(`Unhandled Reloadly event type: ${event.type}`);
    }
  }

  private async handleSogoTransactionCompleted(event: Record<string, unknown>): Promise<void> {
    const reference = event.reference as string | undefined;
    if (!reference) {
      throw new BadRequestException('Missing reference in Sogo webhook');
    }

    this.logger.log(`Processing Sogo transaction completed: ${reference}`);

    // Update DigitalValueOrder status to COMPLETED
    await this.prisma.client.digitalValueOrder.updateMany({
      where: {
        providerReference: reference,
        provider: 'SOGO'
      },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      }
    });

    // Dispatch event for downstream processing
    await this.queueProducer.enqueue('digital-value-event', {
      type: 'gift_card_completed',
      reference,
      provider: 'SOGO'
    });
  }

  private async handleSogoTransactionFailed(event: Record<string, unknown>): Promise<void> {
    const reference = event.reference as string | undefined;
    if (!reference) {
      throw new BadRequestException('Missing reference in Sogo webhook');
    }

    this.logger.log(`Processing Sogo transaction failed: ${reference}`);

    // Update DigitalValueOrder status to FAILED
    await this.prisma.client.digitalValueOrder.updateMany({
      where: {
        providerReference: reference,
        provider: 'SOGO'
      },
      data: {
        status: 'FAILED',
        failureReason: event.reason as string | undefined,
        updatedAt: new Date()
      }
    });

    // Dispatch event for downstream processing
    await this.queueProducer.enqueue('digital-value-event', {
      type: 'gift_card_failed',
      reference,
      provider: 'SOGO',
      reason: event.reason
    });
  }

  private async handleReloadlyTransactionStatus(event: Record<string, unknown>): Promise<void> {
    const transactionId = event.transactionId as string | undefined;
    if (!transactionId) {
      throw new BadRequestException('Missing transactionId in Reloadly webhook');
    }

    const status = event.status as string | undefined;
    this.logger.log(`Processing Reloadly transaction status: ${transactionId} = ${status}`);

    // Map Reloadly status to our status
    const statusMap: Record<string, string> = {
      SUCCESSFUL: 'COMPLETED',
      PENDING: 'PROCESSING',
      FAILED: 'FAILED'
    };

    const mappedStatus = statusMap[status || ''] || status;

    // Update DigitalValueOrder status
    await this.prisma.client.digitalValueOrder.updateMany({
      where: {
        providerReference: transactionId,
        provider: 'RELOADLY'
      },
      data: {
        status: mappedStatus as any,
        updatedAt: new Date()
      }
    });

    // Dispatch event for downstream processing
    await this.queueProducer.enqueue('digital-value-event', {
      type: 'gift_card_status_update',
      reference: transactionId,
      provider: 'RELOADLY',
      status: mappedStatus
    });
  }
}
