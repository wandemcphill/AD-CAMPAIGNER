import { Body, Controller, Get, Headers, Inject, Param, Post, Req } from "@nestjs/common";

import type {
  CreateOtpOrderDto,
  OtpPricingRuleDto,
  OtpProviderControlDto,
  QuoteOtpOrderDto
} from "./otp.dtos";
import { Public, RequirePermissions } from "../authorization.decorators";
import {
  workspaceContextFromRequest,
  type WorkspaceContextRequest
} from "../request-context";
import { OtpMarketplaceService } from "./otp.service";

@Controller("otp")
@RequirePermissions("payment:manage")
export class OtpController {
  constructor(@Inject(OtpMarketplaceService) private readonly otp: OtpMarketplaceService) {}

  @Get("services")
  @Public()
  services() {
    return this.otp.listServices();
  }

  @Post("quote")
  @RequirePermissions("analytics:read")
  quote(@Body() body: QuoteOtpOrderDto, @Req() request: WorkspaceContextRequest) {
    return this.otp.quote(body, workspaceContextFromRequest(request));
  }

  @Get("orders")
  orders(@Req() request: WorkspaceContextRequest) {
    return this.otp.listOrders(workspaceContextFromRequest(request));
  }

  @Post("orders")
  createOrder(
    @Body() body: CreateOtpOrderDto,
    @Headers("x-forwarded-for") ipAddress: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Headers("x-device-id") deviceId: string | undefined,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.otp.createOrder(
      body,
      {
        ...(ipAddress === undefined ? {} : { ipAddress }),
        ...(userAgent === undefined ? {} : { userAgent }),
        ...(deviceId === undefined ? {} : { deviceId })
      },
      workspaceContextFromRequest(request)
    );
  }

  @Get("orders/:id")
  getOrder(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.otp.getOrder(id, workspaceContextFromRequest(request));
  }

  @Post("orders/:id/cancel")
  cancel(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.otp.cancelOrder(id, workspaceContextFromRequest(request));
  }

  @Post("orders/:id/refund")
  refund(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.otp.refundOrder(id, workspaceContextFromRequest(request));
  }

  @Get("wallet")
  wallet(@Req() request: WorkspaceContextRequest) {
    return this.otp.getWallet(workspaceContextFromRequest(request));
  }
}

@Controller("admin/otp")
@RequirePermissions("admin:access")
export class AdminOtpController {
  constructor(@Inject(OtpMarketplaceService) private readonly otp: OtpMarketplaceService) {}

  @Get("overview")
  overview() {
    return this.otp.getAdminOverview();
  }

  @Get("providers")
  providers() {
    return this.otp.getAdminProviders();
  }

  @Get("risk")
  risk() {
    return this.otp.getAdminRisk();
  }

  @Get("audit")
  audit() {
    return this.otp.getAdminAudit();
  }

  @Post("providers/:id/controls")
  controls(@Param("id") id: string, @Body() body: OtpProviderControlDto) {
    return this.otp.setProviderControl(id, body);
  }

  @Get("pricing-rules")
  pricingRules() {
    return this.otp.getPricingRules();
  }

  @Post("pricing-rules")
  pricing(@Body() body: OtpPricingRuleDto) {
    return this.otp.setPricingRule(body);
  }
}
