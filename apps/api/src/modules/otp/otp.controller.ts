import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";

import type {
  CreateOtpOrderDto,
  OtpPricingRuleDto,
  OtpProviderControlDto,
  QuoteOtpOrderDto
} from "./otp.dtos";
import { Public, RequirePermissions } from "../authorization.decorators";
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
  quote(@Body() body: QuoteOtpOrderDto) {
    return this.otp.quote(body);
  }

  @Get("orders")
  orders() {
    return this.otp.listOrders();
  }

  @Post("orders")
  createOrder(
    @Body() body: CreateOtpOrderDto,
    @Headers("x-forwarded-for") ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
    @Headers("x-device-id") deviceId?: string
  ) {
    return this.otp.createOrder(body, {
      ...(ipAddress === undefined ? {} : { ipAddress }),
      ...(userAgent === undefined ? {} : { userAgent }),
      ...(deviceId === undefined ? {} : { deviceId })
    });
  }

  @Get("orders/:id")
  getOrder(@Param("id") id: string) {
    return this.otp.getOrder(id);
  }

  @Post("orders/:id/cancel")
  cancel(@Param("id") id: string) {
    return this.otp.cancelOrder(id);
  }

  @Post("orders/:id/refund")
  refund(@Param("id") id: string) {
    return this.otp.refundOrder(id);
  }

  @Get("wallet")
  wallet() {
    return this.otp.getWallet();
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
