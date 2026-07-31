import { createHmac, timingSafeEqual } from "node:crypto";

import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post, Query, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { Public, RequirePermissions } from "../authorization.decorators";
import type {
  MessagesListQueryDto,
  NumbersListQueryDto,
  PurchaseNumberDto,
  RenewNumberDto
} from "./virtual-numbers.dtos";
import { VirtualNumbersService } from "./virtual-numbers.service";

@Controller("virtual-numbers")
export class VirtualNumbersController {
  constructor(
    @Inject(VirtualNumbersService) private readonly numbers: VirtualNumbersService
  ) {}

  @Get("countries")
  @Public()
  countries() {
    return this.numbers.listCountries();
  }

  @Get("products")
  @Public()
  products(@Query("country") country: string) {
    return this.numbers.listProducts(country);
  }

  @Post("orders")
  @RequirePermissions("campaign:create")
  purchase(@Body() body: PurchaseNumberDto, @Req() request: WorkspaceContextRequest) {
    return this.numbers.purchaseNumber(workspaceContextFromRequest(request), body);
  }

  @Get("numbers")
  @RequirePermissions("analytics:read")
  myNumbers(@Query() query: NumbersListQueryDto, @Req() request: WorkspaceContextRequest) {
    return this.numbers.listMyNumbers(workspaceContextFromRequest(request), query);
  }

  @Get("numbers/:id")
  @RequirePermissions("analytics:read")
  numberDetail(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.numbers.getNumber(workspaceContextFromRequest(request), id);
  }

  @Get("numbers/:id/messages")
  @RequirePermissions("analytics:read")
  messages(
    @Param("id") id: string,
    @Query() query: MessagesListQueryDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.numbers.listMessages(workspaceContextFromRequest(request), id, query);
  }

  @Post("numbers/:id/renew")
  @RequirePermissions("campaign:create")
  renew(
    @Param("id") id: string,
    @Body() body: RenewNumberDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.numbers.renewNumber(workspaceContextFromRequest(request), id, body);
  }

  @Post("numbers/:id/release")
  @RequirePermissions("campaign:create")
  release(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.numbers.releaseNumber(workspaceContextFromRequest(request), id);
  }
}

interface ProviderWebhookPayload {
  providerNumberId: string;
  providerMessageId?: string;
  sender?: string;
  text: string;
  receivedAt?: string;
}

function getSecret(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "..." || trimmed.startsWith("replace-")) return undefined;
  return trimmed;
}

const WEBHOOK_SECRET_ENV: Record<string, string> = {
  smspool: "SMSPOOL_WEBHOOK_SECRET",
  "5sim": "FIVESIM_WEBHOOK_SECRET",
  smspva: "SMSPVA_WEBHOOK_SECRET"
};

// HMAC-SHA256 over the raw JSON body, compared against an X-Signature header —
// mirrors verifyKorapaySignature's shape in managed-ads.service.ts. Real per-provider
// signing schemes are unconfirmed without live credentials (same caveat as
// ClubKonnect's adapter); this is the common-case implementation to swap in once each
// provider's actual webhook docs are available.
//
// Fails OPEN only outside production when no secret is configured, so local/dev testing
// works without credentials. Fails CLOSED in production without a secret, and always
// fails closed on a missing/invalid signature — an unauthenticated caller must not be
// able to write arbitrary "received SMS" rows against a customer's number.
function verifyProviderWebhookSignature(input: {
  provider: string;
  body: unknown;
  signature?: string | undefined;
}): boolean {
  const envName = WEBHOOK_SECRET_ENV[input.provider];
  const signingSecret = envName ? getSecret(process.env[envName]) : undefined;

  if (!signingSecret) {
    return process.env.NODE_ENV !== "production";
  }
  if (!input.signature) {
    return false;
  }

  const signedPayload = JSON.stringify(input.body ?? {});
  const expected = Buffer.from(createHmac("sha256", signingSecret).update(signedPayload).digest("hex"));
  const actual = Buffer.from(input.signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Controller("webhooks/numbers")
export class VirtualNumbersWebhookController {
  constructor(
    @Inject(VirtualNumbersService) private readonly numbers: VirtualNumbersService
  ) {}

  @Post(":provider")
  @Public()
  async receive(
    @Param("provider") provider: string,
    @Body() body: ProviderWebhookPayload,
    @Headers("x-signature") signature?: string
  ) {
    if (!verifyProviderWebhookSignature({ provider, body, signature })) {
      throw new BadRequestException("Invalid webhook signature.");
    }

    return this.numbers.ingestMessage({
      providerName: provider,
      providerNumberId: body.providerNumberId,
      ...(body.providerMessageId ? { providerMessageId: body.providerMessageId } : {}),
      ...(body.sender ? { senderRaw: body.sender } : {}),
      body: body.text,
      receivedAt: body.receivedAt ?? new Date().toISOString()
    });
  }
}

@Controller("admin/digital-products")
@RequirePermissions("admin:access")
export class AdminVirtualNumbersController {
  constructor(
    @Inject(VirtualNumbersService) private readonly numbers: VirtualNumbersService
  ) {}

  @Get("numbers")
  listNumbers(@Query() query: { status?: string; page?: number; limit?: number }) {
    return this.numbers.adminListNumbers(query);
  }

  @Post("numbers/:id/release")
  forceRelease(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.numbers.adminForceRelease(id, workspaceContextFromRequest(request).userId);
  }

  @Get("orders")
  listOrders(@Query() query: { status?: string; page?: number; limit?: number }) {
    return this.numbers.adminListOrders(query);
  }

  @Post("orders/:id/retry")
  retryOrder(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.numbers.adminRetryOrder(id, workspaceContextFromRequest(request).userId);
  }

  @Get("providers/health")
  providerHealth() {
    return this.numbers.adminProviderHealth();
  }
}
