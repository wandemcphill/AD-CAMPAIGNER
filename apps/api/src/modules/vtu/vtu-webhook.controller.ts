/**
 * Inbound webhook receiver for VTU supplier callbacks.
 *
 * The endpoint is registered at the bare path `webhooks/vtu` so the callback
 * URL stays outside the global API prefix in the same way `api/webhooks/korapay`
 * is excluded.
 *
 * Signature verification is intentionally shared-secret based until the active
 * provider documents a stable HMAC scheme.
 */
import { timingSafeEqual } from "node:crypto";

import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  type RawBodyRequest
} from "@nestjs/common";

import { Public } from "../authorization.decorators";
import { VtuService } from "./vtu.service";

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

@Public()
@Controller("webhooks")
export class VtuWebhookController {
  private readonly logger = new Logger(VtuWebhookController.name);

  constructor(@Inject(VtuService) private readonly vtu: VtuService) {}

  @Post("vtu")
  @HttpCode(200)
  async vtuWebhook(
    @Req() request: RawBodyRequest<unknown>,
    @Headers("x-signature") _unverifiedSignatureGuess: string | undefined,
    @Headers("x-vtu-webhook-secret") secretHeader: string | undefined,
    @Query("secret") secretQuery: string | undefined
  ) {
    const expectedSecret = process.env["VTU_WEBHOOK_SECRET"];

    if (!expectedSecret) {
      this.logger.error(
        "VTU webhook received but VTU_WEBHOOK_SECRET is not configured — rejecting " +
          "(fail-closed; see VtuWebhookController doc comment for why signature verification " +
          "is a shared secret, not real HMAC verification of the payload)."
      );
      throw new ServiceUnavailableException(
        "VTU webhook receiver is not configured. Set VTU_WEBHOOK_SECRET to enable it."
      );
    }

    const provided = secretHeader ?? secretQuery;
    if (!provided || !constantTimeEquals(provided, expectedSecret)) {
      this.logger.warn("VTU webhook rejected: missing or invalid shared secret.");
      throw new UnauthorizedException("Invalid webhook credentials.");
    }

    const rawBody = request.rawBody?.toString() ?? "";
    let payload: Record<string, unknown>;
    try {
      payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      this.logger.warn("VTU webhook: body was not valid JSON.");
      return { received: true, matched: false, processed: false };
    }

    const result = await this.vtu.handleVtuWebhook(payload);
    return result;
  }
}
