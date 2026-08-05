import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";

import {
  workspaceContextFromRequest,
  type WorkspaceContextRequest
} from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import type {
  AdminVtuRouteUpdateDto,
  BillsOrderQueryDto,
  BuyCableDto,
  BuyElectricityDto,
  BuyAirtimeDto,
  BuyDataDto,
  ValidateMeterDto,
  VtuOrderQueryDto
} from "./vtu.dtos";
import { VtuService } from "./vtu.service";

@Controller("vtu")
@RequirePermissions("analytics:read")
export class VtuController {
  constructor(@Inject(VtuService) private readonly vtu: VtuService) {}

  @Get("data-plans")
  listDataPlans(@Query("network") network?: BuyDataDto["network"]) {
    return this.vtu.listDataPlans(network);
  }

  @Get("orders")
  @RequirePermissions("analytics:read")
  listOrders(@Query() query: VtuOrderQueryDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.listOrders(workspaceContextFromRequest(request), query);
  }

  @Post("airtime")
  @RequirePermissions("campaign:create")
  buyAirtime(@Body() body: BuyAirtimeDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyAirtime(workspaceContextFromRequest(request), body);
  }

  @Post("data")
  @RequirePermissions("campaign:create")
  buyData(@Body() body: BuyDataDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyData(workspaceContextFromRequest(request), body);
  }

  // Phase 5 — Bills & Cable

  @Post("electricity/validate")
  @RequirePermissions("campaign:create")
  validateMeter(@Body() body: ValidateMeterDto) {
    return this.vtu.validateMeter(body);
  }

  @Post("electricity")
  @RequirePermissions("campaign:create")
  buyElectricity(@Body() body: BuyElectricityDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyElectricity(workspaceContextFromRequest(request), body);
  }

  @Post("cable")
  @RequirePermissions("campaign:create")
  buyCable(@Body() body: BuyCableDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyCable(workspaceContextFromRequest(request), body);
  }

  @Get("bills/orders")
  @RequirePermissions("analytics:read")
  listBillsOrders(
    @Query() query: BillsOrderQueryDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.listBillsOrders(workspaceContextFromRequest(request), query);
  }
}

@Controller("admin/vtu")
@RequirePermissions("admin:access")
export class AdminVtuController {
  constructor(@Inject(VtuService) private readonly vtu: VtuService) {}

  @Get("routes")
  listRoutes() {
    return this.vtu.adminListRoutes();
  }

  @Patch("routes/:id")
  updateRoute(
    @Param("id") id: string,
    @Body() body: AdminVtuRouteUpdateDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.adminUpdateRoute(id, body, workspaceContextFromRequest(request));
  }

  @Post("orders/:id/resolve")
  resolveOrder(
    @Param("id") id: string,
    @Body() body: { resolution: "DELIVERED" | "REVERSED" },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.adminResolveOrder(id, body.resolution, workspaceContextFromRequest(request));
  }

  @Get("bills/orders")
  adminBillsOrders(
    @Query() query: { status?: string; productType?: string; days?: number; limit?: number }
  ) {
    return this.vtu.adminBillsOrders(query);
  }
}
