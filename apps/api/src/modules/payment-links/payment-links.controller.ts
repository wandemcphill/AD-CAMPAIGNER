import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";

import { Public, RequirePermissions } from "../authorization.decorators";
import { RequireFeature } from "../feature-flag.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import type { CreatePaymentLinkDto } from "./payment-links.dtos";
import { PaymentLinksService } from "./payment-links.service";

// Public resolver for a shared link's payer-facing page. Unauthenticated, and
// returns only the payer-relevant fields (never workspace internals or totals).
@Controller("public/payment-links")
@RequireFeature("paymentLinks")
export class PublicPaymentLinksController {
  constructor(@Inject(PaymentLinksService) private readonly paymentLinks: PaymentLinksService) {}

  @Get(":reference")
  @Public()
  resolve(@Param("reference") reference: string) {
    return this.paymentLinks.resolvePublic(reference);
  }
}

// Shareable payment links. Reads require analytics:read (any workspace role);
// creating and disabling require payment:manage.
@Controller("payment-links")
@RequireFeature("paymentLinks")
@RequirePermissions("analytics:read")
export class PaymentLinksController {
  constructor(@Inject(PaymentLinksService) private readonly paymentLinks: PaymentLinksService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.paymentLinks.list(workspaceContextFromRequest(request));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.paymentLinks.get(workspaceContextFromRequest(request), id);
  }

  @Post()
  @RequirePermissions("payment:manage")
  create(@Body() body: CreatePaymentLinkDto, @Req() request: WorkspaceContextRequest) {
    return this.paymentLinks.create(workspaceContextFromRequest(request), body);
  }

  @Post(":id/disable")
  @RequirePermissions("payment:manage")
  disable(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.paymentLinks.disable(workspaceContextFromRequest(request), id);
  }
}
