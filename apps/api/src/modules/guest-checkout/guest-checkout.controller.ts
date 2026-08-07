import { Body, Controller, Get, Header, Headers, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { Public, RequirePermissions } from "../authorization.decorators";
import {
  metadataContextFromHeaders,
  workspaceContextFromRequest,
  type HeaderBag,
  type WorkspaceContextRequest
} from "../request-context";
import { GuestCheckoutService } from "./guest-checkout.service";
import type {
  AdminGuestTransactionQueryDto,
  GuestCheckoutDto,
  GuestMigrateDto,
  GuestPaymentDto
} from "./guest-checkout.dtos";

interface MinimalRequest {
  headers: HeaderBag;
}

function requestContext(request: MinimalRequest) {
  const meta = metadataContextFromHeaders(request.headers);
  return { ipAddress: meta.ipAddress, userAgent: meta.userAgent };
}

// Class-level default requires auth; individual guest-facing routes opt out with
// @Public() (same pattern as DigitalAccessController) — the only route that should
// require a logged-in user is /guest/migrate, which imports a guest's past purchases
// into their new account.
@ApiTags("Guest Checkout")
@Controller("guest")
@RequirePermissions("analytics:read")
export class GuestCheckoutController {
  constructor(@Inject(GuestCheckoutService) private readonly guest: GuestCheckoutService) {}

  @Post("checkout")
  @Public()
  @Throttle({ short: { limit: 8, ttl: 60_000 } })
  @ApiOperation({
    summary: "Start a guest bill purchase (no account required)",
    description:
      "Creates a pending GuestTransaction and returns its server-computed price. Does not create a User " +
      "or Wallet. For AIRTIME/ELECTRICITY/BETTING the amountMinor field sets the purchase amount; for " +
      "DATA/CABLE/EDUCATION the price is looked up from the VTU catalog and any client-supplied amount is ignored."
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["productType", "email"],
      properties: {
        productType: { type: "string", enum: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "BETTING", "EDUCATION"] },
        email: { type: "string", format: "email" },
        phone: { type: "string" },
        amountMinor: { type: "integer", description: "Required for AIRTIME/ELECTRICITY/BETTING only." },
        currency: { type: "string", default: "NGN" },
        idempotencyKey: { type: "string" },
        network: { type: "string", enum: ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"], description: "AIRTIME/DATA" },
        msisdn: { type: "string", description: "AIRTIME/DATA" },
        bundleId: { type: "string", description: "DATA — providerPlanId from the catalog" },
        disco: { type: "string", description: "ELECTRICITY" },
        meterNumber: { type: "string", description: "ELECTRICITY" },
        meterType: { type: "string", enum: ["PREPAID", "POSTPAID"] },
        cableProvider: { type: "string", description: "CABLE" },
        smartCardNumber: { type: "string", description: "CABLE" },
        packageCode: { type: "string", description: "CABLE" },
        bookmaker: { type: "string", description: "BETTING" },
        customerId: { type: "string", description: "BETTING" },
        examType: { type: "string", description: "EDUCATION" }
      }
    }
  })
  checkout(@Body() body: GuestCheckoutDto, @Req() request: MinimalRequest) {
    return this.guest.checkout(body, requestContext(request));
  }

  @Post("payment")
  @Public()
  @Throttle({ short: { limit: 8, ttl: 60_000 } })
  @ApiOperation({
    summary: "Create a payment intent for a guest transaction",
    description: "Returns a hosted checkoutUrl. The transaction is fulfilled automatically once the payment webhook confirms."
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["reference"],
      properties: { reference: { type: "string" }, redirectUrl: { type: "string" } }
    }
  })
  initiatePayment(@Body() body: GuestPaymentDto, @Req() request: MinimalRequest) {
    return this.guest.initiatePayment(body.reference, body.redirectUrl, requestContext(request));
  }

  @Get("status/:reference")
  @Public()
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Poll payment/fulfilment status for a guest transaction" })
  @ApiParam({ name: "reference", description: "The GuestTransaction reference returned by POST /guest/checkout" })
  status(@Param("reference") reference: string) {
    return this.guest.getStatus(reference);
  }

  @Get("receipt/:reference")
  @Public()
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Fetch the full receipt for a guest transaction" })
  @ApiParam({ name: "reference", description: "The GuestTransaction reference returned by POST /guest/checkout" })
  receipt(@Param("reference") reference: string) {
    return this.guest.getReceipt(reference);
  }

  @Get("returning")
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Check whether an email/phone has purchased as a guest before" })
  @ApiQuery({ name: "contact", description: "Email or phone number to look up" })
  returning(@Query("contact") contact: string) {
    return this.guest.lookupReturningGuest(contact);
  }

  @Post("migrate")
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: "Import a guest's past purchases into the caller's account (requires auth)",
    description: "Attaches every unmigrated GuestTransaction matching emailOrPhone to the authenticated user, without duplicating rows."
  })
  @ApiBody({ schema: { type: "object", required: ["emailOrPhone"], properties: { emailOrPhone: { type: "string" } } } })
  migrate(@Body() body: GuestMigrateDto, @Req() request: WorkspaceContextRequest) {
    const context = workspaceContextFromRequest(request);
    return this.guest.migrateToUser(body.emailOrPhone, context.userId);
  }
}

@ApiTags("Guest Checkout")
@Controller("api/webhooks")
@Public()
export class GuestCheckoutWebhookController {
  constructor(@Inject(GuestCheckoutService) private readonly guest: GuestCheckoutService) {}

  @Post("korapay-guest")
  @ApiOperation({
    summary: "Korapay payment webhook for guest checkout (not versioned, not for direct client use)",
    description: "Verified via HMAC-SHA256 (x-korapay-signature). Re-verifies payment status against the gateway before fulfilling — never trusts the payload alone."
  })
  korapay(@Body() body: unknown, @Headers("x-korapay-signature") signature?: string) {
    return this.guest.handleKorapayWebhook(body, signature);
  }
}

@ApiTags("Guest Checkout Admin")
@Controller("admin/guest-checkout")
@RequirePermissions("admin:access")
export class AdminGuestCheckoutController {
  constructor(@Inject(GuestCheckoutService) private readonly guest: GuestCheckoutService) {}

  @Get("transactions")
  @ApiOperation({ summary: "List/filter guest transactions" })
  @ApiQuery({ name: "paymentStatus", required: false, enum: ["PENDING", "PAID", "FAILED"] })
  @ApiQuery({ name: "fulfilmentStatus", required: false, enum: ["PENDING", "PROCESSING", "DELIVERED", "FAILED", "REFUNDED"] })
  @ApiQuery({ name: "email", required: false })
  @ApiQuery({ name: "phone", required: false })
  @ApiQuery({ name: "reference", required: false })
  @ApiQuery({ name: "providerReference", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  list(@Query() query: AdminGuestTransactionQueryDto) {
    return this.guest.adminList(query);
  }

  @Get("transactions/export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="guest-transactions.csv"')
  @ApiOperation({
    summary: "Export filtered guest transactions as CSV",
    description: "Streams a real CSV file (Content-Disposition: attachment) — not a JSON envelope."
  })
  export(@Query() query: AdminGuestTransactionQueryDto) {
    return this.guest.adminExportCsv(query);
  }

  @Post("transactions/:reference/retry")
  @ApiOperation({ summary: "Retry fulfilment for a paid transaction whose fulfilment failed" })
  @ApiParam({ name: "reference" })
  retry(@Param("reference") reference: string) {
    return this.guest.retryFulfilment(reference);
  }
}
