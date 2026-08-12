/**
 * Inbound provider callbacks for the financial-products domain.
 *
 * These are the only path by which a virtual-account deposit becomes wallet
 * balance, or a remittance transfer leaves PROCESSING. `FinancialProductsWebhookService`
 * and the per-provider signature verifiers in `@fliptrybe/providers` both
 * existed before this controller did — but nothing exposed them over HTTP, so a
 * provider callback had nowhere to land.
 *
 * Deliberately registered regardless of the customer-facing feature flags, for
 * the same reason FinancialProductsModule keeps its services registered: after a
 * vertical is switched off, in-flight transfers and deposits must still settle.
 *
 * Every handler follows the same order:
 *   1. read the RAW body (a re-serialised body would not match the signature)
 *   2. verify the signature, and record the delivery either way for audit
 *   3. reject unverified deliveries with 401 BEFORE any state changes
 *   4. hand the event to the idempotent processing service
 */
import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest
} from "@nestjs/common";

import {
  verifyFincraWebhook,
  verifyPayscribeWebhook,
  verifySwapprWebhook
} from "@fliptrybe/providers";

import { Public } from "../authorization.decorators";
import { PrismaService } from "../prisma.service";
import { FinancialProductsWebhookService } from "./financial-products-webhook.service";

type HeaderValue = string | undefined;

/** Part of ProviderWebhookEvent's (provider, domain, providerEventId) unique key. */
const DOMAIN = "FINANCIAL_PRODUCTS";

function readEventType(payload: Record<string, unknown>): string {
  for (const key of ["event", "type", "eventType", "event_type", "status"]) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "unknown";
}

@Public()
@Controller("webhooks/financial")
export class FinancialProductsWebhookController {
  private readonly logger = new Logger(FinancialProductsWebhookController.name);

  constructor(
    @Inject(FinancialProductsWebhookService)
    private readonly processor: FinancialProductsWebhookService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  @Post("swappr")
  @HttpCode(200)
  async swappr(
    @Req() request: RawBodyRequest<unknown>,
    @Headers("x-swappr-signature") signature: HeaderValue
  ) {
    const rawBody = request.rawBody?.toString() ?? "";
    const verified = verifySwapprWebhook({
      rawBody,
      signatureHeader: signature ?? "",
      secret: process.env["SWAPPR_WEBHOOK_SECRET"] ?? ""
    });

    return this.ingest("swappr", rawBody, signature, verified);
  }

  @Post("payscribe")
  @HttpCode(200)
  async payscribe(
    @Req() request: RawBodyRequest<unknown>,
    @Headers("x-payscribe-signature") signature: HeaderValue,
    @Headers("x-payscribe-event-id") eventId: HeaderValue,
    @Headers("x-payscribe-timestamp") timestamp: HeaderValue
  ) {
    const rawBody = request.rawBody?.toString() ?? "";
    const verified = verifyPayscribeWebhook({
      rawBody,
      signatureHeader: signature ?? "",
      secret: process.env["PAYSCRIBE_WEBHOOK_SECRET"] ?? "",
      ...(eventId === undefined ? {} : { eventId }),
      ...(timestamp === undefined ? {} : { timestamp })
    });

    return this.ingest("payscribe", rawBody, signature, verified);
  }

  @Post("fincra")
  @HttpCode(200)
  async fincra(
    @Req() request: RawBodyRequest<unknown>,
    @Headers("signature") signature: HeaderValue
  ) {
    const rawBody = request.rawBody?.toString() ?? "";
    const verified = verifyFincraWebhook(
      rawBody,
      signature ?? "",
      process.env["FINCRA_WEBHOOK_ENCRYPTION_KEY"] ?? ""
    );

    return this.ingest("fincra", rawBody, signature, verified);
  }

  /**
   * Records the delivery, rejects it if unsigned, then processes it.
   *
   * The audit row is written for rejected deliveries too — a burst of
   * signature failures is exactly the thing an operator needs to be able to see.
   */
  private async ingest(
    provider: string,
    rawBody: string,
    signature: HeaderValue,
    signatureValid: boolean
  ) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      // Recorded as an unparseable delivery rather than 500ing: a provider
      // retrying malformed JSON forever helps nobody.
      this.logger.warn(`${provider} webhook: body was not valid JSON`);
      throw new UnauthorizedException("Malformed webhook payload.");
    }

    const eventType = readEventType(payload);
    const providerEventId =
      typeof payload["id"] === "string"
        ? payload["id"]
        : typeof payload["reference"] === "string"
          ? payload["reference"]
          : `${provider}_${eventType}_${String(Date.now())}`;

    // ProviderWebhookEvent is unique on (provider, domain, providerEventId), and
    // providers retry deliveries. `create` would throw P2002 on every retry,
    // which the provider would read as a failure and retry again — so upsert.
    const event = await this.prisma.client.providerWebhookEvent.upsert({
      where: {
        provider_domain_providerEventId: {
          provider,
          domain: DOMAIN,
          providerEventId
        }
      },
      create: {
        provider,
        domain: DOMAIN,
        providerEventId,
        eventType,
        ...(signature ? { signature } : {}),
        signatureValid,
        rawPayload: payload as never
      },
      // A retry re-records the latest signature verdict and payload but must
      // never clear `processed` — that flag is what stops a second run of the
      // financial effects.
      update: {
        eventType,
        ...(signature ? { signature } : {}),
        signatureValid,
        rawPayload: payload as never
      }
    });

    if (!signatureValid) {
      this.logger.warn(`${provider} webhook rejected: invalid signature (event ${event.id})`);
      throw new UnauthorizedException("Invalid webhook signature.");
    }

    if (event.processed) {
      this.logger.log(`${provider} webhook ${providerEventId} already processed — acknowledging.`);
      return { ok: true, alreadyProcessed: true };
    }

    await this.processor.handle({
      providerWebhookEventId: event.id,
      provider,
      eventType,
      payload
    });

    return { ok: true };
  }
}
