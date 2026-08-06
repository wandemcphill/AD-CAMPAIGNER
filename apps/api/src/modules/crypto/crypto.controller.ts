import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import { CryptoService } from "./crypto.service";
import type { CreateDepositAddressDto, DepositAddressQueryDto, RateQueryDto } from "./crypto.dtos";

@Controller("crypto")
@RequirePermissions("analytics:read")
export class CryptoController {
  constructor(@Inject(CryptoService) private readonly crypto: CryptoService) {}

  @Get("assets")
  listAssets() {
    return this.crypto.listAssets();
  }

  @Get("assets/:asset/rate")
  getRate(@Param("asset") asset: string, @Query() query: RateQueryDto) {
    return this.crypto.getRate(asset, query.amount ?? 1);
  }

  @Get("deposit-address")
  getDepositAddress(@Query() query: DepositAddressQueryDto, @Req() request: WorkspaceContextRequest) {
    return this.crypto.getDepositAddress(
      workspaceContextFromRequest(request),
      query.asset,
      query.network
    );
  }

  @Post("deposit-address")
  @RequirePermissions("campaign:create")
  createDepositAddress(
    @Body() body: CreateDepositAddressDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.crypto.createDepositAddress(workspaceContextFromRequest(request), body);
  }

  @Get("transactions")
  listTransactions(@Req() request: WorkspaceContextRequest) {
    return this.crypto.listTransactions(workspaceContextFromRequest(request));
  }
}
