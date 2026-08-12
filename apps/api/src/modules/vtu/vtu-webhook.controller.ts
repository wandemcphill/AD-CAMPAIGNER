/**
 * Inbound webhook receiver for IACafe (VTU-family: airtime, data, cable,
 * electricity, betting, epins).
 *
 * IACafe's dashboard is already configured to POST both `transaction.created`
 * and `transaction.status_changed` events here — see the IACafe adapter in
 * `@fliptrybe/providers` (packages/providers/src/vtu.ts, `createIACafeAdapter`)
 * for the outbound side. Until this controller existed, that configured URL had
 * no matching route and every delivery 404'd.
 *
 * Registered at the bare path `webhooks/vtu` (not `v1/webhooks/vtu`) because
 * IACafe's dashboard is already pointed at
 * `https://ft-campaigner-api-fra.onrender.com/webhooks/vtu` — see the
 * `exclude` list in apps/api/src/main.ts's `setGlobalPrefix` call, which keeps
 * this path off the "v1" prefix applied to the rest of the API, the same way
 * `api/webhooks/korapay` is excluded.
 *
 * ── Signature verification: INTERIM, NOT IACafe's real scheme ──────────────
 * IACafe's marketing page mentions "signed webhooks" as a feature, but we do
 * not have their Webhooks doc page and therefore do not know their HMAC header
 * name, secret format, or verification algorithm. Inventing one would be
 * worse than useless — it would look like real verification while verifying
 * nothing.
 *
 * Chosen approach: (a) a shared secret WE define on our side, configured via
 * `IACAFE_WEBHOOK_SECRET`, that IACafe's dashboard lets you set as a static
 * token/query param on the configured webhook URL (many providers, including
 * ones already integrated in this codebase, support this as a "poor man's
 * auth" even before real per-payload signing). This is defining our side of a
 * shared secret, not fabricating IACafe's signing algorithm.
 *
 * Posture is default-deny: if `IACAFE_WEBHOOK_SECRET` is unset, every request
 * is rejected with 501 rather than silently trusted. Once IACafe's actual
 * signature scheme is documented, replace this with real HMAC verification
 * (see verifySwapprWebhook / verifyPayscribeWebhook / verifyFincraWebhook in
 * @fliptrybe/providers for the pattern to follow) and keep the shared secret
 * only as defense-in-depth, not the sole gate.
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
  async iacafeWebhook(
    @Req() request: RawBodyRequest<unknown>,
    // Guessed header name, left as a documented placeholder only — NOT wired up,
    // since we don't know IACafe's real signing scheme. Do not treat this as
    // verification; it is here so a future implementer sees where it would go.
    @Headers("x-signature") _unverifiedSignatureGuess: string | undefined,
    @Headers("x-iacafe-webhook-secret") secretHeader: string | undefined,
    @Query("secret") secretQuery: string | undefined
  ) {
    const expectedSecret = process.env["IACAFE_WEBHOOK_SECRET"];

    if (!expectedSecret) {
      this.logger.error(
        "IACafe webhook received but IACAFE_WEBHOOK_SECRET is not configured — rejecting " +
          "(fail-closed; see VtuWebhookController doc comment for why signature verification " +
          "is a shared secret, not real HMAC verification of IACafe's payload)."
      );
      throw new ServiceUnavailableException(
        "IACafe webhook receiver is not configured. Set IACAFE_WEBHOOK_SECRET to enable it."
      );
    }

    const provided = secretHeader ?? secretQuery;
    if (!provided || !constantTimeEquals(provided, expectedSecret)) {
      this.logger.warn("IACafe webhook rejected: missing or invalid shared secret.");
      throw new UnauthorizedException("Invalid webhook credentials.");
    }

    const rawBody = request.rawBody?.toString() ?? "";
    let payload: Record<string, unknown>;
    try {
      payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      this.logger.warn("IACafe webhook: body was not valid JSON.");
      return { received: true, matched: false, processed: false };
    }

    const result = await this.vtu.handleIACafeWebhook(payload);
    return result;
  }
}
