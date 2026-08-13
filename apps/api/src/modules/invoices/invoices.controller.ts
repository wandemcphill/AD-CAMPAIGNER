import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { RequireFeature } from "../feature-flag.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import type { CreateInvoiceDto } from "./invoices.dtos";
import { InvoicesService } from "./invoices.service";

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
