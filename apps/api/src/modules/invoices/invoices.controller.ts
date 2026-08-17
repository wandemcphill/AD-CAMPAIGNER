import { Body, Controller, Get, Headers, Inject, Param, Post, Req, type RawBodyRequest } from "@nestjs/common";

import { Public, RequirePermissions } from "../authorization.decorators";
import { RequireFeature } from "../feature-flag.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import type { CreateInvoiceDto, PayInvoiceDto } from "./invoices.dtos";
import { InvoicesService } from "./invoices.service";

// Public resolver + payment for a shared invoice link. Unauthenticated, and
// deliberately returns only payer-facing fields (see InvoicesService.resolvePublic).
@Controller("public/invoices")
@Public()
export class PublicInvoicesController {
  constructor(@Inject(InvoicesService) private readonly invoices: InvoicesService) {}

  @Get(":id")
  resolve(@Param("id") id: string) {
    return this.invoices.resolvePublic(id);
  }

  @Post(":id/pay")
  pay(@Param("id") id: string, @Body() body: PayInvoiceDto) {
    return this.invoices.initiatePayment(id, body, body.redirectUrl);
  }
}

@Controller("api/webhooks")
@Public()
export class InvoicesWebhookController {
  constructor(@Inject(InvoicesService) private readonly invoices: InvoicesService) {}

  @Post("korapay-invoice")
  korapay(@Body() body: unknown, @Headers("x-korapay-signature") signature?: string) {
    return this.invoices.handleKorapayWebhook(body, signature);
  }

  @Post("payscribe-invoice")
  payscribe(
    @Body() body: unknown,
    @Req() request: RawBodyRequest<unknown>,
    @Headers("x-payscribe-signature") signature?: string,
    @Headers("x-payscribe-event-id") eventId?: string,
    @Headers("x-payscribe-timestamp") timestamp?: string,
    @Headers("x-payscribe-event") event?: string
  ) {
    return this.invoices.handlePayscribeWebhook(body, request.rawBody?.toString() ?? "", {
      ...(signature ? { signature } : {}),
      ...(eventId ? { eventId } : {}),
      ...(timestamp ? { timestamp } : {}),
      ...(event ? { event } : {})
    });
  }
}

// Customer invoicing. Reads require analytics:read (any workspace role); creating,
// sending, marking paid and voiding require payment:manage (FINANCE and up).
@Controller("invoices")
@RequireFeature("invoicing")
@RequirePermissions("analytics:read")
export class InvoicesController {
  constructor(@Inject(InvoicesService) private readonly invoices: InvoicesService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.invoices.list(workspaceContextFromRequest(request));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.invoices.get(workspaceContextFromRequest(request), id);
  }

  @Post()
  @RequirePermissions("payment:manage")
  create(@Body() body: CreateInvoiceDto, @Req() request: WorkspaceContextRequest) {
    return this.invoices.create(workspaceContextFromRequest(request), body);
  }

  @Post(":id/send")
  @RequirePermissions("payment:manage")
  send(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.invoices.send(workspaceContextFromRequest(request), id);
  }

  @Post(":id/mark-paid")
  @RequirePermissions("payment:manage")
  markPaid(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.invoices.markPaid(workspaceContextFromRequest(request), id);
  }

  @Post(":id/void")
  @RequirePermissions("payment:manage")
  void(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.invoices.void(workspaceContextFromRequest(request), id);
  }
}
