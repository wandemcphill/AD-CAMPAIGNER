import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import type {
  BuyTelecomAirtimeDto,
  BuyTelecomDataDto,
  DetectNumberDto,
  TelecomOrderQueryDto
} from "./telecom-gateway.dtos";
import { TelecomGatewayService } from "./telecom-gateway.service";

@Controller("telecom")
@RequirePermissions("analytics:read")
export class TelecomGatewayController {
  constructor(@Inject(TelecomGatewayService) private readonly telecom: TelecomGatewayService) {}

  @Post("detect")
  detectNumber(@Body() body: DetectNumberDto) {
    return this.telecom.detectNumber(body.phoneNumber);
  }

  @Get("products")
  listProducts(@Query("countryIso") countryIso: string, @Query("operatorId") operatorId: string) {
    return this.telecom.listProducts(countryIso, operatorId);
  }

  @Get("providers/health")
  @RequirePermissions("admin:access")
  listProviderHealth() {
    return this.telecom.listProviderHealth();
  }

  @Post("airtime")
  @RequirePermissions("campaign:create")
  buyAirtime(@Body() body: BuyTelecomAirtimeDto, @Req() request: WorkspaceContextRequest) {
    return this.telecom.buyAirtime(workspaceContextFromRequest(request), body);
  }

  @Post("data")
  @RequirePermissions("campaign:create")
  buyData(@Body() body: BuyTelecomDataDto, @Req() request: WorkspaceContextRequest) {
    return this.telecom.buyData(workspaceContextFromRequest(request), body);
  }

  @Get("orders")
  listOrders(@Query() query: TelecomOrderQueryDto, @Req() request: WorkspaceContextRequest) {
    return this.telecom.listOrders(workspaceContextFromRequest(request), query);
  }

  @Get("orders/:id")
  getOrderStatus(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.telecom.getOrderStatus(workspaceContextFromRequest(request), id);
  }
}
