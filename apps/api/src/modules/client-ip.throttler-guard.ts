import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { clientIpFromHeaders, type HeaderBag } from "./request-context";

/**
 * ThrottlerGuard keyed on the real client rather than on `req.ip`.
 *
 * The stock guard tracks `req.ip`, which behind Render's Cloudflare-fronted
 * proxy is the front-end that forwarded the request, not the caller. Measured
 * in production: six requests from one client over separate connections came
 * back 93 → 99 → 94 → 92 → 91 → 99, each connection landing on a different
 * front-end and drawing on that front-end's bucket. So an attacker who
 * reconnects between attempts gets a fresh allowance on /v1/auth/login every
 * time, while unrelated customers sharing a front-end share a budget.
 *
 * Worth knowing when reading this: over a single keep-alive connection the
 * broken tracker looks correct, because the socket pins every request to one
 * front-end. That is why the bug survived — it is invisible unless you force
 * new connections.
 *
 * See clientIpFromHeaders for why cf-connecting-ip is the trustworthy source
 * here and what the x-forwarded-for fallback is and is not worth.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: { headers?: HeaderBag; ip?: string }): Promise<string> {
    const tracker = clientIpFromHeaders(req.headers ?? {}) ?? req.ip;

    // "unknown" buckets every unidentifiable caller together. That is the safe
    // direction to fail: it over-restricts a caller we cannot identify rather
    // than handing each one a fresh, unlimited bucket.
    return Promise.resolve(tracker ?? "unknown");
  }
}
