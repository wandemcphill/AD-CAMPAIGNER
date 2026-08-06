import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import { RmbService } from "./rmb.service";
import type { CreateRmbOrderDto } from "./rmb.dtos";

@Controller("rmb")
@RequirePermissions("analytics:read")
export class RmbController {
  constructor(@Inject(RmbService) private readonly rmb: RmbService) {}

  @Get("rates")
  getRates() {
    return this.rmb.getRates();
  }

  @Get("orders")
  listOrders(@Req() request: WorkspaceContextRequest) {
    return this.rmb.listOrders(workspaceContextFromRequest(request));
  }

  @Post("buy")
  @RequirePermissions("campaign:create")
  createOrder(@Body() body: CreateRmbOrderDto, @Req() request: WorkspaceContextRequest) {
    return this.rmb.createOrder(workspaceContextFromRequest(request), body);
  }
}
